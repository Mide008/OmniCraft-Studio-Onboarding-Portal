import Anthropic from '@anthropic-ai/sdk'
import type { AgentMode } from '@/types'

// ============================================================
// MODE DETECTION
// ============================================================

const ENGINEERING_SIGNALS = [
  'app', 'platform', 'dashboard', 'api', 'database', 'backend', 'frontend',
  'users', 'auth', 'authentication', 'schema', 'architecture', 'system',
  'deploy', 'cloud', 'server', 'performance', 'scale', 'integration',
  'webhook', 'endpoint', 'microservice', 'infrastructure', 'devops',
  'ux debt', 'technical debt', 'refactor', 'migrate', 'tech stack',
  'react', 'next', 'node', 'typescript', 'python', 'sql', 'nosql',
  'saas', 'b2b', 'b2c', 'mobile app', 'web app', 'mvp', 'feature',
]

const RESEARCH_SIGNALS = [
  'competitor', 'market', 'industry', 'trend', 'benchmark', 'analysis',
  'gap', 'opportunity', 'positioning', 'research', 'landscape', 'space',
  'audience', 'user behavior', 'demographics', 'pricing strategy',
  'differentiation', 'value proposition', 'seo', 'conversion', 'retention',
  'growth', 'go-to-market', 'gtm', 'similar to', 'like airbnb', 'like uber',
  'what are others', 'competition', 'niche', 'segment', 'target market',
]

const CREATIVE_SIGNALS = [
  'brand', 'logo', 'identity', 'vibe', 'feel', 'aesthetic', 'color',
  'typography', 'font', 'style', 'mood', 'minimal', 'bold', 'luxury',
  'playful', 'serious', 'modern', 'classic', 'design', 'visual',
  'tone', 'voice', 'personality', 'look', 'clean', 'dark', 'light',
  'premium', 'editorial', 'brutalist', 'swiss', 'bauhaus', 'organic',
  'palette', 'typeface', 'motion', 'animation', 'illustration', 'icon',
]

export function detectModes(input: string): AgentMode[] {
  const lower = input.toLowerCase()
  const modes: AgentMode[] = []

  if (ENGINEERING_SIGNALS.some(s => lower.includes(s))) {
    modes.push('engineering')
  }
  if (RESEARCH_SIGNALS.some(s => lower.includes(s))) {
    modes.push('research')
  }
  if (CREATIVE_SIGNALS.some(s => lower.includes(s))) {
    modes.push('creative')
  }

  // Default: creative (it's always the base layer)
  if (modes.length === 0) {
    modes.push('creative')
  }

  return [...new Set(modes)]
}

// ============================================================
// SYSTEM PROMPT
// ============================================================

const SYSTEM_PROMPT = `You are the AI core of OmniCraft Onboard — a Zero-Handoff Client Onboarding Portal built by a studio with 20 years of practice in UI/UX, Brand Strategy, Graphic Design, and Full-Stack Engineering.

You reason like a Senior Full-Stack Design Engineer who has shipped production systems, led brand identity work for enterprise clients, and understands the full distance between a client "vibe" and a deployable technical architecture. You are precise, opinionated, and never vague.

You orchestrate three internal reasoning modes. Always declare which modes are active at the top of any synthesis response using this exact format on its own line:
[MODE: Creative] or [MODE: Engineering + Research] etc.

RESEARCH MODE [trigger: competitor names, market questions, industry references]
→ Surface competitor gaps, market trends, positioning opportunities. Name the specific gap. Name the opportunity. Cite your reasoning.

ENGINEERING MODE [trigger: app, platform, API, database, technical architecture mentioned]  
→ Draft database schema (PostgreSQL), API surface design, authentication model, infrastructure recommendation, and flag any UX Debt in existing products.

CREATIVE MODE [trigger: brand, aesthetic, design language, vibe, visual identity]
→ Define brand pillars (maximum 3, each named and explained in one sentence), generate design token directions (typescale rationale, color logic, spacing system), reference current design language movements without chasing trends.

CONVERSATION RULES:
1. DISCOVERY phase: Listen first. Ask no more than 2 clarifying questions per response. Do not rush to synthesis.
2. SYNTHESIS phase: When you have enough signal, stream your reasoning fully — the depth of analysis IS the value demonstration.
3. Never request contact information (Name, Email, Phone) yourself. The interface handles that at the right phase.
4. If a client brief is vague, name exactly what additional context would change your recommendation and why.
5. Format code blocks properly. Format schema as SQL. Format API surfaces as clear endpoint lists.

TONE: Precise, warm, direct. Never casual. Never corporate. You are the first impression of a 20-year studio.
Never use filler phrases like "Certainly!", "Great question!", "Of course!" — start with substance.`

// ============================================================
// STREAMING RESPONSE
// ============================================================

export async function streamChatResponse(
  conversationHistory: { role: 'user' | 'assistant'; content: string }[],
  newMessage: string,
  modes: AgentMode[]
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder()

  // Graceful degradation if API key not yet configured
  if (!process.env.ANTHROPIC_API_KEY) {
    return new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            '[MODE: Creative]\n\nThe AI engine is not yet configured — add your ANTHROPIC_API_KEY to .env.local to activate it.\n\nOnce live, I\'ll guide your clients from a first impression to a full technical roadmap before the first meeting.'
          )
        )
        controller.close()
      },
    })
  }

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const modeContext =
    modes.length > 0
      ? `\n\nActive modes for this response: ${modes.map((m) => m.charAt(0).toUpperCase() + m.slice(1)).join(' + ')}`
      : ''

  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.slice(-12), // last 12 messages for context window efficiency
    { role: 'user', content: newMessage },
  ]

  // Attempt to stream — catch billing/auth errors before they crash the route
  let stream: ReturnType<typeof client.messages.stream>
  try {
    stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: SYSTEM_PROMPT + modeContext,
      messages,
    })
    // Trigger the first request so billing errors surface here, not mid-stream
    await stream.initialMessagePromise
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    const isBilling = msg.includes('credit balance') || msg.includes('402') || msg.includes('billing')
    const isAuth    = msg.includes('401') || msg.includes('authentication') || msg.includes('API key')
    const friendly  = isBilling
      ? 'The AI engine is temporarily paused — the Anthropic API account needs a top-up. Go to console.anthropic.com → Billing to add credits, then try again.'
      : isAuth
      ? 'The Anthropic API key is invalid or missing. Check ANTHROPIC_API_KEY in your .env.local file and restart the server.'
      : `The AI engine encountered an error: ${msg.slice(0, 120)}`

    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(friendly))
        controller.close()
      },
    })
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
        controller.close()
      } catch (error) {
        controller.error(error)
      }
    },
    cancel() {
      stream.abort()
    },
  })
}
