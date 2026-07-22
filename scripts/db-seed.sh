#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")/.."

CONTAINER="${POSTGRES_CONTAINER:-lifeos-postgres}"
DB_USER="${POSTGRES_USER:-lifeos}"
DB_NAME="${POSTGRES_DB:-lifeos}"

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "오류: PostgreSQL 컨테이너 '$CONTAINER'를 찾을 수 없음."
  exit 1
fi

if [ ! -f database/seed.sql ]; then
  echo "오류: database/seed.sql이 없음."
  exit 1
fi

echo "database/seed.sql 적용 중..."

docker exec -i "$CONTAINER" \
  psql \
  -v ON_ERROR_STOP=1 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  < database/seed.sql

echo "DB seed 적용 완료"
