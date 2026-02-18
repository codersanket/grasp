import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getOverallStats, getChecksForTask, getChunksForTask } from "../storage/queries.js";

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
        const checks = getChecksForTask(task_id);
        const chunks = getChunksForTask(task_id);
        const answered = checks.filter((c) => c.developer_answer !== null);
        const skipped = checks.filter((c) => c.skipped === 1);
        const passed = checks.filter((c) => c.score !== null && c.score > 0.5);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                scope: "task",
                task_id,
                chunks_generated: chunks.length,
                questions_asked: checks.length,
                questions_answered: answered.length,
                questions_skipped: skipped.length,
                questions_passed: passed.length,
                pass_rate:
                  checks.length > 0
                    ? Math.round((passed.length / checks.length) * 100)
                    : null,
                message: formatTaskMessage(chunks.length, answered.length, skipped.length, checks.length),
              }),
            },
          ],
        };
      }

      // Overall stats
      const stats = getOverallStats();
      const passRate =
        stats.total_checks > 0
          ? Math.round((stats.checks_passed / stats.total_checks) * 100)
          : null;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              scope: "overall",
              ...stats,
              pass_rate: passRate,
              message: formatOverallMessage(stats),
            }),
          },
        ],
      };
    }
  );
}

function formatTaskMessage(
  chunks: number,
  answered: number,
  skipped: number,
  total: number
): string {
  if (total === 0) return "No comprehension checks for this task yet.";
  if (skipped === total) return "All questions were skipped. Consider engaging with the next round.";
  if (answered === total) return "All questions answered. You own this code.";
  return `${answered}/${total} questions answered, ${skipped} skipped. ${chunks} code chunks tracked.`;
}

function formatOverallMessage(stats: {
  total_tasks: number;
  total_chunks: number;
  total_checks: number;
  checks_passed: number;
  checks_skipped: number;
}): string {
  if (stats.total_tasks === 0) return "No tasks tracked yet. Start coding with Grasp to build your comprehension profile.";
  return `${stats.total_tasks} tasks, ${stats.total_chunks} code chunks, ${stats.checks_passed}/${stats.total_checks} questions passed.`;
}
