/**
 * GET /api/voice/freeform/context
 *
 * Returns the full context for a freeform voice session:
 * - All concept progress (with names and phases)
 * - Recent consumption_log entries
 * - All learner memory
 * - Aggregated open questions
 */

import { withAuth } from '@/lib/api/middleware';
import { jsonOk } from '@/lib/api/errors';
import { TABLES } from '@/lib/db/tables';
import { createLogger } from '@/lib/logger';

const log = createLogger('FreeformContext');

export const GET = withAuth(async (_request, { supabase, user }) => {
  // Fetch all in parallel
  const [progressResult, activityResult, memoryResult, conceptsResult] = await Promise.all([
    // Concept progress
    supabase
      .from(TABLES.conceptProgress)
      .select('concept_id, level')
      .eq('user_id', user.id),

    // Recent activity (last 10)
    supabase
      .from(TABLES.consumptionLog)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10),

    // All learner memory
    supabase
      .from(TABLES.learnerConceptMemory)
      .select('concept_id, misconceptions, strengths, escalation_level, analogies, open_questions, personal_examples, connections_made')
      .eq('user_id', user.id),

    // All concepts (for name lookup)
    supabase
      .from(TABLES.concepts)
      .select('id, name, phase'),
  ]);

  // Build concept name/phase map
  const conceptMap = (conceptsResult.data || []).reduce((acc: Record<string, { name: string; phase: number }>, c: { id: string; name: string; phase: number }) => {
    acc[c.id] = { name: c.name, phase: parseInt(String(c.phase)) || 0 };
    return acc;
  }, {} as Record<string, { name: string; phase: number }>);

  // Build concept progress with names
  const conceptProgress = (progressResult.data || []).map((p: { concept_id: string; level: string }) => ({
    conceptId: p.concept_id,
    conceptName: conceptMap[p.concept_id]?.name || p.concept_id,
    level: parseInt(p.level) || 0,
    phase: conceptMap[p.concept_id]?.phase || 0,
  }));

  // Build recent activity
  // Fetch resource/user_resource titles for activity entries
  const activityEntries = activityResult.data || [];
  const resourceIds = activityEntries.filter((e: { resource_id?: string }) => e.resource_id).map((e: { resource_id?: string }) => e.resource_id);
  const userResourceIds = activityEntries.filter((e: { user_resource_id?: string }) => e.user_resource_id).map((e: { user_resource_id?: string }) => e.user_resource_id);

  let resourceNames: Record<string, string> = {};
  let userResourceNames: Record<string, { title: string; type: string }> = {};

  if (resourceIds.length > 0) {
    const { data } = await supabase.from(TABLES.resources).select('id, title').in('id', resourceIds);
    resourceNames = (data || []).reduce((acc: Record<string, string>, r: { id: string; title: string }) => { acc[r.id] = r.title; return acc; }, {} as Record<string, string>);
  }
  if (userResourceIds.length > 0) {
    const { data } = await supabase.from(TABLES.userResources).select('id, title, type').in('id', userResourceIds);
    userResourceNames = (data || []).reduce((acc: Record<string, { title: string; type: string }>, r: { id: string; title: string; type: string }) => { acc[r.id] = { title: r.title, type: r.type }; return acc; }, {} as Record<string, { title: string; type: string }>);
  }

  const recentActivity = activityEntries.map((e: { resource_id?: string; user_resource_id?: string; event_type: string; concepts_touched?: string[]; created_at: string }) => {
    const title = e.resource_id
      ? resourceNames[e.resource_id] || 'Unknown'
      : e.user_resource_id
        ? userResourceNames[e.user_resource_id]?.title || 'Unknown'
        : 'Activity';
    const type = e.user_resource_id
      ? userResourceNames[e.user_resource_id]?.type || e.event_type
      : e.event_type;
    const concepts = (e.concepts_touched || [])
      .map((id: string) => conceptMap[id]?.name || id)
      .filter(Boolean);

    return {
      title,
      type,
      date: new Date(e.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      concepts,
    };
  });

  // Build learner memory
  const learnerMemory = (memoryResult.data || []).map((m: { concept_id: string; misconceptions: unknown; strengths: unknown; escalation_level: string; analogies: unknown; open_questions: unknown; personal_examples: unknown; connections_made: unknown }) => ({
    conceptId: m.concept_id,
    misconceptions: Array.isArray(m.misconceptions) ? m.misconceptions : [],
    strengths: Array.isArray(m.strengths) ? m.strengths : [],
    escalationLevel: m.escalation_level || 'pump',
    analogies: Array.isArray(m.analogies) ? m.analogies : [],
    openQuestions: Array.isArray(m.open_questions) ? m.open_questions : [],
    personalExamples: Array.isArray(m.personal_examples) ? m.personal_examples : [],
    connectionsMade: Array.isArray(m.connections_made) ? m.connections_made : [],
  }));

  // Aggregate open questions
  const openQuestions = learnerMemory
    .flatMap((m: { openQuestions: string[] }) => (m.openQuestions || []).map((q: string) => q))
    .filter((q: string) => q.length > 0);

  log.info(`Freeform context: ${conceptProgress.length} concepts, ${recentActivity.length} recent, ${learnerMemory.length} memories, ${openQuestions.length} open questions`);

  return jsonOk({
    conceptProgress,
    recentActivity,
    learnerMemory,
    openQuestions,
  });
});
