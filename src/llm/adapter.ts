export interface LLMResponse {
  text: string;
}

export interface LLMAdapter {
  generate(prompt: string, options?: { system?: string; maxTokens?: number }): Promise<LLMResponse>;
}

export type LLMProvider = "claude" | "openai" | "ollama";

export interface LLMConfig {
  provider: LLMProvider;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

export async function createLLMAdapter(config?: LLMConfig): Promise<LLMAdapter> {
  const resolved = resolveConfig(config);

  switch (resolved.provider) {
    case "claude": {
      const { ClaudeAdapter } = await import("./claude.js");
      return new ClaudeAdapter(resolved.apiKey!, resolved.model);
    }
    case "openai": {
      const { OpenAIAdapter } = await import("./openai.js");
      return new OpenAIAdapter(resolved.apiKey!, resolved.model);
    }
    case "ollama": {
      const { OllamaAdapter } = await import("./ollama.js");
      return new OllamaAdapter(resolved.baseUrl, resolved.model);
    }
    default:
      throw new Error(`Unknown LLM provider: ${resolved.provider}`);
  }
}

function resolveConfig(config?: LLMConfig): LLMConfig {
  // Explicit config takes priority
  if (config?.provider && config?.apiKey) return config;

  // Auto-detect from environment
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (config?.provider === "claude" || (!config?.provider && anthropicKey)) {
    return {
      provider: "claude",
      apiKey: config?.apiKey ?? anthropicKey,
      model: config?.model ?? "claude-sonnet-4-5-20250929",
    };
  }

  if (config?.provider === "openai" || (!config?.provider && openaiKey)) {
    return {
      provider: "openai",
      apiKey: config?.apiKey ?? openaiKey,
      model: config?.model ?? "gpt-4o-mini",
    };
  }

  // Fallback to Ollama (no API key needed)
  return {
    provider: "ollama",
    baseUrl: config?.baseUrl ?? "http://localhost:11434",
    model: config?.model ?? "llama3.2",
  };
}
