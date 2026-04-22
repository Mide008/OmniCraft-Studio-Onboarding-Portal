import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import ClientDashboard from '@/components/portal/ClientDashboard'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  return {
    title:       'Your Project Roadmap — OmniCraft',
    description: 'Your personalised project roadmap from OmniCraft Studios.',
    robots:      { index: false, follow: false },
    openGraph: {
      title:       'Your OmniCraft Studios Roadmap',
      description: 'Research-led project blueprint and quote.',
      url:         `${process.env.NEXT_PUBLIC_APP_URL}/p/${slug}`,
    },
  }
}

async function getProject(slug: string) {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('projects')
    .select(`
      id, slug, title, phase, status, summary, created_at,
      clients  ( name, email, company ),
      messages ( id, role, content, created_at ),
      roadmaps ( ai_draft, final_scope, deliverables, timeline_weeks, admin_notes, published_at ),
      quotes   ( amount, currency, breakdown, valid_until, published_at )
    `)
    .eq('slug', slug)
    .single()

  if (error || !data) return null
  return data
}

export default async function ProjectPage({ params }: PageProps) {
  const { slug }  = await params
  const project   = await getProject(slug)

  if (!project) notFound()

  return <ClientDashboard project={project as never} />
}
