import { NextRequest, NextResponse } from 'next/server'
export const runtime='nodejs'
export const maxDuration=30

export async function POST(req:NextRequest){
  try{
    const{assetId,projectId,type,url,transcription}=await req.json()
    const key=process.env.GOOGLE_GENERATIVE_AI_API_KEY??process.env.GEMINI_API_KEY
    if(!key?.startsWith('AI'))return NextResponse.json({ok:false})
    const{GoogleGenerativeAI}=require('@google/generative-ai')
    const model=new GoogleGenerativeAI(key).getGenerativeModel({model:'gemini-3-flash-preview'})
    const prompt=type==='audio'?`Summarise this audio transcription for a design/engineering brief:\n\n${transcription}`:`Analyse this ${type} and extract: 1. Main content/subject. 2. Design or technical insights. 3. Brand/style observations if applicable.`
    const result=await model.generateContent(prompt)
    return NextResponse.json({ok:true,analysis:result.response.text()})
  }catch(e:any){return NextResponse.json({ok:false,error:e.message})}
}
