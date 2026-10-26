# 1b-1 · Ausdruck holen und speichern

Teil 1b-1 aus [`2026-10-26-treffsicher-in-spiegel.md`](2026-10-26-treffsicher-in-spiegel.md) (Stufe 1, QR-Weg SP-1.7 b).
Branch `feat/tis-1b1-printouts`, abgezweigt von `main` (Stufe 1 geht Teil für Teil nach `main`); diesen Plan als ersten
Commit übernehmen (`git show feat/treffsicher-in-spiegel:plans/2026-10-26-tis-1b1-printouts.md`). **Interaktiv, nicht
autonom:** Der Plan berührt geschützte Pfade (Schema und Migration, `compose.yml`, `scripts/`, `vault/decisions/`);
diese Tasks sind mit **[geschützt]** markiert, die Kindsession holt dort die Freigabe über die koordinierende Session.

## Context

Der QR-Weg soll einen Meyton-Ausdruck holen (Link aus dem QR oder hochgeladenes PDF), sofort als Original speichern,
daraus ID und Druckzeit lesen und daraus einen Auftrag wie „Scheibe per ID“ machen (entschieden mit dem User am
26. Oktober 2026, Koordinationsplan Stufe 1 → 1b). 1b-1 liefert nur die Bausteine auf dem Server, ohne Oberfläche. 1b-2
(„Scannen“) setzt sie zusammen: `/scan`, Auftrag mit Druckzeit, Prüfung der Druckzeit beim Einlesen, PDF an einer
vorhandenen Scheibe, Ausliefern an den Besitzer.

Drei Dinge machen das heikel:

- **Fremde PDFs sind gefährlich für den Prozess** (SF-48, [[meyton-printout]] „Grenzen“): Ein 3-KB-PDF brachte pdf.js
  auf 294 MB, ein 128-KB-XMP auf 1,36 GB, eine Operator-Bombe lief 21 s. Die Grenzen in `readPrintout` greifen nur
  zwischen den Schritten von pdf.js. Spiegel hat 256 MB mit 160 MB Heap. Gelesen wird deshalb nur in einem
  kurzlebigen Kindprozess mit Speichergrenze, harter Abbruch nach `maxParseMs`, ein Lesevorgang zur Zeit. Ein
  Worker-Thread reicht nicht.
- **Der Kindprozess muss im Image existieren.** Das Image ist Next standalone (`node apps/spiegel/server.js`, `turbo
  prune`, Root-`Dockerfile`), und `@vereinsheim/meyton-pdf` ist TS-Quelltext ohne Build.
- **Dateien brauchen ein Volume samt Backup und Restore**, und Löschen muss die Dateien mitnehmen („Nicht meine“ und
  der Papierkorb entfernen Ausdrucke, [[spiegel-privacy]]).

Entschieden (nicht wieder aufmachen): keine Vorschau, keine Bestätigung; automatische Prüfung (selber Abend, erster
Schuss vor der Druckzeit) vor dem Speichern einer gelieferten Scheibe, sonst Ausgang „passt nicht zum Ausdruck“; die
Prüfung selbst baut 1b-2, 1b-1 nur das Schema. **Keine Liste erlaubter Adressen** (Restrisiko SSRF, SF-47 bleibt
offen); es bleiben Größengrenze, Zeitgrenze, nur PDF. Upload eines einzelnen PDFs als Alternative zum Scan.

Entschieden mit der Freigabe dieses Plans:

- **Ein Auftrag ohne Scheibe behält sein PDF**, solange der Auftrag steht. Entfernt der Schütze einen Auftrag mit
  „nicht gefunden“, geht das PDF mit. 1c macht aus solchen Aufträgen später Scheiben aus dem PDF; bis dahin sagt 1b-2
  beim Entfernen, dass der Ausdruck mitgeht.
- **Speicher:** Kindprozess mit 48 MB Heap, Abbruch über 96 MiB RSS, `mem_limit` von Spiegel bleibt 256m. Liegt
  `maxRssKb` eines echten Ausdrucks im Image über 80 MiB, meldet die Kindsession das, bevor 1b-2 live geht.

Die Dev-Datenbank ist eine Prod-Kopie: nie zurücksetzen, Migration über `prisma migrate diff` + `migrate deploy`.
Zur selben Zeit ändert höchstens eine Kindsession das Schema von Spiegel: Vor Task 2 bei der koordinierenden Session
nachfragen, ob gerade eine andere am Schema arbeitet.

## Approach

**Holen** (`fetchPrintout`): HTTP(S)-GET ohne Weiterleitungen (`redirect: "manual"`, jede 3xx ist ein Fehler),
höchstens 1 MiB (Content-Length vorab, dann beim Lesen des Stroms gezählt), 10 s Zeitgrenze für alles, Kopf `%PDF-`
in den ersten 1024 Bytes. Keine Liste erlaubter Adressen, kein Sperren privater Netze (entschieden). Antwort nach
außen nur als fester Grund, nie Status oder Inhalt der Gegenseite.

**Lesen im Kindprozess** (`readPrintoutIsolated`):

- Eigenes Skript `reader-child.ts`, gebündelt mit esbuild zu **einer** Datei `printout-reader.mjs` (bringt `unpdf` und
  pdf.js mit, 1,7 MB). Gebaut nach `next build` direkt nach `.next/standalone/apps/spiegel/printout-reader.mjs`. Damit
  fährt es mit dem bestehenden `COPY .next/standalone` ins Image: **keine Änderung am Dockerfile**. Turbo cacht es mit
  (`outputs: .next/**`). In Produktion ist das Arbeitsverzeichnis `/app/apps/spiegel`, weil `server.js` mit
  `process.chdir(__dirname)` dorthin wechselt.
- In Dev und Tests gibt es keinen Bundle. Dann startet der Kindprozess `src/lib/printouts/reader-child.ts` über
  `--import tsx` (devDependency). Ein eigener Test baut den Bundle mit denselben Optionen und liest damit.
- Start: `process.execPath --max-old-space-size=48 --max-semi-space-size=2 <bundle>`. Unter tsx 32 MB Heap mehr,
  weil der Lader selbst im Heap liegt. Umgebung nur `{ NODE_ENV }`: Kein `NODE_OPTIONS` (sonst gälten die 160 MB der
  App) und keine Geheimnisse (`DATABASE_URL`, `NEXTAUTH_SECRET`). `stdio`: `pipe`, `pipe`, `pipe`.
- Ablauf: Der Kindprozess setzt `/proc/self/oom_score_adj` auf 1000 (Linux; bei einer Speicherknappheit des
  Containers trifft der Kernel ihn vor der App). Dann lädt er Paket und pdf.js (`preloadPdfjs`) und meldet `ready`.
  Erst dann schickt die App die Bytes, und **ab da** läuft die harte Grenze von `maxParseMs` (5 s). Den Start begrenzen
  eigene 5 s. Ergebnis als eine JSON-Zeile mit `maxRssKb`.
- Abbruch: `SIGKILL` nach der Zeitgrenze. Unter Linux liest die App alle 50 ms `VmRSS` aus `/proc/<pid>/status` und
  beendet den Kindprozess über 96 MiB: `--max-old-space-size` begrenzt keine ArrayBuffer, pdf.js entpackt in
  Uint8Arrays. Ausgabe höchstens 64 KiB, sonst Abbruch. Speicherabbruch erkannt an `stderr` (die ersten 4 KiB,
  „heap limit“ / „out of memory“), sonst „abgestürzt“. Ins Log nur feste Codes und Zahlen.
