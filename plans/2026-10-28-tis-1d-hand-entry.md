# 1d · Eingabe von Hand (SP-4.4)

Teilplan von Stufe 1 aus `plans/2026-10-26-treffsicher-in-spiegel.md` (Basisbranch `feat/treffsicher-in-spiegel`),
Kindsession `tis-1d-hand-entry`, Branch `feat/tis-1d-hand-entry` von `main` (`bc47bbd1`). Entscheidungen vom
28. Oktober 2026 im Koordinationsplan unter „1d Handeingabe“.

## Kontext

Spiegel kann Scheiben ohne Brücke schreiben (`writeEnteredCard`, 1a-1) und alle Detailtiefen zeigen (1a-2). Was fehlt,
ist der Weg für den Schützen selbst: ein Ergebnis von einer fremden Anlage, vom Papier oder aus dem Gedächtnis
eintragen, später ändern, einen Beleg anhängen. Dazu braucht der Admin Disziplinen ohne Meyton-ID (3 eigene Ausdrucke
blieben beim Import ohne passende Disziplin). 1d schließt Stufe 1 ab und geht als eigenes Release nach `main`.

## Schnitt

Ein Plan, ein Branch, eine Migration, in zwei Teilen in dieser Reihenfolge (Teil B baut auf der Migration aus A auf):

- **Teil A · Eingabe und Ändern:** Admin legt Disziplin ohne Meyton-ID an, „Von Hand eintragen“ in „Scheibe holen“,
  Formular für neue und eingetragene Scheiben, Ort einer Scheibe vom Ausdruck.
- **Teil B · Beleg:** Foto oder PDF an einer eingetragenen Scheibe, Speicher und Aufräumen wie die Ausdrucke.

## Ansatz

### Modell (Schema, additiv, eine Migration)

```prisma
model Card {
  …
  // die Uhrzeit ist nicht bekannt (von Hand ohne Uhrzeit eingetragen): `startedAt` ist 12 Uhr des Tags in der
  // Anzeige-Zone, gezeigt wird nur der Tag
  timeUnknown Boolean       @default(false)
  evidence    CardEvidence?
}

// Beleg einer eingetragenen Scheibe ([[adr-033]]): ein Foto oder PDF je Scheibe; die Datei liegt unter
// `UPLOAD_DIR/evidence/<sha256>.<ext>`, gleiche Bytes ergeben dieselbe Datei
model CardEvidence {
  id          String   @id @default(cuid())
  cardId      String   @unique
  card        Card     @relation(fields: [cardId], references: [id], onDelete: Cascade)
  sha256      String
  // application/pdf, image/jpeg, image/png oder image/webp, geprüft an den ersten Bytes
  contentType String
  size        Int
  storedAt    DateTime @default(now()) @db.Timestamptz(3)

  @@index([sha256])
}
```

SQL über `prisma migrate diff --from-schema-datasource … --to-schema-datamodel … --script` als
`prisma/migrations/20261028120000_hand_entry/migration.sql`, angewandt mit `migrate deploy` (Dev-Datenbank nie
zurücksetzen). Erwartet: `ALTER TABLE "Card" ADD COLUMN "timeUnknown" BOOLEAN NOT NULL DEFAULT false;`,
`CREATE TABLE "CardEvidence" …`, Unique-Index auf `cardId`, Index auf `sha256`, Fremdschlüssel mit `ON DELETE CASCADE`.
Diff und SQL gehen vor dem Commit an die koordinierende Session (Circuit-Breaker, ADR-023).

`timeKnown` in `src/lib/db/reads.ts` nimmt die Spalte dazu: `!row.timeUnknown && !(origin === "pdf" && printouts === 0)`.
Der Rückweg auf ein älteres Image braucht nichts: Es kennt die Spalte und die Tabelle nicht und liest sie nicht.

Keine Änderung an der Brücke, am Vertrag, an `compose.yml` oder `scripts/`: Der Beleg liegt im Volume `uploads_spiegel`,
das Backup und Restore schon ganz sichern (`scripts/backup.sh` `archive_uploads`).

### Teil A · Admin → Disziplinen: neue Disziplin

- Unter der Liste ein Kasten „Neue Disziplin“ (`src/components/admin/NewDisciplineForm.tsx`) mit Name, Familie,
  Scheibe, Schusszahl, Serienlänge und Wertung, dieselben `Segmented` wie im `DisciplineForm`. Pflicht: Name, Familie,
  Scheibe (sonst wäre sie nicht wählbar, `choosable`). Schusszahl: Zahl oder „keine feste“ (0). Serienlänge: Zahl oder
  „ohne Serien“ (0); vorbelegt 10, wenn die Schusszahl ein Vielfaches von 10 ist. Wertung: Zehntel, ganze Ringe, wie
  eingetragen (null).
