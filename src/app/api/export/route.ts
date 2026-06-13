import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req:NextRequest){
  const key=new URL(req.url).searchParams.get('key')
  if(key!==process.env.ADMIN_SECRET_KEY)return new Response('Unauthorized',{status:401})
  const supabase=createAdminClient()
  const{data}=await supabase.from('projects').select('id,slug,title,phase,status,created_at,summary,clients(name,email,phone,company),quotes(amount,currency,published_at)').order('created_at',{ascending:false})
  
  // FIX: Swapped out the invalid wide colon character for a standard one
  const esc=(v:unknown)=>{const s=String(v??'');return s.includes(',')||s.includes('"')||s.includes('\n')?`"${s.replace(/"/g,'""')}"`:s}
  
  const rows=(data??[]).map((p:any)=>{
    const c=p.clients,q=p.quotes
    return [new Date(p.created_at).toLocaleDateString('en-GB'),p.slug,c?.name??'',c?.company??'',c?.email??'',c?.phone??'',p.phase,p.status,q?.currency??'',q?.amount??'',p.summary??''].map(esc).join(',')
  })
  const csv=['Date,Slug,Name,Company,Email,Phone,Phase,Status,Currency,Amount,Summary',...rows].join('\n')
  return new Response(csv,{headers:{'Content-Type':'text/csv','Content-Disposition':`attachment; filename="omnicraft-${new Date().toISOString().split('T')[0]}.csv"`}})
}