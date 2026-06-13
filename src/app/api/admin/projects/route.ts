import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(){
  try{
    const supabase=createAdminClient()
    const{data,error}=await supabase.from('projects').select('id,slug,title,phase,status,summary,created_at,clients(name,email,phone,company),messages(id,role,content,created_at,metadata),roadmaps(admin_notes,timeline_weeks,published_at,ai_draft),quotes(amount,currency,published_at)').order('created_at',{ascending:false}).limit(100)
    if(error)return NextResponse.json({projects:[]})
    const projects=(data||[]).map((p:any)=>({
      id:p.id,slug:p.slug,title:p.title,phase:p.phase,status:p.status,summary:p.summary,createdAt:p.created_at,
      client:p.clients,
      messages:(p.messages||[]).sort((a:any,b:any)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime()).map((m:any)=>({id:m.id,role:m.role,content:m.content,timestamp:m.created_at,metadata:m.metadata})),
      roadmap:p.roadmaps?{adminNotes:p.roadmaps.admin_notes,timelineWeeks:p.roadmaps.timeline_weeks,publishedAt:p.roadmaps.published_at,aiDraft:p.roadmaps.ai_draft}:null,
      quote:p.quotes?{amount:p.quotes.amount,currency:p.quotes.currency,publishedAt:p.quotes.published_at}:null,
    }))
    return NextResponse.json({projects})
  }catch(e:any){return NextResponse.json({projects:[],error:e.message})}
}
