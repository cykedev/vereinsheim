---
id: postgres-image-loopback-trust
type: incident
title: "Im Postgres-Image prüft 127.0.0.1 kein Passwort"
keywords: [postgres, pg_hba, pg_hba.conf, trust, scram-sha-256, loopback, localhost, 127.0.0.1, passwort, password, anmeldung, login, db-ensure, docker exec, psql]
tags: [incident, operations]
relates_to: ["[[adr-002]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** 14. Oktober 2026 (`scripts/db-ensure.sh`): Das offizielle Image `postgres:15-alpine` schreibt in
`pg_hba.conf` `trust` für den Socket, `127.0.0.1/32` und `::1/128`; nur `host all all all` verlangt `scram-sha-256`.
Ein `docker compose exec db psql -h 127.0.0.1 -U <app>` meldet sich deshalb mit **jedem** Passwort an. Die Prüfung in
`db-ensure`, ob das Passwort aus der `.env` passt, lief so ins Leere: Ein Test mit falschem Passwort blieb grün. Behoben
mit `-h db`: Über den Dienstnamen geht die Verbindung über das Netz wie bei den Apps, und Postgres prüft das Passwort.

## Belegt

`grep -v '^#' pg_hba.conf` im frischen Container zeigt die drei `trust`-Zeilen vor `host all all all scram-sha-256`.
Danach im Test von `db-ensure` (Wegwerf-Projekt): falsches Passwort in der `.env` → „Rolle spiegel gibt es, das
Passwort aus … passt nicht.“, Exit 1.

## Regel

- Wer im Container ein Passwort prüfen will, verbindet sich über den Dienstnamen (`-h db`), nie über `127.0.0.1` oder
  den Socket.
- Ein „verboten“ beim Verbinden in eine fremde Datenbank (`permission denied for database`) kommt vom fehlenden
  `CONNECT`-Recht, nicht von der Anmeldung; es beweist nicht, dass das Passwort geprüft wurde.
