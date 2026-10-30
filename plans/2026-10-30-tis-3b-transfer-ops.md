# 3b · Betrieb der Übernahme

Teilplan von Stufe 3 aus `plans/2026-10-26-treffsicher-in-spiegel.md` (Basisbranch `feat/treffsicher-in-spiegel`),
Kindsession `tis-3b-transfer-ops`, Branch `feat/tis-3b-transfer-ops` vom Basisbranch, zurück in den Basisbranch.
Entscheidungen: „Stufe 3“ im Koordinationsplan, der Nachtrag 3a in [[adr-033]] und die Entscheidungen vom
30. Oktober 2026 (unten). Will die Kindsession von etwas abweichen, meldet sie das vorher der koordinierenden Session.

**Geschützte Pfade:** `compose.yml`, `compose.local.yml`, `scripts/vereinsheim` und optional `tools/stack-e2e/`
gehören zum Deploy-Vertrag bzw. zu `scripts/`. Diese Aufgaben (18 bis 23, 26) laufen ohne Autopilot-Marker (ADR-023);
die koordinierende Session prüft ihren Diff bei der Übernahme. Das `Dockerfile` bleibt unverändert: Das Bündel liegt im
Standalone-Build und kommt mit dem bestehenden `COPY .next/standalone` ins Image. Caddy bleibt unverändert. Schema und
Migrationen bleiben in beiden Apps unverändert. Eine neue Brücke braucht es nicht.

## Kontext

3a übernimmt ein Konto, aber nur gegen die lokale Dev-Datenbank: `tools/transfer.ts` mit `assertDevDatabase`,
Treffsicher über `psql` im Dev-Container, Dateien aus `tools/private/`, das Merkmal „umgezogen“ in der Transaktion.
Keines der Images enthält das Werkzeug (der Runner hat nur Next standalone, der Migrator nur prisma). Für Prod fehlen
vier Dinge:

1. ein Weg auf den VPS, ohne dass die App Spiegel die Datenbank von Treffsicher berührt (ADR-002);
2. der Lauf über die geprüfte Zuordnungsdatei aus V1 und ein `status`, damit niemand vergessen wird;
3. ein Weg, auf dem die Übung gegen die Prod-Kopie genau so läuft wie später Prod;
4. die offenen Punkte aus 3a.

Prod läuft erst nach dem Merge des Basisbranchs und einem Deploy. Bis dahin übt 3b nur lokal gegen die Prod-Kopie.

## Entscheidungen

Mit dem User am 30. Oktober 2026:

1. **Ein Wegwerf-Container auf dem VPS** aus dem Image von Spiegel (nicht vom Mac über einen Tunnel). Das Werkzeug
   wird mit esbuild gebündelt (`transfer.mjs`, wie `printout-reader.mjs`). `vereinsheim transfer` liest Treffsicher auf
   dem Host über `docker compose exec -T db psql`, startet den Container mit `DATABASE_URL` von Spiegel,
   `uploads_spiegel` schreibbar und `uploads_treffsicher` **nur lesend**, und setzt nach einem echten, gespeicherten
   Lauf `movedToSpiegelAt` auf dem Host über `psql`. Der Prozess von Spiegel verbindet sich nie mit der Datenbank von
   Treffsicher. Seit dem Hauptbuch heißt das Merkmal nur „umgezogen“, deshalb darf es nach dem Commit kommen.
2. **Derselbe Weg lokal gegen die Prod-Kopie** über den lokalen Stack (`local-up --restore`, `compose.local.yml`).
3. **Die Zuordnungsdatei bleibt auf dem Mac.** `vereinsheim transfer --mapping <datei>` prüft die Regeln und ruft je
   Zeile die Übernahme eines Kontos auf dem VPS über `ssh` auf. `status` läuft ebenfalls auf dem Mac. E-Mails liegen nie
   in einer Datei auf dem VPS, sie stehen nur auf der Kommandozeile des Aufrufs. Ausgabe und Logs enthalten nur Zahlen,
   Codes und gekürzte Hashes (8 Hex-Zeichen von sha256 der E-Mail, wie im Namen des Berichts aus 3a).

Von der koordinierenden Session festgelegt (30. Oktober 2026), mit Grund:

4. **Das Konto geht per Pipe in den Container** (`psql … | docker compose run -T …`), nicht als Datei. So liegt auf dem
   VPS nie eine Datei mit E-Mail, Passwort-Hash oder Texten; nur `owners.txt` (Kennungen) und der Bericht.
5. **Ein eigener Dienst `transfer-spiegel`** in `compose.yml` mit `profiles: [ops]`: nur das Netz `data`, nur
   `DATABASE_URL`, beide Volumes deklariert und von `compose config` geprüft; `deploy` und `up -d` starten ihn nicht.
6. **Lokal braucht jeder Aufruf `--local` oder `--vps`.** Kein Aufruf trifft Prod aus Versehen.
7. **Berichte mit Texten** liegen in `reports/tis-3b/` im Repo-Verzeichnis des jeweiligen Rechners, gitignored, der
   Ordner 700, die Dateien 600: in keinem Image und keinem Volume der Apps, Caddy liefert nichts aus dem Repo aus,
   dieselbe Konvention wie `reports/tis-v1/` und `reports/tis-3a/`. Nicht unter `/var/backups/vereinsheim/` (wird
   heruntergeladen und rotiert).
8. **Exit-Codes des Werkzeugs bleiben** 0 bis 5. Das Ops-CLI übersetzt sie in deutsche Meldungen und kennt dazu 6
   „gespeichert, Merkmal fehlt“, den die Schleife über die Datei braucht.
9. **Merkmal auch bei Exit 1** (Befund, aber gespeichert), wie in 3a. Ein Probelauf setzt nie ein Merkmal.
10. **Strenge Regeln der Datei:** Eine `ok`-/`new`-Zeile eines `from`, zu dem noch eine `check`-Zeile steht, läuft nicht
    (`checkPending`). Zwei `from` auf dasselbe `to` brechen die ganze Datei ab, bevor ein Lauf startet (dieselbe Regel
    wie `foreignInTarget` aus 3a, nur früher).
