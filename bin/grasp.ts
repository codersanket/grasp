#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { detectTools } from "../src/init/detector.js";
import { generate as generateClaudeCode } from "../src/init/generators/claude-code.js";
import { generate as generateCursor } from "../src/init/generators/cursor.js";
import { generate as generateCodex } from "../src/init/generators/codex.js";
import { generate as generateCopilot } from "../src/init/generators/copilot.js";
import { generate as generateWindsurf } from "../src/init/generators/windsurf.js";
import { generate as generateGemini } from "../src/init/generators/gemini.js";
import { calculateOverallScore } from "../src/engine/score-calculator.js";
import { getDatabase } from "../src/storage/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const program = new Command();

program
  .name("grasp")
  .description("Know your code. Own your code.")
  .version("0.1.0");

// ── grasp init ─────────────────────────────────────────────

program
  .command("init")
  .description("Auto-detect AI tools and configure Grasp for this project")
  .action(async () => {
    const projectDir = process.cwd();
    console.log("\n  Grasp — Know your code. Own your code.\n");

    // Load protocol template
    const templateDir = join(__dirname, "..", "..", "templates");
    const protocolPath = join(templateDir, "protocol.md");

    if (!existsSync(protocolPath)) {
      console.error("  Error: Protocol template not found at", protocolPath);
      process.exit(1);
    }

    const protocol = readFileSync(protocolPath, "utf-8");

    // Detect tools
    console.log("  Detecting AI tools...\n");
    const tools = detectTools(projectDir);
    const detected = tools.filter((t) => t.detected);

    if (detected.length === 0) {
      console.log("  No AI coding tools detected.");
      console.log("  Grasp supports: Claude Code, Cursor, Codex, Copilot, Windsurf, Gemini CLI");
      console.log("  Install one and run 'grasp init' again.\n");
      return;
    }

    // Generate configs for each detected tool
    const generators: Record<string, (dir: string, proto: string) => Array<{ path: string; content: string }>> = {
      "claude-code": generateClaudeCode,
      cursor: generateCursor,
      codex: generateCodex,
      copilot: generateCopilot,
      windsurf: generateWindsurf,
      gemini: generateGemini,
    };

    let filesWritten = 0;

    for (const tool of detected) {
      const generator = generators[tool.name];
      if (!generator) continue;

      console.log(`  ✓ ${formatToolName(tool.name)} detected`);
      const files = generator(projectDir, protocol);

      for (const file of files) {
        mkdirSync(dirname(file.path), { recursive: true });
        writeFileSync(file.path, file.content, "utf-8");
        const relativePath = file.path.replace(projectDir + "/", "");
        console.log(`    → ${relativePath}`);
        filesWritten++;
      }
    }

    const notDetected = tools.filter((t) => !t.detected);
    if (notDetected.length > 0) {
      console.log(`\n  Not detected: ${notDetected.map((t) => formatToolName(t.name)).join(", ")}`);
    }

    console.log(`\n  Done. ${filesWritten} files configured.`);
    console.log("  Your AI tools will now follow the Grasp protocol.\n");
  });

// ── grasp score ────────────────────────────────────────────

program
  .command("score")
  .description("Show your comprehension score")
  .action(async () => {
    getDatabase();
    const score = calculateOverallScore();

    console.log("\n  Grasp — Comprehension Score\n");
    console.log(`  Overall: ${score.overall}/100\n`);
    console.log("  Breakdown:");
    console.log(`    Quiz pass rate:   ${score.breakdown.quiz}%`);
    console.log(`    Modification:     ${score.breakdown.modification}%`);
    console.log(`    Review depth:     ${score.breakdown.review_depth}%`);
    console.log(`    Skip rate:        ${score.breakdown.skip_rate}% (inverse)`);
    console.log(`    Engagement:       ${score.breakdown.streak}%`);
    console.log(`\n  Raw data:`);
    console.log(`    Questions: ${score.raw.questions_passed}/${score.raw.questions_total} passed`);
    console.log(`    Skipped: ${score.raw.questions_skipped}`);
    console.log(`    Code chunks tracked: ${score.raw.chunks_total}\n`);
  });

// ── grasp status ───────────────────────────────────────────

program
  .command("status")
  .description("Show which AI tools are configured for Grasp")
  .action(async () => {
    const projectDir = process.cwd();
    const tools = detectTools(projectDir);

    console.log("\n  Grasp — Tool Status\n");
    for (const tool of tools) {
      const icon = tool.detected ? "✓" : "✗";
      console.log(`  ${icon} ${formatToolName(tool.name)}`);
    }
    console.log("");
  });

function formatToolName(name: string): string {
  const names: Record<string, string> = {
    "claude-code": "Claude Code",
    cursor: "Cursor",
    codex: "OpenAI Codex",
    copilot: "GitHub Copilot",
    windsurf: "Windsurf",
    gemini: "Gemini CLI",
  };
  return names[name] ?? name;
}

program.parse();
