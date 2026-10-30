---
id: vps-resource-sizing
type: concept
title: "vps-resource-sizing"
keywords: [Ressourcen, RAM, Sizing, Speicher, VPS-Größe, Arbeitsspeicher, resource sizing, memory, mem_limit, IONOS, Dimensionierung, memory.peak, Spitze, Messung, cgroup, OOM, Leistung, Performance, bun, Multithreading, CPU, Postgres-Tuning]
tags: [ops-constraint]
relates_to: ["[[overview]]", "[[node-heap-above-container-limit]]", "[[spiegel-account-transfer]]"]
part_of: ["[[operations]]"]
documented_in: ["[[overview#VPS-Sizing]]"]
---

**TL;DR** RAM ist Engpass, der VPS bleibt bei 2 GB (IONOS VPS S). Grenzen für drei Apps seit dem 27. Oktober 2026: Ringwerk und Treffsicher 256 MB, Spiegel 320 MB (der Leser der Ausdrucke zählt als Kindprozess dazu), alle mit Heap-Grenze 160, Migratoren 192 MB, Caddy 96 MB, Postgres 384 MB; die Summe (1.312 MiB) passt neben System und Docker. Gemessen am 14. Oktober 2026 nach neun Tagen Betrieb (vor Spiegel): Spitzen Ringwerk 188, Treffsicher 163, Caddy 44, Postgres 96 MiB, 980 MiB verfügbar, kein Swap, keine OOM-Kills. Nach dem ersten Deploy mit Spiegel: 905 MiB verfügbar, alle Apps klar unter ihrer Grenze.

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
(`@react-pdf/renderer`) läuft im Prozess und ist unter dieser Grenze nicht gemessen. Den PDF-Import in Treffsicher
misst seit dem 27. Oktober 2026 der Abschnitt „Grenzen getauscht“ außerhalb des Servers. Nach einigen Tagen Betrieb,
einem Ringwerk-PDF und einem Treffsicher-Import den Messbefehl unten erneut laufen lassen.

## Messung nach dem Release von Stufe 1 (27. Oktober 2026)

Nach dem Deploy von Spiegel mit „Scheibe holen“ und den Werten vom Ausdruck (1c) und nach dem Import von 38 eigenen
Ausdrucken. Der Leser lief auf dem VPS (amd64) mit den Flags aus `reader.ts` gegen jeden gespeicherten Ausdruck (Befehl
unten): alle 38 mit ID, Druckzeit und Werten (`found`, `ok`), `maxRssKb` 72 bis 79 MiB, 32 davon bei 72 bis 73 MiB. Das
liegt unter der Schwelle von 80 MiB und klar unter der Wache von 96 MiB. amd64 liegt damit nicht höher als arm64.

| Dienst | jetzt (Programm, Cache) | Spitze seit Start | Grenze |
| --- | ---: | ---: | ---: |
| Ringwerk | 53 MiB (40, 7) | 57 MiB | 256 MB |
| Treffsicher | 50 MiB (39, 6) | 59 MiB | 320 MB |
| Spiegel | 165 MiB (137, 19) | 201 MiB | 256 MB |
| Caddy | 40 MiB (21, 15) | 75 MiB | 96 MB |
| Postgres | 81 MiB (4, 72) | 148 MiB | 384 MB |

Der Leser läuft als Kindprozess in der cgroup von `app-spiegel` und zählt zu ihrer Grenze. Die Spitze von 201 MiB
enthält den Import und die Messung: Spiegel selbst lag danach bei 137 MiB Programm, ein Leser kommt mit bis zu 79 MiB
dazu. Bis zur Grenze von 256 MB bleiben dann rund 40 MiB. Wächst Spiegel selbst unter Last, kann ein Lesevorgang den
ganzen Container an die Grenze bringen.

## Grenzen getauscht (27. Oktober 2026)

Treffsicher nutzt seine 320 MB nicht (Spitze 59 MiB, früher höchstens 163), Spiegel bleiben beim Lesen eines Ausdrucks
nur rund 40 MiB. Deshalb Spiegel 320 MB und Treffsicher 256 MB; die Summe der Grenzen bleibt 1.312 MiB. [[adr-026]]
nennt 256 MB als Ziel für Spiegel und kleinere Grenzen der anderen Apps als Ausweg, falls das nicht reicht; der Tausch
ist dieser Ausweg.

