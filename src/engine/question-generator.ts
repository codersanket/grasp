import type { LLMAdapter } from "../llm/adapter.js";
import type { Chunk } from "../storage/queries.js";

export interface GeneratedQuestion {
  question: string;
  type: "design_decision" | "edge_case" | "trade_off" | "walkthrough" | "debugging";
  expected_insight: string;
  chunk_id?: string;
}

const SYSTEM_PROMPT = `You are Grasp, a code comprehension assistant. Your job is to generate questions that verify whether a developer truly understands the code they just received from an AI.

Rules:
1. Ask about DESIGN DECISIONS — why this approach and not another
2. Ask about TRADE-OFFS — what are the consequences of this choice
3. Ask about EDGE CASES — what could go wrong, what inputs would break it
4. Ask about DEBUGGING — if this breaks in production, how would they diagnose it
5. NEVER ask trivia or syntax questions
6. NEVER ask about things obvious from reading the code
7. Questions should be things someone would ask in a code review or incident
8. Frame questions conversationally — not like a test, like a colleague checking understanding
9. Adapt difficulty to familiarity: low familiarity = fundamental "why" questions, high familiarity = nuanced trade-off questions

Output EXACTLY as JSON array. Each element has: question (string), type (one of: design_decision, edge_case, trade_off, walkthrough, debugging), expected_insight (what a good answer would include).`;

export async function generateQuestions(
  llm: LLMAdapter,
  chunks: Chunk[],
  context: { intent: string; familiarity: number }
): Promise<GeneratedQuestion[]> {
  if (chunks.length === 0) return [];

  // Determine question count based on familiarity
  const questionCount = context.familiarity > 70 ? 1 : context.familiarity > 40 ? 2 : 3;

  const codeContext = chunks
    .map((chunk, i) => {
      const header = chunk.file_path ? `File: ${chunk.file_path}` : `Chunk ${i + 1}`;
      return `--- ${header} ---\n${chunk.code}\n\nExplanation: ${chunk.explanation}`;
    })
    .join("\n\n");

  const prompt = `The developer asked: "${context.intent}"

The AI generated this code:

${codeContext}

Developer's familiarity with these files: ${context.familiarity}/100 (${context.familiarity > 70 ? "high" : context.familiarity > 40 ? "moderate" : "low"})

Generate exactly ${questionCount} comprehension question(s). Return ONLY a JSON array, no other text.`;

  try {
    const response = await llm.generate(prompt, {
      system: SYSTEM_PROMPT,
      maxTokens: 1024,
    });

    const questions = parseQuestions(response.text, chunks);
    return questions.slice(0, questionCount);
  } catch (error) {
    // If LLM fails, fall back to heuristic questions
    console.error("LLM question generation failed, using fallback:", error);
    return generateFallbackQuestions(chunks, context.familiarity);
  }
}

function parseQuestions(text: string, chunks: Chunk[]): GeneratedQuestion[] {
  // Extract JSON from the response (handle markdown code blocks)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      question: string;
      type: string;
      expected_insight: string;
    }>;

    return parsed.map((q, i) => ({
      question: q.question,
      type: validateQuestionType(q.type),
      expected_insight: q.expected_insight,
      chunk_id: chunks[i]?.id,
    }));
  } catch {
    return [];
  }
}

function validateQuestionType(
  type: string
): "design_decision" | "edge_case" | "trade_off" | "walkthrough" | "debugging" {
  const valid = ["design_decision", "edge_case", "trade_off", "walkthrough", "debugging"];
  return valid.includes(type) ? (type as GeneratedQuestion["type"]) : "design_decision";
}

function generateFallbackQuestions(
  chunks: Chunk[],
  familiarity: number
): GeneratedQuestion[] {
  const questions: GeneratedQuestion[] = [];
  const maxQuestions = familiarity > 70 ? 1 : familiarity > 40 ? 2 : 3;

  for (const chunk of chunks.slice(0, maxQuestions)) {
    const lines = chunk.code.split("\n").length;

    if (lines > 30) {
      questions.push({
        question:
          "This is a substantial piece of code. Can you walk through the main execution path and explain what happens at each stage?",
        type: "walkthrough",
        expected_insight: "Developer can trace the flow without reading the code",
        chunk_id: chunk.id,
      });
    } else if (chunk.explanation.toLowerCase().includes("because") || chunk.explanation.toLowerCase().includes("instead")) {
      questions.push({
        question:
          "The AI made a specific design choice here. Can you explain why this approach was chosen and what would happen with a different approach?",
        type: "design_decision",
        expected_insight: "Developer understands the trade-off, not just the implementation",
        chunk_id: chunk.id,
      });
    } else {
      questions.push({
        question:
          "If this code receives unexpected input or the service it depends on goes down, what happens? What would you see in logs?",
        type: "edge_case",
        expected_insight: "Developer can predict failure modes",
        chunk_id: chunk.id,
      });
    }
  }

  return questions;
}
