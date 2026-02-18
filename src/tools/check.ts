import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getChunksForTask, getTask, createCheck, getFamiliarity } from "../storage/queries.js";

export const checkSchema = {
  task_id: z.string().describe("The task ID to generate comprehension questions for"),
  chunk_ids: z.array(z.string()).optional().describe("Specific chunk IDs to question (defaults to all chunks in the task)"),
};

export function registerCheck(server: McpServer): void {
  server.tool(
    "grasp_check",
    `Generate comprehension questions about the code just written. Call this after generating code to verify the developer understands what was built and why.

HOW THIS WORKS:
This tool returns design explanations for the code chunks and check_ids. YOU (the AI) must:
1. Read the explanations from the response
2. Generate the specified number of questions yourself based on the design decisions
3. Ask ONLY THE FIRST question, then STOP your response and WAIT for the developer to answer
4. Do NOT ask all questions at once. Do NOT list them. Do NOT continue with summaries or other work.
5. When the developer answers, call grasp_record with the check_id and their answer, then ask the NEXT question and STOP again.
6. Repeat until all questions are answered.

THIS IS CRITICAL: Each question must be its own conversational turn. You ask one question → stop → developer answers → you record + ask next → stop. This is a conversation, not a quiz.

QUESTION GUIDELINES:
- Ask about design decisions: why this approach over alternatives
- Ask about trade-offs: what are the consequences of this choice
- Ask about edge cases: what could go wrong, what inputs would break it
- Ask about debugging: if this breaks in production, how would they diagnose it
- Do NOT ask trivia or syntax questions
- If familiarity is high, ask nuanced trade-off questions
- If familiarity is low, ask fundamental "why this approach" questions
- Questions should feel like a colleague asking "hey, do you know why we did it this way?" not a quiz`,
    checkSchema,
    async ({ task_id, chunk_ids }) => {
      // Validate task exists
      const task = getTask(task_id);
      if (!task) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: task_id "${task_id}" not found. Call grasp_start_task first.`,
            },
          ],
          isError: true,
        };
      }

      const chunks = getChunksForTask(task_id);
      const relevantChunks = chunk_ids
        ? chunks.filter((c) => chunk_ids.includes(c.id))
        : chunks;

      if (relevantChunks.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No code chunks found for this task. Nothing to check.",
            },
          ],
        };
      }

      const intent = task.intent;

      const filePaths = [...new Set(relevantChunks.map((c) => c.file_path).filter(Boolean))] as string[];
      const familiarityData = getFamiliarity(filePaths);
      const avgFamiliarity =
        familiarityData.length > 0
          ? familiarityData.reduce((sum, f) => sum + f.score, 0) / familiarityData.length
          : 0;

      // High familiarity — skip questions, just capture design decisions
      if (avgFamiliarity >= 50) {
        return {
          content: [
            {
              type: "text" as const,
              text: "High familiarity — no questions needed. Design decisions captured.",
            },
          ],
        };
      }

      // Scale questions for 0-50 familiarity range
      const baseCount = Math.min(relevantChunks.length, 5);
      let questionCount: number;
      if (avgFamiliarity > 30) {
        questionCount = Math.ceil(baseCount * 0.5);
      } else {
        questionCount = baseCount;
      }
      questionCount = Math.max(1, questionCount);

      // Create placeholder checks in DB — one per question, cycling through chunks
      const checkIds: string[] = [];
      for (let i = 0; i < questionCount; i++) {
        const chunk = relevantChunks[i % relevantChunks.length];
        const check = createCheck(
          task_id,
          "pending_ai_generation",
          "design_decision",
          undefined,
          chunk.id
        );
        checkIds.push(check.id);
      }

      // Pair each check_id with the chunk explanation it should be about
      const questions = checkIds.map((checkId, i) => {
        const chunk = relevantChunks[i % relevantChunks.length];
        return `Q${i + 1} [check_id: ${checkId}] [${chunk.file_path}]: ${chunk.explanation}`;
      });

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `intent: ${intent}`,
              `familiarity: ${Math.round(avgFamiliarity)}/100`,
              `questions to ask: ${questionCount}`,
              ``,
              `Ask ONE question at a time. STOP after each. Wait for answer. Call grasp_record. Then next.`,
              ``,
              ...questions,
            ].join("\n"),
          },
        ],
      };
    }
  );
}
