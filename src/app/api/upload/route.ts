import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime='nodejs'
export const maxDuration=30

export async function POST(req:NextRequest){
  try{
    const form=await req.formData()
    const file=form.get('file') as File|null
    const projectId=form.get('projectId') as string|null
    if(!file)return NextResponse.json({error:'No file'},{status:400})
    const bytes=await file.arrayBuffer()
    const buf=Buffer.from(bytes)
    const supabase=createAdminClient()
    const ext=file.name.split('.').pop()??'bin'
    const path=`${projectId??'public'}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const{data,error}=await supabase.storage.from('omnicraft-assets').upload(path,buf,{contentType:file.type,upsert:false})
    if(error)return NextResponse.json({error:error.message},{status:500})
    const{data:{publicUrl}}=supabase.storage.from('omnicraft-assets').getPublicUrl(data.path)
    const{data:asset}=await supabase.from('assets').insert({project_id:projectId??null,type:file.type.startsWith('image/')?'image':file.type==='application/pdf'?'pdf':file.type.startsWith('audio/')?'audio':'video',url:publicUrl,filename:file.name,file_size:file.size}).select('id').single()
    return NextResponse.json({assetId:asset?.id,url:publicUrl,path:data.path})
  }catch(e:any){return NextResponse.json({error:e.message},{status:500})}
}
