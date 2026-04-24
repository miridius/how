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
Set Height      600
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

Type "how list the 5 largest files in this directory"
Sleep 400ms
Enter

# Thinking spinner + API round-trip; command lands in the gum-styled edit box.
# 10s margin covers normal API latency; bump if the regenerated GIF shows the
# "Thinking..." spinner still running when Enter fires on the next line.
Sleep 10s

# Accept the command as-is.
Enter

# Command runs in the current shell; the output appears inline.
Sleep 3s
