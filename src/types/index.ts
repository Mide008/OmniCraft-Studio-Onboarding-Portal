// ============================================================
// OmniCraft Onboard — Core Types
// ============================================================

export type AgentMode = 'creative' | 'engineering' | 'research'

export type ProjectPhase =
  | 'discovery'   // Initial conversation
  | 'synthesis'   // AI showing research output
  | 'gate'        // Collecting contact info
  | 'hold'        // Awaiting admin review
  | 'reveal'      // Final roadmap + quote published

export type ProjectStatus =
  | 'draft'
  | 'pending_review'
  | 'reviewed'
  | 'published'

export type AssetType = 'image' | 'pdf' | 'audio' | 'video'

export type MessageRole = 'user' | 'assistant' | 'system'

// ============================================================
// DOMAIN MODELS
// ============================================================

export interface Message {
  id: string
  projectId?: string
  role: MessageRole
  content: string
  mode?: AgentMode
  timestamp: Date
  metadata?: Record<string, unknown>
}

export interface Client {
  id: string
  name?: string
  email?: string
  phone?: string
  company?: string
  status: 'active' | 'inactive'
  createdAt: Date
}

export interface Project {
  id: string
  slug: string
  title?: string
  phase: ProjectPhase
  mode: AgentMode[]
  summary?: string
  status: ProjectStatus
  clientId?: string
  client?: Client
  messages?: Message[]
  assets?: Asset[]
  roadmap?: Roadmap
  quote?: Quote
  createdAt: Date
  updatedAt: Date
}

export interface Asset {
  id: string
  projectId: string
  type: AssetType
  url: string
  filename?: string
  sizeBytes?: number
  transcription?: string
  analysis?: string
  createdAt: Date
}

export interface Deliverable {
  id: string
  title: string
  description: string
  phase: number
  weeksEstimate: number
  category: 'design' | 'engineering' | 'strategy' | 'content'
}

export interface Roadmap {
  id: string
  projectId: string
  aiDraft: RoadmapDraft
  adminNotes?: string
  finalScope: Partial<RoadmapDraft>
  deliverables: Deliverable[]
  timelineWeeks?: number
  publishedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface RoadmapDraft {
  projectSummary?: string
  technicalStack?: string[]
  designSystem?: {
    brandPillars: string[]
    colorDirection: string
    typographyDirection: string
  }
  architecture?: {
    databaseSchema?: string
    apiSurface?: string[]
    authModel?: string
    infrastructureNotes?: string
  }
  competitorGaps?: string[]
  marketOpportunities?: string[]
  uxDebtFlags?: string[]
  phases?: RoadmapPhase[]
}

export interface RoadmapPhase {
  number: number
  title: string
  duration: string
  deliverables: string[]
}

export interface QuoteLineItem {
  label: string
  amount: number
  description?: string
}

export interface Quote {
  id: string
  projectId: string
  currency: string
  amount: number
  breakdown: QuoteLineItem[]
  validUntil?: Date
  publishedAt?: Date
  createdAt: Date
}

// ============================================================
// API REQUEST/RESPONSE TYPES
// ============================================================

export interface ChatRequest {
  message: string
  projectId?: string
  messages?: Pick<Message, 'role' | 'content'>[]
}

export interface ChatResponseHeaders {
  'X-Project-Id': string
  'X-Detected-Modes': string
}

export interface GateFormData {
  name: string
  company?: string
  email: string
  phone: string
}

export interface SaveMessageRequest {
  projectId: string
  role: MessageRole
  content: string
  mode?: AgentMode
}

// ============================================================
// UI STATE TYPES
// ============================================================

export interface UploadedFile {
  id: string             // local temp ID
  file: File
  type: AssetType
  previewUrl?: string    // for images
  status: 'pending' | 'uploading' | 'done' | 'error'
  assetId?: string       // Supabase asset ID after upload
  error?: string
}

export interface StreamingState {
  isStreaming: boolean
  streamingMessageId: string | null
}
