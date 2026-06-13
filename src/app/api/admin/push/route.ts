import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, roadmapReadyEmail } from '@/lib/email'

export async function POST(req:NextRequest){
  try{
    const{projectId,adminKey,adminNotes,quoteAmount,quoteCurrency='NGN',breakdown=[],timelineWeeks,validUntilDays=14}=await req.json()
    if(adminKey!==process.env.ADMIN_SECRET_KEY)return NextResponse.json({error:'Unauthorized'},{status:401})
    if(!projectId)return NextResponse.json({error:'projectId required'},{status:400})
    const supabase=createAdminClient()
    const now=new Date().toISOString()
    const validDate=new Date(Date.now()+validUntilDays*86400000).toISOString().split('T')[0]
    const appUrl=process.env.NEXT_PUBLIC_APP_URL??'http://localhost:3000'
    await supabase.from('roadmaps').update({admin_notes:adminNotes??null,timeline_weeks:timelineWeeks??null,published_at:now}).eq('project_id',projectId)
    if(quoteAmount&&quoteAmount>0){await supabase.from('quotes').upsert({project_id:projectId,currency:quoteCurrency,amount:quoteAmount,breakdown,valid_until:validDate,published_at:now},{onConflict:'project_id'})}
    await supabase.from('projects').update({phase:'reveal',status:'published'}).eq('id',projectId)
    const{data:project}=await supabase.from('projects').select('slug,title,clients(name,email)').eq('id',projectId).single()
    if(project){
      const client=project.clients as any
      if(client?.email){
        const{subject,html}=roadmapReadyEmail({name:client.name??'',slug:project.slug,appUrl,amount:quoteAmount,currency:quoteCurrency})
        sendEmail({to:client.email,subject,html}).catch(()=>{})
      }
    }
    return NextResponse.json({success:true,publishedAt:now})
  }catch(e:any){return NextResponse.json({error:e.message},{status:500})}
}
