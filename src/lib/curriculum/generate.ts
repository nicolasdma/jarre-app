/**
 * Jarre - Curriculum Generation
 *
 * Uses DeepSeek to generate a structured curriculum for a given topic.
 * The LLM produces phases with real, searchable resources (no URLs).
 */

import { callDeepSeek, parseJsonResponse } from '@/lib/llm/deepseek';
import { TOKEN_BUDGETS } from '@/lib/constants';
import { CurriculumResponseSchema, type CurriculumResponse } from './schemas';

interface GenerateCurriculumParams {
  topic: string;
  goal?: string;
  currentLevel: string;
  hoursPerWeek: number;
  language: string;
}

const SYSTEM_PROMPT = `You are an expert academic curriculum designer. You create structured learning paths comparable to MIT OCW, Stanford, CMU, and top-tier academic programs.

## Quality Hierarchy (STRICT)
1. University courses: MIT OCW, Stanford Online, CMU lectures, Harvard CS
2. Foundational papers: Original research papers that defined the field
3. Elite educators: 3Blue1Brown, Andrej Karpathy, Jay Alammar, StatQuest
4. Practical courses: fast.ai, DeepLearning.AI
5. High-quality tutorials and articles (only when no better option exists)

## Rules
- Each phase MUST build on the previous one (progressive difficulty)
- Resources MUST be REAL and SPECIFIC — use exact titles that can be found via search
- Mix resource types per phase: combine lectures + papers + articles
- searchQuery must be specific enough to find the EXACT resource on YouTube or Google
- expectedChannel must be the REAL channel/author name (or null for papers/books)
- Phases should cover: fundamentals → core theory → advanced topics → practical application
- Estimate hours realistically (a 1h lecture = ~2-3h with study time)
- NEVER invent fake resources. Only reference real, well-known materials.

## Output Format
Respond with a JSON object matching this structure:
{
  "title": "Curriculum title",
  "phases": [
    {
      "phaseNumber": 1,
      "title": "Phase title",
      "description": "What you'll learn and why it matters",
      "estimatedWeeks": 2,
      "resources": [
        {
          "title": "Exact resource title",
          "resourceType": "lecture" | "paper" | "book" | "course" | "article",
          "expectedChannel": "Channel or Author name" | null,
          "searchQuery": "specific search query to find this resource",
          "estimatedHours": 3
        }
      ]
    }
  ]
}`;

function buildUserPrompt(params: GenerateCurriculumParams): string {
  const levelMap: Record<string, string> = {
    beginner: 'I have no prior knowledge of this topic',
    intermediate: 'I have basic understanding and some practical experience',
    advanced: 'I have solid knowledge and want to go deeper into advanced topics',
  };

  const levelDesc = levelMap[params.currentLevel] || levelMap.beginner;

  let prompt = `Design a comprehensive curriculum for: "${params.topic}"

Current level: ${params.currentLevel} — ${levelDesc}
Available time: ${params.hoursPerWeek} hours per week`;

  if (params.goal) {
    prompt += `\nGoal: ${params.goal}`;
  }

  prompt += `\nLanguage for titles/descriptions: ${params.language === 'es' ? 'Spanish' : 'English'}`;
  prompt += `\n\nDesign 4-8 progressive phases with 2-5 resources each. Focus on the highest quality materials available.`;

  return prompt;
}

export async function generateCurriculum(
  params: GenerateCurriculumParams,
): Promise<{ curriculum: CurriculumResponse; tokensUsed: number }> {
  const { content, tokensUsed } = await callDeepSeek({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(params) },
    ],
    maxTokens: TOKEN_BUDGETS.CURRICULUM_GENERATE,
    temperature: 0.5,
    responseFormat: 'json',
    timeoutMs: 90_000,
    retryOnTimeout: true,
  });

  const curriculum = parseJsonResponse(content, CurriculumResponseSchema);

  return { curriculum, tokensUsed };
}
