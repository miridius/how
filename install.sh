#!/usr/bin/env bash
# how — one-shot installer.
# Usage: curl -fsSL https://raw.githubusercontent.com/miridius/how/main/install.sh | bash
set -euo pipefail

REPO_URL="${HOW_REPO_URL:-https://github.com/miridius/how.git}"
INSTALL_DIR="${HOW_INSTALL_DIR:-$HOME/.how}"
BRANCH="${HOW_BRANCH:-main}"

C_ACCENT=$'\033[1;38;2;127;88;255m'
C_RED=$'\033[31m'
C_DIM=$'\033[2m'
C_RESET=$'\033[0m'

log()  { printf '%s%s%s\n' "${C_ACCENT}" "$*" "${C_RESET}" >&2; }
warn() { printf '%s%s%s\n' "${C_RED}"    "$*" "${C_RESET}" >&2; }
dim()  { printf '%s%s%s\n' "${C_DIM}"    "$*" "${C_RESET}" >&2; }

require_bun() {
  if ! command -v bun >/dev/null 2>&1; then
    warn "how requires bun, but it isn't on your PATH."
    echo "Install bun first:"
    echo "  curl -fsSL https://bun.sh/install | bash"
    exit 1
  fi
}

require_git() {
  if ! command -v git >/dev/null 2>&1; then
    warn "how's installer uses git to fetch the repo."
    echo "Install git with your system package manager, then re-run."
    exit 1
  fi
}

clone_or_update() {
  if [ -d "$INSTALL_DIR/.git" ]; then
    log "Updating existing checkout at $INSTALL_DIR"
    git -C "$INSTALL_DIR" fetch --quiet origin "$BRANCH"
    git -C "$INSTALL_DIR" checkout --quiet "$BRANCH"
    git -C "$INSTALL_DIR" reset --hard --quiet "origin/$BRANCH"
  elif [ -e "$INSTALL_DIR" ]; then
    warn "$INSTALL_DIR exists and isn't a git checkout."
    echo "Remove it or set HOW_INSTALL_DIR to a different path."
    exit 1
  else
    log "Cloning $REPO_URL -> $INSTALL_DIR"
    git clone --quiet --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
  fi
}

install_deps() {
  log "Installing dependencies"
  (cd "$INSTALL_DIR" && bun install --frozen-lockfile --ignore-scripts)
}

detect_shell() {
  local parent
  parent="$(basename "${SHELL:-/bin/bash}")"
  case "$parent" in
    zsh|bash|fish) echo "$parent" ;;
    *) echo "bash" ;;
  esac
}

rc_path() {
  case "$1" in
    zsh)  echo "${ZDOTDIR:-$HOME}/.zshrc" ;;
    bash) echo "$HOME/.bashrc" ;;
    fish) echo "$HOME/.config/fish/config.fish" ;;
  esac
}

init_line() {
  local shell="$1"
  local init_script="$INSTALL_DIR/src/init.ts"
  case "$shell" in
    fish) printf 'bun %q %s | source\n' "$init_script" "$shell" ;;
    *)    printf 'eval "$(bun %q %s)"\n' "$init_script" "$shell" ;;
  esac
}

write_rc_line() {
  local shell rc line
  shell="$(detect_shell)"
  rc="$(rc_path "$shell")"
  line="$(init_line "$shell")"

  mkdir -p "$(dirname "$rc")"
  touch "$rc"

  if grep -Fq "how/src/init.ts" "$rc" 2>/dev/null; then
    dim "Already wired in $rc — skipping append."
    return
  fi

  {
    printf '\n# how — https://github.com/miridius/how\n'
    printf '%s' "$line"
  } >> "$rc"
  log "Added one line to $rc"
}

print_next_steps() {
  echo
  log "Installed to $INSTALL_DIR"
  dim "Open a new shell (or run 'exec \$SHELL') to pick up the function."
  if [ -z "${ANTHROPIC_API_KEY:-}" ]; then
    echo
    warn "ANTHROPIC_API_KEY is not set."
    echo "  Grab a key:  https://console.anthropic.com/settings/keys"
    echo "  Add to rc:   export ANTHROPIC_API_KEY=sk-ant-..."
  fi
}

main() {
  require_bun
  require_git
  clone_or_update
  install_deps
  write_rc_line
  print_next_steps
}

main "$@"
