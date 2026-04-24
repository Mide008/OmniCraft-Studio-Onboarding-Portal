import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateSlug } from '@/lib/utils'

export const runtime    = 'nodejs'
export const maxDuration = 60  // Vercel Pro: 300s. Free: 60s max — Gemini must finish in this window

// Vercel free tier: 4.5MB body limit per request
// Base64 encoding inflates by ~33%, so a 3MB file becomes ~4MB base64
// We enforce a 3MB per-file limit to stay safely under the 4.5MB body cap
const MAX_FILE_BYTES = 3 * 1024 * 1024

// ─── Lazy-load AI clients ─────────────────────────────────────────────────────
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

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM = `You are a Senior Design Engineer and Brand Strategist at OmniCraft Studios — a studio with 20 years of expertise in UI/UX, Brand Identity, and Full-Stack Engineering.

Your role: guide prospective clients through a thorough discovery conversation. You listen, probe, and synthesise — like a consultant in an initial meeting, not a chatbot.

Rules:
- Be precise, warm, direct. Never use filler like "Certainly!" or "Great question!"
- Ask at most 2 clarifying questions per response — make each one count
- Use markdown: **bold** for emphasis, numbered lists each on a new line, — dashes for sub-points
- Separate distinct paragraphs with blank lines
- Never rush to solutions — discovery first
- Your responses should feel like they come from someone who has run 200 studio engagements`

// ─── Mode detection ───────────────────────────────────────────────────────────
function detectMode(text: string): string {
  if (/api|database|backend|architecture|code|deploy|platform|app|tech|stack|infrastructure/i.test(text)) return 'engineering'
  if (/market|competitor|research|trend|audience|positioning|analysis|industry/i.test(text)) return 'research'
  return 'creative'
}