- **Einer zur Zeit, höchstens drei warten**, sonst sofort `busy`. Die Warteschlange liegt an `globalThis`: Next kann
  ein Modul in mehreren Bündeln laden, und dann gäbe es mehrere Schlangen.
- Speicherbudget: App unter Last 147 bis 152 MiB, Kindprozess bis 96 MiB (Abbruch), Container 256 MiB. Reicht das
  einmal nicht, trifft der OOM-Killer wegen `oom_score_adj` den Kindprozess. `ops.sh` misst `maxRssKb` im echten Image.

**Speichern** (`storePrintout`, kein Datenbankzugriff): Größe, Kopf, sha256, Lesen im Kindprozess, ID (`found`, sonst
`noId`/`idConflict`), Druckzeit (`epochMs`, ohne Zeitzone die Wanduhr in der Zone der Anlage über `zonedWallTimeMs`,
ohne Datum `noTime`). Dann die Datei atomar nach `UPLOAD_DIR/printouts/<sha256>.pdf` (temporär schreiben, dann
`rename`; gleiche Bytes ergeben dieselbe Datei). Ergebnis als Union mit festem Grund. Nur wenn ID und Druckzeit
lesbar sind, entsteht eine Datei.

**Datenbank** (`queries.ts`): Die Zeile `Printout` entsteht erst in 1b-2, in derselben Transaktion wie der Auftrag.
Darum ist `storePrintout` frei von der Datenbank, und die Zeile entsteht über `attachPrintout(tx, file, target)`, mit
`target` = Scheibe oder Auftrag. Dazu `movePrintoutsToCard` (Auftrag → Scheibe, wenn die Brücke liefert, genutzt von
1b-2) und `printoutFile(db, printoutId, ownerId)` zum Lesen (Besitz über Scheibe oder Auftrag).

**Schema:** `Printout.cardId` optional, neu `requestId` (an `CardRequest`, `onDelete: Cascade`), genau eins von beiden
gesetzt (CHECK in der Migration), eindeutig `(requestId, sha256)` neben `(cardId, sha256)`, Index auf `sha256`.
`CardRequest.printedAt` (Druckzeit des Ausdrucks, aus dem der Auftrag entstand; null bei getippter ID).
`CardRequestStatus` neu `printMismatch` („passt nicht zum Ausdruck“, entfernbar wie die anderen Ausgänge ohne
Scheibe).

**Löschen:** Zeilen verschwinden auf vielen Wegen (`purgeCards` bei „Nicht meine“, Papierkorb und `purgeCardNow`,
`removeRequest`, Kaskaden über Konto und Anlage), und gleiche Bytes teilen sich eine Datei. Deshalb **ein Weg**:
`removeOrphanPrintoutFiles` löscht jede `<sha256>.pdf`, auf die keine Zeile mehr zeigt, älter als 10 Minuten (schützt
eine gerade geschriebene Datei, deren Zeile noch fehlt). Er löscht nie, wenn die Tabelle ganz leer ist und Dateien da
sind (Schutz gegen eine falsche oder leere Datenbank). Aufgerufen beim Start, stündlich (nach dem Papierkorb) und
gleich nach „Nicht meine“, `purgeCardNow` und dem Entfernen eines Auftrags.

**Volume:** `uploads_spiegel:/app/uploads` mit `UPLOAD_DIR=/app/uploads` wie bei Treffsicher. Das Root-`Dockerfile`
legt `/app/uploads` für jede App schon an (Besitzer `nextjs`), ein neues Named Volume übernimmt das. `UPLOAD_APPS`
bekommt `spiegel`; Backup, Restore, `download`, `local-up` laufen alle über die Liste. Das Testpaar in `ops.sh` dreht
sich um: Spiegel mit Uploads-Tar muss gehen, Ringwerk mit Tar nicht.

So setzt 1b-2 zusammen: Scan `fetchPrintout` → `storePrintout` → Transaktion: eigene Scheibe des Abends da →
`attachPrintout(tx, file, { cardId })`; sonst Auftrag mit `printedAt` anlegen → `attachPrintout(tx, file, {
requestId })`. Einlesen: Scheibe an den Auftrag → `movePrintoutsToCard`. Seite: `printoutFile`.

## Files

### Task 1 · `@vereinsheim/meyton-pdf`: Kopf, Fehlercodes, Vorladen, Test-PDFs

- `packages/meyton-pdf/src/header.ts` (neu, rein): `PDF_HEADER_WINDOW = 1024`, `hasPdfHeader(bytes)` (aus `printout.ts`
  verschoben, unverändert). `printout.ts` importiert es von dort.
- `packages/meyton-pdf/src/errors.ts`: `MEYTON_PDF_ERROR_CODES = ["tooLarge", "notPdf", "tooManyPages", "tooMuchText",
  "timeout", "unreadable"] as const`, Typ `MeytonPdfErrorCode`. Der Konstruktor bekommt `options?: { cause?: unknown;
  code?: MeytonPdfErrorCode }`, `readonly code` (Vorgabe `"unreadable"`).
- `packages/meyton-pdf/src/printout.ts`: jeder `throw new MeytonPdfError` mit passendem `code` (Größe → `tooLarge`, Kopf
  → `notPdf`, Seiten → `tooManyPages`, Text und Zeichen → `tooMuchText`, `checkTime` → `timeout`, sonst
  `unreadable`). Neu `export async function preloadPdfjs(): Promise<void> { await getResolvedPDFJS() }` (aus `unpdf`).
- `packages/meyton-pdf/src/__fixtures__/buildPdf.ts`: `TestPdf.rawPages?: Uint8Array[]` (fertige Inhaltsströme je Seite,
  statt Text; werden wie jetzt deflatet). Dazu `bombContent(kind: "memory" | "time", scale = 1): Uint8Array`:
  - `memory`: `BT /F1 8 Tf (` + 32 MiB × `A` · `scale` + `) Tj ET`. Der Lexer von pdf.js baut den String als Array
    einzelner Zeichen (rund 8 Byte je Zeichen).
  - `time`: `q Q\n` × 10 000 000 · `scale`.
  Kopfkommentar: erfundene Fälle, kein echter Ausdruck.
- `packages/meyton-pdf/package.json` exports: `"./header": "./src/header.ts"`, `"./test-pdf":
  "./src/__fixtures__/buildPdf.ts"` (nur für Tests und Werkzeuge).
- Tests: `printout.test.ts` prüft je Grenze zusätzlich `code` (`rejects.toMatchObject({ code: "notPdf" })` usw.).
  `header.test.ts` (neu) mit den Kopf-Fällen von Byte 1019/1020 und leerem Puffer. `printout.test.ts`: ein PDF mit
  `rawPages` liest die ID nicht (missing), eine Prüfung, dass `bombContent("memory")` deflatet unter 1 MiB bleibt.
- `packages/meyton-pdf/CLAUDE.md`: Exporte (`./header`, `./test-pdf`, `preloadPdfjs`, `code`). „Noch nutzt keine App das
  Paket“ ersetzen durch „Spiegel nutzt `printout-id` und liest `printout` nur im Kindprozess
  (`apps/spiegel/src/lib/printouts/reader.ts`)“.
- Commit: `feat(meyton-pdf): error codes, header check and pdf.js preload for the reader process`

### Task 2 · Schema und Migration **[geschützt]**

