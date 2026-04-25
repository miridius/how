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
Set Height      380
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

# Wait for the gum prompt to render (its footer shows "enter submit").
# Dynamic — proceeds the moment the prompt appears, with a 15s safety cap.
Wait@15s /enter submit/

# Accept the command as-is.
Enter

# Command runs in the current shell; the output appears inline.
Sleep 3s
