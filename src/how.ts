#!/usr/bin/env bun
// how — Ask Claude for a terminal command, with option to edit, run, or cancel.
//
// Safety contract: stdout carries ONLY the final command the shell wrapper
// should eval. All UI and diagnostics go to stderr so stdout stays clean.
// A non-zero exit or empty stdout means "do not eval".

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { generateCommand, looksLikeShellCommand, stripCodeFences } from "./anthropic.ts";
import { checkDenylist, parseExtraDenylist } from "./denylist.ts";

// Bun-only — hard-fail early if someone ran us under node/npx.
if (typeof Bun === "undefined") {
  process.stderr.write(
    "how: requires bun (https://bun.sh). Install with: curl -fsSL https://bun.sh/install | bash\n",
  );
  process.exit(78);
}

const ACCENT = "\x1b[1;38;2;127;88;255m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

const DEFAULT_MODEL = "claude-sonnet-4-6";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_TOKENS = 512;

/** Write to stderr (all UI output). */
const log = (s: string): void => {
  process.stderr.write(`${s}\n`);
};

interface ParsedArgs {
  readonly query: string;
  readonly autoRun: boolean;
  readonly dryRun: boolean;
  readonly unsafe: boolean;
  readonly showHelp: boolean;
  readonly showVersion: boolean;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const flags = new Set<string>();
  const rest: string[] = [];
  let stopFlags = false;
  for (const arg of argv) {
    if (stopFlags) {
      rest.push(arg);
      continue;
    }
    if (arg === "--") {
      stopFlags = true;
      continue;
    }
    if (arg === "-h" || arg === "--help") flags.add("help");
    else if (arg === "-v" || arg === "--version") flags.add("version");
    else if (arg === "-y" || arg === "--yes") flags.add("yes");
    else if (arg === "-n" || arg === "--dry-run") flags.add("dry-run");
    else if (arg === "--unsafe") flags.add("unsafe");
    else if (arg.startsWith("-") && arg.length > 1) {
      throw new Error(`unknown flag: ${arg}`);
    } else {
      rest.push(arg);
    }
  }
  return {
    query: rest.join(" ").trim(),
    autoRun: flags.has("yes"),
    dryRun: flags.has("dry-run"),
    unsafe: flags.has("unsafe"),
    showHelp: flags.has("help"),
    showVersion: flags.has("version"),
  };
}

function printHelp(): void {
  log(`${ACCENT}how${RESET} — Ask Claude for a terminal command.

Usage: how [options] <what you want to do>

Options:
  -y, --yes          Skip the edit step; still prompts on denylist matches.
  -n, --dry-run      Print the command but do not execute it.
      --unsafe       Disable the denylist for this invocation. Dangerous.
  -h, --help         Show this help.
  -v, --version      Print version and exit.

Environment:
  ANTHROPIC_API_KEY   Required. https://console.anthropic.com/settings/keys
  HOW_MODEL           Override the Claude model (default: ${DEFAULT_MODEL}).
  HOW_TIMEOUT_MS      Request timeout in milliseconds (default: ${DEFAULT_TIMEOUT_MS}).
  HOW_EXTRA_DENY      Newline-separated regexes to add to the safety denylist.
  HOW_ALLOW_ROOT      Set to 1 to permit running as root (refused by default).

Examples:
  how list files larger than 100MB
  how -y show disk usage
  how -n rename every .jpeg to .jpg in this directory

Safety:
  This tool executes shell commands suggested by an LLM. Confirmation is
  required by default; destructive commands (rm, sudo, curl|sh, dd, ...) always
  prompt even with -y. See README for the full threat model.`);
}

function readVersion(): string {
  try {
    const pkgPath = resolve(dirname(import.meta.path), "..", "package.json");
    const raw = readFileSync(pkgPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      typeof (parsed as { version: unknown }).version === "string"
    ) {
      return (parsed as { version: string }).version;
    }
  } catch {
    // fall through
  }
  return "unknown";
}

async function hasGum(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["which", "gum"], { stdout: "ignore", stderr: "ignore" });
    return (await proc.exited) === 0;
  } catch {
    return false;
  }
}

function detectShell(): string {
  const shell = process.env["SHELL"] ?? "";
  if (shell.endsWith("zsh")) return "zsh";
  if (shell.endsWith("fish")) return "fish";
  return "bash";
}

function detectPlatform(): string {
  return process.platform === "darwin"
    ? "macOS"
    : process.platform === "win32"
      ? "Windows"
      : "Linux";
}

