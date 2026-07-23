FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
ENV DATABASE_URL=postgresql://ff:ff@localhost:5432/ff_restaurent?schema=public
RUN npm run build -w @ff-restaurent/shared
RUN npm run build -w @ff-restaurent/api

FROM node:22-alpine@sha256:16e22a550f3863206a3f701448c45f7912c6896a62de43add43bb9c86130c3e2 AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/package.json
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api /app/apps/api
COPY --from=build /app/packages/shared /app/packages/shared
WORKDIR /app/apps/api

FROM runtime AS cloud-run
EXPOSE 8080
CMD ["node", "dist/server.js"]

# Keep this as the final/default target until Render retirement. Its startup
# contract is part of the shipped Phase 2 recovery boundary.
FROM runtime AS render
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run prisma:cuisines:seed && npm run prisma:phones:backfill && npm run prisma:root:bootstrap && exec node dist/server.js"]
