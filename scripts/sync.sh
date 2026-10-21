#!/usr/bin/env bash
# Merge one account into another — any account, local or on a server. <to> ends up with
# the union of both; <from> is left alone unless --both. Nothing is ever removed, so a
# post or feed deleted on one side comes back from the other: to make one side
# authoritative use sync-data.sh / sync-from-server.sh, which overwrite instead.
#
#   ./scripts/sync.sh <from> <to> [--both] [--all] [--dry-run]
#
# An endpoint is [host:][@account]; `.` is the local single-user root.
#
#   ./scripts/sync.sh server:@bob @bob         # the server's bob into the local bob
#   ./scripts/sync.sh . user@server:@attila    # local root into an account on the server
#   ./scripts/sync.sh @test @bob               # local to local
#   ./scripts/sync.sh server: . --both         # two-way, root account
#   ./scripts/sync.sh server: . --both --all   # two-way, every account matched by name
#
# Merged: myposts.json — union by (_id, createdAt), so a repost of the same link is kept;
#           on a collision the copy with more tags wins, since tagging is the usual
#           divergence.
#         feeds.json — union by feedUrl, tags unioned; <to> keeps its own order, its
#           other fields and maxPosts, and new feeds are appended.
#         image cache — content-addressed, so only missing files are copied.
# Not copied: feed-cache.json and tag-embeddings.json (derived, the app rebuilds them)
# and users.json (write keys stay where they were minted).
#
# jq runs locally, so a server needs nothing installed. A replaced file is kept as .bak.
# DATA_ROOT is the data root on every remote host; LOCAL_DATA / LOCAL_CACHE the local dirs.
set -euo pipefail
cd "$(dirname "$0")/.."

USAGE='usage: sync.sh <from> <to> [--both] [--all] [--dry-run]   (endpoint: [host:][@account], "." = local root)'
die() {
  echo "sync.sh: $*" >&2
  exit 1
}

DATA_ROOT="${DATA_ROOT:-/srv/feeds/data}"
LOCAL_DATA="${LOCAL_DATA:-packages/app/static}"  # DATA_DIR default in dev
LOCAL_CACHE="${LOCAL_CACHE:-packages/app/cache}" # CACHE_DIR default in dev

BOTH='' ALL='' DRY=''
ends=()
for arg in "$@"; do
  case "$arg" in
    --both) BOTH=1 ;;
    --all) ALL=1 ;;
    --dry-run) DRY=1 ;;
    -*) die "unknown option $arg
$USAGE" ;;
    *) ends+=("$arg") ;;
  esac
done
[ "${#ends[@]}" -eq 2 ] || die "$USAGE"

# Split an endpoint into HOST ("" = local) and ACCT ("" = root, else "@name"). The
# account pattern is the app's own (isValidUserName), so it is also safe to quote.
parse() {
  local spec="$1" rest="$1"
  HOST=''
  if [[ "$spec" == *:* ]]; then
    HOST="${spec%:*}"
    rest="${spec##*:}"
  fi
  if [ "$rest" = . ] || { [ -z "$rest" ] && [ -n "$HOST" ]; }; then
    ACCT=''
  elif [[ "$rest" =~ ^@[a-z0-9_]+$ ]]; then
    ACCT="$rest"
  else
    die "bad endpoint '$spec'
$USAGE"
  fi
}
parse "${ends[0]}" && FROM_HOST="$HOST" FROM_ACCT="$ACCT"
parse "${ends[1]}" && TO_HOST="$HOST" TO_ACCT="$ACCT"

if [ -n "$ALL" ]; then
  [ -z "$FROM_ACCT$TO_ACCT" ] || die "--all pairs accounts by name, so neither endpoint may name one"
  [ "$FROM_HOST" != "$TO_HOST" ] || die "--all needs two different hosts"
elif [ "$FROM_HOST" = "$TO_HOST" ] && [ "$FROM_ACCT" = "$TO_ACCT" ]; then
  die "<from> and <to> are the same account"
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# Run a shell snippet on a host; "" is this machine.
on() {
  if [ -n "$1" ]; then ssh "$1" "$2"; else sh -c "$2"; fi
}
data_dir() { # host account
  if [ -n "$1" ]; then echo "$DATA_ROOT/feeds${2:+/$2}"; else echo "$LOCAL_DATA${2:+/$2}"; fi
}
cache_dir() { # host account
  if [ -n "$1" ]; then echo "$DATA_ROOT/cache${2:+/$2}"; else echo "$LOCAL_CACHE${2:+/$2}"; fi
}
label() { # host account
  echo "${1:+$1:}${2:-root}"
}
exists() { # host account
  local rc=0
  on "$1" "[ -d '$(data_dir "$1" "$2")' ]" || rc=$?
  [ "$rc" -le 1 ] || die "cannot reach $1" # ssh's own failure, not a missing dir
  return "$rc"
}
accounts() { # host -> the @name dirs under its data root, one per line
  on "$1" "ls '$(data_dir "$1" '')' 2>/dev/null || true" | grep -E '^@[a-z0-9_]+$' || true
}

# Fetch a JSON file, or $4 when it does not exist. A failed ssh aborts rather than
# reading as "empty" — merging against a falsely empty side would overwrite real data.
fetch() { # host path out default
  on "$1" "[ ! -e '$2' ] || cat '$2'" > "$3"
  [ -s "$3" ] || echo "$4" > "$3"
  jq -e . "$3" > /dev/null || die "$(label "$1" '') $2 is not valid JSON"
}