- „Anlegen“ fragt über `DecisionDialog` mit `disciplineCreate` aus `src/lib/admin/consequences.ts`.
- Action `createDiscipline` in `src/lib/admin/discipline-actions.ts`: `adminActor`, Zod, erste Anlage, in einer
  Transaktion mit `pg_advisory_xact_lock(hashtext('discipline-name'))` den Namen auf der Anlage ohne Groß- und
  Kleinschreibung und Leerraum am Rand prüfen (Fehler am Feld „Name“), dann `discipline.create` mit `meytonId: null`,
  `confirmedAt: now()`. Familie muss existieren.
- `saveDiscipline` und `DisciplineForm` bekommen die Serienlänge dazu (gleiches Formular für gleiche Angabe); sie ändert
  keine gespeicherten Scheiben (die Schusszahl einer Serie steht an der Summe), also keine neue Version. Für eine
  Disziplin ohne Meyton-ID zeigt `DisciplineForm` die Wahl „aus der ID“ nicht (`fromIdLabel(null)`), Vorgabe ist dann
  die gespeicherte Zahl.

### Teil A · Einstieg in „Scheibe holen“

- `ScanScreen` bekommt als fünfte Karte (nach „ID eintippen“) den Weg `"hand"`: Titel, Satz, Knopf „Eintragen“. Der
  Knopf öffnet `NewCardSheet` ohne ID-Zeile (`idLine` wird optional) mit dem Knopf „Weiter“ statt „Scheibe anlegen“
  (neue Prop `confirmLabel`). „Weiter“ führt zu `/cards/new?discipline=<id>&kind=<kind>`; nichts wird angelegt, bevor
  das Formular gespeichert ist.
- Neue Seite `src/app/(app)/cards/new/page.tsx`: `requireUser`, Disziplin muss in `newCardChoices(…).options` stehen,
  sonst `redirect("/scan")`. Lädt Disziplin (Name, Familie, `plannedShots`, `seriesShots`, `officialScoring`), die
  Ortsvorschläge und heute in der Anzeige-Zone. Rendert `EnteredCardForm` (Modus „neu“).

### Teil A · Formular `EnteredCardForm`

Datei `src/components/entered/EnteredCardForm.tsx`, Logik rein in `src/lib/entered/form.ts` (Tests), Action in
`src/lib/entered/actions.ts`. Eine Spalte, `PAGE_SINGLE`, Formular `max-w-lg`. Felder gesteuert (`value`/`onChange`,
conventions §9), `useUnsavedChangesGuard` + `useNavigationConfirm` mit Verwerfen-Dialog (`DecisionDialog`).

1. **Kopf:** Titel „Ergebnis eintragen“ (beim Ändern „Eintrag ändern“), darunter leise Disziplin · Art; beim Anlegen
   ein Knopf „Ändern“, der dasselbe `NewCardSheet` öffnet (Wahl ändert die Adresse per `router.replace`).
2. **Wann und wo:** Tag (`type="date"`, `max` heute, vorbelegt heute), Uhrzeit (`type="time"`, optional, leer), Ort
   (Freitext, `PLACE_MAX` 80, `<datalist>` mit den eigenen Orten). Ohne Uhrzeit: `startedAt` = 12 Uhr des Tags in der
   Anzeige-Zone, `timeUnknown: true`.
3. **Werte in:** `Segmented` „Zehntel“ | „ganzen Ringen“, vorbelegt aus `officialScoring` der Disziplin (`rings` →
   ganze Ringe, sonst Zehntel); beim Ändern aus den gespeicherten Werten (`enteredScoring`).
   - Zehntel: Eingabe mit Komma oder Punkt, „97“ heißt 97,0. Gespeichert als `decimalTenths`, Ring leer (folgt).
   - Ganze Ringe: nur ganze Zahlen, sonst Feldfehler. Gespeichert als `rings`.
   - Ein Wechsel rechnet nichts um; vorhandene Eingaben bleiben stehen und werden beim Speichern neu geprüft.
