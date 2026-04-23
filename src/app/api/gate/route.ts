import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, newLeadEmail, clientConfirmationEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { projectId, name, email, phone, company } = await req.json()

    if (!name?.trim() || !email?.trim() || !phone?.trim()) {
      return NextResponse.json({ error: 'name, email, and phone required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // Upsert client
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .upsert(
        { name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), company: company?.trim() ?? null },
        { onConflict: 'email' }
      )
      .select('id').single()

    if (clientErr) {
      console.error('[GATE] client upsert:', clientErr)
      return NextResponse.json({ error: 'Failed to save client' }, { status: 500 })
    }

    // Get project slug + summary
    let slug    = ''
    let summary = ''
    if (projectId && projectId !== 'pending') {
      const { data: proj } = await supabase
        .from('projects')
        .select('slug, summary')
        .eq('id', projectId).single()
      if (proj) { slug = proj.slug; summary = proj.summary ?? '' }

      // Update project
      await supabase.from('projects')
        .update({ client_id: client.id, phase: 'hold', status: 'pending_review', title: name.trim() })
        .eq('id', projectId)

      // Scaffold roadmap
      await supabase.from('roadmaps')
        .upsert({ project_id: projectId, ai_draft: {}, final_scope: {}, deliverables: [] }, { onConflict: 'project_id' })
    }

    // Track conversion (gate_submitted event)
    await supabase.from('analytics_events').insert({
      project_id:  projectId !== 'pending' ? projectId : null,
      event_type:  'gate_submitted',
      metadata:    { name, email, hasCompany: !!company },
    }).catch(() => {}) // non-fatal

    const adminEmail = process.env.ADMIN_EMAIL ?? process.env.GMAIL_USER

    // Email: notify admin
    if (adminEmail) {
      const { subject, html } = newLeadEmail({ name, email, phone, company, summary, slug, appUrl })
      await sendEmail({ to: adminEmail, subject, html })
    }

    // Email: confirm to client
    if (slug) {
      const { subject, html } = clientConfirmationEmail({ name, slug, appUrl })
      await sendEmail({ to: email, subject, html })
    }

    return NextResponse.json({ success: true, slug })
  } catch (err) {
    console.error('[GATE ERROR]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
