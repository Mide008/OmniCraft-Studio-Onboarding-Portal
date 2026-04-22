import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import type { RoadmapDraft } from '@/types'

export const runtime     = 'nodejs'
export const maxDuration = 120

const ROADMAP_SYSTEM = `You are a Senior Full-Stack Design Engineer with 20 years of practice.
Given a conversation between a design studio and a prospective client, generate a structured project roadmap in valid JSON.

Return ONLY raw JSON — no markdown fences, no preamble. The JSON must conform exactly to this shape:

{
  "projectSummary": "2-3 sentence precise summary of what is being built and why",
  "technicalStack": ["array of recommended technologies with brief rationale each"],
  "designSystem": {
    "brandPillars": ["Pillar One — one sentence explanation", "Pillar Two — ...", "Pillar Three — ..."],
    "colorDirection": "Specific colour direction rationale (e.g. 'Near-black primary with warm terracotta accent — signals premium craft without coldness')",
    "typographyDirection": "Typeface category recommendation and rationale"
  },
  "architecture": {
    "databaseSchema": "Key tables and relationships described in plain English",
    "apiSurface": ["POST /api/resource — description", "GET /api/resource/:id — description"],
    "authModel": "Authentication approach and rationale",
    "infrastructureNotes": "Hosting, CDN, edge considerations"
  },
  "competitorGaps": ["Specific gap with actionable opportunity", "..."],
  "marketOpportunities": ["Named opportunity with brief rationale", "..."],
  "uxDebtFlags": ["Specific UX issue to avoid or fix", "..."],
  "phases": [
    { "number": 1, "title": "Phase title", "duration": "X weeks", "deliverables": ["deliverable", "..."] },
    { "number": 2, "title": "Phase title", "duration": "X weeks", "deliverables": ["deliverable", "..."] }
  ]
}

Be specific. Name technologies, not categories. Name competitors, not vague markets. Flag real risks.
If the conversation lacks detail for a section, make reasonable inferences and note them with "(inferred)" at the end of that value.`

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json()

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 })
    }

    const supabase = createAdminClient()

    // Fetch full conversation
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('role, content')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true })

    if (msgError || !messages?.length) {
      return NextResponse.json({ error: 'No conversation found' }, { status: 404 })
    }

    // Fetch any asset analyses to enrich context
    const { data: assets } = await supabase
      .from('assets')
      .select('type, filename, analysis, transcription')
      .eq('project_id', projectId)

    const assetContext = (assets ?? [])
      .filter((a) => a.analysis || a.transcription)
      .map((a) =>
        `[${a.type.toUpperCase()} — ${a.filename}]:\n${a.analysis ?? a.transcription}`
      )
      .join('\n\n')

    const conversationText = messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n')

    const userPrompt = [
      'CONVERSATION:\n',
      conversationText,
      assetContext ? `\n\nUPLOADED FILE ANALYSES:\n${assetContext}` : '',
      '\n\nGenerate the structured roadmap JSON now.',
    ].join('')

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system:     ROADMAP_SYSTEM,
      messages:   [{ role: 'user', content: userPrompt }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text : ''

    let draft: RoadmapDraft
    try {
      draft = JSON.parse(raw.trim())
    } catch {
      console.error('[ROADMAP] JSON parse failed. Raw output:', raw.slice(0, 300))
      return NextResponse.json({ error: 'Roadmap generation produced invalid JSON' }, { status: 500 })
    }

    // Upsert roadmap with AI draft
    const { data: roadmap, error: roadmapError } = await supabase
      .from('roadmaps')
      .upsert(
        { project_id: projectId, ai_draft: draft, final_scope: draft },
        { onConflict: 'project_id' }
      )
      .select('id')
      .single()

    if (roadmapError) {
      console.error('[ROADMAP] upsert error:', roadmapError)
      return NextResponse.json({ error: 'Failed to save roadmap' }, { status: 500 })
    }

    // Advance project to synthesis phase
    await supabase
      .from('projects')
      .update({ phase: 'synthesis', summary: draft.projectSummary ?? null })
      .eq('id', projectId)

    return NextResponse.json({ roadmapId: roadmap.id, draft })
  } catch (error) {
    console.error('[ROADMAP ERROR]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