- `apps/spiegel/prisma/schema.prisma`:
  - `enum CardRequestStatus`: `printMismatch` nach `expired`; Kommentar über dem Enum um „passt nicht zum Ausdruck
    (Druckzeit)“ ergänzen.
  - `model CardRequest`: nach `day` neu
    `// Druckzeit des Ausdrucks, aus dem der Auftrag entstand (QR oder Upload); null bei getippter ID`
    `printedAt DateTime? @db.Timestamptz(3)`; nach `closedAt` `printouts Printout[]`.
  - `model Printout`: `cardId String?`, `card Card? @relation(…, onDelete: Cascade)`, neu `requestId Int?`, `request
    CardRequest? @relation(fields: [requestId], references: [id], onDelete: Cascade)`, `@@unique([requestId, sha256])`,
    `@@index([sha256])`. Kommentar: „an der Scheibe, sobald es sie gibt; bis dahin am Auftrag. Genau eins von beiden
    (CHECK `Printout_one_target` in der Migration). Die Datei liegt unter `UPLOAD_DIR/printouts/<sha256>.pdf`;
    `fileName` ist nur der Name zum Herunterladen.“
- Migration (aus dem Repo-Root):
  1. `pnpm --filter spiegel exec prisma migrate status`: erwartet „Database schema is up to date“ mit sieben
     Migrationen bis `20261024150000_card_request_expired`. Sonst anhalten und melden.
  2. `mkdir -p apps/spiegel/prisma/migrations/20261026120000_printout_request`
  3. `pnpm --filter spiegel exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
     > apps/spiegel/prisma/migrations/20261026120000_printout_request/migration.sql`
  4. Die Datei muss inhaltlich so aussehen (Reihenfolge von Prisma darf abweichen). Ans Ende von Hand:
     ```sql
     -- AlterEnum
     ALTER TYPE "CardRequestStatus" ADD VALUE 'printMismatch';
     -- AlterTable
     ALTER TABLE "CardRequest" ADD COLUMN "printedAt" TIMESTAMPTZ(3);
     -- AlterTable
     ALTER TABLE "Printout" ADD COLUMN "requestId" INTEGER, ALTER COLUMN "cardId" DROP NOT NULL;
     -- CreateIndex
     CREATE INDEX "Printout_sha256_idx" ON "Printout"("sha256");
     -- CreateIndex
     CREATE UNIQUE INDEX "Printout_requestId_sha256_key" ON "Printout"("requestId", "sha256");
     -- AddForeignKey
     ALTER TABLE "Printout" ADD CONSTRAINT "Printout_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "CardRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

     -- Ein Ausdruck hängt an genau einem: an der Scheibe oder, bis sie da ist, am Auftrag (von Hand, Prisma kennt kein CHECK)
     ALTER TABLE "Printout" ADD CONSTRAINT "Printout_one_target" CHECK (("cardId" IS NULL) <> ("requestId" IS NULL));
     ```
  5. `pnpm --filter spiegel exec prisma migrate deploy`, dann `pnpm --filter spiegel db:generate`.
  6. Gegenprobe: `pnpm --filter spiegel exec prisma migrate diff --from-config-datasource --to-schema
     prisma/schema.prisma --exit-code` endet mit 0 (kein Unterschied; das CHECK sieht Prisma nicht).
- Commit: `feat(spiegel): printouts on requests, print time and the print mismatch outcome`

### Task 3 · Ausgang „passt nicht zum Ausdruck“

- `apps/spiegel/src/lib/card-requests/status.ts`: `REMOVABLE_STATUSES` um `"printMismatch"`.
- `apps/spiegel/src/lib/card-requests/status.test.ts`: die erwartete Liste um `"printMismatch"` (sortiert nach
  `"mismatch"`).
- `apps/spiegel/src/components/profile/CardRequests.tsx`: `REQUEST_STATUS_TEXT.printMismatch: "passt nicht zum
  Ausdruck"` (Wortlaut des Users).
- `apps/spiegel/src/components/profile/CardRequests.test.tsx`: ein Auftrag mit `printMismatch` zeigt „passt nicht zum
  Ausdruck“ und den Knopf zum Entfernen.
- Commit: `feat(spiegel): name the print mismatch outcome of a request`

### Task 4 · Holen per Link

- `apps/spiegel/src/lib/printouts/fetch.ts` (neu):
  - `FETCH_TIMEOUT_MS = 10_000`, `MAX_URL_LENGTH = 2_048`, Größe aus `DEFAULT_LIMITS.maxBytes`
    (`@vereinsheim/meyton-pdf/limits`).
  - `type FetchResult = { kind: "fetched"; bytes: Uint8Array; fileName: string | null } | { kind: "failed"; reason:
    "badUrl" | "redirect" | "httpStatus" | "unreachable" | "timeout" | "tooLarge" | "notPdf" }`.
  - `fetchPrintout(url: string, options?: { timeoutMs?: number; maxBytes?: number }): Promise<FetchResult>`.
    `badUrl`: nicht parsebar, länger als `MAX_URL_LENGTH`, Protokoll nicht `http:`/`https:`, Benutzer oder Passwort in
    der Adresse. `fetch(url, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(timeoutMs),
    headers: { accept: "application/pdf", "accept-encoding": "identity", "user-agent": "Spiegel" } })`; Status 300
    bis 399 → `redirect`; nicht 200 → `httpStatus`; `content-length` > `maxBytes` → `tooLarge` (Körper abbrechen);
    den Strom lesen, über `maxBytes` → `reader.cancel()` und `tooLarge`; `TimeoutError`/`AbortError` → `timeout`;
    sonstiger Fehler → `unreachable`; `!hasPdfHeader` → `notPdf`.
    `fileName`: letzter Pfadteil, nur wenn er auf `/^[A-Za-z0-9._-]{1,100}\.pdf$/i` passt, sonst null.
  - Kopfkommentar: keine Liste erlaubter Adressen ([[adr-028]], Nachtrag vom 26. Oktober 2026), Restrisiko SF-47.
    Keine Weiterleitungen, damit kein Link auf ein anderes Ziel umgelenkt wird. Der Meyton-Link ist `http://`, HTTPS
    antwortet dort nicht.
- `apps/spiegel/src/lib/printouts/fetch.test.ts` (neu): ein `node:http`-Server auf `127.0.0.1:0` im Test
  (`beforeAll`/`afterAll`) mit Pfaden `/print_x.pdf` (PDF aus `buildPdf`), `/redirect` (302 auf `/print_x.pdf`),
  `/missing` (404), `/big` (`content-length` 2 MiB), `/chunked` (1,5 MiB in Stücken ohne `content-length`), `/html`,
  `/slow` (Kopf, dann nichts). Erwartet: `fetched` mit `fileName: "print_x.pdf"` und denselben Bytes, `redirect`,
  `httpStatus`, `tooLarge` zweimal, `notPdf`, `timeout` (mit `timeoutMs: 200`), `badUrl` für `ftp://x/a.pdf`,
  `http://u:p@127.0.0.1/a.pdf`, `nicht eine adresse`, eine Adresse über 2 048 Zeichen; `unreachable` für einen
  geschlossenen Port (Server starten, Port merken, schließen).
- Commit: `feat(spiegel): fetch a printout by link with size, time and type limits`

### Task 5 · Kindprozess: Protokoll und Skript

