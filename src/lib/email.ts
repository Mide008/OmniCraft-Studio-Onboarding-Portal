/**
 * Email utility — Nodemailer + Gmail App Password
 * No custom domain required. Free. ~500 emails/day.
 *
 * SETUP (one time):
 * 1. Go to myaccount.google.com → Security → 2-Step Verification → App Passwords
 * 2. Create an App Password named "OmniCraft"
 * 3. Add to .env.local:
 *    GMAIL_USER=youremail@gmail.com
 *    GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   (the 16-char app password)
 *    ADMIN_EMAIL=youremail@gmail.com           (where to receive alerts)
 */

import nodemailer from 'nodemailer'

function getTransporter() {
  const user = process.env.GMAIL_USER
  const pass = process.env.GMAIL_APP_PASSWORD

  if (!user || !pass) {
    console.warn('[EMAIL] GMAIL_USER or GMAIL_APP_PASSWORD not set — email disabled')
    return null
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })
}

interface EmailOptions {
  to:      string
  subject: string
  html:    string
}

export async function sendEmail(opts: EmailOptions): Promise<boolean> {
  const transporter = getTransporter()
  if (!transporter) return false

  try {
    await transporter.sendMail({
      from:    `"OmniCraft Studios" <${process.env.GMAIL_USER}>`,
      to:      opts.to,
      subject: opts.subject,
      html:    opts.html,
    })
    return true
  } catch (err) {
    console.error('[EMAIL] Send failed:', err)
    return false
  }
}

// ── Email templates ──────────────────────────────────────────────────────────

export function newLeadEmail(opts: {
  name:      string
  email:     string
  phone:     string
  company?:  string
  summary:   string
  slug:      string
  appUrl:    string
}) {
  const adminUrl = `${opts.appUrl}/admin`
  const dashUrl  = `${opts.appUrl}/p/${opts.slug}`

  return {
    subject: `🔔 New Lead: ${opts.name}${opts.company ? ` — ${opts.company}` : ''}`,
    html: `
<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a18">
  <div style="margin-bottom:24px">
    <span style="font-size:10px;font-family:monospace;letter-spacing:.15em;text-transform:uppercase;color:#6b6860">OmniCraft Studios</span>
    <h1 style="font-size:22px;font-weight:300;margin:8px 0 4px">New client ready for review</h1>
    <p style="color:#6b6860;font-size:14px;margin:0">Submitted via the onboarding portal</p>
  </div>

  <div style="background:#f4f2ec;border-radius:12px;padding:20px;margin-bottom:20px">
    <table style="width:100%;font-size:14px;border-collapse:collapse">
      <tr><td style="color:#6b6860;padding:4px 0;width:100px">Name</td><td style="font-weight:500">${opts.name}</td></tr>
      ${opts.company ? `<tr><td style="color:#6b6860;padding:4px 0">Company</td><td>${opts.company}</td></tr>` : ''}
      <tr><td style="color:#6b6860;padding:4px 0">Email</td><td><a href="mailto:${opts.email}" style="color:#1a1a18">${opts.email}</a></td></tr>
      <tr><td style="color:#6b6860;padding:4px 0">Phone</td><td>${opts.phone}</td></tr>
    </table>
  </div>

  ${opts.summary ? `
  <div style="margin-bottom:20px">
    <p style="font-size:10px;font-family:monospace;letter-spacing:.12em;text-transform:uppercase;color:#6b6860;margin-bottom:8px">Project Summary</p>
    <p style="font-size:14px;line-height:1.7;color:#1a1a18;background:#fff;border:1px solid #e0dedb;border-radius:8px;padding:14px">${opts.summary}</p>
  </div>` : ''}

  <div style="display:flex;gap:12px;margin-top:24px">
    <a href="${adminUrl}" style="display:inline-block;background:#1a1a18;color:#f4f2ec;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:13px;font-weight:500">
      Review in Admin →
    </a>
    <a href="${dashUrl}" style="display:inline-block;background:#f4f2ec;border:1px solid #dedad2;color:#1a1a18;text-decoration:none;padding:12px 20px;border-radius:8px;font-size:13px">
      Client Dashboard
    </a>
  </div>
</div>`,
  }
}

export function clientConfirmationEmail(opts: {
  name:    string
  slug:    string
  appUrl:  string
}) {
  const dashUrl = `${opts.appUrl}/p/${opts.slug}`
  const first   = opts.name.split(' ')[0]

  return {
    subject: `Your OmniCraft roadmap is being reviewed, ${first}`,
    html: `
<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a18">
  <div style="margin-bottom:24px">
    <span style="font-size:10px;font-family:monospace;letter-spacing:.15em;text-transform:uppercase;color:#6b6860">OmniCraft Studios</span>
    <h1 style="font-size:22px;font-weight:300;margin:8px 0 4px">Your roadmap is in review, ${first}.</h1>
    <p style="color:#6b6860;font-size:14px;line-height:1.7">
      The Studio Owner is reviewing everything we discussed and will come back with a finalised scope and quote within 24–48 hours.
    </p>
  </div>

  <div style="background:#f4f2ec;border-radius:12px;padding:20px;margin-bottom:24px">
    <p style="font-size:10px;font-family:monospace;letter-spacing:.12em;text-transform:uppercase;color:#6b6860;margin:0 0 8px">Your Private Dashboard</p>
    <a href="${dashUrl}" style="font-size:13px;font-family:monospace;color:#1a1a18;word-break:break-all">${dashUrl}</a>
    <p style="font-size:12px;color:#6b6860;margin:8px 0 0">Bookmark this link. Your roadmap and quote appear here once published.</p>
  </div>

  <a href="${dashUrl}" style="display:inline-block;background:#1a1a18;color:#f4f2ec;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:13px;font-weight:500">
    View Your Dashboard →
  </a>

  <p style="font-size:12px;color:#bab7b0;margin-top:32px">
    OmniCraft Studios · This email was sent because you submitted a project brief via our onboarding portal.
  </p>
</div>`,
  }
}

export function humanReviewEmail(opts: {
  name:     string
  email:    string
  slug:     string
  message:  string
  appUrl:   string
}) {
  const adminUrl = `${opts.appUrl}/admin`
  return {
    subject: `🚨 Human Review Requested: ${opts.name}`,
    html: `
<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a18">
  <span style="font-size:10px;font-family:monospace;letter-spacing:.15em;text-transform:uppercase;color:#6b6860">OmniCraft Studios</span>
  <h1 style="font-size:22px;font-weight:300;margin:8px 0 4px">A client has requested a human touchpoint</h1>
  <p style="color:#6b6860;font-size:14px"><strong>${opts.name}</strong> (${opts.email})</p>
  ${opts.message ? `<p style="background:#fff;border:1px solid #e0dedb;border-radius:8px;padding:14px;font-size:14px;line-height:1.7">${opts.message}</p>` : ''}
  <a href="${adminUrl}" style="display:inline-block;background:#1a1a18;color:#f4f2ec;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:13px;font-weight:500;margin-top:16px">
    Jump into Admin →
  </a>
</div>`,
  }
}