// ─── Groq streaming ───────────────────────────────────────────────────────────
async function streamGroq(
  message: string,
  history: { role: string; content: string }[]
): Promise<ReadableStream<Uint8Array>> {
  const client  = getGroq()
  const encoder = new TextEncoder()

  const stream = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.65,
    max_tokens: 1400,
    stream: true,
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

interface MoodboardData {
  colors: string[]; mood: string; style: string; typography: string; vibe: string
}

// ─── Gemini file analysis ─────────────────────────────────────────────────────
async function analyseWithGemini(
  message: string,
  attachments: { name: string; mimeType: string; base64: string; sizeBytes: number }[],
  history: { role: string; content: string }[]
): Promise<{ text: string; moodboard?: MoodboardData }> {

  // Check individual file sizes before sending to Gemini
  const oversized = attachments.filter(a => a.sizeBytes > MAX_FILE_BYTES)
  if (oversized.length > 0) {
    const names = oversized.map(a => `"${a.name}"`).join(', ')
    return {
      text: [
        `The file${oversized.length > 1 ? 's' : ''} ${names} ${oversized.length > 1 ? 'are' : 'is'} too large to process on the current hosting plan.`,
        '',
        '**To send large files, please:**',
        '1. Compress the PDF to under 3 MB using smallpdf.com (free)',
        '2. For images: resize to under 2 MB using squoosh.app (free)',
        '3. For audio/video: share a Google Drive or Dropbox link instead, and paste it in the chat',
        '',
        `In the meantime, could you describe what's in the file? I'll work from your description.`,
      ].join('\n'),
    }
  }

  const ai = getGenAI()
  if (!ai) {
    return {
      text: [
        'File analysis requires a Gemini API key.',
        '',
        'Add `GOOGLE_GENERATIVE_AI_API_KEY=AIza...` to your environment variables to enable this.',
        '',
        'Could you describe what\'s in the file? I\'ll work from your description.',
      ].join('\n'),
    }
  }

  const hasImages = attachments.some(a => a.mimeType.startsWith('image/'))

  const fileDesc = attachments.map(a => {
    if (a.mimeType.startsWith('image/')) return 'an image'
    if (a.mimeType === 'application/pdf') return 'a PDF document'
    if (a.mimeType.startsWith('audio/')) return 'an audio file'
    return 'a video'
  }).join(' and ')

  const systemPrompt = `${SYSTEM}

The user has attached ${fileDesc}. Analyse it thoroughly.

${hasImages ? `For any image: extract a Brand Moodboard. At the very END of your response, on its own line, output exactly this format (raw JSON, no markdown fences):
MOODBOARD_JSON:{"colors":["#hex1","#hex2","#hex3"],"mood":"one word","style":"e.g. Minimalist","typography":"e.g. Geometric Sans","vibe":"one evocative sentence describing the brand feeling"}` : ''}

Structure your response:
1. What the file contains (be specific)
2. Key insights for a design/engineering brief
3. Observations relevant to brand, tech, or strategy
4. 1–2 targeted follow-up questions`

  try {
    const model = ai.getGenerativeModel({ model: 'gemini-3-flash-preview' })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parts: any[] = [
      { text: systemPrompt },
      ...history.slice(-6).map(m => ({ text: `${m.role}: ${m.content}` })),
      { text: `User: ${message || 'Please analyse the attached file.'}` },
      ...attachments.map(a => ({ inlineData: { data: a.base64, mimeType: a.mimeType } })),
    ]

    const result = await model.generateContent(parts)
    const full   = result.response.text()

    // Extract moodboard
    let moodboard: MoodboardData | undefined
    let text = full

    const match = full.match(/MOODBOARD_JSON:(\{[^\n]+\})/)
    if (match) {
      try { moodboard = JSON.parse(match[1]) } catch { /* ignore */ }
      text = full.replace(/MOODBOARD_JSON:[^\n]+/, '').trim()
    }

    return { text, moodboard }

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[GEMINI ERROR]', msg)

    // Translate Gemini errors into helpful user messages
    if (/quota|rate.?limit|429|resource.?exhausted/i.test(msg)) {
      return {
        text: [
          'The file analysis engine has hit its rate limit (Gemini free tier allows 15 requests per minute).',
          '',
          'Please wait 60 seconds and try again. Alternatively, describe the file content in text and I\'ll work from that.',
        ].join('\n'),
      }
    }
    if (/too.?large|size|limit/i.test(msg)) {
      return {
        text: [
          'This file is too large for the current plan.',
          '',
          '**Reduce file size:**',
          '1. PDFs → compress at smallpdf.com',
          '2. Images → resize at squoosh.app',
          '3. Audio/video → share a Google Drive link instead',
        ].join('\n'),
      }
    }
    if (/unsupported|mime.?type/i.test(msg)) {
      return {
        text: 'This file format isn\'t supported for analysis. Supported types: PDF, JPG, PNG, WebP, MP3, WAV, MP4. Could you describe the file content instead?',
      }
    }

    return {
      text: `File analysis encountered an error. Could you describe what's in the file? I'll work from your description.\n\n(Technical detail: ${msg.slice(0, 100)})`,
    }
  }
}

// ─── Helper to save messages (without .catch) ─────────────────────────────────
async function saveMessage(projectId: string | null, role: 'user' | 'assistant', content: string, mode: string, metadata: any = {}) {
  if (!projectId) return
  try {
    const supabase = createAdminClient()
    await supabase.from('messages').insert({
      project_id: projectId,
      role,
      content,
      mode,
      metadata,
    })
  } catch (err) {
    console.error(`Failed to save ${role} message:`, err)
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, messages: history = [], attachments = [], sessionSlug } = body

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

    // ── Save user message (non‑fatal) ──
    if (projectId && message?.trim()) {
      await saveMessage(projectId, 'user', message.trim(), mode, 
        attachments.length > 0
          ? { attachmentCount: attachments.length, attachmentTypes: attachments.map((a: {mimeType:string}) => a.mimeType) }
          : {}
      )
    }

    // Update project mode
    if (projectId) {
      try {
        await supabase.from('projects').update({ mode: [mode] }).eq('id', projectId)
      } catch (err) {
        console.error('Failed to update project mode:', err)
      }
    }

    const hasFiles = attachments.length > 0

    // ── File analysis via Gemini ──
    if (hasFiles) {
      // Add sizeBytes from base64 length for validation
      const annotated = attachments.map((a: {name:string;mimeType:string;base64:string}) => ({
        ...a,
        sizeBytes: Math.round(a.base64.length * 0.75), // base64 to bytes approximation
      }))

      const { text, moodboard } = await analyseWithGemini(message ?? '', annotated, history)

      if (projectId) {
        await saveMessage(projectId, 'assistant', text, mode, moodboard ? { moodboard } : {})
      }

      const headers: Record<string, string> = {
        'Content-Type':   'text/plain; charset=utf-8',
        'X-Project-Id':   projectId ?? '',
        'X-Project-Slug': projectSlug ?? '',
        'X-Mode':         mode,
      }
      if (moodboard) headers['X-Moodboard'] = JSON.stringify(moodboard)

      return new Response(text, { status: 200, headers })
    }

    // ── Text-only: Groq streaming ──
    const stream = await streamGroq(message, history)
    const [forClient, forSave] = stream.tee()

    // Save response in background (non‑blocking)
    if (projectId) {
      (async () => {
        const reader = forSave.getReader()
        const dec    = new TextDecoder()
        let   full   = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          full += dec.decode(value, { stream: true })
        }
        await saveMessage(projectId, 'assistant', full, mode)
      })().catch(console.error)
    }

    return new Response(forClient, {
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
    const msg = err instanceof Error ? err.message : String(err)

    // Specific, useful error messages instead of generic ones
    if (/credit|billing|balance|402/i.test(msg)) {
      return new Response('The AI engine needs a billing top-up. Visit console.groq.com → Billing.', { status: 200 })
    }
    if (/quota|rate.?limit|429/i.test(msg)) {
      return new Response('Request limit reached. Please wait 30 seconds and try again.', { status: 200 })
    }
    if (/body.*too.?large|payload.*too.?large|413/i.test(msg)) {
      return new Response(
        'The attached file is too large for this request. Please compress it to under 3 MB and try again.\n\n' +
        '— PDF: smallpdf.com\n— Image: squoosh.app\n— Audio/video: share a Google Drive link instead.',
        { status: 200 }
      )
    }

    return new Response('Connection issue. Please try again.', { status: 200 })
  }
}