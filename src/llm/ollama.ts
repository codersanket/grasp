import type { LLMAdapter, LLMResponse } from "./adapter.js";

export class OllamaAdapter implements LLMAdapter {
  private baseUrl: string;
  private model: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = baseUrl ?? "http://localhost:11434";
    this.model = model ?? "llama3.2";
  }

  async generate(
    prompt: string,
    options?: { system?: string; maxTokens?: number }
  ): Promise<LLMResponse> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt,
        system: options?.system,
        stream: false,
        options: {
          num_predict: options?.maxTokens ?? 1024,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as { response: string };
    return { text: data.response };
  }
}
