#!/usr/bin/env bash
# Lokaler Ende-zu-Ende-Test des ganzen Stacks: die echten Images aus dem Monorepo, compose.yml mit
# tools/stack-e2e/compose.e2e.yml, eine Wegwerf-Umgebung mit Zufallswerten. Eigenes Compose-Projekt (vereinsheim-e2e)
# und eigene Images (vereinsheim-e2e/*): .env, .env.local, Volumes und Images des Users bleiben unberührt. Caddy hört
# auf Ports statt Hosts (18080 Ringwerk, 18081 Treffsicher, 18082 Spiegel), Postgres auf 15432.
#
#   tools/stack-e2e/run.sh                  bauen, starten, prüfen, alles wieder entfernen
#   tools/stack-e2e/run.sh --keep           Stack und Umgebung stehen lassen (Pfad und Befehle am Ende)
#   tools/stack-e2e/run.sh --no-build       vorhandene vereinsheim-e2e/*-Images nehmen
#   tools/stack-e2e/run.sh --bridge         dazu die echte Brücke gegen Spiegel (bridge-e2e, gut 1 Minute)
#   tools/stack-e2e/run.sh --load <min>     dazu Last auf Spiegel (ingest-load) und Speicher unter Last
#   tools/stack-e2e/run.sh --ops            dazu der Betrieb (tools/stack-e2e/ops.sh): Deploy nacheinander,
#                                           Vorprüfung, Backup, Restore-Probe, Restore, Rollback (gut 5 Minuten)
#   tools/stack-e2e/run.sh --down           einen mit --keep stehen gelassenen Stack entfernen
#   tools/stack-e2e/run.sh --clean          wie --down, dazu die vereinsheim-e2e/*-Images löschen
#
# Braucht Docker, pnpm (nach `pnpm install`), openssl; für --bridge zusätzlich Go.
set -euo pipefail
cd "$(dirname "$0")/../.."

PROJECT=vereinsheim-e2e
export COMPOSE_PROJECT_NAME="$PROJECT"
export COMPOSE_FILE="compose.yml:tools/stack-e2e/compose.e2e.yml"

KEEP=0 BUILD=1 BRIDGE=0 LOAD=0 DOWN=0 CLEAN=0 OPS=0
while [[ $# -gt 0 ]]; do
	case "$1" in
	--keep) KEEP=1 ;;
	--no-build) BUILD=0 ;;
	--bridge) BRIDGE=1 ;;
	--ops) OPS=1 ;;
	--load)
		LOAD="${2:?--load braucht die Minuten}"
		shift
		;;
	--down) DOWN=1 ;;
	--clean)
		DOWN=1
		CLEAN=1
		;;
	*)
		echo "Unbekannte Option: $1" >&2
		exit 2
		;;
	esac
	shift
done

if [[ "$DOWN" == "1" ]]; then
	docker compose down -v --remove-orphans 2>&1 | grep -v 'variable is not set' || true
	echo "Stack $PROJECT entfernt."
	if [[ "$CLEAN" == "1" ]]; then
		images="$(docker images --filter reference='vereinsheim-e2e/*' -q | sort -u)"
		[[ -z "$images" ]] || docker rmi -f $images >/dev/null
		echo "Images vereinsheim-e2e/* entfernt."
	fi
	exit 0
fi

for tool in docker pnpm openssl curl; do
	command -v "$tool" >/dev/null || {
		echo "$tool fehlt." >&2
		exit 1
	}
done

DIR="$(mktemp -d)"
ENV_FILE="$DIR/stack.env"
compose() { docker compose --env-file "$ENV_FILE" "$@"; }
cleanup() {
	if [[ "$KEEP" == "1" ]]; then
		echo
		echo "Stack bleibt stehen (--keep). Umgebung: $ENV_FILE"
		echo "  Spiegel: http://localhost:18082 (Admin admin@example.com, Passwort in der Umgebung)"
		echo "  Datenbank Spiegel für die Werkzeuge: DATABASE_URL aus SPIEGEL_DB_PASSWORD, Port 15432"
		echo "  Entfernen: tools/stack-e2e/run.sh --down && rm -rf $DIR"
	else
		[[ -f "$ENV_FILE" ]] && compose down -v --remove-orphans >/dev/null 2>&1 || true
		rm -rf "$DIR"
	fi
}
trap cleanup EXIT

