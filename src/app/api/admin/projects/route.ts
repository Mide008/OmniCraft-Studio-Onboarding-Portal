import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('projects')
      .select(`
        id,
        slug,
        title,
        phase,
        status,
        mode,
        summary,
        created_at,
        updated_at,
        clients (
          id, name, email, phone, company
        ),
        messages (
          id, role, content, mode, created_at
        ),
        roadmaps (
          id, admin_notes, timeline_weeks, published_at
        ),
        quotes (
          id, amount, currency, published_at
        )
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Map snake_case → camelCase minimally for the frontend
    const projects = (data ?? []).map((p) => ({
      id:        p.id,
      slug:      p.slug,
      title:     p.title,
      phase:     p.phase,
      status:    p.status,
      mode:      p.mode,
      summary:   p.summary,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      client:    p.clients
        ? {
            id:      (p.clients as { id?: string }).id,
            name:    (p.clients as { name?: string }).name,
            email:   (p.clients as { email?: string }).email,
            phone:   (p.clients as { phone?: string }).phone,
            company: (p.clients as { company?: string }).company,
          }
        : null,
      messages: Array.isArray(p.messages)
        ? p.messages.map((m: { id: string; role: string; content: string; mode: string; created_at: string }) => ({
            id:        m.id,
            role:      m.role,
            content:   m.content,
            mode:      m.mode,
            timestamp: m.created_at,
          }))
        : [],
      roadmap: p.roadmaps
        ? {
            adminNotes:    (p.roadmaps as { admin_notes?: string }).admin_notes,
            timelineWeeks: (p.roadmaps as { timeline_weeks?: number }).timeline_weeks,
            publishedAt:   (p.roadmaps as { published_at?: string }).published_at,
          }
        : null,
      quote: p.quotes
        ? {
            amount:      (p.quotes as { amount?: number }).amount,
            currency:    (p.quotes as { currency?: string }).currency,
            publishedAt: (p.quotes as { published_at?: string }).published_at,
          }
        : null,
    }))

    return NextResponse.json({ projects })
  } catch (error) {
    console.error('[ADMIN PROJECTS ERROR]', error)
    return NextResponse.json({ error: 'Failed to load projects' }, { status: 500 })
  }
}
