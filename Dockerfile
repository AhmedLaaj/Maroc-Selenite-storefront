FROM node:24-bookworm AS build

WORKDIR /app

# Lockfile v9 and pnpm-workspace minimumReleaseAge need pnpm 10.
RUN npm install -g pnpm@10.34.9

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY artifacts/maroc-selenite-storefront/package.json artifacts/maroc-selenite-storefront/package.json
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/package.json
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY lib/api-spec/package.json lib/api-spec/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY lib/db/package.json lib/db/package.json
COPY scripts/package.json scripts/package.json

# Coolify may inject NODE_ENV=production. Vite, Tailwind, and esbuild are devDependencies.
RUN NODE_ENV=development pnpm install --frozen-lockfile --filter @workspace/maroc-selenite-storefront... --filter @workspace/api-server...

COPY artifacts/maroc-selenite-storefront artifacts/maroc-selenite-storefront
COPY artifacts/api-server artifacts/api-server
COPY lib lib
COPY tsconfig.base.json tsconfig.base.json

# vite.config.ts refuses to load unless both are set. BASE_PATH=/ matches a Coolify root domain.
ENV PORT=80
ENV BASE_PATH=/
ENV NODE_ENV=production

RUN pnpm --filter @workspace/maroc-selenite-storefront run build \
  && pnpm --filter @workspace/api-server run build

FROM node:24-bookworm

WORKDIR /app

RUN npm install -g pnpm@10.34.9

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY artifacts/maroc-selenite-storefront/package.json artifacts/maroc-selenite-storefront/package.json
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY artifacts/mockup-sandbox/package.json artifacts/mockup-sandbox/package.json
COPY lib/api-client-react/package.json lib/api-client-react/package.json
COPY lib/api-spec/package.json lib/api-spec/package.json
COPY lib/api-zod/package.json lib/api-zod/package.json
COPY lib/db/package.json lib/db/package.json
COPY scripts/package.json scripts/package.json

# sharp stays external to the esbuild bundle, so the runtime image needs it installed.
RUN NODE_ENV=development pnpm install --frozen-lockfile --filter @workspace/api-server...

COPY --from=build /app/artifacts/api-server/dist artifacts/api-server/dist
COPY --from=build /app/artifacts/maroc-selenite-storefront/dist/public /app/public-site
COPY artifacts/maroc-selenite-storefront/public/selenite-bowl.png artifacts/maroc-selenite-storefront/public/selenite-lifestyle-hero.png artifacts/maroc-selenite-storefront/public/atelier-hero.png /app/seed-assets/

# One process serves /api, /uploads, and the storefront. Keep Coolify's exposed port at 80.
# On Coolify, add Postgres, set DATABASE_URL and ADMIN_PASSWORD, set UPLOAD_DIR=/data/uploads,
# and attach a persistent volume at /data/uploads. Leave COOKIE_SECURE unset on the http preview.
# Set COOKIE_SECURE=true only when the public site is served over HTTPS.
ENV PORT=80
ENV NODE_ENV=production
ENV STATIC_DIR=/app/public-site
ENV UPLOAD_DIR=/data/uploads
ENV SEED_ASSETS=/app/seed-assets

EXPOSE 80

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
