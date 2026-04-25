# AI-assisted contributions

Welcome — this project was itself written with Claude. Two rules:

1. **Disclose** which tool you used in the PR description. An
   `Assisted-by: <model>` commit trailer is nice but not required.
2. **Verify any new dependency exists** before adding it to `package.json`.
   LLMs hallucinate package names (`slopsquatting`); double-check on
   <https://www.npmjs.com/>.

If you can't explain what your code does without the AI in the loop, don't
submit it.