- `apps/spiegel/src/lib/printouts/protocol.ts` (neu, nur Typen und Zod):
  - `READY_LINE = '{"ready":true}'`.
  - `childResultSchema` (Zod, `discriminatedUnion("ok")`):
    - `{ ok: true, pages: int, id: found{hex, value, pages[]} | missing | conflict{hexes[]}, createdAt: { local,
      offsetMinutes: number|null, epochMs: number|null, source: "info"|"xmp" } | null, maxRssKb: number }`
    - `{ ok: false, code: z.enum(MEYTON_PDF_ERROR_CODES), maxRssKb: number }`
  - Typ `ChildResult`.
- `apps/spiegel/src/lib/printouts/reader-child.ts` (neu), Ablauf:
  1. `try { writeFileSync("/proc/self/oom_score_adj", "1000") } catch {}` (Kommentar: Bei Knappheit im Container
     trifft der Kernel den Kindprozess, nicht die App).
  2. `const { readPrintout, preloadPdfjs, MeytonPdfError } = await import("@vereinsheim/meyton-pdf/printout")`
     (dynamisch, damit Schritt 1 vor dem Laden von pdf.js steht), `await preloadPdfjs()`.
  3. `process.stdout.write(READY_LINE + "\n")`.
  4. stdin ganz lesen, höchstens `DEFAULT_LIMITS.maxBytes + 1` Bytes.
  5. `maxParseMs` aus `process.argv` (`--max-parse-ms=<n>`, sonst `DEFAULT_LIMITS.maxParseMs`).
     `readPrintout(bytes, { limits: { maxParseMs } })`.
  6. Eine Zeile JSON nach `ChildResult`, mit `maxRssKb: process.resourceUsage().maxRSS`. Bei `MeytonPdfError` `{ ok:
     false, code }`; jeder andere Fehler fällt durch (Exit ≠ 0 = abgestürzt).
  7. `process.exitCode = 0`.
  Nur relative Imports und Pakete, kein `@/`-Alias, kein `console`.
- Commit: `feat(spiegel): reader process for printouts`

### Task 6 · Lesen im Kindprozess (App-Seite)

- `apps/spiegel/src/lib/printouts/reader.ts` (neu). Importiert nie `@vereinsheim/meyton-pdf/printout` (sonst läge
  pdf.js im Server).
  - Konstanten: `CHILD_HEAP_MB = 48`, `DEV_LOADER_HEAP_MB = 32`, `CHILD_SEMI_SPACE_MB = 2`, `CHILD_MAX_RSS_MB = 96`,
    `RSS_POLL_MS = 50`, `STARTUP_MS = 5_000`, `OUTPUT_LIMIT = 64 * 1024`, `STDERR_KEEP = 4 * 1024`, `MAX_WAITING = 3`.
    Kommentar mit dem Speicherbudget aus „Approach“.
  - `export const READER_BUNDLE = "printout-reader.mjs"`.
  - `readerArgs(script?: string): string[]`:
    - Mit `script` (Tests): Heap-Flags + `script`.
    - Sonst, wenn `join(process.cwd(), READER_BUNDLE)` existiert: Heap-Flags + dieser Pfad.
    - Sonst: Heap-Flags mit `CHILD_HEAP_MB + DEV_LOADER_HEAP_MB` + `--import tsx` +
      `join(process.cwd(), "src/lib/printouts/reader-child.ts")`.
  - `childEnv()`: nur `{ NODE_ENV: process.env.NODE_ENV ?? "production" }`.
  - `type ReadFailure = "busy" | "timeout" | "memory" | "crashed" | MeytonPdfErrorCode`;
    `type IsolatedRead = { kind: "read"; pages: number; id: PrintoutIdResult; createdAt: …; maxRssKb: number } | {
    kind: "failed"; reason: ReadFailure }`.
  - `readPrintoutIsolated(bytes, options?: { maxParseMs?: number; startupMs?: number; script?: string; rssOf?: (pid:
    number) => number | null }): Promise<IsolatedRead>`:
    - Warteschlange an `globalThis.__spiegelPrintoutReader ??= { running: false, waiting: [] }`. Läuft einer und
      warten schon `MAX_WAITING` → sofort `busy`.
    - `spawn(process.execPath, [...readerArgs(script), "--max-parse-ms=" + maxParseMs], { env: childEnv(), stdio:
      ["pipe", "pipe", "pipe"] })`.
    - Startzeit `startupMs` bis zur Zeile `READY_LINE`, dann `stdin.end(bytes)` und Zeitgrenze `maxParseMs`
      (`SIGKILL`, Grund `timeout`). `stdin` `error` (EPIPE) ignorieren.
    - RSS-Wache alle `RSS_POLL_MS` über `rssOf ?? procRss` (`/proc/<pid>/status`, `VmRSS` in kB → Bytes; außerhalb von
      Linux null = keine Wache). Über `CHILD_MAX_RSS_MB` → `SIGKILL`, Grund `memory`.
    - stdout über `OUTPUT_LIMIT` → `SIGKILL`, `crashed`. stderr nur die ersten `STDERR_KEEP` Bytes.
    - Bei `exit`: unser Grund geht vor. Sonst die zweite Zeile mit `childResultSchema` parsen: ok → `read`; `ok: false`
      → `failed` mit `code`; ungültig, fehlend oder Exit ≠ 0 → stderr mit `/heap limit|out of memory/i` → `memory`,
      sonst `crashed`. `spawn`-`error` → `crashed`.
    - Danach Timer, Wache und Warteschlange freigeben (`finally`), den nächsten starten.
    - `console.warn` nur bei `timeout`, `memory`, `crashed`: `Ausdruck im Kindprozess: <grund>`.
  - `readerState(): { running: boolean; waiting: number }` für Tests.
  - `readerBundleMissing(): boolean` (Produktion und kein Bundle im Arbeitsverzeichnis).
- `apps/spiegel/src/lib/printouts/__fixtures__/` (neu, je wenige Zeilen, Ausgabe über `process.stdout.write`):
  - `hang-child.mjs`: ready, dann `for (;;) {}`.
  - `alloc-child.mjs`: ready, dann `const a = []; for (;;) a.push(new Array(1e6).fill(1))`.
  - `exit-child.mjs`: ready, `process.exit(3)`.
  - `flood-child.mjs`: ready, dann 1 MiB `x`.
  - `garbage-child.mjs`: ready, `{"ok":"yes"}`, Exit 0.
  - `mute-child.mjs`: nie ready, `setInterval(() => {}, 1000)`.
- `apps/spiegel/src/lib/printouts/reader.test.ts` (neu; PDFs aus `@vereinsheim/meyton-pdf/test-pdf`):
  1. Qt-Ausdruck (`font: "identity-h"`, Fuß `ID: ff914420 - Seite: 1`, `CreationDate D:20261002195212+02'00'`) → `read`,
     `id.kind === "found"`, `id.value === -7257056`, `createdAt.epochMs` passend.
  2. ohne ID → `read` mit `id.kind === "missing"`; zwei IDs → `conflict`.
  3. Zu viele Seiten (11) → `failed`, `tooManyPages` (der Code kommt durch).
  4. Mechanik mit den Fixtures: `hang` mit `maxParseMs: 300` → `timeout` in unter 2 s; `alloc` → `memory`; `exit`,
     `flood`, `garbage` → `crashed`; `mute` mit `startupMs: 300` → `timeout`; `hang` mit `rssOf: () => 512 * 1024 *
     1024` → `memory`. Nach jedem Fall liest Fall 1 wieder `found` (die App läuft weiter).
  5. **Präparierte PDFs mit dem echten Kindprozess:**
     - `buildPdf({ pages: [[]], rawPages: [bombContent("memory")] })` → `failed` mit `memory` oder `crashed`.
     - `rawPages: [bombContent("time")]` mit `maxParseMs: 1_000` → `timeout`, Dauer unter `startupMs + 2_000`.
     - Danach `process.memoryUsage().rss` des Testprozesses höchstens 50 MiB über dem Wert davor.
     - Vorab einmal von Hand messen: `readPrintout` im selben Prozess mit `maxParseMs: 60_000` auf der Zeit-Bombe
       braucht über 3 s. Sonst `bombContent("time", 2)` und den Test anpassen.
  6. Warteschlange: fünf `hang`-Lesungen zugleich mit `maxParseMs: 300` → eine `busy` sofort, vier `timeout`;
     `readerState()` zeigt währenddessen nie mehr als einen laufenden, am Ende `{ running: false, waiting: 0 }`.
  7. `readerArgs()`: Ohne Bundle im Arbeitsverzeichnis stehen `--import`, `tsx` und `--max-old-space-size=80` darin;
     `childEnv()` enthält nur `NODE_ENV`.
