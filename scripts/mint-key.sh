#!/usr/bin/env bash
# Mint a write key and add it to a keyfile, keeping every key already in there.
# Without a keyfile the app runs with auth OFF — anyone can write — so this is the
# recovery path when a server has none.
#
#   ./scripts/mint-key.sh                  # add a root key to the local keyfile
#   ./scripts/mint-key.sh user@server      # add a root key on the server
#   ./scripts/mint-key.sh user@server bob  # add a key for that server's /@bob
#
# jq runs locally, so the server needs nothing installed.
set -euo pipefail
cd "$(dirname "$0")/.."

REMOTE="${1:-}"
SCOPE="${2:-}"                                     # empty = the single-user root scope
DATA_ROOT="${DATA_ROOT:-/srv/feeds/data}"          # must match FEEDS_DATA_DIR's parent
LOCAL_KEYS="${LOCAL_KEYS:-packages/app/users.json}"

# 23 chars of base58 (~135 bits) — the same alphabet the app itself mints, so keys
# made here and keys made by /invite look alike. See $lib/server/auth.ts.
KEY=$(node -e "
const { randomInt } = require('crypto')
const a = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
console.log(Array.from({ length: 23 }, () => a[randomInt(58)]).join(''))
")

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

if [ -n "$REMOTE" ]; then
  scp -q "$REMOTE:$DATA_ROOT/users.json" "$tmp/keys.json" 2>/dev/null || echo '{}' > "$tmp/keys.json"
  jq --arg u "$SCOPE" --arg k "$KEY" '.[$u] = $k' "$tmp/keys.json" > "$tmp/new.json"
  ssh "$REMOTE" "mkdir -p '$DATA_ROOT'"
  scp -q "$tmp/new.json" "$REMOTE:$DATA_ROOT/users.json"
  target="$REMOTE:$DATA_ROOT/users.json"
else
  [ -s "$LOCAL_KEYS" ] || echo '{}' > "$LOCAL_KEYS"
  jq --arg u "$SCOPE" --arg k "$KEY" '.[$u] = $k' "$LOCAL_KEYS" > "$tmp/new.json"
  cp "$tmp/new.json" "$LOCAL_KEYS"
  target="$LOCAL_KEYS"
fi

echo "key for ${SCOPE:+@}${SCOPE:-root} written to $target"
echo
echo "  $KEY"
echo
echo "sign in by opening  https://<host>${SCOPE:+/@$SCOPE}/auth?key=$KEY"
echo "the app rereads the keyfile per request — no restart needed"
