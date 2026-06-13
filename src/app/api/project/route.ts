import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req:NextRequest){
  const id=new URL(req.url).searchParams.get('id')
  if(!id)return NextResponse.json({error:'id required'},{status:400})
  const supabase=createAdminClient()
  const{data,error}=await supabase.from('projects').select('id,slug,phase,status,mode,summary').eq('id',id).single()
  if(error)return NextResponse.json({error:'Not found'},{status:404})
  return NextResponse.json(data)
}

export async function PATCH(req:NextRequest){
  try{
    const{id,...updates}=await req.json()
    if(!id)return NextResponse.json({error:'id required'},{status:400})
    const supabase=createAdminClient()
    const{error}=await supabase.from('projects').update(updates).eq('id',id)
    if(error)return NextResponse.json({error:error.message},{status:500})
    return NextResponse.json({ok:true})
  }catch(e:any){return NextResponse.json({error:e.message},{status:500})}
}
