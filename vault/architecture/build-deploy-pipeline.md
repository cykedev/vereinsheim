---
id: build-deploy-pipeline
type: subsystem
title: "build-deploy-pipeline"
keywords: [Build-Pipeline, Deployment-Pipeline, Bereitstellung, turbo prune, Docker, build deploy, Image-Build, VPS pullt, CI, Auslieferung, local-Build-Cache, Cache-Eviction, .buildcache, docker-container-Builder, warmer Build, langsamer Release, Build-Beschleunigung]
tags: [subsystem]
subsystem_of: ["[[overview]]"]
governed_by: ["[[adr-007]]", "[[adr-005]]"]
relates_to: ["[[monorepo-fast-build]]"]
informed_by: ["[[adr-006]]"]
documented_in: ["[[architecture#Build & Deploy (ADR-005/006/007/015)]]"]
---

**TL;DR** Lokaler Build aus dem Monorepo (turbo prune → Root-Dockerfile → Docker Hub), VPS pullt; migrate-* vor app-*; Caddy terminiert TLS, proxyt zwei Subdomains.

**Persistenter local-Build-Cache (Juli 2026).** Der Release-Pfad (`PUSH=1`) baut über einen dedizierten
`docker-container`-Builder (`vereinsheim-cache`, idempotent in `build-and-push.sh` angelegt) mit
`--cache-to/--cache-from type=local,mode=max` **pro `(app,target)`** unter `.buildcache/` (gitignored).
Warum: Der BuildKit-Default-Cache ist ein LRU-Pool über ALLE lokalen Projekte — bei vollem Docker
verdrängen fremde Builds die vereinsheim-Layer zwischen zwei Releases → alles läuft kalt (gemessen ~5min
statt ~1min; der `pnpm install`- + `next build`-Layer werden neu gebaut, obwohl unverändert). Ein
FS-Verzeichnis liegt **außerhalb** des GC-Pools und übersteht die Eviction (PoC: Rebuild nach
`docker buildx prune -af` in **5s aus `.buildcache/`** statt 130s kalt). Bei Platzmangel: `rm -rf
.buildcache` (nächster Release baut einmalig kalt, füllt neu). `PUSH=0`-Testbuilds bleiben beim
Default-Builder (nativ, schnell). Deploy-Vertrag (Tags/`compose.yml`) unverändert. Emulation (Rosetta,
amd64-auf-arm64) ist NICHT die Ursache langsamer Releases — das war die Cache-Eviction.