4. **Ergebnis:** `Segmented` „Serien“ | „nur Gesamtergebnis“. Vorbelegt „Serien“, wenn die Disziplin eine Serienlänge
   hat (`seriesShotsOf`), sonst „nur Gesamtergebnis“ (dann ist „Serien“ nicht wählbar).
   - **Serien:** so viele Zeilen wie `plannedShots / seriesShots` (aufgerundet), bei „keine feste Schusszahl“ eine;
     „Serie hinzufügen“ und bei der letzten leeren Zeile „Entfernen“. Jede Zeile: „Serie n“, Feld Summe, darunter
     aufklappbar „Schüsse einzeln“ (`<details>`-artig, Knopf mit `aria-expanded`). Aufgeklappt: Felder für die Schüsse
     der Serie (Serienlänge, Raster 5 je Reihe am Telefon), die Summe wird dann aus den Schüssen gerechnet und ist
     gesperrt. Leere Zeilen am Ende zählen nicht (eine abgebrochene Scheibe). Eine leere Zeile zwischen gefüllten ist ein
     Fehler am Feld.
   - **Schüsse einzeln in allen oder keiner Serie:** `checkDetails` verlangt Schüsse in jeder Serie, sobald eine Serie
     Schüsse hat. Ist eine Serie aufgeklappt und gefüllt und eine andere nur als Summe da, zeigt das Formular den Fehler
     an der Summe ohne Schüsse. Siehe „Offene Frage 1“.
   - Gesamtergebnis darunter, gerechnet aus den Serien, nur Anzeige.
   - **Nur Gesamtergebnis:** Feld Ergebnis und Feld Schusszahl (vorbelegt `plannedShots`, leer erlaubt nur mit
     Schusszahl der Disziplin), ohne Serien.
5. **Trefferlage (optional):** zwei Zeilen wie Treffsicher: „waagrecht“ mm + `Segmented` „links“ | „rechts“,
   „senkrecht“ mm + „hoch“ | „tief“. Gespeichert als `center` in µm (rechts und hoch positiv, wie `xUm`/`yUm`), auf
   0,1 mm. Nur mit Ergebnis (`centerWithoutResult`).
6. **Speichern:** Knopf „Speichern“ (pending „Speichern…“). Bei Erfolg Toast „Scheibe eingetragen.“ bzw. „Änderung
   gespeichert.“ und `router.push("/cards/<id>")`.

**Reine Funktionen in `src/lib/entered/form.ts`:**

- `parseValue(text, mode, max)`: `{ ok, rings?, decimalTenths? } | { ok: false, error }`; Zehntel höchstens eine
  Nachkommastelle, Grenzen `10` bzw. `MAX_DECIMAL_TENTHS` je Schuss und `·Schusszahl` je Summe.
- `formToDetails(state, discipline)`: `DetailsInput` (Schüsse mit `series`, Serien mit `shots` nur wenn aufgeklappt
  = Zahl der Schüsse, Gesamtergebnis nur im Modus „nur Gesamtergebnis“ mit `shots`, `center`) oder Feldfehler je Pfad
  (`series.2.sum`, `series.2.shots.4`, `total`, `center.x`).
- `detailsToForm(revision)`: der Zustand des Formulars aus der aktuellen Revision (Schüsse, Serien-Summen, Gesamt,
  Mitte, Modus der Werte); jede gespeicherte Detailtiefe ergibt einen Zustand, der unverändert gespeichert
  `change: "unchanged"` ergibt (Test über alle Demo-Formen aus `seed:own --demo`).
- `problemText(DetailsProblem)`: Feldpfad und Text zu jedem Problem aus `checkDetails` (Tabelle unten).
- `startedAtOf(day, time, timeZone)`: ms und `timeUnknown`; Tag in der Zukunft ist ein Fehler.

**Action `saveEnteredCard(input)`** (`"use server"`, nur direkt deklarierte async-Funktionen): `shooterId`, Zod über
das Objekt (kein FormData), Disziplin aus `newCardChoices` der eigenen Anlage oder die bisherige der Scheibe,
`formToDetails`, dann `writeEnteredCard` mit `origin: "manual"`, `reason: "von Hand eingetragen"` bzw. `"von Hand
geändert"`, `kindChoice` beim Anlegen. `timeUnknown` schreibt `writeEnteredCardIn` mit (neues Feld in
`EnteredCardInput`, fehlt: nicht anfassen). Ergebnis als `ActionResult<{ cardId }>`, Fehler je Feld. `missing` →
„Diese Scheibe gibt es nicht mehr.“, `notEditable` → allgemeiner Fehler (siehe Texte).

### Teil A · Ändern

- **Eingetragene Scheiben** (`origin` `manual` oder `treffsicher`): in „Diese Scheibe“ eine neue erste Zeile
  `CardEntry` („Eintrag“): Zustand „Von Hand eingetragen“ (bzw. „Aus Treffsicher übernommen“), Aktion „Ändern“ →
  `/cards/<id>/edit`. Die Seite lädt die aktuelle Revision (`detailsToForm`), Tag, Uhrzeit, Ort, und rendert
  `EnteredCardForm` im Modus „ändern“. Disziplin und Art bleiben in ihren Zeilen auf der Seite der Scheibe (wie heute),
  das Formular zeigt sie nur. Löschen bleibt `DeleteCard`.
