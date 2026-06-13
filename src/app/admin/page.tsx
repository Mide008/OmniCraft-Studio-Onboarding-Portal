'use client'
import {useEffect,useState,useCallback,useRef} from 'react'
import {motion,AnimatePresence} from 'framer-motion'
import {useTheme} from '@/lib/useTheme'
import Logo from '@/components/Logo'
import {cn} from '@/lib/utils'
import type {RoadmapDraft,QuoteLineItem} from '@/types'

interface Project{id:string;slug:string;title:string|null;phase:string;status:string;summary:string|null;createdAt:string;client:{name?:string;email?:string;phone?:string;company?:string}|null;messages:{id:string;role:string;content:string;timestamp:string;metadata?:Record<string,unknown>}[];roadmap:{adminNotes?:string;timelineWeeks?:number;publishedAt?:string;aiDraft?:RoadmapDraft}|null;quote:{amount?:number;currency?:string;publishedAt?:string}|null}
interface Funnel{sessions:number;firstMessageRate:number;gateShowRate:number;gateConversion:number}
const SC:Record<string,string>={draft:'text-[var(--fg3)] border-[var(--str)]',pending_review:'text-amber-400 border-amber-800/60',reviewed:'text-blue-400 border-blue-800/60',published:'text-emerald-400 border-emerald-800/60'}
const E=[0.22,1,0.36,1] as const

