-- ============================================================
-- OmniCraft Onboard — Supabase Schema
-- Paste this into: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- CLIENTS — contact info, captured at Gate phase
create table public.clients (
  id          uuid default uuid_generate_v4() primary key,
  created_at  timestamptz default now(),
  name        text,
  email       text unique,
  phone       text,
  company     text,
  status      text default 'active' check (status in ('active', 'inactive'))
);

-- PROJECTS — one per onboarding session
create table public.projects (
  id          uuid default uuid_generate_v4() primary key,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  client_id   uuid references public.clients(id) on delete set null,
  slug        text unique not null,
  title       text,
  phase       text default 'discovery'
              check (phase in ('discovery', 'synthesis', 'gate', 'hold', 'reveal')),
  mode        text[] default array['creative'],
  summary     text,
  status      text default 'draft'
              check (status in ('draft', 'pending_review', 'reviewed', 'published'))
);

-- MESSAGES — full conversation history
create table public.messages (
  id          uuid default uuid_generate_v4() primary key,
  created_at  timestamptz default now(),
  project_id  uuid references public.projects(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant', 'system')),
  content     text not null,
  mode        text check (mode in ('research', 'engineering', 'creative')),
  metadata    jsonb default '{}'::jsonb
);

-- ASSETS — uploaded files (images, PDFs, audio, video)
create table public.assets (
  id            uuid default uuid_generate_v4() primary key,
  created_at    timestamptz default now(),
  project_id    uuid references public.projects(id) on delete cascade,
  type          text not null check (type in ('image', 'pdf', 'audio', 'video')),
  url           text not null,
  filename      text,
  size_bytes    bigint,
  transcription text,   -- populated after Groq/Whisper processing
  analysis      text    -- populated after Gemini analysis
);

-- ROADMAPS — AI-generated, admin-reviewed project plans
create table public.roadmaps (
  id             uuid default uuid_generate_v4() primary key,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  project_id     uuid references public.projects(id) on delete cascade unique,
  ai_draft       jsonb default '{}'::jsonb,     -- raw AI output
  admin_notes    text,                           -- studio owner annotations
  final_scope    jsonb default '{}'::jsonb,      -- edited final scope
  deliverables   jsonb default '[]'::jsonb,      -- array of deliverable objects
  timeline_weeks int,
  published_at   timestamptz                     -- null = not yet pushed to client
);

-- QUOTES — pricing, set manually by Studio Owner
create table public.quotes (
  id           uuid default uuid_generate_v4() primary key,
  created_at   timestamptz default now(),
  project_id   uuid references public.projects(id) on delete cascade unique,
  currency     text default 'USD',
  amount       numeric(10, 2),
  breakdown    jsonb default '[]'::jsonb,        -- array of { label, amount, description }
  valid_until  date,
  published_at timestamptz                       -- null = not yet pushed to client
);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on public.projects
  for each row execute procedure public.handle_updated_at();

create trigger roadmaps_updated_at
  before update on public.roadmaps
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.clients   enable row level security;
alter table public.projects  enable row level security;
alter table public.messages  enable row level security;
alter table public.assets    enable row level security;
alter table public.roadmaps  enable row level security;
alter table public.quotes    enable row level security;

-- Service role: full access (all server-side API calls use this)
create policy "service_role_clients"  on public.clients  for all using (auth.role() = 'service_role');
create policy "service_role_projects" on public.projects for all using (auth.role() = 'service_role');
create policy "service_role_messages" on public.messages for all using (auth.role() = 'service_role');
create policy "service_role_assets"   on public.assets   for all using (auth.role() = 'service_role');
create policy "service_role_roadmaps" on public.roadmaps for all using (auth.role() = 'service_role');
create policy "service_role_quotes"   on public.quotes   for all using (auth.role() = 'service_role');

-- Public read: client-facing portal (anonymous, gated by slug knowledge)
create policy "public_read_projects"  on public.projects for select using (true);
create policy "public_read_messages"  on public.messages for select using (true);
create policy "public_read_roadmaps"  on public.roadmaps for select using (published_at is not null);
create policy "public_read_quotes"    on public.quotes   for select using (published_at is not null);

-- ============================================================
-- STORAGE BUCKET (run separately if needed)
-- ============================================================
-- Go to: Supabase → Storage → Create bucket
-- Name: omnicraft-assets
-- Public: false
-- File size limit: 50MB
-- Allowed MIME types: image/*, application/pdf, audio/*, video/*

-- ============================================================
-- PHASE 2 ADDITIONS — append to existing schema, or run separately
-- ============================================================

-- Slug index for fast /p/[slug] lookups
create index if not exists idx_projects_slug on public.projects(slug);

-- Project phase index for admin filtering
create index if not exists idx_projects_phase   on public.projects(phase);
create index if not exists idx_projects_status  on public.projects(status);

-- Messages order index
create index if not exists idx_messages_project_created
  on public.messages(project_id, created_at asc);

-- Assets project index
create index if not exists idx_assets_project on public.assets(project_id);
