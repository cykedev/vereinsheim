#!/usr/bin/env bash
# Build + Push beider Apps (Ringwerk + Treffsicher) AUS DEM MONOREPO via
# `turbo prune --docker`. Ersetzt den früheren Build aus den Standalone-Repos
# (Phase 3 der Monorepo-Migration; ADR-015). Tag-Schema unverändert → der
# Deploy-Vertrag (compose.yml/.env) bleibt gewahrt.
#
# Pro App zwei Images:
#   <DOCKER_USER>/<app>:<sha>           und :latest             (target=runner)
#   <DOCKER_USER>/<app>:<sha>-migrator  und :latest-migrator    (target=migrator)
# Der <sha> ist jetzt der Monorepo-HEAD (beide Apps teilen ihn).
#
# Modi:
#   (default) PUSH=1 : --platform linux/amd64 --push; verlangt committeten Stand
#                      + Konsistenz-Gate.
#   PUSH=0           : --load (native Plattform); erlaubt uncommittete Änderungen,
#                      kein Push, kein Gate (lokale Testbuilds).
#
# Voraussetzungen: docker buildx, `pnpm install` im Repo-Root (turbo verfügbar),
# DOCKER_USER gesetzt (siehe .env oder export).
set -euo pipefail
cd "$(dirname "$0")/.."

: "${DOCKER_USER:?Set DOCKER_USER (Docker Hub user, e.g. cyke)}"
PLATFORM="${PLATFORM:-linux/amd64}"
PUSH="${PUSH:-1}"

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

	local spec target suffix
	for spec in "runner:" "migrator:-migrator"; do
		target="${spec%%:*}"
		suffix="${spec#*:}"
		echo "==> Building ${img}:${SHA}${suffix}  (target=${target}, push=${PUSH})"
		docker buildx build \
			--pull \
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

build_app ringwerk
build_app treffsicher
rm -rf out

echo
if [[ "$PUSH" == "1" ]]; then
	echo "Done. Tags pushed to Docker Hub (sha=${SHA}):"
	echo "  ${DOCKER_USER}/ringwerk:latest    (+ :${SHA})"
	echo "  ${DOCKER_USER}/ringwerk:latest-migrator    (+ :${SHA}-migrator)"
	echo "  ${DOCKER_USER}/treffsicher:latest    (+ :${SHA})"
	echo "  ${DOCKER_USER}/treffsicher:latest-migrator    (+ :${SHA}-migrator)"
	echo
	echo "On the VPS, run: ./scripts/deploy.sh"
else
	echo "Done (lokal, --load, kein Push):"
	docker images --format "  {{.Repository}}:{{.Tag}}  ({{.Size}})" \
		| grep -E "${DOCKER_USER}/(ringwerk|treffsicher):(latest|${SHA})(-migrator)?$" || true
fi
