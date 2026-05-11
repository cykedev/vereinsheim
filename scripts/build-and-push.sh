#!/usr/bin/env bash
# Lokales Build + Push beider Apps (Ringwerk + Treffsicher) zu Docker Hub.
#
# Pro App werden zwei Images gebaut:
#   <DOCKER_USER>/<app>:<sha>           und :latest             (target=runner)
#   <DOCKER_USER>/<app>:<sha>-migrator  und :latest-migrator    (target=migrator)
#
# Voraussetzungen:
#   - docker login docker.io
#   - docker buildx (Default in modernem Docker Desktop)
#   - Beide App-Repos lokal vorhanden, ohne uncommittete Änderungen
#   - DOCKER_USER gesetzt (siehe .env oder export)
set -euo pipefail

: "${DOCKER_USER:?Set DOCKER_USER (Docker Hub user, e.g. cyke)}"
RINGWERK_PATH="${RINGWERK_PATH:-../ringwerk}"
TREFFSICHER_PATH="${TREFFSICHER_PATH:-../treffsicher}"
PLATFORM="${PLATFORM:-linux/amd64}"

build_target() {
	local app="$1" path="$2" target="$3" suffix="$4"
	local sha
	sha=$(git -C "$path" rev-parse --short HEAD)
	local img="${DOCKER_USER}/${app}"
	echo "==> Building ${img}:${sha}${suffix}  (target=${target}, platform=${PLATFORM})"
	docker buildx build \
		--platform "$PLATFORM" \
		--target "$target" \
		--tag "${img}:${sha}${suffix}" \
		--tag "${img}:latest${suffix}" \
		--push \
		"$path"
}

build_app() {
	local app="$1" path="$2"
	if [[ ! -d "$path/.git" ]]; then
		echo "Not a git repo: $path" >&2
		exit 1
	fi
	if ! git -C "$path" diff --quiet || ! git -C "$path" diff --cached --quiet; then
		echo "Uncommitted changes in $path — aborting (release builds must be reproducible)." >&2
		exit 1
	fi
	build_target "$app" "$path" runner ""
	build_target "$app" "$path" migrator "-migrator"
}

build_app ringwerk "$RINGWERK_PATH"
build_app treffsicher "$TREFFSICHER_PATH"

echo
echo "Done. Tags pushed to Docker Hub:"
echo "  ${DOCKER_USER}/ringwerk:latest    (+ :<sha>)"
echo "  ${DOCKER_USER}/ringwerk:latest-migrator    (+ :<sha>-migrator)"
echo "  ${DOCKER_USER}/treffsicher:latest    (+ :<sha>)"
echo "  ${DOCKER_USER}/treffsicher:latest-migrator    (+ :<sha>-migrator)"
echo
echo "On the VPS, run: ./scripts/deploy.sh"
