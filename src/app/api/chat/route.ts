import { NextRequest } from 'next/server'
import { GoogleGenAI } from '@google/genai'

// ─── Lazy-load Groq SDK ─────────────────────────────────────────────────────
type GroqClient = InstanceType<typeof import('groq-sdk').default>
let groq: GroqClient | null = null

function getGroq(): GroqClient {
  if (!groq) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Groq = require('groq-sdk').default
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is missing in environment variables')
    }
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
  }
  return groq // TypeScript knows it's not null because we threw above
}

// ─── Gemini 3 client ────────────────────────────────────────────────────────
let genAIClient: GoogleGenAI | null = null

function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY
    if (!key || !key.startsWith('AI')) {
      throw new Error('Gemini API key missing or invalid – expected AIza...')
    }
    genAIClient = new GoogleGenAI({ apiKey: key })
  }
  return genAIClient
}

// ─── System prompt ──────────────────────────────────────────────────────────
const SYSTEM = `You are a Senior Design Engineer and Brand Strategist at OmniCraft Studios — a studio with 20 years of expertise in UI/UX, Brand Identity, and Full-Stack Engineering.

Your role: guide prospective clients from a vague idea to a concrete technical and creative roadmap.

Communication rules:
- Be precise, warm, and direct. Never use filler phrases like "Certainly!" or "Great question!"
- When listing multiple points, put EACH point on its own line starting with the number
- Separate distinct ideas with blank lines for readability
- Use markdown: **bold** for emphasis, numbered lists for steps, — dashes for sub-points
- Ask at most 2 clarifying questions per response`

// ─── Groq streaming helper ──────────────────────────────────────────────────
async function streamGroq(
  userMessage: string,
  history: { role: string; content: string }[]
): Promise<ReadableStream<Uint8Array>> {
  const client = getGroq()
  const encoder = new TextEncoder()

  const stream = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.65,
    max_tokens: 1200,
    stream: true,
    messages: [
      { role: 'system', content: SYSTEM },
      ...history.slice(-10).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: userMessage },
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
      } catch (e) {
        controller.error(e)
      }
    },
  })
}

// ─── Gemini 3 file analysis ─────────────────────────────────────────────────
async function analyseWithGemini(
  message: string,
  attachments: { name: string; mimeType: string; base64: string }[],
  history: { role: string; content: string }[]
): Promise<string> {
  const client = getGenAI()
  const modelId = 'gemini-3-flash-preview'

  // Build a descriptive prompt
  const fileDescriptions = attachments.map((a) => {
    if (a.mimeType.startsWith('image/')) return 'an image'
    if (a.mimeType === 'application/pdf') return 'a PDF document'
    if (a.mimeType.startsWith('audio/')) return 'an audio file'
    if (a.mimeType.startsWith('video/')) return 'a video file'
    return 'a file'
  }).join(', ')

  const systemPrompt = `${SYSTEM}

The user has attached ${fileDescriptions}. Analyse it thoroughly and respond with:
1. A clear summary of what the file contains
2. Key insights relevant to a design/engineering brief
3. Specific observations (for images: visual style, palette, composition; for PDFs: requirements, audience, constraints; for audio/video: tone, content, key points)
4. 1–2 clarifying questions to continue the discovery

Formatting:
- Each numbered point on its own line
- Blank lines between sections
- Use **bold** for emphasis
- Be specific and actionable`

  const historyText = history.slice(-6).map((m) => `${m.role}: ${m.content}`).join('\n')
  const fullPrompt = `${systemPrompt}\n\nRecent History:\n${historyText}\n\nUser message: ${message || 'Please analyse the attached file.'}`

  // Build parts: one text part + inlineData for each file
  const parts: any[] = [{ text: fullPrompt }]
  for (const a of attachments) {
    let cleanBase64 = a.base64
    if (cleanBase64.includes(',')) cleanBase64 = cleanBase64.split(',')[1]
    parts.push({
      inlineData: {
        data: cleanBase64,
        mimeType: a.mimeType,
      },
    })
  }

  try {
    const response = await client.models.generateContent({
      model: modelId,
      contents: [
        {
          role: 'user',
          parts: parts,
        },
      ],
    })
    return response.text || 'No analysis generated.'
  } catch (err) {
    console.error('[Gemini 3 Error]', err)
    return `Gemini analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again.`
  }
}

// ─── Route handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { message, messages: history = [], attachments = [] } = await req.json()

    if (!message?.trim() && attachments.length === 0) {
      return new Response('Message or attachment required', { status: 400 })
    }

    if (attachments.length > 0) {
      const text = await analyseWithGemini(message ?? '', attachments, history)
      return new Response(text, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
    }

    // Text-only → Groq streaming
    const stream = await streamGroq(message, history)
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache, no-store',
      },
    })
  } catch (err) {
    console.error('[CHAT ROUTE]', err)
    const msg = err instanceof Error ? err.message : String(err)
    const isQuota = /quota|rate.?limit|429/i.test(msg)
    const isBilling = /credit|billing|402|balance/i.test(msg)
    const friendly = isBilling
      ? 'The AI engine needs a billing top-up. Visit console.groq.com → Billing.'
      : isQuota
      ? 'Request limit reached. Please wait a moment and try again.'
      : 'Something went wrong connecting to the AI. Please try again.'
    return new Response(friendly, { status: 200 })
  }
}