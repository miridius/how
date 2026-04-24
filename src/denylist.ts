// Default denylist for commands that always require explicit confirmation,
// even when --yes / -y is passed. Patterns are case-sensitive regexes matched
// against the full generated command string.
//
// The goal is not to block every possible foot-gun (impossible), but to catch
// the most common LLM hallucinations and prompt-injection outcomes that
// frequently appear in AI-CLI incident reports: unbounded rm, piped curl into
// shell, dd/mkfs onto disks, fork bombs, sudo escalation.

export const DEFAULT_DENYLIST: readonly RegExp[] = [
  // sudo — any privilege escalation
  /\bsudo\b/,
  // rm with -r or -f (including combined -rf, -fr, etc.)
  /\brm\s+(-[A-Za-z]*[rRfF][A-Za-z]*|--recursive|--force)\b/,
  // rm targeting / or $HOME or *
  /\brm\s+.*(\s|^)(\/|\$HOME|~)(\s|$)/,
  // chmod wide-open or recursive on root-ish paths
  /\bchmod\s+(-R\s+)?[0-7]*7[0-7]*7\b/,
  /\bchmod\s+(-R\s+)?[0-7]{3,4}\s+\//,
  // chown recursive
  /\bchown\s+-R\b/,
  // dd to a device
  /\bdd\s+.*of=\/dev\//,
  // mkfs
  /\bmkfs(\.|\s)/,
  // Filesystem wipers
  /\b(shred|wipe)\b/,
  // curl/wget piped to shell
  /\b(curl|wget|fetch)\b[^|]*\|\s*(sudo\s+)?(sh|bash|zsh|fish|python|node|bun|ruby|perl)\b/,
  // Redirect to block device
  />\s*\/dev\/sd[a-z]/,
  />\s*\/dev\/nvme/,
  />\s*\/dev\/disk/,
  // Fork bomb
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
  // git destructive
  /\bgit\s+push\s+.*--force(-with-lease)?\b/,
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+clean\s+-[A-Za-z]*[fF][dx]?[A-Za-z]*\b/,
  // history manipulation
  /\bhistory\s+-c\b/,
  // eval of dynamic content
  /\beval\s+["'`$]/,
  // Process all / kill -9 -1
  /\bkill(all)?\s+-9\s+-1\b/,
];

export interface DenyMatch {
  readonly pattern: RegExp;
  readonly reason: string;
}

export function describeMatch(pattern: RegExp): string {
  const source = pattern.source;
  if (source.includes("sudo")) return "privilege escalation (sudo)";
  if (source.includes("rm")) return "recursive/forceful file deletion";
  if (source.includes("chmod")) return "broad permission change";
  if (source.includes("chown")) return "recursive ownership change";
  if (source.includes("dd")) return "raw disk write (dd)";
  if (source.includes("mkfs")) return "filesystem creation";
  if (source.includes("shred") || source.includes("wipe")) return "irrecoverable data wipe";
  if (source.includes("curl") || source.includes("wget")) return "remote code piped to shell";
  if (source.includes("/dev/sd") || source.includes("/dev/nvme") || source.includes("/dev/disk"))
    return "redirect to block device";
  if (source.includes(":()")) return "fork bomb";
  if (source.includes("git")) return "destructive git operation";
  if (source.includes("history")) return "shell history deletion";
  if (source.includes("eval")) return "dynamic eval";
  if (source.includes("kill")) return "mass process kill";
  return "matches denylist pattern";
}

/** Compile extra patterns from an env var (newline-separated JS regex sources). */
export function parseExtraDenylist(raw: string | undefined): RegExp[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      try {
        return new RegExp(line);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`HOW_EXTRA_DENY has invalid regex ${JSON.stringify(line)}: ${msg}`);
      }
    });
}

export function checkDenylist(command: string, extra: readonly RegExp[] = []): DenyMatch | null {
  for (const pattern of [...DEFAULT_DENYLIST, ...extra]) {
    if (pattern.test(command)) {
      return { pattern, reason: describeMatch(pattern) };
    }
  }
  return null;
}
