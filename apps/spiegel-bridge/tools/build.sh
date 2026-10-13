#!/bin/sh
# Binaries der Brücke für die Ziele aus dem Plan (D1): Raspberry Pi, Mini-PC oder Meyton-Rechner, Windows.
# Statisch (ohne cgo), ohne Pfade des Build-Rechners; die Version aus `git describe`, sonst „dev“.
set -eu
cd "$(dirname "$0")/.."
version=$(git describe --always --dirty 2>/dev/null || echo dev)
for target in linux/arm64 linux/amd64 windows/amd64; do
	os=${target%/*}
	arch=${target#*/}
	suffix=""
	[ "$os" = windows ] && suffix=".exe"
	CGO_ENABLED=0 GOOS=$os GOARCH=$arch go build -trimpath -ldflags "-s -w -X main.version=$version" \
		-o "dist/spiegel-bridge-$os-$arch$suffix" ./cmd/spiegel-bridge
done
