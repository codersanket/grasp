import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createTask, getFamiliarity } from "../storage/queries.js";

export const startTaskSchema = {
  intent: z.string().describe("What the developer wants to build or change"),
  files: z.array(z.string()).optional().describe("File paths that will be involved"),
};

export function registerStartTask(server: McpServer): void {
  server.tool(
    "grasp_start_task",
    "Call this BEFORE generating code. Captures the developer's intent and checks their familiarity with the involved files. Returns a task ID and recommended mode (guided or full_speed).",
    startTaskSchema,
    async ({ intent, files }) => {
      const task = createTask(intent, files);

      const familiarityData = files ? getFamiliarity(files) : [];
      const familiarityMap: Record<string, number> = {};
      for (const f of familiarityData) {
        familiarityMap[f.file_path] = f.score;
      }

      // Suggest mode based on average familiarity
      const scores = Object.values(familiarityMap);
      const avgFamiliarity = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      const suggestedMode = avgFamiliarity > 70 ? "full_speed" : "guided";

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              task_id: task.id,
              suggested_mode: suggestedMode,
              familiarity: familiarityMap,
              message:
                suggestedMode === "guided"
                  ? "Developer is in unfamiliar territory. Generate code in focused chunks, explain design decisions, and ask comprehension questions."
                  : "Developer knows this area well. Generate efficiently but still log chunks for tracking.",
            }),
          },
        ],
      };
    }
  );
}
