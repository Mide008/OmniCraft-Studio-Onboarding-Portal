import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req:NextRequest){
  try{
    const{projectId,role,content,mode='creative',metadata={}}=await req.json()
    if(!projectId||!role||!content)return NextResponse.json({error:'Missing fields'},{status:400})
    const supabase=createAdminClient()
    const{data,error}=await supabase.from('messages').insert({project_id:projectId,role,content,mode,metadata}).select('id').single()
    if(error)return NextResponse.json({error:error.message},{status:500})
    return NextResponse.json({id:data.id})
  }catch(e:any){return NextResponse.json({error:e.message},{status:500})}
}
