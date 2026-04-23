import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  try {
    const { event, projectId, metadata } = await req.json()

    const validEvents = [
      'session_started',
      'first_message_sent',
      'file_attached',
      'gate_shown',
      'gate_submitted',
      'dashboard_viewed',
      'payment_initiated',
      'human_review_requested',
    ]

    if (!validEvents.includes(event)) {
      return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
    }

    const supabase = createAdminClient()
    await supabase.from('analytics_events').insert({
      project_id: projectId ?? null,
      event_type: event,
      metadata:   metadata ?? {},
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[ANALYTICS]', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')

  if (!key || key !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Funnel: sessions → first message → gate shown → gate submitted
  const { data: events } = await supabase
    .from('analytics_events')
    .select('event_type, created_at')
    .order('created_at', { ascending: false })
    .limit(1000)

  const counts: Record<string, number> = {}
  ;(events ?? []).forEach(e => {
    counts[e.event_type] = (counts[e.event_type] ?? 0) + 1
  })

  const sessions    = counts['session_started']    ?? 0
  const firstMsg    = counts['first_message_sent'] ?? 0
  const gateShown   = counts['gate_shown']         ?? 0
  const gateSubmit  = counts['gate_submitted']     ?? 0
  const payInit     = counts['payment_initiated']  ?? 0

  return NextResponse.json({
    funnel: {
      sessions,
      firstMessageRate: sessions ? Math.round((firstMsg / sessions) * 100) : 0,
      gateShowRate:     sessions ? Math.round((gateShown / sessions) * 100) : 0,
      gateConversion:   gateShown ? Math.round((gateSubmit / gateShown) * 100) : 0,
      paymentInitRate:  gateSubmit ? Math.round((payInit / gateSubmit) * 100) : 0,
    },
    raw: counts,
  })
}