- Commit: `feat(spiegel): read printouts in a short-lived child with memory and time limits`

### Task 7 · Bundle für Produktion

- `apps/spiegel/package.json`:
  - devDependency `"esbuild": "0.28.2"` (dieselbe Version wie im Lockfile; app-eigen, kein Katalog).
  - `"build": "next build && tsx tools/build-reader.ts"`, neu `"build:reader": "tsx tools/build-reader.ts"`.
  - `pnpm install` (Lockfile), danach `pnpm install --frozen-lockfile` und den Lockfile-Diff auf fremde Importer prüfen
    ([[conventions]] §9).
- `apps/spiegel/tools/build-reader.ts` (neu):
  - `export function readerBuildOptions(outfile: string): BuildOptions` = `{ entryPoints: [<app>/src/lib/printouts/
    reader-child.ts], bundle: true, platform: "node", format: "esm", target: "node26", outfile, external:
    ["pdfjs-dist"], logLevel: "warning", legalComments: "none" }`. Kommentar: `unpdf` versucht zuerst `pdfjs-dist`,
    das hier fehlt; pdf.js kommt aus `unpdf/pdfjs`.
  - `main`: bricht ab, wenn `.next/standalone/apps/spiegel/server.js` fehlt („erst next build“). Baut nach
    `.next/standalone/apps/spiegel/printout-reader.mjs` und schreibt die Größe über `process.stdout.write`.
  - `if (process.argv[1] === import.meta.filename) await main()`.
- `apps/spiegel/src/lib/printouts/reader-bundle.test.ts` (neu): `build(readerBuildOptions(<mkdtemp>/printout-reader.mjs))`,
  dann `readPrintoutIsolated(qtPdf, { script: <bundle> })` → `found` mit `ff914420`; `maxRssKb` unter
  `CHILD_MAX_RSS_MB * 1024`. Zeitlimit des Tests 30 s.
- `apps/spiegel/src/instrumentation-node.ts`: in `registerNode` bei `readerBundleMissing()` einmal
  `console.error("printout-reader.mjs fehlt: Ausdrucke lassen sich nicht lesen")`.
- **Kein Eingriff ins `Dockerfile`:** Der Bundle liegt in `.next/standalone`, das der Runner schon kopiert. Der
  Builder hat die devDependencies (tsx, esbuild) aus `pnpm install`; `esbuild` steht in `onlyBuiltDependencies`.
  Scheitert der Bundle-Test, das Ergebnis melden und nicht auf Tracing durch Next ausweichen.
- Commit: `build(spiegel): bundle the printout reader into the standalone output`

### Task 8 · Dateien und Aufräumen

- `apps/spiegel/src/lib/printouts/files.ts` (neu):
  - `uploadDir()`: `process.env.UPLOAD_DIR`; fehlt es in Produktion → `throw new Error("UPLOAD_DIR fehlt")`; sonst
    `resolve("uploads")` (Arbeitsverzeichnis `apps/spiegel`, gitignored; `.gitignore` der App prüfen und ergänzen).
  - `printoutDir() = join(uploadDir(), "printouts")`.
  - `SHA256 = /^[0-9a-f]{64}$/`, `printoutPath(sha256)` (wirft bei ungültigem sha).
  - `safePdfName(name)`: gleiche Regel wie in `fetch.ts` (`fetch.ts` nutzt sie von hier).
  - `writePrintoutFile(sha256, bytes)`: `mkdir -p`, schreiben nach `.tmp-<sha256>-<randomUUID()>`, `rename` auf
    `<sha256>.pdf`, Modus 0o640.
  - `readPrintoutBytes(sha256): Promise<Buffer | null>` (ENOENT → null).
  - Rein: `filesToRemove({ files: { name, mtimeMs }[], referenced: Set<string>, totalRows: number, nowMs, graceMs }):
    string[]`. Nur `<sha>.pdf` ohne Zeile und `.tmp-*`, beide älter als `graceMs`; andere Namen nie. `totalRows === 0`
    und eine `.pdf` dabei → `[]`, ohne `.pdf` nur `.tmp-*`.
  - `SWEEP_GRACE_MS = 10 * 60_000`.
  - `removeOrphanPrintoutFiles(db, { nowMs = Date.now(), graceMs = SWEEP_GRACE_MS } = {}): Promise<{ removed: number;
    skipped: boolean }>`: Verzeichnis lesen (ENOENT → `{ 0, false }`), `stat` je Datei, `db.printout.count()`,
    referenzierte sha in Stapeln zu 500 (`findMany({ where: { sha256: { in } }, select: { sha256: true }, distinct:
    ["sha256"] })`), `filesToRemove`, `unlink` (ENOENT ignorieren). `skipped`, wenn die Leere-Tabelle-Sperre griff.
  - `sweepPrintoutsSoon(db)`: `void removeOrphanPrintoutFiles(db).then(log).catch(err => console.error("Ausdrucke
    nicht aufgeräumt:", err instanceof Error ? err.name : "unbekannter Fehler"))`. Ins Log nur Zahlen:
    `<n> Ausdrucke ohne Scheibe oder Auftrag gelöscht`; bei `skipped` `Ausdrucke: Tabelle leer, Dateien bleiben`.
- `apps/spiegel/src/lib/printouts/files.test.ts` (neu; `UPLOAD_DIR` je Test auf `mkdtemp`, danach zurück):
  - `filesToRemove` mit Handwerten: alt ohne Zeile weg, jung bleibt, mit Zeile bleibt, `notes.txt` bleibt, alte `.tmp-`
    weg, leere Tabelle → nichts.
  - `writePrintoutFile` zweimal mit denselben Bytes → eine Datei, Inhalt gleich.
  - Mit Datenbank (`createTestSite`): Scheibe (`origin: "pdf"`, ohne Quelle) mit `Printout`, Datei mit `utimes` eine
    Stunde alt; Sweep lässt sie; Scheibe löschen (`db.card.delete`, Kaskade) → Sweep entfernt sie. Eine zweite Zeile mit
    demselben sha an einem Auftrag hält die Datei, bis auch der Auftrag weg ist (`removeRequest`).
- Commit: `feat(spiegel): store printout files by hash and sweep orphans`

### Task 9 · `storePrintout`

