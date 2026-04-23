import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateSlug } from '@/lib/utils'

// ─── AI clients (lazy-loaded) ─────────────────────────────────────────────────
let _groq: InstanceType<typeof import('groq-sdk').default> | null = null
let _genAI: InstanceType<typeof import('@google/generative-ai').GoogleGenerativeAI> | null = null

function getGroq() {
  if (!_groq) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Groq = require('groq-sdk').default
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  }
  return _groq!
}

function getGenAI() {
  if (_genAI) return _genAI
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY
  if (!key?.startsWith('AI')) return null
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { GoogleGenerativeAI } = require('@google/generative-ai')
  _genAI = new GoogleGenerativeAI(key)
  return _genAI!
}

// ─── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM = `You are a Senior Design Engineer and Brand Strategist at OmniCraft Studios — a studio with 20 years of expertise in UI/UX, Brand Identity, and Full-Stack Engineering.

Your role: guide prospective clients through a thorough discovery conversation. You listen, probe, and synthesise — like a consultant in an initial meeting, not a chatbot.

Rules:
- Be precise, warm, direct. Never use filler like "Certainly!" or "Great question!"
- Ask at most 2 clarifying questions per response — make each one count
- Use markdown: **bold** for emphasis, numbered lists each on a new line, — dashes for sub-points
- Separate distinct paragraphs with blank lines
- Never rush to solutions — discovery first
- Your responses should feel like they come from someone who has run 200 studio engagements`

// ─── Mode detection ────────────────────────────────────────────────────────────
function detectMode(text: string): string {
  const l = text.toLowerCase()
  if (/api|database|backend|architecture|code|deploy|system|platform|app|tech|stack|infrastructure/i.test(l)) return 'engineering'
  if (/market|competitor|research|trend|audience|positioning|analysis|industry/i.test(l)) return 'research'
  return 'creative'
}

// ─── Groq streaming ────────────────────────────────────────────────────────────
async function streamGroq(message: string, history: {role:string;content:string}[]): Promise<ReadableStream<Uint8Array>> {
  const client  = getGroq()
  const encoder = new TextEncoder()

  const stream = await client.chat.completions.create({
    model:       'llama-3.3-70b-versatile',
    temperature: 0.65,
    max_tokens:  1400,
    stream:      true,
    messages: [
      { role: 'system', content: SYSTEM },
      ...history.slice(-14).map(m => ({ role: m.role as 'user'|'assistant', content: m.content })),
      { role: 'user', content: message },
    ],
  })

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? ''
          if (text) controller.enqueue(encoder.encode(text))
        }
        controller.close()
      } catch (e) { controller.error(e) }
    },
  })
}

// ─── Gemini file + moodboard analysis ─────────────────────────────────────────
async function analyseWithGemini(
  message: string,
  attachments: {name:string;mimeType:string;base64:string}[],
  history: {role:string;content:string}[]
): Promise<{ text: string; moodboard?: MoodboardData }> {
  const ai = getGenAI()
  if (!ai) {
    return {
      text: [
        'I can see you\'ve attached a file, but file analysis requires a Gemini API key.',
        '',
        'Add `GOOGLE_GENERATIVE_AI_API_KEY=AIza...` to your `.env.local` to enable it.',
        '',
        'Could you describe the file content? I\'ll work with what you share.',
      ].join('\n'),
    }
  }

  const hasImages = attachments.some(a => a.mimeType.startsWith('image/'))

  const systemPrompt = `${SYSTEM}

The user has attached ${attachments.map(a => {
  if (a.mimeType.startsWith('image/')) return 'an image'
  if (a.mimeType === 'application/pdf') return 'a PDF'
  if (a.mimeType.startsWith('audio/')) return 'an audio file'
  return 'a video file'
}).join(', ')}.

${hasImages ? `IMPORTANT: For any image attachments, also extract a Brand Moodboard as a JSON block at the END of your response, formatted exactly like this (no markdown fences, just the raw JSON on its own line):
MOODBOARD_JSON:{"colors":["#hex1","#hex2","#hex3"],"mood":"one word","style":"e.g. Minimalist / Editorial / Bold","typography":"e.g. Serif / Geometric Sans","vibe":"one evocative sentence"}` : ''}

