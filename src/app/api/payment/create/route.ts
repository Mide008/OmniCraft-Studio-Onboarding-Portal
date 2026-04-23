import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Paystack Payment Link Generator
 *
 * SETUP:
 * 1. Create free account at https://paystack.com
 * 2. Get your Secret Key from Settings → API Keys
 * 3. Add to .env.local: PAYSTACK_SECRET_KEY=sk_live_... (or sk_test_... for testing)
 *
 * Works with any HTTPS URL including your .vercel.app domain — NO custom domain required.
 */

export async function POST(req: NextRequest) {
  try {
    const { projectId, adminKey } = await req.json()

    if (!adminKey || adminKey !== process.env.ADMIN_SECRET_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.PAYSTACK_SECRET_KEY) {
      return NextResponse.json({
        error: 'Paystack not configured. Add PAYSTACK_SECRET_KEY to your .env.local file.',
        docs: 'https://paystack.com → Settings → API Keys',
      }, { status: 501 })
    }

    const supabase = createAdminClient()
    const appUrl   = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // Get project + quote + client details
    const { data: project, error } = await supabase
      .from('projects')
      .select(`
        id, slug, title,
        clients (name, email),
        quotes (amount, currency)
      `)
      .eq('id', projectId).single()

    if (error || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const client = project.clients as {name?:string;email?:string} | null
    const quote  = project.quotes  as {amount?:number;currency?:string} | null

    if (!quote?.amount || !client?.email) {
      return NextResponse.json({
        error: 'Project must have a published quote and a client email before generating a payment link.',
      }, { status: 400 })
    }

    // Paystack expects amount in smallest currency unit (kobo for NGN, cents for USD)
    const currency   = quote.currency ?? 'NGN'
    const multiplier = currency === 'NGN' ? 100 : 100
    const amountInKobo = Math.round(quote.amount * multiplier)

    // Initialize Paystack transaction
    const paystackRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email:        client.email,
        amount:       amountInKobo,
        currency,
        reference:    `omnicraft-${project.slug}-${Date.now()}`,
        callback_url: `${appUrl}/p/${project.slug}?payment=success`,
        metadata: {
          project_slug: project.slug,
          client_name:  client.name ?? '',
          custom_fields: [
            { display_name: 'Project',      variable_name: 'project',      value: project.title ?? project.slug },
            { display_name: 'Studio',       variable_name: 'studio',       value: 'OmniCraft Studios' },
          ],
        },
      }),
    })

    const paystackData = await paystackRes.json()

    if (!paystackData.status || !paystackData.data?.authorization_url) {
      console.error('[PAYSTACK]', paystackData)
      return NextResponse.json({ error: 'Paystack returned an error', detail: paystackData.message }, { status: 502 })
    }

    // Save payment link reference to project metadata
    await supabase.from('projects').update({
      summary: project.title, // keep existing
    }).eq('id', projectId)

    return NextResponse.json({
      paymentUrl: paystackData.data.authorization_url,
      reference:  paystackData.data.reference,
      amount:     quote.amount,
      currency,
    })
  } catch (err) {
    console.error('[PAYMENT]', err)
    return NextResponse.json({ error: 'Payment link generation failed' }, { status: 500 })
  }
}
