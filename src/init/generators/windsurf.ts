import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { upsertProtocolSection } from "../protocol-section.js";

export interface GeneratedFile {
  path: string;
  content: string;
  merge?: boolean;
}

export function generate(projectDir: string, protocolContent: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  const rulesPath = join(projectDir, ".windsurfrules");
  const existingContent = existsSync(rulesPath)
    ? readFileSync(rulesPath, "utf-8")
    : "";

  const result = upsertProtocolSection(existingContent, protocolContent);
  if (result.action !== "unchanged") {
    files.push({
      path: rulesPath,
      content: result.content,
      merge: true,
    });
  }

  return files;
}