11. **Backup vor einem echten Lauf über die Datei mit `--vps`**, abschaltbar mit `SKIP_BACKUP=1`; nicht je Konto.
12. **`psql` als `postgres`**, wie `cmd_psql` und `accounts.sh`.
13. **Offene Punkte aus 3a werden behoben:**
    - (a) Trägt eine übernommene Scheibe zwei Ausdrucke, nimmt ein späteres Neulesen nur einen, der zu den Zahlen aus
      Treffsicher passt (Schusszahl und Ergebnis gegen die jüngste Revision mit Grund `treffsicher`; der Abend nicht,
      die Ausdrucke hängen schon an der Scheibe). Passt keiner, bleibt die Scheibe, wie sie ist.
    - (b) Ein späterer Lauf setzt die Art (`kindChoice`) einer unveränderten Scheibe neu.
    - (c) Die Übung läuft lokal über alle Zeilen der Zuordnung, als Probelauf und als echter Lauf.

## Ansatz

### Überblick

```
Mac (lokaler Modus)                                       VPS (oder lokaler Stack mit --local)
vereinsheim transfer --mapping z.csv --vps                vereinsheim transfer --yes --from a --to b [--dry-run]
  tsx tools/transfer-mapping.ts plan z.csv                  1. psql treffsicher-owners.sql > $work/owners.txt
  je Zeile: ssh -n VPS "… transfer --yes --from … --to …"   2. psql treffsicher-account.sql | compose run -T --rm
  Übersicht: Zeile, Hash, Exit, Text                           transfer-spiegel (node transfer.mjs, liest stdin)
vereinsheim transfer status --mapping z.csv --vps           3. Bericht $work/*.md -> reports/tis-3b/ (600)
  ssh … psql <status-SQL  (nur Hashes)                      4. $work/saved und kein Probelauf: psql treffsicher-mark.sql
  tsx tools/transfer-mapping.ts status …                    5. Meldung je Exit-Code
```

### Bündel und Image

- **Zuerst der Beweis (Aufgabe 0):** Ob esbuild den Prisma-7-Client (`src/generated/prisma`, Adapter `pg`, Query
  Compiler) zu einem lauffähigen `transfer.mjs` im Standalone-Ordner bündeln kann, ist nicht erprobt. Aufgabe 0 baut ein
  Wegwerf-Bündel mit einer einzigen Abfrage und startet es im echten Image. Scheitert das, hält die Kindsession an und
  meldet der koordinierenden Session die Wege, die sie sieht (etwa Prisma-Pakete als `external` aus den `node_modules`
  des Standalone-Builds, oder `format: "cjs"` mit Banner). Weiter erst nach Antwort.
- Neu ist `tools/transfer-ops.ts`, der Einstieg für den Container:
  - Das Konto kommt von stdin (`exportTreffsicherSource`, ohne `markMoved`).
  - Die Kennungen kommen aus `$TRANSFER_DIR/owners.txt`.
  - Die Dateien kommen aus `$TRANSFER_FILES` (`filesIn`).
  - Der Bericht geht nach `$TRANSFER_DIR`, ohne Dev-Guard.
  - `--files` ist ein Aufruffehler (Exit 2).
  - Zuletzt gibt das Werkzeug `Speicher: Spitze <n> MiB` aus (`process.resourceUsage().maxRSS`; der Leser misst sich
    selbst).
- Neu ist `tools/build-transfer.ts`, analog zu `build-reader.ts`, mit `transferBuildOptions(outfile)`:
  - Einstieg `tools/transfer-ops.ts`, `bundle`, `platform: "node"`, `format: "esm"`, `target: "node26"`;
  - `external: ["pg-native"]`;
  - Banner `import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);`, weil `pg`
    CommonJS-Builtins per `require` lädt;
  - Ausgabe `.next/standalone/apps/spiegel/transfer.mjs`, neben `printout-reader.mjs`, das `readerArgs` über
    `process.cwd()` findet.
- In `package.json`: `"build": "next build && tsx tools/build-reader.ts && tsx tools/build-transfer.ts"` und
  `"build:transfer"`. Turbo cacht `.next/**` bereits.
- Ein gemeinsamer Kern `tools/transfer/cli.ts` (`transferCli`) bedient Dev und Ops: Aufruf, Exit-Codes, Ausgabe,
  Bericht, und nach einem echten, gespeicherten Lauf zuerst die Datei `saved`. `tools/transfer.ts` (Dev) bleibt ein
  dünner Einstieg wie heute.
- `TreffsicherSource.markMoved` wird optional. Fehlt es, setzt `runTransfer` kein Merkmal und meldet
  `report.marked = "caller"`; `summaryLines` sagt dann „Merkmal setzt vereinsheim nach dem Lauf“. Dev mit
  `devTreffsicherSource` bleibt, wie es ist.

### Treffsicher als Quelle auf dem VPS

- `treffsicher-account.sql` bleibt unverändert und läuft über den Host per stdin, mit `-v from=<E-Mail>`.
- Neu sind vier SQL-Dateien:
  - `treffsicher-owners.sql`: alle `id|userId` aus `TrainingSession`, `Goal` und `ShotRoutine`, nur Kennungen;
    `sessionOwners` filtert daraus.
  - `treffsicher-mark.sql`: setzt `movedToSpiegelAt` auf `now() at time zone 'UTC'`, mit `-v clear=1` auf `NULL`, über
    `lower(btrim(email))` und `returning 1`. Das CLI verlangt genau eine Zeile.
  - `treffsicher-status.sql`: `sha256(lower(btrim(email)))|0/1` je Konto, ohne E-Mail.
  - `spiegel-status.sql`: `sha256(lower(btrim(email)))|Läufe|letzter Tag` aus `TransferRun`.
- `readAccount(email)` prüft `user.email` aus der Pipe gegen `--from` (beide `trim().toLowerCase()`). Passen sie nicht
  zusammen, wirft es (Exit 4). Eine leere Eingabe heißt kein Konto (`noSource`, Exit 3).

