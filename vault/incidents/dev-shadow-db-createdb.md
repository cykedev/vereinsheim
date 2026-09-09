---
id: dev-shadow-db-createdb
type: incident
title: "Dev-Rollen ohne CREATEDB — prisma migrate dev scheitert mit P3014"
keywords: [P3014, Shadow-Datenbank, shadow database, CREATEDB, prisma migrate dev, Dev-Rollen, bootstrap-dev, db-init, Datenbank-Rechte, migrate deploy]
tags: [incident, dev-setup]
relates_to: ["[[prisma7-conventions]]", "[[migrations-safety-culture]]"]
part_of: ["[[incidents]]"]
informed_by: ["[[adr-015]]"]
---

**TL;DR** 2026-09-09 (ringwerk): `prisma migrate dev` scheiterte mit **P3014** — die Dev-Rollen
`ringwerk`/`treffsicher` hatten kein `CREATEDB`, die Schema-Engine konnte also keine Shadow-DB
anlegen. Der im `/migrate`-Skill dokumentierte Weg war im Monorepo-Dev-Setup damit **nie** lauffähig;
die 11 Altmigrationen stammen noch aus den Standalone-Repos.

Gefixt an zwei Stellen, weil eine allein nicht reicht: `dev/db-init/01-create-dev-dbs.sh` vergibt das
Recht beim Anlegen der Rollen — greift aber nur bei **leerem** Volume; `scripts/bootstrap-dev.sh`
zieht es zusätzlich idempotent nach (`ALTER ROLE … CREATEDB` nach dem Readiness-Wait), damit
bestehende Dev-Maschinen denselben Stand erreichen.

Das Prod-`db-init/01-users-and-dbs.sh` bekommt das Recht **bewusst nicht**: Prod migriert via
`migrate deploy`, das keine Shadow-DB anlegt (ADR-002-Isolation bleibt so eng wie möglich). Diese
Aufteilung ist Absicht und nicht revidierbar.
