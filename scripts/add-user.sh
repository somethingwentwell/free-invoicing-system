#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Load env files if present.
if [[ -f ".env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env.local"
  set +a
fi
if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

SUPABASE_URL="${SUPABASE_URL:-${NEXT_PUBLIC_SUPABASE_URL:-}}"
SUPABASE_ADMIN_KEY="${SUPABASE_SECRET_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-}}"

EMAIL="${1:-}"
PASSWORD="${2:-}"
AUTO_CONFIRM="${3:-true}"

if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
  echo "Usage: bash scripts/add-user.sh <email> <password> [auto_confirm]"
  echo "Example: bash scripts/add-user.sh user@example.com 'P@ssw0rd123' true"
  exit 1
fi

if [[ -z "$SUPABASE_URL" ]]; then
  echo "Error: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) is required."
  exit 1
fi

if [[ -z "$SUPABASE_ADMIN_KEY" ]]; then
  echo "Error: SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY is required."
  exit 1
fi

if [[ "$AUTO_CONFIRM" != "true" && "$AUTO_CONFIRM" != "false" ]]; then
  echo "Error: auto_confirm must be 'true' or 'false'."
  exit 1
fi

echo "Creating user: $EMAIL"

TMP_BODY="$(mktemp)"
TMP_CODE="$(mktemp)"

curl -sS -X POST "${SUPABASE_URL%/}/auth/v1/admin/users" \
  -H "apikey: ${SUPABASE_ADMIN_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"email_confirm\":${AUTO_CONFIRM}}" \
  -o "$TMP_BODY" \
  -w "%{http_code}" > "$TMP_CODE"

HTTP_CODE="$(cat "$TMP_CODE")"
BODY="$(cat "$TMP_BODY")"
rm -f "$TMP_BODY" "$TMP_CODE"

if [[ "$HTTP_CODE" -lt 200 || "$HTTP_CODE" -ge 300 ]]; then
  echo "Failed (HTTP $HTTP_CODE): $BODY"
  exit 1
fi

echo "User created successfully."
echo "$BODY"
