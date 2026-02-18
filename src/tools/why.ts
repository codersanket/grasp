import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getFileHistory } from "../storage/queries.js";
import { getRelativeTime } from "../utils/time.js";

export const whySchema = {
  file_path: z.string().describe("The file path to look up design decisions for"),
};

export function registerWhy(server: McpServer): void {
  server.tool(
    "grasp_why",
    "Look up stored design decisions for a file. Use this when the developer asks 'why was this written this way?' or during code review, debugging, or onboarding.",
    whySchema,
    async ({ file_path }) => {
      const history = getFileHistory(file_path);

      if (history.chunks.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No design decisions recorded for ${file_path}.`,
            },
          ],
        };
      }

      const lines: string[] = [
        `${file_path}`,
        `Familiarity: ${Math.round(history.familiarity)}/100`,
        ``,
        `Design decisions:`,
      ];

      for (const chunk of history.chunks) {
        const age = getRelativeTime(chunk.created_at);
        lines.push(`  - "${chunk.explanation}" (${age})`);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: lines.join("\n"),
          },
        ],
      };
    }
  );
}
