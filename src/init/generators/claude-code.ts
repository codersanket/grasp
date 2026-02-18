import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface GeneratedFile {
  path: string;
  content: string;
  merge?: boolean;
}

export function generate(projectDir: string, protocolContent: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // 1. .mcp.json — register Grasp MCP server
  const mcpJsonPath = join(projectDir, ".mcp.json");
  const mcpConfig = existsSync(mcpJsonPath)
    ? JSON.parse(readFileSync(mcpJsonPath, "utf-8"))
    : { mcpServers: {} };

  mcpConfig.mcpServers.grasp = {
    type: "stdio",
    command: "npx",
    args: ["-y", "grasp-mcp"],
  };

  files.push({
    path: mcpJsonPath,
    content: JSON.stringify(mcpConfig, null, 2),
  });

  // 2. CLAUDE.md — add Grasp protocol rules
  const claudeMdPath = join(projectDir, "CLAUDE.md");
  const existingContent = existsSync(claudeMdPath)
    ? readFileSync(claudeMdPath, "utf-8")
    : "";

  if (!existingContent.includes("Grasp Protocol")) {
    const graspSection = `\n\n${protocolContent}`;
    files.push({
      path: claudeMdPath,
      content: existingContent + graspSection,
      merge: true,
    });
  }

  return files;
}
