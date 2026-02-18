import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { LLMConfig, LLMProvider } from "./llm/adapter.js";

export interface GraspConfig {
  llm: LLMConfig;
}

let cachedConfig: GraspConfig | null = null;

export function getConfig(): GraspConfig {
  if (cachedConfig) return cachedConfig;

  // Try project config first, then global
  const projectPath = join(process.cwd(), "grasp.config.json");
  const globalPath = join(homedir(), ".grasp", "config.json");

  const configPath = existsSync(projectPath) ? projectPath : existsSync(globalPath) ? globalPath : null;

  if (configPath) {
    try {
      const raw = readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<GraspConfig>;
      cachedConfig = {
        llm: {
          provider: (parsed.llm?.provider ?? detectProvider()) as LLMProvider,
          model: parsed.llm?.model,
          apiKey: parsed.llm?.apiKey,
          baseUrl: parsed.llm?.baseUrl,
        },
      };
      return cachedConfig;
    } catch {
      // Fall through to defaults
    }
  }

  cachedConfig = {
    llm: {
      provider: detectProvider(),
    },
  };
  return cachedConfig;
}

function detectProvider(): LLMProvider {
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "ollama";
}
