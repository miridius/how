#!/usr/bin/env bun
// how-init — emit a shell function wiring `how` in the current shell.
//
// Usage: eval "$(bun /path/to/src/init.ts zsh)"
//    or: eval "$(how-init zsh)"    # when installed via npm/bun install -g
//
// Why a shell function? The generated command must run in the caller's
// current shell (so cwd / env / aliases / functions apply) AND the command
// must be appended to shell history. Neither is possible from a child process.

import { dirname, resolve } from "node:path";

const KNOWN_SHELLS = new Set(["zsh", "bash", "fish"]);

function detectDefaultShell(): string {
  const shell = process.env["SHELL"] ?? "";
  if (shell.endsWith("zsh")) return "zsh";
  if (shell.endsWith("fish")) return "fish";
  return "bash";
}

function resolveHowBin(): string {
  // If `how-bin` is on PATH (npm-install path), prefer it. Otherwise fall back
  // to `bun /abs/path/how.ts` (clone-install path), baking in our sibling.
  const fromPath = Bun.which("how-bin");
  if (fromPath) return JSON.stringify(fromPath);
  const howPath = resolve(dirname(import.meta.path), "how.ts");
  return `bun ${JSON.stringify(howPath)}`;
}

function emitZsh(howBin: string): string {
  return `# how — https://github.com/miridius/how
how() {
  emulate -L zsh
  setopt local_options no_notify no_monitor
  local cmd
  cmd="$(${howBin} "$@")" || return $?
  [[ -z "$cmd" ]] && return 0
  print -s -- "$cmd"
  eval -- "$cmd"
}
`;
}

function emitBash(howBin: string): string {
  return `# how — https://github.com/miridius/how
how() {
  local cmd
  cmd="$(${howBin} "$@")" || return $?
  [[ -z "$cmd" ]] && return 0
  history -s -- "$cmd"
  eval -- "$cmd"
}
`;
}

function emitFish(howBin: string): string {
  // fish has no direct history append builtin, but it reads fish_history
  // (a YAML-ish file) at shell exit; the \`history merge\` builtin picks up
  // newly-written entries. We append with ISO timestamp.
  const parts = howBin.split(" ");
  const cmdInvocation =
    parts.length === 1 ? `${parts[0]} $argv` : `${parts[0]} ${parts.slice(1).join(" ")} $argv`;
  return `# how — https://github.com/miridius/how
function how
  set -l cmd (${cmdInvocation})
  or return $status
  test -z "$cmd"; and return 0
  set -l hist_file "$__fish_user_data_dir/fish_history"
  test -z "$__fish_user_data_dir"; and set hist_file "$HOME/.local/share/fish/fish_history"
  printf -- '- cmd: %s\\n  when: %s\\n' "$cmd" (date +%s) >> $hist_file
  history merge 2>/dev/null; or true
  eval $cmd
end
`;
}

const shellArg = process.argv[2] ?? detectDefaultShell();
if (!KNOWN_SHELLS.has(shellArg)) {
  process.stderr.write(
    `how-init: unknown shell "${shellArg}". Supported: ${[...KNOWN_SHELLS].join(", ")}.\n`,
  );
  process.exit(64);
}

const howBin = resolveHowBin();
const emitted =
  shellArg === "zsh" ? emitZsh(howBin) : shellArg === "bash" ? emitBash(howBin) : emitFish(howBin);

process.stdout.write(emitted);
