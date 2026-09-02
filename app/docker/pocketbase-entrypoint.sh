#!/bin/sh
set -eu

umask 027

fail() {
  echo "PocketBase nelze bezpečně spustit: $1" >&2
  exit 1
}

require_value() {
  value="$(printenv "$1" 2>/dev/null || true)"
  [ -n "$value" ] || fail "chybí $1"
}

validate_https_origin() {
  origin="$1"
  case "$origin" in
    https://*) ;;
    *) fail "origin musí používat HTTPS" ;;
  esac
  remainder="${origin#https://}"
  case "$remainder" in
    ''|*'/'*|*'?'*|*'#'*|*'@'*|*'*'*|*' '*|*','*) fail "origin musí být přesný HTTPS origin bez cesty" ;;
  esac
}

validate_https_url() {
  target_url="$1"
  case "$target_url" in
    https://*) ;;
    *) fail "monitorovací URL musí používat HTTPS" ;;
  esac
  case "${target_url#https://}" in
    ''|*' '*|*'@'*) fail "monitorovací URL není platná" ;;
  esac
}

require_value APP_ENV
require_value MONIKE_ENV
[ "$APP_ENV" = "$MONIKE_ENV" ] || fail "APP_ENV a MONIKE_ENV si odporují"
case "$APP_ENV" in
  demo|production) ;;
  *) fail "APP_ENV musí být demo nebo production" ;;
esac

require_value MONIKE_PUBLIC_POCKETBASE_URL
validate_https_origin "$MONIKE_PUBLIC_POCKETBASE_URL"

require_value MONIKE_ALLOWED_ORIGINS
case "$MONIKE_ALLOWED_ORIGINS" in
  ','*|*','|*',,'*|*'*'*|*null*|*' '*) fail "CORS allowlist obsahuje zakázanou hodnotu" ;;
esac
old_ifs="$IFS"
IFS=','
for allowed_origin in $MONIKE_ALLOWED_ORIGINS; do
  validate_https_origin "$allowed_origin"
done
IFS="$old_ifs"

require_value MONIKE_SUPERUSER_IPS
old_ifs="$IFS"
IFS=','
for superuser_cidr in $MONIKE_SUPERUSER_IPS; do
  case "$superuser_cidr" in
    ''|'0.0.0.0/0'|'::/0'|*' '*) fail "superuser IP allowlist je prázdný nebo příliš široký" ;;
  esac
done
IFS="$old_ifs"

require_value PB_ENCRYPTION_KEY
[ "${#PB_ENCRYPTION_KEY}" -eq 32 ] || fail "PB_ENCRYPTION_KEY musí mít přesně 32 znaků"

for required_name in \
  MONIKE_R2_ENDPOINT \
  MONIKE_R2_BUCKET \
  MONIKE_R2_REGION \
  MONIKE_R2_ACCESS_KEY_ID \
  MONIKE_R2_SECRET_ACCESS_KEY
do
  require_value "$required_name"
done
validate_https_origin "$MONIKE_R2_ENDPOINT"

for optional_heartbeat in \
  "${MONIKE_BACKUP_HEARTBEAT_URL:-}" \
  "${MONIKE_CLEANUP_HEARTBEAT_URL:-}" \
  "${MONIKE_STORAGE_HEARTBEAT_URL:-}"
do
  [ -z "$optional_heartbeat" ] || validate_https_url "$optional_heartbeat"
done

api_hsts_max_age="${MONIKE_API_HSTS_MAX_AGE:-300}"
case "$api_hsts_max_age" in
  300|31536000) ;;
  *) fail "MONIKE_API_HSTS_MAX_AGE musí být 300 nebo 31536000" ;;
esac
case "${MONIKE_API_HSTS_INCLUDE_SUBDOMAINS:-false}" in
  false|'') ;;
  true) [ "$api_hsts_max_age" = '31536000' ] || fail "API includeSubDomains vyžaduje roční HSTS" ;;
  *) fail "MONIKE_API_HSTS_INCLUDE_SUBDOMAINS musí být true nebo false" ;;
esac

[ -d /pb/pb_data ] || fail "/pb/pb_data není připojený adresář"
if [ "$(id -u)" -eq 0 ]; then
  chown 10001:10001 /pb/pb_data
  chmod 0750 /pb/pb_data
else
  [ "$(id -u)" -eq 10001 ] || fail "proces musí startovat jako root nebo uid 10001"
fi

su-exec 10001:10001 sh -c '
  probe=/pb/pb_data/.monike-entrypoint-write-probe
  (umask 077 && : > "$probe") || exit 1
  rm -f "$probe"
' || fail "/pb/pb_data není zapisovatelný pro uid 10001"

exec su-exec 10001:10001 /pb/pocketbase serve \
  --http=0.0.0.0:8080 \
  --dir=/pb/pb_data \
  --hooksDir=/pb/pb_hooks \
  --migrationsDir=/pb/pb_migrations \
  --automigrate=0 \
  --encryptionEnv=PB_ENCRYPTION_KEY \
  --origins="$MONIKE_ALLOWED_ORIGINS"
