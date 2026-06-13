import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
export const runtime='nodejs'
export const maxDuration=60

export async function POST(req:NextRequest){
  try{
    const{projectId}=await req.json()
    if(!projectId)return NextResponse.json({error:'projectId required'},{status:400})
    const supabase=createAdminClient()
    const{data:msgs}=await supabase.from('messages').select('role,content').eq('project_id',projectId).order('created_at',{ascending:true})
    if(!msgs?.length)return NextResponse.json({ok:false,error:'No messages'})
    const conv=msgs.filter((m:any)=>m.role==='user'||m.role==='assistant').slice(-20).map((m:any)=>`${m.role.toUpperCase()}: ${m.content}`).join('\n\n')
    const G=require('groq-sdk')
    const groq=new G({apiKey:process.env.GROQ_API_KEY})
    const resp=await groq.chat.completions.create({
      model:'llama-3.3-70b-versatile',temperature:0.5,max_tokens:2000,
      messages:[
        {role:'system',content:'You are a senior studio strategist. Output only valid JSON, no markdown.'},
        {role:'user',content:`Based on this discovery conversation, generate a project roadmap JSON:\n\n${conv}\n\nReturn JSON with: projectSummary(string), technicalStack(string[]), phases([{number,title,duration,deliverables:string[]}]), competitorGaps(string[]), marketOpportunities(string[])`}
      ]
    })
    const text=resp.choices[0]?.message?.content??'{}'
    let draft={}
    try{const clean=text.replace(/^[^{]*/,'').replace(/[^}]*$/,'');draft=JSON.parse(clean)}catch{}
    await supabase.from('roadmaps').upsert({project_id:projectId,ai_draft:draft},{onConflict:'project_id'})
    return NextResponse.json({ok:true,draft})
  }catch(e:any){return NextResponse.json({ok:false,error:e.message})}
}
