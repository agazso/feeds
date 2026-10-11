#!/usr/bin/env bash
# Self-check for sync.sh: merges throwaway local accounts and asserts the result.
#   ./scripts/sync.test.sh
set -euo pipefail
cd "$(dirname "$0")/.."

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
export LOCAL_DATA="$tmp/data" LOCAL_CACHE="$tmp/cache"

check() { # description, jq filter, file
  jq -e "$2" "$3" > /dev/null || {
    echo "FAIL: $1" >&2
    exit 1
  }
}

mkdir -p "$LOCAL_DATA"/@a "$LOCAL_DATA"/@b "$LOCAL_CACHE"/@a/0/1 "$LOCAL_CACHE"/@x/0/1
# @a and @b share post p1 (b tagged it more) and feed f1 (different tags); each has one
# post and one feed of its own. The root has one post and a nested user cache.
echo '[{"_id":"p2","createdAt":2,"tags":[]},{"_id":"p1","createdAt":1,"tags":["x"]}]' > "$LOCAL_DATA/@a/myposts.json"
echo '[{"_id":"p3","createdAt":3,"tags":[]},{"_id":"p1","createdAt":1,"tags":["x","y"]}]' > "$LOCAL_DATA/@b/myposts.json"
echo '{"feeds":[{"feedUrl":"f1","name":"a","tags":["t1"]},{"feedUrl":"f2"}],"maxPosts":10}' > "$LOCAL_DATA/@a/feeds.json"
echo '{"feeds":[{"feedUrl":"f3"},{"feedUrl":"f1","name":"b","tags":["t2"]}],"maxPosts":50}' > "$LOCAL_DATA/@b/feeds.json"
echo '[{"_id":"r1","createdAt":9,"tags":[]}]' > "$LOCAL_DATA/myposts.json"
echo img > "$LOCAL_CACHE/@a/0/1/hash.webp"
echo other > "$LOCAL_CACHE/@x/0/1/other.webp"
cp -r "$LOCAL_DATA/@a" "$tmp/a-before"

./scripts/sync.sh @a @b --dry-run > /dev/null
check 'dry run writes nothing' 'length == 2' "$LOCAL_DATA/@b/myposts.json"

./scripts/sync.sh @a @b > /dev/null
check 'posts are the union, newest first' 'map(._id) == ["p3","p2","p1"]' "$LOCAL_DATA/@b/myposts.json"
check 'the copy with more tags wins' '.[2].tags == ["x","y"]' "$LOCAL_DATA/@b/myposts.json"
check 'feeds keep <to> order, new ones appended' '.feeds | map(.feedUrl) == ["f3","f1","f2"]' "$LOCAL_DATA/@b/feeds.json"
check 'feed tags are unioned, <to> fields kept' '.feeds[1] == {"feedUrl":"f1","name":"b","tags":["t2","t1"]}' "$LOCAL_DATA/@b/feeds.json"
check '<to> keeps its maxPosts' '.maxPosts == 50' "$LOCAL_DATA/@b/feeds.json"
check 'the replaced file is backed up' 'length == 2' "$LOCAL_DATA/@b/myposts.json.bak"
[ -f "$LOCAL_CACHE/@b/0/1/hash.webp" ] || { echo 'FAIL: images are copied' >&2; exit 1; }
diff -r "$LOCAL_DATA/@a" "$tmp/a-before" || { echo 'FAIL: <from> is untouched without --both' >&2; exit 1; }

./scripts/sync.sh @b @a --both > /dev/null
check '--both writes the union back' 'map(._id) == ["p3","p2","p1"]' "$LOCAL_DATA/@a/myposts.json"
check '--both keeps each side its own maxPosts' '.maxPosts == 10' "$LOCAL_DATA/@a/feeds.json"

./scripts/sync.sh . @new > /dev/null
check 'a new account is created from the root' 'map(._id) == ["r1"]' "$LOCAL_DATA/@new/myposts.json"
[ ! -e "$LOCAL_CACHE/@new/@x" ] || { echo 'FAIL: nested user caches stay out of a root copy' >&2; exit 1; }

if ./scripts/sync.sh @nobody @b > /dev/null 2>&1; then
  echo 'FAIL: a missing <from> account is an error' >&2
  exit 1
fi

echo 'sync.sh: ok'
