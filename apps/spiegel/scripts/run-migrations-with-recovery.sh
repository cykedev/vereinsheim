#!/bin/sh
# Spiegel: nur `prisma migrate deploy`. Bis zum ersten Deploy gibt es genau eine Migration (…_init); eine
# Wiederherstellung wie in Ringwerk und Treffsicher kommt erst, wenn eine Migration in Produktion scheitert.
# Der Name ist der Vertrag des Root-Dockerfiles (Ziel `migrator`).
set -eu

echo "[migrate] Running prisma migrate deploy..."
exec node /app/node_modules/prisma/build/index.js migrate deploy