- **Spiegel behält Heap 160.** Die 64 MiB mehr sind für den Leser der Ausdrucke, nicht für den Heap: 160 MiB Heap, rund
  60 MiB außerhalb des Heaps und ein Leser bis zur Wache von 96 MiB ergeben rund 316 MiB. Ein größerer Heap nähme dem
  Leser die neue Luft wieder.
- **Treffsicher bekommt Heap 160** wie Ringwerk; 192 passt nicht sicher in 256 ([[node-heap-above-container-limit]]).
  Der Meyton-Import liest im Prozess. Gemessen im Container `app-treffsicher` des Stack-Tests (Grenze 256 MB) mit dem
  Ablauf aus `pdfText.ts` und Heap 160, als eigener Prozess neben dem Server, gegen die 74 eigenen Ausdrucke (16 bis
  43 KB): der größte hob den Container von 82 auf höchstens 106 MiB (Heap-Spitze 13 MiB), alle 74 hintereinander auf
  höchstens 125 MiB (Heap 30 MiB). Mit der Spitze von Treffsicher im Stack-Test (137 bis 139 MiB) bleibt das klar unter
  256 MB. Nicht gemessen ist eine PDF nahe der Uploadgrenze von 10 MB.
- **Stack-Test** (`tools/stack-e2e/run.sh --ops` und `--load 3`): in Ordnung. Spitzen Ringwerk 63, Spiegel 141 (unter
  Last 118 bis 125), Treffsicher 137, Caddy 68, Postgres 201 MiB; die Grenzen stehen dort mit 256, 320 und 256.

Auf den VPS kommt die neue `compose.yml` nur über `git pull` im Repo-Verzeichnis; `vereinsheim release` zieht kein Git,
es ruft dort nur `vereinsheim deploy` auf. Liegt sie da, übernimmt der nächste Deploy die Grenzen von selbst, weil
`deploy.sh` jede App mit `docker compose up -d app-<app>` neu anlegt. Ohne Release reicht ein Befehl, Treffsicher
zuerst, damit die Summe nie über 1.312 MiB steigt. `vereinsheim restart` reicht nicht, denn `docker compose restart`
startet den alten Container mit der alten Grenze. `--no-deps` lässt den Migrator aus, `--pull never` nimmt das Image,
das schon da ist:

```bash
docker compose up -d --no-deps --pull never app-treffsicher && docker compose up -d --no-deps --pull never app-spiegel
```

Im Stack-Test belegt: Beide Container wurden mit demselben Image neu angelegt, `memory.max` stand danach bei 256 und
320 MiB, `NODE_OPTIONS` bei 160, die Migratoren und Ringwerk blieben unberührt, beide Apps antworteten. Auf dem VPS
danach mit dem Messbefehl unten prüfen: Treffsicher Grenze 256, Spiegel 320.

Gegen jeden gespeicherten Ausdruck messen (im Repo-Verzeichnis auf dem VPS, nur lesend; gibt keine Dateinamen aus):

```bash
docker compose exec -T app-spiegel sh -s <<'SH'
for f in $(find /app/uploads -name '*.pdf'); do
  out=$(node --max-old-space-size=48 --max-semi-space-size=2 --lite-mode apps/spiegel/printout-reader.mjs < "$f" 2>&1)
  kb=$(echo "$out" | grep -o '"maxRssKb":[0-9]*' | cut -d: -f2 | sort -n | tail -1)
  kinds=$(echo "$out" | grep -o '"kind":"[a-zA-Z]*"' | cut -d'"' -f4 | tr '\n' ',')
  echo "$((${kb:-0} / 1024)) MiB  $kinds"
done | sort -n | uniq -c | tail -15
SH
```

Der Befehl gibt erst am Ende etwas aus, je Ausdruck dauert es ein bis zwei Sekunden.

## Leser der Ausdrucke von Spiegel auf amd64

Spiegel liest fremde PDFs in einem kurzlebigen Kindprozess im Container `app-spiegel` (SP-1.7 b,
`apps/spiegel/src/lib/printouts/reader.ts`): 48 MB Heap, `--lite-mode`, Abbruch über 96 MiB RSS. Gemessen ist
`maxRssKb` nur unter arm64 (nativ höchstens 74 MiB mit `--lite-mode`). amd64 lief lokal nur unter Rosetta, und das treibt
den Speicher hoch (schon ein leeres Node 69 statt 50 MiB, der Leser rund 100 MiB). Den echten Wert misst der User nach
dem Deploy von 1b-1 auf dem VPS, bevor das Scannen (1b-2) live geht. Liegt er über 80 MiB, wird die Grenze vor 1b-2
neu entschieden.

