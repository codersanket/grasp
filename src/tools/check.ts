import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getChunksForTask, getTask, createCheck, getFamiliarity } from "../storage/queries.js";
import { createLLMAdapter } from "../llm/adapter.js";
import { generateQuestions } from "../engine/question-generator.js";
import { getConfig } from "../config.js";

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

      // Get task intent and familiarity
      const task = getTask(task_id);
      const intent = task?.intent ?? "unknown";

      const filePaths = [...new Set(relevantChunks.map((c) => c.file_path).filter(Boolean))] as string[];
      const familiarityData = getFamiliarity(filePaths);
      const avgFamiliarity =
        familiarityData.length > 0
          ? familiarityData.reduce((sum, f) => sum + f.score, 0) / familiarityData.length
          : 0;

      // Generate questions using LLM
      let questions;
      try {
        const config = getConfig();
        const llm = await createLLMAdapter(config.llm);
        questions = await generateQuestions(llm, relevantChunks, {
          intent,
          familiarity: avgFamiliarity,
        });
      } catch (error) {
        console.error("LLM unavailable, using fallback questions:", error);
        // Import the fallback from the engine (it handles this internally)
        questions = await generateQuestions(
          { generate: async () => ({ text: "[]" }) },
          relevantChunks,
          { intent, familiarity: avgFamiliarity }
        );
      }

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
              message:
                "Present these questions naturally in the conversation. They're not a quiz — they're the questions a good colleague would ask to make sure you own this code.",
            }),
          },
        ],
      };
    }
  );
}
