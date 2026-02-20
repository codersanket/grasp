import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createChunk, createTask, getTask, getChunksForTask, hasDesignReviewsForTask } from "../storage/queries.js";
import { trackInteraction } from "../engine/familiarity-tracker.js";

export const logChunkSchema = {
  task_id: z.string().optional().describe("The task ID from grasp_start_task. If omitted, a task is auto-created."),
  code: z.string().describe("The generated code chunk"),
  explanation: z.string().describe("Explain this code in pseudocode format. Write a step-by-step walkthrough that a developer can scan in 10 seconds. Use indented pseudocode lines, not prose. Example:\n  1. Take snapshot of buffer\n  2. Clear buffer immediately (so new events queue into fresh buffer)\n  3. For each event → call mixpanel.track()\n  4. If MoEngage forwarding → also call moengage.trackEvent()\n  5. Clear persisted Hive box\n  WHY: Snapshot-then-clear prevents duplicate flushes if timer and batch-size trigger race."),
  file_path: z.string().optional().describe("Target file path for this code"),
  lines_start: z.number().optional().describe("Starting line number"),
  lines_end: z.number().optional().describe("Ending line number"),
};

export function registerLogChunk(server: McpServer): void {
  server.tool(
    "grasp_log_chunk",
    "Log a chunk of generated code with its explanation. Call this for each meaningful block of code you generate. Include WHY you made specific design decisions.",
    logChunkSchema,
    async ({ task_id, code, explanation, file_path, lines_start, lines_end }) => {
      let resolvedTaskId = task_id;
      let autoCreated = false;

      if (!resolvedTaskId) {
        // Auto-create a task
        const intent = file_path
          ? `Auto-captured: changes to ${file_path}`
          : "Auto-captured: code generation";
        const files = file_path ? [file_path] : undefined;
        const task = createTask(intent, files);
        resolvedTaskId = task.id;
        autoCreated = true;
      } else {
        // Validate task exists
        const task = getTask(resolvedTaskId);
        if (!task) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: task_id "${resolvedTaskId}" not found. Call grasp_start_task first or omit task_id to auto-create.`,
              },
            ],
            isError: true,
          };
        }
      }

      const chunk = createChunk(resolvedTaskId, code, explanation, file_path, lines_start, lines_end);

      // Update familiarity for the file via tracker (not direct call)
      if (file_path) {
        trackInteraction(file_path, "generated");
      }

      const chunkCount = getChunksForTask(resolvedTaskId).length;
      const designWasReviewed = hasDesignReviewsForTask(resolvedTaskId);

      const reminder = designWasReviewed
        ? `\nChunk ${chunkCount} logged. Design was already reviewed — no post-code check needed.`
        : [
            "",
            `Chunk ${chunkCount} logged for task ${resolvedTaskId}.`,
            `When you finish generating ALL code for this task, you MUST call grasp_check(task_id: "${resolvedTaskId}").`,
            "Do NOT skip this step. Do NOT end your response without calling grasp_check after the last code block.",
          ].join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              chunk_id: chunk.id,
              task_id: resolvedTaskId,
              auto_created: autoCreated,
              logged: true,
            }),
          },
          {
            type: "text" as const,
            text: reminder,
          },
        ],
      };
    }
  );
}
