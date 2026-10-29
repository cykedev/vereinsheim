---
id: restore-clean-mixed-schema
type: incident
title: "pg_restore --clean auf ein neueres Schema hinterlässt einen Mischzustand"
keywords: [restore, pg_restore, clean, if-exists, dev-restore, rückspielen, wiederherstellen, mischzustand, fremdschlüssel, foreign key, neueres schema, rollback, migrate deploy, column already exists, exit-on-error, wegwerf-datenbank]
tags: [incident, operations]
relates_to: ["[[restore-from-backup]]", "[[bash-errexit-in-or-list]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** 29. Oktober 2026 (`vereinsheim dev-restore`, Spiegel): Ein Prod-Dump von `main`, mit
`pg_restore --clean --if-exists` in eine Dev-DB mit dem neueren Schema eines Branches gespielt, ließ `Card` und
`User` mit alten Daten, `RawSnapshot` mit neuen und `_prisma_migrations` mit dem Stand von Prod zurück;
`prisma migrate deploy` scheiterte danach mit „column already exists“. Behoben: `restore.sh`, `dev-restore` und
`local-up --restore` spielen über `restore_db` (`scripts/lib/restore-db.sh`) in eine frische Datenbank
`<app>_restore` mit `--exit-on-error` und tauschen sie erst danach gegen die laufende.

## Ursache

- `--clean` löscht nur die Objekte, die im Dump stehen. Tabellen des neueren Schemas bleiben stehen. Verweist eine
  davon per Fremdschlüssel auf eine Tabelle des Dumps (`CardEvidence` → `Card`, `Diary*` → `User`), scheitern
  `DROP CONSTRAINT …_pkey` und `DROP TABLE`, danach `CREATE TABLE`, und `COPY` hängt die Zeilen des Dumps an die
  alten an.
- `pg_restore` ohne `--exit-on-error` macht nach jedem Fehler weiter und schreibt fest, was gelingt; erst am Ende
  kommt Exit 1 („errors ignored on restore“). Dann ist die Datenbank schon gemischt.
- Auch ohne Fremdschlüssel bleiben Tabellen des neueren Schemas stehen, während `_prisma_migrations` den Stand des
  Dumps trägt; `migrate deploy` legt sie dann ein zweites Mal an.

Dasselbe hätte den VPS getroffen: Restore nach einem Rollback (älterer Dump, neueres Schema).

## Regel

- Einen Dump nie über eine laufende Datenbank spielen, immer in eine frische (wie `restore-probe.sh`), mit
  `--exit-on-error`, und erst danach tauschen. Ein kaputter Dump lässt so die laufende Datenbank unberührt.
- Geprüft in `tools/stack-e2e/run.sh --ops`: abgeschnittener Dump (Datenbank unverändert) und Restore auf ein
  neueres Schema mit Fremdschlüssel auf eine Tabelle des Dumps (danach genau der Stand des Dumps).
