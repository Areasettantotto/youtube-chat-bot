#!/usr/bin/env bash
set -euo pipefail

# prepare_win_standalone.sh
# Creates a Windows standalone bundle (builds a single exe using `pkg` via npx)
# The produced artifacts:
# - a Windows executable (bot-windows.exe)
# - a folder with app files (optional)
# - a zip archive ready for delivery
#
# Usage:
#   ./prepare_win_standalone.sh [TARGET_DIR]
# Default TARGET_DIR: $HOME/Desktop/bot-windows-standalone
#
# Requirements:
# - Internet access (npx will fetch pkg if necessary)
# - `zip` available to create archive
#
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEFAULT_TARGET="$HOME/Desktop/bot-windows-standalone"
TARGET="${1:-$DEFAULT_TARGET}"
TMPDIR="$(mktemp -d)"
PKG_TARGET="node18-win-x64" # change if you need other node/runtime

echo "Repo root: $REPO_ROOT"
echo "Target: $TARGET"
echo "Temp: $TMPDIR"

mkdir -p "$TMPDIR"

# Step 1: assemble minimal app using existing helper
if [ -x "$REPO_ROOT/version_production/prepare_custom_relase.sh" ]; then
  echo "Running prepare_custom_relase.sh to assemble minimal app..."
  (cd "$REPO_ROOT" && ./version_production/prepare_custom_relase.sh "$TMPDIR/app")
else
  echo "FATAL: helper script not found or not executable: version_production/prepare_custom_relase.sh"
  exit 1
fi

# Ensure index.js exists in the assembled app
if [ ! -f "$TMPDIR/app/index.js" ]; then
  echo "FATAL: entry file index.js not found in assembled app"
  exit 1
fi

echo "Building Windows executable using pkg (this may take a minute)..."
# Step 2: install production dependencies in the assembled app so pkg can include them
echo "Installing production dependencies in the assembled app (npm ci --production)..."
if command -v npm >/dev/null 2>&1; then
  (cd "$TMPDIR/app" && npm ci --production)
else
  echo "WARNING: npm not found in PATH. pkg may not include all dependencies."
fi

# Step 3: use npx pkg to produce a Windows exe
echo "Building Windows executable using pkg (this may take a minute)..."
# Use npx to avoid requiring global install; --yes to auto-install if needed
npx --yes pkg --targets "$PKG_TARGET" --output "$TMPDIR/bot-windows.exe" "$TMPDIR/app/index.js"

# Step 3: prepare final target folder and copy files
mkdir -p "$TARGET"
# Copy assembled app files (optional, useful for debugging on Windows)
rsync -a --delete "$TMPDIR/app/" "$TARGET/"
# Move the exe into the target
mv "$TMPDIR/bot-windows.exe" "$TARGET/bot-windows.exe"

# Step 4: create a small README and a .bat launcher
cat > "$TARGET/run_bot.bat" <<BAT
@echo off
REM Launcher for the bundled Windows exe
cd %~dp0
bot-windows.exe %*
BAT

cat > "$TARGET/README.txt" <<TXT
This folder contains the standalone Windows bundle for the YouTube Chat Bot.
Run 'run_bot.bat' to start the bot on Windows (or execute bot-windows.exe directly).

Notes:
- The exe was built with 'pkg' (https://github.com/vercel/pkg) using $PKG_TARGET.
- If the bot needs to perform OAuth, run in an interactive console and follow the instructions.
TXT

# Step 5: create a zip archive on the Desktop
ARCHIVE="$HOME/Desktop/$(basename "$TARGET").zip"
cd "$(dirname "$TARGET")"
if command -v zip >/dev/null 2>&1; then
  echo "Creating zip archive: $ARCHIVE"
  zip -r "$ARCHIVE" "$(basename "$TARGET")" >/dev/null
else
  echo "zip not found: creating tar.gz instead"
  ARCHIVE="$HOME/Desktop/$(basename "$TARGET").tar.gz"
  tar -C "$(dirname "$TARGET")" -czf "$ARCHIVE" "$(basename "$TARGET")"
fi

# Step 6: cleanup
rm -rf "$TMPDIR"

echo
cat <<SUMMARY
Windows standalone bundle ready at: $TARGET
 - Executable: bot-windows.exe
 - Launcher:  run_bot.bat
 - Archive on Desktop: $ARCHIVE

Notes:
- Building used 'pkg' via npx. If you prefer to pre-install 'pkg' globally, run: npm i -g pkg
- Cross-compilation: 'pkg' can produce Windows exe on macOS without Wine in many cases. If you need a different target (x86/ia32), change PKG_TARGET.
SUMMARY

# execute:
# chmod +x version_production/prepare_win_standalone.sh && ./
# version_production/prepare_win_standalone.sh "$HOME/Desktop/bot"
