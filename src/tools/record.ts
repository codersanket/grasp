import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase } from "../storage/db.js";
import { recordAnswer, recordSkip } from "../storage/queries.js";
import { trackInteraction } from "../engine/familiarity-tracker.js";

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
      // Look up the check to find associated file paths
      const db = getDatabase();
      const check = db
        .prepare(
          `SELECT ch.chunk_id, c.file_path
           FROM checks ch
           LEFT JOIN chunks c ON ch.chunk_id = c.id
           WHERE ch.id = ?`
        )
        .get(check_id) as { chunk_id: string | null; file_path: string | null } | undefined;

      if (skipped) {
        recordSkip(check_id);
        if (check?.file_path) {
          trackInteraction(check.file_path, "skipped");
        }
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                recorded: true,
                skipped: true,
                message: "Question skipped. No judgment — but skipping means this area stays less familiar.",
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

      // For now, any substantive answer scores well. Phase 5+ will add LLM-based evaluation.
      const score = answer.length > 20 ? 1.0 : 0.5;
      recordAnswer(check_id, answer, score);

      if (check?.file_path) {
        trackInteraction(check.file_path, score > 0.5 ? "answered_correctly" : "answered_incorrectly");
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              recorded: true,
              score,
              message:
                score > 0.5
                  ? "Good answer. You clearly understand this code."
                  : "Answer recorded. Consider looking deeper at this area.",
            }),
          },
        ],
      };
    }
  );
}
