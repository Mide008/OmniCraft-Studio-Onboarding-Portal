# OmniCraft Onboard — Setup Guide
## From Zero to Running in Under 20 Minutes

---

## STEP 1 — Scaffold the Next.js project

Open your terminal. Run this exactly:

```bash
npx create-next-app@latest omnicraft-onboard \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*"
cd omnicraft-onboard
```

Then **replace the generated src/ folder entirely** with the files 
provided in this build. The structure you need:

```
omnicraft-onboard/
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   └── page.tsx
│   │   ├── api/
│   │   │   ├── admin/projects/route.ts
│   │   │   ├── chat/route.ts
│   │   │   └── messages/save/route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   └── portal/
│   │       ├── FileUpload.tsx
│   │       ├── ModeIndicator.tsx
│   │       └── OnboardingPortal.tsx
│   ├── lib/
│   │   ├── ai/
│   │   │   └── orchestrator.ts
│   │   ├── supabase/
│   │   │   ├── admin.ts
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   └── utils.ts
│   └── types/
│       └── index.ts
├── .env.local           ← you create this (see Step 2)
├── .gitignore
├── next.config.ts
├── package.json
├── postcss.config.js
├── tailwind.config.ts
└── tsconfig.json
```

---

## STEP 2 — Install dependencies

```bash
npm install \
  @anthropic-ai/sdk \
  @supabase/ssr \
  @supabase/supabase-js \
  clsx \
  framer-motion \
  tailwind-merge

npm install --save-dev \
  @types/node \
  @types/react \
  @types/react-dom
```

---

## STEP 3 — Create your Supabase project

1. Go to https://supabase.com → sign in
2. Click **New Project**
3. Name it: `omnicraft-onboard`
4. Set a strong database password (save it somewhere safe)
5. Choose a region close to you
6. Wait ~2 minutes for it to provision

Once ready:
- Go to **Project Settings → API**
- Copy: `Project URL`, `anon public key`, `service_role key`

---

## STEP 4 — Run the database schema

1. In Supabase, click **SQL Editor** in the left sidebar
2. Click **+ New query**
3. Open the file `schema.sql` from this project
4. Paste the entire contents into the SQL editor
5. Click **Run** (green button)
6. You should see: "Success. No rows returned"

Then create the storage bucket:
1. Click **Storage** in the left sidebar
2. Click **New bucket**
3. Name: `omnicraft-assets`
4. Toggle: Public = OFF
5. File size limit: 50 MB
6. Click **Save**

---

## STEP 5 — Set up environment variables

Create a file called `.env.local` in your project root:

```bash
touch .env.local
```

Open it and add:

```env
# Supabase (from Step 3 → Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Anthropic (console.anthropic.com → API Keys)
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini (aistudio.google.com → Get API Key)
GOOGLE_GENERATIVE_AI_API_KEY=AIza...

# Groq (console.groq.com → API Keys)
GROQ_API_KEY=gsk_...

# Admin (generate with: openssl rand -hex 32)
ADMIN_SECRET_KEY=your_64_char_random_string

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**You can start with just ANTHROPIC_API_KEY and the Supabase keys.**
Gemini and Groq activate later (file analysis features).

---

## STEP 6 — Run the dev server

```bash
npm run dev
```

Open: http://localhost:3000

You should see the OmniCraft portal — dark background, the welcome 
message fading in, input ready.

**Admin panel:** http://localhost:3000/admin

---

## STEP 7 — Verify it's working

Checklist:
- [ ] Portal loads and shows welcome message
- [ ] Typing a message and pressing Enter sends it
- [ ] A streaming response appears from Claude
- [ ] Mode indicator in the header updates (try typing "I need a brand identity")
- [ ] File upload button works (click the upload icon in input)
- [ ] Admin panel at /admin loads (enter any key with 10+ chars for now)
- [ ] Projects appear in the admin list after a chat session

---

## STEP 8 — Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow the prompts, then add environment variables:
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add ANTHROPIC_API_KEY
vercel env add ADMIN_SECRET_KEY
# ... add all vars from .env.local

# Production deploy
vercel --prod
```

---

## WHAT'S BUILT — Current State

### Working now:
- Full dark portal UI with Framer Motion animations
- Streaming AI chat (Claude 3.5 Sonnet)
- Agent mode detection (Creative / Engineering / Research)
- Mode indicator updates in real time
- File upload UI (ready for Supabase Storage wiring)
- Project creation on first message
- Message persistence to Supabase
- Admin panel with project list + conversation viewer

### Next iterations (already architected, ready to build):
1. **Gate phase** — contact info form triggered after synthesis
2. **File processing** — Gemini PDF/video analysis + Groq audio
3. **Roadmap generation** — structured AI output after discovery
4. **Admin push** — publish roadmap + quote to client dashboard
5. **Client dashboard** — persistent URL per session (`/p/[slug]`)
6. **Realtime** — Supabase Realtime for live admin monitoring

---

## TROUBLESHOOTING

**"Module not found" errors after install:**
```bash
rm -rf node_modules .next
npm install
npm run dev
```

**Supabase RLS blocking reads:**
Check that your API calls use the service role client 
(`createAdminClient`), not the anon client, in Route Handlers.

**TypeScript errors on Supabase types:**
The types in `src/types/index.ts` are hand-authored. If you want 
generated Supabase types, run:
```bash
npx supabase gen types typescript \
  --project-id your-project-ref \
  --schema public > src/types/supabase.ts
```

**Streaming not working on Vercel:**
Ensure `export const runtime = 'nodejs'` and `export const maxDuration = 60` 
are present in `src/app/api/chat/route.ts`. Edge runtime does not 
support the Anthropic SDK's streaming correctly.
