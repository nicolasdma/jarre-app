/**
 * Jarre - Curriculum Zod Schemas
 *
 * Validates the LLM response when generating a curriculum.
 * Ensures structure, types, and reasonable bounds.
 */

import { z } from 'zod';

export const CurriculumResourceSchema = z.object({
  title: z.string().min(5),
  resourceType: z.enum(['lecture', 'paper', 'book', 'course', 'article']),
  expectedChannel: z.string().nullable(),
  searchQuery: z.string().min(10),
  estimatedHours: z.number().min(0.5).max(50),
});

export const CurriculumPhaseSchema = z.object({
  phaseNumber: z.number().int().min(1),
  title: z.string().min(3),
  description: z.string().min(10),
  estimatedWeeks: z.number().min(0.5).max(12),
  resources: z.array(CurriculumResourceSchema).min(2).max(6),
});

export const CurriculumResponseSchema = z.object({
  title: z.string().min(5),
  phases: z.array(CurriculumPhaseSchema).min(3).max(10),
});

export type CurriculumResource = z.infer<typeof CurriculumResourceSchema>;
export type CurriculumPhase = z.infer<typeof CurriculumPhaseSchema>;
export type CurriculumResponse = z.infer<typeof CurriculumResponseSchema>;
