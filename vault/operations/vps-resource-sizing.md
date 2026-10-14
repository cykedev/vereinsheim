---
id: vps-resource-sizing
type: concept
title: "vps-resource-sizing"
keywords: [Ressourcen, RAM, Sizing, Speicher, VPS-Größe, Arbeitsspeicher, resource sizing, memory, mem_limit, IONOS, Dimensionierung, memory.peak, Spitze, Messung, cgroup, OOM]
tags: [ops-constraint]
relates_to: ["[[overview]]", "[[node-heap-above-container-limit]]"]
part_of: ["[[operations]]"]
documented_in: ["[[overview#VPS-Sizing]]"]
---

**TL;DR** RAM ist Engpass, der VPS bleibt bei 2 GB (IONOS VPS S). Gemessen am 14. Oktober 2026 nach neun Tagen Betrieb: Spitzen Ringwerk 188, Treffsicher 163, Caddy 44, Postgres 96 MiB, 980 MiB verfügbar, kein Swap, keine OOM-Kills. Seit P3 (drei Apps): Ringwerk und Spiegel 256 MB mit Heap-Grenze 160, Treffsicher 320 MB mit Heap 192 (Uploads, PDF-Import), Migratoren 192 MB, Caddy 96 MB (seit dem ersten Deploy, vorher 64), Postgres 384 MB; die Summe (1.312 MiB) passt neben System und Docker. Nach dem ersten Deploy gemessen: 905 MiB verfügbar, alle Apps klar unter ihrer Grenze.

## Messung 14. Oktober 2026

Auf dem VPS, Container seit dem 5. Oktober (neun Tage), Spitze per `memory.peak`:

| Dienst | jetzt (Programm, Cache) | Spitze seit Start | Grenze |
| --- | ---: | ---: | ---: |
| Ringwerk | 155 MiB (146, 1) | 188 MiB | 384 MB |
| Treffsicher | 141 MiB (129, 4) | 163 MiB | 384 MB |
| Caddy (seit 14. Oktober) | 35 MiB (25, 9) | 44 MiB | 64 MB |
| Postgres | 54 MiB (4, 48) | 96 MiB | 384 MB |

RAM 1.870 MiB, belegt 890, verfügbar 980, System und Docker rund 500 MiB. Kein Swap, kein `OOMKilled`, keine
Neustarts, keine OOM-Meldung im Kernel. Lokal mit den echten Images: Ringwerk und Treffsicher nach dem Start rund
80 MiB, unter Last 100 bis 110 MiB; ein Migrator auf einer leeren Datenbank höchstens 130 MiB. Daraus die Grenzen in
P3 (Plan `plans/2026-10-14-spiegel-stack.md`, D8): Ringwerk und Spiegel 256 MB mit Heap-Grenze 160
([[node-heap-above-container-limit]]), Treffsicher nach dem Review 320 MB mit Heap 192 (Uploads bis 10 MB und der
Meyton-Import mit pdf.js laufen im Prozess, unter Last nicht gemessen), Migratoren 192 MB, Caddy und Postgres
unverändert.

## Messung nach dem ersten Deploy mit Spiegel (14. Oktober 2026, 17:15)

Direkt nach dem Deploy (P5), Backup und Restore-Probe, alle Container neu gestartet:

| Dienst | jetzt (Programm, Cache) | Spitze seit Start | Grenze |
| --- | ---: | ---: | ---: |
| Ringwerk | 110 MiB (92, 11) | 161 MiB | 256 MB |
| Treffsicher | 108 MiB (86, 15) | 160 MiB | 320 MB |
| Spiegel | 132 MiB (111, 14) | 136 MiB | 256 MB |
| Caddy | 60 MiB (16, 42) | 64 MiB | 64 MB → 96 MB |
| Postgres | 112 MiB (4, 105) | 121 MiB | 384 MB |

RAM 1.870 MiB, belegt 964, verfügbar 905; kein Swap. Caddy stieß mit drei Hosts an seine Grenze (der Cache ist vor
allem das Binary); deshalb 96 MB, die Summe der Grenzen steigt auf 1.312 MiB.

Messbefehl auf dem VPS (im Repo-Verzeichnis, nur lesend):

```bash
for c in $(docker compose ps -q); do docker exec "$c" sh -c 'echo $(cat /sys/fs/cgroup/memory.current) $(cat /sys/fs/cgroup/memory.peak 2>/dev/null || echo 0) $(awk "/^anon /{print \$2}" /sys/fs/cgroup/memory.stat) $(awk "/^file /{print \$2}" /sys/fs/cgroup/memory.stat) $(cat /sys/fs/cgroup/memory.max)' | awk -v n="$(docker inspect -f '{{.Name}}' "$c" | cut -c2-)" -v s="$(docker inspect -f '{{.State.StartedAt}}' "$c" | cut -c1-10)" '{m=1048576; printf "%-34s seit %s  jetzt %4d MiB (Programm %4d, Cache %4d)  Spitze %4d MiB  Grenze %s\n", n, s, $1/m, $3/m, $4/m, $2/m, ($5=="max"?"keine":int($5/m))}'; done
```

