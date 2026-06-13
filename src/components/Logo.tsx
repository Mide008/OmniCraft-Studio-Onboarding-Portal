'use client'
import Image from 'next/image'
// Set USE_CUSTOM=true after placing logos at /public/logos/logo-dark.svg and /public/logos/logo-light.svg
const USE_CUSTOM = false
export interface LogoProps{theme:'dark'|'light';size?:'sm'|'md';className?:string}
export default function Logo({theme,size='md',className=''}:LogoProps){
  const h=size==='sm'?18:22
  if(USE_CUSTOM){
    return<Image src={theme==='dark'?'/logos/logo-light.svg':'/logos/logo-dark.svg'} alt="OmniCraft Studios" width={0} height={h} priority draggable={false} className={className} style={{height:h,width:'auto',display:'block'}}/>
  }
  const outer=size==='sm'?20:24,inner=size==='sm'?8:10
  return<div role="img" aria-label="OmniCraft Studios" className={`flex-none flex items-center justify-center rounded-md bg-[var(--fg)] ${className}`} style={{width:outer,height:outer}}><div className="rounded-sm bg-[var(--bg)]" style={{width:inner,height:inner}}/></div>
}
