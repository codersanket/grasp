import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { upsertProtocolSection } from "../protocol-section.js";

export interface GeneratedFile {
  path: string;
  content: string;
  merge?: boolean;
}

export function generate(projectDir: string, protocolContent: string, _serverCommand?: unknown): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // AGENTS.md — add or update Grasp protocol section
  const agentsMdPath = join(projectDir, "AGENTS.md");
  const existingContent = existsSync(agentsMdPath)
    ? readFileSync(agentsMdPath, "utf-8")
    : "";

  const result = upsertProtocolSection(existingContent, protocolContent);
  if (result.action !== "unchanged") {
    files.push({
      path: agentsMdPath,
      content: result.content,
      merge: true,
    });
  }

  return files;
}
