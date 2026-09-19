# Deploying `feeds` (Podman + Dockge on a Debian trixie server)

This guide describes how to self-host the `feeds` web app on a personal server that
already runs an **nginx reverse proxy on the host**. It targets Debian 13 (trixie) and
uses **rootless Podman** for isolation, **Dockge** for a focused web management UI, and
**lazydocker** for terminal management.

## Why this setup

- **Isolation without polluting the OS** → rootless/daemonless **Podman** (in trixie's own
  repos) instead of Docker's root daemon + external `docker-ce` repo.
- **No heavy CLI** → a focused web UI (**Dockge**) plus a TUI (**lazydocker**), not the
  raw `docker`/`podman` CLI.
- **Tight disk** → the dependency tree is dominated by ML native code, so the image is
  aggressively trimmed and built **off-server**.

### The disk problem this design solves

Production deps are ~1.4 GB, almost entirely waste for a CPU-only linux-x64 server:

- `onnxruntime-node` (536 MB) ships every platform incl. a **327 MB CUDA provider**,
  darwin dylibs (65 MB), win32 DLLs (69 MB), linux-arm64 (34 MB). Only **~25 MB**
  (linux-x64 CPU `.so` + binding) is needed.
- `@huggingface/transformers` (898 MB) is mostly **dev-cached model files** baked into
  `node_modules/.../.cache/` (a 750 MB Qwen model that isn't even used, + the 87 MB
  MiniLM the app actually uses). A clean install doesn't have these; models belong in a
  runtime volume, not the image.
- `sharp` + libvips (linux-x64): ~33 MB (keep).

Trimmed result: **~250–350 MB image**; the ~90 MB MiniLM model lives in a data volume.

### App facts that drive the config

- Runtime state is files (no database):
  - `process.cwd()/static/{feeds.json,myposts.json,tag-embeddings.json}` — read+write
    (`src/lib/config.ts`, `src/lib/myfeed.ts`, `src/routes/api/myfeed/+server.ts`,
    `src/lib/embeddings/tag-embeddings.ts`).
  - Image cache via an `import.meta.url`-relative `../../../cache`
    (`src/lib/server/imageProcessing.ts`, `src/routes/cache/[...path]/+server.ts`) — this
    is fragile after bundling and is made env-driven below.
- ML runs **at request time**: `getEmbeddingBasedTags` → `embed()` →
  `pipeline('Xenova/all-MiniLM-L6-v2')` from `src/routes/api/suggest-tags/+server.ts`, so
  transformers/onnxruntime **must** ship in the runtime image (not a devDependency).
- adapter-node's entrypoint is `build/index.js`, honors `PORT` (default 3000), and needs
  `ORIGIN` + forwarded-header vars behind a TLS-terminating proxy.

## Architecture

```
Internet → nginx (host, TLS) → 127.0.0.1:3000 → Podman container (rootless)
                                                   feeds app (node build/index.js)
                                                   volume: /srv/feeds/data → /data
Management:  Dockge (web, :5001)  +  lazydocker (TUI)  — both via the rootless Podman socket
Build:       off-server (GitHub Actions or laptop) → image → server
```

## Step 1 — Code changes (make the app container-friendly)

