'use client'
import React,{useState,useRef,useEffect,useCallback,useTransition} from 'react'
import {motion,AnimatePresence} from 'framer-motion'
import type {Message,AgentMode,UploadedFile,GateFormData,ProjectPhase} from '@/types'
import {useTheme} from '@/lib/useTheme'
import Logo from '@/components/Logo'
import {cn,detectAssetType,formatFileSize,ALL_ACCEPTED_TYPES} from '@/lib/utils'
import {useKeyboardHeight} from '@/hooks/useKeyboardHeight'

const MAX_FILE=3*1024*1024
const GATE_TRIGGER=20
const SESSION_KEY='oc-session'
const E=[0.22,1,0.36,1] as const

const WELCOME:Message={id:'welcome',role:'assistant',timestamp:new Date(),mode:'creative',
  content:`Let's build your roadmap.\n\nTell me about your project — what you're building, the problem it solves, or the feeling you want it to evoke.\n\nDescribe it any way that feels natural. A rough instinct is enough to start.`}

const CONTEXT_NOTE=`Quick note before we dive in: this is a focused discovery session — not an open-ended chat like ChatGPT or Claude. After about 20 exchanges, I'll have enough to build your full project roadmap and hand you over to the Studio team for a scope and quote.\n\nNow — tell me everything.`

const MODE_CFG:Record<AgentMode,{label:string;dot:string;bg:string;border:string;text:string}>={
  creative:{label:'Creative',dot:'#A855F7',bg:'rgba(168,85,247,.10)',border:'rgba(168,85,247,.3)',text:'#C084FC'},
  engineering:{label:'Engineering',dot:'#3B82F6',bg:'rgba(59,130,246,.10)',border:'rgba(59,130,246,.3)',text:'#60A5FA'},
  research:{label:'Research',dot:'#10B981',bg:'rgba(16,185,129,.10)',border:'rgba(16,185,129,.3)',text:'#34D399'},
}

interface MoodboardData{colors:string[];mood:string;style:string;typography:string;vibe:string}

function renderInline(text:string):React.ReactNode{
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/).map((p,i)=>{
    if(p.startsWith('**')&&p.endsWith('**'))return<strong key={i} className="font-semibold text-[var(--fg)]">{p.slice(2,-2)}</strong>
    if(p.startsWith('*')&&p.endsWith('*')&&p.length>2)return<em key={i} style={{color:'var(--acc)'}}>{p.slice(1,-1)}</em>
    if(p.startsWith('`')&&p.endsWith('`')&&p.length>2)return<code key={i} style={{fontFamily:'monospace',fontSize:'.78em',background:'var(--mid)',border:'1px solid var(--str)',padding:'.1em .4em',borderRadius:4,color:'var(--acc)'}}>{p.slice(1,-1)}</code>
    return p
  })
}
function MD({text}:{text:string}){
  return(
    <div className="space-y-3 text-sm text-[var(--fg)]">
      {text.split(/\n{2,}/).map((block,bi)=>{
        const lines=block.split('\n').filter(Boolean)
        if(!lines.length)return null
        if(lines.some(l=>/^\d+[.)]\s/.test(l.trim())))return(
          <ol key={bi} className="space-y-2">{lines.map((line,li)=>{
            const m=line.trim().match(/^(\d+)[.)]\s+(.+)/)
            if(!m)return line.trim()?<li key={li} style={{listStyle:'none'}}>{renderInline(line)}</li>:null
            return<li key={li} className="flex gap-3 items-start"><span style={{fontFamily:'monospace',fontSize:'.7rem',color:'var(--fg3)',marginTop:2,width:16,flexShrink:0}}>{m[1]}.</span><span>{renderInline(m[2])}</span></li>
          })}</ol>
        )
        if(lines.some(l=>/^[-*]\s/.test(l.trim())))return(
          <ul key={bi} className="space-y-1.5">{lines.map((line,li)=>{
            const c=line.trim().replace(/^[-*]\s+/,'')
            return c?<li key={li} className="flex gap-2 items-start"><span style={{color:'var(--fg3)',marginTop:4,flexShrink:0}}>—</span><span>{renderInline(c)}</span></li>:null
          })}</ul>
        )
        const hm=block.match(/^#{2,3}\s+(.+)/)
        if(hm)return<p key={bi} className="font-semibold">{renderInline(hm[1])}</p>
        return<p key={bi} className="leading-[1.85]">{lines.map((line,li)=><React.Fragment key={li}>{renderInline(line)}{li<lines.length-1&&<br/>}</React.Fragment>)}</p>
      })}
    </div>
  )
}

