import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface GeneratedFile {
  path: string;
  content: string;
  merge?: boolean;
}

export function generate(projectDir: string, protocolContent: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // AGENTS.md — add Grasp protocol section
  const agentsMdPath = join(projectDir, "AGENTS.md");
  const existingContent = existsSync(agentsMdPath)
    ? readFileSync(agentsMdPath, "utf-8")
    : "";

  if (!existingContent.includes("Grasp Protocol")) {
    const graspSection = `\n\n${protocolContent}`;
    files.push({
      path: agentsMdPath,
      content: existingContent + graspSection,
      merge: true,
    });
  }

  return files;
}
