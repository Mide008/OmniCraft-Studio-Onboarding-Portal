import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
export const runtime='nodejs'
export const maxDuration=30

export async function POST(req:NextRequest){
  try{
    const{projectId}=await req.json()
    if(!projectId)return NextResponse.json({summary:null})
    const key=process.env.GOOGLE_GENERATIVE_AI_API_KEY??process.env.GEMINI_API_KEY
    if(!key?.startsWith('AI'))return NextResponse.json({summary:null})
    const supabase=createAdminClient()
    const{data:messages}=await supabase.from('messages').select('role,content').eq('project_id',projectId).order('created_at',{ascending:true})
    if(!messages?.length)return NextResponse.json({summary:null})
    const conversation=messages.filter((m:any)=>m.role==='user'||m.role==='assistant').slice(-20).map((m:any)=>`${m.role==='user'?'CLIENT':'STUDIO'}: ${m.content}`).join('\n\n')
    const{GoogleGenerativeAI}=require('@google/generative-ai')
    const ai=new GoogleGenerativeAI(key)
    const model=ai.getGenerativeModel({model:'gemini-3-flash-preview'})
    const result=await model.generateContent(`Read this discovery conversation and write a 3-sentence project brief.\nSentence 1: What the client is building and why.\nSentence 2: Core technical or design challenge.\nSentence 3: Most important next question or risk.\nBe specific. No filler. Write only 3 sentences.\n\n${conversation}`)
    const summary=result.response.text().trim()
    await supabase.from('projects').update({summary}).eq('id',projectId)
    return NextResponse.json({summary})
  }catch(e){return NextResponse.json({summary:null})}
}
