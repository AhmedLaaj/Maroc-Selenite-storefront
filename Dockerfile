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

# Coolify may inject NODE_ENV=production. Vite and Tailwind are devDependencies.
RUN NODE_ENV=development pnpm install --frozen-lockfile --filter @workspace/maroc-selenite-storefront...

COPY artifacts/maroc-selenite-storefront artifacts/maroc-selenite-storefront
COPY lib/api-client-react lib/api-client-react
COPY tsconfig.base.json tsconfig.base.json

# vite.config.ts refuses to load unless both are set. BASE_PATH=/ matches a Coolify root domain.
ENV PORT=80
ENV BASE_PATH=/
ENV NODE_ENV=production

RUN pnpm --filter @workspace/maroc-selenite-storefront run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/artifacts/maroc-selenite-storefront/dist/public /usr/share/nginx/html

EXPOSE 80
