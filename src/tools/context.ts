import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getFamiliarity, getChunksByFilePath, getDesignReviewsByFiles } from "../storage/queries.js";
import { getRelativeTime } from "../utils/time.js";

export const contextSchema = {
  file_paths: z.array(z.string()).describe("File paths to check developer familiarity for"),
};

export function registerContext(server: McpServer): void {
  server.tool(
    "grasp_context",
    `Check the developer's familiarity with specific files AND retrieve past design decisions. Call this before generating code to understand what the developer knows, or when they ask "why was this written this way?" about existing code.

Returns familiarity scores plus all stored design explanations from previous coding sessions. Present the explanations naturally — they're the "why" behind the code.`,
    contextSchema,
    async ({ file_paths }) => {
      const familiarity = getFamiliarity(file_paths);
      const chunks = getChunksByFilePath(file_paths);

      const lines: string[] = [];

      for (const path of file_paths) {
        const fam = familiarity.find((f) => f.file_path === path);
        const fileChunks = chunks.filter((c) => c.file_path === path);

        const score = fam?.score ?? 0;
        const interactions = fam?.interactions ?? 0;
        lines.push(`[${path}] familiarity: ${Math.round(score)}/100 | ${interactions} interactions`);

        if (fileChunks.length > 0) {
          for (const chunk of fileChunks) {
            const age = getRelativeTime(chunk.created_at);
            lines.push(`  - "${chunk.explanation}" (${age})`);
          }
        } else {
          lines.push(`  - No design decisions recorded yet`);
        }
        const designReviews = getDesignReviewsByFiles([path]);
        if (designReviews.length > 0) {
          for (const review of designReviews) {
            if (review.developer_response) {
              lines.push(`  - [design: ${review.scope}] ${review.developer_response}`);
            }
          }
        }

        lines.push(``);
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
