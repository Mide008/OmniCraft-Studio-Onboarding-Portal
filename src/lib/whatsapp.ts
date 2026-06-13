export async function sendWhatsApp(message:string):Promise<boolean>{
  const phone=process.env.WHATSAPP_PHONE,key=process.env.WHATSAPP_API_KEY
  if(!phone||!key){console.warn('[WA] creds not set');return false}
  try{const res=await fetch(`https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(message)}&apikey=${key}`);return res.ok}catch(e){console.error('[WA]',e);return false}
}
