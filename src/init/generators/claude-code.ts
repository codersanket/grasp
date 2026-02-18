import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { generateHookConfig } from "../../hooks/adapters/claude-code.js";

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

  // 3. .claude/settings.json — register hooks for enforcement
  const claudeDir = join(projectDir, ".claude");
  const settingsPath = join(claudeDir, "settings.json");

  let settings: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
  }

  const hookConfig = generateHookConfig();

  // Merge hook config — append to existing hooks if present
  const existingHooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
  const newHooks = hookConfig.hooks;

  for (const [eventName, hookEntries] of Object.entries(newHooks)) {
    const existing = (existingHooks[eventName] ?? []) as Array<{ matcher: string }>;
    // Only add if no existing Grasp hook for this event
    const hasGraspHook = existing.some(
      (h) => h.matcher === "Write|Edit" && JSON.stringify(h).includes("grasp-hook")
    );
    if (!hasGraspHook) {
      existingHooks[eventName] = [...existing, ...hookEntries];
    }
  }

  settings.hooks = existingHooks;

  files.push({
    path: settingsPath,
    content: JSON.stringify(settings, null, 2),
  });

  return files;
}
