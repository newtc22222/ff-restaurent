#!/usr/bin/env bash
set -e
SUFFIX="ff57-debug-2"
NETWORK="${SUFFIX}-network"
DATABASE_CONTAINER="${SUFFIX}-postgres"
docker network create "$NETWORK" || true
docker run --detach --name "$DATABASE_CONTAINER" --network "$NETWORK" --env POSTGRES_DB=ff_restaurent --env POSTGRES_USER=ff --env POSTGRES_PASSWORD=ff postgres:16-alpine || true
sleep 5
database_url="postgresql://ff:ff@${DATABASE_CONTAINER}:5432/ff_restaurent?schema=public"
docker build --file apps/api/Dockerfile --target cloud-run --tag "${SUFFIX}-api" .
docker run --rm --network "$NETWORK" --env "DATABASE_URL=$database_url" --env ROOT_ADMIN_USERNAME=ff57-root "${SUFFIX}-api" npm run release:run
docker rm -f "$DATABASE_CONTAINER"
docker network rm "$NETWORK"
