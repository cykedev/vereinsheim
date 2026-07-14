---
id: build-deploy-pipeline
type: subsystem
title: "build-deploy-pipeline"
keywords: [Build-Pipeline, Deployment-Pipeline, Bereitstellung, turbo prune, Docker, build deploy, Image-Build, VPS pullt, CI, Auslieferung]
tags: [subsystem]
subsystem_of: ["[[overview]]"]
governed_by: ["[[adr-007]]", "[[adr-005]]"]
relates_to: ["[[monorepo-fast-build]]"]
informed_by: ["[[adr-006]]"]
documented_in: ["[[architecture#Build & Deploy (ADR-005/006/007/015)]]"]
---

**TL;DR** Lokaler Build aus dem Monorepo (turbo prune → Root-Dockerfile → Docker Hub), VPS pullt; migrate-* vor app-*; Caddy terminiert TLS, proxyt zwei Subdomains.
