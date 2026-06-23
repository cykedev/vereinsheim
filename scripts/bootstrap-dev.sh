#!/usr/bin/env bash
# bootstrap-dev.sh — One-shot Setup für eine frische Entwickler-Workstation.
#
# Ziel: clone → ein Befehl → arbeitsfähig, inkl. der Claude-Harness.
# Idempotent: beliebig oft ausführbar, ohne vorhandene .env/Daten zu überschreiben.
#
# WAS DIESES SKRIPT MACHT
#   1) Vorbedingungen prüfen (node >=24, docker erreichbar)
#   2) corepack enable (pnpm gemäß packageManager-Pin)
#   3) pnpm install (Workspace-Deps)
#   4) codegraph-Binary GEPINNT installieren (@colbymchenry/codegraph) + Index bauen
#   5) Dev-Postgres hochziehen (docker-compose.dev.yml) + auf Bereitschaft warten
#   6) .env je App aus .env.example (nur wenn fehlend)
#   7) Prisma-Schema je App in die Dev-DB pushen
#
# WAS ES *NICHT* MACHT
#   - node / docker installieren → über Workstations zu heterogen (macOS/Linux,
#     nvm/brew/system). Stattdessen: prüfen + anleiten. Für node hilft die .nvmrc.
#   - VPS-Verbindung konfigurieren → das macht `./scripts/vereinsheim local-setup`.
#
# AUFRUF
#   bash scripts/bootstrap-dev.sh
#   ./scripts/vereinsheim dev-setup      # dünner Wrapper auf dieses Skript
set -euo pipefail

# ---------- Pfade ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$SCRIPT_DIR")"
cd "$REPO_DIR"

CODEGRAPH_PKG="@colbymchenry/codegraph"
CODEGRAPH_VERSION="1.0.1"
DEV_COMPOSE_FILE="$REPO_DIR/docker-compose.dev.yml"
APPS=(ringwerk treffsicher)

# ---------- Ausgabe ----------
if [[ -t 1 ]]; then
	BOLD=$'\033[1m' RESET=$'\033[0m' GREEN=$'\033[32m' YELLOW=$'\033[33m' RED=$'\033[31m' DIM=$'\033[2m'
else
	BOLD="" RESET="" GREEN="" YELLOW="" RED="" DIM=""
fi
step() { echo "${BOLD}==>${RESET} $*"; }
ok() { echo "${GREEN}✓${RESET} $*"; }
warn() { echo "${YELLOW}!!${RESET} $*" >&2; }
die() {
	echo "${RED}✗${RESET} $*" >&2
	exit 1
}

# ---------- 1) Vorbedingungen (prüfen, nicht installieren) ----------
step "Vorbedingungen prüfen (node, docker)"

if ! command -v node >/dev/null 2>&1; then
	die "node nicht gefunden — Node >=24 nötig. Via nvm: 'nvm install && nvm use' (nutzt die .nvmrc)."
fi
node_major="$(node -v | sed -E 's/^v([0-9]+).*/\1/')"
if [[ -z "$node_major" || "$node_major" -lt 24 ]]; then
	die "node $(node -v) ist zu alt — Node >=24 nötig. Via nvm: 'nvm install && nvm use' (nutzt die .nvmrc)."
fi
ok "node $(node -v)"

if ! command -v docker >/dev/null 2>&1; then
	die "docker nicht gefunden — Docker Desktop (macOS) bzw. Docker Engine (Linux) zuerst installieren."
fi
if ! docker info >/dev/null 2>&1; then
	die "Docker-Daemon nicht erreichbar — Docker starten und erneut versuchen."
fi
ok "docker erreichbar"

# ---------- 2) corepack (pnpm gemäß packageManager-Pin) ----------
step "corepack enable"
corepack enable
ok "corepack aktiv  ${DIM}(pnpm $(pnpm --version 2>/dev/null || echo '?'))${RESET}"

# ---------- 3) Workspace-Deps ----------
step "pnpm install (Workspace-Deps)"
pnpm install
ok "Deps installiert"

# ---------- 4) codegraph (gepinnte Pflicht-Abhängigkeit) ----------
# codegraph ist die Live-Knowledge-Schicht der Claude-Harness (.mcp.json + Hooks).
# Ohne Binary degradiert sie LAUTLOS (codegraph-ensure.mjs ist fail-open) — daher
# hier fest installieren statt nur dokumentieren.
step "codegraph-Binary (${CODEGRAPH_PKG}@${CODEGRAPH_VERSION})"
current_cg=""
if command -v codegraph >/dev/null 2>&1; then
	current_cg="$(codegraph --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)"
fi
if [[ "$current_cg" == "$CODEGRAPH_VERSION" ]]; then
	ok "codegraph $current_cg bereits installiert"
else
	[[ -n "$current_cg" ]] && warn "codegraph $current_cg gefunden — pinne auf $CODEGRAPH_VERSION"
	npm install -g "${CODEGRAPH_PKG}@${CODEGRAPH_VERSION}"
	ok "codegraph $CODEGRAPH_VERSION installiert"
fi
# Index anstoßen, falls noch keiner da ist — im Hintergrund (wie der SessionStart-Hook
# codegraph-ensure.mjs, der detached indiziert). Endlicher Batch-Job, kein Server.
if [[ -d "$REPO_DIR/.codegraph" ]]; then
	ok "codegraph-Index vorhanden (.codegraph/)"
else
	step "codegraph-Index bauen (im Hintergrund)"
	nohup codegraph init >/dev/null 2>&1 &
	ok "Index-Build gestartet  ${DIM}(läuft im Hintergrund weiter)${RESET}"
fi

# ---------- 5) Dev-Postgres ----------
step "Dev-Postgres starten (docker-compose.dev.yml)"
docker compose -f "$DEV_COMPOSE_FILE" up -d
printf '    warte auf DB-Bereitschaft '
ready=0
for _ in $(seq 1 30); do
	if docker compose -f "$DEV_COMPOSE_FILE" exec -T db pg_isready -U postgres >/dev/null 2>&1; then
		ready=1
		break
	fi
	printf '.'
	sleep 1
done
echo
[[ "$ready" -eq 1 ]] || die "Dev-Postgres wurde nicht rechtzeitig bereit. Prüfe: docker compose -f docker-compose.dev.yml logs db"
ok "Dev-Postgres bereit (localhost:5432)"

# ---------- 6) .env je App (nur wenn fehlend — nie überschreiben) ----------
step ".env je App (aus .env.example, nur wenn fehlend)"
for app in "${APPS[@]}"; do
	if [[ -f "apps/$app/.env" ]]; then
		ok "apps/$app/.env vorhanden — unverändert"
	else
		cp "apps/$app/.env.example" "apps/$app/.env"
		ok "apps/$app/.env aus .env.example angelegt"
	fi
done

# ---------- 7) Prisma-Schema je App in die Dev-DB ----------
step "Prisma-Schema in die Dev-DB pushen"
for app in "${APPS[@]}"; do
	echo "    ${DIM}$app …${RESET}"
	pnpm --filter "$app" exec prisma db push
done
ok "Schema synchronisiert"

# ---------- Fertig ----------
echo
echo "${BOLD}${GREEN}Fertig.${RESET} Die Workstation ist arbeitsfähig."
echo
echo "  Nächste Schritte:"
echo "    pnpm dev      ${DIM}# beide Apps: ringwerk :3000, treffsicher :3001${RESET}"
echo "    pnpm check    ${DIM}# alle 5 Quality-Gates${RESET}"
echo
echo "  ${DIM}Für VPS-Deploy separat: ./scripts/vereinsheim local-setup${RESET}"
