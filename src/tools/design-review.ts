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
This tool returns the task intent, familiarity level, and 1-2 design review scopes. YOU (the AI) must:
1. Read the intent and scopes from the response
2. Propose your recommended approach — explain what you'd build and why
3. Ask ONE deep design question based on the scope, then STOP your response
4. Wait for the developer to answer
5. Call grasp_record_design with the design_review_id and their response
6. If there's a second scope, ask that question and STOP again
7. After all scopes are answered, the tool returns a recap + asks you to present a pseudocode plan
8. The developer can then chat freely — ask questions, suggest changes, iterate on the design
9. Only when the developer says "looks good", "let's go", or confirms → proceed to implementation

THIS IS CRITICAL: Keep it conversational. 1-2 focused questions, then open discussion. Not an interrogation.

SCOPE GUIDELINES — one deep question per scope:
- "approach": Propose your strategy and ask the key design decision — "I'm thinking X because Y. The main decision is Z — what's your take?"
- "edge_cases": Ask about the one failure mode that matters most — "The biggest risk here is X. What should happen when that fails?"

IMPORTANT: These questions replace post-code comprehension checks. Fewer questions, higher quality. The pseudocode plan after is where the developer really engages with the design.`,
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

      // 1-2 focused questions — quality over quantity
      let scopes: string[];
      if (avgFamiliarity <= 20) {
        scopes = ["approach", "edge_cases"];
      } else {
        scopes = ["approach"];
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
