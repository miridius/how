# AI-Assisted Contributions

This project was itself primarily authored with AI assistance (Claude).
AI-assisted contributions are welcome, subject to these rules. They are
adapted from the policies of
[Ghostty](https://github.com/ghostty-org/ghostty/blob/main/AI_POLICY.md),
the [Linux kernel coding-assistants doc](https://docs.kernel.org/process/coding-assistants.html),
and the 2025 DigitalOcean community guidance.

## 1. Disclose AI use

In the PR description, state which tool(s) you used and the extent of
assistance. Examples:

- *"Claude Sonnet 4.6, full function generation with human review"*
- *"Copilot autocomplete only"*
- *"Entirely hand-written"*

An `Assisted-by: <model>` commit trailer is appreciated but not required.
The existing `Co-Authored-By: Claude <noreply@anthropic.com>` trailer is
accepted for backward compatibility, though `Assisted-by:` more accurately
reflects the relationship.

## 2. Understand what you submit

If you cannot explain what your code does without the AI present, do not
submit it. Reviewers **will** ask.

## 3. No drive-by AI PRs

For anything beyond a typo or trivial doc fix, open or comment on an issue
first to confirm the change is wanted. Unsolicited large AI-generated PRs
will be closed.

## 4. Verify every dependency

LLMs hallucinate npm packages (the *slopsquatting* failure mode). Before
adding anything to `package.json`:

1. Confirm the exact name on <https://www.npmjs.com/>.
2. Check last-publish date, weekly downloads, and maintainer history.
3. Prefer packages with clear provenance over obscure alternatives.

## 5. Tests for generated logic

AI-generated logic ships with tests the contributor wrote or thoroughly
verified. `bun:test` + property-based testing (fast-check) for parsers or
validators.

## 6. No AI-generated security reports

Per curl's experience (~95% fabrication rate), unreviewed LLM-generated
vulnerability reports waste maintainer time and will be closed without
further engagement. Reproduce issues yourself before reporting.

## 7. Safety changes need extra scrutiny

Changes to `src/denylist.ts`, the shape check in `src/anthropic.ts`, or the
root-refusal policy in `src/how.ts` require a tests-first PR. These are
safety controls; they should only loosen with evidence.