- `apps/spiegel/src/lib/printouts/store.ts` (neu):
  - `interface StoredPrintout { sha256: string; size: number; fileName: string; hex: string; scheibenId: number;
    printedAt: Date }`.
  - `type StoreResult = { kind: "stored"; file: StoredPrintout } | { kind: "rejected"; reason: "tooLarge" | "notPdf" |
    "unreadable" | "noId" | "idConflict" | "noTime" | "timeout" | "busy" }`.
  - `storePrintout(input: { bytes: Uint8Array; timeZone: string; fileName?: string | null }, options?: Pick<Parameters<
    typeof readPrintoutIsolated>[1], "script" | "maxParseMs">): Promise<StoreResult>`:
    1. Länge 0 → `notPdf`; über `DEFAULT_LIMITS.maxBytes` → `tooLarge`; `!hasPdfHeader` → `notPdf`.
    2. `createHash("sha256")`.
    3. `readPrintoutIsolated`. `busy` → `busy`; `timeout` → `timeout`; `tooLarge`/`notPdf` → gleich; `memory`,
       `crashed`, `tooManyPages`, `tooMuchText`, `unreadable` → `unreadable`.
    4. `id.kind`: `missing` → `noId`, `conflict` → `idConflict`.
    5. `printedAt = createdAt === null ? null : new Date(createdAt.epochMs ?? zonedWallTimeMs(Date.parse(createdAt.local
       + "Z"), input.timeZone))`; null → `noTime`.
    6. `writePrintoutFile`; `fileName` = `safePdfName(input.fileName)` oder `ausdruck-<hex>.pdf`.
  - Kopfkommentar: keine Zeile in der Datenbank, die legt `attachPrintout` in der Transaktion des Aufrufers an. Eine
    Datei ohne Zeile räumt `removeOrphanPrintoutFiles` nach `SWEEP_GRACE_MS` ab.
- `apps/spiegel/src/lib/printouts/store.test.ts` (neu, `UPLOAD_DIR` auf `mkdtemp`): gespeichert mit Druckzeit
  (Zeitzone im PDF), ohne Zeitzone in `Europe/Berlin` (`D:20261002195212` → 17:52:12Z), `noId`, `idConflict`, `noTime`
  (`info: null`), `notPdf`, `tooLarge` (Puffer 1 MiB + 1), `unreadable` (Speicher-Bombe), gleiche Bytes zweimal → eine
  Datei; `fileName` `../x.pdf` → `ausdruck-ff914420.pdf`. Nach jeder Ablehnung keine Datei im Verzeichnis.
- Commit: `feat(spiegel): store a printout after reading id and print time`

### Task 10 · Zeilen: anhängen, umhängen, lesen

- `apps/spiegel/src/lib/printouts/queries.ts` (neu):
  - `type PrintoutTarget = { cardId: string } | { requestId: number }`.
  - `attachPrintout(tx: Prisma.TransactionClient | Db, file: StoredPrintout, target): Promise<string>`: `upsert` über
    den passenden Unique-Schlüssel (`cardId_sha256` bzw. `requestId_sha256`), `update: {}`, `footerId: file.hex`,
    `printedAt`, `fileName`, `size`; gibt die Id.
  - `movePrintoutsToCard(tx, requestId, cardId): Promise<number>`: sha der Scheibe lesen; Zeilen des Auftrags mit
    diesen sha löschen; übrige `updateMany({ where: { requestId }, data: { cardId, requestId: null } })`. Kommentar:
    beides in einem `UPDATE`, das CHECK hält.
  - `printoutFile(db, printoutId: string, ownerId: string): Promise<{ bytes: Buffer; fileName: string } | null>`:
    `findFirst({ where: { id, OR: [{ card: { is: { ownerId, ownerPending: false } } }, { request: { is: { userId:
    ownerId } } }] } })`, dann `readPrintoutBytes`. Fehlt die Datei → `console.error("Ausdruck ohne Datei")` und null.
- `apps/spiegel/src/lib/printouts/queries.test.ts` (neu, `createTestSite`, Scheibe `origin: "pdf"`, Auftrag über
  `db.cardRequest.create`):
  - am Auftrag anhängen, zweimal derselbe sha → eine Zeile.
  - umhängen auf die Scheibe; die Scheibe hat den sha schon → keine doppelte Zeile.
  - `printoutFile` für den Besitzer → Bytes; für ein anderes Konto null; für eine wartende Scheibe (`ownerPending`)
    null.
  - CHECK: `db.printout.create` ohne beide und mit beiden → `rejects.toThrow()`.
  - Kaskade: Auftrag löschen nimmt seine Zeilen mit, Scheibe löschen ihre.
- Commit: `feat(spiegel): attach, move and read stored printouts`

### Task 11 · Aufräumen verdrahten

- `apps/spiegel/src/instrumentation-node.ts`: in `emptyExpiredTrash` nach dem Leeren (`.then`) `sweepPrintoutsSoon(db)`.
  Damit läuft das Aufräumen beim Start und stündlich.
- `apps/spiegel/src/lib/first-card-actions.ts` (`rejectFirstCard`), `apps/spiegel/src/lib/trash-actions.ts`
  (`purgeCardNow`), `apps/spiegel/src/lib/card-requests/actions.ts` (`removeCardRequest`): nach Erfolg und vor
  `revalidatePath` `sweepPrintoutsSoon(db)`.
- Die Tests dieser Actions bleiben grün: ohne `UPLOAD_DIR` liest der Sweep `apps/spiegel/uploads/printouts`, das fehlt,
  ENOENT → nichts.
- Commit: `feat(spiegel): remove printout files after purges`

### Task 12 · Volume im Deploy-Vertrag **[geschützt]**

- `compose.yml`, `app-spiegel`:
  - `environment` um `UPLOAD_DIR: /app/uploads`.
  - `volumes: - uploads_spiegel:/app/uploads`.
  - unter `volumes:` am Ende `uploads_spiegel:`.
  - Kommentar am `NODE_OPTIONS` von Spiegel: „PDFs liest ein Kindprozess mit eigener Grenze, nicht dieser Heap.“
- `apps/spiegel/.env.example`: Block `# Ausdrucke (PDF); in Produktion ein Volume` mit `UPLOAD_DIR=./uploads`.
- Prüfen: `docker compose --env-file .env.example config --quiet`.
- Commit: `build(compose): upload volume for spiegel printouts`

### Task 13 · Backup und Restore **[geschützt]**

- `scripts/lib/apps.sh`: `UPLOAD_APPS=(treffsicher spiegel)`; Kommentar „Treffsicher (Anhänge) und Spiegel
  (Ausdrucke) haben ein Upload-Volume“.
- `scripts/backup.sh`: Kopf „tar.gz der Upload-Volumes (Treffsicher, Spiegel)“. Sonst unverändert, die Schleifen laufen
  über `UPLOAD_APPS`.
- `scripts/restore.sh`: Usage „Ein Uploads-Tar nur für Treffsicher und Spiegel“, Beispiel `$0 spiegel
  ~/migration/spiegel-2026-10-20.dump ~/migration/uploads-spiegel-2026-10-20.tar.gz`.
- `scripts/vereinsheim` (Status, Abschnitt „Volumes“): `for v in postgres_data $(printf 'uploads_%s ' "${UPLOAD_APPS[@]}")
  caddy_data caddy_config; do`.
- `bash -n scripts/lib/apps.sh scripts/backup.sh scripts/restore.sh scripts/vereinsheim`.
- Commit: `feat(ops): back up and restore spiegel printouts`

### Task 14 · Stack-Test der Ops und Beispiel-Ausdruck

