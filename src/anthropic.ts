// Thin wrapper around the Anthropic SDK for generating a single shell command.
// Isolated for testability — tests mock this module to avoid real API calls.

import Anthropic from "@anthropic-ai/sdk";

export interface GenerateOpts {
  readonly apiKey: string;
  readonly model: string;
  readonly systemPrompt: string;
  readonly userPrompt: string;
  readonly maxTokens: number;
  readonly signal?: AbortSignal;
}

export interface GenerateResult {
  readonly text: string;
  readonly stopReason: string | null;
}

/** Strip markdown code fences or inline backticks from LLM output. */
export function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```[A-Za-z]*\n?([\s\S]*?)\n?```\s*$/);
  if (fenced?.[1] !== undefined) return fenced[1].trim();
  if (trimmed.startsWith("`") && trimmed.endsWith("`") && trimmed.length >= 2) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export async function generateCommand(opts: GenerateOpts): Promise<GenerateResult> {
  const client = new Anthropic({ apiKey: opts.apiKey });
  const msg = await client.messages.create(
    {
      model: opts.model,
      max_tokens: opts.maxTokens,
      system: opts.systemPrompt,
      messages: [{ role: "user", content: opts.userPrompt }],
    },
    opts.signal ? { signal: opts.signal } : undefined,
  );
  const block = msg.content[0];
  const text = block?.type === "text" ? block.text : "";
  return { text, stopReason: msg.stop_reason ?? null };
}
