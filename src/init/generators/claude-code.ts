import { readFileSync, existsSync } from "node:fs";
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
    try {
      settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    } catch {
      // Malformed JSON — start fresh
    }
  }

  const hookConfig = generateHookConfig();

  // Merge hook config — append to existing hooks if present, per-matcher deduplication
  const existingHooks = (settings.hooks ?? {}) as Record<string, unknown[]>;
  const newHooks = hookConfig.hooks;

  for (const [eventName, hookEntries] of Object.entries(newHooks)) {
    const existing = (existingHooks[eventName] ?? []) as Array<{ matcher: string }>;
    const toAdd = (hookEntries as Array<{ matcher: string }>).filter((entry) => {
      // Only add if no existing Grasp hook for this specific matcher
      return !existing.some(
        (h) => h.matcher === entry.matcher && JSON.stringify(h).includes("grasp-hook")
      );
    });
    existingHooks[eventName] = [...existing, ...toAdd];
  }

  settings.hooks = existingHooks;

  files.push({
    path: settingsPath,
    content: JSON.stringify(settings, null, 2),
  });

  return files;
}