### Ops-CLI `vereinsheim transfer`

Eine Funktion `cmd_transfer` mit vier Formen. Lokal braucht jede Form `--local` (lokaler Stack, `local_compose`) oder
`--vps` (über `ssh`). Auf dem VPS gibt es keinen Schalter, dort gilt `docker compose` mit `.env`.

| Aufruf | Wirkung |
| --- | --- |
| `transfer --from <a> --to <b> [--dry-run] [--family "<N>=<K>"]… [--discipline "<N>=<D>"]… [--yes]` | ein Konto, Schritte 1 bis 5 |
| `transfer --mapping <datei> [--dry-run] [--family …]… [--discipline …]…` (nur lokal) | alle `ok`/`new`-Zeilen, je Zeile ein Konto |
| `transfer status --mapping <datei>` (nur lokal) | je Zeile übernommen oder offen, Konten außerhalb der Datei |
| `transfer mark --from <a> [--clear] [--yes]` | Merkmal setzen bzw. aufheben, etwa nach Exit 6 |

- **Vorprüfungen:**
  - `db` läuft.
  - Das Image hat `transfer.mjs`: `compose run --rm --no-deps --entrypoint sh transfer-spiegel -c 'test -f
    transfer.mjs'`. Fehlt es: „Image von Spiegel ohne Übernahme: erst release und deploy“.
  - `--from` und `--to` erfüllen `is_email`.
  - Ein echter Lauf fragt über `confirm`, außer mit `--yes`.
- **Arbeitsordner:**
  - `mkdir -p -m 700 "$TRANSFER_REPORTS"` (Vorgabe `$REPO_DIR/reports/tis-3b`, überschreibbar für stack-e2e);
  - `parent=$(mktemp -d "$TRANSFER_REPORTS/.lauf-XXXXXX")`, darin `w` mit `chmod 777`, denn der Container läuft als
    `nextjs` (1001); der Elternordner bleibt 700;
  - `trap 'rm -rf "$parent"' RETURN`.
- **Lauf:** `tcompose exec -T db psql -U postgres -d treffsicher -At -v ON_ERROR_STOP=1 -v "from=$from" <account.sql |
  tcompose run -T --rm --no-deps -v "$work:/transfer" transfer-spiegel "${tool_args[@]}"`. `rc` wird mit `|| rc=$?`
  gefangen. Ein Fehler von `psql` (`PIPESTATUS[0]`) ist Exit 4. Startet `run` den Dienst mit Profil nicht ohne
  `--profile ops`, setzt `tcompose` es.
- **Danach:**
  - jede `$work/*.md` mit `install -m 600` nach `$TRANSFER_REPORTS/` und Pfad ausgeben;
  - bei echtem Lauf und vorhandener `$work/saved` das Merkmal setzen. Scheitert das: „Übernahme gespeichert, Merkmal in
    Treffsicher nicht gesetzt. Nachholen: vereinsheim transfer mark --from <E-Mail in Treffsicher>“ (nur der Platzhalter,
    keine echte E-Mail), Exit 6.
  - Ohne `saved` setzt das CLI nie ein Merkmal, auch nicht bei Exit 0 oder 1 eines alten Images.
- **Meldungen** (`transfer_exit_text`):

  | Code | Meldung |
  | --- | --- |
  | 0 | „Übernommen, Prüfbestand ohne Befund“ (Probelauf: „Probelauf ohne Befund, nichts geschrieben“) |
  | 1 | „Übernommen, Prüfbestand mit Befund: Bericht lesen“ |
  | 2 | „Aufruf falsch“ |
  | 3 | „Abgebrochen vor dem Schreiben, nichts geändert“ |
  | 4 | „Fehler, nichts geschrieben“ |
  | 5 | „Gespeichert, aber Ausgabe oder Bericht fehlt“ |
  | 6 | „Gespeichert, Merkmal fehlt“ |
  | 137 | „Speichergrenze des Containers erreicht“, ohne `saved`: nichts geschrieben |
  | sonst | „Container endete mit Code N“, das CLI gibt 4 zurück |

  Mit `saved` gilt immer „gespeichert“ (Code 5, falls der Container anders endete).
- **`--vps` vom Mac:** `ssh -n "$VPS_HOST" "cd $VPS_REPO_PATH && ./scripts/vereinsheim transfer --yes $(printf '%q '
  "${args[@]}")"`. `%q` schützt `--family "LP Training=lp"`; `cmd_remote` mit `$*` reicht dafür nicht. `ssh -n`
  verhindert, dass der Aufruf die Zeilen der Schleife liest. ssh gibt den Exit-Code des VPS zurück, 255 heißt
  Verbindungsfehler. Vorher prüfen, dass die Login-Shell auf dem VPS bash ist (`ssh "$VPS_HOST" 'echo $0'`); sonst den
  Befehl über `bash -c` mit stdin übergeben.
- **`--mapping`:**
  - `pnpm --dir apps/spiegel exec tsx tools/transfer-mapping.ts plan <datei>` gibt Zeilen `line<TAB>from<TAB>to<TAB>hash8`
    aus, Ablehnungen gehen auf stderr. Exit 3 bei einem Widerspruch, Exit 2 bei einem Formatfehler.
  - Das CLI liest die Zeilen mit `mapfile`, nennt die Zahl und fragt einmal.
  - Mit `--vps` und echtem Lauf läuft zuerst `ssh -n … ./scripts/vereinsheim backup` (Abschalten mit `SKIP_BACKUP=1`).
  - Dann je Zeile ein Konto, mit `--vps` über ssh, mit `--local` über `( cmd_transfer --local --yes … )` in einer
    Subshell. `--family` und `--discipline` gehen an jede Zeile.
  - Bei Exit 2 oder 255 hält die Schleife an, sonst geht sie weiter.
  - Am Ende eine Übersicht `Zeile <n>  <hash8>  Exit <c>  <Text>` und Exit 0 nur, wenn alle Zeilen 0 sind, sonst 1.