export default function AdminPage(){
  const{theme,toggle,mounted}=useTheme()
  const[projects,setProjects]=useState<Project[]>([])
  const[selected,setSelected]=useState<Project|null>(null)
  const[funnel,setFunnel]=useState<Funnel|null>(null)
  const[loading,setLoading]=useState(true)
  const[adminKey,setAdminKey]=useState('')
  const[authed,setAuthed]=useState(false)
  const[authErr,setAuthErr]=useState('')
  const[mobileDetail,setMobileDetail]=useState(false)
  const[toast,setToast]=useState<string|null>(null)
  const prevCount=useRef(0)
  const pollRef=useRef<ReturnType<typeof setInterval>|null>(null)

  const showToast=(msg:string)=>{setToast(msg);setTimeout(()=>setToast(null),4000)}

  const load=useCallback(async(key:string)=>{
    try{
      const[pr,ar]=await Promise.all([fetch('/api/admin/projects'),fetch(`/api/analytics?key=${encodeURIComponent(key)}`)])
      const pd=await pr.json(),ad=await ar.json()
      const np=pd.projects??[]
      setProjects(prev=>{if(prev.length>0&&np.length>prevCount.current)showToast(`${np.length-prevCount.current} new session(s) arrived`);prevCount.current=np.length;return np})
      if(ad.funnel)setFunnel(ad.funnel)
    }catch(e){console.error(e)}finally{setLoading(false)}
  },[])

  useEffect(()=>{if(!authed)return;load(adminKey);pollRef.current=setInterval(()=>load(adminKey),15000);return()=>{if(pollRef.current)clearInterval(pollRef.current)}},[authed,adminKey,load])

  if(!authed)return(
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center px-5" style={{paddingBottom:'max(24px,env(safe-area-inset-bottom))'}}>
      <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:.5,ease:E}} className="w-full max-w-sm">
        {mounted&&<div className="flex items-center gap-2.5 mb-12"><Logo theme={theme}/><span className="text-2xs font-mono tracking-[.22em] uppercase text-[var(--fg2)]">Studio Admin</span></div>}
        <form onSubmit={e=>{e.preventDefault();adminKey.length>=8?(setAuthed(true),setAuthErr('')):setAuthErr('Key must be 8+ characters.')}} className="space-y-4">
          <div>
            <label className="block text-2xs font-mono text-[var(--fg2)] uppercase tracking-widest mb-2">Admin Key</label>
            <input type="password" value={adminKey} onChange={e=>setAdminKey(e.target.value)} placeholder="Enter your admin key" autoFocus
              className="w-full bg-[var(--in-bg)] border border-[var(--in-str)] rounded-xl px-4 text-sm text-[var(--fg)] placeholder:text-[var(--fg3)] focus:outline-none focus:border-[var(--strS)] min-h-[52px] transition-all" style={{fontSize:'16px'}}/>
            {authErr&&<p className="text-2xs text-red-400 mt-2 font-mono">{authErr}</p>}
          </div>
          <button type="submit" className="w-full bg-[var(--fg)] text-[var(--bg)] text-sm font-medium rounded-xl min-h-[52px] hover:opacity-90 active:scale-[.98] transition-all">Enter Studio</button>
        </form>
      </motion.div>
    </div>
  )

  return(
    <div className="bg-[var(--bg)] text-[var(--fg)] flex flex-col" style={{height:'100dvh',overflow:'hidden'}}>
      <AnimatePresence>
        {toast&&<motion.div initial={{opacity:0,y:-40}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-40}} className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[var(--fg)] text-[var(--bg)] text-xs font-mono px-4 py-2 rounded-full shadow-lg">{toast}</motion.div>}
      </AnimatePresence>
      <header className="flex-none flex items-center justify-between px-4 sm:px-6 h-14 border-b border-[var(--str)] bg-[var(--bg)]/90 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          {mounted&&<Logo theme={theme} size="sm"/>}
          <span className="text-2xs font-mono tracking-[.22em] uppercase text-[var(--fg2)]">Admin</span>
          <span className="text-2xs font-mono text-[var(--fg3)] ml-1">· {projects.length} session{projects.length!==1?'s':''}</span>
        </div>
        <div className="flex items-center gap-2">
          {mobileDetail&&selected&&<button onClick={()=>setMobileDetail(false)} className="sm:hidden text-2xs font-mono text-[var(--fg2)] px-3 py-1.5 border border-[var(--str)] rounded-lg">← All</button>}
          <a href={`/api/export?key=${encodeURIComponent(adminKey)}`} download title="Export CSV" className="text-2xs font-mono text-[var(--fg3)] hover:text-[var(--fg2)] px-2 hidden sm:block transition-colors">↓ CSV</a>
          {mounted&&<button onClick={toggle} aria-label="Toggle theme" className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--fg2)] hover:text-[var(--fg)] hover:bg-[var(--mid)] transition-colors">{theme==='dark'?<Sun/>:<Moon/>}</button>}
        </div>
      </header>
      {funnel&&(
        <div className="flex-none border-b border-[var(--str)] px-4 sm:px-6 py-2 overflow-x-auto">
          <div className="flex gap-6 text-xs min-w-max">
            {[{l:'Sessions',v:funnel.sessions,a:false},{l:'Engaged',v:`${funnel.firstMessageRate}%`,a:false},{l:'Gate',v:`${funnel.gateShowRate}%`,a:false},{l:'Leads',v:`${funnel.gateConversion}%`,a:true}].map(m=>(
              <div key={m.l} className="flex items-center gap-2"><span className="text-[var(--fg3)]">{m.l}</span><span className={cn('font-mono font-medium',m.a?'text-emerald-400':'text-[var(--fg)]')}>{m.v}</span></div>
            ))}
          </div>
        </div>
      )}
      <div className="flex-1 flex overflow-hidden">
        <aside className={cn('flex-none border-r border-[var(--str)] flex flex-col overflow-hidden w-full sm:w-72',mobileDetail?'hidden sm:flex':'flex')}>
          <div className="flex-1 overflow-y-auto">
            {loading?<div className="flex items-center justify-center py-16"><motion.div className="w-5 h-5 rounded-full border-[1.5px] border-[var(--strS)] border-t-[var(--fg2)]" animate={{rotate:360}} transition={{duration:.8,repeat:Infinity,ease:'linear'}}/></div>
            :projects.length===0?<div className="px-6 py-16 text-center"><p className="text-[var(--fg2)] text-sm">No sessions yet.</p></div>
            :<ul>{projects.map((p,i)=>(
              <motion.li key={p.id} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:i*.03,duration:.28,ease:E}}>
                <button onClick={()=>{setSelected(p);setMobileDetail(true)}}
                  className={cn('w-full text-left px-4 sm:px-5 py-4 border-b border-[var(--str)] transition-colors hover:bg-[var(--mid)]',selected?.id===p.id&&'bg-[var(--surf)]')}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="text-sm text-[var(--fg)] font-medium truncate leading-snug">{p.title??p.client?.email??`Session ${p.slug.slice(0,6)}`}</span>
                    <span className={cn('text-2xs font-mono border rounded px-1.5 py-0.5 flex-none whitespace-nowrap',SC[p.status]??'text-[var(--fg3)] border-[var(--str)]')}>{p.status.replace('_',' ')}</span>
                  </div>
                  {p.summary&&<p className="text-2xs text-[var(--fg3)] leading-relaxed line-clamp-2 mb-1">{p.summary}</p>}
                  <div className="flex items-center gap-1.5 text-2xs text-[var(--fg3)] font-mono">
                    <span className="capitalize">{p.phase}</span><span>·</span>
                    <span>{new Date(p.createdAt).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>
                    {p.messages?.length>0&&<><span>·</span><span>{p.messages.length} msgs</span></>}
                  </div>
                </button>
              </motion.li>
            ))}</ul>}
          </div>
        </aside>
        <main className={cn('flex-1 overflow-y-auto',mobileDetail?'block':'hidden sm:block')}>
          <AnimatePresence mode="wait">
            {!selected?<motion.div key="empty" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="hidden sm:flex items-center justify-center h-full"><p className="text-[var(--fg3)] text-sm">Select a session to review</p></motion.div>
            :<motion.div key={selected.id} initial={{opacity:0,x:12}} animate={{opacity:1,x:0}} exit={{opacity:0}} transition={{duration:.28,ease:E}}>
              <Detail project={selected} adminKey={adminKey} onUpdated={u=>{setSelected(u);setProjects(p=>p.map(x=>x.id===u.id?u:x))}} onToast={showToast}/>
            </motion.div>}
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

