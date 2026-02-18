import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface GeneratedFile {
  path: string;
  content: string;
  merge?: boolean;
}

export function generate(projectDir: string, protocolContent: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  const geminiMdPath = join(projectDir, "GEMINI.md");
  const existingContent = existsSync(geminiMdPath)
    ? readFileSync(geminiMdPath, "utf-8")
    : "";

  if (!existingContent.includes("Grasp Protocol")) {
    const graspSection = `\n\n${protocolContent}`;
    files.push({
      path: geminiMdPath,
      content: existingContent + graspSection,
      merge: true,
    });
  }

  return files;
}