- **`status`:** holt `treffsicher-status.sql` und `spiegel-status.sql` über `ssh "$VPS_HOST" "cd … && docker compose
  exec -T db psql -U postgres -d <db> -At -v ON_ERROR_STOP=1" <sql` (wie `accounts.sh prod`) bzw. über `local_compose`
  in einen `mktemp`-Ordner auf dem Mac; dann `tsx tools/transfer-mapping.ts status <datei> <ts.txt> <sp.txt>`. Über den
  Draht gehen keine E-Mails.
- `help` bekommt einen Abschnitt „ÜBERNAHME AUS TREFFSICHER“, `main` die Zeile `transfer) cmd_transfer "$@" ;;`. Das
  interaktive Menü bleibt unverändert.

### Regeln der Zuordnungsdatei (`tools/transfer/mapping.ts`, rein)

- E-Mails werden über `normalizeEmail` verglichen.
- **Abbruch der ganzen Datei:** dasselbe `from` mit verschiedenem `to` unter `ok`/`new`, oder dasselbe `to` mit
  verschiedenem `from` unter `ok`/`new`. Die Meldung nennt die Zeilen und die Hashes.
- **Abgelehnt, nicht übernommen:** eine `check`-Zeile (`check`), und jede `ok`/`new`-Zeile eines `from`, zu dem noch eine
  `check`-Zeile steht (`checkPending`).
- Gleiche Zeilen (gleiches `from` und gleiches `to`) laufen einmal, unter der ersten Zeilennummer.
- Die Zeilennummern liefert `parseMappingCsvLines` (neu in `accountMatch.ts`); `parseMappingCsv` bildet darüber ab.
- **`status`** je Zeile, verbunden über `sha256(lower(trim(email)))`:

  | Zustand | Bedingung |
  | --- | --- |
  | `übernommen` | Läufe > 0 und Merkmal gesetzt |
  | `Merkmal fehlt` | Läufe > 0, kein Merkmal (→ `transfer mark`) |
  | `Merkmal ohne Lauf` | Merkmal ohne Lauf im Ziel |
  | `offen` | weder Lauf noch Merkmal |
  | `zu prüfen` | `check` oder `checkPending` |
  | `fehlt in Treffsicher` | kein Konto mit diesem Hash in Treffsicher |

  Dazu Summen je Zustand und die Zeile „Konten in Treffsicher, die nicht in der Datei stehen: N“.
- `accountHash(email)` (8 Hex-Zeichen) und `emailHash(email)` (64 Hex-Zeichen) stehen in
  `tools/transfer/account-hash.ts`, mit derselben Normalisierung wie in SQL (`lower(btrim())`). Der Name des Berichts
  in `cli.ts` nimmt `accountHash`.

### Offene Punkte aus 3a

- **(a) Zwei Ausdrucke an einer übernommenen Scheibe:**
  - Neu ist die reine Funktion `fitsEnteredTotal(reading, totals)` in `src/lib/printouts/values.ts`. Nach
    `scoringReading` braucht die Lesung ein Gesamtergebnis und dieselbe Schusszahl wie `totals.totalShots`. Das Ergebnis
    muss in Zehnteln gleich sein, wenn `totalDecimalTenths` gesetzt ist, sonst in Ringen. Ohne beides passt nichts.
  - `applyPrintoutValues` lädt die jüngste Revision mit `reason: "treffsicher"` (`revisions: { where: { reason:
    "treffsicher" }, orderBy: { number: "desc" }, take: 1, select: { totalRings, totalDecimalTenths, totalShots } }`).
  - Gibt es sie, nimmt `readingOrder` nur Ausdrucke, deren Lesung dazu passt. Passt keiner, bleibt die Scheibe, wie sie
    ist: kein `write({})`, Rückgabe `"none"`.
- **(b) `kindChoice`:** `writeTransferCard` (`src/lib/transfer/write.ts`) setzt nach `writeEnteredCardIn` mit `saved`
  und `change` gleich `revised` oder `unchanged` per `tx.card.update({ where: { id }, data: { kind, kindChoice: kind }
  })`, wenn `kind` oder `kindChoice` abweichen. Der Zweig läuft nur für unveränderte oder nie platzierte Scheiben
  (`cardIsUnchanged`); eine eigene Wahl des Schützen bleibt. `recordCard` verzeichnet danach den neuen `cardState`.
- **(c)** deckt die Übung unter „Verification“ ab.

### Speicher

`transfer-spiegel` bekommt `mem_limit: 320m` und Heap 160, wie `app-spiegel`. Der Leser läuft als Kindprozess mit
eigener Grenze. Auf dem VPS kommt der Container nur für die Dauer eines Laufs dazu, also eine ruhige Zeit wählen.
Gemessen wird die Spitze in der Übung (`Speicher: Spitze`) und für [[vps-resource-sizing]] notiert.

## Dateien

