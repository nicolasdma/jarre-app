/**
 * Curriculum Detail Page (Server Component)
 *
 * Fetches the curriculum with all phases and resources,
 * then renders the client-side accordion view.
 */

import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { TABLES } from '@/lib/db/tables';
import { Header } from '@/components/header';
import type { Language } from '@/lib/translations';
import { CurriculumView, type CurriculumPhaseData } from './curriculum-view';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CurriculumPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Fetch curriculum
  const { data: curriculum, error: currErr } = await supabase
    .from(TABLES.curricula)
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (currErr || !curriculum) notFound();

  // Fetch user language
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('language')
    .eq('id', user.id)
    .single();

  const lang = (profile?.language || 'es') as Language;

  // Fetch phases with resources
  const { data: phases } = await supabase
    .from(TABLES.curriculumPhases)
    .select('*')
    .eq('curriculum_id', id)
    .order('sort_order', { ascending: true });

  const { data: resources } = await supabase
    .from(TABLES.curriculumResources)
    .select('*')
    .eq('curriculum_id', id)
    .order('sort_order', { ascending: true });

  // Build phase data with nested resources
  const phaseData: CurriculumPhaseData[] = (phases || []).map((phase) => ({
    id: phase.id,
    phaseNumber: phase.phase_number,
    title: phase.title,
    description: phase.description,
    estimatedWeeks: phase.estimated_weeks,
    resources: (resources || [])
      .filter((r) => r.phase_id === phase.id)
      .map((r) => ({
        id: r.id,
        title: r.title,
        resourceType: r.resource_type,
        expectedChannel: r.expected_channel,
        searchQuery: r.search_query,
        estimatedHours: r.estimated_hours,
        status: r.status as 'pending' | 'processing' | 'materialized' | 'failed',
        resourceId: r.resource_id,
        pipelineJobId: r.pipeline_job_id,
        youtubeUrl: r.youtube_url,
      })),
  }));

  const isEs = lang === 'es';

  return (
    <div className="min-h-screen bg-j-bg j-bg-texture">
      <Header currentPage="library" />

      <main className="mx-auto max-w-4xl px-4 sm:px-8 pt-16 sm:pt-24 pb-12 sm:pb-16">
        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.15em] text-j-text-tertiary hover:text-j-text transition-colors mb-8"
        >
          <ArrowLeft size={14} />
          {isEs ? 'Dashboard' : 'Dashboard'}
        </Link>

        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-light text-j-text mb-2">
            {curriculum.title}
          </h1>
          <p className="text-sm text-j-text-tertiary">
            {curriculum.topic}
            {curriculum.goal && ` — ${curriculum.goal}`}
          </p>
          <div className="flex gap-4 mt-3 font-mono text-[10px] text-j-text-tertiary">
            <span>{phaseData.length} {isEs ? 'fases' : 'phases'}</span>
            <span>
              {phaseData.reduce((sum, p) => sum + p.resources.length, 0)} {isEs ? 'recursos' : 'resources'}
            </span>
            <span>{curriculum.current_level}</span>
            <span>{curriculum.hours_per_week}h/{isEs ? 'semana' : 'week'}</span>
          </div>
        </div>

        {/* Accordion View */}
        <CurriculumView
          curriculumId={id}
          phases={phaseData}
          language={lang}
        />
      </main>
    </div>
  );
}
