import type { LLMAdapter, LLMResponse } from "./adapter.js";

export class OpenAIAdapter implements LLMAdapter {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model ?? "gpt-4o-mini";
  }

  async generate(
    prompt: string,
    options?: { system?: string; maxTokens?: number }
  ): Promise<LLMResponse> {
    const messages: Array<{ role: string; content: string }> = [];
    if (options?.system) {
      messages.push({ role: "system", content: options.system });
    }
    messages.push({ role: "user", content: prompt });

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options?.maxTokens ?? 1024,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    return { text: data.choices[0]?.message?.content ?? "" };
  }
}
