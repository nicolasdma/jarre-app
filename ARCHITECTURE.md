# Jarre — Architecture Guide

## Route Structure

| Route | Purpose |
|-------|---------|
| `/dashboard` | Main hub: stats, quick actions, review pending |
| `/resources/[id]` | Resource detail: sections, evaluations, progress |
| `/study/[resourceId]` | Full-screen PDF/resource viewer with canvas notes |
| `/learn/[resourceId]` | Guided learning flow: activate → read sections → practice → evaluate |
| `/evaluate/[resourceId]` | Standalone text evaluation (5 AI-generated questions) |
| `/evaluation/[resourceId]/[evalId]` | View past evaluation detail |
| `/review` | Spaced repetition session (FSRS-scheduled cards) |
| `/journal` | Reflective journaling |
| `/mi-sistema` | Personal knowledge system dashboard |

### `/study` vs `/learn`

- **`/study`** is a passive viewer — PDF + canvas side-by-side, no pedagogical flow.
- **`/learn`** is the active learning path — sections with pre-questions, inline quizzes, post-tests, and an evaluation step at the end.

## Voice System

Two hooks work together:

- **`use-voice-session.ts`** — Low-level Gemini Live WebSocket management. Handles audio capture (AudioWorklet PCM 16kHz), playback (PCM 24kHz), transcript saving, session end detection, and 3-layer reconnect resilience (resumption handle → buffer reconstruction → graceful failure).

- **`use-unified-voice-session.ts`** — High-level coordinator. Selects the right voice prompt module based on mode (`teaching`, `eval`, `practice`, `exploration`, `freeform`, `debate`), fetches learner memory, builds the system instruction, manages post-session scoring, and exposes a simplified API to `AppShell`.

The tutor appears as a sidebar on desktop (inside `AppShell`) and a floating mini-entity on mobile.

### Voice Prompt Language

Voice tutor prompts (`src/lib/llm/voice-unified-prompt.ts`, `voice-prompts.ts`) are currently written in **Rioplatense Spanish** (voseo). If you need to support another language, parameterize the prose sections with a language argument rather than duplicating prompt files.

## Data Flow

### Language Propagation

1. `RootLayout` reads `user_profiles.language` from Supabase (server-side)
2. Passes `language` prop to `AppShell` → all child components
3. Pages that need language fetch it independently from `user_profiles`
4. `t(key, language)` from `src/lib/translations.ts` handles all UI text

### TABLES Constant

All Supabase table names go through `src/lib/db/tables.ts`. Never hardcode `'table_name'` in `.from()` calls — use `TABLES.tableName` instead.

### Translations

`src/lib/translations.ts` is the single source of truth for all UI strings. Keys are namespaced (e.g., `eval.start`, `review.title`). No local translation objects in components.

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/db/tables.ts` | `TABLES` constant — all table names |
| `src/lib/api/middleware.ts` | `withAuth()` — auth + error handling for API routes |
| `src/lib/fsrs.ts` | FSRS scheduling engine |
| `src/lib/review-scoring.ts` | Score → ReviewRating conversion |
| `src/lib/mastery.ts` | Mastery level 0-4 advancement logic |
| `src/lib/learner-memory.ts` | Per-concept misconceptions/strengths |
| `src/lib/constants.ts` | All thresholds, limits, and config values |
| `src/lib/translations.ts` | Centralized UI translations (es/en) |
| `src/lib/llm/deepseek.ts` | DeepSeek API client with retry |
| `src/lib/llm/schemas.ts` | Zod schemas for LLM response validation |
| `src/lib/evaluate/save-results.ts` | Shared evaluation result persistence |
| `src/components/app-shell.tsx` | Root layout shell with tutor sidebar |
| `src/components/voice/use-voice-session.ts` | Low-level Gemini voice hook |
| `src/components/voice/use-unified-voice-session.ts` | High-level voice coordinator |
