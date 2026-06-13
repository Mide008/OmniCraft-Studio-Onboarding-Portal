import { NextRequest, NextResponse } from 'next/server'
export const runtime='nodejs'
export const maxDuration=60

export async function POST(req:NextRequest){
  try{
    const form=await req.formData()
    const file=form.get('file') as File|null
    if(!file)return NextResponse.json({error:'No file'},{status:400})
    const G=require('groq-sdk')
    const groq=new G({apiKey:process.env.GROQ_API_KEY})
    const transcription=await groq.audio.transcriptions.create({file,model:'whisper-large-v3',response_format:'text'})
    return NextResponse.json({transcription})
  }catch(e:any){return NextResponse.json({error:e.message},{status:500})}
}