function buildSystemPrompt(): string {
  const platform = detectPlatform();
  const shell = detectShell();
  return [
    `You are a terminal command assistant for ${platform} with ${shell}.`,
    "Reply with ONLY the command(s) needed — no explanation, no markdown fences, no commentary.",
    "If multiple commands are needed, join them with && or ;.",
    "Prefer common tools (coreutils, git, jq, curl, etc.).",
    "If the request is ambiguous, dangerous without more context, or cannot be satisfied by a shell command, reply with exactly: REFUSE: <short reason>",
  ].join(" ");
}

interface RunGumInputResult {
  readonly edited: string | null;
  readonly exitCode: number;
}

async function runGumInput(prefill: string): Promise<RunGumInputResult> {
  const proc = Bun.spawn(
    [
      "gum",
      "input",
      "--value",
      prefill,
      "--width",
      "0",
      "--char-limit",
      "0",
      "--prompt",
      "$ ",
      "--prompt.foreground",
      "#7F58FF",
      "--prompt.bold",
      "--cursor.foreground",
      "#7F58FF",
    ],
    { stdout: "pipe", stderr: "inherit" },
  );
  const edited = (await new Response(proc.stdout).text()).trimEnd();
  const exitCode = await proc.exited;
  if (exitCode !== 0 || !edited) {
    return { edited: null, exitCode };
  }
  return { edited, exitCode };
}

async function plainLineInput(prefill: string): Promise<string | null> {
  log(`${ACCENT}$${RESET} ${prefill}`);
  process.stderr.write(`${DIM}(enter to run, ctrl-c to cancel)${RESET} `);
  try {
    const buf = Buffer.alloc(8192);
    const fs = await import("node:fs");
    const n = fs.readSync(0, buf, 0, buf.length, null);
    const input = buf.subarray(0, n).toString("utf8").trimEnd();
    return input.length === 0 ? prefill : input;
  } catch {
    return null;
  }
}

/** Type `yes` to override a denylist match. */
async function typedConfirmation(): Promise<boolean> {
  process.stderr.write(`Type ${RED}yes${RESET} to run anyway, anything else cancels: `);
  try {
    const buf = Buffer.alloc(32);
    const fs = await import("node:fs");
    const n = fs.readSync(0, buf, 0, buf.length, null);
    return buf.subarray(0, n).toString("utf8").trim() === "yes";
  } catch {
    return false;
  }
}

