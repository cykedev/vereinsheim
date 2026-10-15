#!/bin/sh
# Spiegel: nur `prisma migrate deploy`, ohne die Wiederherstellung von Ringwerk und Treffsicher. Scheitert eine
# Migration, gilt der manuelle Weg aus vault/operations/operations.md (Recovery von fehlgeschlagenen Migrationen).
# Der Name ist der Vertrag des Root-Dockerfiles (Ziel `migrator`).
set -eu

echo "[migrate] Running prisma migrate deploy..."
exec node /app/node_modules/prisma/build/index.js migrate deploy
