import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getFamiliarity } from "../storage/queries.js";

export const contextSchema = {
  file_paths: z.array(z.string()).describe("File paths to check developer familiarity for"),
};

export function registerContext(server: McpServer): void {
  server.tool(
    "grasp_context",
    "Check the developer's familiarity with specific files. Call this before generating code to understand how much the developer knows about the files involved. Use the result to decide how much to explain.",
    contextSchema,
    async ({ file_paths }) => {
      const familiarity = getFamiliarity(file_paths);
      const familiarityMap: Record<string, { score: number; interactions: number; last_seen: string | null }> = {};

      for (const path of file_paths) {
        const data = familiarity.find((f) => f.file_path === path);
        familiarityMap[path] = {
          score: data?.score ?? 0,
          interactions: data?.interactions ?? 0,
          last_seen: data?.last_interaction ?? null,
        };
      }

      const avgScore =
        file_paths.length > 0
          ? Object.values(familiarityMap).reduce((sum, f) => sum + f.score, 0) / file_paths.length
          : 0;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              files: familiarityMap,
              average_familiarity: Math.round(avgScore),
              recommendation:
                avgScore > 70
                  ? "Developer knows this area. Generate efficiently."
                  : avgScore > 40
                    ? "Moderate familiarity. Explain key design decisions."
                    : "Unfamiliar territory. Generate in small chunks, explain everything, ask comprehension questions.",
            }),
          },
        ],
      };
    }
  );
}
