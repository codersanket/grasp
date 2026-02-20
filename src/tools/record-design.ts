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
        "## What To Do Now",
        "",
        "1. Show the developer the Design Recap above.",
        "2. Present a **pseudocode plan** — a step-by-step outline of what you'll build based on their answers. Not actual code. Example:",
        "   ```",
        "   1. Create OfflineQueue class",
        "      - Store pending transactions in Hive box",
        "      - On enqueue: validate → persist → show pending UI",
        "   2. Listen to ConnectivityService stream",
        "      - On reconnect: drain queue → retry each → update UI",
        "   3. Add retry logic with exponential backoff",
        "      - Max 3 retries → move to failed queue → notify user",
        "   ```",
        "3. Then say: \"Want to change anything, or should I start coding?\"",
        "4. Let the developer chat freely — they might ask questions, suggest changes, or want to discuss alternatives. Keep the conversation going until they're satisfied.",
        "5. Only when the developer says something like \"looks good\", \"let's go\", \"start coding\", or otherwise confirms → proceed to implementation with `grasp_log_chunk`.",
        "6. Do NOT rush to code. The design conversation is the most valuable part.",
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
