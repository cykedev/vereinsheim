# 1f · Mehrere Belege je Scheibe

Teilplan von Stufe 1 aus `plans/2026-10-26-treffsicher-in-spiegel.md` (Basisbranch `feat/treffsicher-in-spiegel`),
Kindsession `tis-1f-evidence-list`, Branch `feat/tis-1f-evidence-list` von `main` (`290da9e5`), zurück nach `main`.
Entscheidungen: „Designkonzept 1f, Runde 1“ im Koordinationsplan (vom User am 29. Oktober 2026 mit allen Empfehlungen
freigegeben, https://claude.ai/artifact/5AKqZGGpnJKA1hH3UThdVY).

## Kontext

1d hat den Beleg gebaut: ein Foto oder PDF je **eingetragener** Scheibe (`CardEvidence` mit `cardId @unique`),
„Ersetzen“ statt eines zweiten. Fotos von Ergebnislisten gehören aber meist zu Wettkämpfen, die von der Anlage kommen,
und in Treffsicher hängen an einer Einheit bis zu 6 Anhänge (69 Anhänge an 56 Einheiten, keiner beschriftet, der
Originalname ist das Einzige, was ein Anhang über sich sagt). Stufe 3 macht jeden Anhang aus Treffsicher zu Ausdruck oder
Beleg seiner Scheibe und braucht dafür eine Liste mit Namen an jeder eigenen Scheibe. 1f schafft diesen Platz und geht
als eigenes Release nach `main`, weil es auch ohne Tagebuch nützt.

Stand der Daten: In der Dev-Datenbank (Prod-Kopie mit den Vorschau-Daten) stehen **0** Zeilen `CardEvidence`; 1d ist
noch nicht deployt. Die Migration trifft also überall auf höchstens eine Zeile je Scheibe.

## Ansatz

### Modell (Schema, eine Migration, geschützter Pfad)

```prisma
model Card {
  …
  evidence    CardEvidence[]
}

// Belege einer Scheibe ([[adr-033]], Nachtrag 1f): bis zu `EVIDENCE_LIMIT` (10) Fotos oder PDFs je eigener Scheibe, in der
// Folge des Anhängens. Die Datei liegt unter `UPLOAD_DIR/evidence/<sha256>.<ext>`; gleiche Bytes ergeben dieselbe Datei,
// an einer Scheibe hängt jede Datei höchstens einmal
model CardEvidence {
  id          String   @id @default(cuid())
  cardId      String
  card        Card     @relation(fields: [cardId], references: [id], onDelete: Cascade)
  sha256      String
  // application/pdf, image/jpeg, image/png oder image/webp, geprüft an den ersten Bytes
  contentType String
  size        Int
  // der Name der Datei, wie der Browser sie geschickt hat (`evidenceFileName`); null bei Belegen aus 1d
  fileName    String?
  storedAt    DateTime @default(now()) @db.Timestamptz(3)

  // eine Datei hängt an einer Scheibe nur einmal; der Index dient auch dem Lesen je Scheibe und der Kaskade
  @@unique([cardId, sha256])
  // Aufräumen der Dateien: zeigt noch eine Zeile auf diese Datei
  @@index([sha256])
}
```

- SQL ohne Datenbank als Quelle (die Dev-Datenbank trägt die Tabellen des Tagebuchs aus dem Basisbranch, ein Diff gegen
  sie schlüge vor, sie zu löschen):
  `git show main:apps/spiegel/prisma/schema.prisma > "$TMPDIR/schema-main.prisma"` und
  `pnpm --filter spiegel exec prisma migrate diff --from-schema "$TMPDIR/schema-main.prisma" --to-schema prisma/schema.prisma --script`
  nach `prisma/migrations/20261029120000_evidence_list/migration.sql`. Erwartet, sonst nichts:

  ```sql
  -- DropIndex
  DROP INDEX "CardEvidence_cardId_key";

  -- AlterTable
  ALTER TABLE "CardEvidence" ADD COLUMN     "fileName" TEXT;

  -- CreateIndex
  CREATE UNIQUE INDEX "CardEvidence_cardId_sha256_key" ON "CardEvidence"("cardId", "sha256");
  ```

  Kein Datenverlust: eine neue Spalte mit NULL, eine gelockerte Eindeutigkeit, ein neuer Index, der an alten Daten
  nicht scheitern kann (bisher war schon `cardId` allein eindeutig).
- Der Name `20261029120000` liegt nach den Migrationen des Basisbranchs (`20261029090000_diary_goals_routines`), die
  in der Dev-Datenbank schon stehen. Anwenden mit `pnpm --filter spiegel exec prisma migrate deploy`. Lehnt `deploy` ab,
  weil die Dev-Datenbank Migrationen kennt, die im Worktree fehlen: `prisma db execute --file
  prisma/migrations/20261029120000_evidence_list/migration.sql` und `prisma migrate resolve --applied
  20261029120000_evidence_list`. Nie `migrate dev`, nie zurücksetzen.
- **Rückweg auf ein älteres Image:** Das Image von `main` vor 1f liest `Card.evidence` als eine Zeile und hängt per
  `upsert({ where: { cardId } })` an. Ohne den Unique-Index auf `cardId` scheitert das Anhängen dort mit „Das ließ sich
  nicht speichern.“; wie es eine Scheibe mit zwei Belegen liest, prüft Aufgabe 1 (Probe). Vor einem Rückweg nichts
  löschen.
- Diff und SQL gehen vor dem Commit an die koordinierende Session (Circuit-Breaker, ADR-023, Autopilot-Guard).

### Rechte und Regeln (alle Herkünfte)

- Anhängen und Entfernen nur für den Besitzer einer **sichtbaren** Scheibe: `{ id, ownerId, ...VISIBLE_CARD }` (nicht
  wartend, nicht im Papierkorb, Disziplin nicht ignoriert), gleich welcher Herkunft (`raw`, `pdf`, `manual`,
  `treffsicher`). Die Einschränkung `origin: { in: ["manual", "treffsicher"] }` aus 1d (`ownEntered`) fällt weg.
- **Ein Beleg ist keine Angabe der Scheibe** (ADR-031, ADR-033): Anhängen und Entfernen schreiben nur `CardEvidence`,
  nie über `writeEnteredCard`, `checkDetails` oder `detailsWriter`, also keine Revision, keine Projektion, kein
  Nachrechnen. Geprüft am Code von `main`: `attachEvidence` und `removeEvidence` tun das heute schon nicht. Tests halten
  es fest (Revisionen und `currentRevisionId` unverändert, auch an einer Scheibe der Anlage).
- **Grenze 10** (`EVIDENCE_LIMIT` in `src/lib/evidence/texts.ts`): Vor dem Lesen der Datei eine schnelle Zählung ohne
  Sperre (spart das Lesen und den Kindprozess bei voller Scheibe), verbindlich dann in einer Transaktion:
  `lockCard(tx, cardId)` (Advisory-Lock der Quelle bei Scheiben der Anlage, dann `FOR UPDATE` auf die Zeile, in der Folge
  des Schreibens), Scheibe sichtbar und eigen, `count` < 10, dieselbe Datei nicht schon da, dann `create`. Zwei
  gleichzeitige Uploads warten aufeinander und überschreiten die Grenze nicht.
- **Gleiche Datei zweimal an derselben Scheibe:** einmal (`@@unique([cardId, sha256])`, wie `Printout`). Begründung:
  dieselben Bytes zweimal sind nie zwei Belege, sondern ein versehentlich doppelt gewähltes Foto; sie nähmen einen der
  10 Plätze und zeigten zweimal dasselbe. Der Grund steht wie die anderen unter der Liste („hängt schon an dieser
  Scheibe“). Dieselbe Datei an **zwei** Scheiben bleibt möglich (eine Ergebnisliste für zwei Disziplinen eines Abends);
  die Datei liegt dann einmal auf der Platte. Siehe „Offene Punkte“ 1.
- **Meyton-Ausdruck bleibt kein Beleg** (heutige Erkennung über `storePrintout(…, { write: false })`), je Datei.
- **Entfernen** löscht genau eine Zeile (`id` des Belegs, Scheibe eigen und sichtbar). Die Datei räumt
  `removeOrphanEvidenceFiles` ab, sobald keine Zeile mehr auf sie zeigt und sie älter als zehn Minuten ist; nach dem
  Entfernen ruft die Action `sweepUploadsSoon(db)` an (wie nach dem endgültigen Löschen).
- **Löschkette** bleibt richtig, geprüft am Code: `purgeCards` löscht die Scheibe, die Kaskade (`onDelete: Cascade`)
  nimmt alle Zeilen `CardEvidence` mit; der Papierkorb (`purgeExpiredTrash`, `purgeCardNow`), „Nicht meine“
  (`rejectFirstCard`) und im Basisbranch das Löschen des Kontos (`deleteAccountIn`) laufen alle über `purgeCards`.
  `removeOrphanEvidenceFiles` fragt je Prüfsumme, ob **irgendeine** Zeile auf sie zeigt (`distinct sha256`), mehrere
  Zeilen je Scheibe ändern daran nichts. Tests in Aufgabe 7.
- **Nie auf der geteilten Seite:** `sharedCard` liest keine Belege (geprüft), `/api/evidence/<id>` gibt die Datei nur
  dem Besitzer (`evidenceFile` mit `ownerId` und `VISIBLE_CARD`), auch wenn die Scheibe geteilt ist (Test).

### Name der Datei

- `evidenceFileName(raw: string): string | null` in `src/lib/evidence/name.ts` (rein): Unicode NFC, nur der Teil nach
  dem letzten `/` oder `\`, Steuer- und Formatzeichen raus (`/[\p{Cc}\p{Cf}]/gu`, auch Richtungszeichen wie U+202E),
  Leerraum zu einem Leerzeichen, außen getrimmt; länger als `EVIDENCE_NAME_MAX` (120 Zeichen, Codepoints) wird der
  Stamm gekürzt und endet mit „…“, die Endung (bis 10 Zeichen nach dem letzten Punkt) bleibt; leer → null.
- Der Browser schickt den Namen als Namen der Datei im Formular (`File.name`). `prepareEvidence` zeichnet Fotos neu als
  JPEG und nennt sie heute `beleg.jpg`; neu behält es den Stamm des Originals und setzt die Endung `.jpg`
  (`IMG_2041.HEIC` → `IMG_2041.jpg`, ohne Stamm `beleg.jpg`), weil die gespeicherte Datei ein JPEG ist. Siehe „Offene
  Punkte“ 2. Ein PDF geht mit seinem Namen.
- Die Action speichert `evidenceFileName(file.name)`. Angezeigt wird `fileName ?? (pdf ? "PDF" : "Foto")`.
- Die Route `/api/evidence/<id>` nennt den Namen zusätzlich im Kopf: `Content-Disposition: inline;
  filename="beleg.<ext>"; filename*=UTF-8''<Name nach RFC 5987>` (`encodeURIComponent`, dazu `'()*` kodiert); ohne Namen
  wie heute nur `filename="beleg.<ext>"`. So trägt ein Speichern aus dem Viewer des Browsers den Originalnamen.

### Mehrere Dateien in einem Zug

- `<input type="file" multiple accept="image/*,application/pdf">`. Der Browser schickt **je Datei eine Anfrage**
  (Caddy: 5 MiB je Anfrage, eine Datei höchstens 4 MiB), nacheinander, nie alle in einem Formular. Nacheinander auch,
  weil der Leser der Ausdrucke einen Kindprozess zur Zeit startet.
- Ablauf im Browser (`CardEvidence.tsx`): `free = EVIDENCE_LIMIT - evidence.length`; für jede gewählte Datei in der
  Reihenfolge der Auswahl: ist `free` 0, zählt sie als „Grenze“ ohne Anfrage; sonst `prepareEvidence` (Fehler `tooLarge`
  oder `unreadable` als Grund dieser Datei), dann `attachEvidence(form)`; Erfolg zählt und senkt `free`, ein Fehler ist
  der Grund dieser Datei; „Diese Scheibe gibt es nicht mehr.“ bricht ab. Danach ein `router.refresh()`.
- **Bericht** unter der Liste (`data-evidence-report`, `role="status"`, Fläche `warning-wash`), nur wenn mindestens
  eine Datei nicht angehängt ist: zuerst „{n} Dateien angehängt.“ (ohne diesen Satz, wenn keine), dann je Datei ihr
  Grund, alle mit Grenze in einem Satz. Er bleibt stehen bis zur nächsten Aktion in der Zeile. Ging alles, kein Bericht
  und kein Toast (die Liste zeigt die neuen Dateien), wie heute in der Zeile.
- Namen in Berichten kürzt `shortName(name, 40)` in der Mitte mit „…“ und lässt die Endung stehen
  (`print_7f3a…c2.pdf`).
- Die Action liefert je Datei `ActionResult` mit dem fertigen Satz als `error` (sie kennt den Namen); die Gründe aus dem
  Browser baut dieselbe Funktion `evidenceProblemText(problem, name)`.

### Zeile „Belege“ im Kasten „Diese Scheibe“

- An **jeder** eigenen Scheibe an derselben Stelle: nach „Eintrag“, „Ausdruck“, „Von der Anlage“ und „Ort“, direkt vor
  „Disziplin“. Bei eingetragenen Scheiben steht sie damit wie heute direkt nach „Eintrag“; bei Scheiben der Anlage und
  vom Ausdruck kommt sie neu dazu. Leer wie gefüllt dieselbe Zeile.
- `ActionRow` mit Titel „Belege“, ohne Aktion rechts; Zustand leer „Fotos oder PDFs zu dieser Scheibe, etwa eine
  Ergebnisliste.“, gefüllt „1 Datei“ / „{n} Dateien“, voll „10 Dateien, mehr gehen nicht an eine Scheibe. Entferne
  einen, um einen neuen anzuhängen.“ Darunter (Kinder der Zeile): die Liste, der Bericht, der Knopf „Foto oder PDF
  anhängen“ (Stil `PICK` wie heute, Symbol `Paperclip`; nicht bei 10).
- Je Datei eine Zeile `li` (`data-evidence-item`, `data-evidence-kind="photo|pdf"`), Raster
  `grid-cols-[minmax(0,1fr)_auto] items-center gap-2`:
  - links ein Link (`href="/api/evidence/<id>"`, `target="_blank"`, `rel="noopener"`, Fokusring, `hover:bg-surface-2`)
    mit Raster `grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-2.5 min-w-0`: Vorschaubild 44 px (Foto:
    `<img src="/api/evidence/<id>" alt="" width={44} height={44} loading="lazy" decoding="async"
    className="size-11 rounded-lg border border-border bg-surface-2 object-cover">`, mit
    `// eslint-disable-next-line @next/next/no-img-element -- Datei des Besitzers über die eigene Route, ohne Optimierung`;
    PDF: Fläche `size-11 rounded-lg border border-border bg-surface-2` mit „PDF“, `text-xs font-bold
    text-muted-foreground`, `aria-hidden`), daneben Name (`truncate text-sm font-semibold`, einzeilig) und darunter
    „Foto · 1,4 MB · Sa 14.03.2026“ (`text-xs text-muted-foreground`);
  - rechts `<Button variant="ghost" size="icon-sm" aria-label="{Name} entfernen" data-evidence-remove>` mit `X`
    (32 px, über der Grenze von 24 px aus §10), öffnet den `DecisionDialog` `evidenceRemove`.
  - Größe: `formatDecimal(Math.max(0.1, size / 1_000_000), 1)` „MB“ wie heute; Tag: `formatWeekdayDate` in der
    Anzeige-Zone (wie die Zeile „Ausdruck“).
- Die Vorschau kommt aus der Datei selbst über die vorhandene Route; der Server erzeugt keine Vorschaubilder. Ein
  `<img>` lädt ein Bild trotz `Content-Security-Policy: sandbox` (gilt nur für Dokumente) und `nosniff` (Typ stimmt).
  `Cache-Control: private, no-store` bleibt; `loading="lazy"` lädt erst, wenn der Kasten ins Bild kommt. Siehe „Offene
  Punkte“ 3.
- „…“ nur am Knopf der laufenden Aktion: beim Anhängen „Wird angehängt…“, bei mehreren „Datei 2 von 3 wird
  angehängt…“; die ×-Knöpfe sind dabei gesperrt. Beim Entfernen ist der Knopf zum Anhängen gesperrt (conventions §9,
  `pending` gilt für die ganze Transition).
- Keine Zeichen in Liste und Start, kein eigener Bildbetrachter, nichts auf der geteilten Seite.

### Rückfrage beim Entfernen

`evidenceRemove({ when, name, kind, others })` in `src/lib/admin/consequences.ts` (`when` wie die anderen Rückfragen
der Scheibe, gesprochen über `spoken`):

- Titel „Beleg entfernen?“
- about: „An der Scheibe vom {when} hängt „{Name}“.“; ohne Namen (Belege aus 1d) „An der Scheibe vom {when} hängt ein
  Foto.“ bzw. „… ein PDF.“
- happens: „Spiegel entfernt diese eine Datei von der Scheibe.“
- notHappening: „Die anderen {n} Belege bleiben.“ (bei einem anderen „Der andere Beleg bleibt.“, ohne andere fehlt der
  Satz), dann „Die Werte der Scheibe bleiben, wie sie sind.“
- undo: „Die Datei wieder anhängen, solange du sie noch hast.“ · Knopf „Entfernen“, `destructive`.

## Neue Texte (gehen erst zum User, dann ins Textbuch Spiegel, dann in den Code)

| Stelle | Text |
| --- | --- |
| Zeile, Titel | Belege |
| … leer | Fotos oder PDFs zu dieser Scheibe, etwa eine Ergebnisliste. |
| … gefüllt | 1 Datei · {n} Dateien |
| … voll (10) | 10 Dateien, mehr gehen nicht an eine Scheibe. Entferne einen, um einen neuen anzuhängen. |
| Knopf | Foto oder PDF anhängen |
| … beim Anhängen | Wird angehängt… · Datei {k} von {n} wird angehängt… |
| Datei ohne Namen | Foto · PDF |
| Datei, Zeile darunter | Foto · 1,4 MB · Sa 14.03.2026 · PDF · 0,2 MB · So 15.03.2026 |
| Vorschau eines PDF | PDF |
| × für Screenreader | {Name} entfernen |
| Bericht, angehängt | 1 Datei angehängt. · {n} Dateien angehängt. |
| … Ausdruck von Meyton | „{Name}“ ist ein Ausdruck von Meyton und kein Beleg. Hole ihn unter „Scheibe holen“ mit „PDF hochladen“, dann liest Spiegel seine Werte. |
| … zu groß | „{Name}“ ist zu groß, auch verkleinert. |
| … nicht lesbar | Spiegel kann „{Name}“ nicht lesen. Nimm ein Foto (JPEG, PNG) oder ein PDF. |
| … Grenze, eine / mehrere | „{Name}“ ist nicht angehängt. An einer Scheibe hängen höchstens 10 Belege. · {k} Dateien sind nicht angehängt. An einer Scheibe hängen höchstens 10 Belege. |
| … doppelt (neu, „Offene Punkte“ 1) | „{Name}“ hängt schon an dieser Scheibe. |
| … gescheitert | „{Name}“ ließ sich nicht speichern. Bitte noch einmal versuchen. |
| Scheibe weg | Diese Scheibe gibt es nicht mehr. |
| Entfernen gescheitert | Das ließ sich nicht entfernen. Bitte noch einmal versuchen. |
| Rückfrage, Titel | Beleg entfernen? |
| … about | An der Scheibe vom {Tag um Uhrzeit} hängt „{Name}“. · ohne Namen: … hängt ein Foto. / … hängt ein PDF. |
| … happens | Spiegel entfernt diese eine Datei von der Scheibe. |
| … notHappening | Die anderen {n} Belege bleiben. · Der andere Beleg bleibt. · Die Werte der Scheibe bleiben, wie sie sind. |
| … undo / Knopf | Die Datei wieder anhängen, solange du sie noch hast. · Entfernen |

Entfallen: „Ein Foto vom Papier oder ein PDF, damit du später nachsehen kannst.“, „Foto, 1,2 MB, angehängt …“,
„Öffnen“, „Ersetzen“, „An dieser Scheibe hängt ein Foto.“, „Spiegel entfernt den Beleg von der Scheibe.“, „Den Beleg
wieder anhängen, solange du die Datei noch hast.“, der Ausdruck-Text mit „Der Beleg ist nicht angehängt.“

## Skizze (Telefon, Scheibe der Anlage, drei Dateien gewählt, eine davon ein Ausdruck)

```
┌─────────────────────────────────┐
│ Diese Scheibe                   │
│ Belege                          │
│ 2 Dateien                       │
│ [▒▒] IMG_2041.jpg          (×)  │
│      Foto · 0,9 MB · Do 29.10.2026
│ [▒▒] Ergebnisliste Kreisliga…  (×)
│      Foto · 1,1 MB · Do 29.10.2026
│ ┌─────────────────────────────┐ │
│ │2 Dateien angehängt.         │ │
│ │„print_7f3a…c2.pdf“ ist ein  │ │
│ │Ausdruck von Meyton und kein │ │
│ │Beleg. Hole ihn unter …      │ │
│ └─────────────────────────────┘ │
│ 📎 Foto oder PDF anhängen        │
├─────────────────────────────────┤
│ Disziplin   Luftpistole  Ändern │
│ Teilen      Nicht geteilt Teilen│
│ Löschen                 Löschen │
└─────────────────────────────────┘
```

## Dateien

Neu (alle unter `apps/spiegel/`):
`prisma/migrations/20261029120000_evidence_list/migration.sql`, `src/lib/evidence/name.ts` (+ `name.test.ts`),
`src/lib/evidence/queries.ts` (+ `queries.test.ts`), `src/lib/evidence/texts.test.ts`.

Verschoben: `src/lib/entered/evidence-actions.ts` → `src/lib/evidence/actions.ts` (Belege gehören nicht mehr nur zu
eingetragenen Scheiben), Test mit (`git mv`, Commit mit ausdrücklichen Pfaden).

Geändert: `prisma/schema.prisma`, `src/lib/evidence/texts.ts`, `src/lib/evidence/shrink.ts` (+ Test),
`src/lib/evidence/http.ts` (+ Test), `src/lib/evidence/files.test.ts`, `src/lib/db/purge.test.ts`,
`src/lib/entered/queries.ts` (`evidence` aus `CardEntryInfo` und `cardEntryInfo` heraus, `CardEvidenceInfo` nach
`evidence/queries.ts`), `src/components/card/CardEvidence.tsx`, `src/components/card/CardActions.tsx` (+ Test),
`src/components/card/CardScreen.tsx` (`own.evidence`), `src/app/(app)/cards/[id]/page.tsx`,
`src/lib/admin/consequences.ts` (+ Test), `tools/pruefen.ts`, `CLAUDE.md`.

Vault: `vault/spiegel/spiegel-navigation.md` („Seite einer Scheibe“, „Von Hand eintragen“),
`vault/spiegel/spiegel-data-model.md` (Zeile „Beleg“), `vault/spiegel/spiegel-roadmap.md` (SP-4.4),
`vault/decisions/adr-033.md` (Nachtrag, geschützter Pfad).

Nicht berührt: Brücke, Vertrag, `compose.yml`, `Caddyfile`, `scripts/`. Die Dateien liegen im Volume `uploads_spiegel`,
das Backup und Restore schon ganz sichern. **Keine neue Brücke.**

## Required Docs

- `vault/conventions.md` §2 (Kasten „Diese Scheibe“, `DecisionDialog`), §3 (Kontrast, Ellipse), §9 („`pending` gilt
  für die ganze Transition“, „Ein Feld fester Breite … am Telefon“, „Tests gegen die Dev-Datenbank fassen nur eigene
  Zeilen an“, „Mocks für Abfragen filtern nach der Bedingung“), §10 („Kein Knopf ohne Folge“, „So schreiben wir“,
  Symbolknöpfe)
- `vault/decisions/adr-033.md` (Nachtrag 1d), `adr-031.md` (Revisionen tragen nur Angaben), `adr-028.md` (Upload-Grenzen)
- `apps/spiegel/CLAUDE.md` („Von Hand eintragen“, „Ausdrucke“ mit `removeOrphanFiles`, „Teilen per Link“)
- `vault/spiegel/spiegel-navigation.md` („Seite einer Scheibe“, „Von Hand eintragen“), `packages/ui/CLAUDE.md`
- Code: `src/lib/evidence/*`, `src/lib/entered/evidence-actions.ts` (+ Test), `src/lib/db/purge.ts` (`lockCard`),
  `src/lib/db/visible.ts`, `src/components/card/CardEvidence.tsx`, `CardActions.tsx`, `ActionRow.tsx`,
  `tools/pruefen.ts` (`handEntry`, `phoneNoSideScroll`)

## Aufgaben

1. **Schema und Migration (geschützt, Circuit-Breaker).** Modell oben in `prisma/schema.prisma`, SQL über
   `migrate diff --from-schema … --to-schema …` (siehe Ansatz), Diff und SQL an die Koordination. Nach OK: `migrate
   deploy` auf Dev (Ausweg mit `db execute` + `migrate resolve` wie oben). **Probe Rückweg**, bevor `db:generate` den
   Client erneuert: eine Testdatei `src/lib/evidence/rollback-probe.test.ts` (nicht committen) legt mit
   `createTestSite(db, "rollback-probe")` eine Scheibe `manual` an, fügt per `db.$executeRaw` zwei Zeilen
   `CardEvidence` ein, ruft das alte `cardEntryInfo` und hält fest, ob es wirft oder welchen Beleg es liefert; dann
   `site.remove()`. `pnpm --filter spiegel exec vitest run src/lib/evidence/rollback-probe.test.ts`, Ergebnis in den
   Bericht an die Koordination, Datei löschen. Danach `pnpm --filter spiegel db:generate`. Bis hier bricht der Typ
   `evidence` an `cardEntryInfo` (Liste statt Zeile); Aufgabe 1 setzt dort vorläufig `evidence: row.evidence[0] ?? null`
   ein, damit das Gate grün ist. Commit `feat(spiegel): several evidence files per card in the schema`.
2. **Name der Datei.** `src/lib/evidence/name.ts` mit `EVIDENCE_NAME_MAX = 120`, `evidenceFileName`, `shortName`.
   Tests (`name.test.ts`): Pfadteile (`C:\Users\x\IMG.jpg`, `a/b/c.pdf`), Steuerzeichen und U+202E entfernt, NFD →
   NFC, Leerraum, leer und nur Leerraum → null, 200 Zeichen → 120 mit „…“ und Endung, Name ohne Endung, `shortName` mit
   und ohne Endung, „…“ ist U+2026. `shrink.ts`: `prepareEvidence` nennt das JPEG `<Stamm>.jpg` (neue reine Funktion
   `jpegNameOf(name)`, getestet: `IMG_2041.HEIC` → `IMG_2041.jpg`, `.jpg` → `beleg.jpg`, `foto.final.png` →
   `foto.final.jpg`); `Prepared` liefert im Fehler `problem: "tooLarge" | "unreadable"` statt des Textes. Commit
   `feat(spiegel): keep the original name of an evidence file`.
3. **Texte und Rückfrage.** `src/lib/evidence/texts.ts`: `EVIDENCE_LIMIT = 10`, `type EvidenceProblem = "tooLarge" |
   "unreadable" | "printout" | "duplicate" | "failed"`, `evidenceProblemText(problem, name)`, `limitText(names)`,
   `attachedText(n)`, `evidenceCountText(n)` (mit dem Satz bei 10), `EVIDENCE_EMPTY`, `EVIDENCE_GONE`,
   `EVIDENCE_REMOVE_FAILED`, `evidenceName({ name, kind })`, `evidenceMeta(info, timeZone)`, `attachingText(k, n)`;
   `EVIDENCE_TEXTS` entfällt. `evidenceRemove({ when, name, kind, others })` in `consequences.ts`.
   Tests: `texts.test.ts` hält jeden Satz der Tabelle wörtlich, je Text kein Treffer auf `OLD_WORDS` (Semikolon, drei
   Punkte, alte Wörter); `consequences.test.ts`: `evidenceRemove` mit Namen, ohne Namen (Foto, PDF), `others` 0, 1, 2,
   in der Liste der Schreibregeln (`decisions`) mit `others: 2`. Commit `feat(spiegel): texts for several evidence
   files`.
4. **Actions.** `git mv` nach `src/lib/evidence/actions.ts` (+ Test). `attachEvidence(form)`: `shooterId`,
   `isCardIdInput`, Datei nicht leer, ≤ `EVIDENCE_MAX_BYTES`, Name `evidenceFileName(file.name)` (Anzeigename für Texte
   `evidenceName`), schnelle Zählung `db.cardEvidence.count({ where: { cardId, card: { is: own } } })` ≥ 10 →
   `limitText([name])`, Typ an den Bytes, Ausdruck-Probe wie heute, Datei schreiben, dann Transaktion: `lockCard`,
   `findFirst(own)` (sonst `EVIDENCE_GONE`), `count` ≥ 10 → Grenze, `findFirst({ cardId, sha256 })` → `duplicate`,
   `create({ cardId, sha256, contentType, size, fileName })`; ein `P2002` aus dem Unique-Index (zwei gleiche
   gleichzeitig) → `duplicate`. `own = { id: cardId, ownerId, ...VISIBLE_CARD }`. `removeEvidence(evidenceId)`: Form der
   Kennung (`EVIDENCE_ID` aus `http.ts` nach `files.ts` verschieben und exportieren), `deleteMany({ where: { id,
   card: { is: { ownerId, ...VISIBLE_CARD } } } })`, bei Erfolg `sweepUploadsSoon(db)`; sonst `EVIDENCE_GONE`.
   Tests (`actions.test.ts`, Testanlage, nur eigene Zeilen, `UPLOAD_DIR` in `mkdtemp`):
   - an Scheiben `manual`, `pdf` und `raw` (per `db.card.create` wie in `files.test.ts`) je ein Foto; Name gespeichert,
     Typ an den Bytes (PNG mit Namen `.pdf`);
   - drei Dateien nacheinander → drei Zeilen in der Folge von `storedAt`; zweimal dieselben Bytes → eine Zeile, Text
     „hängt schon an dieser Scheibe“; dieselben Bytes an zwei Scheiben → zwei Zeilen, eine Datei;
   - Grenze: mit 10 Zeilen → Grenze, keine elfte; mit 9 Zeilen zwei verschiedene gleichzeitig
     (`Promise.all`) → genau eine angehängt, die andere mit Grenze, danach `count` 10;
   - abgewiesen: fremde Scheibe, wartende (`ownerPending: true`), im Papierkorb, zu groß, unbekannter Typ (Text mit
     „.jpg“), Meyton-Ausdruck (`samplePrintout`) mit dem neuen Text und ohne Zeile;
   - keine Revision: an `manual` und `raw` vorher und nachher `cardRevision.count` und `currentRevisionId` gleich;
   - `removeEvidence`: entfernt nur die gewählte Zeile, die anderen bleiben; fremd und Papierkorb → `EVIDENCE_GONE`;
     ungültige Kennung → `EVIDENCE_GONE` ohne Abfrage.
   Commit `feat(spiegel): attach several evidence files to any own card`.
5. **Lesen.** `src/lib/evidence/queries.ts`: `interface CardEvidenceInfo { id; kind: "photo" | "pdf"; name: string |
   null; size; storedAtMs }`, `cardEvidenceList(db, { cardId, ownerId })` (`card: { is: { id, ownerId,
   ...VISIBLE_CARD } }`, `orderBy: [{ storedAt: "asc" }, { id: "asc" }]`). `CardEntryInfo` verliert `evidence`
   (Platzhalter aus Aufgabe 1 weg). Tests: Folge, Name null bleibt null, fremd, wartend und Papierkorb → `[]`. Commit
   `feat(spiegel): read the evidence list of a card`.
6. **Route.** `evidenceResponse` liest `fileName` mit und setzt `filename*` (reine Funktion `contentDisposition(type,
   name)`, getestet mit Umlaut, Leerzeichen, Anführungszeichen, `'()*`). Tests in `http.test.ts`: Kopf mit und ohne
   Namen; geteilte Scheibe ohne Sitzung 401, mit fremder Sitzung 404. Commit `feat(spiegel): evidence file keeps its
   name when saved`.
7. **Löschkette.** `files.test.ts`: dieselbe Datei an zwei Scheiben, eine Zeile entfernt → Datei bleibt
   (`removeOrphanEvidenceFiles` mit `graceMs: 0`), zweite entfernt → Datei weg. `purge.test.ts`: Scheibe ohne Quelle mit
   drei Belegen über `purgeCards(…, { lock: true })` → keine Zeile `CardEvidence` mehr, die einer anderen Scheibe mit
   derselben Prüfsumme bleibt. Commit `test(spiegel): purge and sweep with several evidence files`.
8. **Oberfläche.** `CardEvidence.tsx` neu wie oben (Props `cardId`, `when`, `evidence: CardEvidenceInfo[]`,
   `timeZone`); `CardActions` bekommt `evidence?: readonly CardEvidenceInfo[]` (Vorgabe `[]`) und rendert die Zeile für
   jede Scheibe vor `CardDiscipline`, die Zeile aus dem Zweig `entry?.kind === "entered"` fällt weg; `CardScreen`
   reicht `own.evidence` durch; die Seite lädt `cardEvidenceList`. Markup-Tests (`CardActions.test.tsx`): Zeile bei
   Scheibe ohne `entry` und ohne `fetch` (der Anlage) mit dem leeren Satz und dem Knopf; Folge Eintrag → Belege →
   Disziplin bzw. Ausdruck → Ort → Belege → Disziplin; zwei Dateien: „2 Dateien“, Namen, „Foto · … MB · …“, `<img`
   nur beim Foto mit `loading="lazy"`, „PDF“-Fläche beim PDF, Links auf `/api/evidence/<id>` mit `target="_blank"`,
   `aria-label="… entfernen"`; ohne Namen „Foto“; bei 10 der Satz und kein `#card-evidence-file`; `multiple` am Feld.
   Commit `feat(spiegel): evidence list in the card box`.
9. **Skriptprüfung** (`tools/pruefen.ts`). `handEntry`: die Beleg-Schritte auf die Liste umstellen (Zählung über
   `[data-evidence-item]`, Entfernen über `[data-evidence-remove]`). Neuer Abschnitt `evidenceList(page, href)` an der
   gemessenen Scheibe aus `pickCard` (in `main()` nach „Seite einer Scheibe am Telefon“), bei 390 × 844:
   Zahl der Belege vorher merken (`before`); zwei Dateien in einem Zug über `page.setFiles("#card-evidence-file",
   [photo, printout])`: `photo` ein PNG mit langem Namen „Ergebnisliste Rundenwettkampf Kreisliga Luftpistole Seite 1
   von 2.png“ (`ONE_PIXEL_PNG`), `printout` von `samplePrintout({ hex: PROBE_LINK })`; erwartet `before + 1` Einträge,
   der Name endet auf „.jpg“, das Vorschaubild ist geladen (`img.complete && img.naturalWidth > 0`), der Bericht nennt
   „1 Datei angehängt.“ und „Ausdruck von Meyton“; bei 390 und 360 px kein seitliches Scrollen
   (`innerWidth === Math.round(visualViewport.width)` und `scrollWidth <= innerWidth`, wie `phoneNoSideScroll`);
   × am neuen Eintrag → Rückfrage nennt den Namen und „Die Werte der Scheibe bleiben, wie sie sind.“ → „Entfernen“ →
   wieder `before` Einträge. Im `finally`: jeden Eintrag, der in der Prüfung dazukam, über die Oberfläche entfernen,
   Viewport 1280 × 900. Commit `test(spiegel): script check for several evidence files`.
10. **Im Browser prüfen** (siehe Verifikation), Befunde fixen.
11. **Doku.** `apps/spiegel/CLAUDE.md` („Von Hand eintragen“: Belege an jeder eigenen Scheibe, bis 10, mit Namen,
    `src/lib/evidence/actions.ts`, Sperre über `lockCard`, keine Revision; „Ausdrucke“ unverändert),
    `spiegel-navigation.md` (Kasten „Diese Scheibe“: Zeile „Belege“ an jeder eigenen Scheibe vor „Disziplin“; Absatz
    „Beleg“ unter „Von Hand eintragen“ → „Belege“ mit Liste, Mehrfachauswahl, Bericht je Datei, ohne Ersetzen),
    `spiegel-data-model.md` (Zeile „Beleg“ → „Belege: bis zu 10 Fotos oder PDFs je eigener Scheibe mit Originalnamen, in
    keiner Zahl“), `spiegel-roadmap.md` (SP-4.4: „Belege (bis 10, Foto oder PDF) an jeder eigenen Scheibe, 1f“).
    ADR-033 (geschützt, `vault/decisions/`): Entwurf unten an die Koordination, sie committet ihn oder gibt ihn frei;
    dazu im TL;DR-Absatz „Nachtrag 29. Oktober 2026 (1f): mehrere Belege je Scheibe.“ und in `keywords` „mehrere
    belege, ergebnisliste, originalname“. `vault-lint` grün. Commit `docs(spiegel): several evidence files per card`.
12. Letzter Commit: diesen Plan entfernen (`chore: remove the implemented evidence list plan`).

### Entwurf Nachtrag ADR-033

```markdown
## Nachtrag (29. Oktober 2026): Mehrere Belege (1f)

Entschieden mit dem User am 29. Oktober 2026 (Koordinationsplan Stufe 1, Designkonzept 1f), gebaut in 1f
([[spiegel-navigation]] „Seite einer Scheibe“). Löst „ein Beleg je eingetragener Scheibe“ aus dem Nachtrag 1d ab.

- **Belege an jeder eigenen Scheibe**, gemessen, vom Ausdruck, eingetragen oder aus Treffsicher: Fotos von
  Ergebnislisten gehören meist zu Wettkämpfen, die von der Anlage kommen. Nur der Besitzer, nicht an wartenden Scheiben,
  nie auf der geteilten Seite. Ein Beleg ist keine Angabe: Er erzeugt keine Revision und geht in keine Zahl ein.
- **Bis zu 10 je Scheibe**, je höchstens 4 MiB, mehrere Dateien in einem Zug, jede für sich: Was passt, hängt an, was
  nicht passt, steht mit Grund darunter. Die Grenze gilt unter der Sperre der Scheibe. Dieselbe Datei hängt an einer
  Scheibe nur einmal. „Ersetzen“ entfällt.
- **Originalname statt Beschriftung:** Spiegel zeigt den Namen der Datei, ohne Umbenennen (in Treffsicher war keine
  Beschriftung genutzt). Vorschaubild aus der Datei selbst, ein Tipp öffnet sie im Browser, kein eigener Betrachter.
- **Ein Meyton-Ausdruck bleibt kein Beleg**, je Datei mit dem Weg über „Scheibe holen“; Stufe 3 hängt Meyton-PDFs aus
  Treffsicher als Ausdruck an.
- Grundlage für Stufe 3: Jeder Anhang aus Treffsicher wird Ausdruck oder Beleg seiner Scheibe.
```

## Tests und Verifikation

- Vorbedingung im Worktree: `apps/spiegel/.env` und `tools/private` aus dem Haupt-Checkout verlinken (nur mit
  `[ -e … ] ||`), Node 26 im `PATH`.
- `pnpm check` im Worktree grün (lint, format, test, tsc, `next build` aller Apps), `vault-lint` grün. Das Stop-Gate
  prüft den Haupt-Checkout, nicht den Worktree: das Gate im Worktree selbst laufen lassen.
- Browser: Dev-Server aus dem Worktree auf Port **3024** (`pnpm --filter spiegel exec next dev --port 3024`, ein
  geschriebenes `AGENTS.md` danach löschen); der User meldet sich selbst an. Telefon (390 und 360 px) und Desktop, hell
  und dunkel:
  - eine gemessene Scheibe: Zeile „Belege“ leer vor „Disziplin“; drei Dateien in einem Zug (zwei Fotos, ein
    Meyton-Ausdruck): zwei hängen an, Bericht mit Grund; Vorschaubilder; langer Name einzeilig gekürzt; ein Tipp öffnet
    die Datei im neuen Tab (Foto ganz, PDF im Viewer, Speichern trägt den Namen); × fragt mit Namen und „Die anderen …
    bleiben.“; kein seitliches Scrollen;
  - eine Scheibe vom Ausdruck und eine eingetragene: dieselbe Zeile an derselben Stelle;
  - 10 Belege: Satz bei 10, kein Knopf; mit 9 drei Dateien gewählt → eine hängt an, zwei mit Grenze in einem Satz;
  - dieselbe Datei noch einmal → „hängt schon an dieser Scheibe“;
  - die geteilte Seite derselben Scheibe zeigt keine Belege; `/api/evidence/<id>` in einem Fenster ohne Anmeldung →
    Anmeldung;
  - Netzwerk: Übertragung des Kastens mit drei Fotos messen (für „Offene Punkte“ 3).
  Danach alle Test-Belege über die Oberfläche entfernen.
- Skriptprüfung `pnpm --filter spiegel pruefen` mit eigenem Build **nur auf Signal der Koordination** (Dev-Datenbank und
  Ports teilen sich die Sessions), mit dem Befehl, den die Koordination nennt.
- Nicht belegt bleibt voraussichtlich: Mehrfachauswahl aus der Fotomediathek am echten iPhone (HEIC → JPEG, Name);
  nach dem Release am iPhone prüfen.

## Offene Punkte für den Koordinator (Empfehlung zuerst)

**Entschieden am 29. Oktober 2026:** Das Konzept ist vom User mit allen Empfehlungen freigegeben. Die Punkte unten hat
der Koordinator so entschieden, wie sie empfohlen sind: dieselbe Datei einmal je Scheibe, Name verkleinerter Fotos mit
`.jpg`, Vorschaubilder mit `loading="lazy"` und Messung im Browser, Export und Tagebuch-Zeilen beim Rebase des
Basisbranchs, beim Rückweg auf ein älteres Image nichts löschen, die kleinen Abweichungen vom Konzept wie beschrieben.
Abweichungen davon meldet die Kindsession und wartet.

1. **Dieselbe Datei zweimal an einer Scheibe** (im Konzept nicht entschieden): **Empfehlung:** einmal je Scheibe
   (`@@unique([cardId, sha256])`), der Grund „„{Name}“ hängt schon an dieser Scheibe.“ im Bericht. Neuer Text, geht mit
   den anderen ins Textbuch.
2. **Name eines verkleinerten Fotos:** Der Browser zeichnet jedes Foto als JPEG neu. **Empfehlung:** Stamm des Originals
   mit Endung `.jpg` (`IMG_2041.HEIC` → `IMG_2041.jpg`), damit Name und Datei zusammenpassen. Sonst stünde
   „IMG_2041.HEIC“ an einem JPEG.
3. **Vorschaubilder laden die ganze Datei**, und `private, no-store` lädt sie bei jedem Besuch neu (bis zu 10 Fotos,
   meist 1 bis 2 MB). **Empfehlung:** in 1f so lassen, mit `loading="lazy"`; im Browser messen. Ist es am Telefon zu
   langsam, ein eigener kleiner Teil: Belege mit `private, max-age=…` ausliefern (eine Kennung bekommt nie andere
   Bytes, seit „Ersetzen“ wegfällt). Keine Vorschaubilder auf dem Server (Konzept).
4. **Export:** In `main` gibt es keinen Export, er kam mit 2a im Basisbranch (`src/lib/export/results.ts`). 1f kann ihn
   deshalb nicht ändern. **Empfehlung:** beim Rebase des Basisbranchs `RESULTS_CARD_SELECT.evidence` auf
   `{ select: { fileName: true, contentType: true, size: true, storedAt: true }, orderBy: [{ storedAt: "asc" }, { id:
   "asc" }] }` setzen und den Test des Exports anpassen. Achtung: Ohne Änderung kompiliert der Export weiter und
   liefert still eine Liste statt eines Objekts.
5. **Basisbranch beim Rebase auf `main`** (nach dem Merge von 1f) berührt: `prisma/schema.prisma` (Relation
   `Card.evidence`, Modell `CardEvidence`); `CardActions.tsx` (Prop `lines` mit `PartLineRow` oben plus die neue Prop
   `evidence` und die Zeile vor „Disziplin“; Folge dann Tagebuch, Eintrag, Ausdruck, Ort, Belege, Disziplin, wie im
   Konzept); `CardActions.test.tsx` (Fixtures mit `entry.evidence` entfallen); Export (Punkt 4); `apps/spiegel/CLAUDE.md`
   und `spiegel-navigation.md`. Geprüft: Das Vorschau-Werkzeug von 2c (`tools/diary-preview.ts`,
   `src/parts/transfer/diary-preview.ts`) und `treffsicher-sessions.sql` nutzen `CardEvidence` nicht;
   `src/parts/boundary.ts` nennt `cardEvidence` nur als Tabelle des Ergebnisteils, das bleibt richtig.
6. **Migration und Dev-Datenbank:** Nach `deploy` in 1f fehlt der Dev-Datenbank der Unique-Index auf `cardId`. Der
   Haupt-Checkout (Basisbranch) hängt bis zum Rebase per `upsert({ where: { cardId } })` an, das kann dort scheitern
   („Das ließ sich nicht speichern.“). **Empfehlung:** hinnehmen, bis der Basisbranch rebased ist; Belege im
   Haupt-Checkout bis dahin nicht prüfen. In Prod kommen die älter benannten Migrationen des Tagebuchs später als
   `20261029120000_evidence_list`; `migrate deploy` wendet fehlende in jeder Lage an, beim Release des Tagebuchs im
   Stack-E2E belegen.
7. **Rückweg auf ein älteres Image:** Ergebnis der Probe aus Aufgabe 1 entscheidet, ob vor einem Rückweg etwas zu tun
   ist. **Empfehlung:** nichts löschen; das alte Image kann dann nicht anhängen (siehe Modell).
8. **Kleine Abweichungen vom Konzept** (Empfehlung: so übernehmen): Tag mit Jahr („Sa 14.03.2026“, wie die Zeile
   „Ausdruck“) statt „Sa 14.03.“ und ohne „heute“; „Der andere Beleg bleibt.“ statt „Die anderen 1 Belege bleiben.“;
   mehrere Dateien über der Grenze in einem Satz statt je Datei; Knopf mit `Paperclip` und im Stil der anderen Zeilen
   (wie heute) statt umrandet mit „+“; die Rückfrage nennt Tag und Uhrzeit der Scheibe („vom Di 13.10.2026 um 19:12“)
   wie alle Rückfragen an der Scheibe.
9. **ADR-033, Zeile „Anhänge“ der Tabelle „Was aus Treffsicher umzieht“** („bleiben im Tagebuch“) ist seit 2b
   überholt; der Nachtrag dazu kommt laut Koordinationsplan mit 2b im Basisbranch. 1f fasst sie nicht an.

Keine neue Brücke. Migration ja (additiv, geschützter Pfad).