- Jede geänderte Angabe ergibt über `writeEnteredCard` eine neue Revision; gleiche Werte ändern nur Tag, Uhrzeit und
  Ort an der Scheibe (siehe „Offene Frage 2“).
- **Scheiben vom Ausdruck** (`pdf`): keine Werte, aber eine Zeile „Ort“ (`CardPlace`) mit „Ändern“, das ein kleines
  Blatt mit dem Freitext und den Vorschlägen öffnet; Action `setCardPlace(cardId, place)` (nur `pdf`, `manual`,
  `treffsicher`, eigene, sichtbare). **Scheiben der Anlage** (`raw`): Ort ist die Anlage, keine Zeile (siehe „Offene
  Frage 3“).

### Teil B · Beleg

- Zeile „Beleg“ (`CardEvidence.tsx`) in „Diese Scheibe“ direkt nach „Eintrag“, nur bei eingetragenen Scheiben. Ohne
  Beleg: Satz und Knopf „Foto oder PDF anhängen“ (`<input type="file" accept="image/*,application/pdf">`, verstecktes
  Feld mit Label wie „PDF wählen“ in `ScanScreen`). Mit Beleg: „Foto“ oder „PDF“, Größe, Tag; Aktionen „Öffnen“
  (`Download`-Symbol wie `PdfLink`), „Ersetzen“, „Entfernen“ (mit `DecisionDialog` `evidenceRemove`).
- **Im Browser** (`src/lib/entered/shrink-image.ts`, rein bis auf Canvas): Bilder über `createImageBitmap` mit
  `imageOrientation: "from-image"` auf höchstens 2400 px lange Kante, `canvas.toBlob("image/jpeg", 0.85)`, bei mehr als
  `EVIDENCE_MAX_BYTES` (4 MiB, Luft unter den 5 MiB von Caddy für das Formular) Qualität 0,7, dann 1600 px, dann Fehler.
  Ein PDF über 4 MiB geht nicht los (Fehler am Weg, wie `tooLarge`). HEIC wird so zu JPEG, wo der Browser es lesen
  kann; sonst Fehler „nicht lesbar“.
- **Action `attachEvidence(form: FormData)`** in `src/lib/entered/evidence-actions.ts`: eigene, sichtbare,
  eingetragene Scheibe; Größe ≤ `EVIDENCE_MAX_BYTES`; Typ an den ersten Bytes (`%PDF-`, `FF D8 FF`, `89 50 4E 47`,
  `RIFF…WEBP`), nicht am Namen. Ein PDF bis `DEFAULT_LIMITS.maxBytes` liest Spiegel zuerst wie einen Ausdruck
  (`storePrintout(…, { write: false })`): Ergibt das eine ID im Fuß, speichert Spiegel nichts und sagt, dass es ein
  Ausdruck von Meyton ist und wie er unter „Scheibe holen“ seine Werte bringt. Sonst Datei schreiben
  (`writeEvidenceFile`, atomar wie `writePrintoutFile`) und in einer Transaktion `CardEvidence` per `upsert` setzen
  (ersetzt den alten). `removeEvidence(cardId)` löscht die Zeile.
- **Dateien** `src/lib/evidence/files.ts`: `evidenceDir()` = `uploadDir()/evidence`, `evidencePath(sha256, type)`,
  Endungen `pdf`, `jpg`, `png`, `webp`. Das Aufräumen aus `printouts/files.ts` wird allgemein (`filesToRemove` mit
  Muster je Verzeichnis), `removeOrphanEvidenceFiles` läuft dort, wo `sweepPrintoutsSoon` läuft (neuer Name
  `sweepUploadsSoon`, ruft beide). Die Sperre „gar keine Scheibe“ gilt für beide Verzeichnisse.
- **Ausliefern** `src/app/api/evidence/[id]/route.ts`: nur der Besitzer einer sichtbaren Scheibe (wie
  `/api/printouts/[id]`), `Content-Type` aus der Zeile, `Content-Disposition: inline`, `X-Content-Type-Options:
  nosniff`, `Content-Security-Policy: sandbox`, `Cache-Control: private, no-store`. Nicht auf `/share`.

## Skizze der Eingabe (Telefon, Serie 2 aufgeklappt)

