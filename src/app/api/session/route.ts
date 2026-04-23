import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const slug = searchParams.get('slug')

  if (!slug) return NextResponse.json({ error: 'slug required' }, { status: 400 })

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('projects')
    .select(`
      id, slug, phase, status, mode, summary, title,
      messages (id, role, content, mode, created_at, metadata),
      clients (name, email)
    `)
    .eq('slug', slug)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Format messages for the chat UI
  const messages = ((data.messages as {id:string;role:string;content:string;mode:string;created_at:string;metadata:Record<string,unknown>}[]) ?? [])
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(m => ({
      id:        m.id,
      role:      m.role,
      content:   m.content,
      mode:      m.mode,
      timestamp: m.created_at,
      metadata:  m.metadata,
    }))

  return NextResponse.json({
    projectId:   data.id,
    projectSlug: data.slug,
    phase:       data.phase,
    status:      data.status,
    title:       data.title,
    clientName:  (data.clients as {name?:string} | null)?.name,
    messages,
    canContinue: data.phase === 'discovery' || data.phase === 'hold',
  })
}
