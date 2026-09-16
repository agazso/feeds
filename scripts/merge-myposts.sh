#!/usr/bin/env bash
# Two-way merge of saved posts between local and a deployed server, for when both
# sides got posts since they last matched. Union by (_id, createdAt): the posts the two
# sides already shared collapse, while a repost of the same link is kept — it has its
# own createdAt (and usually its own _id). On a collision the copy with more tags wins,
# since tagging is the usual divergence. Result is written to BOTH sides, newest first.
#
#   ./scripts/merge-myposts.sh user@server
#   ./scripts/merge-myposts.sh user@server /srv/feeds/data     # custom remote data root
set -euo pipefail
cd "$(dirname "$0")/.."

REMOTE="${1:?usage: merge-myposts.sh user@host [remote-data-dir]}"
DATA_ROOT="${2:-/srv/feeds/data}"

LOCAL_DATA="${LOCAL_DATA:-packages/app/static}"   # DATA_DIR default in dev
LOCAL_CACHE="${LOCAL_CACHE:-packages/app/cache}"  # CACHE_DIR default in dev
LOCAL="$LOCAL_DATA/myposts.json"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

scp "$REMOTE:$DATA_ROOT/feeds/myposts.json" "$tmp/remote.json"

jq -s 'add
  | group_by([._id, .createdAt])
  | map(sort_by(-(.tags | length)) | .[0])
  | sort_by(-.createdAt)' "$LOCAL" "$tmp/remote.json" > "$tmp/merged.json"

cp "$LOCAL" "$LOCAL.bak"
mv "$tmp/merged.json" "$LOCAL"
echo "merged: local $(jq length "$LOCAL.bak") + remote $(jq length "$tmp/remote.json") -> $(jq length "$LOCAL") (backup: $LOCAL.bak)"

# Pull the server's image cache down first so the push carries the union — the cache
# is content-addressed, so neither direction can clobber a good file.
mkdir -p "$LOCAL_CACHE"
rsync -az --partial "$REMOTE:$DATA_ROOT/cache/" "$LOCAL_CACHE"/

exec ./scripts/sync-data.sh "$REMOTE" "$DATA_ROOT"
