import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

interface PushRequest {
  projectId:     string
  adminKey:      string
  adminNotes?:   string
  quoteAmount?:  number
  quoteCurrency?: string
  breakdown?:    { label: string; amount: number; description?: string }[]
  timelineWeeks?: number
  validUntilDays?: number  // days from now
}

export async function POST(request: NextRequest) {
  try {
    const body: PushRequest = await request.json()
    const {
      projectId,
      adminKey,
      adminNotes,
      quoteAmount,
      quoteCurrency   = 'USD',
      breakdown       = [],
      timelineWeeks,
      validUntilDays  = 14,
    } = body

    // Validate admin key
    if (!adminKey || adminKey !== process.env.ADMIN_SECRET_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 })
    }

    const supabase  = createAdminClient()
    const now       = new Date().toISOString()
    const validDate = new Date(Date.now() + validUntilDays * 86_400_000)
                        .toISOString()
                        .split('T')[0]

    // Publish roadmap
    const { error: roadmapError } = await supabase
      .from('roadmaps')
      .update({
        admin_notes:    adminNotes ?? null,
        timeline_weeks: timelineWeeks ?? null,
        published_at:   now,
      })
      .eq('project_id', projectId)

    if (roadmapError) {
      console.error('[PUSH] roadmap update failed:', roadmapError)
      return NextResponse.json({ error: 'Failed to publish roadmap' }, { status: 500 })
    }

    // Upsert and publish quote (if amount provided)
    if (quoteAmount !== undefined && quoteAmount > 0) {
      const { error: quoteError } = await supabase
        .from('quotes')
        .upsert(
          {
            project_id:   projectId,
            currency:     quoteCurrency,
            amount:       quoteAmount,
            breakdown,
            valid_until:  validDate,
            published_at: now,
          },
          { onConflict: 'project_id' }
        )

      if (quoteError) {
        console.error('[PUSH] quote upsert failed:', quoteError)
        return NextResponse.json({ error: 'Failed to publish quote' }, { status: 500 })
      }
    }

    // Advance project to reveal phase
    const { error: projectError } = await supabase
      .from('projects')
      .update({ phase: 'reveal', status: 'published' })
      .eq('id', projectId)

    if (projectError) {
      console.error('[PUSH] project update failed:', projectError)
      return NextResponse.json({ error: 'Failed to update project status' }, { status: 500 })
    }

    return NextResponse.json({ success: true, publishedAt: now })
  } catch (error) {
    console.error('[PUSH ERROR]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
