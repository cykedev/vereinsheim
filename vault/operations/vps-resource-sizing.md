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

**TL;DR** RAM ist Engpass, der VPS bleibt bei 2 GB (IONOS VPS S). Grenzen für drei Apps: Ringwerk und Spiegel 256 MB mit Heap-Grenze 160, Treffsicher 320 MB mit Heap 192 (Uploads, PDF-Import), Migratoren 192 MB, Caddy 96 MB, Postgres 384 MB; die Summe (1.312 MiB) passt neben System und Docker. Gemessen am 14. Oktober 2026 nach neun Tagen Betrieb (vor Spiegel): Spitzen Ringwerk 188, Treffsicher 163, Caddy 44, Postgres 96 MiB, 980 MiB verfügbar, kein Swap, keine OOM-Kills. Nach dem ersten Deploy mit Spiegel: 905 MiB verfügbar, alle Apps klar unter ihrer Grenze.

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
80 MiB, unter Last 100 bis 110 MiB; ein Migrator auf einer leeren Datenbank höchstens 130 MiB. Daraus die Grenzen:
Ringwerk und Spiegel 256 MB mit Heap-Grenze 160 ([[node-heap-above-container-limit]]), Treffsicher 320 MB mit
Heap 192 (Uploads bis 10 MB und der Meyton-Import mit pdf.js laufen im Prozess, unter Last nicht gemessen),
Migratoren 192 MB, Postgres unverändert.

## Messung nach dem ersten Deploy mit Spiegel (14. Oktober 2026, 17:15)

Direkt nach dem Deploy, Backup und Restore-Probe, alle Container neu gestartet:

| Dienst | jetzt (Programm, Cache) | Spitze seit Start | Grenze |
| --- | ---: | ---: | ---: |
| Ringwerk | 110 MiB (92, 11) | 161 MiB | 256 MB |
| Treffsicher | 108 MiB (86, 15) | 160 MiB | 320 MB |
| Spiegel | 132 MiB (111, 14) | 136 MiB | 256 MB |
| Caddy | 60 MiB (16, 42) | 64 MiB | 64 MB → 96 MB |
| Postgres | 112 MiB (4, 105) | 121 MiB | 384 MB |

RAM 1.870 MiB, belegt 964, verfügbar 905; kein Swap. Caddy stieß mit drei Hosts an seine Grenze (der Cache ist vor
allem das Binary); deshalb 96 MB, die Summe der Grenzen steigt auf 1.312 MiB.

## Offen: Messung unter Last

Gemessen ist bisher nur direkt nach dem Neustart beim Deploy. Ringwerk läuft mit 256 MB, die PDF-Erzeugung
(`@react-pdf/renderer`) läuft im Prozess und ist unter dieser Grenze nicht gemessen, ebenso der PDF-Import in
Treffsicher. Nach einigen Tagen Betrieb, einem Ringwerk-PDF und einem Treffsicher-Import den Messbefehl unten erneut
laufen lassen.

## Offen: Leser der Ausdrucke von Spiegel auf amd64

Spiegel liest fremde PDFs in einem kurzlebigen Kindprozess im Container `app-spiegel` (SP-1.7 b,
`apps/spiegel/src/lib/printouts/reader.ts`): 48 MB Heap, `--lite-mode`, Abbruch über 96 MiB RSS. Gemessen ist
`maxRssKb` nur unter arm64 (nativ höchstens 74 MiB mit `--lite-mode`). amd64 lief lokal nur unter Rosetta, und das treibt
den Speicher hoch (schon ein leeres Node 69 statt 50 MiB, der Leser rund 100 MiB). Den echten Wert misst der User nach
dem Deploy von 1b-1 auf dem VPS, bevor das Scannen (1b-2) live geht. Liegt er über 80 MiB, wird die Grenze vor 1b-2
neu entschieden.

Lokal den erfundenen Ausdruck bauen und auf den VPS legen (nach `~/migration/`):

```bash
pnpm --filter spiegel exec tsx tools/printout-sample.ts > ausdruck-beispiel.pdf && ./scripts/vereinsheim upload ausdruck-beispiel.pdf
```

Dann auf dem VPS im Repo-Verzeichnis (`vereinsheim ssh`), mit den Flags aus `reader.ts`:

```bash
docker compose exec -T app-spiegel node --max-old-space-size=48 --max-semi-space-size=2 --lite-mode apps/spiegel/printout-reader.mjs < ~/migration/ausdruck-beispiel.pdf | grep -o '"kind":"found"\|"maxRssKb":[0-9]*'
```

Erwartet: `"kind":"found"` und `"maxRssKb":<kB>`.

## Swap als Sicherheitsnetz

Der VPS läuft ohne Swap. Eine kleine Swap-Datei fängt eine kurze Spitze ab, statt dass der Kernel einen Container
beendet ([[adr-026]] nennt sie als Option). Empfohlen, sobald die verfügbare Reserve unter etwa 500 MiB fällt:

```bash
sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
sudo sysctl vm.swappiness=10 && echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf
```

Messbefehl auf dem VPS (im Repo-Verzeichnis, nur lesend):

```bash
for c in $(docker compose ps -q); do docker exec "$c" sh -c 'echo $(cat /sys/fs/cgroup/memory.current) $(cat /sys/fs/cgroup/memory.peak 2>/dev/null || echo 0) $(awk "/^anon /{print \$2}" /sys/fs/cgroup/memory.stat) $(awk "/^file /{print \$2}" /sys/fs/cgroup/memory.stat) $(cat /sys/fs/cgroup/memory.max)' | awk -v n="$(docker inspect -f '{{.Name}}' "$c" | cut -c2-)" -v s="$(docker inspect -f '{{.State.StartedAt}}' "$c" | cut -c1-10)" '{m=1048576; printf "%-34s seit %s  jetzt %4d MiB (Programm %4d, Cache %4d)  Spitze %4d MiB  Grenze %s\n", n, s, $1/m, $3/m, $4/m, $2/m, ($5=="max"?"keine":int($5/m))}'; done
```