secret() {
	local value
	value="$(openssl rand -base64 64 | tr -d '\n=+/' | cut -c1-"$1")"
	[[ ${#value} -eq "$1" ]] || {
		echo "Zufallswert zu kurz." >&2
		exit 1
	}
	echo "$value"
}
cat >"$ENV_FILE" <<EOF
DOMAIN=localhost
RINGWERK_HOST=:8080
TREFFSICHER_HOST=:8081
SPIEGEL_HOST=:8082
ACME_EMAIL=e2e@example.com
DOCKER_USER=vereinsheim-e2e
RINGWERK_TAG=latest
RINGWERK_MIGRATOR_TAG=latest-migrator
TREFFSICHER_TAG=latest
TREFFSICHER_MIGRATOR_TAG=latest-migrator
SPIEGEL_TAG=latest
SPIEGEL_MIGRATOR_TAG=latest-migrator
POSTGRES_PASSWORD=$(secret 32)
RINGWERK_DB_PASSWORD=$(secret 32)
TREFFSICHER_DB_PASSWORD=$(secret 32)
SPIEGEL_DB_PASSWORD=$(secret 32)
RINGWERK_NEXTAUTH_SECRET=$(secret 48)
RINGWERK_SEED_ADMIN_EMAIL=admin@example.com
RINGWERK_SEED_ADMIN_PASSWORD=$(secret 24)
TREFFSICHER_NEXTAUTH_SECRET=$(secret 48)
TREFFSICHER_ADMIN_EMAIL=admin@example.com
TREFFSICHER_ADMIN_PASSWORD=$(secret 24)
SPIEGEL_NEXTAUTH_SECRET=$(secret 48)
SPIEGEL_SEED_ADMIN_EMAIL=admin@example.com
SPIEGEL_SEED_ADMIN_PASSWORD=$(secret 24)
DISPLAY_TIME_ZONE=Europe/Berlin
EOF
chmod 600 "$ENV_FILE"
# ein Fehler in $(secret …) bricht im Heredoc nicht ab: jede Zeile braucht einen Wert
if grep -q '=$' "$ENV_FILE"; then
	echo "Leerer Wert in der Wegwerf-Umgebung." >&2
	exit 1
fi

spiegel_url() {
	echo "postgresql://spiegel:$(grep -m1 '^SPIEGEL_DB_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)@localhost:15432/spiegel"
}

PROBLEMS=()
problem() {
	PROBLEMS+=("$1")
	echo "  FEHLER: $1"
}

if [[ "$BUILD" == "1" ]]; then
	echo "==> Images bauen (vereinsheim-e2e/*, lokal)"
	PUSH=0 DOCKER_USER=vereinsheim-e2e ./scripts/build-and-push.sh >"$DIR/build.log" 2>&1 ||
		{
			tail -20 "$DIR/build.log"
			exit 1
		}
fi

echo "==> Stack starten (Projekt $PROJECT)"
compose config --quiet
compose up -d >"$DIR/up.log" 2>&1 || {
	cat "$DIR/up.log"
	problem "docker compose up ist gescheitert"
	exit 1
}

# eine Adresse über Caddy: Antwort unter 500, nicht 000 (keine Verbindung)
wait_http() {
	local url="$1" code="000"
	for _ in $(seq 90); do
		code="$(curl -s --max-time 5 -o /dev/null -w '%{http_code}' "$url" || true)"
		[[ "$code" != "000" && "$code" -lt 500 ]] && break
		sleep 1
	done
	echo "$code"
}

echo "==> Apps über Caddy"
for target in "Ringwerk http://localhost:18080/" "Treffsicher http://localhost:18081/" "Spiegel http://localhost:18082/login"; do
	name="${target%% *}"
	url="${target#* }"
	code="$(wait_http "$url")"
	echo "  $name $url -> $code"
	[[ "$code" != "000" && "$code" -lt 500 ]] || problem "$name antwortet nicht ($code)"
done

echo "==> Migratoren"
migrators=0
while read -r service code; do
	migrators=$((migrators + 1))
	echo "  $service: Exit $code"
	[[ "$code" == "0" ]] || problem "$service endete mit $code"
done < <(compose ps -a --format '{{.Service}} {{.ExitCode}}' | grep '^migrate-' || true)
[[ "$migrators" -eq 3 ]] || problem "erwartet 3 Migratoren, gefunden $migrators"

echo "==> Datenbanken (Owner, Rechte)"
compose exec -T db psql -U postgres -d postgres -Atc \
	"SELECT datname || ' Owner ' || pg_get_userbyid(datdba) || ' ' || coalesce(datacl::text, '-') FROM pg_database WHERE datname IN ('ringwerk', 'treffsicher', 'spiegel') ORDER BY 1" |
	sed 's/^/  /'
for app in ringwerk treffsicher spiegel; do
	acl="$(compose exec -T db psql -U postgres -d postgres -Atc "SELECT datacl::text FROM pg_database WHERE datname = '$app' AND pg_get_userbyid(datdba) = '$app'")"
	[[ "$acl" == "{$app=CTc/$app}" ]] || problem "Datenbank $app: Owner oder Rechte falsch ($acl)"
done

echo "==> Grenzen hinter Caddy (stack-probe)"
BASE_URL=http://localhost:18082 DATABASE_URL="$(spiegel_url)" pnpm --silent --filter spiegel stack-probe ||
	problem "stack-probe meldet Fehler"

if [[ "$BRIDGE" == "1" ]]; then
	echo "==> Brücke gegen Spiegel (bridge-e2e)"
	BASE_URL=http://localhost:18082 DATABASE_URL="$(spiegel_url)" pnpm --silent --filter spiegel bridge-e2e ||
		problem "bridge-e2e meldet Fehler"
fi

if [[ "$LOAD" != "0" ]]; then
	echo "==> Last auf Spiegel ($LOAD Minuten, ingest-load)"
	BASE_URL=http://localhost:18082 DATABASE_URL="$(spiegel_url)" pnpm --silent --filter spiegel ingest-load \
		--minutes "$LOAD" --docker "$PROJECT-app-spiegel-1" || problem "ingest-load meldet Fehler"
fi

if [[ "$OPS" == "1" ]]; then
	echo "==> Betrieb (ops.sh)"
	ENV_FILE="$ENV_FILE" tools/stack-e2e/ops.sh || problem "ops.sh meldet Fehler"
fi

echo "==> Speicher (seit dem Start)"
for c in $(compose ps -q); do
	docker exec "$c" sh -c 'echo $(cat /sys/fs/cgroup/memory.current) $(cat /sys/fs/cgroup/memory.peak 2>/dev/null || echo 0) $(awk "/^anon /{print \$2}" /sys/fs/cgroup/memory.stat) $(awk "/^file /{print \$2}" /sys/fs/cgroup/memory.stat) $(cat /sys/fs/cgroup/memory.max)' |
		awk -v n="$(docker inspect -f '{{.Name}}' "$c" | cut -c2-)" '{m=1048576; printf "  %-34s jetzt %4d MiB (Programm %4d, Cache %4d)  Spitze %4d MiB  Grenze %s\n", n, $1/m, $3/m, $4/m, $2/m, ($5=="max"?"keine":int($5/m))}'
done
containers="$(compose ps -aq)"
if [[ -z "$containers" ]]; then
	problem "keine Container gefunden"
else
	while read -r name oom; do
		[[ "$oom" == "false" ]] || problem "$name wurde wegen Speicher beendet"
	done < <(docker inspect -f '{{.Name}} {{.State.OOMKilled}}' $containers)
fi

echo
if [[ ${#PROBLEMS[@]} -eq 0 ]]; then
	echo "Alles in Ordnung."
else
	echo "${#PROBLEMS[@]} Fehler:"
	printf '  - %s\n' "${PROBLEMS[@]}"
	exit 1
fi
