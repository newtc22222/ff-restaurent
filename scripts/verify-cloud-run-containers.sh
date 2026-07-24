#!/usr/bin/env bash
set -euxo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUFFIX="ff57-$RANDOM-$$"
NETWORK="${SUFFIX}-network"
DATABASE_CONTAINER="${SUFFIX}-postgres"
API_IMAGE="${SUFFIX}-api"
WEB_IMAGE="${SUFFIX}-web"
FAILURE_LOG="$(mktemp)"
API_ONE=""
API_TWO=""

cleanup() {
  if [[ -n "$API_ONE" ]]; then
    docker rm -f "$API_ONE" >/dev/null 2>&1 || true
  fi
  if [[ -n "$API_TWO" ]]; then
    docker rm -f "$API_TWO" >/dev/null 2>&1 || true
  fi
  docker rm -f "$DATABASE_CONTAINER" >/dev/null 2>&1 || true
  docker network rm "$NETWORK" >/dev/null 2>&1 || true
  rm -f "$FAILURE_LOG"
}
trap cleanup EXIT

wait_for_url() {
  local url="$1"
  for _ in $(seq 1 30); do
    if curl --fail --silent "$url" >/dev/null 2>&1; then
      return
    fi
    sleep 1
  done
  printf 'Timed out waiting for %s\n' "$url" >&2
  return 1
}

docker network create "$NETWORK" >/dev/null
docker run --detach \
  --name "$DATABASE_CONTAINER" \
  --network "$NETWORK" \
  --env POSTGRES_DB=ff_restaurent \
  --env POSTGRES_USER=ff \
  --env POSTGRES_PASSWORD=ff \
  postgres:16-alpine >/dev/null

for _ in $(seq 1 30); do
  if docker exec "$DATABASE_CONTAINER" pg_isready -U ff -d ff_restaurent >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$DATABASE_CONTAINER" pg_isready -U ff -d ff_restaurent >/dev/null

docker build \
  --file "$ROOT/apps/api/Dockerfile" \
  --target cloud-run \
  --tag "$API_IMAGE" \
  "$ROOT"
docker build \
  --file "$ROOT/apps/web/Dockerfile" \
  --build-arg VITE_API_URL=https://api.ff57.invalid \
  --tag "$WEB_IMAGE" \
  "$ROOT"

database_url='postgresql://ff:ff@'"$DATABASE_CONTAINER"':5432/ff_restaurent?schema=public'
release_args=(
  --rm
  --network "$NETWORK"
  --env "DATABASE_URL=$database_url"
  --env ROOT_ADMIN_USERNAME=ff57-root
  "$API_IMAGE"
  npm run release:run
)

if docker run "${release_args[@]}" >"$FAILURE_LOG" 2>&1; then
  printf 'Release job unexpectedly accepted a missing ROOT_ADMIN candidate\n' >&2
  exit 1
fi
grep -Fq 'does not identify an existing user' "$FAILURE_LOG"

docker exec -i "$DATABASE_CONTAINER" psql -v ON_ERROR_STOP=1 -U ff -d ff_restaurent <<'SQL'
INSERT INTO "User" ("id", "username", "name", "passwordHash", "updatedAt")
VALUES ('ff57-verify-root', 'ff57-root', 'FF-57 Verify Root', 'not-used-for-login', CURRENT_TIMESTAMP)
ON CONFLICT ("username") DO NOTHING;
SQL

docker run "${release_args[@]}"
docker run "${release_args[@]}"

common_api_args=(
  --detach
  --network "$NETWORK"
  --publish 127.0.0.1::8080
  --env "DATABASE_URL=$database_url"
  --env PORT=8080
  --env NODE_ENV=production
  --env JWT_SECRET=ff57-test-secret-that-is-longer-than-thirty-two-characters
  --env REGISTRATION_INVITE_CODE=ff57-invite-code
  --env CORS_ORIGINS=https://web.ff57.invalid
  "$API_IMAGE"
)
API_ONE="$(docker run "${common_api_args[@]}")"
API_TWO="$(docker run "${common_api_args[@]}")"

port_one="$(docker port "$API_ONE" 8080/tcp | sed 's/.*://')"
port_two="$(docker port "$API_TWO" 8080/tcp | sed 's/.*://')"
wait_for_url "http://127.0.0.1:${port_one}/health"
wait_for_url "http://127.0.0.1:${port_two}/health"
curl --fail --silent "http://127.0.0.1:${port_one}/ready" >/dev/null
curl --fail --silent "http://127.0.0.1:${port_two}/ready" >/dev/null

for container in "$API_ONE" "$API_TWO"; do
  test "$(docker exec "$container" cat /proc/1/comm)" = node
  if docker logs "$container" 2>&1 | grep -Fq '[ff-57 release]'; then
    printf 'Service container ran release work during startup\n' >&2
    exit 1
  fi
done

docker stop --time 10 "$API_ONE" "$API_TWO" >/dev/null
test "$(docker inspect --format '{{.State.ExitCode}}' "$API_ONE")" = 0
test "$(docker inspect --format '{{.State.ExitCode}}' "$API_TWO")" = 0

docker run --rm --entrypoint sh "$WEB_IMAGE" -c \
  "grep -R -F 'https://api.ff57.invalid' /usr/share/nginx/html >/dev/null"
if docker run --rm --entrypoint sh "$WEB_IMAGE" -c \
  "grep -R -E 'JWT_SECRET|DATABASE_URL|REGISTRATION_INVITE_CODE|SUPABASE_SERVICE_ROLE_KEY' /usr/share/nginx/html >/dev/null"; then
  printf 'Web image contains a server-side secret name\n' >&2
  exit 1
fi

printf 'API image ID: %s\n' "$(docker image inspect "$API_IMAGE" --format '{{.Id}}')"
printf 'Web image ID: %s\n' "$(docker image inspect "$WEB_IMAGE" --format '{{.Id}}')"
printf 'FF-57 container verification passed\n'
