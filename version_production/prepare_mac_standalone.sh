#!/usr/bin/env bash
set -euo pipefail

# prepare_mac_standalone.sh
# Creates a standalone production folder for macOS (darwin-arm64 / Apple Silicon).
# The produced folder will contain:
# - a copy of the minimal app produced by prepare_custom_relase.sh
# - an unpacked Node.js runtime for darwin-arm64 inside `runtime/`
# - a tiny launcher script `run_bot.sh` that runs the bundled node without requiring
#   Node.js installed on the target machine.
#
# Usage:
#   ./prepare_mac_standalone.sh [TARGET_DIR]
# Default TARGET_DIR: ~/Desktop/bot-mac-standalone
#
# Notes:
# - This script downloads the official Node.js macOS binary for the matching
#   architecture (darwin-arm64). The download URL and checksums can be
#   adjusted if you need a specific Node version.
# - The resulting bundle is NOT a signed macOS app. For production delivery you
#   might want to notarize/sign the bundle.
# - The script requires `curl`, `tar`, and `rsync` available on the builder machine.

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEFAULT_TARGET="$HOME/Desktop/bot-mac-standalone"
TARGET="${1:-$DEFAULT_TARGET}"
TMPDIR="$(mktemp -d)"
NODE_VERSION="18.20.1" # choose LTS or appropriate version
NODE_DISTNAME="node-v${NODE_VERSION}-darwin-arm64"
NODE_TAR="${NODE_DISTNAME}.tar.gz"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TAR}"

echo "Repo root: $REPO_ROOT"
echo "Target: $TARGET"

echo "Creating temporary working dir: $TMPDIR"

mkdir -p "$TMPDIR"
mkdir -p "$TARGET"

# Step 1: produce minimal app in temp using existing script
if [ -x "$REPO_ROOT/version_production/prepare_custom_relase.sh" ]; then
  echo "Running prepare_custom_relase.sh to assemble minimal app..."
  (cd "$REPO_ROOT" && ./version_production/prepare_custom_relase.sh "$TMPDIR/app")
else
  echo "FATAL: helper script not found or not executable: version_production/prepare_custom_relase.sh"
  exit 1
fi

# Step 2: download Node darwin-arm64 runtime
cd "$TMPDIR"
if [ ! -f "$NODE_TAR" ]; then
  echo "Downloading Node runtime: $NODE_URL"
  curl -fsSLO "$NODE_URL"
fi

echo "Extracting Node runtime..."
mkdir -p "$TMPDIR/runtime"
tar -xzf "$NODE_TAR" -C "$TMPDIR/runtime" --strip-components=1

# Step 3: copy app and runtime to final target
echo "Copying app and runtime to target..."
rsync -a --delete "$TMPDIR/app/" "$TARGET/"
rsync -a "$TMPDIR/runtime/" "$TARGET/runtime/"

# Step 4: create launcher script
cat > "$TARGET/run_bot.sh" <<'SH'
#!/usr/bin/env bash
# launcher that uses bundled node runtime
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
NODE="$HERE/runtime/bin/node"
export PATH="$HERE/runtime/bin:$PATH"
# ensure node exists and is executable
if [ ! -x "$NODE" ]; then
  echo "Bundled node not found or not executable: $NODE"
  exit 1
fi
cd "$HERE"
# Run npm install in the bundle (production install) if node_modules missing
if [ ! -d "$HERE/node_modules" ]; then
  echo "Running 'npm ci --production' inside bundle (this requires network)"
  "$NODE" "$HERE/runtime/bin/npm" ci --production
fi
# Finally start the bot
exec "$NODE" index.js "$@"
SH

chmod +x "$TARGET/run_bot.sh"

# Step 5: clean temp
rm -rf "$TMPDIR"

cat <<SUMMARY
Standalone macOS bundle ready at: $TARGET
Contents:
 - app files (index.js, package.json, lib/, messages/, etc.)
 - runtime/ (bundled Node darwin-arm64)
 - run_bot.sh (executable launcher)

To run on the Mac target machine:
  ./run_bot.sh

Notes:
- The first run may download dependencies via 'npm ci' inside the bundle.
- For a fully offline bundle, run 'npm ci' locally before copying the bundle to the client.
SUMMARY

# Create a .command launcher on the Desktop for easy double-click execution
DESKTOP_LAUNCHER="$HOME/Desktop/$(basename "$TARGET").command"
echo "Creating Desktop launcher: $DESKTOP_LAUNCHER"
cat > "$DESKTOP_LAUNCHER" <<CMD
#!/bin/bash
DIR="$TARGET"
cd "$TARGET"
exec "$(printf '%q' "$TARGET/run_bot.sh")" "$@"
CMD
chmod +x "$DESKTOP_LAUNCHER"

# Create a tar.gz archive on the Desktop for easy delivery
ARCHIVE="$HOME/Desktop/$(basename "$TARGET").tar.gz"
echo "Creating tar.gz archive: $ARCHIVE"
tar -C "$(dirname "$TARGET")" -czf "$ARCHIVE" "$(basename "$TARGET")"

echo
echo "Created Desktop launcher and archive."

# execute:
# chmod +x version_production/prepare_mac_standalone.sh && ./
# version_production/prepare_mac_standalone.sh "$HOME/Desktop/bot"