function Detail({project,adminKey,onUpdated,onToast}:{project:Project;adminKey:string;onUpdated:(p:Project)=>void;onToast:(m:string)=>void}){
  const[adminNotes,setAdminNotes]=useState(project.roadmap?.adminNotes??'')
  const[timelineWeeks,setTimelineWeeks]=useState(project.roadmap?.timelineWeeks?.toString()??'')
  const[quoteAmount,setQuoteAmount]=useState(project.quote?.amount?.toString()??'')
  const[currency,setCurrency]=useState(project.quote?.currency??'NGN')
  const[lineItems,setLineItems]=useState<QuoteLineItem[]>([])
  const[pushing,setPushing]=useState(false)
  const[pushed,setPushed]=useState(!!project.roadmap?.publishedAt)
  const[pushErr,setPushErr]=useState('')
  const[summary,setSummary]=useState(project.summary??'')
  const[sumLoading,setSumLoading]=useState(false)
  const[tab,setTab]=useState<'conversation'|'roadmap'|'quote'>('conversation')
  const appUrl=process.env.NEXT_PUBLIC_APP_URL??''
  const dashUrl=`${appUrl}/p/${project.slug}`
  const moodboards=project.messages.filter(m=>m.metadata?.moodboard).map(m=>m.metadata!.moodboard as any)

  const genSummary=async()=>{setSumLoading(true);try{const r=await fetch('/api/summary',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:project.id})});const d=await r.json();if(d.summary){setSummary(d.summary);onToast('Brief generated')}}finally{setSumLoading(false)}}

  const handlePush=async()=>{
    if(pushing||pushed)return;setPushing(true);setPushErr('')
    try{
      const res=await fetch('/api/admin/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:project.id,adminKey,adminNotes:adminNotes||undefined,quoteAmount:quoteAmount?parseFloat(quoteAmount):undefined,quoteCurrency:currency,breakdown:lineItems.filter(i=>i.label.trim()&&i.amount>0),timelineWeeks:timelineWeeks?parseInt(timelineWeeks):undefined,validUntilDays:14})})
      if(!res.ok){const{error:msg}=await res.json();setPushErr(msg??'Push failed');return}
      setPushed(true);onUpdated({...project,status:'published',phase:'reveal'});onToast('Published — client notified by email')
    }catch{setPushErr('Network error.')}finally{setPushing(false)}
  }

  const iCls='w-full bg-[var(--in-bg)] border border-[var(--in-str)] rounded-xl px-4 py-3 text-sm text-[var(--fg)] placeholder:text-[var(--fg3)] focus:outline-none focus:border-[var(--strS)] transition-all'

  return(
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-8 sm:py-10">
      <div className="mb-7">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div><p className="text-2xs font-mono text-[var(--fg3)] tracking-widest mb-1">{project.slug}</p><h2 className="text-xl sm:text-2xl text-[var(--fg)] font-light">{project.title??project.client?.email??'Unnamed Session'}</h2></div>
          <span className={cn('text-2xs font-mono border rounded-full px-3 py-1 flex-none',SC[project.status]??'text-[var(--fg3)] border-[var(--str)]')}>{project.status.replace('_',' ')}</span>
        </div>
        {project.client&&<div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--fg2)] mt-2">{project.client.name&&<span>{project.client.name}</span>}{project.client.company&&<><span className="text-[var(--fg3)]">·</span><span>{project.client.company}</span></>}{project.client.email&&<><span className="text-[var(--fg3)]">·</span><a href={`mailto:${project.client.email}`} className="hover:text-[var(--fg)] transition-colors">{project.client.email}</a></>}{project.client.phone&&<><span className="text-[var(--fg3)]">·</span><a href={`tel:${project.client.phone}`} className="hover:text-[var(--fg)] transition-colors">{project.client.phone}</a></>}</div>}
        <a href={dashUrl} target="_blank" rel="noopener noreferrer" className="text-2xs font-mono text-[var(--fg3)] hover:text-[var(--fg2)] mt-1.5 inline-block break-all transition-colors">{dashUrl} ↗</a>
      </div>
      {/* AI Brief */}
      <div className="mb-6 p-4 bg-[var(--surf)] border border-[var(--str)] rounded-xl">
        <div className="flex items-center justify-between mb-2"><p className="text-2xs font-mono text-[var(--fg3)] uppercase tracking-widest">AI Project Brief</p><button onClick={genSummary} disabled={sumLoading} className="text-2xs font-mono text-[var(--fg3)] hover:text-[var(--fg2)] transition-colors disabled:opacity-40">{sumLoading?'Generating…':summary?'↺ Refresh':'✦ Generate'}</button></div>
        {summary?<p className="text-sm text-[var(--fg2)] leading-[1.75]">{summary}</p>:<p className="text-sm text-[var(--fg3)] italic">Click Generate to create a 3-sentence brief from the conversation.</p>}
      </div>
      {/* Moodboard */}
      {moodboards.length>0&&(
        <div className="mb-6 p-4 bg-[var(--surf)] border border-[var(--str)] rounded-xl">
          <p className="text-2xs font-mono text-[var(--fg3)] uppercase tracking-widest mb-3">Brand Moodboard</p>
          {moodboards.map((mb:any,i:number)=>(
            <div key={i} className="space-y-3">
              <div className="flex gap-2 flex-wrap">{mb.colors?.map((hex:string,ci:number)=><div key={ci} className="flex items-center gap-1.5 text-2xs font-mono"><span className="w-4 h-4 rounded border border-[var(--str)] flex-none" style={{background:hex}}/><span className="text-[var(--fg2)]">{hex}</span></div>)}</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">{mb.style&&<div><span className="text-[var(--fg3)]">Style:</span> <span className="text-[var(--fg2)]">{mb.style}</span></div>}{mb.typography&&<div><span className="text-[var(--fg3)]">Type:</span> <span className="text-[var(--fg2)]">{mb.typography}</span></div>}{mb.mood&&<div><span className="text-[var(--fg3)]">Mood:</span> <span className="text-[var(--fg2)]">{mb.mood}</span></div>}{mb.vibe&&<div className="col-span-2 sm:col-span-3"><span className="text-[var(--fg3)]">Vibe:</span> <span className="text-[var(--fg2)] italic">{mb.vibe}</span></div>}</div>
            </div>
          ))}
        </div>
      )}
      {/* Tabs */}
      <div className="flex border-b border-[var(--str)] mb-7 overflow-x-auto">
        {(['conversation','roadmap','quote'] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} className={cn('px-3 sm:px-4 py-2.5 text-2xs font-mono uppercase tracking-widest border-b-2 -mb-px whitespace-nowrap transition-colors',tab===t?'text-[var(--fg)] border-[var(--fg)]':'text-[var(--fg3)] border-transparent hover:text-[var(--fg2)]')}>
            {t}{t==='conversation'&&project.messages?.length>0&&` (${project.messages.length})`}
          </button>
        ))}
      </div>
      {tab==='conversation'&&(
        <div className="space-y-5 max-h-[55vh] overflow-y-auto pr-1">
          {!project.messages?.length?<p className="text-[var(--fg3)] text-sm">No messages yet.</p>:project.messages.map(m=>(
            <div key={m.id}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xs font-mono text-[var(--fg3)] uppercase tracking-widest">{m.role}</span>
                {(m.metadata?.attachmentCount as number)>0&&<span className="text-2xs text-amber-400 font-mono">📎 {String(m.metadata!.attachmentCount)} file(s)</span>}
                {m.metadata?.type==='human_review_request'&&<span className="text-2xs text-red-400 font-mono">🚨 Review</span>}
                {m.metadata?.type==='followup'&&<span className="text-2xs text-purple-400 font-mono">💬 Follow-up</span>}
              </div>
              <p className={cn('text-sm leading-[1.8] whitespace-pre-wrap',m.role==='user'?'text-[var(--fg2)]':'text-[var(--fg)]')}>{m.content}</p>
            </div>
          ))}
        </div>
      )}
      {tab==='roadmap'&&(
        <div className="space-y-5">
          <div><label className="block text-2xs font-mono text-[var(--fg2)] uppercase tracking-widest mb-2">Review Notes</label><textarea value={adminNotes} onChange={e=>setAdminNotes(e.target.value)} placeholder="Scope flags, complexity notes, pricing rationale…" rows={4} className={cn(iCls,'resize-none')}/></div>
          <div><label className="block text-2xs font-mono text-[var(--fg2)] uppercase tracking-widest mb-2">Timeline (weeks)</label><input type="number" value={timelineWeeks} onChange={e=>setTimelineWeeks(e.target.value)} placeholder="12" className="w-28 bg-[var(--in-bg)] border border-[var(--in-str)] rounded-lg px-4 py-2.5 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--strS)] transition-all"/></div>
        </div>
      )}
      {tab==='quote'&&(
        <div className="space-y-5">
          <div className="flex items-end gap-3">
            <div><label className="block text-2xs font-mono text-[var(--fg2)] uppercase tracking-widest mb-2">Currency</label><select value={currency} onChange={e=>setCurrency(e.target.value)} className="bg-[var(--in-bg)] border border-[var(--in-str)] rounded-lg px-3 py-3 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--strS)] transition-all">{['NGN','USD','GBP','EUR','GHS','KES','ZAR'].map(c=><option key={c}>{c}</option>)}</select></div>
            <div className="flex-1"><label className="block text-2xs font-mono text-[var(--fg2)] uppercase tracking-widest mb-2">Total Amount</label><input type="number" value={quoteAmount} onChange={e=>setQuoteAmount(e.target.value)} placeholder="500000" className={iCls}/></div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3"><label className="text-2xs font-mono text-[var(--fg2)] uppercase tracking-widest">Breakdown</label><button onClick={()=>setLineItems(p=>[...p,{label:'',amount:0}])} className="text-2xs font-mono text-[var(--fg3)] hover:text-[var(--fg2)] transition-colors">+ Add line</button></div>
            <div className="space-y-2">{lineItems.map((item,i)=>(
              <div key={i} className="flex gap-2">
                <input type="text" value={item.label} onChange={e=>setLineItems(p=>p.map((x,idx)=>idx===i?{...x,label:e.target.value}:x))} placeholder="Brand Identity" className="flex-1 bg-[var(--in-bg)] border border-[var(--in-str)] rounded-lg px-3 py-2.5 text-sm text-[var(--fg)] placeholder:text-[var(--fg3)] focus:outline-none focus:border-[var(--strS)]"/>
                <input type="number" value={item.amount||''} onChange={e=>setLineItems(p=>p.map((x,idx)=>idx===i?{...x,amount:parseFloat(e.target.value)||0}:x))} placeholder="150000" className="w-28 bg-[var(--in-bg)] border border-[var(--in-str)] rounded-lg px-3 py-2.5 text-sm text-[var(--fg)] focus:outline-none focus:border-[var(--strS)]"/>
                <button onClick={()=>setLineItems(p=>p.filter((_,idx)=>idx!==i))} className="text-[var(--fg3)] hover:text-[var(--fg2)] text-lg px-1">×</button>
              </div>
            ))}</div>
          </div>
        </div>
      )}
      <div className="mt-10 pt-8 border-t border-[var(--str)]">
        {pushErr&&<p className="text-2xs text-red-400 font-mono mb-4">{pushErr}</p>}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div><p className="text-sm text-[var(--fg)] font-medium">Push to client</p><p className="text-xs text-[var(--fg3)] mt-0.5">Publishes roadmap + quote and emails the client automatically</p></div>
          <motion.button onClick={handlePush} disabled={pushing||pushed} whileTap={!pushing&&!pushed?{scale:.96}:undefined}
            className={cn('px-6 rounded-xl text-sm font-medium transition-all min-h-[48px] w-full sm:w-auto',pushed?'bg-emerald-950/30 text-emerald-400 border border-emerald-800/50 cursor-default':pushing?'bg-[var(--surf)] border border-[var(--str)] text-[var(--fg2)] cursor-wait':'bg-[var(--fg)] text-[var(--bg)] hover:opacity-90 active:scale-[.98]')}>
            {pushed?'✓ Published':pushing?'Publishing…':'Push to Client →'}
          </motion.button>
        </div>
      </div>
    </div>
  )
}
function Sun(){return<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="2.8" stroke="currentColor" strokeWidth="1.3"/><path d="M7.5 1v1.6M7.5 12.4V14M1 7.5h1.6M12.4 7.5H14M3.05 3.05l1.13 1.13M10.82 10.82l1.13 1.13M3.05 11.95l1.13-1.13M10.82 4.18l1.13-1.13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>}
function Moon(){return<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M13 9.5A6 6 0 016 2.5a6 6 0 100 10A6 6 0 0013 9.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>}
