import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase } from "../storage/db.js";
import { recordAnswer, recordSkip } from "../storage/queries.js";
import { trackInteraction } from "../engine/familiarity-tracker.js";

export const recordSchema = {
  check_id: z.string().describe("The check/question ID to record an answer for"),
  answer: z.string().optional().describe("The developer's answer to the comprehension question"),
  skipped: z.boolean().optional().describe("Set to true if the developer skipped this question"),
  quality: z
    .enum(["correct", "partial", "incorrect", "needs_explanation"])
    .optional()
    .describe(
      "YOUR evaluation of the developer's answer quality. Compare their answer to the design explanation from grasp_check. " +
      "'correct' = they got the key insight, " +
      "'partial' = they understood some of it but missed important aspects, " +
      "'incorrect' = they missed the point entirely, " +
      "'needs_explanation' = they said they don't know or asked for explanation"
    ),
};

const QUALITY_SCORES: Record<string, number> = {
  correct: 1.0,
  partial: 0.6,
  incorrect: 0.2,
  needs_explanation: 0.1,
};

const QUALITY_MESSAGES: Record<string, string> = {
  correct: "Solid — you own this decision.",
  partial: "On the right track. The full picture will click with more exposure.",
  incorrect: "Not quite — but now you know. That's the point.",
  needs_explanation: "No worries — now you've learned something new about your codebase.",
};

export function registerRecord(server: McpServer): void {
  server.tool(
    "grasp_record",
    `Record the developer's answer to a comprehension question. Call this after the developer responds to a question from grasp_check.

IMPORTANT: You MUST evaluate the developer's answer by setting the 'quality' parameter. Compare their answer against the design explanation you received from grasp_check:
- "correct" — they explained the key design decision accurately
- "partial" — they got part of it but missed important nuances
- "incorrect" — they misunderstood the design decision
- "needs_explanation" — they said "I don't know" or asked you to explain`,
    recordSchema,
    async ({ check_id, answer, skipped, quality }) => {
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
              text: "Skipped. This area stays less familiar in your score.",
            },
          ],
        };
      }

      if (!answer) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Provide either an answer or set skipped to true.",
            },
          ],
        };
      }

      // Use AI-evaluated quality if provided, fall back to length heuristic
      const score = quality ? QUALITY_SCORES[quality] : (answer.length > 20 ? 1.0 : 0.5);
      const message = quality ? QUALITY_MESSAGES[quality] : "Answer recorded.";

      recordAnswer(check_id, answer, score);

      if (check?.file_path) {
        trackInteraction(check.file_path, score > 0.5 ? "answered_correctly" : "answered_incorrectly");
      }

      return {
        content: [
          {
            type: "text" as const,
            text: message,
          },
        ],
      };
    }
  );
}
