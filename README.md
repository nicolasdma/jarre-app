# Jarre

> Named after Jean-Michel Jarre - the orchestrator of sound.
> This system orchestrates deep learning.

A personal learning system for mastering complex technical knowledge. Not flashcards. Not memorization. **Deep comprehension validation.**

## What is this?

Jarre helps you truly understand papers, books, and courses by:

1. **Mapping knowledge** - Before reading, see what concepts you'll learn and what prerequisites you need
2. **Validating understanding** - After reading, AI generates hard questions to test real comprehension
3. **Tracking mastery** - See your progress across concepts, identify gaps, get recommendations
4. **Connecting practice** - Each phase has projects that force you to apply what you learned

## Mastery Levels

| Level | Name | Criteria |
|-------|------|----------|
| 0 | Exposed | Read/watched the material |
| 1 | Understood | Can explain without notes |
| 2 | Applied | Used in a project/exercise |
| 3 | Criticized | Can say when NOT to use it and why |
| 4 | Taught | Can explain to others and answer questions |

## Tech Stack

- **Frontend**: Next.js 16 (App Router), Tailwind CSS, shadcn/ui
- **Auth + DB**: Supabase (Auth + Postgres + RLS)
- **LLM**: DeepSeek V3 (primary), Kimi K2 (fallback)
- **Voice**: Gemini Live (WebSocket, real-time audio)
- **Hosting**: Vercel

## Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your keys

# Run development server
npm run dev

# Open http://localhost:3000
```

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
SUPABASE_SECRET_KEY=your_secret_key

# LLM APIs
DEEPSEEK_API_KEY=your_key
KIMI_API_KEY=your_key (optional fallback)
GEMINI_API_KEY=your_key (required for voice)
DEEPL_API_KEY=your_key (optional, for translation)
```

## Project Structure

```
jarre/
├── src/
│   ├── app/                    # Next.js pages & API routes
│   │   ├── study/[resourceId]/ # PDF reader + canvas notes
│   │   ├── learn/[resourceId]/ # Deep learning flow (sections, quizzes, eval)
│   │   ├── resources/[id]/     # Resource detail (metadata, voice launcher)
│   │   ├── evaluate/           # Evaluation flow
│   │   ├── review/             # Spaced repetition review
│   │   └── api/                # API routes
│   ├── components/             # React components
│   │   ├── ui/                 # Base UI (shadcn)
│   │   ├── contexts/           # React context providers
│   │   ├── voice/              # Voice session components
│   │   └── ...                 # Feature components
│   ├── data/                   # Static curriculum & resource data (TSX)
│   ├── lib/                    # Utilities (supabase, llm, fsrs, etc.)
│   └── types/                  # TypeScript types
├── supabase/
│   └── migrations/             # Database migrations
└── README.md                   # This file
```

## License

MIT
