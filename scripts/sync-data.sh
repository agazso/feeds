#!/usr/bin/env bash
# Push local feeds data (config + saved posts + image cache) to a deployed server.
# One-way: local -> remote. Overwrites the server's copies, so run it from the
# machine that holds the data you want to keep. The running service reads
# feeds.json/myposts.json per request, so changes apply live — no restart needed.
#
#   ./scripts/sync-data.sh user@server
#   ./scripts/sync-data.sh user@server /srv/feeds/data     # custom remote data root
set -euo pipefail
cd "$(dirname "$0")/.."

REMOTE="${1:?usage: sync-data.sh user@host [remote-data-dir]}"
DATA_ROOT="${2:-/srv/feeds/data}"

LOCAL_DATA="${LOCAL_DATA:-packages/app/static}"   # DATA_DIR default in dev
LOCAL_CACHE="${LOCAL_CACHE:-packages/app/cache}"  # CACHE_DIR default in dev

ssh "$REMOTE" "mkdir -p '$DATA_ROOT'/feeds '$DATA_ROOT'/cache '$DATA_ROOT'/models"

# config + saved posts + derived caches (whichever exist). --partial resumes on a
# dropped connection; -z compresses (slow-link friendly).
rsync -az --partial --info=progress2 \
  --include='feeds.json' --include='myposts.json' \
  --include='tag-embeddings.json' --include='feed-cache.json' \
  --exclude='*' \
  "$LOCAL_DATA"/ "$REMOTE:$DATA_ROOT/feeds/"

# Image cache — optional (server would re-fetch on demand), but shipping it avoids
# a burst of refetches. Skip with SKIP_CACHE=1.
if [ -z "${SKIP_CACHE:-}" ] && [ -d "$LOCAL_CACHE" ]; then
  rsync -az --partial --info=progress2 "$LOCAL_CACHE"/ "$REMOTE:$DATA_ROOT/cache/"
fi

echo "synced to $REMOTE:$DATA_ROOT — feeds/posts apply on next request, no restart"
