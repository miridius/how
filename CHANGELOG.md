# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] — 2026-04-24

Initial public release, extracted from the author's personal dotfiles.

### Added

- `how` CLI — natural-language prompt → shell command via Claude, with
  edit / run / cancel flow.
- `-y` / `--yes` flag for unattended execution (still gated by denylist).
- `-n` / `--dry-run` flag to print without executing.
- `--unsafe` flag to bypass the denylist for a single invocation.
- Shell-function emitter (`src/init.ts`) for zsh / bash / fish. Preserves
  shell state, cwd, and history across `eval`.
- Configuration via env vars: `ANTHROPIC_API_KEY`, `HOW_MODEL`,
  `HOW_TIMEOUT_MS`, `HOW_EXTRA_DENY`, `HOW_ALLOW_ROOT`.
- `bun:test` suite covering arg parsing, env handling, refusal protocol,
  denylist, and timeout handling. Anthropic SDK mocked via
  `test/preload.ts`.

### Safety

- Default denylist covering `sudo`, unbounded `rm`, piped curl/wget into
  shell, `dd`/`mkfs`, fork bombs, destructive git operations.
- Refuse-to-execute protocol: model may return `REFUSE: <reason>`;
  prose-like responses are rejected rather than executed.
- Root refusal unless `HOW_ALLOW_ROOT=1`.
- Bounded request: 512 max output tokens, 30s timeout.

_This release was primarily authored by Claude under human review.
See commit trailers for per-commit provenance._

[Unreleased]: https://github.com/miridius/how/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/miridius/how/releases/tag/v0.1.0
