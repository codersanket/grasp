import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getChunksForTask, createCheck, getFamiliarity } from "../storage/queries.js";

export const checkSchema = {
  task_id: z.string().describe("The task ID to generate comprehension questions for"),
  chunk_ids: z.array(z.string()).optional().describe("Specific chunk IDs to question (defaults to all chunks in the task)"),
};

export function registerCheck(server: McpServer): void {
  server.tool(
    "grasp_check",
    "Generate comprehension questions about the code just written. Call this after generating code to verify the developer understands what was built and why. Present the questions naturally in conversation.",
    checkSchema,
    async ({ task_id, chunk_ids }) => {
      const chunks = getChunksForTask(task_id);
      const relevantChunks = chunk_ids
        ? chunks.filter((c) => chunk_ids.includes(c.id))
        : chunks;

      if (relevantChunks.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ questions: [], message: "No code chunks found for this task." }),
            },
          ],
        };
      }

      // Collect file paths for familiarity check
      const filePaths = [...new Set(relevantChunks.map((c) => c.file_path).filter(Boolean))] as string[];
      const familiarityData = getFamiliarity(filePaths);
      const avgFamiliarity =
        familiarityData.length > 0
          ? familiarityData.reduce((sum, f) => sum + f.score, 0) / familiarityData.length
          : 0;

      // Stub: generate questions from chunk metadata
      // Phase 3 will replace this with LLM-powered question generation
      const questions = generateStubQuestions(relevantChunks, avgFamiliarity);

      // Store questions in DB
      const storedQuestions = questions.map((q) =>
        createCheck(task_id, q.question, q.type, q.expected_insight, q.chunk_id)
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              questions: storedQuestions.map((q) => ({
                id: q.id,
                question: q.question,
                type: q.question_type,
              })),
              message: "Present these questions naturally. If the developer answers correctly, great. If they skip or struggle, that's useful data too.",
            }),
          },
        ],
      };
    }
  );
}

interface StubQuestion {
  question: string;
  type: string;
  expected_insight: string;
  chunk_id?: string;
}

function generateStubQuestions(
  chunks: Array<{ id: string; code: string; explanation: string; file_path: string | null }>,
  familiarity: number
): StubQuestion[] {
  const questions: StubQuestion[] = [];

  // Fewer questions for familiar areas
  const maxQuestions = familiarity > 70 ? 1 : familiarity > 40 ? 2 : 3;

  for (const chunk of chunks.slice(0, maxQuestions)) {
    const lines = chunk.code.split("\n").length;

    if (lines > 20) {
      questions.push({
        question: `This chunk is ${lines} lines. Can you walk through the main flow and explain what happens at each step?`,
        type: "walkthrough",
        expected_insight: "Developer should be able to trace the execution path",
        chunk_id: chunk.id,
      });
    } else if (chunk.explanation) {
      questions.push({
        question: `The explanation mentions specific design decisions. Can you explain why this approach was chosen over alternatives?`,
        type: "design_decision",
        expected_insight: "Developer should understand the trade-offs",
        chunk_id: chunk.id,
      });
    } else {
      questions.push({
        question: `What would happen if this code receives unexpected input? What edge cases should we consider?`,
        type: "edge_case",
        expected_insight: "Developer should identify potential failure modes",
        chunk_id: chunk.id,
      });
    }
  }

  return questions;
}
