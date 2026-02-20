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

  const instructionsPath = join(projectDir, ".github", "copilot-instructions.md");
  const existingContent = existsSync(instructionsPath)
    ? readFileSync(instructionsPath, "utf-8")
    : "";

  const result = upsertProtocolSection(existingContent, protocolContent);
  if (result.action !== "unchanged") {
    files.push({
      path: instructionsPath,
      content: result.content,
      merge: true,
    });
  }

  return files;
}
