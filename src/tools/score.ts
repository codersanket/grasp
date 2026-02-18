import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  calculateTaskScore,
  calculateOverallScore,
  recordDailyScore,
} from "../engine/score-calculator.js";

export const scoreSchema = {
  task_id: z.string().optional().describe("Optional task ID for task-specific score. Omit for overall stats."),
};

export function registerScore(server: McpServer): void {
  server.tool(
    "grasp_score",
    "Get the developer's comprehension score and stats. Call this when the developer asks about their Grasp score or says 'grasp score'. Shows how well they understand their AI-generated code.",
    scoreSchema,
    async ({ task_id }) => {
      if (task_id) {
        const score = calculateTaskScore(task_id);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                scope: "task",
                task_id,
                score: score.overall,
                breakdown: score.breakdown,
                raw: score.raw,
                message: formatScoreMessage(score.overall, score.raw.questions_total),
              }),
            },
          ],
        };
      }

      // Overall score
      const score = calculateOverallScore();
      recordDailyScore(score);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              scope: "overall",
              score: score.overall,
              breakdown: score.breakdown,
              raw: score.raw,
              message: formatScoreMessage(score.overall, score.raw.questions_total),
            }),
          },
        ],
      };
    }
  );
}

function formatScoreMessage(score: number, totalQuestions: number): string {
  if (totalQuestions === 0) return "No comprehension data yet. Start coding with Grasp to build your profile.";
  if (score >= 80) return "Strong comprehension. You own this code.";
  if (score >= 60) return "Good understanding. Some areas could use deeper engagement.";
  if (score >= 40) return "Moderate comprehension. Consider slowing down on unfamiliar areas.";
  return "Low comprehension score. Take time to understand the code being generated.";
}
