# Contributing to `how`

Thanks for considering a contribution.

## Before you start

- Open an issue first for anything larger than a doc fix or one-line
  change. A maintainer will confirm scope before you invest effort.
- Read [AI_POLICY.md](./AI_POLICY.md) if you're using an AI coding
  assistant — disclosure is required.

## Development setup

```sh
git clone https://github.com/miridius/how.git
cd how
bun install
bun run check          # typecheck + lint + tests
```

Required:

- bun ≥ 1.2.4
- `ANTHROPIC_API_KEY` *only if* you want to exercise real API calls. Tests
  mock the SDK, so unit tests run offline.

## What we look for in a PR

1. **Small, focused diff.** One concern per PR.
2. **Tests.** Every new behaviour or bugfix ships with a `bun:test` test.
3. **Types.** Strict TypeScript with `noUncheckedIndexedAccess` and
   `exactOptionalPropertyTypes` — if `bun run typecheck` doesn't pass, the
   PR isn't ready.
4. **Lint.** `bun run lint` must pass (Biome). Use `bun run lint:fix` to
   auto-fix where possible.
5. **No new dependencies** unless justified. Every dep is supply-chain
   risk.
6. **Denylist doesn't regress.** Changes to `src/denylist.ts` must make
   the patterns more accurate or add coverage; weakening a pattern needs
   evidence and a test.

## Commit style

- Tim Pope-style subject line: imperative, under 63 chars.
- Body explains *why*, not *what*. The diff already shows *what*.
- `Assisted-by: <model>` trailer if AI-generated.

## Opening the PR

- Target `main`.
- Reference the issue it addresses.
- Describe the change, the motivation, and any alternatives considered.
- Note any safety implications explicitly.

## Reporting bugs

Include:

- `bun --version` and OS.
- The exact `how …` invocation.
- The full stderr output (redact your API key first).
- The command the model returned, if relevant.

## Code of conduct

Be kind. Assume good faith. Disagreement is fine; hostility isn't. Issues
and PRs demonstrating either will be closed.
