# syntax=docker/dockerfile:1
# Debian (glibc), not Alpine: sharp + onnxruntime ship glibc prebuilts.
FROM node:20-trixie-slim AS base
ENV PNPM_HOME=/pnpm PATH="/pnpm:$PATH"
RUN corepack enable
WORKDIR /repo

FROM base AS build
# Install deps first (cached unless a manifest changes).
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/core/package.json packages/core/
COPY packages/app/package.json  packages/app/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store
COPY . .
RUN pnpm --filter @feeds/core build && pnpm --filter @feeds/app build

FROM build AS deploy
# Materialize @feeds/app + prod deps (workspace deps become real node_modules).
# Same --store-dir + cache mount so deploy REUSES the warm store instead of
# re-downloading onnxruntime's 327M blob (which we strip below anyway).
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter @feeds/app deploy --prod --store-dir /pnpm/store /app
# Strip onnxruntime to linux-x64 CPU only (drops ~500M: 327M CUDA + tensorrt +
# darwin/win32/arm64). pnpm keeps it in the .pnpm store (transitive dep, no
# top-level symlink); the glob is version-agnostic. Verify if you bump it.
RUN set -eux; \
    d="$(echo /app/node_modules/.pnpm/onnxruntime-node@*/node_modules/onnxruntime-node/bin/napi-v3)"; \
    test -d "$d"; \
    rm -rf "$d/darwin" "$d/win32" "$d/linux/arm64"; \
    rm -f  "$d/linux/x64/libonnxruntime_providers_cuda.so" \
           "$d/linux/x64/libonnxruntime_providers_tensorrt.so"
# Drop sharp's musl binaries — this is a glibc (Debian) image, they never load.
RUN rm -rf /app/node_modules/.pnpm/@img+sharp-libvips-linuxmusl-x64@* \
           /app/node_modules/.pnpm/@img+sharp-linuxmusl-x64@*

FROM base AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=deploy --chown=node:node /app ./
USER node
EXPOSE 3000
# adapter-node entrypoint; honors PORT, ORIGIN, PROTOCOL_HEADER, HOST_HEADER.
CMD ["node", "build/index.js"]
