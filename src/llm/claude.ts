import type { LLMAdapter, LLMResponse } from "./adapter.js";

export class ClaudeAdapter implements LLMAdapter {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model ?? "claude-sonnet-4-5-20250929";
  }

  async generate(
    prompt: string,
    options?: { system?: string; maxTokens?: number }
  ): Promise<LLMResponse> {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options?.maxTokens ?? 1024,
        system: options?.system,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    const text = data.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");

    return { text };
  }
}
