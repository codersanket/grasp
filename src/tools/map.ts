import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAllFileStats } from "../storage/queries.js";
import { buildMapPlain } from "../engine/map-builder.js";

export function registerMap(server: McpServer): void {
  server.tool(
    "grasp_map",
    "Show a familiarity heatmap of all AI-generated files. Returns a directory tree with per-file familiarity scores, chunk counts, and a summary. Useful for identifying knowledge gaps.",
    {},
    async () => {
      const files = getAllFileStats();

      if (files.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No AI-generated files tracked yet. Start coding with Grasp to build your familiarity map.",
            },
          ],
        };
      }

      const map = buildMapPlain(files);
      return {
        content: [
          {
            type: "text" as const,
            text: map,
          },
        ],
      };
    }
  );
}