Seit 1c liest derselbe Kindprozess nach ID und Druckzeit auch die Werte und das Trefferbild. Gemessen im Container des
Stack-Tests (arm64, 27. Oktober 2026): ID und Druckzeit 73 MiB, mit den Werten des erfundenen Ausdrucks 74 MiB, mit
echten Ausdrucken 75 bis 87,5 MiB (die mit großem Trefferbild am höchsten). Auf amd64 liegt das höher und damit nah an der
Wache von 96 MiB. Greift sie, gelten ID und Druckzeit trotzdem (eigene Zeile vor den Werten), nur die Werte fehlen
(„Werte nicht lesbar“). Deshalb auf dem VPS mit `--values` messen und mit einem echten Ausdruck mit großem Trefferbild.

Lokal den erfundenen Ausdruck bauen und auf den VPS legen (nach `~/migration/`):

```bash
pnpm --filter spiegel exec tsx tools/printout-sample.ts --values > ausdruck-beispiel.pdf && ./scripts/vereinsheim upload ausdruck-beispiel.pdf
```

Dann auf dem VPS im Repo-Verzeichnis (`vereinsheim ssh`), mit den Flags aus `reader.ts`:

```bash
docker compose exec -T app-spiegel node --max-old-space-size=48 --max-semi-space-size=2 --lite-mode apps/spiegel/printout-reader.mjs < ~/migration/ausdruck-beispiel.pdf | grep -o '"kind":"found"\|"kind":"ok"\|"maxRssKb":[0-9]*'
```

Erwartet: `"kind":"found"` und `"maxRssKb":<kB>`, danach in der zweiten Zeile die Werte mit `"kind":"ok"` und
ihrem `"maxRssKb"` (der höhere zählt).

## Wegwerf-Container der Übernahme aus Treffsicher

`vereinsheim transfer` startet je Konto den Container `transfer-spiegel` (Profil `ops`, [[spiegel-account-transfer]]):
320 MB wie `app-spiegel`, Heap 160, der Leser der Ausdrucke darin als Kindprozess mit eigener Grenze. Er läuft nur für
die Dauer eines Laufs neben dem Stack, also kommen auf dem VPS für Minuten bis zu 320 MB dazu; eine ruhige Zeit wählen.
Das Werkzeug gibt am Ende `Speicher: Spitze <n> MiB` aus (`maxRSS` des Prozesses, ohne den Kindprozess).

## Später: Leistung der Container

Festgehalten am 26. Oktober 2026 auf Wunsch des Users, ohne Messung. Engpass ist der Speicher, nicht die CPU. Die Hebel
in dieser Reihenfolge:

1. **Treffsicher abschalten** ([[adr-033]], Stufe 4): Das macht das größte Limit der drei Apps frei (320 MB). Spiegel
   bekommt danach mehr als 256 MB.
2. **Messen** mit `tools/stack-e2e/run.sh --load` und dem Messbefehl unten, erst danach Feinarbeit.
3. **Feinarbeit an Node und Next**, wenn eine App an ihre Grenze kommt: Heap-Grenzen je App, den Cache von Next im
   Speicher verkleinern oder abschalten (`cacheMaxMemorySize`), weniger Daten an den Browser.
4. **Postgres** an die Größe des VPS anpassen (`shared_buffers`, `work_mem`); die Datenbank ist der größte Block.

Nicht jetzt:

- **Bun statt Node:** Next 16 standalone, Prisma 7 mit `adapter-pg`, NextAuth v4, vitest und der Kindprozess für
  Ausdrucke sind auf Node gebaut und geprüft. Der Gewinn ist ungemessen, das Risiko trifft auch Ringwerk mit echten
  Wettkämpfen. Höchstens als Versuch an Spiegel allein, wenn eine Messung ein echtes Problem zeigt.
- **Multithreading:** Bei rund 15 Mitgliedern gibt es kaum gleichzeitige Last; die einzige rechenlastige Arbeit, das
  Lesen der Ausdrucke, läuft schon in einem eigenen Prozess.

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