| Datei | Änderung |
| --- | --- |
| `apps/spiegel/src/parts/transfer/source.ts` | `markMoved` optional, Kommentar |
| `apps/spiegel/src/parts/transfer/run.ts` | ohne `markMoved` kein Merkmal, `marked: "caller"` |
| `apps/spiegel/src/parts/transfer/run.test.ts` | Fall „Quelle ohne markMoved“, Art bei zweitem Lauf |
| `apps/spiegel/tools/transfer/report.ts` | Zeile „Treffsicher:“ für `caller` |
| `apps/spiegel/tools/transfer/account-hash.ts` (+ `.test.ts`) | `emailHash`, `accountHash`; Test gegen sha256 in Postgres |
| `apps/spiegel/tools/transfer/cli.ts` | gemeinsamer Kern `transferCli`, Exit-Codes, Bericht, `saved` |
| `apps/spiegel/tools/transfer.ts` | dünner Dev-Einstieg über `transferCli` |
| `apps/spiegel/tools/transfer-ops.ts` | Einstieg für den Container, Quelle stdin und `owners.txt` |
| `apps/spiegel/tools/transfer/source-export.ts` (+ `.test.ts`) | `exportTreffsicherSource`, `parseOwners` |
| `apps/spiegel/tools/transfer/files.ts` (+ `.test.ts`) | `filesIn(root)`, `filesUnder` darüber |
| `apps/spiegel/tools/transfer/mapping.ts` (+ `.test.ts`) | `planMapping`, `statusRows`, Parser der Status-Zeilen |
| `apps/spiegel/tools/transfer-mapping.ts` | Mac-CLI `plan` und `status` |
| `apps/spiegel/src/lib/transfer/accountMatch.ts` (+ Test) | `parseMappingCsvLines` mit Zeilennummer |
| `apps/spiegel/tools/transfer/treffsicher-owners.sql` | neu: `id\|userId` |
| `apps/spiegel/tools/transfer/treffsicher-mark.sql` | neu: Merkmal setzen oder aufheben |
| `apps/spiegel/tools/transfer/treffsicher-status.sql` | neu: Hash und Merkmal je Konto |
| `apps/spiegel/tools/transfer/spiegel-status.sql` | neu: Hash, Läufe, letzter Tag |
| `apps/spiegel/tools/build-transfer.ts` | Bündel `transfer.mjs` nach `next build` |
| `apps/spiegel/tools/transfer/bundle.test.ts` | Bündel bauen, ohne Argumente Exit 2, Probelauf gegen Dev-DB |
| `apps/spiegel/package.json` | `build`, `build:transfer` |
| `apps/spiegel/src/lib/printouts/values.ts` (+ Test) | `fitsEnteredTotal` |
| `apps/spiegel/src/lib/printouts/apply.ts` (+ `apply.test.ts`) | übernommene Scheibe: nur passende Ausdrucke |
| `apps/spiegel/src/lib/transfer/write.ts` (+ `write.test.ts`) | Art neu setzen |
| `compose.yml` | Dienst `transfer-spiegel` (Profil `ops`), **Deploy-Vertrag** |
| `compose.local.yml` | `transfer-spiegel: pull_policy: missing` |
| `scripts/vereinsheim` | `cmd_transfer`, Hilfe, Dispatch, **geschützt** |
| `vault/spiegel/spiegel-account-transfer.md` | Abschnitt „Betrieb“, Fallstrick (a) gelöst |
| `vault/operations/operations.md` | Abschnitt „Übernahme aus Treffsicher“ |
| `vault/operations/vps-resource-sizing.md` | Wegwerf-Container, gemessene Spitze |
| `apps/spiegel/CLAUDE.md`, `CLAUDE.md` | Befehle bzw. Tabelle Bedienkonzept |
| optional: `tools/stack-e2e/transfer.sh`, `run.sh`, `compose.e2e.yml`, `README.md` | Fall `--transfer` |

## Required Docs

- `CLAUDE.md`, `apps/spiegel/CLAUDE.md` (Werkzeuge: `process.stdout.write`, CommonJS unter tsx, kein `await` auf
  oberster Ebene; Tests gegen die Dev-DB), `vault/conventions.md`
- [[adr-033]] (Nachtrag 3a), [[adr-002]], [[adr-029]], [[adr-023]] (geschützte Pfade)
- `vault/spiegel/spiegel-account-transfer.md`, `vault/apps/treffsicher/treffsicher-read-only.md`
- `vault/operations/operations.md`, `vault/operations/vps-resource-sizing.md`
- `tools/stack-e2e/README.md`, `apps/spiegel/scripts/transfer/accounts.sh` (Muster für ssh mit stdin),
  `apps/spiegel/tools/build-reader.ts` (Muster für das Bündel)

## Aufgaben

Jede Aufgabe ist ein Commit (außer 0). Gate ist `pnpm check`. Schritte mit **[geschützt]** laufen ohne Autopilot-Marker.

0. **Beweis: Prisma im Bündel.** Ein Wegwerf-Skript (nicht committen) mit `createPrismaClient(process.env.DATABASE_URL)`
   und `await db.user.count()` mit den Optionen aus „Bündel und Image“ bündeln, nach
   `.next/standalone/apps/spiegel/` legen, lokal mit `node` gegen die Dev-DB starten, dann im echten Image
   (`./scripts/vereinsheim local-build`, `docker run --rm --network <data-Netz des lokalen Stacks> -e DATABASE_URL=…
   -v <bündel>:/app/apps/spiegel/probe.mjs --entrypoint node <image> apps/spiegel/probe.mjs`). Erwartet: eine Zahl.
   Scheitert es, anhalten und der koordinierenden Session die Fehlermeldung und die gesehenen Wege melden.
1. **`markMoved` optional.** In `source.ts` wird es `markMoved?(…)`. In `run.ts` ruft `write` es nur auf, wenn es
   vorhanden ist; zurückgesetzt wird nur dann. `TransferReport.marked` wird `"set" | "dryRun" | "caller"`;
   `blankReport` setzt `caller`, wenn die Methode fehlt und kein Probelauf ist. Test in `run.test.ts`: eine Quelle ohne
   `markMoved` bei echtem Lauf ergibt `marked: "caller"` und schreibt `TransferRun`.
2. **Ausgabe.** `summaryLines` in `report.ts`: `caller` → „Treffsicher: Merkmal setzt vereinsheim nach dem Lauf“. `tsc`
   prüft den erschöpfenden `switch`.
3. **Hash.** `tools/transfer/account-hash.ts` mit `emailHash` (sha256 hex über `trim().toLowerCase()`) und `accountHash`
   (die ersten 8 Zeichen). Test: Groß- und Kleinschreibung sowie Rand ergeben denselben Wert, Länge 8; über
   `createPrismaClient(DEV_DATABASE_URL).$queryRaw` ist `encode(sha256(convert_to(lower(btrim(' A@Example.com
   ')),'UTF8')),'hex')` gleich `emailHash`.
4. **Dateien.** `files.ts`: `filesIn(root)` (realpath, `inside`-Prüfung je Datei) und `filesUnder(dir, privateRoot)` =
   Prüfung + `filesIn`. In `files.test.ts` deckt ein Fall `filesIn` direkt ab (auch Link nach draußen und `..`).
