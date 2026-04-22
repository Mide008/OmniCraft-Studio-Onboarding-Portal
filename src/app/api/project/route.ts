import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id   = searchParams.get('id')
  const slug = searchParams.get('slug')

  if (!id && !slug) {
    return NextResponse.json(
      { error: 'Either id or slug is required' },
      { status: 400 }
    )
  }

  const supabase = createAdminClient()

  const query = supabase
    .from('projects')
    .select(`
      *,
      clients (*),
      messages (
        id, role, content, mode, created_at, metadata
        ORDER created_at ASC
      ),
      assets (*),
      roadmaps (*),
      quotes (*)
    `)

  const { data, error } = id
    ? await query.eq('id', id).single()
    : await query.eq('slug', slug!).single()

  if (error || !data) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Project id required' }, { status: 400 })
    }

    const body = await request.json()
    const allowedFields = ['phase', 'title', 'summary', 'status', 'mode']
    const updates: Record<string, unknown> = {}

    for (const field of allowedFields) {
      if (field in body) updates[field] = body[field]
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(data)
  } catch (error) {
    console.error('[PROJECT PATCH ERROR]', error)
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
  }
}
