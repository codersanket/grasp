import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getChunksForTask, getTask, createCheck, getFamiliarity, hasDesignReviewsForTask } from "../storage/queries.js";

export const checkSchema = {
  task_id: z.string().describe("The task ID to generate comprehension questions for"),
  chunk_ids: z.array(z.string()).optional().describe("Specific chunk IDs to question (defaults to all chunks in the task)"),
};

export function registerCheck(server: McpServer): void {
  server.tool(
    "grasp_check",
    `Generate comprehension questions about the code just written. Call this after generating code to verify the developer understands what was built and why.

HOW THIS WORKS:
This tool returns two things:
1. A "Code Walkthrough" section with pseudocode explanations for all chunks — you MUST show this to the developer as-is before asking questions.
2. Check IDs paired with design explanations — use these to generate questions.

STEP BY STEP:
1. First, display the "Code Walkthrough" section to the developer exactly as returned. This is their consolidated view of everything that was built.
2. Then generate questions based on the design decisions.
3. Ask ONLY THE FIRST question, then STOP your response and WAIT for the developer to answer.
4. Do NOT ask all questions at once. Do NOT list them. Do NOT continue with summaries.
5. When the developer answers, call grasp_record with the check_id and their answer, then ask the NEXT question and STOP again.
6. Repeat until all questions are answered.

THIS IS CRITICAL: Show the walkthrough first, then one question per turn. This is a conversation, not a quiz.

QUESTION GUIDELINES:
- Ask about design decisions: why this approach over alternatives
- Ask about trade-offs: what are the consequences of this choice
- Ask about edge cases: what could go wrong, what inputs would break it
- Ask about debugging: if this breaks in production, how would they diagnose it
- Do NOT ask trivia or syntax questions
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

      // Build consolidated walkthrough from all chunk explanations
      // Group chunks by file for cleaner display
      const fileGroups = new Map<string, typeof relevantChunks>();
      for (const chunk of relevantChunks) {
        const key = chunk.file_path ?? "unknown";
        const group = fileGroups.get(key) ?? [];
        group.push(chunk);
        fileGroups.set(key, group);
      }

      const separator = "────────────────────────────────";
      const walkthroughLines: string[] = [
        "--- CODE WALKTHROUGH — SHOW THIS TO THE DEVELOPER ---",
        "",
        `## What was built: ${task.intent}`,
        "",
        separator,
      ];

      for (const [filePath, fileChunks] of fileGroups) {
        const fileName = filePath.split("/").pop() ?? "unknown";
        const shortPath = filePath.split("/").slice(-3).join("/");
        walkthroughLines.push("");
        walkthroughLines.push(`### ${fileName}`);
        walkthroughLines.push(`\`${shortPath}\``);
        walkthroughLines.push("");
        for (const chunk of fileChunks) {
          walkthroughLines.push(chunk.explanation);
          walkthroughLines.push("");
        }
        walkthroughLines.push(separator);
      }

      walkthroughLines.push("");
      walkthroughLines.push("You MUST display this walkthrough to the developer EXACTLY as formatted above before asking any questions.");

      // Skip entirely if design was already reviewed — comprehension was established before code
      if (hasDesignReviewsForTask(task_id)) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Design was reviewed before implementation — comprehension check skipped. The developer already demonstrated understanding during design review. Give a brief summary of what was built and move on.",
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

      // High familiarity — skip questions, show walkthrough only
      if (avgFamiliarity >= 50) {
        return {
          content: [
            {
              type: "text" as const,
              text: walkthroughLines.join("\n"),
            },
            {
              type: "text" as const,
              text: "High familiarity — no questions needed. Just show the walkthrough above.",
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
            text: walkthroughLines.join("\n"),
          },
          {
            type: "text" as const,
            text: [
              `intent: ${intent}`,
              `familiarity: ${Math.round(avgFamiliarity)}/100`,
              `questions to ask: ${questionCount}`,
              ``,
              `Show the walkthrough above FIRST. Then ask ONE question at a time. STOP after each. Wait for answer. Call grasp_record. Then next.`,
              ``,
              ...questions,
            ].join("\n"),
          },
        ],
      };
    }
  );
}
