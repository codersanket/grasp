import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createChunk, createTask, getTask } from "../storage/queries.js";
import { trackInteraction } from "../engine/familiarity-tracker.js";

export const logChunkSchema = {
  task_id: z.string().optional().describe("The task ID from grasp_start_task. If omitted, a task is auto-created."),
  code: z.string().describe("The generated code chunk"),
  explanation: z.string().describe("Why this code was written this way — design decisions, trade-offs, alternatives considered"),
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
        ],
      };
    }
  );
}
