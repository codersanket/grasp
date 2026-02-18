import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface GeneratedFile {
  path: string;
  content: string;
  merge?: boolean;
}

export function generate(projectDir: string, protocolContent: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  const instructionsPath = join(projectDir, ".github", "copilot-instructions.md");
  const existingContent = existsSync(instructionsPath)
    ? readFileSync(instructionsPath, "utf-8")
    : "";

  if (!existingContent.includes("Grasp Protocol")) {
    const graspSection = `\n\n${protocolContent}`;
    files.push({
      path: instructionsPath,
      content: existingContent + graspSection,
      merge: true,
    });
  }

  return files;
}
