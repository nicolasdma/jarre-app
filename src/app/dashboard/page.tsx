import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { TABLES } from '@/lib/db/tables';
import { Header } from '@/components/header';
import { SectionLabel } from '@/components/ui/section-label';
import type { Language } from '@/lib/translations';
import { DashboardContent } from './dashboard-content';
import type { PipelineCourseData } from './pipeline-course-card';

export interface CurriculumSummary {
  id: string;
  title: string;
  topic: string;
  status: string;
  createdAt: string;
  phaseCount: number;
  resourceCount: number;
  materializedCount: number;
}

export const metadata: Metadata = {
  title: 'Dashboard — Jarre',
  description: 'Your learning dashboard',
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Fetch user profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('language, streak_days, total_xp, xp_level')
    .eq('id', user.id)
    .single();

  const lang = (profile?.language || 'es') as Language;
  const streakDays = profile?.streak_days ?? 0;
  const totalXp = profile?.total_xp ?? 0;
  const xpLevel = profile?.xp_level ?? 1;

  // Fetch pipeline resources created by this user
  const { data: resources } = await supabase
    .from('resources')
    .select('id, title, type, url, activate_data, created_at')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false });

  const pipelineResources = resources || [];

  // Fetch section counts per resource
  const resourceIds = pipelineResources.map((r) => r.id);
  let sectionCounts: Record<string, number> = {};

  if (resourceIds.length > 0) {
    const { data: sections } = await supabase
      .from('resource_sections')
      .select('resource_id')
      .in('resource_id', resourceIds);

    if (sections) {
      for (const s of sections) {
        sectionCounts[s.resource_id] = (sectionCounts[s.resource_id] || 0) + 1;
      }
    }
  }

  // Fetch evaluation stats per resource
  type EvalStats = { bestScore: number; evalCount: number };
  let evalStats: Record<string, EvalStats> = {};

  if (resourceIds.length > 0) {
    const { data: evaluations } = await supabase
      .from('evaluations')
      .select('resource_id, overall_score')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .in('resource_id', resourceIds);

    if (evaluations) {
      const byResource: Record<string, number[]> = {};
      for (const e of evaluations) {
        if (!byResource[e.resource_id]) byResource[e.resource_id] = [];
        byResource[e.resource_id].push(e.overall_score);
      }

      for (const [resourceId, scores] of Object.entries(byResource)) {
        evalStats[resourceId] = {
          bestScore: Math.max(...scores),
          evalCount: scores.length,
        };
      }
    }
  }

  // Build course data for client component
  const courses: PipelineCourseData[] = pipelineResources.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    url: r.url,
    summary: (r.activate_data as { summary?: string } | null)?.summary ?? null,
    sectionCount: sectionCounts[r.id] || 0,
    createdAt: r.created_at,
    evalStats: evalStats[r.id] || null,
  }));

  // Fetch user's curricula
  const { data: rawCurricula } = await supabase
    .from(TABLES.curricula)
    .select('id, title, topic, status, created_at')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  let curricula: CurriculumSummary[] = [];

  if (rawCurricula && rawCurricula.length > 0) {
    const curriculumIds = rawCurricula.map((c) => c.id);

    // Fetch phase counts
    const { data: phases } = await supabase
      .from(TABLES.curriculumPhases)
      .select('curriculum_id')
      .in('curriculum_id', curriculumIds);

    const phaseCounts: Record<string, number> = {};
    for (const p of phases || []) {
      phaseCounts[p.curriculum_id] = (phaseCounts[p.curriculum_id] || 0) + 1;
    }

    // Fetch resource counts + materialized counts
    const { data: curResources } = await supabase
      .from(TABLES.curriculumResources)
      .select('curriculum_id, status')
      .in('curriculum_id', curriculumIds);

    const resourceCounts: Record<string, number> = {};
    const materializedCounts: Record<string, number> = {};
    for (const r of curResources || []) {
      resourceCounts[r.curriculum_id] = (resourceCounts[r.curriculum_id] || 0) + 1;
      if (r.status === 'materialized') {
        materializedCounts[r.curriculum_id] = (materializedCounts[r.curriculum_id] || 0) + 1;
      }
    }

    curricula = rawCurricula.map((c) => ({
      id: c.id,
      title: c.title,
      topic: c.topic,
      status: c.status,
      createdAt: c.created_at,
      phaseCount: phaseCounts[c.id] || 0,
      resourceCount: resourceCounts[c.id] || 0,
      materializedCount: materializedCounts[c.id] || 0,
    }));
  }

  // Compute compact stats
  const totalCourses = courses.length;
  const totalSections = Object.values(sectionCounts).reduce((a, b) => a + b, 0);
  const evaluatedCount = Object.keys(evalStats).length;
  const avgScore = evaluatedCount > 0
    ? Math.round(
        Object.values(evalStats).reduce((sum, e) => sum + e.bestScore, 0) / evaluatedCount
      )
    : 0;

  return (
    <div className="min-h-screen bg-j-bg j-bg-texture">
      <Header currentPage="library" />

      <main className="mx-auto max-w-6xl px-4 sm:px-8 pt-16 sm:pt-24 pb-12 sm:pb-16 j-grid-bg j-hero-gradient">
        {/* Hero Section */}
        <div className="mb-12">
          <SectionLabel>
            {lang === 'es' ? 'Dashboard' : 'Dashboard'}
          </SectionLabel>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-normal italic tracking-tight text-j-text mb-2 font-[family-name:var(--j-font-display)]">
            {lang === 'es' ? 'Aprende' : 'Learn'}
          </h1>
          <p className="text-xl sm:text-2xl font-light text-j-text-tertiary">
            {lang === 'es' ? 'desde cualquier video de YouTube' : 'from any YouTube video'}
          </p>
        </div>

        {/* Input + Stats + Course Grid */}
        <DashboardContent
          courses={courses}
          curricula={curricula}
          language={lang}
          stats={{ totalCourses, totalSections, evaluatedCount, avgScore }}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-j-border py-8 mt-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-8">
          <p className="font-mono text-[10px] tracking-[0.2em] text-j-text-tertiary uppercase text-center">
            Jarre · {lang === 'es' ? 'Conocimiento Profundo' : 'Deep Knowledge'} · {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