```
┌─────────────────────────────────┐
│ ← Scheibe holen                 │
│ Ergebnis eintragen              │
│ Luftgewehr · Training   [Ändern]│
├─────────────────────────────────┤
│ Tag [28.10.2026]  Uhrzeit [--:--]│
│ Ort [Schützenhaus Musterdorf  ▾]│
├─────────────────────────────────┤
│ Werte in  (Zehntel)( ganzen R.) │
│ Ergebnis  ( Serien )( nur Ges.) │
│                                 │
│ Serie 1          [ 102,4 ]      │
│   Schüsse einzeln ▸             │
│ Serie 2          [ 101,9 ] 🔒    │
│   Schüsse einzeln ▾             │
│   [10,4][ 9,8][10,7][10,1][10,0]│
│   [10,3][ 9,9][10,5][10,2][10,0]│
│ Serie 3          [       ]      │
│   Schüsse einzeln ▸             │
│ Serie 4          [       ]      │
│   Schüsse einzeln ▸             │
│ + Serie hinzufügen              │
│ Gesamt  204,3 · 20 Schuss       │
├─────────────────────────────────┤
│ Trefferlage (optional)          │
│ waagrecht [ 1,2] mm (links)(re.)│
│ senkrecht [ 0,8] mm (hoch)(tief)│
├─────────────────────────────────┤
│        [   Speichern   ]        │
└─────────────────────────────────┘
```

(🔒: die Summe kommt aus den Schüssen. Serie 3 und 4 leer am Ende: Scheibe mit 20 von 40 Schuss, „unvollständig“.)

## Neue Texte (gehen erst zum User, dann ins Textbuch Spiegel, dann in den Code)