5. **Kern `cli.ts`.** Die Logik aus `tools/transfer.ts` wandert nach `transferCli(argv, setup: { call: string; source:
   TreffsicherSource; files(args: TransferArgs): Promise<AttachmentFiles | null>; databaseUrl: string; reportDir:
   string; savedFile: string | null; memoryLine: boolean }): Promise<number>`. Nach `outcome.kind === "done"` und ohne
   Probelauf schreibt der Kern zuerst `savedFile` (leere Datei); scheitert das, geht es in den Pfad von Exit 5. Der Name
   des Berichts kommt über `accountHash`. `tools/transfer.ts` wird zu `main(): process.exitCode = await transferCli(…)`
   mit `assertDevDatabase`, `devTreffsicherSource`, `filesUnder(…, tools/private)`, `reports/tis-3a` und `savedFile:
   null`. Prüfung: Dev-Probelauf für das Konto des Users mit `--dry-run --files …`, Exit 0, Ausgabe wie vorher.
6. **Quelle aus der Pipe.** `tools/transfer/source-export.ts`:
   - `parseOwners(text)` nimmt Zeilen `id|userId`; jede Seite muss `^[A-Za-z0-9_-]{1,40}$` erfüllen, sonst wirft es mit
     Zeilennummer; leere Zeilen werden übersprungen.
   - `exportTreffsicherSource({ account: string; owners: string })` ohne `markMoved`. `readAccount(email)` liefert bei
     leerem Text `null`, sonst `JSON.parse`; passt `user.email` normalisiert nicht zu `email`, wirft es „Export passt
     nicht zur E-Mail“. `sessionOwners(ids)` filtert die Map.

   Tests: leer → `null`; fremde E-Mail wirft; Owners mit Leerzeile; ungültige Kennung wirft.
7. **Einstieg `tools/transfer-ops.ts`.** Liest stdin vollständig (`for await (const chunk of process.stdin)`), dazu
   `owners.txt` aus `process.env.TRANSFER_DIR`. `--files` → stderr „--files gibt es nur in Dev; im Container kommen die
   Dateien aus dem Volume“, Exit 2. Fehlt `TRANSFER_DIR`, `TRANSFER_FILES` oder `DATABASE_URL`: Exit 2 mit Namen der
   Variable. `files: () => filesIn(TRANSFER_FILES)`, `reportDir: TRANSFER_DIR`, `savedFile: join(TRANSFER_DIR,
   "saved")`, `memoryLine: true`. `main().catch(…)` mit Exit 4. Prüfung: ohne Umgebung Exit 2.
8. **Speicherzeile.** In `cli.ts` bei `memoryLine` nach der Ausgabe `Speicher: Spitze ${Math.round(
   process.resourceUsage().maxRSS / 1024)} MiB`. Geprüft über Aufgabe 9.
9. **Bündel.** `tools/build-transfer.ts` mit `transferBuildOptions(outfile)` und `main()` wie `build-reader.ts`; dazu
   `package.json`. Test `tools/transfer/bundle.test.ts` (Timeout 60 s):
   - bauen nach `mkdtemp`;
   - `node transfer.mjs` ohne Argumente ergibt Exit 2;
   - mit `TRANSFER_DIR` (leere `owners.txt`), `TRANSFER_FILES` (leerer Ordner) und `DATABASE_URL` der Dev-DB, auf stdin
     ein erfundenes Konto (`user.email` `bundle@example.invalid`, keine Einheiten, Form nach `treffsicher-export.ts`),
     mit `--from`/`--to bundle@example.invalid --dry-run`: Exit 0, stdout enthält „Probelauf, nichts geschrieben“ und
     „Speicher: Spitze“, kein `saved`.

   Prüfung auch `pnpm --filter spiegel build` → `ls .next/standalone/apps/spiegel/transfer.mjs`.
10. **SQL-Dateien.** Die vier Dateien aus „Treffsicher als Quelle“ mit Kopfkommentar (was, nur Kennungen bzw. Hashes).
    Prüfung gegen die Dev-DB: `docker compose -f docker-compose.dev.yml exec -T db psql -U postgres -d treffsicher -At
    <apps/spiegel/tools/transfer/treffsicher-status.sql | head -1` gibt `<64 hex>|0` oder `|1` aus; dasselbe für
    `spiegel-status.sql` (Datenbank `spiegel`) und `treffsicher-owners.sql`. `treffsicher-mark.sql` mit `-v
    from=nobody@example.invalid -v clear=0` liefert keine Zeile.
11. **Zeilennummern.** `parseMappingCsvLines(csv): (MappingRow & { line: number })[]` in `accountMatch.ts`;
    `parseMappingCsv` = `.map(({ line, ...row }) => row)`. Test: Zeile 2 und 3 tragen 2 und 3; die bisherigen Tests
    bleiben grün.
12. **Regeln der Datei.** `tools/transfer/mapping.ts`, `planMapping(rows)` → `{ kind: "ok"; runs: { line; from; to;
    hash }[]; rejected: { line; hash; reason: "check" | "checkPending" }[] } | { kind: "conflict"; fromConflicts:
    number[][]; toConflicts: number[][] }`. Tests: nur `ok`/`new` laufen; `check` abgelehnt; `ok` neben `check`
    desselben `from` → `checkPending`; `from` mit zwei `to` → Konflikt mit beiden Zeilen; zwei `from` auf ein `to` →
    Konflikt; doppelte gleiche Zeile läuft einmal; Groß- und Kleinschreibung zählt als gleich.
13. **Status.** In `mapping.ts`: `parseTreffsicherStatus(text)` → `Map<hash64, { moved: boolean }>`;
    `parseSpiegelStatus(text)` → `Map<hash64, { runs: number; last: string | null }>` (ungültige Zeile wirft);
    `statusRows(rows, ts, sp)` → je Zeile `{ line, hash, state }`; `outsideMapping(ts, rows)` → Zahl. Tests je Zustand
    und für „nicht in der Datei“.
