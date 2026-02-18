import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createChunk, updateFamiliarity } from "../storage/queries.js";

export const logChunkSchema = {
  task_id: z.string().describe("The task ID from grasp_start_task"),
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
      const chunk = createChunk(task_id, code, explanation, file_path, lines_start, lines_end);

      // Update familiarity for the file (small bump for generation)
      if (file_path) {
        updateFamiliarity(file_path, 1);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              chunk_id: chunk.id,
              logged: true,
            }),
          },
        ],
      };
    }
  );
}