| Stelle | Text |
| --- | --- |
| Scheibe holen, Karte „hand“, Titel | Von Hand eintragen |
| … Satz | Für eine Scheibe ohne Ausdruck, etwa von einer anderen Anlage oder vom Papier. |
| … Knopf | Eintragen |
| Blatt „Neue Scheibe“, Satz beim Weg von Hand | Wähle Disziplin und Art. Danach trägst du die Werte ein. |
| … Knopf | Weiter |
| Formular, Titel neu / ändern | Ergebnis eintragen / Eintrag ändern |
| Formular, Kopf, Knopf | Ändern |
| Feld Tag / Uhrzeit / Ort | Tag / Uhrzeit (wenn bekannt) / Ort |
| Ort, Platzhalter | etwa Schützenhaus Musterdorf |
| Werte in | Werte in · Zehnteln · ganzen Ringen |
| Ergebnis | Ergebnis · Serien · nur Gesamtergebnis |
| Serie | Serie 1, Serie 2, … · Summe |
| Aufklappen | Schüsse einzeln |
| Summe gesperrt, leise | aus den Schüssen |
| Serien, Knöpfe | Serie hinzufügen · Entfernen |
| Gesamt, Zeile | Gesamt 204,3 · 20 Schuss |
| Nur Gesamtergebnis, Felder | Ergebnis · Schusszahl |
| Trefferlage | Trefferlage (wenn bekannt) · waagrecht · senkrecht · links · rechts · hoch · tief · mm |
| Trefferlage, Satz | Die Mitte deiner Schüsse, wie sie die Anlage anzeigt. |
| Knopf | Speichern · Speichern… |
| Toast neu / ändern | Scheibe eingetragen. / Änderung gespeichert. |
| Verwerfen, Titel | Eingaben verwerfen? |
| … about / happens / not / undo / Knopf | Du hast Werte eingetragen, aber nicht gespeichert. · Spiegel vergisst diese Eingaben. · Keine gespeicherte Scheibe ändert sich. · Nicht rückgängig zu machen. Die Werte noch einmal eintragen. · Verwerfen |
| Fehler Wert, Zehntel | Gib den Wert mit höchstens einer Stelle nach dem Komma ein, etwa 10,4. |
| Fehler Wert, ganze Ringe | Gib ganze Ringe ein, etwa 97. Für Zehntel oben „Zehnteln“ wählen. |
| Fehler Wert zu groß (Schuss / Summe) | Ein Schuss hat höchstens 10,9. / So viel geht mit {n} Schuss nicht. |
| Fehler Lücke in den Serien | Trag Serie {n} ein oder lass die Serien danach leer. |
| Fehler Schüsse nur in einigen Serien | Trag die Schüsse in jeder Serie einzeln ein, oder in keiner. |
| Fehler Schüsse ≠ Serienlänge (`seriesShots`) | Serie {n} hat {k} von {m} Schuss. |
| Fehler kein Ergebnis | Trag mindestens eine Serie oder das Ergebnis ein. |
| Fehler Schusszahl fehlt (`totalShotsUnknown`) | Wie viele Schüsse waren es? |
| Fehler Trefferlage (`centerValue`) | Die Trefferlage liegt höchstens 100 mm neben der Mitte. |
| Fehler Trefferlage ohne Ergebnis | Die Trefferlage braucht ein Ergebnis. |
| Fehler Tag in der Zukunft / ungültig | Der Tag liegt in der Zukunft. / Wähle einen Tag. |
| Fehler Ort zu lang | Der Ort hat höchstens 80 Zeichen. |
| Fehler nicht änderbar | Diese Scheibe kommt von der Anlage oder vom Ausdruck. Ihre Werte ändert Spiegel nicht. |
| Diese Scheibe, Zeile Eintrag, Zustand | Von Hand eingetragen · Aus Treffsicher übernommen |
| … Aktion | Ändern |
| Zeile Ort (vom Ausdruck), Zustand ohne Ort | Kein Ort angegeben |
| Blatt Ort, Titel / Knopf | Ort der Scheibe / Speichern |
| Zeile Beleg, ohne | Ein Foto vom Papier oder ein PDF, damit du später nachsehen kannst. |
| … Knopf | Foto oder PDF anhängen · Wird angehängt… |
| … mit Beleg | Foto, 1,2 MB, angehängt Di 28.10.2026 · PDF, … |
| … Aktionen | Öffnen · Ersetzen · Entfernen |
| Beleg ist ein Meyton-Ausdruck | Das ist ein Ausdruck von Meyton. Hole ihn unter „Scheibe holen“ mit „PDF hochladen“, dann übernimmt Spiegel seine Werte. Der Beleg ist nicht angehängt. |
| Beleg zu groß / nicht lesbar | Die Datei ist zu groß, auch verkleinert. / Spiegel kann diese Datei nicht lesen. Nimm ein Foto (JPEG, PNG) oder ein PDF. |
| Beleg entfernen, Titel | Beleg entfernen? |
| … about / happens / not / undo / Knopf | An dieser Scheibe hängt ein Foto (bzw. ein PDF). · Spiegel entfernt den Beleg von der Scheibe. · Die Werte der Scheibe bleiben, wie sie sind. · Den Beleg wieder anhängen, solange du die Datei noch hast. · Entfernen |
| Admin, Kasten | Neue Disziplin |
| … Satz | Für Scheiben, die nicht von der Anlage kommen. Meyton-Disziplinen legt Spiegel selbst an. |
| … Felder | Name · Familie · Scheibe · Schusszahl (Zahl, keine feste) · Serienlänge (Zahl, ohne Serien) · Wertung (Zehntel, ganze Ringe, wie eingetragen) |
| … Knopf | Anlegen |
| … Fehler Name doppelt / leer | Eine Disziplin mit diesem Namen gibt es schon. / Gib der Disziplin einen Namen. |
| Folgen-Dialog Anlegen, Titel | „{Name}“ anlegen? |
| … about | Die Disziplin kommt nicht von Meyton. |
| … happens | Schützen können sie wählen, wenn sie eine Scheibe von Hand eintragen oder holen. · Sie steht in der Familie „{Familie}“ und wird als {Scheibe} gezeichnet. · Eine Scheibe ist mit {n} Schüssen vollständig. (bzw. „sobald sie fertig ist“) |
| … notHappening | Scheiben der Anlage ordnet Spiegel ihr nicht zu. |
| … undo | Unter der Disziplin auf „Ignorieren“ tippen. Dann ist sie nicht mehr wählbar. |
| … Knopf | Anlegen |
| Admin, Formular, Feld neu | Serienlänge |
| Admin, Kopftext (ersetzt „Neue Disziplinen legt Spiegel selbst an, …“) | Meyton nennt jede Disziplin mit Nummer und Namen. Hier legst du fest, wie Spiegel ihre Scheiben zeigt und zählt. Disziplinen von Meyton legt Spiegel selbst an, sobald die erste Scheibe kommt; andere legst du unten an. |

## Offene Fragen (Empfehlung zuerst)

1. **Schüsse einzeln nur in einigen Serien:** Das Modell aus 1a-1 (`checkDetails`, Projektion, Kennzahlen) verlangt
   Schüsse in jeder Serie, sobald eine Serie sie hat. **Empfehlung:** in 1d so lassen, das Formular sagt „Trag die
   Schüsse in jeder Serie einzeln ein, oder in keiner.“ Gemischt zu speichern, zieht `checkDetails`,
   `revisionCounts`, Projektion und Ø je Schuss nach sich (eigener Teil, wenn der Bedarf kommt).
2. **„Jede Änderung als neue Revision“:** Revisionen tragen nach ADR-031 die Angaben (Werte). Tag, Uhrzeit und Ort
   stehen an der Scheibe wie Disziplin und Art und haben keinen Verlauf. **Empfehlung:** Werte als neue Revision, Tag,
   Uhrzeit und Ort an der Scheibe ohne Verlauf (wie Disziplin und Art heute). Sonst bräuchte `CardRevision` Spalten für
   Beginn und Ort.
