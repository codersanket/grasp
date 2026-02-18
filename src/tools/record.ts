import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  recordAnswer,
  recordSkip,
  getChecksForTask,
  updateFamiliarity,
} from "../storage/queries.js";

export const recordSchema = {
  check_id: z.string().describe("The check/question ID to record an answer for"),
  answer: z.string().optional().describe("The developer's answer to the comprehension question"),
  skipped: z.boolean().optional().describe("Set to true if the developer skipped this question"),
};

export function registerRecord(server: McpServer): void {
  server.tool(
    "grasp_record",
    "Record the developer's answer to a comprehension question. Call this after the developer responds to a question from grasp_check.",
    recordSchema,
    async ({ check_id, answer, skipped }) => {
      if (skipped) {
        recordSkip(check_id);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                recorded: true,
                skipped: true,
                message: "Question skipped. That's fine — skipping is tracked but never penalized harshly.",
              }),
            },
          ],
        };
      }

      if (!answer) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                recorded: false,
                error: "Provide either an answer or set skipped to true.",
              }),
            },
          ],
        };
      }

      // Phase 4 will add real scoring. For now, any answer scores 1.0
      const score = 1.0;
      recordAnswer(check_id, answer, score);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              recorded: true,
              score,
              message: "Answer recorded. The developer engaged with the code — that's what matters.",
            }),
          },
        ],
      };
    }
  );
}
