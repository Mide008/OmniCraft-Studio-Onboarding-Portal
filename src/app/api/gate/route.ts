import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { GateFormData } from '@/types'

interface GateRequestBody extends GateFormData {
  projectId: string
}

export async function POST(request: NextRequest) {
  try {
    const body: GateRequestBody = await request.json()
    const { projectId, name, email, phone, company } = body

    if (!projectId || !name?.trim() || !email?.trim() || !phone?.trim()) {
      return NextResponse.json(
        { error: 'projectId, name, email, and phone are required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Upsert client — email is the unique key
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .upsert(
        { name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), company: company?.trim() ?? null },
        { onConflict: 'email' }
      )
      .select('id')
      .single()

    if (clientError) {
      console.error('[GATE] client upsert failed:', clientError)
      return NextResponse.json({ error: 'Failed to save client' }, { status: 500 })
    }

    // Link client to project, advance to hold phase
    const { error: projectError } = await supabase
      .from('projects')
      .update({
        client_id: client.id,
        phase:     'hold',
        status:    'pending_review',
        title:     name.trim(),
      })
      .eq('id', projectId)

    if (projectError) {
      console.error('[GATE] project update failed:', projectError)
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 })
    }

    // Create empty roadmap scaffold for admin to populate
    const { error: roadmapError } = await supabase
      .from('roadmaps')
      .upsert(
        { project_id: projectId, ai_draft: {}, final_scope: {}, deliverables: [] },
        { onConflict: 'project_id' }
      )

    if (roadmapError) {
      console.error('[GATE] roadmap scaffold failed:', roadmapError)
      // Non-fatal — admin can still create it manually
    }

    return NextResponse.json({ success: true, clientId: client.id })
  } catch (error) {
    console.error('[GATE ERROR]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
