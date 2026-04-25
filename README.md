# how

Ask Claude for a terminal command, edit it, run it, keep it in your history.

![Terminal recording: the user types "how list the 5 largest files in this directory". Claude returns `ls -lS | head -6` in an editable prompt. The user presses Enter and the command runs, showing the five biggest files.](docs/demo.gif)

It's a tiny shell function plus a [Bun](https://bun.sh) script. The function
captures the command that the script prints to stdout, appends it to your
shell history, and `eval`s it in your current shell — so `cd`, aliases, and
shell state work normally.

---

## Install

### Requirements

- [**bun**](https://bun.sh) ≥ 1.2.4
- An **Anthropic API key** — grab one at
  <https://console.anthropic.com/settings/keys>, then
  `export ANTHROPIC_API_KEY=sk-ant-…` in your shell rc.
- *(optional)* [**gum**](https://github.com/charmbracelet/gum) for the nicer
  interactive prompt. Without it, `how` falls back to a plain line editor.
  Install: `brew install gum` / `apt install gum` /
  [releases](https://github.com/charmbracelet/gum/releases).

### Clone-install (recommended)

```sh
git clone https://github.com/miridius/how.git ~/.how
cd ~/.how && bun install
```

Then add one line to your shell rc:

```sh
# ~/.zshrc
eval "$(bun $HOME/.how/src/init.ts zsh)"

# ~/.bashrc
eval "$(bun $HOME/.how/src/init.ts bash)"

# ~/.config/fish/config.fish
bun $HOME/.how/src/init.ts fish | source
```

Open a new shell (or `exec $SHELL`) and you're done.

### One-liner install

```sh
curl -fsSL https://raw.githubusercontent.com/miridius/how/main/install.sh | bash
```

The install script checks for `bun`, clones the repo to `~/.how`, runs
`bun install`, and appends the `eval` line to your shell rc. It's idempotent —
re-run it to update.

---

## Usage

```sh
how list files larger than 100MB
how show all docker containers including stopped
how -y what's my current git branch
```

### Flags

| Flag | Meaning |
| --- | --- |
| `-y`, `--yes` | Skip the edit step. Denylist matches still go through it. |
| `-h`, `--help` | Help. |
| `-v`, `--version` | Version. |

### Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | *(required)* | Anthropic API credential. |
| `HOW_MODEL` | `claude-sonnet-4-6` | Override the Claude model. |
| `HOW_EXTRA_DENY` | — | Newline-separated regexes added to the safety denylist. |

---

## Safety

`how` executes shell commands written by a large language model. The LLM can
be wrong and has no concept of the value of your files. **You** approve every
command it suggests by hitting Enter — that's the safety boundary.

- **Edit step by default.** The suggested command lands in an editable
  prompt; nothing runs until you press Enter. Esc / Ctrl-C cancel.
- **Denylist demotes `-y`.** Regex patterns for `sudo`, unbounded `rm -rf`,
  `curl | sh`, `dd`/`mkfs`, fork bombs, `git push --force`, `git reset --hard`,
  and similar always go through the edit prompt with a 🚨 warning, even when
  `-y` was passed. The denylist isn't a security boundary — it's a "look at
  this one" nudge for patterns that LLMs commonly hallucinate. See
  `src/denylist.ts` for the current list; extend it via `HOW_EXTRA_DENY`.
- **Bounded request.** Each call caps at 512 output tokens and a 30-second
  timeout.

### Threat model in one paragraph

By default `how` is a one-input tool — natural-language prompts come from
the user, not from external content — so the standard "lethal trifecta"
(private-data access + untrusted input + external comms) isn't satisfied as
shipped. The thing to watch is the moment you start piping untrusted content
into the prompt (a pasted log, a file's contents, a web page summary): then
the LLM is reading attacker-controllable text *and* it can suggest commands
that touch your filesystem. Don't do that. The user reviewing and approving
each command at the edit prompt is the safety boundary either way.

See [SECURITY.md](./SECURITY.md) for disclosure and a fuller threat model.

---

## AI authorship

This project was primarily authored by Anthropic's Claude, under human
direction and review. The author prompted, reviewed, edited, and tested the
code; Claude generated most of the text. Commit trailers such as
`Assisted-by: Claude …` capture per-commit provenance.

Per January 2025 guidance from the U.S. Copyright Office, portions that lack
sufficient human creative input may not be copyrightable. The project is
released under [MIT](./LICENSE) regardless — the license grants whatever
rights the maintainers have, and makes no claim about exclusivity (see
[NOTICE](./NOTICE)).

Treat the code accordingly: read it before you run it, especially given it
exists to execute shell commands.

---

## Development

```sh
bun install
bun test                 # runs bun:test; mocks the Anthropic SDK via test/preload.ts
bun run typecheck        # tsc --noEmit, strict mode
bun run lint             # biome check
bun run lint:fix         # biome check --write
bun run check            # typecheck + lint + test
```

PRs welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## License

[MIT](./LICENSE). See [NOTICE](./NOTICE) for third-party and AI-authorship
notes.
