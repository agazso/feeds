#!/usr/bin/env bash
# Pull feeds data (config + saved posts + image cache) FROM a deployed server to local,
# including every /@user scope (feeds/@bob/... -> static/@bob/...).
# One-way: remote -> local. Overwrites local copies — use it to back the live server's
# curated feeds/posts into the repo. Mirror of sync-data.sh (which pushes the other way).
#
#   ./scripts/sync-from-server.sh user@server
#   ./scripts/sync-from-server.sh user@server /srv/feeds/data     # custom remote data root
#   SYNC_KEYS=1 ./scripts/sync-from-server.sh user@server          # fetch users.json too
set -euo pipefail
cd "$(dirname "$0")/.."

REMOTE="${1:?usage: sync-from-server.sh user@host [remote-data-dir]}"
DATA_ROOT="${2:-/srv/feeds/data}"

LOCAL_DATA="${LOCAL_DATA:-packages/app/static}"   # DATA_DIR default in dev
LOCAL_CACHE="${LOCAL_CACHE:-packages/app/cache}"  # CACHE_DIR default in dev
LOCAL_KEYS="${LOCAL_KEYS:-packages/app/users.json}"  # write keys, kept out of DATA_DIR

mkdir -p "$LOCAL_DATA" "$LOCAL_CACHE"

# config + saved posts + derived caches (whichever exist on the server). --partial
# resumes on a dropped connection; -z compresses (slow-link friendly).
# `--include='@*/'` lets rsync descend into the per-user scopes; the file includes
# below match by basename, so they apply at the root and inside each @user alike.
rsync -az --partial --info=progress2 \
  --include='@*/' \
  --include='feeds.json' --include='myposts.json' \
  --include='tag-embeddings.json' --include='feed-cache.json' \
  --exclude='*' \
  "$REMOTE:$DATA_ROOT/feeds/" "$LOCAL_DATA"/

# Image cache — skip with SKIP_CACHE=1.
if [ -z "${SKIP_CACHE:-}" ]; then
  rsync -az --partial --info=progress2 "$REMOTE:$DATA_ROOT/cache/" "$LOCAL_CACHE"/
fi

# Off by default — it would replace your local keys, signing you out of local scopes.
if [ -n "${SYNC_KEYS:-}" ]; then
  rsync -az --partial "$REMOTE:$DATA_ROOT/users.json" "$LOCAL_KEYS"
  echo "pulled $DATA_ROOT/users.json -> $LOCAL_KEYS (replaced your local keys)"
fi

echo "pulled from $REMOTE:$DATA_ROOT -> $LOCAL_DATA + $LOCAL_CACHE"
