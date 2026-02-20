import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface GeneratedFile {
  path: string;
  content: string;
  merge?: boolean;
}

export interface ServerCommand {
  command: string;
  args: string[];
}

export function generate(projectDir: string, protocolContent: string, serverCommand?: ServerCommand): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  const srv = serverCommand ?? { command: "npx", args: ["-y", "grasp-mcp"] };

  // 1. .cursor/mcp.json — register Grasp MCP server
  const mcpJsonPath = join(projectDir, ".cursor", "mcp.json");
  let mcpConfig: Record<string, any> = { mcpServers: {} };
  if (existsSync(mcpJsonPath)) {
    try {
      mcpConfig = JSON.parse(readFileSync(mcpJsonPath, "utf-8"));
    } catch {
      // Malformed JSON — start fresh
    }
  }
  mcpConfig.mcpServers ??= {};

  mcpConfig.mcpServers.grasp = {
    command: srv.command,
    args: srv.args,
  };

  files.push({
    path: mcpJsonPath,
    content: JSON.stringify(mcpConfig, null, 2),
  });

  // 2. .cursor/rules/grasp.mdc — Grasp protocol as Cursor rule
  const rulePath = join(projectDir, ".cursor", "rules", "grasp.mdc");
  files.push({
    path: rulePath,
    content: `---
description: Grasp comprehension protocol
globs: "**/*"
alwaysApply: true
---

${protocolContent}`,
  });

  return files;
}