async function startSpinner(gum: boolean): Promise<() => void> {
  if (!gum) {
    process.stderr.write(`${ACCENT}Thinking...${RESET}`);
    return () => process.stderr.write("\r\x1b[K");
  }
  const spinner = Bun.spawn(
    [
      "gum",
      "spin",
      "--spinner",
      "dot",
      "--title",
      "Thinking...",
      "--spinner.foreground",
      "#7F58FF",
      "--",
      "sleep",
      "3600",
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
  return () => {
    spinner.kill();
  };
}

function requireRootPolicy(env: Record<string, string | undefined>): void {
  const uid = typeof process.getuid === "function" ? process.getuid() : -1;
  if (uid === 0 && env["HOW_ALLOW_ROOT"] !== "1") {
    log(
      `${RED}how: refusing to run as root.${RESET} Set HOW_ALLOW_ROOT=1 to override — you assume full responsibility for anything the LLM suggests.`,
    );
    process.exit(77);
  }
}

export interface RunOpts {
  readonly argv: readonly string[];
  readonly env: Record<string, string | undefined>;
}

export async function run(opts: RunOpts): Promise<number> {
  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(opts.argv);
  } catch (e) {
    log(`${RED}how: ${e instanceof Error ? e.message : String(e)}${RESET}`);
    log("Run `how --help` for usage.");
    return 64;
  }

  if (parsed.showHelp) {
    printHelp();
    return 0;
  }
  if (parsed.showVersion) {
    process.stdout.write(""); // ensure stdout stays empty of command
    log(readVersion());
    return 0;
  }
  if (parsed.query.length === 0) {
    printHelp();
    return 64;
  }

  requireRootPolicy(opts.env);

  const apiKey = opts.env["ANTHROPIC_API_KEY"];
  if (!apiKey || apiKey.trim().length === 0) {
    log(`${RED}how: ANTHROPIC_API_KEY is not set.${RESET}`);
    log("Get a key: https://console.anthropic.com/settings/keys");
    log(`Then: ${DIM}export ANTHROPIC_API_KEY=sk-ant-...${RESET}`);
    return 78;
  }

  const model = opts.env["HOW_MODEL"]?.trim() || DEFAULT_MODEL;
  const timeoutMs = Number(opts.env["HOW_TIMEOUT_MS"] ?? DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    log(`${RED}how: HOW_TIMEOUT_MS must be a positive number.${RESET}`);
    return 78;
  }

  let extraDeny: readonly RegExp[] = [];
  try {
    extraDeny = parseExtraDenylist(opts.env["HOW_EXTRA_DENY"]);
  } catch (e) {
    log(`${RED}how: ${e instanceof Error ? e.message : String(e)}${RESET}`);
    return 78;
  }

  const gum = await hasGum();
  const stopSpinner = await startSpinner(gum);

  let raw: string;
  try {
    const signal = AbortSignal.timeout(timeoutMs);
    const result = await generateCommand({
      apiKey,
      model,
      systemPrompt: buildSystemPrompt(),
      userPrompt: parsed.query,
      maxTokens: DEFAULT_MAX_TOKENS,
      signal,
    });
    raw = result.text;
  } catch (e) {
    stopSpinner();
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof Error && e.name === "TimeoutError") {
      log(`${RED}how: request timed out after ${timeoutMs}ms.${RESET}`);
      return 75;
    }
    log(`${RED}how: API call failed: ${msg}${RESET}`);
    return 1;
  }
  stopSpinner();

  const cmd = stripCodeFences(raw);
  if (cmd.length === 0) {
    log(`${RED}how: model returned no output.${RESET}`);
    return 1;
  }
  if (cmd.trim().toUpperCase().startsWith("REFUSE:")) {
    log(`${YELLOW}how: model refused — ${cmd.trim().slice(7).trim()}${RESET}`);
    return 1;
  }
  if (!looksLikeShellCommand(cmd)) {
    log(`${RED}how: model did not return a shell command. Raw output:${RESET}`);
    log(cmd);
    return 1;
  }

  // Denylist check — runs even when -y is passed, unless --unsafe.
  const denyMatch = parsed.unsafe ? null : checkDenylist(cmd, extraDeny);
  if (denyMatch) {
    log(`${ACCENT}$${RESET} ${cmd}`);
    log(`${RED}⚠  DANGER:${RESET} ${denyMatch.reason} (/${denyMatch.pattern.source}/)`);
    log(`${DIM}Pass --unsafe to disable the denylist, or edit the command below.${RESET}`);
    if (parsed.dryRun) {
      log(`${DIM}(dry run — not executing)${RESET}`);
      return 0;
    }
    const proceed = await typedConfirmation();
    if (!proceed) {
      log(`${DIM}cancelled${RESET}`);
      return 130;
    }
  }

  let final = cmd;
  if (!parsed.autoRun && !denyMatch) {
    if (gum) {
      const { edited, exitCode } = await runGumInput(cmd);
      if (edited === null) {
        const up = exitCode === 130 ? 2 : 1;
        process.stderr.write(`\x1b[${up}A\x1b[J`);
        log(`${ACCENT}$${RESET} ${cmd}`);
        log(`${DIM}cancelled${RESET}`);
        return exitCode === 0 ? 130 : exitCode;
      }
      final = edited;
      log(`${ACCENT}$${RESET} ${final}`);
    } else {
      const input = await plainLineInput(cmd);
      if (input === null) {
        log(`\n${DIM}cancelled${RESET}`);
        return 130;
      }
      final = input;
    }
  } else if (parsed.autoRun && !denyMatch) {
    log(`${ACCENT}$${RESET} ${final}`);
  }

  // If the user edited and the new command hits the denylist, re-confirm.
  if (!parsed.unsafe && final !== cmd) {
    const reMatch = checkDenylist(final, extraDeny);
    if (reMatch) {
      log(`${RED}⚠  Edited command still matches denylist:${RESET} ${reMatch.reason}`);
      const ok = parsed.dryRun ? false : await typedConfirmation();
      if (!ok) {
        log(`${DIM}cancelled${RESET}`);
        return 130;
      }
    }
  }

  if (parsed.dryRun) {
    log(`${DIM}(dry run — not executing)${RESET}`);
    return 0;
  }

  // Print the final command to stdout for the shell wrapper to eval.
  process.stdout.write(`${final}\n`);
  return 0;
}

if (import.meta.main) {
  // Double-SIGINT pattern: first Ctrl+C aborts the in-flight request,
  // second forces exit. Bun wires AbortSignal.timeout() through fetch.
  let sigintCount = 0;
  process.on("SIGINT", () => {
    sigintCount += 1;
    if (sigintCount >= 2) process.exit(130);
  });
  const code = await run({ argv: process.argv.slice(2), env: process.env });
  process.exit(code);
}
