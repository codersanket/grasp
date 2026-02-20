import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getTask, createDesignReview } from "../storage/queries.js";
import { getAverageFamiliarity } from "../engine/familiarity-tracker.js";

export const designReviewSchema = {
  task_id: z.string().describe("The task ID to review design for"),
};

export function registerDesignReview(server: McpServer): void {
  server.tool(
    "grasp_design_review",
    `Discuss design decisions with the developer BEFORE writing code. Call this after grasp_start_task when familiarity is low.

HOW THIS WORKS:
This tool returns the task intent, familiarity level, and design review scopes. YOU (the AI) must:
1. Read the intent and scopes from the response
2. Propose your recommended approach first
3. Ask ONE design question at a time based on the scope, then STOP your response
4. Wait for the developer to answer
5. Call grasp_record_design with the design_review_id and their response
6. Then ask the next design question and STOP again
7. After all design questions are answered, proceed to implementation

THIS IS CRITICAL: Each question must be its own conversational turn. The developer is a collaborator in the design process, not a reviewer after the fact.

SCOPE GUIDELINES — ask deep, quality questions, not surface-level ones:
- "approach": Ask about the overall strategy and WHY — "I'm thinking of using X because Y. What do you think? Why not Z?"
- "trade_offs": Ask about real consequences — "This approach means A but sacrifices B. In production, how would that affect your users?"
- "edge_cases": Ask about failure modes and boundaries — "What should happen when X fails? What if the input is empty/huge/malformed?"
- "debugging": Ask about observability — "If this breaks at 2am, how would you diagnose it? What would you look for in the logs?"

IMPORTANT: These questions replace post-code comprehension checks. The goal is to ensure the developer deeply understands the design BEFORE code is written, so no questions are needed after. Ask fewer but harder questions.`,
    designReviewSchema,
    async ({ task_id }) => {
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

      const filePaths = task.files ? (JSON.parse(task.files) as string[]) : [];
      const avgFamiliarity = getAverageFamiliarity(filePaths);

      // High familiarity — skip design review
      if (avgFamiliarity >= 50) {
        return {
          content: [
            {
              type: "text" as const,
              text: "High familiarity — proceed with implementation. Log chunks with grasp_log_chunk.",
            },
          ],
        };
      }

      // Determine scopes based on familiarity — fewer but deeper questions
      let scopes: string[];
      if (avgFamiliarity <= 20) {
        scopes = ["approach", "trade_offs", "edge_cases", "debugging"];
      } else if (avgFamiliarity <= 40) {
        scopes = ["approach", "trade_offs", "edge_cases"];
      } else {
        scopes = ["approach", "trade_offs"];
      }

      // Create placeholder design reviews in DB
      const reviews = scopes.map((scope) =>
        createDesignReview(task_id, scope, filePaths.length > 0 ? filePaths : undefined)
      );

      const reviewLines = reviews.map(
        (r, i) => `${i + 1}. [design_review_id: ${r.id}] scope: ${r.scope}`
      );

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `intent: ${task.intent}`,
              `familiarity: ${Math.round(avgFamiliarity)}/100`,
              `design questions: ${scopes.length}`,
              ``,
              `Propose your approach first. Then ask ONE design question at a time based on the scope. STOP after each. Wait for answer. Call grasp_record_design. Then next.`,
              ``,
              ...reviewLines,
            ].join("\n"),
          },
        ],
      };
    }
  );
}
