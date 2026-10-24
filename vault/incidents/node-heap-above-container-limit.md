---
id: node-heap-above-container-limit
type: incident
title: "Node setzt den Heap über eine kleine Container-Grenze"
keywords: [node, v8, heap, max-old-space-size, node_options, mem_limit, cgroup, container, docker, speicher, arbeitsspeicher, oom, oom-kill, memory.peak, memory.current, memory.stat, anon, cache, grenze, limit]
tags: [incident, operations]
relates_to: ["[[vps-resource-sizing]]", "[[adr-026]]"]
part_of: ["[[incidents]]"]
---

**TL;DR** 14. Oktober 2026 (Node 24, unter Node 26 gleich): Node richtet die Obergrenze seines Heaps
nach der Grenze des Containers, aber nicht darunter. Bei `--memory` 192, 256 und 384 MB liegt sie gleich bei 259 MiB,
erst bei 1 GB bei 560 MiB, ohne Grenze bei rund 4,3 GB. Unter rund 384 MB liegt der Heap also über der Grenze des
Containers: V8 räumt nicht früher auf, und der Kernel beendet den Prozess, bevor Node einen Speicherfehler meldet. Wer
`mem_limit` einer Node-App senkt, setzt deshalb immer `NODE_OPTIONS=--max-old-space-size=…` dazu (bei 256 MB: 160).

## Belegt

```bash
docker run --rm --memory=256m node:24-alpine node -e "console.log(require('v8').getHeapStatistics().heap_size_limit/1048576)"
```

ergab 259 (auch bei 192m und 384m); `process.constrainedMemory()` meldet die Grenze richtig (256).

Unter Node 26 (`node:26-alpine`, 24. Oktober 2026) gleich: 262 MiB bei 192, 256 und 384 MB, 536 MiB bei 1 GB; mit
`NODE_OPTIONS=--max-old-space-size=160` bei 256 MB 166 MiB. Die Regel unten gilt unverändert.

## Messen

Die Spitze eines Containers seit seinem Start liefert cgroup v2 ohne Werkzeug: `memory.peak`, dazu `memory.current` und
in `memory.stat` die Zeilen `anon` (Programm) und `file` (Cache). Der fertige Befehl für alle Container steht in
[[vps-resource-sizing]]. `docker stats` zeigt nur den Moment. Bei Postgres zählt der eigene Puffer (`shared_buffers`) als
`file`, dort ist Cache also nicht frei.

## Regel

- `mem_limit` einer Node-App unter 512 MB nur zusammen mit `--max-old-space-size`, mit Luft für den Speicher außerhalb
  des Heaps (bei 256 MB: 160 MiB Heap).
- Vor dem Senken einer Grenze die Spitze seit dem Start messen (`memory.peak`), nicht nur den Moment.
