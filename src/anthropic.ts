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

/**
 * Shape check: does the LLM output look like a shell command rather than prose?
 * This is a cheap refusal gate — if the model returned an apology, a refusal,
 * or a multi-paragraph explanation, we do NOT want to execute the first line.
 */
export function looksLikeShellCommand(candidate: string): boolean {
  if (!candidate) return false;
  const lines = candidate.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return false;
  // Explicit refusal prefix we ask the model to use.
  if (/^REFUSE:/i.test(candidate.trim())) return false;
  // Reject prose-like outputs: multiple sentences ending in punctuation,
  // or leading capital + verb-like phrasing ("To list files, run ...").
  const first = lines[0];
  if (first === undefined) return false;
  // More than two lines is suspicious unless it's a heredoc or line continuation.
  if (lines.length > 5) return false;
  // Command-ish heuristic: starts with an alphanumeric token or common shell
  // syntax (variable assignment, subshell, etc.), and does not contain an
  // obvious apology marker.
  if (/^(I (can|cannot|can't|am|'m|will|would)|Sorry|Here's|Here is|To )/.test(first)) return false;
  if (!/^[A-Za-z0-9_/.({$"'-]/.test(first)) return false;
  return true;
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
