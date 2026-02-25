import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { TABLES } from '@/lib/db/tables';
import { Header } from '@/components/header';
import { SectionLabel } from '@/components/ui/section-label';
import { PlanBanner } from '@/components/billing/plan-banner';
import { IS_MANAGED } from '@/lib/config';
import type { Language } from '@/lib/translations';
import { DashboardContent } from './dashboard-content';
import type { PipelineCourseData } from './pipeline-course-card';

export const metadata: Metadata = {
  title: 'Dashboard — Jarre',
  description: 'Your learning dashboard',
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let lang: Language = 'es';
  let sectionCounts: Record<string, number> = {};
  let evalStats: Record<string, { bestScore: number; evalCount: number }> = {};

  if (user) {
    // Fetch user profile (personal data — requires auth)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('language')
      .eq('id', user.id)
      .single();

    lang = (profile?.language || 'es') as Language;
  }

  // Fetch subscription status and token usage for billing banner
  let subscriptionStatus = 'free';
  let monthlyUsed = 0;
  if (user && IS_MANAGED) {
    const { data: billingProfile } = await supabase
      .from(TABLES.userProfiles)
      .select('subscription_status')
      .eq('id', user.id)
      .single();
    subscriptionStatus = billingProfile?.subscription_status || 'free';

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const { data: tokenRows } = await supabase
      .from(TABLES.tokenUsage)
      .select('tokens')
      .eq('user_id', user.id)
      .gte('created_at', monthStart.toISOString())
      .lt('created_at', monthEnd.toISOString());
    monthlyUsed = (tokenRows || []).reduce((sum, r) => sum + (r.tokens || 0), 0);
  }
  const monthlyLimit = subscriptionStatus === 'active' ? 500_000 : 50_000;

  // Fetch pipeline-generated resources (video/lecture types)
  const { data: resources } = await supabase
    .from('resources')
    .select('id, title, type, url, activate_data, created_at')
    .in('type', ['video', 'lecture']);

  const allResources = resources || [];
  const allResourceIds = allResources.map((r) => r.id);

  // Fetch section counts for all candidates
  if (allResourceIds.length > 0) {
    const { data: sections } = await supabase
      .from('resource_sections')
      .select('resource_id')
      .in('resource_id', allResourceIds);

    if (sections) {
      for (const s of sections) {
        sectionCounts[s.resource_id] = (sectionCounts[s.resource_id] || 0) + 1;
      }
    }
  }

  // Keep only resources with at least 1 section, shuffle, take max 9
  const withSections = allResources.filter((r) => (sectionCounts[r.id] || 0) > 0);
  for (let i = withSections.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [withSections[i], withSections[j]] = [withSections[j], withSections[i]];
  }
  const pipelineResources = withSections.slice(0, 6);
  const resourceIds = pipelineResources.map((r) => r.id);

  // Fetch evaluation stats per resource (personal — requires auth)
  if (user && resourceIds.length > 0) {
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

  // Fetch learn_progress for "continue where you left off"
  const progressMap: Record<string, { activeSection: number; completedSections: number[] }> = {};
  if (user && resourceIds.length > 0) {
    const { data: progressRows } = await supabase
      .from(TABLES.learnProgress)
      .select('resource_id, active_section, completed_sections')
      .eq('user_id', user.id)
      .in('resource_id', resourceIds);

    if (progressRows) {
      for (const p of progressRows) {
        progressMap[p.resource_id] = {
          activeSection: p.active_section ?? 1,
          completedSections: p.completed_sections ?? [],
        };
      }
    }
  }

  // Fetch user_resources to determine ownership
  const ownedResourceIds = new Set<string>();
  if (user && resourceIds.length > 0) {
    const { data: userResources } = await supabase
      .from(TABLES.userResources)
      .select('resource_id')
      .eq('user_id', user.id)
      .in('resource_id', resourceIds);

    if (userResources) {
      for (const ur of userResources) {
        ownedResourceIds.add(ur.resource_id);
      }
    }
  }

  // Build course data
  const courses: PipelineCourseData[] = pipelineResources.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    url: r.url,
    summary: (r.activate_data as { summary?: string } | null)?.summary ?? null,
    sectionCount: sectionCounts[r.id] || 0,
    createdAt: r.created_at,
    evalStats: evalStats[r.id] || null,
    isOwner: ownedResourceIds.has(r.id),
    progress: progressMap[r.id] || null,
  }));

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
            {lang === 'es' ? 'Aprende creando' : 'Learn by doing'}
          </SectionLabel>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-normal italic tracking-tight text-j-text mb-2 font-[family-name:var(--j-font-display)]">
            {lang === 'es' ? 'Un video. Tu curso.' : 'Any video. Your classroom.'}
          </h1>
          <p className="text-xl sm:text-2xl font-light text-j-text-tertiary">
            {lang === 'es' ? 'Viste 1,000 videos. ¿Cuánto aprendiste?' : "You've watched 1,000 videos. How much do you remember?"}
          </p>
          {IS_MANAGED && user && (
            <div className="mt-4">
              <PlanBanner status={subscriptionStatus} used={monthlyUsed} limit={monthlyLimit} />
            </div>
          )}
        </div>

        {/* Input + Stats + Course Grid */}
        <DashboardContent
          courses={courses}
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
