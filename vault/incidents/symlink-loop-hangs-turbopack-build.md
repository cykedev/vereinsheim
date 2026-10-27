---
id: symlink-loop-hangs-turbopack-build
type: incident
title: "Ein Symlink auf sich selbst lässt next build von Spiegel hängen"
keywords: [next build, hängt, hang, Turbopack, Symlink, symlink loop, Zyklus, tools/private, raw trace directory, file tracing, instrumentation, whole app module graph, 600 % CPU, Creating an optimized production build, Worktree, ln -s, Stop-Gate hängt, uploadDir]
tags: [incident, gates, spiegel]
relates_to: ["[[spiegel]]", "[[monorepo]]", "[[next-dist-dir-shared-with-dev-server]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** 2026-10-27 (Spiegel): `next build` blieb im Haupt-Checkout bei „Creating an optimized production build …“
stehen, mit rund 600 % CPU und wachsendem Speicher (13 GB nach 150 s), ohne Fehlermeldung. Derselbe Commit baute in
einem frischen Worktree in Sekunden. Ursache war ein Symlink `apps/spiegel/tools/private/private`, der auf
`apps/spiegel/tools/private` zeigte, also auf sich selbst. Nach dem Entfernen baute Spiegel im Haupt-Checkout in 15 s.

## Wie der Link entstand

Für Worktrees wird `tools/private` (gitignored) aus dem Haupt-Checkout verlinkt:
`ln -s <haupt>/apps/spiegel/tools/private apps/spiegel/tools/private`. Gibt es das Ziel schon als Ordner, legt `ln -s`
den Link **in** diesem Ordner an. Im Haupt-Checkout selbst ausgeführt, entsteht so ein Link auf den eigenen Ordner.
`git status` zeigt ihn nicht, weil `tools/private/` ignoriert ist.

## Warum Turbopack daran hängt

`src/lib/printouts/files.ts` baut Pfade aus dem Arbeitsverzeichnis (`resolve("uploads")`, `join(uploadDir(), …)`).
Turbopack verfolgt solche Pfade beim File-Tracing der Instrumentation (`raw trace directory`) und läuft dafür den Baum
unter `apps/spiegel` ab, `tools/` eingeschlossen. Dieser Lauf folgt Symlinks. Mit dem Zyklus wird der Baum unendlich
tief, der Modulgraph (`whole app module graph`) wird nie fertig. Dieselbe Spur zieht im lokalen Build auch `uploads/`
nach `.next/standalone` (siehe den offenen Punkt zu Pfaden aus dem Arbeitsverzeichnis in [[conventions]]).

## So findet man es

- Hängt `next build` ohne Meldung, zuerst nach Symlinks unter der App suchen:
  `find apps packages tools -name node_modules -prune -o -type l -print`. Ein Link, der auf einen Vorfahren zeigt, ist
  ein Zyklus.
- Sonst den Build mit `NEXT_TURBOPACK_TRACING=1` laufen lassen, die Spur unter `.next-profiles/trace-turbopack.bin`
  mit `next internal trace <datei> --mcp-port 5748` laden und mit `next internal query-trace --search <text>`
  abfragen (etwa `read symlink`, `raw trace directory`).
- Vor `ln -s` für einen Worktree prüfen, dass das Ziel noch nicht existiert (`[ -e ziel ] || ln -s …`), und den Befehl
  nur im Worktree ausführen, nie im Haupt-Checkout.
