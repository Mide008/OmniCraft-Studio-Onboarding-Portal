import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { SaveMessageRequest } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const body: SaveMessageRequest = await request.json()
    const { projectId, role, content, mode } = body

    if (!projectId || !role || !content) {
      return NextResponse.json(
        { error: 'projectId, role, and content are required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('messages')
      .insert({
        project_id: projectId,
        role,
        content,
        mode: mode ?? null,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[SAVE MESSAGE ERROR]', error)
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
    }

    return NextResponse.json({ id: data.id })
  } catch (error) {
    console.error('[SAVE MESSAGE ERROR]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
