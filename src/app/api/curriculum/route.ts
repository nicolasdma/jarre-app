/**
 * POST /api/curriculum
 *
 * Generate a new AI-designed curriculum.
 * Body: { topic: string, goal?: string, currentLevel: string, hoursPerWeek: number }
 * Returns: { curriculumId: string }
 *
 * Synchronous — waits for LLM response (~15-30s).
 */

import { withAuth } from '@/lib/api/middleware';
import { badRequest, jsonOk } from '@/lib/api/errors';
import { TABLES } from '@/lib/db/tables';
import { generateCurriculum } from '@/lib/curriculum/generate';
import { getUserLanguage } from '@/lib/db/queries/user';
import { logTokenUsage } from '@/lib/db/token-usage';

const VALID_LEVELS = ['beginner', 'intermediate', 'advanced'];

export const POST = withAuth(async (request, { supabase, user }) => {
  const body = await request.json();
  const { topic, goal, currentLevel, hoursPerWeek } = body as {
    topic?: string;
    goal?: string;
    currentLevel?: string;
    hoursPerWeek?: number;
  };

  if (!topic || typeof topic !== 'string' || topic.trim().length < 3) {
    throw badRequest('Topic is required (min 3 characters)');
  }

  if (!currentLevel || !VALID_LEVELS.includes(currentLevel)) {
    throw badRequest(`currentLevel must be one of: ${VALID_LEVELS.join(', ')}`);
  }

  const hours = Number(hoursPerWeek);
  if (!hours || hours < 1 || hours > 40) {
    throw badRequest('hoursPerWeek must be between 1 and 40');
  }

  const language = await getUserLanguage(supabase, user.id);

  // Generate curriculum via LLM (synchronous, ~15-30s)
  const { curriculum, tokensUsed } = await generateCurriculum({
    topic: topic.trim(),
    goal: goal?.trim(),
    currentLevel,
    hoursPerWeek: hours,
    language,
  });

  // Insert curriculum
  const { data: curriculumRow, error: currError } = await supabase
    .from(TABLES.curricula)
    .insert({
      user_id: user.id,
      title: curriculum.title,
      topic: topic.trim(),
      goal: goal?.trim() || null,
      current_level: currentLevel,
      hours_per_week: hours,
      llm_response: curriculum,
      tokens_used: tokensUsed,
    })
    .select('id')
    .single();

  if (currError) {
    throw new Error(`Failed to create curriculum: ${currError.message}`);
  }

  const curriculumId = curriculumRow.id;

  // Insert phases
  for (const phase of curriculum.phases) {
    const { data: phaseRow, error: phaseError } = await supabase
      .from(TABLES.curriculumPhases)
      .insert({
        curriculum_id: curriculumId,
        phase_number: phase.phaseNumber,
        title: phase.title,
        description: phase.description,
        estimated_weeks: phase.estimatedWeeks,
        sort_order: phase.phaseNumber,
      })
      .select('id')
      .single();

    if (phaseError) {
      throw new Error(`Failed to create phase ${phase.phaseNumber}: ${phaseError.message}`);
    }

    // Insert resources for this phase
    const resourceRows = phase.resources.map((r, idx) => ({
      phase_id: phaseRow.id,
      curriculum_id: curriculumId,
      title: r.title,
      resource_type: r.resourceType,
      expected_channel: r.expectedChannel,
      search_query: r.searchQuery,
      estimated_hours: r.estimatedHours,
      sort_order: idx,
    }));

    const { error: resError } = await supabase
      .from(TABLES.curriculumResources)
      .insert(resourceRows);

    if (resError) {
      throw new Error(`Failed to create resources for phase ${phase.phaseNumber}: ${resError.message}`);
    }
  }

  // Log token usage (fire-and-forget)
  logTokenUsage({
    userId: user.id,
    category: 'curriculum-generate',
    tokens: tokensUsed,
  }).catch(() => {});

  return jsonOk({ curriculumId });
});
