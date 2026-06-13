import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req:NextRequest){
  try{
    const{projectId,adminKey}=await req.json()
    if(adminKey!==process.env.ADMIN_SECRET_KEY)return NextResponse.json({error:'Unauthorized'},{status:401})
    if(!process.env.PAYSTACK_SECRET_KEY)return NextResponse.json({error:'Add PAYSTACK_SECRET_KEY to .env.local. Get it free at paystack.com'},{status:501})
    const supabase=createAdminClient()
    const appUrl=process.env.NEXT_PUBLIC_APP_URL??'http://localhost:3000'
    const{data:project}=await supabase.from('projects').select('slug,title,clients(name,email),quotes(amount,currency)').eq('id',projectId).single()
    if(!project)return NextResponse.json({error:'Project not found'},{status:404})
    const client=project.clients as any,quote=project.quotes as any
    if(!quote?.amount||!client?.email)return NextResponse.json({error:'Quote and client email required before generating payment link'},{status:400})
    const res=await fetch('https://api.paystack.co/transaction/initialize',{method:'POST',headers:{Authorization:`Bearer ${process.env.PAYSTACK_SECRET_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({email:client.email,amount:Math.round(quote.amount*100),currency:quote.currency??'NGN',reference:`omnicraft-${project.slug}-${Date.now()}`,callback_url:`${appUrl}/p/${project.slug}?payment=success`})})
    const data=await res.json()
    if(!data.status)return NextResponse.json({error:data.message},{status:502})
    return NextResponse.json({paymentUrl:data.data.authorization_url,reference:data.data.reference})
  }catch(e:any){return NextResponse.json({error:e.message},{status:500})}
}
