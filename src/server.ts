import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDatabase } from "./storage/db.js";
import { registerStartTask } from "./tools/start-task.js";
import { registerLogChunk } from "./tools/log-chunk.js";
import { registerCheck } from "./tools/check.js";
import { registerRecord } from "./tools/record.js";
import { registerScore } from "./tools/score.js";
import { registerContext } from "./tools/context.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "grasp",
    version: "0.1.0",
  });

  // Initialize database eagerly on server creation
  getDatabase();

  // Register all tools
  registerStartTask(server);
  registerLogChunk(server);
  registerCheck(server);
  registerRecord(server);
  registerScore(server);
  registerContext(server);

  return server;
}
