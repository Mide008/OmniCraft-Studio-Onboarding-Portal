import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateSlug } from '@/lib/utils'

export const runtime = 'nodejs'
export const maxDuration = 60

let _groq: any = null,
  _genAI: any = null
function getGroq() {
  if (!_groq) {
    const G = require('groq-sdk')
    _groq = new G({ apiKey: process.env.GROQ_API_KEY })
  }
  return _groq
}
function getGenAI() {
  if (_genAI) return _genAI
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY
  if (!key?.startsWith('AI')) return null
  const { GoogleGenerativeAI } = require('@google/generative-ai')
  _genAI = new GoogleGenerativeAI(key)
  return _genAI
}

const SYSTEM = `You are a Senior Design Engineer and Brand Strategist at OmniCraft Studios — 20 years of expertise in UI/UX, Brand Identity, and Full-Stack Engineering.
Guide prospective clients through deep discovery. Listen, probe, synthesise. Be precise, warm, direct. Never say "Certainly!" or "Great question!".
Ask at most 2 questions per response. Use markdown: **bold**, numbered lists (each on its own line), — for sub-points. Separate paragraphs with blank lines.`

function detectMode(t: string) {
  if (/api|database|backend|architecture|code|deploy|platform|tech|stack/i.test(t)) return 'engineering'
  if (/market|competitor|research|trend|audience|positioning|analysis/i.test(t)) return 'research'
  return 'creative'
}

async function streamGroq(message: string, history: { role: string; content: string }[]) {
  const encoder = new TextEncoder()
  const stream = await getGroq().chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.65,
    max_tokens: 1400,
    stream: true,
    messages: [
      { role: 'system', content: SYSTEM },
      ...history.slice(-14).map((m: any) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ],
  })
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const t = chunk.choices[0]?.delta?.content ?? ''
          if (t) controller.enqueue(encoder.encode(t))
        }
        controller.close()
      } catch (e) {
        controller.error(e)
      }
    },
  })
}

async function analyseGemini(message: string, attachments: any[], history: any[]) {
  const ai = getGenAI()
  if (!ai) return { text: "File analysis requires GOOGLE_GENERATIVE_AI_API_KEY. Describe the file content and I'll work from that." }
  const oversized = attachments.filter((a: any) => Math.round(a.base64.length * 0.75) > 3 * 1024 * 1024)
  if (oversized.length) return { text: `**"${oversized[0].name}"** is too large. Compress to under 3MB first.\n\n— PDF: smallpdf.com\n— Image: squoosh.app` }
  const hasImages = attachments.some((a: any) => a.mimeType.startsWith('image/'))
  const prompt = `${SYSTEM}\n\nAnalyse the attached file(s) thoroughly:\n1. What the file contains (be specific)\n2. Key insights for a design/engineering brief\n3. Observations on brand, tech, or strategy\n4. 1–2 targeted follow-up questions${hasImages ? '\n\nFor images, output at the END on its own line:\nMOODBOARD_JSON:{"colors":["#hex1","#hex2","#hex3"],"mood":"word","style":"e.g. Minimalist","typography":"e.g. Geometric Sans","vibe":"one evocative sentence"}' : ''}`
  try {
    const model = ai.getGenerativeModel({ model: 'gemini-3-flash-preview' })
    const parts = [
      { text: prompt },
      ...history.slice(-6).map((m: any) => ({ text: `${m.role}: ${m.content}` })),
      { text: `User: ${message || 'Analyse the attached file.'}` },
      ...attachments.map((a: any) => ({ inlineData: { data: a.base64, mimeType: a.mimeType } })),
    ]
    const result = await model.generateContent(parts)
    const full = result.response.text()
    let moodboard, text = full
    const match = full.match(/MOODBOARD_JSON:(\{[^\n]+\})/)
    if (match) {
      try { moodboard = JSON.parse(match[1]) } catch { }
      text = full.replace(/MOODBOARD_JSON:[^\n]+/, '').trim()
    }
    return { text, moodboard }
  } catch (err: any) {
    const msg = err.message || ''
    if (/quota|rate|429|exhausted/i.test(msg)) return { text: 'Gemini rate limit hit. Wait 60 seconds and try again, or describe the file content in text.' }
    if (/too.?large|size/i.test(msg)) return { text: 'File too large. Compress to under 3MB and try again.' }
    return { text: `File analysis error. Describe the content and I will work from that.` }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { message, messages: history = [], attachments = [], sessionSlug } = await req.json()
    if (!message?.trim() && !attachments.length) return new Response('Message required', { status: 400 })
    const supabase = createAdminClient()
    const mode = detectMode(message ?? '')
    let projectId: string | null = null,
      projectSlug: string | null = sessionSlug ?? null
    if (sessionSlug) {
      const { data } = await supabase.from('projects').select('id').eq('slug', sessionSlug).single()
      if (data) projectId = data.id
    }
    if (!projectId) {
      const slug = generateSlug()
      const { data: proj } = await supabase
        .from('projects')
        .insert({ slug, phase: 'discovery', mode: [mode], status: 'draft' })
        .select('id, slug')
        .single()
      if (proj) {
        projectId = proj.id
        projectSlug = proj.slug
      }
    }
    // Save user message
    if (projectId && message?.trim()) {
      try {
        await supabase.from('messages').insert({
          project_id: projectId,
          role: 'user',
          content: message.trim(),
          mode,
          metadata: attachments.length ? { attachmentCount: attachments.length, attachmentTypes: attachments.map((a: any) => a.mimeType) } : {},
        })
      } catch (err) {
        console.error('Failed to save user message:', err)
      }
    }
    if (attachments.length) {
      const { text, moodboard } = await analyseGemini(message ?? '', attachments, history)
      if (projectId) {
        try {
          await supabase.from('messages').insert({
            project_id: projectId,
            role: 'assistant',
            content: text,
            mode,
            metadata: moodboard ? { moodboard } : {},
          })
        } catch (err) {
          console.error('Failed to save assistant message:', err)
        }
      }
      const headers: Record<string, string> = {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Project-Id': projectId ?? '',
        'X-Project-Slug': projectSlug ?? '',
        'X-Mode': mode,
      }
      if (moodboard) headers['X-Moodboard'] = JSON.stringify(moodboard)
      return new Response(text, { status: 200, headers })
    }
    const stream = await streamGroq(message, history)
    const [forClient, forSave] = stream.tee()
    if (projectId) {
      ;(async () => {
        const reader = forSave.getReader()
        const dec = new TextDecoder()
        let full = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          full += dec.decode(value, { stream: true })
        }
        try {
          await supabase.from('messages').insert({
            project_id: projectId,
            role: 'assistant',
            content: full,
            mode,
          })
        } catch (err) {
          console.error('Failed to save assistant message (stream):', err)
        }
      })().catch(() => {})
    }
    return new Response(forClient, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'X-Project-Id': projectId ?? '',
        'X-Project-Slug': projectSlug ?? '',
        'X-Mode': mode,
      },
    })
  } catch (err: any) {
    const msg = err?.message || ''
    if (/credit|billing|balance|402/i.test(msg)) return new Response('AI billing top-up needed. Visit console.groq.com → Billing.', { status: 200 })
    if (/quota|rate|429/i.test(msg)) return new Response('Rate limit hit. Please wait 30 seconds.', { status: 200 })
    return new Response('Connection issue. Please try again.', { status: 200 })
  }
}