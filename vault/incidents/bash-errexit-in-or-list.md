---
id: bash-errexit-in-or-list
type: incident
title: "set -e gilt nicht in einer Funktion links von ||"
keywords: [bash, set -e, errexit, pipefail, funktion, function, oder, "||", fehlerbehandlung, exit code, skript, script, db-ensure]
tags: [incident, operations]
relates_to: ["[[postgres-image-loopback-trust]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** 14. Oktober 2026 (Review von P3, `scripts/db-ensure.sh`): Bash schaltet `errexit` für alles ab, was links
von `||` oder `&&` oder in einer `if`-Bedingung läuft, auch für den ganzen Körper einer dort aufgerufenen Funktion.
`ensure_app "$app" || failed=1` lief deshalb nach einem gescheiterten `CREATE DATABASE` einfach weiter, und die
nächste Prüfung meldete einen falschen Grund („Passwort passt nicht“). Behoben: Jeder Schritt in der Funktion prüft
seinen Exit-Code selbst (`if ! …; then echo …; return 1; fi`).

## Regel

- In Skripten unter `scripts/` jede Funktion, die mit `|| …` gesammelt aufgerufen wird, so schreiben, als gäbe es kein
  `set -e`: jeden Befehl, der scheitern kann, selbst prüfen und mit eigener Meldung `return 1`.
- Meldungen von Werkzeugen (psql, docker) auf stderr nicht verwerfen, wenn danach ein eigener Grund behauptet wird.
- Gegenprobe: einen Schritt absichtlich scheitern lassen (hier: `template1` belegt) und die Meldung lesen.
