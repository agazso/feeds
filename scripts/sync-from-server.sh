#!/usr/bin/env bash
# Pull feeds data (config + saved posts + image cache) FROM a deployed server to local.
# One-way: remote -> local. Overwrites local copies — use it to back the live server's
# curated feeds/posts into the repo. Mirror of sync-data.sh (which pushes the other way).
#
#   ./scripts/sync-from-server.sh user@server
#   ./scripts/sync-from-server.sh user@server /srv/feeds/data     # custom remote data root
set -euo pipefail
cd "$(dirname "$0")/.."

REMOTE="${1:?usage: sync-from-server.sh user@host [remote-data-dir]}"
DATA_ROOT="${2:-/srv/feeds/data}"

LOCAL_DATA="${LOCAL_DATA:-packages/app/static}"   # DATA_DIR default in dev
LOCAL_CACHE="${LOCAL_CACHE:-packages/app/cache}"  # CACHE_DIR default in dev

mkdir -p "$LOCAL_DATA" "$LOCAL_CACHE"

# config + saved posts + derived caches (whichever exist on the server). --partial
# resumes on a dropped connection; -z compresses (slow-link friendly).
rsync -az --partial --info=progress2 \
  --include='feeds.json' --include='myposts.json' \
  --include='tag-embeddings.json' --include='feed-cache.json' \
  --exclude='*' \
  "$REMOTE:$DATA_ROOT/feeds/" "$LOCAL_DATA"/

# Image cache — skip with SKIP_CACHE=1.
if [ -z "${SKIP_CACHE:-}" ]; then
  rsync -az --partial --info=progress2 "$REMOTE:$DATA_ROOT/cache/" "$LOCAL_CACHE"/
fi

echo "pulled from $REMOTE:$DATA_ROOT -> $LOCAL_DATA + $LOCAL_CACHE"