3. **„Ort wie heute“** bei Scheiben vom Ausdruck oder der Anlage: Heute ist der Ort nirgends änderbar. **Empfehlung:**
   Zeile „Ort“ für Scheiben vom Ausdruck (Freitext), keine für Scheiben der Anlage (ihr Ort ist die Anlage).
4. **Beleg auch im Formular?** **Empfehlung:** nur im Kasten „Diese Scheibe“, wie der Ausdruck; nach dem Speichern
   öffnet sich die Seite, die Zeile „Beleg“ steht dort.

## Dateien

Neu: `apps/spiegel/prisma/migrations/20261028120000_hand_entry/migration.sql`,
`src/app/(app)/cards/new/page.tsx`, `src/app/(app)/cards/[id]/edit/page.tsx`, `src/app/api/evidence/[id]/route.ts`,
`src/components/entered/EnteredCardForm.tsx` (+ `SeriesRows.tsx`, `CenterFields.tsx`), `src/components/card/CardEntry.tsx`,
`src/components/card/CardPlace.tsx`, `src/components/card/CardEvidence.tsx`, `src/components/admin/NewDisciplineForm.tsx`,
`src/lib/entered/form.ts`, `src/lib/entered/actions.ts`, `src/lib/entered/evidence-actions.ts`,
`src/lib/entered/shrink-image.ts`, `src/lib/entered/places.ts` (Ortsvorschläge), `src/lib/evidence/files.ts`,
`src/lib/card-place-actions.ts`; Tests je Modul.

Geändert: `prisma/schema.prisma`, `src/lib/db/entered.ts` (`timeUnknown`), `src/lib/db/reads.ts` (`timeKnown`),
`src/lib/printouts/files.ts` (allgemeines Aufräumen), Aufrufer von `sweepPrintoutsSoon`,
`src/components/scan/ScanScreen.tsx`, `src/components/scan/NewCardSheet.tsx`, `src/components/card/CardActions.tsx`,
`src/components/card/CardScreen.tsx` und `src/app/(app)/cards/[id]/page.tsx` (Herkunft, Ort, Beleg an `CardActions`),
`src/lib/admin/discipline-actions.ts`, `src/lib/admin/consequences.ts`, `src/components/admin/DisciplineForm.tsx`,
`src/app/(app)/admin/disciplines/page.tsx`, `src/lib/fetch-card/texts.ts`, `tools/seed-own.ts` (Demo: eine eingetragene
Scheibe ohne Uhrzeit), `tools/pruefen.ts`.

Vault: `vault/spiegel/spiegel-roadmap.md` (SP-4.4 umgesetzt), `vault/spiegel/spiegel-data-model.md` (`timeUnknown`,
`CardEvidence`), Note der Seite einer Scheibe und von „Scheibe holen“ (Wege, Kasten „Diese Scheibe“), ADR-033 Nachtrag
(Beleg, Disziplin ohne Meyton-ID angelegt vom Admin), Admin-Note Disziplinen.

## Required Docs

- `vault/conventions.md` §2 (Diese Scheibe, DecisionDialog, Datenverlust), §3, §9 (gesteuerte Formulare), §10 (Texte)
- `vault/decisions/adr-033.md`, `adr-031.md`, `adr-028.md` (Ausdruck, Upload-Grenzen)
- `vault/spiegel/spiegel-data-model.md`, `apps/spiegel/CLAUDE.md`, `packages/ui/CLAUDE.md`
- `apps/spiegel/src/lib/entered/details.ts`, `src/lib/db/entered.ts`, `src/components/scan/ScanScreen.tsx`

## Aufgaben

**Teil A**

1. Schema und Migration (Circuit-Breaker): Modell oben, `migrate diff` → SQL, Diff und SQL an die Koordination, nach OK
   `migrate deploy` auf Dev und `db:generate`. Commit `feat(spiegel): card time unknown and evidence in the schema`.
2. `timeUnknown` in `EnteredCardInput`/`writeEnteredCardIn` (Anlegen setzt, Ändern setzt wenn gegeben) und
   `timeKnown`; Tests in `entered.test.ts` und `reads`-Test (Scheibe von Hand ohne Uhrzeit zeigt nur den Tag).
3. `createDiscipline` + `disciplineCreate` + Serienlänge in `saveDiscipline`; Tests: Admin nötig, Name doppelt
   (Groß/Klein, Leerraum), unbekannte Familie, Scheibe Pflicht, `meytonId` null, `confirmedAt` gesetzt, wählbar in
   `newCardChoices`; Wortlaut-Test in `consequences.test.ts` (inkl. `OLD_WORDS`).