# Merge one file into <to>; `cur` is <to>'s copy, `src` is <from>'s, both in $tmp.
put() { # name host dir countFilter
  local name="$1" host="$2" dir="$3" count="$4" file="$3/$1"
  local summary
  summary="$(jq "$count" "$tmp/cur") + $(jq "$count" "$tmp/src") -> $(jq "$count" "$tmp/out")"
  if [ "$(jq -c . "$tmp/cur")" = "$(jq -c . "$tmp/out")" ]; then
    echo "  $name: $summary (unchanged)"
  elif [ -n "$DRY" ]; then
    echo "  $name: $summary (dry run, not written)"
  else
    on "$host" "mkdir -p '$dir' && { [ ! -e '$file' ] || cp -p '$file' '$file.bak'; } && cat > '$file.tmp' && mv '$file.tmp' '$file'" < "$tmp/out"
    echo "  $name: $summary"
  fi
}

copy_images() { # from-host from-dir to-host to-dir
  local fh="$1" fc="$2" th="$3" tc="$4"
  on "$fh" "[ -d '$fc' ]" || return 0
  # --ignore-existing: a file's name is its content hash, so an existing one is already
  # right. --exclude: user caches are nested inside the root's cache dir. -rl, not -a:
  # the remote dirs belong to the service user, and setting their perms/times as another
  # account fails; new files take the server's umask so the service can still write.
  local flags=(-rlz --partial --ignore-existing --exclude='@*/')
  if [ -n "$fh" ] && [ -n "$th" ]; then
    if [ -n "$DRY" ]; then
      echo "  images: not checked (dry run between two servers)"
      return 0
    fi
    # ponytail: rsync cannot copy between two remotes, so stage the whole account cache
    # here. Run rsync on one of the servers if that gets too big to pull through.
    mkdir -p "$tmp/cache"
    rsync "${flags[@]}" "$fh:$fc/" "$tmp/cache/"
    fh='' fc="$tmp/cache"
  fi
  if [ -n "$DRY" ]; then
    local n
    n=$(rsync -n "${flags[@]}" --out-format='%n' "${fh:+$fh:}$fc/" "${th:+$th:}$tc/" 2>/dev/null | grep -vc '/$' || true)
    echo "  images: $n to copy (dry run)"
  else
    on "$th" "mkdir -p '$tc'"
    rsync "${flags[@]}" "${fh:+$fh:}$fc/" "${th:+$th:}$tc/"
  fi
  rm -rf "$tmp/cache"
}

merge_into() { # from-host from-account to-host to-account
  local fh="$1" fa="$2" th="$3" ta="$4"
  local fd td
  fd=$(data_dir "$fh" "$fa") td=$(data_dir "$th" "$ta")
  echo "$(label "$fh" "$fa") -> $(label "$th" "$ta")"
  exists "$fh" "$fa" || die "no such account: $(label "$fh" "$fa") ($fd)"
  if [ -n "$ta" ] && ! exists "$th" "$ta"; then
    echo "  note: $(label "$th" "$ta") is new — it has no write key until you add one to that side's users.json (mint-key.sh or /invite/${ta#@})"
  fi

  # <to> goes first, so its copy wins a tie.
  fetch "$th" "$td/myposts.json" "$tmp/cur" '[]'
  fetch "$fh" "$fd/myposts.json" "$tmp/src" '[]'
  jq -s 'add
    | group_by([._id, .createdAt])
    | map(sort_by(-(.tags | length)) | .[0])
    | sort_by(-.createdAt)' "$tmp/cur" "$tmp/src" > "$tmp/out"
  put myposts.json "$th" "$td" length

  fetch "$th" "$td/feeds.json" "$tmp/cur" '{"feeds":[]}'
  fetch "$fh" "$fd/feeds.json" "$tmp/src" '{"feeds":[]}'
  jq -s '.[0] as $to | .[1] as $from
    | reduce (($to.feeds // []) + ($from.feeds // []))[] as $f ({order: [], by: {}};
        .by[$f.feedUrl] as $seen
        | if $seen == null then .order += [$f.feedUrl] | .by[$f.feedUrl] = $f
          elif ($seen.tags // $f.tags) == null then .
          else .by[$f.feedUrl].tags = (reduce (($seen.tags // []) + ($f.tags // []))[] as $t ([];
            if any(.[]; . == $t) then . else . + [$t] end))
          end)
    | . as $m
    | $from + $to + {feeds: [$m.order[] | $m.by[.]]}' "$tmp/cur" "$tmp/src" > "$tmp/out"
  put feeds.json "$th" "$td" '.feeds | length'

  copy_images "$fh" "$(cache_dir "$fh" "$fa")" "$th" "$(cache_dir "$th" "$ta")"
}

# One <from> -> <to> pair, plus the way back for --both. The second pass re-reads <to>,
# which by then holds the union, so each side keeps its own feed order and maxPosts.
pair() { # from-host from-account to-host to-account
  merge_into "$1" "$2" "$3" "$4"
  if [ -n "$BOTH" ] && [ -n "$DRY" ]; then
    echo "  --both: $(label "$1" "$2") would receive the same union"
  elif [ -n "$BOTH" ]; then
    merge_into "$3" "$4" "$1" "$2"
  fi
}

if [ -z "$ALL" ]; then
  pair "$FROM_HOST" "$FROM_ACCT" "$TO_HOST" "$TO_ACCT"
else
  # The root, plus every account on either side. One that only <to> has is merged back
  # only with --both; without it there is nothing to bring over.
  for acct in '' $({ accounts "$FROM_HOST"; accounts "$TO_HOST"; } | sort -u); do
    if exists "$FROM_HOST" "$acct"; then
      pair "$FROM_HOST" "$acct" "$TO_HOST" "$acct"
    elif [ -n "$BOTH" ]; then
      BOTH='' pair "$TO_HOST" "$acct" "$FROM_HOST" "$acct"
    fi
  done
fi
