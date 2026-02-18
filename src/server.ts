import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDatabase } from "./storage/db.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "grasp",
    version: "0.1.0",
  });

  // Initialize database eagerly on server creation
  const db = getDatabase();

  server.tool(
    "grasp_ping",
    "Check Grasp server status and database connection.",
    {},
    async () => {
      const tables = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        .all() as { name: string }[];

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                status: "ok",
                version: "0.1.0",
                tables: tables.map((t) => t.name),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  return server;
}
