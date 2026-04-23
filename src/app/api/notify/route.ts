import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, humanReviewEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const { projectId, name, email, message } = await req.json()

    const supabase    = createAdminClient()
    const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const adminEmail  = process.env.ADMIN_EMAIL ?? process.env.GMAIL_USER

    // Get slug for admin URL
    let slug = ''
    if (projectId) {
      const { data } = await supabase.from('projects').select('slug').eq('id', projectId).single()
      if (data) slug = data.slug
    }

    // Log the review request
    if (projectId) {
      await supabase.from('messages').insert({
        project_id: projectId, role: 'user', content: `[HUMAN REVIEW REQUESTED] ${message || ''}`,
        metadata: { type: 'human_review_request', clientEmail: email },
      })
    }

    if (adminEmail) {
      const { subject, html } = humanReviewEmail({ name, email, slug, message: message ?? '', appUrl })
      await sendEmail({ to: adminEmail, subject, html })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[NOTIFY]', err)
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 })
  }
}
