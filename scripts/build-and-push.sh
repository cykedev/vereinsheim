#!/usr/bin/env bash
# Build + Push der Apps (Ringwerk, Treffsicher, Spiegel) AUS DEM MONOREPO via
# `turbo prune --docker` (ADR-015). Das Tag-Schema gehört zum Deploy-Vertrag
# (compose.yml/.env).
#
# Pro App zwei Images:
#   <DOCKER_USER>/<app>:<sha>           und :latest             (target=runner)
#   <DOCKER_USER>/<app>:<sha>-migrator  und :latest-migrator    (target=migrator)
# Der <sha> ist der Monorepo-HEAD (alle Apps teilen ihn).
#
# Modi:
#   (default) PUSH=1 : --platform linux/amd64 --push; verlangt committeten Stand
#                      + Konsistenz-Gate.
#   PUSH=0           : --load (native Plattform); erlaubt uncommittete Änderungen,
#                      kein Push, kein Gate (lokale Testbuilds).
#
# Voraussetzungen: docker buildx, `pnpm install` im Repo-Root (turbo verfügbar),
# DOCKER_USER gesetzt (siehe .env oder export).
#
# APPS wählt die Apps (Vorgabe alle drei), etwa `APPS="ringwerk treffsicher"` für einen
# Hotfix, solange Spiegel nicht mitgehen soll: Ein Build bricht sonst beim ersten
# Fehler ab, nachdem frühere Apps schon gepusht sind.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${DOCKER_USER:?Set DOCKER_USER (Docker Hub user, e.g. cyke)}"
PLATFORM="${PLATFORM:-linux/amd64}"
PUSH="${PUSH:-1}"
# die Auswahl aus der Umgebung sichern, bevor scripts/lib/apps.sh die Liste aller Apps setzt
SELECTED="${APPS:-}"
# shellcheck source=lib/apps.sh
. scripts/lib/apps.sh
SELECTED="${SELECTED:-${APPS[*]}}"
for app in $SELECTED; do
	if ! in_list "$app" "${APPS[@]}"; then
		echo "Unbekannte App in APPS: $app (${APPS[*]})" >&2
		exit 1
	fi
done

command -v pnpm >/dev/null || { echo "pnpm fehlt — der Monorepo-Build braucht pnpm." >&2; exit 1; }
pnpm exec turbo --version >/dev/null 2>&1 || { echo "turbo fehlt — erst 'pnpm install' im Repo-Root." >&2; exit 1; }

if [[ "$PUSH" == "1" ]]; then
	if ! git diff --quiet || ! git diff --cached --quiet; then
		echo "Uncommitted changes — Release-Builds müssen reproduzierbar sein (committe zuerst)." >&2
		echo "  Für lokale Testbuilds: PUSH=0 ./scripts/build-and-push.sh" >&2
		exit 1
	fi
	echo "==> Konsistenz-Check (apps/ringwerk × apps/treffsicher)"
	RINGWERK_PATH="apps/ringwerk" TREFFSICHER_PATH="apps/treffsicher" "$(dirname "$0")/consistency-check.sh"
fi

SHA="$(git rev-parse --short HEAD)"

# Persistenter local-Build-Cache: ein dedizierter
# docker-container-Builder erlaubt --cache-to/--cache-from type=local (der Default-docker-Builder
# nicht). Der Cache liegt in .buildcache/ (gitignored, AUSSERHALB des Docker-GC-Pools) und übersteht
# so die LRU-Eviction durch andere Projekte → der Release bleibt warm statt kalt (~1min statt ~5min).
# Nur im Release-Pfad (PUSH=1, amd64) nötig; PUSH=0-Testbuilds bleiben beim Default-Builder.
BUILDER=""
if [[ "$PUSH" == "1" ]]; then
	BUILDER="vereinsheim-cache"
	# Idempotent, aber Driver-bewusst: (neu) anlegen, wenn kein Builder DIESES Namens mit
	# docker-container-Driver existiert. Ein vorhandener mit falschem Driver (z.B. docker) würde
	# --cache-to type=local erst zur Build-Zeit scheitern lassen → dann entfernen + frisch anlegen.
	if ! docker buildx inspect "$BUILDER" 2>/dev/null | grep -q 'Driver:[[:space:]]*docker-container'; then
		docker buildx rm "$BUILDER" >/dev/null 2>&1 || true
		docker buildx create --name "$BUILDER" --driver docker-container >/dev/null
	fi
fi

build_app() {
	local app="$1"
	local img="${DOCKER_USER}/${app}"
	echo "==> turbo prune ${app} --docker"
	rm -rf out
	pnpm exec turbo prune "$app" --docker >/dev/null

	local out_flag plat
	if [[ "$PUSH" == "1" ]]; then
		out_flag="--push"
		plat=(--platform "$PLATFORM")
	else
		out_flag="--load"
		plat=()
	fi

	local spec target suffix cache_dir
	local cache_args=() builder_args=()
	for spec in "runner:" "migrator:-migrator"; do
		target="${spec%%:*}"
		suffix="${spec#*:}"
		# Release-Pfad: docker-container-Builder + persistenter local-Cache PRO (app,target). Ein
		# eigenes Verzeichnis je Ziel — ein gemeinsames würde bei jedem Build vom nächsten überschrieben.
		# mode=max cacht auch die Zwischenstages (deps/pnpm install, builder/next build) — der Kern.
		if [[ "$PUSH" == "1" ]]; then
			cache_dir=".buildcache/${app}-${target}"
			mkdir -p "$cache_dir"
			builder_args=(--builder "$BUILDER")
			cache_args=(--cache-from "type=local,src=${cache_dir}"
				--cache-to "type=local,dest=${cache_dir},mode=max")
		fi
		echo "==> Building ${img}:${SHA}${suffix}  (target=${target}, push=${PUSH})"
		docker buildx build \
			--pull \
			"${builder_args[@]}" \
			"${cache_args[@]}" \
			"${plat[@]}" \
			-f Dockerfile \
			--build-arg APP="$app" \
			--target "$target" \
			--tag "${img}:${SHA}${suffix}" \
			--tag "${img}:latest${suffix}" \
			"$out_flag" \
			out
	done
}

for app in $SELECTED; do
	build_app "$app"
done
rm -rf out

echo
if [[ "$PUSH" == "1" ]]; then
	echo "Done. Tags pushed to Docker Hub (sha=${SHA}):"
	for app in $SELECTED; do
		echo "  ${DOCKER_USER}/${app}:latest    (+ :${SHA})"
		echo "  ${DOCKER_USER}/${app}:latest-migrator    (+ :${SHA}-migrator)"
	done
	echo
	echo "On the VPS, run: ./scripts/deploy.sh"
else
	echo "Done (lokal, --load, kein Push):"
	docker images --format "  {{.Repository}}:{{.Tag}}  ({{.Size}})" \
		| grep -E "${DOCKER_USER}/(ringwerk|treffsicher|spiegel):(latest|${SHA})(-migrator)?  \(" || true
fi
