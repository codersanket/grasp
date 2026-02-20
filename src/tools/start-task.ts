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

      const directive =
        suggestedMode === "guided"
          ? [
              "",
              "--- MANDATORY NEXT STEP ---",
              `You MUST call grasp_design_review(task_id: "${task.id}") BEFORE writing any code.`,
              "Do NOT skip this step. Do NOT start generating code until design review is complete.",
              "After design review, log every code block with grasp_log_chunk.",
              `After all code is written, call grasp_check(task_id: "${task.id}") for comprehension questions.`,
            ].join("\n")
          : [
              "",
              "--- WORKFLOW REMINDER ---",
              "Log every code block with grasp_log_chunk.",
              `After all code is written, call grasp_check(task_id: "${task.id}") to verify comprehension.`,
            ].join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              task_id: task.id,
              suggested_mode: suggestedMode,
              familiarity: familiarityMap,
            }),
          },
          {
            type: "text" as const,
            text: directive,
          },
        ],
      };
    }
  );
}
