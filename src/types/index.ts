export type Theme = 'dark'|'light'
export type AgentMode = 'creative'|'engineering'|'research'
export type ProjectPhase = 'discovery'|'synthesis'|'gate'|'hold'|'reveal'
export interface Message { id:string; role:'user'|'assistant'; content:string; timestamp:Date; mode?:AgentMode; metadata?:Record<string,unknown> }
export interface UploadedFile { id:string; file:File; type:'image'|'pdf'|'audio'|'video'; status:'pending'|'uploading'|'done'|'error'; previewUrl?:string; assetId?:string }
export interface GateFormData { name:string; company?:string; email:string; phone:string }
export interface QuoteLineItem { label:string; amount:number }
export interface RoadmapDraft { projectSummary?:string; technicalStack?:string[]; phases?:{number:number;title:string;duration:string;deliverables:string[]}[]; competitorGaps?:string[]; marketOpportunities?:string[]; designSystem?:{colorDirection?:string;typographyDirection?:string;brandPillars?:string[]}; architecture?:{databaseSchema?:string;authModel?:string;apiSurface?:string[]} }
export type AssetType = 'image' | 'pdf' | 'audio' | 'video' | 'file'