import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, newLeadEmail, clientConfirmEmail } from '@/lib/email'
import { sendWhatsApp } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  try {
    const { projectId, name, email, phone, company } = await req.json()
    if (!name?.trim() || !email?.trim() || !phone?.trim()) return NextResponse.json({ error: 'name, email, phone required' }, { status: 400 })
    const supabase = createAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const { data: client, error } = await supabase
      .from('clients')
      .upsert({ name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), company: company?.trim() ?? null }, { onConflict: 'email' })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: 'Failed to save client' }, { status: 500 })
    let slug = '',
      summary = ''
    if (projectId && projectId !== 'pending') {
      const { data: proj } = await supabase.from('projects').select('slug,summary').eq('id', projectId).single()
      if (proj) {
        slug = proj.slug
        summary = proj.summary ?? ''
      }
      await supabase.from('projects').update({ client_id: client.id, phase: 'hold', status: 'pending_review', title: name.trim() }).eq('id', projectId)
      await supabase.from('roadmaps').upsert({ project_id: projectId, ai_draft: {}, final_scope: {}, deliverables: [] }, { onConflict: 'project_id' })
      fetch(`${appUrl}/api/summary`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId }) }).catch(() => {})
    }
    // Analytics – non‑fatal
    try {
      await supabase.from('analytics_events').insert({
        project_id: projectId !== 'pending' ? projectId : null,
        event_type: 'gate_submitted',
        metadata: { name, email, hasCompany: !!company },
      })
    } catch (err) {
      console.error('Analytics insert failed:', err)
    }
    const adminEmail = process.env.ADMIN_EMAIL ?? process.env.GMAIL_USER
    if (adminEmail) {
      const { subject, html } = newLeadEmail({ name, email, phone, company, summary, slug, appUrl })
      sendEmail({ to: adminEmail, subject, html }).catch(() => {})
    }
    if (slug && email) {
      const { subject, html } = clientConfirmEmail({ name, slug, appUrl })
      sendEmail({ to: email, subject, html }).catch(() => {})
    }
    if (slug) {
      sendWhatsApp(`New Lead: ${name}${company ? ` (${company})` : ''} | ${email} | ${phone}\n${appUrl}/admin`).catch(() => {})
    }
    return NextResponse.json({ success: true, slug })
  } catch (e) {
    console.error('[GATE]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}