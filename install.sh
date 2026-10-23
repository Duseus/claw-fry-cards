#!/usr/bin/env bash
# 🕊️ claw-lark-cards — one-line installer
#
#   curl -fsSL https://raw.githubusercontent.com/Duseus/claw-lark-cards/main/install.sh | bash
#
# What it does:
#   1. Locates an OpenClaw CLI (OPENCLAW_BIN override → `openclaw` on PATH → `npx` fallback)
#   2. Clones Duseus/claw-lark-cards to a temporary build directory
#   3. Builds ESM distribution and registers the plugin via `openclaw plugins install .`
#   4. Verifies the plugin shows up in `openclaw plugins list`
#
# It does NOT restart the gateway — run `openclaw gateway restart` yourself.
#
# Env overrides:
#   OPENCLAW_BIN=/path/to/openclaw   skip auto-detection
#   BRANCH=main                      install a specific branch/tag
set -euo pipefail

REPO="Duseus/claw-lark-cards"
PKG="claw-fry-cards"
BRANCH="${BRANCH:-main}"

say()  { printf '\033[1;36m▸\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m!\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- OpenClaw CLI
declare -a OC=()

find_openclaw() {
  if [ -n "${OPENCLAW_BIN:-}" ]; then
    [ -x "$OPENCLAW_BIN" ] || die "OPENCLAW_BIN is not executable: $OPENCLAW_BIN"
    OC=("$OPENCLAW_BIN"); return
  fi

  if command -v openclaw >/dev/null 2>&1; then
    OC=(openclaw); return
  fi

  if command -v npx >/dev/null 2>&1; then
    OC=(npx -y openclaw); return
  fi

  die "OpenClaw CLI not found. Install OpenClaw first, or set OPENCLAW_BIN=/path/to/openclaw"
}

find_openclaw

say "OpenClaw CLI: ${OC[*]}"
say "Building and installing from GitHub: $REPO ($BRANCH)..."

BUILD_DIR="$(mktemp -d /tmp/claw-lark-cards-build.XXXXXX)"
trap 'rm -rf "$BUILD_DIR"' EXIT

git clone --depth 1 --branch "$BRANCH" "https://github.com/$REPO.git" "$BUILD_DIR"
cd "$BUILD_DIR"

npm install --legacy-peer-deps --no-audit --no-fund
NODE_OPTIONS='--max-old-space-size=1400' npx tsdown

"${OC[@]}" plugins install . --force --accept-capabilities

# ---------------------------------------------------------------- verify
if "${OC[@]}" plugins list 2>/dev/null | grep -q "$PKG"; then
  ok "$PKG (claw-lark-cards) installed and registered successfully"
else
  warn "Install command finished but plugin not found in plugins list — check the output above"
  exit 1
fi

warn "Not restarting the gateway — run \`${OC[*]} gateway restart\` yourself"
say "Done! See https://github.com/$REPO#-配置指南 for channel & Hermes card config"
