'use client'
import { useEffect, useState } from 'react'
export function useKeyboardHeight(){
  const[height,setHeight]=useState(0)
  useEffect(()=>{
    const vv=window.visualViewport; if(!vv)return
    let last=window.innerHeight
    const update=()=>{ const diff=last-(vv.height+vv.offsetTop); setHeight(diff>100?diff:0) }
    const onResize=()=>{last=window.innerHeight;update()}
    vv.addEventListener('resize',update); vv.addEventListener('scroll',update); window.addEventListener('resize',onResize)
    return()=>{vv.removeEventListener('resize',update);vv.removeEventListener('scroll',update);window.removeEventListener('resize',onResize)}
  },[])
  return height
}
