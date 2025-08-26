#!/usr/bin/env bash
set -euo pipefail

# prepare_custom_release.sh
# Copies a minimal subset of the repo to a target directory (default: ~/Desktop/bot)
# Items copied (as requested):
# - directory: __tests__
# - file: .env
# - file: client_secret.json
# - file: index.js
# - directory: lib
# - directory: messages
# - file: package-lock.json
# - file: package.json
# - directory: scripts  (only files that look like unit tests: name contains "test" or ends with ".test.js")
# - directory: tests
#
# Usage:
#   ./prepare_custom_release.sh [TARGET_DIR]
# Example:
#   ./prepare_custom_release.sh /Users/cliente/Desktop/bot

## Determine repository root robustly: prefer git top-level; fallback to parent dir of this script
REPO_ROOT="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel 2>/dev/null || (cd "$(dirname "$0")/.." && pwd))"
TARGET="${1:-$HOME/Desktop/bot}"

echo "Repo root: $REPO_ROOT"
echo "Target dir: $TARGET"

mkdir -p "$TARGET"

# Items to copy
ITEMS=(
  "__tests__"
  ".env"
  "client_secret.json"
  "index.js"
  "lib"
  "messages"
  "package-lock.json"
  "package.json"
  "scripts"
  "tests"
)

copied=()
skipped=()

for item in "${ITEMS[@]}"; do
  src="$REPO_ROOT/$item"
  if [ -e "$src" ]; then
    echo "Copying: $item"
    rsync -a --no-perms --no-owner --no-group "$src" "$TARGET/" >/dev/null
    copied+=("$item")
  else
    skipped+=("$item")
  fi
done

# Safety: ensure no token or unexpected files were copied
rm -f "$TARGET/token.json" "$TARGET/tocken.json" "$TARGET/.env.local" 2>/dev/null || true


echo
echo "Copied items:"
for c in "${copied[@]:-}"; do echo "  - $c"; done

if [ "${#skipped[@]}" -gt 0 ]; then
  echo
  echo "Skipped (not found):"
  for s in "${skipped[@]}"; do echo "  - $s"; done
fi

echo
echo "Target ready at: $TARGET"

echo
cat <<'NOTE'
Next manual steps on the destination machine (client):
  cd "$TARGET"
  npm install
  node index.js    # follow OAuth flow to create token.json
  node index.js    # start bot (logs folder will be recreated)

Notes:
- .env and client_secret.json are copied: ensure these are intended to go to the client.
- The script only copies 'scripts' files that look like tests (filename contains 'test' or ends with '.test.js').
  If you want the entire scripts folder, call the script with the environment variable COPY_SCRIPTS_FULL=1, e.g.

  COPY_SCRIPTS_FULL=1 ./prepare_custom_release.sh /Users/cliente/Desktop/bot

- If you prefer a tarball instead of a directory, create one after running this script:
  tar -C "$(dirname "$TARGET")" -czf "${TARGET}.tar.gz" "$(basename "$TARGET")"
NOTE

# execute:
# chmod +x version_production/prepare_custom_relase.sh && ./
# version_production/prepare_custom_relase.sh "$HOME/Desktop/bot"
