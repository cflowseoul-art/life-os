#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "오류: 프로젝트 루트에 .env 파일이 없음."
  echo "필요한 값:"
  echo "DATABASE_URL=postgres://lifeos:lifeos@localhost:5433/lifeos"
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "오류: .env에 DATABASE_URL이 없음."
  exit 1
fi

exec npx tsx src/main.ts
