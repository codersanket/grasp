import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDesignReviewById, recordDesignResponse } from "../storage/queries.js";
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

      return {
        content: [
          {
            type: "text" as const,
            text: "Design decision recorded.",
          },
        ],
      };
    }
  );
}
