import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { sendWhatsApp } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  try {
    const { slug, message, clientName, clientEmail } = await req.json()
    if (!slug || !message?.trim()) return NextResponse.json({ error: 'slug and message required' }, { status: 400 })
    const supabase = createAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const { data: project } = await supabase.from('projects').select('id').eq('slug', slug).single()
    if (project) {
      try {
        await supabase.from('messages').insert({
          project_id: project.id,
          role: 'user',
          content: `[FOLLOW-UP] ${message.trim()}`,
          mode: 'creative',
          metadata: { type: 'followup', clientEmail: clientEmail ?? '' },
        })
      } catch (err) {
        console.error('Failed to save follow-up message:', err)
      }
    }
    const adminEmail = process.env.ADMIN_EMAIL ?? process.env.GMAIL_USER
    if (adminEmail) {
      sendEmail({
        to: adminEmail,
        subject: `Follow-up from ${clientName ?? 'client'} — ${slug}`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px"><p><strong>${clientName ?? 'Client'}</strong>${clientEmail ? ` &lt;${clientEmail}&gt;` : ''}</p><div style="background:#f4f2ec;border-radius:8px;padding:14px;font-size:14px;line-height:1.7;margin:12px 0">${message.trim().replace(/\n/g, '<br>')}</div><a href="${appUrl}/admin" style="background:#1a1a18;color:#f4f2ec;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:13px;display:inline-block">View in Admin</a></div>`,
      }).catch(() => {})
    }
    sendWhatsApp(`Follow-up from ${clientName ?? 'client'}: "${message.slice(0, 150)}"\n${appUrl}/admin`).catch(() => {})
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}