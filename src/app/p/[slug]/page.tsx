import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import ClientDashboard from '@/components/portal/ClientDashboard'
import type { Metadata } from 'next'

interface Props{params:Promise<{slug:string}>}

export async function generateMetadata({params}:Props):Promise<Metadata>{
  const{slug}=await params
  return{title:'Your OmniCraft Roadmap',description:'Your personalised project roadmap from OmniCraft Studios.',robots:{index:false,follow:false},openGraph:{url:`${process.env.NEXT_PUBLIC_APP_URL}/p/${slug}`}}
}

async function getProject(slug:string){
  const supabase=createAdminClient()
  const{data,error}=await supabase.from('projects').select('id,slug,title,phase,status,summary,created_at,clients(name,email,company),messages(id,role,content,created_at),roadmaps(ai_draft,final_scope,deliverables,timeline_weeks,admin_notes,published_at),quotes(amount,currency,breakdown,valid_until,published_at)').eq('slug',slug).single()
  if(error||!data)return null
  return data
}

export default async function ProjectPage({params}:Props){
  const{slug}=await params
  const project=await getProject(slug)
  if(!project)notFound()
  return<ClientDashboard project={project as never}/>
}