14. **Mac-CLI `tools/transfer-mapping.ts`.** `plan <datei>`: TSV auf stdout, Ablehnungen als `Zeile <n> (<hash>):
    <Grund>` auf stderr; Konflikt → Exit 3 mit Zeilen und Hashes; Formatfehler → Exit 2. `status <datei> <ts> <sp>`:
    Tabelle und Summen, nur Zeile, Hash und Zustand. `main().catch`. Prüfung: eine erfundene CSV unter `$TMPDIR`
    (Adressen `@example.invalid`) liefert mit `plan` die erwarteten Zeilen und Exit 0.
15. **(a) Fit-Regel.** `fitsEnteredTotal` in `values.ts` mit Tests: Zehntel gleich passt; Ringe gleich, aber Zehntel
    gesetzt und verschieden passt nicht; andere Schusszahl passt nicht; ein Ausdruck im Modus Probe mit passender Summe
    passt; ohne Gesamtergebnis passt nichts.
16. **(a) `applyPrintoutValues`.** Die Revision `treffsicher` laden, die Ausdrucke filtern, ohne passenden kein leeres
    `write`. Test in `apply.test.ts` an einer Scheibe mit `importKey` `treffsicher:…`, Revision 1 aus Treffsicher
    (`writeTransferCard`) und zwei Ausdrucken: der passende älter, der fremde jünger gedruckt → die Werte des passenden;
    nur der fremde → `"none"`, die aktuelle Revision unverändert. Gegenprobe: ohne Filter wird der Test rot.
17. **(b) Art.** `writeTransferCard` setzt `kind`/`kindChoice` bei `revised`/`unchanged`. Test in `write.test.ts`: erst
    `training`, dann `competition` über denselben `importKey` → `kindChoice` gleich `competition`. Test in `run.test.ts`:
    die Einheit wechselt zwischen zwei Läufen von `TRAINING` auf `WETTKAMPF` → die Scheibe ist danach `competition`, ein
    dritter Lauf zählt sie als `unchanged`; eine Scheibe mit eigener Wahl des Schützen bleibt.
18. **[geschützt] `compose.yml`.** Dienst `transfer-spiegel` nach `app-spiegel`, mit einer Kommentarzeile, was er ist und
    dass ihn nur `vereinsheim transfer` startet:
    - `image: ${DOCKER_USER}/spiegel:${SPIEGEL_TAG:-latest}`, `profiles: [ops]`, `restart: "no"`, `pull_policy:
      missing`;
    - `working_dir: /app/apps/spiegel`, `entrypoint: ["node", "transfer.mjs"]`;
    - `environment`: `DATABASE_URL` (Spiegel), `UPLOAD_DIR: /app/uploads`, `TRANSFER_DIR: /transfer`, `TRANSFER_FILES:
      /treffsicher-uploads`, `NODE_OPTIONS: --max-old-space-size=160`;
    - `volumes`: `uploads_spiegel:/app/uploads`, `uploads_treffsicher:/treffsicher-uploads:ro`;
    - `mem_limit: 320m`, `logging: *default-logging`, `networks: [data]`.

    `compose.local.yml`: `transfer-spiegel: pull_policy: missing`. Prüfung: `docker compose --env-file .env.example
    config --quiet`, dasselbe mit `-f compose.yml -f compose.local.yml`, und `config --services` ohne
    `transfer-spiegel`, mit `--profile ops` mit.
19. **[geschützt] `cmd_transfer`, Gerüst.** Argumente `--from`, `--to`, `--dry-run`, `--family`/`--discipline` (Arrays),
    `--yes`, `--local`, `--vps`, `--mapping`, Unterbefehle `status` und `mark`; Regeln zu Modus und Schaltern wie im
    Ansatz. `tcompose()` = `local_compose` oder `docker compose`; `transfer_exit_text <code> <dry>`;
    `TRANSFER_REPORTS="${TRANSFER_REPORTS:-$REPO_DIR/reports/tis-3b}"`; Dispatch und Hilfe. Prüfung: `bash -n
    scripts/vereinsheim`, `shellcheck` (wenn vorhanden), `./scripts/vereinsheim help | grep -A6 ÜBERNAHME`, ein Aufruf
    ohne Argumente ergibt Exit 2.
20. **[geschützt] Ein Konto.** Vorprüfung mit Image-Test, Arbeitsordner, `owners.txt`, Pipe und `run`, Bericht kopieren,
    Merkmal nur mit `saved` und ohne Probelauf, Meldungen, Exit 6. Prüfung lokal: nach `local-build` und `local-up
    --restore` läuft `./scripts/vereinsheim transfer --local --dry-run --from <eigene E-Mail> --to <eigene E-Mail>` mit
    Exit 0 (oder 3 mit bekanntem Grund aus 3a), der Bericht liegt unter `reports/tis-3b/` mit Modus 600, `.lauf-*` ist
    weg, und `movedToSpiegelAt` ist unverändert.
21. **[geschützt] `transfer mark`.** `--from`, `--clear`, `--yes`, `--local`/`--vps` (über `%q`-ssh). Prüfung lokal:
    `mark --local --from <eigene> --yes` und `--clear` setzen bzw. löschen die Spalte; ein unbekanntes Konto ergibt
    „Kein Konto in Treffsicher“ und Exit 3.
22. **[geschützt] `--mapping`.** `plan` über tsx, `mapfile`, eine Frage, Backup vor einem echten Lauf über `--vps`,
    Schleife, Stopp bei 2 oder 255, Übersicht. Prüfung: eine erfundene CSV, deren Konten es nicht gibt, ergibt mit
    `transfer --mapping <tmp.csv> --local --dry-run` je Zeile Exit 3 („Kein Konto in Treffsicher“), die Übersicht zeigt
    nur Hashes.
23. **[geschützt] `status`.** Abfragen über `tcompose` bzw. ssh, Temp-Ordner auf dem Mac mit `trap`, dann tsx. Prüfung:
    `transfer status --mapping <Zuordnungsdatei> --local` zeigt je Zeile einen Zustand und die Zahl „nicht in der Datei“.
