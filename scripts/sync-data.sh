#!/usr/bin/env bash
# Push local feeds data (config + saved posts + image cache) to a deployed server,
# including every /@user scope (static/@bob/... -> feeds/@bob/...).
# One-way: local -> remote. Overwrites the server's copies, so run it from the
# machine that holds the data you want to keep. The running service reads
# feeds.json/myposts.json per request, so changes apply live — no restart needed.
#
#   ./scripts/sync-data.sh user@server
#   ./scripts/sync-data.sh user@server /srv/feeds/data     # custom remote data root
#   SYNC_KEYS=1 ./scripts/sync-data.sh user@server          # send users.json too
set -euo pipefail
cd "$(dirname "$0")/.."

REMOTE="${1:?usage: sync-data.sh user@host [remote-data-dir]}"
DATA_ROOT="${2:-/srv/feeds/data}"

LOCAL_DATA="${LOCAL_DATA:-packages/app/static}"   # DATA_DIR default in dev
LOCAL_CACHE="${LOCAL_CACHE:-packages/app/cache}"  # CACHE_DIR default in dev
LOCAL_KEYS="${LOCAL_KEYS:-packages/app/users.json}"  # write keys, kept out of DATA_DIR

ssh "$REMOTE" "mkdir -p '$DATA_ROOT'/feeds '$DATA_ROOT'/cache '$DATA_ROOT'/models"

# config + saved posts + derived caches (whichever exist). --partial resumes on a
# dropped connection; -z compresses (slow-link friendly). --no-g: files the container
# wrote belong to a group we can't chgrp to, and -a would fail trying.
# `--include='@*/'` lets rsync descend into the per-user scopes; the file includes
# below match by basename, so they apply at the root and inside each @user alike.
rsync -az --no-g --partial --info=progress2 \
  --include='@*/' \
  --include='feeds.json' --include='myposts.json' \
  --include='tag-embeddings.json' --include='feed-cache.json' \
  --exclude='*' \
  "$LOCAL_DATA"/ "$REMOTE:$DATA_ROOT/feeds/"

# Image cache — optional (server would re-fetch on demand), but shipping it avoids
# a burst of refetches. Skip with SKIP_CACHE=1.
if [ -z "${SKIP_CACHE:-}" ] && [ -d "$LOCAL_CACHE" ]; then
  rsync -az --no-g --partial --info=progress2 "$LOCAL_CACHE"/ "$REMOTE:$DATA_ROOT/cache/"
fi

# Write keys live beside the data dir, never inside it (DATA_DIR is served publicly).
# Off by default: pushing yours overwrites keys the server minted, locking out anyone
# invited there.
if [ -n "${SYNC_KEYS:-}" ]; then
  if [ -f "$LOCAL_KEYS" ]; then
    rsync -az --no-g --partial "$LOCAL_KEYS" "$REMOTE:$DATA_ROOT/users.json"
    echo "pushed $LOCAL_KEYS -> $DATA_ROOT/users.json (replaced the server's keys)"
  else
    echo "SYNC_KEYS set but $LOCAL_KEYS does not exist — skipped"
  fi
elif compgen -G "$LOCAL_DATA/@*" > /dev/null; then
  echo "note: user scopes synced, but users.json was not — the server keeps its own"
  echo "      keys, so a user invited locally cannot sign in there. SYNC_KEYS=1 to send it."
fi

echo "synced to $REMOTE:$DATA_ROOT — feeds/posts apply on next request, no restart"
