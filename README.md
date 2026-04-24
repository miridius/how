# how

Ask Claude for a terminal command, edit it, run it, keep it in your history.

```console
$ how find ts files changed this week
$ find . -name '*.ts' -mtime -7
  …renders the suggested command in an editable prompt. Enter runs it, Esc cancels.
```

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
how -n --dry-run-mode rename every .jpeg to .jpg in this directory
```

### Flags

| Flag | Meaning |
| --- | --- |
| `-y`, `--yes` | Skip the edit step; the model's command is executed directly. Denylist matches still prompt. |
| `-n`, `--dry-run` | Print the command but do not execute it. |
| `--unsafe` | Disable the built-in denylist. Use only when you mean it. |
| `-h`, `--help` | Help. |
| `-v`, `--version` | Version. |

### Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | *(required)* | Anthropic API credential. |
| `HOW_MODEL` | `claude-sonnet-4-6` | Override the Claude model. |
| `HOW_TIMEOUT_MS` | `30000` | API request timeout. |
| `HOW_EXTRA_DENY` | — | Newline-separated regexes added to the safety denylist. |
| `HOW_ALLOW_ROOT` | — | Set to `1` to permit running as root. Refused by default. |

---

## Safety

`how` executes shell commands written by a large language model. The LLM can
be wrong, can be manipulated by anything it reads, and has no concept of your
effective UID or the value of your files. **You** approve every command it
suggests.

The tool adopts several defences — none are a substitute for reading the
command before you approve it.

- **Confirmation by default.** The suggested command lands in an editable
  prompt; nothing runs until you press Enter. `-y` skips the edit step but
  does **not** bypass the denylist below.
- **Denylist.** Regex patterns for `sudo`, unbounded `rm -rf`, `curl | sh`,
  `dd`/`mkfs`, fork bombs, `git push --force`, and similar always force a
  typed-`yes` confirmation — even with `-y`. See `src/denylist.ts` for the
  current list; extend via `HOW_EXTRA_DENY`.
- **Shape check.** If the model returns prose, an apology, or the literal
  `REFUSE: <reason>`, `how` refuses to execute anything and surfaces the
  response instead.
- **Root refusal.** `how` exits rather than run as root; set
  `HOW_ALLOW_ROOT=1` to override.
- **Bounded request.** Each call caps at 512 output tokens and a 30-second
  deadline.

### Threat model in one paragraph

`how` lives inside Simon Willison's "lethal trifecta" warning by design — it
can take untrusted input and it can execute shell. The intended mitigation is
that the user is a knowledgeable human in the loop who reads and approves the
one command before it runs. Do not hand this tool arbitrary file contents,
web pages, git logs, or clipboard data via the prompt unless you're ready to
read whatever it suggests with the same care. Do not run it with `sudo` or
against directories containing secrets you aren't willing to lose.

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
