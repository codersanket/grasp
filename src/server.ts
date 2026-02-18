import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getDatabase } from "./storage/db.js";
import { registerStartTask } from "./tools/start-task.js";
import { registerLogChunk } from "./tools/log-chunk.js";
import { registerCheck } from "./tools/check.js";
import { registerRecord } from "./tools/record.js";
import { registerScore } from "./tools/score.js";
import { registerContext } from "./tools/context.js";

function getVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "..", "package.json"), "utf-8"));
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "grasp",
    version: getVersion(),
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
