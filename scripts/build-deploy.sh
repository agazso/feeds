#!/usr/bin/env bash
# Build feeds and produce a self-contained folder to run with plain `node` on a
# Debian trixie x64 server. No Docker. Offline (uses the warm pnpm store).
#
#   ./scripts/build-deploy.sh                 # -> ./deploy-out
#   ./scripts/build-deploy.sh user@server     # + rsync to /srv/feeds/app (resumable)
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${OUT:-./deploy-out}"
REMOTE="${1:-}"
DATA_ROOT="${DATA_ROOT:-/srv/feeds/data}"          # must match FEEDS_DATA_DIR's parent
LOCAL_KEYS="${LOCAL_KEYS:-packages/app/users.json}"

pnpm --filter @feeds/core build
pnpm --filter @feeds/app build
rm -rf "$OUT"
pnpm --filter @feeds/app deploy --prod "$OUT"

# Strip onnxruntime to linux-x64 CPU (drops ~500M: CUDA + tensorrt + other platforms).
d=$(echo "$OUT"/node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/bin/napi-v3)
rm -rf "$d/darwin" "$d/win32" "$d/linux/arm64"
rm -f  "$d/linux/x64/libonnxruntime_providers_cuda.so" \
       "$d/linux/x64/libonnxruntime_providers_tensorrt.so"
# sharp's musl binaries never load on glibc Debian.
rm -rf "$OUT"/node_modules/.pnpm/@img+sharp-libvips-linuxmusl-x64@* \
       "$OUT"/node_modules/.pnpm/@img+sharp-linuxmusl-x64@*
# adapter-node only needs build/ + node_modules/ + package.json. Drop dev files and
# any local runtime dirs (static/cache/models) — the server has its own /data volume.
rm -rf "$OUT"/{src,tests,scripts,static,cache,models,vite.config.ts,vitest.config.ts,tsconfig.json,svelte.config.js}

# DATA_DIR defaults to static/, so the build copies whatever lives there into
# build/client/ and serves it publicly. Drop that snapshot: the server reads its own
# /data volume, and shipping it would publish local feeds, saved posts and — since
# multi-user — every /@user's copy of the same, at e.g. /@bob/myposts.json.
rm -rf "$OUT"/build/client/@*
rm -f "$OUT"/build/client/{feeds,myposts,feed-cache,tag-embeddings}.json*

# systemd unit — install once on the server: sudo cp feeds.service /etc/systemd/system/
# then `sudo systemctl daemon-reload && sudo systemctl enable --now feeds`.
# Check `which node` on the server and fix ExecStart if it isn't /usr/bin/node.
cat > "$OUT/feeds.service" <<'EOF'
[Unit]
Description=feeds (SvelteKit adapter-node)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/srv/feeds/app
EnvironmentFile=/srv/feeds/app/.env
ExecStart=/usr/bin/node build/index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

# .env.example (NOT .env — see rsync --exclude below). Copy to .env on the server once.
cat > "$OUT/.env.example" <<'EOF'
PORT=3000
FEEDS_DATA_DIR=/srv/feeds/data/feeds
FEEDS_CACHE_DIR=/srv/feeds/data/cache
FEEDS_MODELS_DIR=/srv/feeds/data/models
ORIGIN=https://your.domain
PROTOCOL_HEADER=x-forwarded-proto
HOST_HEADER=x-forwarded-host
EOF

echo "built $OUT ($(du -sh "$OUT" | cut -f1))"

if [ -n "$REMOTE" ]; then
  # -z compresses in flight, --partial resumes a dropped transfer (slow-link friendly).
  # node_modules rarely changes, so repeat syncs ship mostly just build/.
  # --delete-after prunes superseded content-hashed assets (they pile up otherwise), and
  # deletes only once the new files are in place so the running server never 404s mid-deploy.
  # Excluded paths are also protected from deletion: .env is the server's edited config, and
  # the anchored dirs hold live data when the FEEDS_* env vars are unset (see lib/paths.ts).
  rsync -az --partial --info=progress2 --delete-after \
    --exclude=.env --exclude=/static/ --exclude=/cache/ --exclude=/models/ \
    "$OUT"/ "$REMOTE":/srv/feeds/app/

  # No keyfile means auth is OFF and anyone can write, so a deploy must never leave the
  # server without one. This only ever *adds* it: an existing keyfile is the server's
  # own and is never overwritten here (use SYNC_KEYS=1 ./scripts/sync-data.sh for that).
  if ssh "$REMOTE" "[ -s '$DATA_ROOT/users.json' ]"; then
    echo "keys: $DATA_ROOT/users.json present — left untouched"
  elif [ -s "$LOCAL_KEYS" ]; then
    ssh "$REMOTE" "mkdir -p '$DATA_ROOT'"
    rsync -az --no-g --partial "$LOCAL_KEYS" "$REMOTE:$DATA_ROOT/users.json"
    echo "keys: installed $LOCAL_KEYS -> $DATA_ROOT/users.json (writes now need a key)"
  else
    echo
    echo "WARNING: no keyfile at $DATA_ROOT/users.json on the server, and none locally"
    echo "         at $LOCAL_KEYS. WRITES ARE OPEN TO ANYONE. Create one with:"
    echo "           ./scripts/mint-key.sh $REMOTE"
    echo
  fi
fi
