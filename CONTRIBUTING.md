# Contributing

PRs welcome. Open an issue first for anything bigger than a one-line fix.

```sh
git clone https://github.com/miridius/how.git && cd how
bun install
bun run check     # typecheck + lint + tests
```

- Small focused diffs, please.
- New behaviour ships with a `bun:test` test.
- New deps need a real reason — every one is supply-chain risk.
- Changes to `src/denylist.ts` need a test (it's the only nudge between an
  LLM hallucination and execution).

Be kind in issues and reviews.
