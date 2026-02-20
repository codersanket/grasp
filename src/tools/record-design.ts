import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDesignReviewById, recordDesignResponse, getDesignReviewsForTask, getTask } from "../storage/queries.js";
import { trackInteraction } from "../engine/familiarity-tracker.js";

export const recordDesignSchema = {
  design_review_id: z.string().describe("The design review ID to record the response for"),
  response: z.string().describe("The developer's design decision or response"),
};

export function registerRecordDesign(server: McpServer): void {
  server.tool(
    "grasp_record_design",
    "Record the developer's response to a design question. Call this after the developer answers a design review question from grasp_design_review.",
    recordDesignSchema,
    async ({ design_review_id, response }) => {
      const review = getDesignReviewById(design_review_id);
      if (!review) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: design_review_id "${design_review_id}" not found.`,
            },
          ],
          isError: true,
        };
      }

      recordDesignResponse(design_review_id, response);

      // Track familiarity for each file in the review
      if (review.file_paths) {
        const filePaths: string[] = JSON.parse(review.file_paths);
        for (const filePath of filePaths) {
          trackInteraction(filePath, "design_discussed");
        }
      }

      // Check if all design reviews for this task are now answered
      const allReviews = getDesignReviewsForTask(review.task_id);
      const allAnswered = allReviews.every((r) => r.developer_response !== null);

      if (!allAnswered) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Design decision recorded. Ask the next design question.",
            },
          ],
        };
      }

      // All design questions answered — build recap + pseudocode prompt
      const task = getTask(review.task_id);
      const intent = task?.intent ?? "unknown";

      const scopeLabels: Record<string, string> = {
        approach: "Approach",
        trade_offs: "Trade-offs",
        edge_cases: "Edge Cases",
        debugging: "Debugging",
      };

      const recapLines: string[] = [
        "--- ALL DESIGN QUESTIONS ANSWERED ---",
        "",
        `## Design Recap: ${intent}`,
        "",
      ];

      for (const r of allReviews) {
        const label = scopeLabels[r.scope] ?? r.scope;
        recapLines.push(`**${label}:** ${r.developer_response}`);
      }

      recapLines.push(
        "",
        "---",
        "",
        "## Next Steps",
        "",
        "1. Show the developer the Design Recap above exactly as formatted.",
        "2. Then show a **pseudocode plan** of what you will implement based on their answers. The pseudocode should be a clear, step-by-step outline — not actual code. Example:",
        "   ```",
        "   1. Create OfflineQueue class",
        "      - Store pending transactions in Hive box",
        "      - On enqueue: validate → persist → show pending UI",
        "   2. Listen to ConnectivityService stream",
        "      - On reconnect: drain queue → retry each → update UI",
        "   3. Add retry logic with exponential backoff",
        "      - Max 3 retries → move to failed queue → notify user",
        "   ```",
        "3. Ask the developer: \"Does this plan look right? Anything to change before I start coding?\"",
        "4. Only after they confirm → proceed to implementation with `grasp_log_chunk`.",
      );

      return {
        content: [
          {
            type: "text" as const,
            text: recapLines.join("\n"),
          },
        ],
      };
    }
  );
}