24. **Doku.**
    - `spiegel-account-transfer.md`: Abschnitt „Betrieb auf dem VPS“ mit Befehlen, Container, Pipe, Merkmal nach dem
      Commit, Exit 6, `reports/tis-3b/`; Fallstrick (a) als gelöst; `kindChoice`.
    - `operations.md`: Abschnitt „Übernahme aus Treffsicher“ mit dem Ablauf in Prod: `git pull` auf dem VPS (sonst
      fehlen `compose.yml`, CLI und SQL-Dateien), Release, Deploy, Probelauf über die Datei, erst das Konto des Users,
      dann die übrigen.
    - `vps-resource-sizing.md`: Wegwerf-Container mit 320 MB und die gemessene Spitze.
    - `apps/spiegel/CLAUDE.md`: Befehle (`build:transfer`, `transfer-ops`, `transfer-mapping`).
    - Root `CLAUDE.md`: `transfer` in der Tabelle Bedienkonzept, in beiden Modi.

    `/sync-graph`. Den Text des Nachtrags 3b zu ADR-033 an die koordinierende Session melden, nicht selbst eintragen:
    Zuordnung je Konto über eine geprüfte Datei statt nur gleiche E-Mail, lesend je Konto, das Merkmal setzt der Betrieb
    nach dem Commit, die Treffsicher-DB liest nur der Host.
25. **Übung gegen die Prod-Kopie** (siehe Verification). Vorher fragt die Kindsession die koordinierende Session nach der
    geprüften Zuordnungsdatei (der User entscheidet die `check`-Zeilen) und nach dem Signal für den lokalen Stack. Das
    Ergebnis geht nur mit Zahlen nach `reports/tis-3b/uebung.md`. Was die Übung findet, fixt die Session vor dem Merge,
    oder sie meldet es.
26. *Optional* **[geschützt] stack-e2e `--transfer`:** `tools/stack-e2e/transfer.sh`, aufgerufen aus `run.sh
    --transfer`, mit `transfer-spiegel: pull_policy: never` in `compose.e2e.yml`. `psql` legt in Treffsicher ein
    erfundenes Konto `e2e@example.invalid` an (Passwort-Hash aus `bcryptjs` im Skript) und eine Einheit `TRAINING` ohne
    Disziplin mit `trainingGoal`. `TRANSFER_REPORTS=$WORK`. Probelauf → Exit 0, kein Merkmal; echter Lauf → Exit 0,
    `TransferRun` 1, Merkmal gesetzt, Bericht vorhanden; zweiter Lauf → Exit 0, `TransferRun` 2; `mark --clear` →
    `NULL`; unbekanntes Konto → Exit 3; die Spitze ins Protokoll. Läuft `runTransfer` ohne `Site` nicht, legt das Skript
    eine Anlage über `psql` an. README-Zeile.

## Tests

- **Rein (vitest):** `mapping.test.ts` (Regeln und Status), `source-export.test.ts` (Pipe und Owners), `args.test.ts`
  (unverändert; `--files` lehnt nur der Ops-Einstieg ab, Test über `transferCli` mit Fake-Setup: Exit 2),
  `account-hash.test.ts`, `values.test.ts` (`fitsEnteredTotal`), `accountMatch.test.ts` (Zeilennummern).
- **Gegen die Dev-DB:** `run.test.ts` (Quelle ohne `markMoved`, Art bei zweitem Lauf), `apply.test.ts` (zwei
  Ausdrucke), `write.test.ts` (Art), `account-hash.test.ts` (sha256 in Postgres), `bundle.test.ts` (Bündel, Probelauf).
- **Mutationsproben** für (a) und (b) und die Regeln der Datei: den Kern testweise vereinfachen, der passende Test wird
  rot (Backup per `cp`).
- **Skripte:** `bash -n scripts/vereinsheim`; die Prüfungen der Aufgaben 19 bis 23 am lokalen Stack.
- **Optional:** `tools/stack-e2e/run.sh --transfer` (Aufgabe 26).

## Verification

1. `bash -n scripts/vereinsheim` (und `shellcheck`, wenn installiert).
2. `docker compose --env-file .env.example config --quiet`, dasselbe mit `-f compose.local.yml`; `config --services`
   ohne und mit `--profile ops` wie in Aufgabe 18.
3. `git diff feat/treffsicher-in-spiegel... -- Caddyfile Dockerfile` ist leer.
4. Gate `pnpm check` grün, die Tests oben eingeschlossen.
5. Stack mit den echten Images: `tools/stack-e2e/run.sh --ops` grün (das neue Profil stört Deploy, Backup, Restore und
   Rollback nicht). Mit Aufgabe 26 zusätzlich `--transfer`.
6. **Übung gegen die Prod-Kopie, alle Zeilen der Zuordnung** (lokaler Stack, Images vom Branch, nur auf Signal):
   1. `./scripts/vereinsheim local-pull`, dann `local-build`, dann `local-up --restore`.
   2. `transfer status --mapping <Zuordnungsdatei> --local`: alle `ok`/`new` stehen auf `offen`.
   3. `transfer --mapping … --local --dry-run` mit den aus 3a bekannten `--family`/`--discipline`; Exit je Zeile.
   4. `transfer --mapping … --local` (echt); Exit je Zeile; die `check`-Zeilen nach Entscheidung des Users einzeln.
   5. `transfer status … --local`: jede gelaufene Zeile `übernommen`.
   6. Noch einmal `transfer --mapping … --local`: jede Zeile Exit 0, im Bericht nur `unverändert`, kein `angelegt`.
   7. Stichprobe in der App des lokalen Stacks: ein umgezogenes Konto in Treffsicher nur lesend, die Scheiben in Spiegel
      da (der User meldet sich selbst an).
   8. `Speicher: Spitze` des größten Kontos und die Exit-Codes je Zeile (Zeile, Hash, Code, Spitze in MiB) nach
      `reports/tis-3b/uebung.md` und in die Rückmeldung an die koordinierende Session. Nur Zahlen.
7. Prod ist nicht Teil von 3b. Erst nach Merge und Deploy des Basisbranchs, durch den User, nach dem Ablauf in
   `operations.md`.
