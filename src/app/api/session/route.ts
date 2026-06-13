import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req:NextRequest){
  const slug=new URL(req.url).searchParams.get('slug')
  if(!slug)return NextResponse.json({error:'slug required'},{status:400})
  const supabase=createAdminClient()
  const{data,error}=await supabase.from('projects').select('id,slug,phase,status,summary,title,messages(id,role,content,mode,created_at,metadata),clients(name,email)').eq('slug',slug).single()
  if(error||!data)return NextResponse.json({error:'Not found'},{status:404})
  const messages=((data.messages as any[])||[]).sort((a:any,b:any)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime()).map((m:any)=>({id:m.id,role:m.role,content:m.content,mode:m.mode,timestamp:m.created_at,metadata:m.metadata}))
  return NextResponse.json({projectId:data.id,projectSlug:data.slug,phase:data.phase,status:data.status,title:data.title,clientName:(data.clients as any)?.name,messages,canContinue:data.phase==='discovery'||data.phase==='hold'})
}