Add `packages/app/src/lib/paths.ts` (NOT under `$lib/server/` — the embeddings
chain that imports `MODELS_DIR` is reachable from `.svelte` components, and
SvelteKit's server-only guard rejects a `$lib/server/*` import in that graph):

```ts
import { join } from 'node:path'
export const DATA_DIR   = process.env.FEEDS_DATA_DIR   ?? join(process.cwd(), 'static')
export const CACHE_DIR  = process.env.FEEDS_CACHE_DIR  ?? join(process.cwd(), 'cache')
export const MODELS_DIR = process.env.FEEDS_MODELS_DIR ?? join(process.cwd(), 'models')
```

Also required so the server-only embedding code tree-shakes out of the browser
bundle: `embedder.ts` sets `env.cacheDir = MODELS_DIR` **lazily inside
`getEmbedder()`** (not at module top level — a top-level side-effect defeats
tree-shaking and drags `node:path` into the client), and `tags.ts` must **not**
re-export `getEmbeddingBasedTags` (server route imports it from `$lib/embeddings`
directly). The `DATA_DIR` repoint covers `feeds.json`, `myposts.json` (4 sites),
`feed-cache.json`, and `tag-embeddings.json`.

Then:

- `config.ts`, `myfeed.ts`, `routes/api/myfeed/+server.ts`, `embeddings/tag-embeddings.ts`
  → build file paths from `DATA_DIR` (keep the existing `FEEDS_CONFIG`/`FEEDS_CHANNEL`
  read fallbacks in `config.ts`).
- `imageProcessing.ts` and `routes/cache/[...path]/+server.ts` → import `CACHE_DIR` from
  `paths.ts` instead of computing it from `import.meta.url`.
- `embeddings/embedder.ts` → redirect the transformers model cache to a volume so the
  model downloads into `/data`, not the image:

  ```ts
  import { pipeline, env, /* ... */ } from '@huggingface/transformers'
  env.cacheDir = MODELS_DIR   // from paths.ts
  ```

Defaults preserve current local/dev behavior exactly; the container sets the three env
vars to subpaths of `/data`.

## Step 2 — `Dockerfile` (repo root) — trixie-slim, multi-stage, stripped

See the repo-root `Dockerfile` for the working version. Two non-obvious points learned
building it (both cost a failed build first):

- **`pnpm deploy` keeps onnxruntime in the `.pnpm` store, not a top-level symlink** (it's
  a transitive dep of `@huggingface/transformers`, not a direct dep of `@feeds/app`). The
  strip path is `/app/node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/bin/napi-v3`,
  **not** `/app/node_modules/onnxruntime-node/...` (that dir doesn't exist → `cd` fails).
- **`pnpm deploy` re-runs postinstall**, re-downloading onnxruntime's 327 MB GPU tarball
  unless it can reuse the store. Give the deploy step the **same `--store-dir /pnpm/store`
  and `--mount=type=cache`** as the install step so it reuses the warm store instead of
  re-fetching (turns a ~15-min stall into seconds).

```dockerfile
FROM build AS deploy
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @feeds/app deploy --prod --store-dir /pnpm/store /app
# strip onnxruntime to linux-x64 CPU only (~500 MB): 327M CUDA + tensorrt + other platforms
RUN set -eux; \
    d="$(echo /app/node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/bin/napi-v3)"; \
    test -d "$d"; \
    rm -rf "$d/darwin" "$d/win32" "$d/linux/arm64"; \
    rm -f  "$d/linux/x64/libonnxruntime_providers_cuda.so" \
           "$d/linux/x64/libonnxruntime_providers_tensorrt.so"
# sharp's musl binaries never load on glibc Debian — drop them (~25 MB)
RUN rm -rf /app/node_modules/.pnpm/@img+sharp-libvips-linuxmusl-x64@* \
           /app/node_modules/.pnpm/@img+sharp-linuxmusl-x64@*
```

Notes: Debian (not Alpine) because sharp + onnxruntime need glibc; trixie's newer glibc is
strictly safer for the onnxruntime prebuilt. `pnpm deploy` materializes the `@feeds/core`
workspace dep into real `node_modules` (no symlinks). Verify the exact `bin/napi-v3`
layout before deleting paths (it can change across onnxruntime versions).

**Verified image size: ~440 MB** (higher than the 250–350 MB estimate because
`onnxruntime-web`, 91 MB of wasm, ships as a transitives dep — the node runtime doesn't
use it, but it's only ever dynamically referenced, so it's left in to avoid breaking the
ML feature; drop it for another ~90 MB if you confirm your version never imports it). The
~90 MB MiniLM model lives in the `/data/models` volume, downloaded on first tag-suggest.

**Building on a disk-tight machine:** podman commits build layers via `$TMPDIR` (default
`/var/tmp`). If root is full, point it at a roomy disk: `TMPDIR=/some/big/disk/tmp podman build ...`.

## Step 3 — `.dockerignore` (repo root)

```
**/node_modules
**/.svelte-kit
**/build
**/dist
**/coverage
.git
.github
*.md
packages/app/static/feeds.json
packages/app/static/myposts.json
packages/app/static/tag-embeddings.json
packages/app/cache
packages/app/models
.playwright-mcp
```

## Step 4 — Server prerequisites (all from trixie repos; rootless)

```bash
sudo apt install podman                        # 5.4.x in trixie, daemonless/rootless
loginctl enable-linger "$USER"                 # keep rootless services alive after logout/boot
systemctl --user enable --now podman.socket    # Docker-compatible API for Dockge/lazydocker
# lazydocker: install the released binary (not packaged); it auto-detects the podman socket
```

Run Dockge itself as a rootless container, with the podman socket mounted where it expects
the docker socket (`/run/user/$(id -u)/podman/podman.sock` → `/var/run/docker.sock`).
Install `podman-docker` to provide the `docker` CLI shim Dockge shells out to.

Data dir + rootless ownership:

```bash
mkdir -p /srv/feeds/data/{feeds,cache,models}
# seed initial feed config from the dev machine:
scp packages/app/static/feeds.json server:/srv/feeds/data/feeds/
```

Rootless bind-mount ownership: run the container with **`--userns=keep-id`** (compose:
`userns_mode: "keep-id"`) so the container's `node` user maps to your host user and the
bind-mounted `/srv/feeds/data` stays writable + inspectable. (Alternative: a named Podman
volume, which sidesteps uid mapping but is less convenient to edit/back up.) Debian uses
AppArmor, not SELinux, so the `:Z` volume flag is **not** needed here.

## Step 5 — Compose stack (managed by Dockge) + env

`docker-compose.yml` (imported into Dockge as a stack):

```yaml
services:
  app:
    image: ghcr.io/agazso/feeds:latest
    restart: unless-stopped
    userns_mode: "keep-id"
    env_file: .env
    ports:
      - "127.0.0.1:3000:3000"     # only host nginx reaches it
    volumes:
      - /srv/feeds/data:/data
```

`.env` (alongside the stack):

```
PORT=3000
FEEDS_DATA_DIR=/data/feeds
FEEDS_CACHE_DIR=/data/cache
FEEDS_MODELS_DIR=/data/models
ORIGIN=https://feeds.example.com
PROTOCOL_HEADER=x-forwarded-proto
HOST_HEADER=x-forwarded-host
```

`ORIGIN` + the two `*_HEADER` vars are **required** or adapter-node rejects POST/auth
(cookie login) behind the proxy.

### Authentication (write protection)

The keyfile (`FEEDS_KEYFILE`, default `users.json` beside `FEEDS_DATA_DIR`) gates all writes (share/tag/delete). The logic
(`hooks.server.ts`, `$lib/server/auth.ts`):

- **Missing/empty file → auth is OFF → writes are open to everyone.** No keyfile does
  **not** block you; it means the public can write to your instance.
- **One or more entries → auth is ON.** Writes return `401` until you present that
  scope's key. The entry named `""` is single-user mode; `"bob"` covers `/@bob`.

So on a public deployment you almost always want a key set. Enable it:

```bash
# on the server
KEY=$(openssl rand -hex 24)
echo "save this key: $KEY"
# beside FEEDS_DATA_DIR, never inside it — that dir is served publicly
printf '{"": "%s"}\n' "$KEY" | sudo tee /srv/feeds/data/users.json
sudo systemctl restart feeds        # keys are read once per process
```

Add further users from `https://<host>/invite` once the root key is set — it writes their
key into `users.json` and gives you a link to send them.

Then log in once per browser/device — visit `https://<host>/auth?key=<KEY>` (or the `/auth`
form). It sets a 1-year httpOnly cookie (`feeds-auth-key`); after that you can share, and
anyone without the cookie gets `401` on writes. Every device uses the same key for a given
scope; per-user scopes (`/@bob`) get their own entry in `users.json`.

Troubleshooting a failed share: `401 "Authentication required"` = not logged in / wrong key
→ redo `/auth?key=`. `403 "Cross-site POST … forbidden"` = it's **not** auth, it's `ORIGIN`
not matching the real URL → fix `ORIGIN` and restart.

## Step 6 — Build off-server & deliver the image (pick one; no registry account needed)

The server is disk-tight, so it must never hold the multi-GB builder stage — build
elsewhere and ship only the ~300 MB runtime image.

- **A. Public GHCR (recommended, keyless).** GitHub Actions builds on push to `main` and
  pushes `ghcr.io/agazso/feeds:latest` + `:<sha>` using the workflow's built-in
  `GITHUB_TOKEN` (`permissions: packages: write`) — no separate account/secret. Mark the
  GHCR **package** public (independent of the private repo) so the server pulls with no
  credentials. Dockge's "pull + up" then deploys. Layer dedup means repeat pulls fetch
  only the ~30 MB app layer.
- **B. No registry at all.** Build on the laptop and
  `podman save ghcr.io/agazso/feeds:latest | gzip | ssh server 'gunzip | podman load'`
  (~120–150 MB transfer), then deploy the stack in Dockge.

## Step 7 — nginx (host) — reference snippet for the existing proxy

```nginx
location / {
    proxy_pass         http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;   # feeds PROTOCOL_HEADER
    proxy_set_header   X-Forwarded-Host  $host;      # feeds HOST_HEADER
}
```

## Disk & retention

- Final image ~250–350 MB; keep `:latest` + optionally one `:previous` for rollback (~600 MB).
- Images never auto-delete; each deploy leaves a dangling `<none>`. Run
  `podman image prune -f` after each deploy (a Dockge post-action or a tiny
  `podman-image-prune.timer`). Never `--volumes` on prune (data is a bind mount so it's
  safe, but make it a habit).
- Models (~90 MB) and all state live in `/srv/feeds/data` — back that dir up; it survives
  every redeploy and image prune.

## Operations

- **Deploy:** push to `main` (path A) → Actions builds/pushes → in Dockge, pull + up the
  `feeds` stack. Or path B: `save | load`, then up.
- **Rollback:** point the stack image tag at the previous `:<sha>` and re-up.
- **Logs / status / restart:** Dockge (web) or `lazydocker` (terminal).
- **Alternative management:** a Podman **Quadlet** `.container` unit with
  `AutoUpdate=registry` + `podman-auto-update.timer` makes deploys pull-based and fully
  systemd-native, dropping Dockge — keep in pocket if the web UI proves unnecessary.

## Verification

1. **Local image smoke test** (laptop), proving size + behavior before the server:

   ```bash
   podman build -t feeds .
   podman image inspect feeds --format '{{.Size}}'    # expect ~250–350 MB
   mkdir -p /tmp/fd/{feeds,cache,models}
   cp packages/app/static/feeds.json /tmp/fd/feeds/ 2>/dev/null || true
   podman run --rm -p 3000:3000 \
     -e FEEDS_DATA_DIR=/data/feeds -e FEEDS_CACHE_DIR=/data/cache -e FEEDS_MODELS_DIR=/data/models \
     -v /tmp/fd:/data feeds
   ```

   Open <http://localhost:3000> → timeline renders; images proxy via `/cache/...`; hitting
   tag-suggest downloads MiniLM once into `/tmp/fd/models`; adding a feed writes
   `/tmp/fd/feeds/feeds.json`.
2. **Refactor sanity:** `pnpm --filter @feeds/app build` succeeds; `preview` with no env
   vars still uses `static/` + `cache/` (defaults unchanged).
3. **Rootless persistence:** stack `down`/`up` (and a reboot, thanks to linger) keeps
   feeds, posts, cached images, and the model.
4. **End-to-end on server:** browse the public nginx URL; confirm cookie login + a POST
   succeed (validates `ORIGIN`/forwarded headers).
5. **Disk check:** after two deploys, `podman images` shows only tagged images (no
   `<none>` pile) and total container storage stays ≈ one or two image sizes.
