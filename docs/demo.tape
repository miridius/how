# VHS tape for how's README demo.
# Regenerate: `vhs docs/demo.tape`
# Outputs docs/demo.gif (referenced from README).

Output docs/demo.gif

Require zsh
Require bun
Require gum

Set Shell       "zsh"
Set FontSize    18
Set Width       1100
Set Height      560
Set Theme       "Dracula"
Set TypingSpeed 60ms
Set Padding     24

# Setup (hidden): wire the shell function and set a minimal prompt so the
# recording isn't cluttered with user@host. Run this tape from the repo
# root: `vhs docs/demo.tape`.
Hide
Type `export PS1='%F{magenta}>%f '`
Enter
Type `eval "$(bun src/init.ts zsh)"`
Enter
Type "clear"
Enter
Sleep 500ms
Show

# --- demo starts here ---

# Command 1: a safe, recognizable prompt — shows the happy path.
Type "how list the 5 largest files in this directory"
Sleep 400ms
Enter
Wait@15s /enter submit/
Sleep 2s
Enter
Sleep 2s

# Command 2: a denylisted prompt — shows the 🚨 nudge and cancel flow.
# (Accepting would actually run `git reset --hard origin/<branch>` in the
# recording's CWD and wipe uncommitted state, so the recording cancels.)
Type "how reset hard to origin version of current branch"
Sleep 400ms
Enter
Wait@15s /enter submit/
Sleep 2s
Escape

# Let the final cancelled state sit for a beat before the GIF loops.
Sleep 2s