- `apps/spiegel/tools/printout-sample.ts` (neu): schreibt einen erfundenen Qt-Ausdruck (ID `ff914420`, Druckzeit mit
  Zeitzone) über `buildPdf` nach stdout. Mit `--kind memory|time` die Bomben (zum Messen von Hand). Kein echter
  Ausdruck. `apps/spiegel/CLAUDE.md`, Befehlstabelle: Zeile dazu.
- `tools/stack-e2e/ops.sh`:
  1. Nach „Deploy nacheinander“ neuer Block `==> Spiegel: Upload-Volume und Leser der Ausdrucke`:
     - `compose exec -T app-spiegel sh -c 'mkdir -p /app/uploads/printouts && test -w /app/uploads/printouts'`, sonst
       `problem "Spiegel kann nicht ins Upload-Volume schreiben"`.
     - `(cd apps/spiegel && ./node_modules/.bin/tsx tools/printout-sample.ts) >"$WORK/sample.pdf"`.
     - `compose exec -T app-spiegel node --max-old-space-size=48 --max-semi-space-size=2 apps/spiegel/printout-reader.mjs
       <"$WORK/sample.pdf" >"$WORK/reader.txt" 2>&1`; Erfolg nur mit `"kind":"found"` in der Ausgabe, dann
       `echo "  liest den Ausdruck, $(grep -o '"maxRssKb":[0-9]*' "$WORK/reader.txt")"`; sonst `problem
       "printout-reader.mjs liest den Beispiel-Ausdruck nicht"` und `tail -5`.
  2. Vor „Backup mit drei Apps“: Marke ins Volume: `docker run --rm -v "${COMPOSE_PROJECT_NAME}_uploads_spiegel:/d"
     alpine sh -c 'mkdir -p /d/printouts && echo e2e >/d/printouts/e2e-marker.txt'`. Muster um
     `'uploads-spiegel-*.tar.gz'`.
  3. „Restore von Spiegel“: Marke löschen (`rm -f`), `spiegel_tar="$(ls -t "$BACKUP_DIR"/uploads-spiegel-*.tar.gz | head
     -n 1)"`, `run ./scripts/restore.sh spiegel "$good" "$spiegel_tar"`; danach `docker run --rm -v
     …_uploads_spiegel:/d:ro alpine test -f /d/printouts/e2e-marker.txt`, sonst `problem "Restore brachte die
     Ausdrucke von Spiegel nicht zurück"`.
  4. Der bisherige Gegentest wird: `run ./scripts/restore.sh ringwerk "$(ls -t "$BACKUP_DIR"/ringwerk-*.dump | head -n
     1)" "$spiegel_tar"` muss scheitern, `expect_text "ringwerk hat kein Upload-Volume" "restore.sh mit Uploads"`.
  5. Ausgabezeile „läuft weiter, Uploads und Pruning laufen“ bleibt.
- `bash -n tools/stack-e2e/ops.sh`.
- Commit: `test(stack-e2e): spiegel printouts in backup, restore and the image`

### Task 15 · Doku und ADR **[geschützt: `vault/decisions/`]**

- `vault/decisions/adr-028.md`:
  - TL;DR am Ende: „Nachtrag 26. Oktober 2026: ohne Vorschau und Bestätigung, automatische Prüfung der Druckzeit,
    vorerst ohne Liste erlaubter Adressen.“
  - `keywords` um `ssrf, kindprozess, upload, druckzeit, passt nicht zum ausdruck, löschen`.
  - Neuer Abschnitt `## Nachtrag (26. Oktober 2026)` mit den Punkten:
    - **Ohne Vorschau und Bestätigung:** Ein Scan oder Upload legt einen Auftrag an wie „Scheibe per ID“ (ID und Abend
      aus dem PDF); die gelieferte Scheibe gehört sofort dem Scanner. Grund: Spiegel ist Tagebuch und Statistik der
      eigenen Entwicklung, an einer Zuordnung hängt nichts weiter, und wer den Ausdruck hat, kennt dessen Werte.
      Ersetzt Vorschau (SF-41), Bestätigung und die Vorschau-Stufe aus dem Nachtrag vom 5. Oktober.
    - **Automatische Prüfung statt Bestätigung:** Vor dem Speichern einer gelieferten Scheibe: selber Abend, erster
      Schuss vor der Druckzeit; mit SP-2.6 zusätzlich Schuss für Schuss. Fällt sie durch, speichert Spiegel nichts von
      der Brücke, der Auftrag endet mit „passt nicht zum Ausdruck“. Eine Zustimmung per Sportpass eines anderen Kontos
      geht weiter vor. Das fängt auch eine Beschriftung, die das Muster für eine ID hält.
    - **Rückweg ist Löschen** (mit Sperre, Papierkorb).
    - **Keine Liste erlaubter Adressen, vorerst:** Es bleiben 1 MiB, 10 s, nur PDF, keine Weiterleitungen.
      Restrisiko: Ein Link kann Spiegel Adressen im eigenen Netz abrufen lassen, und ein dort liegendes PDF landet
      beim Scanner (SF-47 offen). Vertretbar bei Konten nur vom Admin und rund 15 Mitgliedern.
    - **Upload eines einzelnen PDFs** gleichwertig neben dem Scan (alte Ausdrucke).
    - **Lesen im Kindprozess** (SF-48): 48 MB Heap, 96 MiB RSS, 5 s, einer zur Zeit; gespeichert nach sha256 im
      Upload-Volume von Spiegel, im Backup.
    - „Ohne lesbare ID Auswahl nach Druckzeit“ und „Teilen → Spiegel“ verschoben.
- `vault/spiegel/spiegel-assignment.md`:
  - Zeile „Meyton-QR“ der Tabelle Wege: „…liest ID und Druckzeit, die Brücke holt die Scheibe; geprüft wird
    automatisch (Abend, Druckzeit), ohne Vorschau“.
  - „Der QR-Weg im Detail“ neu (fünf Schritte): erfassen (Kamera, Link, Upload; ohne Liste erlaubter Adressen, nur
    PDF, 1 MiB, 10 s, keine Weiterleitungen); speichern und lesen (Kindprozess, Datei nach sha256, nur mit ID und
    Druckzeit); Auftrag wie „Scheibe per ID“ mit Druckzeit; Prüfung beim Einlesen (selber Abend, erster Schuss vor der
    Druckzeit, sonst „passt nicht zum Ausdruck“, nichts gespeichert); Rückweg Löschen. Stand: „gebaut: Holen, Lesen,
    Speichern (1b-1); Scannen, Prüfung beim Einlesen und PDF an der Scheibe folgen (1b-2)“. Die Absätze zu „Ohne lesbare
    ID“, „Brücke aus“ (PDF liegt sofort in Spiegel, die Scheibe kommt beim nächsten Einschalten) und „Auswärts“
    anpassen. „Vorschau“ dort streichen.
  - „Scheibe per ID“, Schritt 5: Ausgang „passt nicht zum Ausdruck“ (nur aus einem Ausdruck).
  - Letzter Absatz: „Die Vorschau vor dem Holen (SF-41) kommt mit dem QR-Weg“ ersetzen durch den Verweis auf die
    automatische Prüfung.