4. `NewDisciplineForm` + Seite + `DisciplineForm` (Serienlänge, „aus der ID“ nur mit Meyton-ID); Markup-Tests.
5. `src/lib/entered/form.ts` mit Tests: `parseValue` (Komma, Punkt, „97“ = 970 Zehntel, „9,75“ Fehler, ganze Ringe
   „9,7“ Fehler, Grenzen), `formToDetails` (Serien, Schüsse einzeln, Lücke, gemischt, nur Gesamt mit/ohne Schusszahl,
   Mitte links/hoch → negatives x/positives y, leere Endzeilen), `detailsToForm` rund (jede Demo-Form ergibt
   `unchanged`), `problemText` für jedes `DetailsProblem` (Test über die Union), `startedAtOf` (Zone, Zukunft,
   ohne Uhrzeit 12 Uhr).
6. `saveEnteredCard` mit Tests (gegen die Dev-Datenbank nur eigene Zeilen, Testanlage wie `entered.test.ts`): anlegen,
   ändern (neue Revision, gleiche Werte `unchanged`), fremde Scheibe `missing`, Scheibe der Anlage `notEditable`,
   Disziplin nicht wählbar.
7. `EnteredCardForm` + `/cards/new` + `/cards/[id]/edit`, Verwerfen-Dialog; Markup-Tests (Felder, Serien-Zahl aus der
   Disziplin, Summe gesperrt bei aufgeklappter Serie, „Serien“ gesperrt ohne Serienlänge).
8. `ScanScreen` Weg `"hand"`, `NewCardSheet` (`idLine` optional, `confirmLabel`, Satz); Tests anpassen.
9. `CardEntry`, `CardPlace` + `setCardPlace` (Tests: nur eigene, nicht `raw`, `normalizePlace`), Einbau in
   `CardActions`; `CardActions.test.tsx` je Herkunft (welche Zeilen erscheinen).
10. `seed:own --demo`: eine eingetragene Scheibe ohne Uhrzeit; Skriptprüfung: holen → von Hand → Blatt → Formular
    (Serie aufklappen, Schüsse) → speichern → Seite zeigt Werte und „eingetragen“ → ändern → gespeicherte Revision →
    löschen.

**Teil B**

11. `src/lib/evidence/files.ts` + allgemeines Aufräumen in `printouts/files.ts` (`sweepUploadsSoon`); Tests wie
    `files.test.ts` (Muster je Verzeichnis, `.tmp-`, Sperre ohne Scheiben, fremde Namen bleiben).
12. `attachEvidence`/`removeEvidence` mit Tests: Typ an Bytes (Bild mit `.pdf`-Namen, Text mit `.jpg`), zu groß, fremde
    Scheibe, Scheibe vom Ausdruck abgelehnt, Meyton-Ausdruck erkannt (Fixture aus `printouts/__fixtures__`) und nicht
    gespeichert, Ersetzen lässt die alte Datei dem Aufräumen.
13. `/api/evidence/[id]` mit Tests (Besitzer, fremd 404, Papierkorb 404, Kopfzeilen).
14. `shrink-image.ts` (reine Teile getestet: Zielgröße aus Maßen, Stufenfolge) + `CardEvidence`-Zeile, Einbau;
    Markup-Tests; Skriptprüfung: Foto anhängen (PNG-Fixture), öffnen, entfernen.
15. Vault-Notes und ADR-033-Nachtrag, Lessons; Plan per letztem Commit entfernen.

## Tests und Verifikation

- `pnpm check` im Worktree grün (lint, format, test, tsc, `next build` aller Apps), Vault-Lint grün.
- Browser (Dev-Server Port 3022 aus dem Worktree, Demo-Konto): Telefonbreite und Desktop, hell und dunkel; neue
  Disziplin anlegen (Admin), von Hand eintragen mit Serien, mit Schüssen einzeln, nur Gesamtergebnis, ohne Uhrzeit, mit
  Trefferlage; Seite der Scheibe, Liste, Fortschritt zeigen die Scheibe mit Grund und Grundlage; ändern; Beleg als Foto
  (iPhone-Foto aus Fixture, verkleinert) und als PDF, Meyton-PDF als Beleg abgelehnt; Ort an einer Scheibe vom
  Ausdruck. Danach Demo-Daten aufräumen und `seed:own --email <Konto des Users>` in **einem** Befehl.
- `pnpm --filter spiegel pruefen` grün.
- Nicht belegt bleibt voraussichtlich: HEIC-Foto am echten iPhone (der Browser im Pane kann HEIC nicht erzeugen).

Keine neue Brücke. Migration ja (additiv).