Analyse the file(s) thoroughly:
1. Summarise what the file contains or shows
2. Extract key insights for a design/engineering brief
3. Identify requirements, constraints, or opportunities
4. Ask 1-2 specific follow-up questions to continue discovery`

  const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts: any[] = [
    { text: systemPrompt },
    ...history.slice(-6).map(m => ({ text: `${m.role}: ${m.content}` })),
    { text: `User: ${message || 'Please analyse the attached file.'}` },
    ...attachments.map(a => ({ inlineData: { data: a.base64, mimeType: a.mimeType } })),
  ]

  const result = await model.generateContent(parts)
  const full   = result.response.text()

  // Extract moodboard JSON if present
  let moodboard: MoodboardData | undefined
  let text = full

  const moodboardMatch = full.match(/MOODBOARD_JSON:(\{[^\n]+\})/)
  if (moodboardMatch) {
    try {
      moodboard = JSON.parse(moodboardMatch[1])
      text = full.replace(/MOODBOARD_JSON:[^\n]+/, '').trim()
    } catch { /* ignore parse errors */ }
  }

  return { text, moodboard }
}

interface MoodboardData {
  colors:     string[]
  mood:       string
  style:      string
  typography: string
  vibe:       string
}

// ─── Route ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { message, messages: history = [], attachments = [], sessionSlug } = await req.json()

    if (!message?.trim() && attachments.length === 0) {
      return new Response('Message or attachment required', { status: 400 })
    }

    const supabase = createAdminClient()
    const mode     = detectMode(message ?? '')

    // ── Get or create project ──
    let projectId:   string | null = null
    let projectSlug: string | null = sessionSlug ?? null

    if (sessionSlug) {
      const { data } = await supabase.from('projects').select('id').eq('slug', sessionSlug).single()
      if (data) projectId = data.id
    }

    if (!projectId) {
      const slug = generateSlug()
      const { data: proj } = await supabase
        .from('projects')
        .insert({ slug, phase: 'discovery', mode: [mode], status: 'draft' })
        .select('id, slug').single()
      if (proj) { projectId = proj.id; projectSlug = proj.slug }
    }

    // ── Save user message ──
    if (projectId && message?.trim()) {
      await supabase.from('messages').insert({
        project_id: projectId, role: 'user', content: message.trim(), mode,
        metadata: attachments.length > 0 ? { attachmentCount: attachments.length, attachmentTypes: attachments.map((a:{mimeType:string}) => a.mimeType) } : {},
      })
    }

    // ── Track analytics ──
    if (projectId) {
      await supabase.from('projects').update({ mode: [mode] }).eq('id', projectId)
    }

    // ── Generate AI response ──
    const hasFiles = attachments.length > 0

    if (hasFiles) {
      const { text, moodboard } = await analyseWithGemini(message ?? '', attachments, history)

      // Save AI response to DB
      if (projectId) {
        await supabase.from('messages').insert({
          project_id: projectId, role: 'assistant', content: text, mode,
          metadata: moodboard ? { moodboard } : {},
        })
      }

      // Return with moodboard header if extracted
      const headers: Record<string,string> = {
        'Content-Type':   'text/plain; charset=utf-8',
        'X-Project-Id':   projectId ?? '',
        'X-Project-Slug': projectSlug ?? '',
        'X-Mode':         mode,
      }
      if (moodboard) headers['X-Moodboard'] = JSON.stringify(moodboard)

      return new Response(text, { status: 200, headers })
    }

    // Text-only → Groq streaming
    const stream = await streamGroq(message, history)

    // Collect full response to save after streaming (via a tee)
    const [streamForClient, streamForSave] = stream.tee()

    // Background: collect full text and save
    if (projectId) {
      ;(async () => {
        const reader  = streamForSave.getReader()
        const dec     = new TextDecoder()
        let   fullText = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          fullText += dec.decode(value, { stream: true })
        }
        await supabase.from('messages').insert({
          project_id: projectId, role: 'assistant', content: fullText, mode,
        })
      })().catch(console.error)
    }

    return new Response(streamForClient, {
      status: 200,
      headers: {
        'Content-Type':      'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control':     'no-cache, no-store',
        'X-Project-Id':      projectId ?? '',
        'X-Project-Slug':    projectSlug ?? '',
        'X-Mode':            mode,
      },
    })
  } catch (err) {
    console.error('[CHAT ROUTE]', err)
    const msg  = err instanceof Error ? err.message : String(err)
    const user = /credit|billing|balance/i.test(msg)
      ? 'The AI engine needs a billing top-up. Visit console.groq.com → Billing.'
      : /quota|rate/i.test(msg)
      ? 'Request limit reached. Please wait a moment and try again.'
      : 'Connection issue. Please try again.'
    return new Response(user, { status: 200 })
  }
}
