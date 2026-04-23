import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')

  if (!key || key !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: projects, error } = await supabase
    .from('projects')
    .select(`
      id, slug, title, phase, status, created_at, updated_at, summary,
      clients (name, email, phone, company),
      quotes (amount, currency, published_at)
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Query failed' }, { status: 500 })

  // Build CSV
  const headers = [
    'Date', 'Slug', 'Name', 'Company', 'Email', 'Phone',
    'Phase', 'Status', 'Quote Currency', 'Quote Amount', 'Quote Published', 'Project Summary'
  ]

  const escape = (v: unknown) => {
    const str = String(v ?? '')
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str
  }

  const rows = (projects ?? []).map(p => {
    const client = p.clients as {name?:string;email?:string;phone?:string;company?:string} | null
    const quote  = p.quotes as {amount?:number;currency?:string;published_at?:string} | null
    return [
      new Date(p.created_at).toLocaleDateString('en-GB'),
      p.slug,
      client?.name  ?? '',
      client?.company ?? '',
      client?.email ?? '',
      client?.phone ?? '',
      p.phase,
      p.status,
      quote?.currency ?? '',
      quote?.amount   ?? '',
      quote?.published_at ? new Date(quote.published_at).toLocaleDateString('en-GB') : '',
      p.summary ?? '',
    ].map(escape).join(',')
  })

  const csv = [headers.join(','), ...rows].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="omnicraft-projects-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  })
}