- `vault/spiegel/spiegel-edge-cases.md`:
  - SF-41: Absicherung „automatische Prüfung über die Druckzeit statt Vorschau ([[adr-028]], Nachtrag 26. Oktober
    2026)“.
  - SF-47: „vorerst ohne Liste erlaubter Adressen (Entscheidung des Users); keine Weiterleitungen, nur PDF, 1 MiB,
    10 s; Restrisiko offen“.
  - SF-48: „Kindprozess gebaut (`apps/spiegel/src/lib/printouts/reader.ts`), Tests mit präparierten PDFs“.
- `vault/spiegel/spiegel-db-schema.md`, Zeile `Printout`: „an Scheibe oder Auftrag (genau eins, CHECK), `(cardId,
  sha256)` und `(requestId, sha256)` eindeutig, Datei `UPLOAD_DIR/printouts/<sha256>.pdf`“. Dazu ein Satz zu
  `CardRequest.printedAt`.
- `vault/spiegel/spiegel-privacy.md`: unter „Falsche Zuordnung“ bzw. „Eigene Scheibe löschen“: „Die Datei eines
  Ausdrucks löscht das Aufräumen, sobald keine Scheibe und kein Auftrag mehr auf sie zeigt (sofort nach dem Löschen,
  spätestens nach einer Stunde); in den Backups bleibt sie bis zu deren Rotation.“
- `vault/spiegel/spiegel-roadmap.md`, SP-1.7 Status: „b-1 erledigt: Holen per Link, Lesen im Kindprozess, Ablage nach
  sha256 im Volume samt Backup; b-2 (Scannen) offen“. SP-1.9: „Backups inklusive PDF-Speicher“ als erledigt.
- `vault/meyton/meyton-printout.md`, „Grenzen“: „Der Server liest fremde PDFs im Kindprozess (gebaut mit SP-1.7 b)“.
- `vault/operations/operations.md`: `UPLOAD_APPS=(treffsicher spiegel)`. Backup: `uploads-spiegel-<TS>.tar.gz —
  Ausdrucke (PDF) aus dem uploads_spiegel-Volume`; den Satz „Ringwerk und Spiegel haben keine persistierten Uploads“
  ersetzen („Ringwerk hat keine“). Restore-Beispiel für Spiegel mit Tar; „Ringwerk ohne Uploads-Tar“.
- `vault/architecture/architecture.md`: Zeile `packages/meyton-pdf`: „Spiegel nutzt `printout-id` und liest Ausdrucke im
  Kindprozess (`printout-reader.mjs`)“.
- `vault/architecture/target-architecture.md` (TL;DR) und `vault/overview.md` (Liste der Volumes):
  `uploads_spiegel → /app/uploads (im spiegel-Container)`.
- `apps/spiegel/CLAUDE.md`, neuer Regelpunkt **Ausdrucke** (`src/lib/printouts/`): `fetchPrintout` (ohne Liste
  erlaubter Adressen, keine Weiterleitungen), `readPrintoutIsolated` (nie `meyton-pdf/printout` im Server importieren),
  Bundle nach `next build`, `storePrintout` ohne Datenbank, `attachPrintout`/`movePrintoutsToCard`/`printoutFile`,
  `removeOrphanPrintoutFiles` als einziger Weg, Dateien zu löschen. Im Kopf: `app-spiegel` mit `uploads_spiegel`.
- `/sync-graph`: `vault-lint` grün.
- Commits: `docs(adr-028): no preview, automatic print time check, no address list for now` und `docs(vault): printouts
  of spiegel in storage, backup and the QR path`.

## Required Docs

- `plans/2026-10-26-treffsicher-in-spiegel.md` (Stufe 1 → 1b, Regeln für Kindsessions)
- `vault/decisions/adr-028.md`, `vault/spiegel/spiegel-assignment.md` („Der QR-Weg im Detail“, „Scheibe per ID“)
- `vault/meyton/meyton-printout.md` („Link“, „Lesen in Spiegel“), `vault/spiegel/spiegel-edge-cases.md` (SF-41 bis SF-48)
- `packages/meyton-pdf/CLAUDE.md`, `apps/spiegel/CLAUDE.md` (Regeln „Prisma 7“, „Migrationen nur anhängen“,
  „Speicher“, „Löschen mit Papierkorb“, „Scheibe per ID holen“)
- `vault/spiegel/spiegel-privacy.md`, `vault/operations/operations.md` (Backup, Restore)
- `vault/conventions.md` §9 (Mutationsprobe, `pnpm add` und Lockfile)
- Root-`CLAUDE.md` („Wenn du etwas änderst“: `bash -n`, `compose config`, `tools/stack-e2e/run.sh`)

## Test steps

1. `pnpm --filter @vereinsheim/meyton-pdf test` grün.
2. `pnpm --filter spiegel test -- printouts card-requests trash-actions first-card-actions` grün.
3. Mutationsproben (Datei vorher per `cp` sichern, nicht `git checkout`):
   - in `reader.ts` den `SIGKILL` der Zeitgrenze auskommentieren → der `hang`-Test wird rot;
   - in `filesToRemove` die Sperre bei leerer Tabelle entfernen → ihr Test wird rot;
   - in `fetch.ts` `redirect: "follow"` → der Weiterleitungs-Test wird rot.
4. `pnpm --filter spiegel build`, dann `ls -l apps/spiegel/.next/standalone/apps/spiegel/printout-reader.mjs` (rund 2 MB)
   und `cd apps/spiegel && ./node_modules/.bin/tsx tools/printout-sample.ts | node --max-old-space-size=48
   --max-semi-space-size=2 .next/standalone/apps/spiegel/printout-reader.mjs`: zwei Zeilen, die zweite mit
   `"kind":"found"`.
5. Migration: `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` endet mit 0.
   Danach in `psql` `\d "Printout"` zeigt `Printout_one_target`.
6. `bash -n scripts/lib/apps.sh scripts/backup.sh scripts/restore.sh scripts/vereinsheim tools/stack-e2e/ops.sh` und
   `docker compose --env-file .env.example config --quiet`.
7. `tools/stack-e2e/run.sh --ops`: „Betrieb gegen den Teststack: in Ordnung.“ Darin: Upload-Volume beschreibbar,
   Leser liest den Ausdruck (mit `maxRssKb`), Backup enthält `uploads-spiegel-*.tar.gz`, Restore bringt die Marke
   zurück, Ringwerk lehnt den Tar ab.
8. `tools/stack-e2e/run.sh --load 3`: Speicher von `app-spiegel` wie bisher (Spitze um 147 MiB). Der Leser läuft dabei
   nicht; das ist die Grundlage für das Budget.
9. `pnpm check` grün.

## Verification

Die Kindsession meldet an die koordinierende Session:

- Branch und Commits.
- `maxRssKb` des Lesers im echten Image (aus `ops.sh`) und ob der Wert unter 80 MiB liegt.
- Dauer der Zeit-Bombe im selben Prozess (Messung aus Task 6) und ob `scale` nötig war.
- Ergebnis von `run.sh --ops` und `--load`.
- Die Migration samt CHECK, angewandt auf die Dev-Datenbank.
- Was 1b-2 als Bausteine nutzt (`fetchPrintout`, `storePrintout`, `attachPrintout`, `movePrintoutsToCard`,
  `printoutFile`, `printMismatch`, `CardRequest.printedAt`).

Nicht belegt bleibt bis 1b-2: der Weg von der Oberfläche bis zur Datei in Produktion und der Speicher von App plus
Kindprozess unter Last zugleich. Für 1b-1 braucht es keine neue Brücke. Release und Deploy nach `main` entscheidet der
User; mit 1b-1 kommt ein neues Volume, `vereinsheim deploy` legt es an.