export default function OnboardingPortal(){
  const{theme,toggle,mounted}=useTheme()
  const kbH=useKeyboardHeight()
  const[messages,setMessages]=useState<Message[]>([])
  const[input,setInput]=useState('')
  const[streaming,setStreaming]=useState(false)
  const[modes,setModes]=useState<AgentMode[]>(['creative'])
  const[projectId,setProjectId]=useState<string|null>(null)
  const[projectSlug,setProjectSlug]=useState<string|null>(null)
  const[phase,setPhase]=useState<ProjectPhase>('discovery')
  const[ready,setReady]=useState(false)
  const[clientName,setClientName]=useState<string|undefined>()
  const[files,setFiles]=useState<UploadedFile[]>([])
  const[moodboard,setMoodboard]=useState<MoodboardData|null>(null)
  const[showReview,setShowReview]=useState(false)
  const[reviewMsg,setReviewMsg]=useState('')
  const[reviewSent,setReviewSent]=useState(false)
  const[isReturning,setIsReturning]=useState(false)
  const[ctxShown,setCtxShown]=useState(false)
  const[,startT]=useTransition()
  const endRef=useRef<HTMLDivElement>(null)
  const inputRef=useRef<HTMLTextAreaElement>(null)
  const fileRef=useRef<HTMLInputElement>(null)
  const abortRef=useRef<AbortController|null>(null)
  const gatedRef=useRef(false)

  const aiCount=messages.filter(m=>m.role==='assistant'&&m.id!=='welcome'&&!m.id.startsWith('bridge')&&m.content.length>60).length
  const remaining=Math.max(0,GATE_TRIGGER-aiCount)

  useEffect(()=>{
    const urlSlug=new URLSearchParams(window.location.search).get('s')
    const stored=urlSlug??localStorage.getItem(SESSION_KEY)
    if(stored){
      fetch(`/api/session?slug=${stored}`).then(r=>r.json()).then(data=>{
        if(data.projectId){
          setProjectId(data.projectId);setProjectSlug(data.projectSlug)
          setPhase(data.phase as ProjectPhase);setIsReturning(true);setCtxShown(true)
          if(data.clientName)setClientName(data.clientName)
          const restored:Message[]=(data.messages??[]).map((m:any)=>({id:m.id,role:m.role,content:m.content,mode:m.mode??'creative',timestamp:new Date(m.timestamp)}))
          setMessages(restored.length>0?restored:[WELCOME])
          if(restored.filter((m:Message)=>m.role==='assistant'&&!m.id.startsWith('bridge')&&m.id!=='welcome'&&m.content.length>60).length>=GATE_TRIGGER)gatedRef.current=true
        }else setMessages([WELCOME])
        setReady(true)
      }).catch(()=>{setMessages([WELCOME]);setReady(true)})
    }else{const t=setTimeout(()=>{setMessages([WELCOME]);setReady(true)},480);return()=>clearTimeout(t)}
  },[])

  useEffect(()=>{
    if(!projectSlug)return
    localStorage.setItem(SESSION_KEY,projectSlug)
    const url=new URL(window.location.href)
    if(url.searchParams.get('s')!==projectSlug){url.searchParams.set('s',projectSlug);window.history.replaceState({},'',url.toString())}
  },[projectSlug])

  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth',block:'end'})},[messages,phase])
  useEffect(()=>{const t=setTimeout(()=>endRef.current?.scrollIntoView({behavior:'smooth',block:'end'}),100);return()=>clearTimeout(t)},[kbH])

  const resize=useCallback(()=>{const el=inputRef.current;if(!el)return;el.style.height='auto';el.style.height=`${Math.min(el.scrollHeight,120)}px`},[])
  useEffect(()=>{resize()},[input,resize])

  useEffect(()=>{
    if(gatedRef.current||streaming||phase!=='discovery')return
    if(aiCount>=GATE_TRIGGER){
      gatedRef.current=true;setPhase('synthesis')
      setMessages(p=>[...p,{id:`bridge-${Date.now()}`,role:'assistant',timestamp:new Date(),mode:'creative',
        content:`I now have a thorough picture of what you're building.\n\nBefore I finalise the roadmap, let me save everything and route it to the Studio for final scoping and pricing.\n\nJust your details below — takes less than a minute.`}])
      setTimeout(()=>setPhase('gate'),2200)
      fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'gate_shown',projectId})}).catch(()=>{})
    }
  },[messages,streaming,phase,projectId,aiCount])

  const fileToB64=(file:File):Promise<string>=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res((r.result as string).split(',')[1]);r.onerror=rej;r.readAsDataURL(file)})

  const doSend=useCallback(async(text:string)=>{
    const aid=`ai-${Date.now()}`
    const attachments:any[]=[]
    for(const f of files){
      if(f.file.size>MAX_FILE){setMessages(p=>[...p,{id:`err-${Date.now()}`,role:'assistant',timestamp:new Date(),mode:'creative',content:`**"${f.file.name}"** exceeds 3MB. Compress it first.\n\n— PDF: smallpdf.com\n— Image: squoosh.app`}]);return}
      attachments.push({name:f.file.name,mimeType:f.file.type,base64:await fileToB64(f.file)})
    }
    const userContent=text||(attachments.length?`[Attached ${attachments.length} file(s)]`:'')
    startT(()=>{
      setMessages(p=>[...p,{id:`u-${Date.now()}`,role:'user',content:userContent,timestamp:new Date()},{id:aid,role:'assistant',content:'',timestamp:new Date()}])
      setInput('');setStreaming(true)
    })
    if(messages.filter(m=>m.role==='user').length===0)fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'first_message_sent',projectId})}).catch(()=>{})
    try{
      abortRef.current=new AbortController()
      const history=messages.filter(m=>m.role==='user'||m.role==='assistant').slice(-18).map(m=>({role:m.role,content:m.content}))
      const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:text,messages:history,attachments,sessionSlug:projectSlug}),signal:abortRef.current.signal})
      if(!res.ok)throw new Error(`${res.status}`)
      if(!res.body)throw new Error('No body')
      const newPid=res.headers.get('X-Project-Id'),newSlug=res.headers.get('X-Project-Slug'),newMode=res.headers.get('X-Mode') as AgentMode|null,mbH=res.headers.get('X-Moodboard')
      if(newPid&&!projectId)setProjectId(newPid)
      if(newSlug&&!projectSlug)setProjectSlug(newSlug)
      if(newMode)setModes([newMode])
      if(mbH){try{setMoodboard(JSON.parse(mbH))}catch{}}
      const reader=res.body.getReader(),dec=new TextDecoder();let full=''
      while(true){const{done,value}=await reader.read();if(done)break;full+=dec.decode(value,{stream:true});setMessages(p=>p.map(m=>m.id===aid?{...m,content:full}:m))}
      setFiles(p=>{p.forEach(f=>{if(f.previewUrl)URL.revokeObjectURL(f.previewUrl)});return[]})
    }catch(e:any){
      if(e.name==='AbortError')return
      setMessages(p=>p.map(m=>m.id===aid?{...m,content:'Connection failed. Please try again.'}:m))
    }finally{setStreaming(false);inputRef.current?.focus()}
  },[messages,projectId,projectSlug,files]) // eslint-disable-line

  const send=useCallback(async(content:string)=>{
    if((!content.trim()&&!files.length)||streaming||phase!=='discovery')return
    const text=content.trim()
    if(!ctxShown&&messages.filter(m=>m.role==='user').length===0){
      setCtxShown(true)
      setMessages(p=>[...p,{id:`u-${Date.now()}`,role:'user',content:text,timestamp:new Date()},{id:`ctx-${Date.now()}`,role:'assistant',content:CONTEXT_NOTE,timestamp:new Date(),mode:'creative'}])
      setInput('');setFiles([])
      setTimeout(()=>doSend(text),1200)
      return
    }
    doSend(text)
  },[messages,streaming,phase,ctxShown,files,doSend])

  const onKey=useCallback((e:React.KeyboardEvent<HTMLTextAreaElement>)=>{
    if(e.key==='Enter'&&!e.shiftKey&&!('ontouchstart' in window)){e.preventDefault();send(input)}
  },[input,send])

  const addFiles=useCallback((raw:File[])=>{
    const valid:UploadedFile[]=[]
    for(const f of raw){const type=detectAssetType(f.type);if(!type)continue;valid.push({id:`${Date.now()}-${Math.random().toString(36).slice(2)}`,file:f,type,status:'pending',previewUrl:type==='image'?URL.createObjectURL(f):undefined})}
    if(valid.length)setFiles(p=>[...p,...valid])
  },[])

  const onGate=useCallback((d:GateFormData)=>{
    setClientName(d.name);setPhase('hold')
    if(projectId){fetch('/api/roadmap/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId})}).catch(()=>{})}
    fetch('/api/analytics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({event:'gate_submitted',projectId})}).catch(()=>{})
  },[projectId])

  const doReview=async()=>{if(!projectId)return;setReviewSent(true);setShowReview(false);fetch('/api/notify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId,name:clientName??'',email:'',message:reviewMsg})}).catch(()=>{})}

  const startNew=()=>{
    localStorage.removeItem(SESSION_KEY)
    const u=new URL(window.location.href);u.searchParams.delete('s');window.history.replaceState({},'',u.toString())
    setMessages([WELCOME]);setInput('');setFiles([]);setProjectId(null);setProjectSlug(null)
    setPhase('discovery');setMoodboard(null);setIsReturning(false);gatedRef.current=false;setReviewSent(false);setCtxShown(false)
  }

  const locked=phase!=='discovery'||streaming
  const canSend=(input.trim().length>0||files.length>0)&&!locked
  const charWarn=input.length>1800

  return(
    <div className="flex flex-col bg-[var(--bg)] text-[var(--fg)] font-sans"
      style={{height:'100dvh',maxHeight:kbH>0?`calc(100dvh - ${kbH}px)`:'100dvh',overflow:'hidden',transition:'max-height 0.15s ease-out'}}>

      {/* HEADER */}
      <header className="flex-none flex items-center justify-between px-4 sm:px-6 border-b border-[var(--str)] bg-[var(--bg)]/90 backdrop-blur-xl" style={{height:52}}>
        <div className="flex items-center gap-2.5">
          {mounted&&<Logo theme={theme} size="sm"/>}
          <span className="text-2xs font-mono tracking-[.20em] uppercase text-[var(--fg2)] select-none">OmniCraft Studios</span>
          {isReturning&&<motion.span initial={{opacity:0,x:-6}} animate={{opacity:1,x:0}} className="text-2xs font-mono text-emerald-400 hidden sm:block">· Returning</motion.span>}
        </div>
        <div className="flex items-center gap-2">
          <AnimatePresence mode="popLayout">
            {modes.slice(0,1).map(m=>{const cfg=MODE_CFG[m];return(
              <motion.div key={m} layout initial={{opacity:0,scale:.85}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:.85}} transition={{duration:.22,ease:E}}
                title={`Analysis: ${cfg.label}`}
                style={{display:'flex',alignItems:'center',gap:5,padding:'2px 8px',borderRadius:999,background:cfg.bg,border:`1px solid ${cfg.border}`,fontSize:9,fontFamily:'monospace',letterSpacing:'.10em',textTransform:'uppercase',color:cfg.text,userSelect:'none'}}>
                <motion.span style={{width:5,height:5,borderRadius:'50%',background:cfg.dot,display:'block'}} animate={{opacity:[1,.3,1]}} transition={{duration:2.4,repeat:Infinity}}/>
                <span className="hidden sm:inline">{cfg.label}</span>
              </motion.div>
            )})}
          </AnimatePresence>
          {phase==='discovery'&&aiCount>0&&aiCount<GATE_TRIGGER&&(
            <span className="text-2xs font-mono text-[var(--fg3)] hidden sm:block" title={`${remaining} exchanges until roadmap handoff`}>{remaining} left</span>
          )}
          {(isReturning||phase==='hold')&&<button onClick={startNew} className="text-2xs font-mono text-[var(--fg3)] hover:text-[var(--fg2)] transition-colors px-2 hidden sm:block">+ New</button>}
          {mounted&&(
            <motion.button onClick={toggle} whileTap={{scale:.88}} aria-label="Toggle theme"
              className="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--fg2)] hover:text-[var(--fg)] hover:bg-[var(--mid)] transition-colors">
              <AnimatePresence mode="wait" initial={false}>
                {theme==='dark'?<motion.span key="sun" initial={{opacity:0,rotate:-30}} animate={{opacity:1,rotate:0}} exit={{opacity:0,rotate:30}} transition={{duration:.18}}><SunIcon/></motion.span>
                :<motion.span key="moon" initial={{opacity:0,rotate:30}} animate={{opacity:1,rotate:0}} exit={{opacity:0,rotate:-30}} transition={{duration:.18}}><MoonIcon/></motion.span>}
              </AnimatePresence>
            </motion.button>
          )}
        </div>
      </header>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="max-w-chat mx-auto px-4 sm:px-6 py-8 sm:py-12" style={{display:'flex',flexDirection:'column',gap:28}}>
          <AnimatePresence>{!ready&&<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}><Dots/></motion.div>}</AnimatePresence>
          {isReturning&&ready&&(
            <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-xs text-emerald-300">Continuing your previous session</p>
              <button onClick={startNew} className="text-2xs font-mono text-emerald-400 hover:text-emerald-300 transition-colors flex-none">Start new →</button>
            </motion.div>
          )}
          <AnimatePresence initial={false}>
            {messages.map((msg,i)=>(
              <motion.div key={msg.id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.42,ease:E,delay:i===0?.48:0}}
                className={cn('flex',msg.role==='user'?'justify-end':'justify-start')}>
                {msg.role==='assistant'?<AIBubble msg={msg} typing={streaming&&i===messages.length-1}/>:<UserBubble msg={msg}/>}
              </motion.div>
            ))}
          </AnimatePresence>
          {/* Milestone nudges */}
          {!gatedRef.current&&[5,10,15].includes(aiCount)&&aiCount>0&&!streaming&&(
            <motion.div key={`nudge-${aiCount}`} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} className="flex justify-start">
              <div className="max-w-[90vw] sm:max-w-md text-xs text-[var(--fg3)] bg-[var(--surf)] border border-[var(--str)] rounded-xl px-4 py-3 leading-relaxed">
                {aiCount===5&&`We're making good progress. Keep sharing — the more specific, the better the roadmap.`}
                {aiCount===10&&`Halfway there. ${remaining} more exchanges and I'll have everything needed to build your full roadmap.`}
                {aiCount===15&&`Almost done — ${remaining} exchanges left. Unlike ChatGPT, this session has a purpose: once we've covered enough, the Studio team takes over with a full scope and quote.`}
              </div>
            </motion.div>
          )}
          {/* Moodboard */}
          <AnimatePresence>
            {moodboard&&(
              <motion.div key="mb" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.45,ease:E}} className="flex justify-start">
                <div className="max-w-[90vw] sm:max-w-md w-full">
                  <div className="flex items-center gap-2 mb-3"><div className="w-[18px] h-[18px] rounded-[4px] bg-[var(--fg)] flex items-center justify-center flex-none"><div className="w-[7px] h-[7px] rounded-[2px] bg-[var(--bg)]"/></div><span className="text-2xs font-mono text-[var(--fg3)] uppercase tracking-[.16em]">Brand Moodboard</span></div>
                  <div className="bg-[var(--surf)] border border-[var(--str)] rounded-2xl p-4 space-y-3">
                    <div className="flex gap-2 flex-wrap">{moodboard.colors.map((hex,i)=><div key={i} className="flex items-center gap-1.5 text-2xs font-mono"><span className="w-5 h-5 rounded border border-[var(--str)] flex-none" style={{background:hex}}/><span className="text-[var(--fg2)]">{hex}</span></div>)}</div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-[var(--fg2)]">
                      {moodboard.style&&<div><span className="text-[var(--fg3)]">Style:</span> {moodboard.style}</div>}
                      {moodboard.typography&&<div><span className="text-[var(--fg3)]">Type:</span> {moodboard.typography}</div>}
                      {moodboard.mood&&<div><span className="text-[var(--fg3)]">Mood:</span> {moodboard.mood}</div>}
                    </div>
                    {moodboard.vibe&&<p className="text-xs text-[var(--fg2)] italic">&ldquo;{moodboard.vibe}&rdquo;</p>}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            {phase==='gate'&&<motion.div key="gate" initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.45,ease:E}} className="flex justify-start"><GateForm projectId={projectId??'pending'} onComplete={onGate}/></motion.div>}
          </AnimatePresence>
          <AnimatePresence>
            {phase==='hold'&&<motion.div key="hold" initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.45,ease:E}} className="flex justify-start"><HoldScreen clientName={clientName} projectSlug={projectSlug??projectId?.slice(0,8)??''} onReview={()=>setShowReview(true)} reviewSent={reviewSent}/></motion.div>}
          </AnimatePresence>
          <div ref={endRef} style={{height:1}}/>
        </div>
      </div>

      {/* INPUT */}
      <div className="flex-none border-t border-[var(--str)] bg-[var(--bg)] px-3 sm:px-6 pt-2.5 sm:pt-3"
        style={{paddingBottom:kbH>0?'12px':'max(12px,env(safe-area-inset-bottom))'}}>
        <div className="max-w-chat mx-auto">
          <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:.35,duration:.5,ease:E}}
            className={cn('rounded-2xl border transition-all duration-200 bg-[var(--in-bg)] border-[var(--in-str)]',locked?'opacity-40 pointer-events-none select-none':'focus-within:border-[var(--strS)] focus-within:shadow-[0_0_0_3px_var(--in-ring)]')}>
            <AnimatePresence>
              {files.length>0&&(
                <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}} className="flex flex-wrap gap-1.5 px-3 pt-2.5">
                  {files.map(f=>(
                    <motion.div key={f.id} initial={{opacity:0,scale:.85}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:.85}}
                      className="flex items-center gap-1.5 bg-[var(--mid)] border border-[var(--str)] rounded-lg px-2.5 py-1 text-xs max-w-[180px]">
                      {f.previewUrl?<img src={f.previewUrl} alt="" className="w-3.5 h-3.5 rounded object-cover flex-none"/>:<span className="flex-none text-sm leading-none">{f.type==='pdf'?'📄':f.type==='audio'?'🎙':f.type==='video'?'🎬':'📎'}</span>}
                      <span className="truncate text-[var(--fg2)]">{f.file.name}</span>
                      <span className="text-[var(--fg3)] flex-none">{formatFileSize(f.file.size)}</span>
                      <button onClick={()=>{if(f.previewUrl)URL.revokeObjectURL(f.previewUrl);setFiles(p=>p.filter(x=>x.id!==f.id))}} className="flex-none text-[var(--fg3)] hover:text-[var(--fg2)] ml-0.5">×</button>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <div className="flex items-end gap-1 px-2 py-2 sm:py-2.5">
              <button onClick={()=>fileRef.current?.click()} disabled={locked} title="Attach file (max 3MB)" aria-label="Attach"
                className="flex-none w-9 h-9 rounded-lg flex items-center justify-center text-[var(--fg3)] hover:text-[var(--fg2)] hover:bg-[var(--mid)] transition-colors disabled:opacity-20">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M13.5 6.5L6.5 13.5C5.12 14.88 2.88 14.88 1.5 13.5C.12 12.12.12 9.88 1.5 8.5L8.5 1.5C9.33.67 10.67.67 11.5 1.5C12.33 2.33 12.33 3.67 11.5 4.5L5.21 10.79C4.82 11.18 4.18 11.18 3.79 10.79C3.4 10.4 3.4 9.76 3.79 9.37L9.5 3.67" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <input ref={fileRef} type="file" multiple accept={ALL_ACCEPTED_TYPES} className="hidden" onChange={e=>{if(e.target.files){addFiles(Array.from(e.target.files));e.target.value=''}}}/>
              <textarea ref={inputRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={onKey} disabled={locked}
                placeholder={phase==='hold'?'Your session is saved — the Studio will reach out.':phase==='gate'?'Fill in your details above…':streaming?'Thinking…':'Describe your project, share a reference…'}
                rows={1} aria-label="Message input" className="flex-1 bg-transparent text-[var(--fg)] resize-none leading-relaxed placeholder:text-[var(--fg3)] focus:outline-none disabled:opacity-40 py-1.5 min-h-[28px] max-h-[120px]" style={{fontSize:'16px',scrollMarginBottom:'12px'}}/>
              {charWarn&&<span className="text-2xs font-mono text-amber-400 flex-none self-end pb-2">{2000-input.length}</span>}
              <motion.button onClick={()=>send(input)} disabled={!canSend} whileTap={canSend?{scale:.88}:undefined} aria-label="Send"
                className={cn('flex-none w-9 h-9 rounded-xl flex items-center justify-center transition-all',canSend?'bg-[var(--fg)] text-[var(--bg)]':'bg-[var(--mid)] text-[var(--fg3)] cursor-not-allowed')}>
                {streaming?<motion.span className="block w-3 h-3 rounded-full border-[1.5px] border-[var(--fg3)] border-t-[var(--fg)]" animate={{rotate:360}} transition={{duration:.75,repeat:Infinity,ease:'linear'}}/>
                :<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 11V1M6 1L2 5M6 1l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </motion.button>
            </div>
          </motion.div>
          <p className="hidden sm:block text-center text-2xs text-[var(--fg3)] mt-2 select-none">
            {phase==='discovery'?'Return ↵ to send · Shift+Return for new line · Attach images, PDFs, audio & video (max 3 MB)':phase==='gate'?'Complete the form above to save your roadmap':'Submitted — your dashboard shows your roadmap once published'}
          </p>
        </div>
      </div>

      {/* Review modal */}
      <AnimatePresence>
        {showReview&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[var(--bg)]/80 backdrop-blur-sm p-4">
            <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}} transition={{ease:E,duration:.35}} className="w-full max-w-md bg-[var(--surf)] border border-[var(--str)] rounded-2xl p-6" style={{boxShadow:'0 8px 32px rgba(0,0,0,.4)'}}>
              <h3 className="text-sm font-medium mb-2">Request Studio Contact</h3>
              <p className="text-xs text-[var(--fg2)] mb-4">A team member will reach out directly. Leave an optional note.</p>
              <textarea value={reviewMsg} onChange={e=>setReviewMsg(e.target.value)} placeholder="Anything specific you'd like to discuss…" rows={3} className="w-full bg-[var(--in-bg)] border border-[var(--in-str)] rounded-xl px-4 py-3 text-sm text-[var(--fg)] placeholder:text-[var(--fg3)] focus:outline-none resize-none mb-4" style={{fontSize:'16px'}}/>
              <div className="flex gap-3">
                <button onClick={()=>setShowReview(false)} className="flex-1 border border-[var(--str)] rounded-xl py-3 text-sm text-[var(--fg2)] hover:text-[var(--fg)] transition-colors">Cancel</button>
                <button onClick={doReview} className="flex-1 bg-[var(--fg)] text-[var(--bg)] rounded-xl py-3 text-sm font-medium hover:opacity-90">Send Request</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function AIBubble({msg,typing}:{msg:Message;typing:boolean}){
  return(
    <div className="max-w-[90vw] sm:max-w-[580px] w-full">
      <div className="flex items-center gap-2 mb-3"><div className="w-[18px] h-[18px] rounded-[4px] bg-[var(--fg)] flex items-center justify-center flex-none"><div className="w-[7px] h-[7px] rounded-[2px] bg-[var(--bg)]"/></div><span className="text-2xs font-mono text-[var(--fg3)] uppercase tracking-[.16em]">OmniCraft Studios</span></div>
      {!msg.content&&typing?<Dots/>:<div className="relative"><MD text={msg.content}/>{typing&&msg.content&&<motion.span className="inline-block w-0.5 h-[13px] bg-[var(--fg)] ml-px align-middle rounded-full" animate={{opacity:[1,0]}} transition={{duration:.85,repeat:Infinity}}/>}</div>}
    </div>
  )
}
function UserBubble({msg}:{msg:Message}){
  return<div className="max-w-[80vw] sm:max-w-[480px]"><div className="bg-[var(--surf)] border border-[var(--str)] rounded-2xl rounded-tr-[4px] px-4 py-3"><p className="text-sm text-[var(--fg)] leading-relaxed whitespace-pre-wrap">{msg.content}</p></div></div>
}
function Dots(){return<div className="flex items-center gap-1.5 py-1 px-1">{[0,1,2].map(i=><motion.span key={i} className="block w-1 h-1 rounded-full bg-[var(--fg3)]" animate={{opacity:[.2,1,.2]}} transition={{duration:1.1,repeat:Infinity,delay:i*.18}}/>)}</div>}
function GateForm({projectId,onComplete}:{projectId:string;onComplete:(d:GateFormData)=>void}){
  const[form,setForm]=useState<GateFormData>({name:'',company:'',email:'',phone:''})
  const[errs,setErrs]=useState<Partial<GateFormData>>({})
  const[loading,setLoading]=useState(false)
  const fields=[{k:'name' as const,l:'Full Name',t:'text',ph:'Jane Okafor',req:true},{k:'company' as const,l:'Studio / Company',t:'text',ph:'Acme Creative',req:false},{k:'email' as const,l:'Email Address',t:'email',ph:'jane@studio.com',req:true},{k:'phone' as const,l:'WhatsApp / Phone',t:'tel',ph:'+234 801 234 5678',req:true}]
  const validate=()=>{const e:Partial<GateFormData>={};if(!form.name.trim())e.name='Required';if(!form.email.trim())e.email='Required';else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))e.email='Invalid email';if(!form.phone.trim())e.phone='Required';setErrs(e);return!Object.keys(e).length}
  const submit=async(e:React.FormEvent)=>{e.preventDefault();if(!validate()||loading)return;setLoading(true);try{const res=await fetch('/api/gate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId,...form})});if(!res.ok)throw new Error();onComplete(form)}catch{setErrs({email:'Something went wrong. Try again.'})}finally{setLoading(false)}}
  return(
    <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{duration:.45,ease:[.22,1,.36,1]}} className="w-full max-w-[92vw] sm:max-w-md">
      <div className="flex items-center gap-2 mb-3"><div className="w-[18px] h-[18px] rounded-[4px] bg-[var(--fg)] flex items-center justify-center flex-none"><div className="w-[7px] h-[7px] rounded-[2px] bg-[var(--bg)]"/></div><span className="text-2xs font-mono text-[var(--fg3)] uppercase tracking-[.16em]">OmniCraft Studios</span></div>
      <p className="text-sm text-[var(--fg)] leading-[1.85] mb-1">Your roadmap is ready to be saved.</p>
      <p className="text-sm text-[var(--fg2)] leading-[1.85] mb-7">Leave your details and the Studio will return with a finalised scope and quote within 24–48 hours.</p>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {fields.map((f,i)=>(
          <motion.div key={f.k} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:i*.06+.1,duration:.3}}>
            <label className="flex items-center justify-between mb-1.5"><span className="text-2xs font-mono text-[var(--fg2)] uppercase tracking-[.12em]">{f.l}</span>{!f.req&&<span className="text-2xs text-[var(--fg3)]">optional</span>}</label>
            <input type={f.t} value={form[f.k]??''} onChange={e=>{setForm(p=>({...p,[f.k]:e.target.value}));setErrs(p=>({...p,[f.k]:undefined}))}} placeholder={f.ph}
              className={cn('w-full rounded-xl px-4 text-sm text-[var(--fg)] bg-[var(--in-bg)] border placeholder:text-[var(--fg3)] focus:outline-none transition-all min-h-[50px]',errs[f.k]?'border-red-500/50':'border-[var(--in-str)] focus:border-[var(--strS)] focus:shadow-[0_0_0_3px_var(--in-ring)]')} style={{fontSize:'16px'}}/>
            <AnimatePresence>{errs[f.k]&&<motion.p initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0}} className="text-2xs text-red-400 mt-1 font-mono overflow-hidden">{errs[f.k]}</motion.p>}</AnimatePresence>
          </motion.div>
        ))}
        <motion.button type="submit" disabled={loading} whileTap={{scale:.97}} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:.3}}
          className={cn('w-full rounded-xl text-sm font-medium min-h-[52px] mt-1 transition-all',loading?'bg-[var(--mid)] border border-[var(--str)] text-[var(--fg2)] cursor-wait':'bg-[var(--fg)] text-[var(--bg)] hover:opacity-90')}>
          {loading?<span className="flex items-center justify-center gap-2"><motion.span className="block w-3.5 h-3.5 rounded-full border-[1.5px] border-[var(--fg2)] border-t-transparent" animate={{rotate:360}} transition={{duration:.75,repeat:Infinity,ease:'linear'}}/>Saving…</span>:'Save My Roadmap →'}
        </motion.button>
        <p className="text-2xs text-[var(--fg3)] text-center pb-1">Your details are used solely to deliver your project roadmap.</p>
      </form>
    </motion.div>
  )
}
function HoldScreen({clientName,projectSlug,onReview,reviewSent}:{clientName?:string;projectSlug:string;onReview:()=>void;reviewSent:boolean}){
  const url=`${process.env.NEXT_PUBLIC_APP_URL??'http://localhost:3000'}/p/${projectSlug}`
  return(
    <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} transition={{duration:.5,ease:[.22,1,.36,1]}} className="w-full max-w-[92vw] sm:max-w-md">
      <div className="flex items-center gap-2 mb-3"><div className="w-[18px] h-[18px] rounded-[4px] bg-[var(--fg)] flex items-center justify-center flex-none"><div className="w-[7px] h-[7px] rounded-[2px] bg-[var(--bg)]"/></div><span className="text-2xs font-mono text-[var(--fg3)] uppercase tracking-[.16em]">OmniCraft Studios</span></div>
      <div className="flex items-center gap-2.5 mb-6"><span className="relative flex h-2 w-2 flex-none"><motion.span className="absolute inset-0 rounded-full bg-amber-400" animate={{scale:[1,2.8,1],opacity:[.8,0,.8]}} transition={{duration:2.2,repeat:Infinity}}/><span className="relative block h-full w-full rounded-full bg-amber-400"/></span><span className="text-2xs font-mono text-amber-400 uppercase tracking-widest">Reviewing complexity</span></div>
      <div className="space-y-3 text-sm leading-[1.85] mb-7">
        <p className="text-[var(--fg)]">{clientName?`Thank you, ${clientName.split(' ')[0]}.`:"You're in."}{' '}Everything is saved to your private dashboard.</p>
        <p className="text-[var(--fg2)]">The Studio Owner is reviewing the AI-generated roadmap to validate scope and finalise pricing. Expect to hear back within 24–48 hours.</p>
      </div>
      <div className="bg-[var(--surf)] border border-[var(--str)] rounded-2xl p-4 sm:p-5 mb-4">
        <p className="text-2xs font-mono text-[var(--fg3)] uppercase tracking-widest mb-2">Your Dashboard</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-[var(--fg2)] break-all hover:text-[var(--fg)] transition-colors underline underline-offset-2">{url}</a>
        <p className="text-2xs text-[var(--fg3)] mt-3">Bookmark this. Your roadmap and quote appear here once published.</p>
      </div>
      {!reviewSent?<button onClick={onReview} className="w-full border border-[var(--str)] rounded-xl py-3 text-sm text-[var(--fg2)] hover:text-[var(--fg)] hover:border-[var(--strS)] transition-all">Request to speak with a human →</button>
      :<p className="text-xs text-center text-emerald-400 py-3">✓ A team member will reach out shortly</p>}
    </motion.div>
  )
}
function SunIcon(){return<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="2.8" stroke="currentColor" strokeWidth="1.3"/><path d="M7.5 1v1.6M7.5 12.4V14M1 7.5h1.6M12.4 7.5H14M3.05 3.05l1.13 1.13M10.82 10.82l1.13 1.13M3.05 11.95l1.13-1.13M10.82 4.18l1.13-1.13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>}
function MoonIcon(){return<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M13 9.5A6 6 0 016 2.5a6 6 0 100 10A6 6 0 0013 9.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>}
