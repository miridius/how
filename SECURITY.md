# Security

## Reporting a vulnerability

Please report security issues **privately** via GitHub's
[Private Vulnerability Reporting](https://github.com/miridius/how/security/advisories/new).
If that isn't available, open an issue titled `security: contact request` and
a maintainer will reach out off-channel — do **not** include details of the
vulnerability in a public issue.

You can expect an acknowledgement within **7 days**. Coordinated disclosure
timelines are negotiable; please allow a reasonable window before publishing.

## Supported versions

Only the latest `main` and the most recent tagged release are supported.

## Threat model

`how` sends natural-language input to Anthropic's API, receives a shell
command, and runs it in the user's shell after user confirmation. The
principal risks:

1. **Prompt injection via user input.** A user prompt can include
   instructions that cause the model to emit commands unrelated to the
   apparent intent. The tool's only defence is that the user is in the
   loop and approves every command by hitting Enter at the edit prompt.
   The model is not a security boundary; the user is.
2. **Hallucinated destructive commands.** The model can, without malice,
   emit `rm -rf *` from a harmless prompt. The denylist demotes `-y` to
   the manual edit prompt with a 🚨 warning for common destructive
   patterns. It is a "look at this one carefully" nudge, not a security
   boundary — patterns can always be bypassed by editing the command.
3. **Shell history leakage.** Commands run via `how` are appended to the
   user's shell history. Don't paste secrets into prompts.
4. **API key handling.** The SDK reads `ANTHROPIC_API_KEY` from the
   environment. The tool itself never logs the key or prompts, and never
   writes persistent state. Don't pass keys on the command line; they'll
   land in shell history.
5. **Untrusted-input ingestion.** Out of the box `how` only sees prompts
   the user types, so the "lethal trifecta" risk pattern (private data +
   untrusted input + external comms) doesn't apply. It does the moment
   the user pipes attacker-controllable text into the prompt — a pasted
   log, a file's contents, a web page summary. At that point the LLM is
   reading instructions from the attacker and can emit commands that
   exfiltrate or destroy. Don't pipe untrusted content into `how`.

## Out of scope

- The model producing suboptimal or incorrect commands is a functional
  issue, not a security issue.
- Anthropic's API infrastructure.
- General LLM jailbreaks unrelated to this tool.

## AI-generated vulnerability reports

Please **do not** submit unreviewed LLM output as a security finding. Per
curl's 2025 experience the false-positive rate is extremely high. Reproduce
the issue yourself and include a minimal proof-of-concept.
