import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req:NextRequest){
  try{
    const{event,projectId,metadata}=await req.json()
    const supabase=createAdminClient()
    await supabase.from('analytics_events').insert({project_id:projectId??null,event_type:event,metadata:metadata??{}})
    return NextResponse.json({ok:true})
  }catch{return NextResponse.json({ok:false})}
}

export async function GET(req:NextRequest){
  const key=new URL(req.url).searchParams.get('key')
  if(key!==process.env.ADMIN_SECRET_KEY)return NextResponse.json({error:'Unauthorized'},{status:401})
  const supabase=createAdminClient()
  const{data}=await supabase.from('analytics_events').select('event_type').limit(2000)
  const counts:Record<string,number>={}
  ;(data||[]).forEach((e:any)=>{counts[e.event_type]=(counts[e.event_type]??0)+1})
  const s=counts['session_started']??0,f=counts['first_message_sent']??0,g=counts['gate_shown']??0,gs=counts['gate_submitted']??0
  return NextResponse.json({funnel:{sessions:s,firstMessageRate:s?Math.round(f/s*100):0,gateShowRate:s?Math.round(g/s*100):0,gateConversion:g?Math.round(gs/g*100):0},raw:counts})
}
