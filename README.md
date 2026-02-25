# Jarre

> Named after Jean-Michel Jarre — the orchestrator of sound.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
![Next.js 16](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)

Paste a YouTube link, get a full course. Jarre transforms videos into structured learning experiences with AI-generated content, evaluations, voice tutoring, and spaced repetition.

<!-- TODO: Add screenshot of dashboard + learn flow -->

## Why

Most "learn with AI" tools quiz you on surface-level recall. Jarre evaluates depth of reasoning — not whether you got the right answer, but whether you understand *why*.

It uses 10 specialized rubrics (not one generic prompt), each scoring 3 dimensions on a 0-6 scale. A rubric for comparing tradeoffs is fundamentally different from one that evaluates scenario diagnosis, so they should be different prompts.

## How it works

Paste a YouTube URL into the dashboard. A 6-stage pipeline extracts the transcript, segments it into sections, generates pedagogical content, maps video timestamps, identifies concepts, and writes everything to the database. Quizzes generate in the background — you can start reading immediately.

```
resolve → segment → content → [video_map ‖ concepts] → write_db → COMPLETED
                                                                    ↓ (background)
                                                               generate quizzes
```

## Features

**Learning flow (5 steps):**
1. **Activate** — pre-reading overview, concept map, exploratory voice chat
2. **Learn** — guided reading with inline quizzes, video embeds with clickable timestamps, LaTeX math rendering
3. **Apply** — practical scenarios + interactive playgrounds (18 available)
4. **Practice** — AI-generated questions + voice practice sessions
5. **Evaluate** — 5 generated questions, automatic scoring, mastery determination

**Voice tutor — 7 session modes:**

| Mode | What it does |
|------|-------------|
| eval | Oral exam disguised as conversation |
| practice | Guided practice with escalating hints |
| exploration | Connection-driven resource exploration |
| debate | Devil's advocate on technical topics |
| freeform | Open intellectual conversation |
| teach | You teach a confused junior (tests real understanding) |
| learning | Section-specific tutor while you read |

Real-time audio over WebSocket (Gemini). Supports interruptions, session resumption, live transcription, and tool calls (scroll to concept, show definition, end session).

**Evaluation — 10 specialized rubrics:**

Each question type gets its own rubric with 3 dimensions scored 0-2 (total 0-6). Knowledge, Comparison, Guarantee, Complexity, Scenario, Error Detection, Connection, Tradeoff, Design, Justification.

**Spaced repetition (FSRS):**
- 90% target retention, 180-day max interval
- Daily cap: 12 cards per session
- Interleaving: never two consecutive questions from the same concept

**Also:** knowledge graph (force-directed 3D), mastery levels (0-4: Exposed → Taught), XP system, streaks, learner memory (tracks misconceptions per concept), i18n (en/es).

## Tech stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16, React 19, TypeScript strict |
| Styling | Tailwind CSS v4 |
| DB & Auth | Supabase (PostgreSQL + RLS + Auth) |
| LLM | DeepSeek V3 (evaluations, content, pipeline) |
| Voice | Gemini 2.5 Flash (WebSocket, real-time audio) |
| Spaced repetition | ts-fsrs |
| Visualization | Three.js, react-force-graph-3d, Framer Motion |
| Math | KaTeX, remark-math, rehype-katex |
| Validation | Zod |
| Testing | Vitest |

## Get started

### Self-host (free, full control)

```bash
git clone https://github.com/nicolasdemaria/jarre.git
cd jarre
npm install
cp .env.example .env.local
# Fill in your API keys
npm run dev
```

See **[SELF_HOSTING.md](./SELF_HOSTING.md)** for the full setup guide (Supabase, API keys, production deployment).

### Hosted (managed)

Coming soon at [jarre.app](https://jarre.app) — bring your own API keys or subscribe for managed access.

## Project structure

```
jarre-app/
├── src/
│   ├── app/                    # Next.js pages & API routes (~50 routes)
│   │   ├── dashboard/          # Main entry point (YouTube input)
│   │   ├── learn/[resourceId]/ # 5-step learning flow
│   │   ├── evaluate/           # Evaluation flow
│   │   ├── review/             # Spaced repetition
│   │   └── api/                # API routes
│   ├── components/             # React components (~78)
│   │   ├── voice/              # Voice session UI
│   │   ├── concept-visuals/    # Interactive visualizations
│   │   └── ui/                 # Base UI (shadcn)
│   ├── lib/                    # Utilities (supabase, llm, fsrs, constants)
│   └── types/                  # TypeScript types
├── engine/                     # Storage engine (~3.9K lines)
├── supabase/
│   └── migrations/             # 1 migration, 41 tables
└── README.md
```

## Numbers

~42K lines of TypeScript. 41 tables. 1 contributor.

## License

[AGPL-3.0](./LICENSE)
