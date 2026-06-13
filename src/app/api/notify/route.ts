import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, humanReviewEmail } from '@/lib/email'
import { sendWhatsApp } from '@/lib/whatsapp'

export async function POST(req: NextRequest) {
  try {
    const { projectId, name, email, message } = await req.json()
    const supabase = createAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    let slug = ''
    if (projectId) {
      const { data } = await supabase.from('projects').select('slug').eq('id', projectId).single()
      if (data) slug = data.slug
    }
    if (projectId) {
      try {
        await supabase.from('messages').insert({
          project_id: projectId,
          role: 'user',
          content: `[HUMAN REVIEW REQUESTED] ${message ?? ''}`,
          metadata: { type: 'human_review_request', clientEmail: email },
        })
      } catch (err) {
        console.error('Failed to save review request message:', err)
      }
    }
    const adminEmail = process.env.ADMIN_EMAIL ?? process.env.GMAIL_USER
    if (adminEmail) {
      const { subject, html } = humanReviewEmail({ name, email, slug, message: message ?? '', appUrl })
      sendEmail({ to: adminEmail, subject, html }).catch(() => {})
    }
    sendWhatsApp(`Review Requested: ${name} (${email})\n${appUrl}/admin`).catch(() => {})
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}