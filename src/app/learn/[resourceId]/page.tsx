import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { GenericActivate } from '@/components/generic-activate';
import { LearnFlow } from '@/components/learn-flow';
import { FIGURE_REGISTRY } from '@/lib/figure-registry';
import {
  getTranslatedSections,
  getTranslatedActivateData,
  getTranslatedQuizzes,
} from '@/lib/translation/translate-service';
import type { ActivateData } from '@/lib/pipeline/types';
import { TABLES } from '@/lib/db/tables';
import type { Language } from '@/lib/translations';
import type { LearnProgress } from '@/lib/learn-progress';
import type { InlineQuiz, VideoSegment } from '@/types';

export async function generateMetadata({ params }: { params: Promise<{ resourceId: string }> }): Promise<Metadata> {
  const { resourceId } = await params;
  return {
    title: `Learn ${resourceId} — Jarre`,
    description: 'Interactive learning content with sections and exercises',
  };
}

interface PageProps {
  params: Promise<{ resourceId: string }>;
}

export default async function LearnPage({ params }: PageProps) {
  const { resourceId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/learn/${resourceId}`);
  }

  // Get resource + user language + resource sections + learn progress + concepts in parallel
  const [resourceResult, profileResult, sectionsResult, progressResult, conceptsResult] = await Promise.all([
    supabase.from(TABLES.resources).select('*').eq('id', resourceId).single(),
    supabase.from(TABLES.userProfiles).select('language').eq('id', user.id).single(),
    supabase
      .from(TABLES.resourceSections)
      .select('id, resource_id, concept_id, section_title, content_markdown, sort_order')
      .eq('resource_id', resourceId)
      .order('sort_order', { ascending: true }),
    supabase
      .from(TABLES.learnProgress)
      .select('current_step, active_section, completed_sections, section_state, review_state')
      .eq('user_id', user.id)
      .eq('resource_id', resourceId)
      .maybeSingle(),
    supabase
      .from(TABLES.resourceConcepts)
      .select('concept_id, is_prerequisite, concepts (id, name, canonical_definition)')
      .eq('resource_id', resourceId),
  ]);

  const resource = resourceResult.data;
  const language = (profileResult.data?.language || 'es') as Language;
  const sections = sectionsResult.data || [];

  // Extract concepts taught (not prerequisites) for evaluation
  // Supabase returns `concepts` as an array from the join; we take the first element
  const conceptsTaught = (conceptsResult.data || [])
    .filter((rc: { is_prerequisite: boolean }) => !rc.is_prerequisite)
    .map((rc: { concepts: { id: string; name: string; canonical_definition: string }[] }) =>
      Array.isArray(rc.concepts) ? rc.concepts[0] : rc.concepts
    )
    .filter(Boolean) as { id: string; name: string; canonical_definition: string }[];

  const initialProgress: LearnProgress | undefined = progressResult.data
    ? {
        currentStep: progressResult.data.current_step as LearnProgress['currentStep'],
        activeSection: progressResult.data.active_section,
        completedSections: progressResult.data.completed_sections ?? [],
        sectionState: (progressResult.data.section_state as LearnProgress['sectionState']) ?? {},
        reviewState: (progressResult.data.review_state as LearnProgress['reviewState']) ?? undefined,
      }
    : undefined;

  if (!resource) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-j-bg">
        <p className="text-j-warm">Recurso no encontrado</p>
      </div>
    );
  }

  if (sections.length > 0) {
    const resourceLang = (resource.language as string) || language;
    const needsTranslation = resourceLang !== language;

    const sectionIds = sections.map((s) => s.id);
    const defaultSections = sections.map((s) => ({
      id: s.id,
      conceptId: s.concept_id,
      sectionTitle: s.section_title,
      contentMarkdown: s.content_markdown,
      sortOrder: s.sort_order,
    }));

    // Fetch quizzes, video segments, and run translations — all in parallel
    const [quizzesResult, videoSegmentsResult, flowSections, translatedActivateData] = await Promise.all([
      supabase
        .from('inline_quizzes')
        .select('*')
        .in('section_id', sectionIds)
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('video_segments')
        .select('*')
        .in('section_id', sectionIds)
        .order('sort_order'),
      needsTranslation
        ? getTranslatedSections(resourceId, resourceLang, language, user.id)
        : Promise.resolve(defaultSections),
      needsTranslation
        ? getTranslatedActivateData(resourceId, resource.activate_data as ActivateData | null, resourceLang, language, user.id)
        : Promise.resolve(resource.activate_data ? { data: resource.activate_data as ActivateData, pendingTranslation: false } : null),
    ]);

    const quizzesRaw = quizzesResult.data;
    const videoSegmentsRaw = videoSegmentsResult.data;

    // Translate quizzes (needs quizzesRaw, so runs after the parallel batch)
    const quizTranslationResult = needsTranslation && quizzesRaw && quizzesRaw.length > 0
      ? await getTranslatedQuizzes(
          quizzesRaw.map((q) => ({
            id: q.id,
            section_id: q.section_id,
            question_text: q.question_text,
            options: q.options,
            explanation: q.explanation,
            justification_hint: q.justification_hint,
          })),
          resourceLang,
          language,
          user.id,
        )
      : null;
    const translatedQuizMap = quizTranslationResult?.translations ?? null;
    const pendingQuizIds = quizTranslationResult?.pendingIds ?? new Set<string>();

    // Group quizzes by section_id
    const quizzesBySectionId: Record<string, InlineQuiz[]> = {};
    if (quizzesRaw) {
      for (const q of quizzesRaw) {
        const translated = translatedQuizMap?.get(q.id);
        const quiz: InlineQuiz = {
          id: q.id,
          sectionId: q.section_id,
          positionAfterHeading: q.position_after_heading,
          sortOrder: q.sort_order,
          format: q.format,
          questionText: translated?.questionText ?? q.question_text,
          options: translated?.options ?? q.options,
          correctAnswer: q.correct_answer,
          explanation: translated?.explanation ?? q.explanation,
          justificationHint: translated?.justificationHint ?? q.justification_hint ?? undefined,
          ...(pendingQuizIds.has(q.id) ? { pendingTranslation: true } : {}),
        };
        const arr = quizzesBySectionId[q.section_id] ?? [];
        arr.push(quiz);
        quizzesBySectionId[q.section_id] = arr;
      }
    }

    // Group video segments by section_id
    const videoSegmentsBySectionId: Record<string, VideoSegment[]> = {};
    if (videoSegmentsRaw) {
      for (const vs of videoSegmentsRaw) {
        const segment: VideoSegment = {
          id: vs.id,
          sectionId: vs.section_id,
          positionAfterHeading: vs.position_after_heading,
          sortOrder: vs.sort_order,
          youtubeVideoId: vs.youtube_video_id,
          startSeconds: vs.start_seconds,
          endSeconds: vs.end_seconds,
          label: vs.label ?? null,
        };
        const arr = videoSegmentsBySectionId[vs.section_id] ?? [];
        arr.push(segment);
        videoSegmentsBySectionId[vs.section_id] = arr;
      }
    }

    return (
      <LearnFlow
        language={language}
        resourceId={resourceId}
        resourceTitle={resource.title}
        resourceType={resource.type}
        sections={flowSections}
        activateComponent={translatedActivateData ? <GenericActivate data={translatedActivateData.data} title={resource.title} pendingTranslation={translatedActivateData.pendingTranslation} /> : undefined}
        concepts={conceptsTaught}
        userId={user.id}
        initialProgress={initialProgress}
        figureRegistry={FIGURE_REGISTRY}
        quizzesBySectionId={quizzesBySectionId}
        videoSegmentsBySectionId={videoSegmentsBySectionId}
      />
    );
  }

  // No sections in DB — resource not yet processed
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-j-bg p-8">
      <p className="mb-4 text-j-text-secondary">Contenido no disponible aún para este recurso.</p>
      <Link href="/dashboard" className="text-j-accent hover:underline">
        ← Volver al dashboard
      </Link>
    </div>
  );
}
