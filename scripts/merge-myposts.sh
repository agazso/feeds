#!/usr/bin/env bash
# Two-way merge of saved posts between local and a deployed server, for when both
# sides got posts since they last matched. Union by (_id, createdAt): the posts the two
# sides already shared collapse, while a repost of the same link is kept — it has its
# own createdAt (and usually its own _id). On a collision the copy with more tags wins,
# since tagging is the usual divergence. Result is written to BOTH sides, newest first.
#
# Every scope is merged separately: the single-user root plus each /@user that exists
# on either side. A user present on only one side is carried over as-is.
#
#   ./scripts/merge-myposts.sh user@server
#   ./scripts/merge-myposts.sh user@server /srv/feeds/data     # custom remote data root
set -euo pipefail
cd "$(dirname "$0")/.."

REMOTE="${1:?usage: merge-myposts.sh user@host [remote-data-dir]}"
DATA_ROOT="${2:-/srv/feeds/data}"

LOCAL_DATA="${LOCAL_DATA:-packages/app/static}"   # DATA_DIR default in dev
LOCAL_CACHE="${LOCAL_CACHE:-packages/app/cache}"  # CACHE_DIR default in dev

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# Merge one scope: "" is the single-user root, otherwise an @user directory name.
merge_scope() {
  local scope="${1:-}"
  local label="${scope:-root}"
  local dir="$LOCAL_DATA${scope:+/$scope}"
  local local_file="$dir/myposts.json"
  local remote_file="$DATA_ROOT/feeds${scope:+/$scope}/myposts.json"

  mkdir -p "$dir"
  [ -f "$local_file" ] || echo '[]' > "$local_file"
  # A scope the server hasn't got yet merges against nothing.
  scp -q "$REMOTE:$remote_file" "$tmp/remote.json" 2>/dev/null || echo '[]' > "$tmp/remote.json"

  jq -s 'add
    | group_by([._id, .createdAt])
    | map(sort_by(-(.tags | length)) | .[0])
    | sort_by(-.createdAt)' "$local_file" "$tmp/remote.json" > "$tmp/merged.json"

  cp "$local_file" "$local_file.bak"
  mv "$tmp/merged.json" "$local_file"
  echo "  $label: local $(jq length "$local_file.bak") + remote $(jq length "$tmp/remote.json") -> $(jq length "$local_file")"
}

# Scopes: the root, plus every @user dir on either side (a user may exist on one only).
local_users=$(cd "$LOCAL_DATA" 2>/dev/null && ls -d @*/ 2>/dev/null | tr -d /) || true
remote_users=$(ssh "$REMOTE" "ls -d '$DATA_ROOT'/feeds/@*/ 2>/dev/null" | xargs -r -n1 basename) || true
scopes=$(printf '%s\n%s\n' "${local_users:-}" "${remote_users:-}" | sort -u | grep . || true)

merge_scope ""
for scope in $scopes; do
  merge_scope "$scope"
done

# Pull the server's image cache down first so the push carries the union — the cache
# is content-addressed, so neither direction can clobber a good file.
mkdir -p "$LOCAL_CACHE"
rsync -az --partial "$REMOTE:$DATA_ROOT/cache/" "$LOCAL_CACHE"/

exec ./scripts/sync-data.sh "$REMOTE" "$DATA_ROOT"
