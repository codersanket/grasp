import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";

export interface DetectedTool {
  name: string;
  detected: boolean;
  configPath: string | null;
}

function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function detectTools(projectDir: string): DetectedTool[] {
  const tools: DetectedTool[] = [];

  // Claude Code
  const claudeDetected =
    commandExists("claude") || existsSync(join(homedir(), ".claude"));
  tools.push({
    name: "claude-code",
    detected: claudeDetected,
    configPath: claudeDetected ? join(projectDir, ".mcp.json") : null,
  });

  // Cursor
  const cursorDetected =
    existsSync(join(projectDir, ".cursor")) || commandExists("cursor");
  tools.push({
    name: "cursor",
    detected: cursorDetected,
    configPath: cursorDetected ? join(projectDir, ".cursor", "mcp.json") : null,
  });

  // Codex (OpenAI)
  const codexDetected =
    commandExists("codex") || existsSync(join(projectDir, "AGENTS.md"));
  tools.push({
    name: "codex",
    detected: codexDetected,
    configPath: codexDetected ? join(projectDir, "AGENTS.md") : null,
  });

  // GitHub Copilot
  const copilotDetected = existsSync(
    join(projectDir, ".github", "copilot-instructions.md")
  );
  tools.push({
    name: "copilot",
    detected: copilotDetected,
    configPath: copilotDetected
      ? join(projectDir, ".github", "copilot-instructions.md")
      : null,
  });

  // Windsurf
  const windsurfDetected =
    existsSync(join(projectDir, ".windsurfrules")) ||
    commandExists("windsurf");
  tools.push({
    name: "windsurf",
    detected: windsurfDetected,
    configPath: windsurfDetected
      ? join(projectDir, ".windsurfrules")
      : null,
  });

  // Gemini CLI
  const geminiDetected =
    commandExists("gemini") || existsSync(join(projectDir, "GEMINI.md"));
  tools.push({
    name: "gemini",
    detected: geminiDetected,
    configPath: geminiDetected ? join(projectDir, "GEMINI.md") : null,
  });

  return tools;
}
