import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { AssetType } from '@/types'

export const runtime     = 'nodejs'
export const maxDuration = 120

const ANALYSIS_PROMPTS: Record<AssetType, string> = {
  image: `You are analysing a design inspiration image uploaded by a client during an onboarding session.
Extract and return:
1. Visual style (aesthetic direction, mood, era)
2. Color palette observations (dominant hues, contrast, temperature)
3. Typography impression (if visible)
4. Layout and composition patterns
5. Brand positioning signals (premium / accessible / playful / serious)
6. What this tells us about what the client values

Be specific and actionable. Maximum 200 words.`,

  pdf: `You are analysing a client brief or reference document uploaded during a design onboarding session.
Extract and return:
1. Project summary (what they're building / what they need)
2. Target audience signals
3. Stated or implied brand values
4. Competitor or inspiration references mentioned
5. Technical requirements or constraints named
6. Budget or timeline indicators (if any)
7. Key questions raised by gaps or ambiguities in the brief

Be specific. Flag anything that needs clarification. Maximum 300 words.`,

  video: `You are analysing a client video brief (likely a Loom or screen recording) uploaded during a design onboarding session.
Extract and return:
1. Core project description (what they explained)
2. Key pain points or problems stated
3. Design or technical references they showed or mentioned
4. Mood and energy of the client (helps calibrate tone)
5. Any specific deliverables they requested
6. Open questions or things they seemed uncertain about

Maximum 300 words.`,

  audio: `You are analysing a transcribed voice note from a client during a design onboarding session.
The text below is a Whisper transcription — treat it as spoken language with possible transcription errors.
Extract:
1. Core project intent
2. Key requirements mentioned
3. References or inspirations named
4. Emotional tone and client confidence level
5. Anything that needs follow-up clarification

Maximum 200 words.`,
}

interface AnalyseRequest {
  assetId:   string
  projectId: string
  type:      AssetType
  url:       string
  transcription?: string  // for audio
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalyseRequest = await request.json()
    const { assetId, projectId, type, url, transcription } = body

    if (!assetId || !projectId || !type || (!url && !transcription)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return NextResponse.json(
        { error: 'Gemini API key not configured', analysis: null },
        { status: 200 }  // Soft fail — don't break the upload flow
      )
    }

    let analysis: string | null = null
    const prompt = ANALYSIS_PROMPTS[type]

    if (type === 'audio' && transcription) {
      // Audio: analyse the transcription text directly
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { text: `\n\nTRANSCRIPTION:\n${transcription}` },
              ],
            }],
            generationConfig: { maxOutputTokens: 512, temperature: 0.3 },
          }),
        }
      )
      const data = await res.json()
      analysis = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null

    } else if (type === 'image' || type === 'pdf' || type === 'video') {
      // Fetch the file bytes for inline Gemini vision
      const fileRes  = await fetch(url)
      const buffer   = await fileRes.arrayBuffer()
      const base64   = Buffer.from(buffer).toString('base64')
      const mimeType = fileRes.headers.get('content-type') ?? 'application/octet-stream'

      const geminiModel =
        type === 'video' || type === 'pdf'
          ? 'gemini-2.0-flash'
          : 'gemini-2.0-flash'

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${process.env.GOOGLE_GENERATIVE_AI_API_KEY}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inlineData: { mimeType, data: base64 } },
              ],
            }],
            generationConfig: { maxOutputTokens: 512, temperature: 0.3 },
          }),
        }
      )
      const data = await res.json()
      analysis = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null
    }

    if (!analysis) {
      return NextResponse.json({ analysis: null })
    }

    // Persist analysis to asset record
    const supabase = createAdminClient()
    await supabase
      .from('assets')
      .update({ analysis })
      .eq('id', assetId)

    return NextResponse.json({ analysis })
  } catch (error) {
    console.error('[ANALYSE ERROR]', error)
    return NextResponse.json({ error: 'Analysis failed', analysis: null }, { status: 500 })
  }
}
