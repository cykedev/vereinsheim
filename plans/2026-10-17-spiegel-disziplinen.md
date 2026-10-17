# Plan: Spiegel — Disziplinen im Admin einordnen (Stufe 1)

> PIV-Handoff-Artefakt. Branch `feat/spiegel-disziplinen`, im Worktree
> `.claude/worktrees/spiegel-disziplinen-mapping-f1338a` (ADR-024). **Schema-Änderung mit Migration (T1, geschützter
> Pfad, interaktiv)**, kein Deploy-Vertrag, keine ADR berührt, **kein Update der Brücke** nötig. Ein Commit je Task.

## Context (warum)

Meyton nennt jede Disziplin nur mit DisziplinID und Namen; eine Tabelle der Disziplinen hat die SSMDB2 nicht. Spiegel
legt eine `Discipline` beim ersten Sehen an (`disciplineFor` in `apps/spiegel/src/lib/ingest/ingest.ts`) und rät dabei
Scheibenbild und Familie aus dem Fachkern. Danach lässt sich nichts mehr ändern (`setDisciplineFamily` hat keinen
Aufrufer). Folgen heute:

- Die amtliche Wertung (`officialScoring`) bleibt immer leer (SF-74). Ein Wettkampf zählt deshalb nie in der Wertung der
  Disziplin.
- Die Schusszahl kommt nur aus den letzten drei Ziffern der ID. „Kranzl LG“ (`19200020`, geschossen 3) ist so immer
  unvollständig, „LG 40 nachhalten“ (`19000010`, geschossen 11) immer über Soll. Unvollständige zählen nie für Rekorde.
- Scheiben ohne Familie oder Scheibenbild fehlen in allen Übersichten (`listable` in `apps/spiegel/src/lib/pages.ts`),
  die Seite der Scheibe antwortet 404. Eine vereinseigene Disziplin, die der Fachkern nicht kennt, verschwindet still.
- Die Familie bestätigt niemand (SF-64), eigene Familien gibt es nicht.

Datenlage (Kopie der Vereinsanlage vom 9. Oktober 2026, nur gezählt): 39 Disziplinen, 1.532 Scheiben. 14 sportliche
(LG/LP 20, 40, 60, „alt“, Auflage 30, Liga) tragen rund 90 % der Scheiben und kennt der Katalog. Dazu kommen
Zimmerstutzen, König LG/LP (verdeckt, kommt nie hoch), Kranzl, „LG 40 nachhalten“, Meytons Trainingsscheiben,
„LG Training Spiegel“ und 18 Vereinsspiele. Die Anzeige am Stand passt klar zur Wertung: LG 40 alt zu 96 % ganze Ringe,
LG Auflage 30 zu 95 % Zehntel.

**Leitregel (Vorgabe des Users):** Der Verein definiert gelegentlich neue Disziplinen. Spiegel muss jederzeit mit einer
Disziplin zurechtkommen, die es noch nie gesehen hat. Eine Scheibe darf „unkonfiguriert“ ankommen; nichts geht
verloren, und sobald ein Admin die Disziplin einordnet, erscheinen die wartenden Scheiben von selbst, richtig gerechnet.

## Annahmen (bitte vor der Freigabe prüfen)

Der Vorschlag mit den offenen Fragen hat den User nicht erreicht. Der Plan nimmt deshalb diese Antworten an:

- **A1** Vereinsspiele, Meytons Trainingsscheiben, „LG Training Spiegel“ und Zimmerstutzen bekommen „Eigene Scheibe“.
  Ihre Scheiben zeigt Spiegel in Stufe 1 weiter nicht. Ein neutrales Raster für Scheiben ohne Scheibenbild (SF-17) ist
  ein eigenes Feature.
- **A2** Beim Eintreffen gilt der Vorschlag des Fachkerns sofort, wie heute: Katalog und Name ergeben Scheibenbild und
  Familie, die Scheiben sind gleich sichtbar. Ohne Vorschlag wartet die Scheibe. In beiden Fällen bekommt der Admin eine
  Aufgabe.
- **A3** Die amtliche Wertung setzt nur der Admin. Spiegel zeigt dazu, was am Stand meist angezeigt wurde, setzt es
  aber nie selbst (SF-74).
- **A4** König LG/LP: Anzeigeart 5 (verdeckt), die Brücke schickt sie nie. Nichts zu tun.
- **A5** Eine gebündelte Aufgabe in der Übersicht für alle neuen Disziplinen mit Scheiben, keine je Disziplin.

## Approach

**Ankommen wie die Listen, einordnen beim Admin.** Das Einlesen legt eine Disziplin weiter beim ersten Sehen an, mit
dem Vorschlag des Fachkerns. Neu ist eine Zeit `confirmedAt`: Solange sie fehlt, ist die Disziplin „neu“, und die
Übersicht des Admins zeigt eine Aufgabe. Was eine Zuordnung festlegt:

| Feld | Speicher | Wirkt auf | Nachrechnen |
|---|---|---|---|
| Scheibe | `Discipline.targetId` (`lg-10m`, `lp-10m`, null = eigene Scheibe) | Zeichnen, Gegenprobe je Schuss, Merkmale `disziplin-unbekannt`/`scheibe-passt-nicht`, Sichtbarkeit | ja (Merkmale, Schüsse, Projektion) |
| Familie | `Discipline.familyId`, mitgeführt in `Card.familyId` | Liste, Fortschritt, Start, Sichtbarkeit | sofort in derselben Transaktion (`moveDisciplineFamily`) |
| Wertung im Wettkampf | `Discipline.officialScoring` | `cardScoring` beim Lesen | nein (gilt beim Lesen) |
| Schusszahl | `Discipline.plannedShots` (null = aus der ID, 0 = keine feste, sonst die Zahl) | `vollstaendig`/`unvollstaendig`/`ueber-soll`, `Card.complete`, Rekorde | ja (Merkmale) |

**Nachrechnen über Versionen, wie die Projektion.** `Discipline.version` steigt, wenn sich Scheibe oder Schusszahl
ändern. Jede Scheibe merkt sich, mit welcher Version ihre Merkmale gerechnet sind (`Card.disciplineVersion`). Ein Lauf
`refreshStaleDisciplineCards` holt die abweichenden nach: nach dem Speichern über `after()` aus `next/server` und beim
Start des Servers (übersteht einen Neustart mitten im Lauf). Er rechnet aus den gespeicherten Schüssen der aktuellen
Revision: Gegenprobe je Schuss (`verdaechtig`), Merkmale der Scheibe, `complete`, Projektion. Rohdaten neu deuten ist
nicht nötig: alle Felder der Gegenprobe stehen in `Shot`. Die Gegenprobe und die Merkmale der Disziplin ziehen dafür aus
dem Adapter in ein reines Modul, das Adapter und Nachrechnen teilen; so rechnen beide gleich.

**Neue Stände nehmen die Zuordnung mit.** Das Einlesen liest `targetId`, `plannedShots` und `version` der bekannten
Disziplin, gibt Scheibe und Schusszahl an den Adapter und die Version an `writeRevision`. Ändert ein Admin dazwischen
etwas, korrigiert der nächste Lauf die Scheibe.

**Eigene Familien.** `Family` hat schon freie `slug` und `name`. Der Admin legt Familien an (Kennung aus dem Namen,
fest nach dem Anlegen, sie steht in Adressen), benennt sie um und entfernt leere. Die vier des Fachkerns (`FamilyId`)
bleiben Vorschläge beim Einlesen; `FAMILY_NAMES` bleibt.

**Privat bleibt Standard.** Die Seite zeigt je Disziplin nur Zahlen über die ganze Anlage (Scheiben, häufigste
Anzeige, häufigste Schusszahl, letzte Scheibe), nie Namen, Konten oder Schüsse. Gelesen wird ohne `Shot`: die Anzeige
aus `Card.standScoring`, die Schusszahl aus `CardProjection.printedShots`.

**Der Schütze erfährt, dass etwas wartet.** Start zeigt eine ruhige Zeile, wenn eigene Scheiben auf die Einordnung
warten (Disziplin neu und ohne Scheibe oder Familie). Kein Fachbegriff, keine Aufgabe für den Schützen.

**Nicht im Umfang** (später, eigene Pläne): Brücke meldet die Disziplinen der Anlage vorab (Stufe 2, braucht
Vertrag + neue Brücke), neutrales Raster für eigene Scheiben, Teiler als Wertung der Vereinsspiele, Art-Vorgabe je
Disziplin, Freigabe der Anzeigeart 0 je Disziplin (SP-1.5, braucht die Brücke), Anzeigename, Teilerfaktor, Neu-Werten
mit anderem Scheibenbild (SF-16, `neu-gewertet`).

## Required Docs

- [`apps/spiegel/CLAUDE.md`](../apps/spiegel/CLAUDE.md) (Schichten, Kein Knopf ohne Folge, Admin-Daten prüfen selbst,
  Projektion, Migrationen nur anhängen, Tests gegen die Dev-Datenbank)
- [`packages/shot-core/CLAUDE.md`](../packages/shot-core/CLAUDE.md)
- [`vault/conventions.md`](../vault/conventions.md) §8, §9 (Mocks filtern, Markup-Tests, Mutation), §10 (Design 2,
  `DecisionDialog`, So schreiben wir, `OLD_WORDS`)
- [`vault/spiegel/spiegel-target-library.md`](../vault/spiegel/spiegel-target-library.md) („Von der DisziplinID zum
  Scheibenbild“), [`vault/spiegel/spiegel-edge-cases.md`](../vault/spiegel/spiegel-edge-cases.md) (SF-02, SF-09, SF-15,
  SF-16, SF-17, SF-64, SF-66, SF-70, SF-74), [`vault/decisions/adr-031.md`](../vault/decisions/adr-031.md),
  [`vault/spiegel/spiegel-privacy.md`](../vault/spiegel/spiegel-privacy.md)
- Auto-Memory: Worktree-`.env`-Links, Node v24 in Bash, Stop-Gate prüft den Haupt-Checkout (Gate im Worktree selbst),
  `pnpm check && git commit`, Autopilot-Marker entfernen

## Textbuch-Auszug (neue Texte, vor dem Code von einem Menschen zu lesen)

Alle Texte ohne Pronomen für Personen, ohne Semikolon, ein Gedanke je Satz. `{…}` sind Werte.

**Reiter:** „Disziplinen“.

**Seite „Disziplinen“, Einleitung:** „Meyton nennt jede Disziplin mit Nummer und Namen. Hier legst du fest, wie
Spiegel ihre Scheiben zeigt und zählt. Neue Disziplinen legt Spiegel selbst an, sobald die erste Scheibe kommt.“

**Abschnitte:** „Neu“, je Familie ihr Name, „Ohne Familie“, „Familien“.

**Zeile:** „{Name}“ · „Nummer {DisziplinID}“ · „{n} Scheiben“ bzw. „noch keine Scheibe“ · Zustand:
- wartet: „Scheiben warten“
- Vorschlag: „Vorschlag“
- eingeordnet ohne Scheibenbild oder Familie: „wird nicht gezeigt“

**Blatt einer Disziplin, Kopf:** „{Name}“, darunter „Nummer {DisziplinID} · {n} Scheiben · zuletzt am {Tag}“.

Zustand oben:
- wartet: „Spiegel kennt diese Disziplin nicht. Ihre Scheiben erscheinen erst, wenn du sie einordnest.“
- Vorschlag nach der Nummer: „Spiegel hat diese Disziplin an der Nummer erkannt. Bitte prüf den Vorschlag.“
- Vorschlag nach dem Namen: „Spiegel hat diese Disziplin am Namen erkannt. Bitte prüf den Vorschlag genau.“

Feld „Scheibe“: Möglichkeiten „Luftgewehr 10 m“, „Luftpistole 10 m“ (die `label` aus `TARGETS`), „Eigene Scheibe“.
- Vorschlag: „Vorschlag nach der Nummer: {Scheibe}“ / „Vorschlag nach dem Namen: {Scheibe}“ / „Kein Vorschlag. Spiegel
  erkennt die Scheibe weder an der Nummer noch am Namen.“
- bei „Eigene Scheibe“: „Spiegel kennt diese Scheibe nicht. Ihre Scheiben zeigt Spiegel deshalb nicht.“

Feld „Familie“: „Scheiben einer Familie stehen zusammen in Liste und Fortschritt.“ Möglichkeiten: alle Familien,
„Keine“. Bei „Keine“: „Ohne Familie zeigt Spiegel die Scheiben nicht.“

Feld „Wertung im Wettkampf“: Möglichkeiten „Zehntel“, „Ganze Ringe“, „Nicht festgelegt“. Erklärung: „So zählt eine
Scheibe, die als Wettkampf gilt. Im Training gilt, was am Stand angezeigt wurde.“
- Anzeige am Stand: „Am Stand meist {Zehntel|ganze Ringe} angezeigt: {k} von {n} Scheiben.“ / ohne Scheiben mit Anzeige:
  „Am Stand wurde noch nichts angezeigt.“

Feld „Schusszahl“: Möglichkeiten „Wie in der Nummer: {n}“ (ohne Zahl in der Nummer: „Wie in der Nummer: keine feste“),
„Eigene Zahl“ (Eingabe 1 bis 200, Beschriftung „Schüsse“), „Keine feste“. Erklärung: „Nur eine Scheibe mit allen
Schüssen zählt für Rekorde.“
- Geschossen: „Meist geschossen: {k} Schüsse, bei {m} von {n} Scheiben.“ / „Noch keine Scheibe mit Wertungsschüssen.“

Knopf: „So einordnen“ (neu) bzw. „Übernehmen“ (eingeordnet, nur bei Änderung aktiv).

**Dialog `disciplineChange`:**
- Titel: „‚{Name}‘ so einordnen?“
- Worum es geht: „In Spiegel gibt es {n} Scheiben dieser Disziplin.“ / „In Spiegel gibt es eine Scheibe dieser
  Disziplin.“ / „In Spiegel gibt es noch keine Scheibe dieser Disziplin.“
- Was passiert, je geänderte Sache:
  - Scheibe auf ein Scheibenbild: „Spiegel zeichnet die Scheiben als {Scheibe} und prüft den Wert jedes Schusses nach.“
  - Scheibe auf eigene: „Spiegel zeigt die Scheiben dieser Disziplin nicht mehr in Start, Scheiben und Fortschritt.“
  - Familie auf eine Familie: „Die Scheiben stehen dann in der Familie ‚{Familie}‘.“
  - Familie auf keine: „Spiegel zeigt die Scheiben dieser Disziplin nicht mehr in Start, Scheiben und Fortschritt.“
    (nur einmal, auch wenn Scheibe und Familie beide wegfallen)
  - Wertung: „Ein Wettkampf in dieser Disziplin zählt dann in {Zehnteln|ganzen Ringen}.“ / „Ein Wettkampf in dieser
    Disziplin zählt dann so, wie am Stand angezeigt.“
  - Schusszahl: „Eine Scheibe ist dann mit {n} Schüssen vollständig.“ / „Eine Scheibe ist dann vollständig, sobald sie
    fertig ist.“
  - ohne Änderung (nur einordnen): „Spiegel übernimmt den Vorschlag. Die Disziplin steht danach nicht mehr unter ‚Neu‘.“
  - immer zuletzt: „Neue Scheiben dieser Disziplin kommen gleich so an.“ und bei geänderter Scheibe oder Schusszahl
    davor: „Spiegel rechnet die vorhandenen Scheiben in den nächsten Minuten neu.“
- Was nicht passiert: „An den Schüssen und an den Werten aus Meyton ändert sich nichts.“, „Hat ein Schütze eine Scheibe
  selbst auf Zehntel oder ganze Ringe gestellt, bleibt es dabei.“
- Rückgängig: „Jederzeit hier wieder umstellen.“
- Knopf: „So einordnen“, nicht destruktiv.

**Familien:** Einleitung „In einer Familie laufen Verläufe und Rekorde zusammen, etwa LG 40 und LG 40 alt.“ · Zeile
„{Name}“ · „{d} Disziplinen“ · Knöpfe „Umbenennen“, „Entfernen“ (nur ohne Disziplinen und ohne Scheiben) · Formular
„Neue Familie“, Feld „Name“, Knopf „Anlegen“.
- Fehler: „Bitte einen Namen eingeben.“, „Höchstens 40 Zeichen.“, „Diesen Namen hat schon eine Familie.“, „Zu dieser
  Familie gehören noch Disziplinen oder Scheiben. Lade die Seite neu.“, „Das ließ sich nicht speichern. Bitte lade die
  Seite neu.“

**Dialog `familyRemove`:** Titel „Familie ‚{Name}‘ entfernen?“ · Worum: „Zu dieser Familie gehört keine Disziplin und
keine Scheibe.“ · Was passiert: „Die Familie verschwindet aus der Auswahl.“, „Hat ein Schütze für diese Familie Zehntel
oder ganze Ringe gewählt, fällt diese Wahl weg.“ · Was nicht: „Keine Scheibe ändert sich.“ · Rückgängig: „Eine neue
Familie mit demselben Namen anlegen. Die Wahl der Schützen kommt nicht zurück.“ · Knopf „Entfernen“, destruktiv.

**Hilfe (`ADMIN_HELP`):**
- `discipline`: Titel „Disziplinen“, Text „Meyton speichert zu jeder Scheibe die Nummer und den Namen der Disziplin.
  Spiegel braucht dazu drei Dinge. Welche Scheibe gezeichnet wird. In welcher Familie die Scheiben stehen. Wie viele
  Schüsse eine vollständige Scheibe hat. Eine neue Disziplin legt Spiegel selbst an, sobald die erste Scheibe kommt.“
- `family`: Titel „Familien“, Text „In einer Familie laufen Verläufe und Rekorde zusammen. LG 40 und LG 40 alt sind zum
  Beispiel beide Luftgewehr. Eine eigene Familie lohnt sich, wenn Scheiben nicht mit den anderen verglichen werden
  sollen.“

**Aufgabe in der Übersicht:**
- mit wartenden Scheiben: Titel „Eine neue Disziplin: Scheiben warten“ / „{n} neue Disziplinen: Scheiben warten“,
  Text „Spiegel zeigt diese Scheiben erst, wenn du die Disziplin einordnest.“, Knopf „Einordnen“.
- sonst: Titel „Eine neue Disziplin prüfen“ / „{n} neue Disziplinen prüfen“, Text „Spiegel hat sie selbst eingeordnet.
  Ein kurzer Blick reicht.“, Knopf „Prüfen“.

**Start (Schütze):** „Eine Scheibe wartet darauf, dass ein Admin ihre Disziplin einordnet. Danach erscheint sie hier von
selbst.“ / „{n} Scheiben warten darauf, dass ein Admin ihre Disziplin einordnet. Danach erscheinen sie hier von selbst.“

## Tasks

### T1 — Schema und Migration (interaktiv, geschützter Pfad)

Dateien: `apps/spiegel/prisma/schema.prisma`, neue Migration.

1. `Discipline` ergänzen:
   ```prisma
     // Wertungsschüsse vom Admin; null: aus der DisziplinID, 0: keine feste Zahl (SF-09)
     plannedShots    Int?
     // vom Admin eingeordnet; null: neu, die Werte sind der Vorschlag des Fachkerns
     confirmedAt     DateTime? @db.Timestamptz(3)
     // steigt, wenn sich Scheibenbild oder Schusszahl ändern; Scheiben mit anderem Stand rechnet
     // `refreshStaleDisciplineCards` nach
     version         Int       @default(0)
     firstSeenAt     DateTime  @default(now()) @db.Timestamptz(3)
   ```
2. `Card` ergänzen:
   ```prisma
     // `Discipline.version`, mit der Merkmale, Gegenprobe und `complete` gerechnet sind
     disciplineVersion Int             @default(0)
   ```
   und `@@index([disciplineId])` (Nachrechnen, `moveDisciplineFamily`, Zählen je Disziplin).
3. Den Kommentar an `Family.slug` anpassen: „Kennung, steht in der Adresse: aus dem Fachkern (`FamilyId`) oder beim
   Anlegen aus dem Namen; fest“.
4. `pnpm --filter spiegel exec prisma migrate dev --name discipline_mapping`, dann `prisma generate`. Die Migration
   prüfen: nur `ADD COLUMN` und `CREATE INDEX`, keine Änderung bestehender Zeilen außer den Defaults.
5. Gate. Commit `feat(spiegel): schema for admin discipline mapping`.

### T2 — Schusszahl der Zuordnung im Fachkern

Dateien: `packages/shot-core/src/discipline.ts`, `packages/shot-core/src/discipline.test.ts`.

1. Hinter `parseDisciplineId`:
   ```ts
   /** Soll der Wertungsschüsse: die Zahl des Admins (0: keine feste), sonst aus der DisziplinID (SF-09) */
   export function plannedShotsOf(meytonId: number, override: number | null): number | null {
     if (override === null) return parseDisciplineId(meytonId).plannedShots
     return override === 0 ? null : override
   }
   ```
2. Tests: `plannedShotsOf(19200020, null)` → 20, `plannedShotsOf(19200020, 3)` → 3, `plannedShotsOf(10110040, 0)` →
   null, `plannedShotsOf(10119000, null)` → null, `plannedShotsOf(123, null)` → null.
3. Commit `feat(shot-core): planned shots with an admin override`.

### T3 — Gegenprobe und Merkmale der Disziplin als reines Modul

Dateien: `apps/spiegel/src/lib/ingest/card-checks.ts` (neu), `apps/spiegel/src/lib/ingest/card-checks.test.ts` (neu),
`apps/spiegel/src/lib/ingest/meyton-ssmdb2.ts`.

1. `card-checks.ts` enthält, aus dem Adapter verschoben und unverändert im Verhalten:
   - `FLAG_UNKNOWN_DISCIPLINE`, `FLAG_TARGET_MISMATCH`, `INCOMPLETE_FLAGS`, `isComplete` (der Adapter re-exportiert sie
     mit `export { … } from "./card-checks"`, damit kein Importeur sich ändert).
   - ```ts
     /** ein Schuss, wie die Gegenprobe ihn braucht; aus den Rohdaten (Adapter) oder aus `Shot` (Nachrechnen) */
     export interface CheckableShot {
       xUm: number | null
       yUm: number | null
       /** Abstand zur Mitte in 0,1 µm (`Teiler001`) */
       distanceTenthsUm: number | null
       decimalTenths: number | null
       ring: number | null
       innerTen: boolean
       /** Merkmale aus den Rohdaten (`fehlschuss`, über Soll), ohne `verdaechtig` */
       flags: readonly string[]
     }

     /**
      * Gegenprobe jedes Schusses gegen das Scheibenbild. Fast alle daneben: das Scheibenbild passt nicht (SF-16), dann ist
      * kein Schuss verdächtig; sonst sind die einzelnen verdächtig (SF-15). Ohne Scheibenbild wird nichts geprüft.
      */
     export function verifyShots(
       targetId: TargetId | null,
       shots: readonly CheckableShot[]
     ): { suspicious: boolean[]; targetMismatch: boolean }
     ```
     Rumpf: die Zeilen `const target = …` bis `const targetMismatch = …` aus `adaptSnapshot`, mit
     `distance: s.distanceTenthsUm !== null ? { um: s.distanceTenthsUm / 10, resolutionUm: 0.1 } : null`,
     `position: { xUm: s.xUm, yUm: s.yUm, resolutionUm: 10 }` (bei beiden nicht null), `officialDecimalTenths:
     s.decimalTenths`, `officialRing: s.ring`, `officialInnerTen: s.innerTen`, geprüft nur bei `s.flags.length === 0 &&
     s.decimalTenths !== null`; `suspicious[i] = !targetMismatch && checks[i] === "mismatch"`.
   - ```ts
     /** Merkmale der Scheibe, die an der Zuordnung der Disziplin hängen; das Nachrechnen ersetzt genau diese */
     export const MAPPING_FLAGS = [
       "leer", "nur-probe", "unvollstaendig", "ueber-soll", FLAG_UNKNOWN_DISCIPLINE, FLAG_TARGET_MISMATCH,
     ] as const satisfies readonly CardFlag[]

     export function mappingFlags(input: {
       sighterShots: number
       matchShots: number
       plannedShots: number | null
       targetId: TargetId | null
       targetMismatch: boolean
     }): CardFlag[]
     ```
     Rumpf: `classifyCompleteness` und die drei `flags.push` aus `adaptSnapshot` in derselben Reihenfolge.
2. `adaptSnapshot`: `AdapterContext` bekommt
   ```ts
     /** Soll der Wertungsschüsse aus der Zuordnung (`plannedShotsOf`); undefined: aus der DisziplinID */
     plannedShots?: number | null
   ```
   Die Rohschüsse werden für `verifyShots` auf `CheckableShot` abgebildet (`xUm: s.x * 10`, `ring: Math.floor(s.ring /
   10)`, `distanceTenthsUm: s.teiler001`, `flags: shotFlags(s)`); die Merkmale kommen aus `mappingFlags` mit
   `plannedShots: context.plannedShots !== undefined ? context.plannedShots : parseDisciplineId(discipline.meytonId).plannedShots`, danach
   wie bisher `FLAG_CLOCK`.
3. Tests `card-checks.test.ts`: mit `TARGETS["lp-10m"]` und den Teilern aus der Gegenprobe der Note (331,8 → 10,5;
   2656 → 7,6) passt alles; ein Schuss mit falschem Zehntel ist verdächtig; drei von vier falsch → `targetMismatch`,
   keiner verdächtig; ohne Scheibenbild nichts verdächtig, kein Mismatch; `mappingFlags` liefert `unvollstaendig` bei
   38 von 40, `[]` bei 40 von 40, `ueber-soll` bei 41, nichts bei `plannedShots: null`, `disziplin-unbekannt` ohne
   Scheibenbild.
4. `pnpm --filter spiegel test src/lib/ingest` muss ohne Änderung an `meyton-ssmdb2.test.ts` grün bleiben (Beleg, dass
   sich das Verhalten nicht ändert). Commit `refactor(spiegel): share shot verification and discipline flags`.

### T4 — Einlesen nimmt die Zuordnung mit

Dateien: `apps/spiegel/src/lib/ingest/ingest.ts`, `apps/spiegel/src/lib/db/cards.ts`,
`apps/spiegel/src/lib/ingest/ingest.test.ts`.

1. `adaptAndWrite`: `known` wählt zusätzlich `meytonId`, `plannedShots`, `version`; an `adaptSnapshot` gehen
   `targetId` wie bisher und `plannedShots: known ? plannedShotsOf(known.meytonId, known.plannedShots) : undefined`.
   `disciplineFor` liefert auch `version` (neu angelegt 0). Die Scheibe geht mit `disciplineVersion:
   discipline.version` an `writeRevision`.
2. `CardInput` bekommt
   ```ts
     /** `Discipline.version`, mit der der Adapter gerechnet hat; fehlt: nicht anfassen (`seed:own`, PDF) */
     disciplineVersion?: number
   ```
   `cardFeatures` setzt `disciplineVersion`, wenn es nicht `undefined` ist.
3. Tests in `ingest.test.ts`: (a) Disziplin mit `plannedShots: 3` und eine endgültige Scheibe mit drei Wertungsschüssen
   → `complete` true, keine `unvollstaendig`; (b) eine neue Scheibe trägt `disciplineVersion` der Disziplin
   (Disziplin vorher auf `version: 2` gesetzt).
4. Commit `feat(spiegel): ingest applies the discipline mapping`.

### T5 — Nachrechnen nach einer Änderung

Dateien: `apps/spiegel/src/lib/db/cards.ts`, `apps/spiegel/src/lib/db/cards-discipline.test.ts` (neu),
`apps/spiegel/src/instrumentation-node.ts`.

1. `setDisciplineFamily` teilen: `export async function moveDisciplineFamily(tx: Tx, disciplineId: number, familyId:
   number | null): Promise<number>` macht die beiden Updates, `setDisciplineFamily` ruft sie in seiner Transaktion.
2. Neu in `cards.ts`:
   ```ts
   /**
    * Scheiben, deren Merkmale mit einer älteren Zuordnung ihrer Disziplin gerechnet sind (`Card.disciplineVersion`),
    * aus den gespeicherten Schüssen neu rechnen: Gegenprobe je Schuss, Merkmale der Disziplin, `complete`, Projektion.
    * Je Scheibe unter der Sperre ihrer Zeile; Rohdaten werden nicht neu gedeutet.
    */
   export async function refreshDisciplineCards(
     db: Db,
     { limit = 200, sourceId, exclude = [], onFailure }: { limit?: number; sourceId?: number; exclude?: readonly string[]; onFailure?: (cardId: string, error: unknown) => void } = {}
   ): Promise<number>
   ```
   Auswahl: `SELECT c.id FROM "Card" c JOIN "Discipline" d ON d.id = c."disciplineId" WHERE c."disciplineVersion" <>
   d.version` (plus `sourceId`, `exclude`), `ORDER BY c.id LIMIT`. Je Scheibe in einer Transaktion:
   - `SELECT c."currentRevisionId", c.state, c.flags, d."targetId", d."plannedShots", d."meytonId", d.version FROM
     "Card" c JOIN "Discipline" d ON d.id = c."disciplineId" WHERE c.id = … FOR UPDATE OF c`
   - die Schüsse der aktuellen Revision (`shotFromRow`), `verifyShots(targetId, shots ohne FLAG_SUSPICIOUS)`; weicht
     `verdaechtig` an einem Schuss ab, dessen Zeile `flags` setzen und `CardRevision.contentHash` mit `contentHash`
     über die neuen Schüsse neu schreiben
   - Merkmale: `[...mappingFlags({ sighterShots, matchShots, plannedShots: plannedShotsOf(meytonId, plannedShots),
     targetId, targetMismatch }), ...flags.filter((f) => !MAPPING_FLAGS.includes(f))]`, `complete: isComplete(state,
     merkmale)`, `disciplineVersion: version`
   - `saveProjection` mit den neuen Schüssen; ohne aktuelle Revision nur `disciplineVersion` setzen.
   Dazu `refreshStaleDisciplineCards(db)` mit derselben Schleife wie `refreshStaleProjections` (Runden zu 200,
   gescheiterte über `exclude` überspringen, `MAX_REFRESH_ROUNDS`).
3. `instrumentation-node.ts`: neben `refreshStaleProjections` `void refreshStaleDisciplineCards(db)`.
4. Tests gegen die Dev-Datenbank (`createTestSite`, `test/generate.ts`), alle mit `sourceId`:
   - Disziplin ohne Scheibenbild, Scheibe mit 40 LP-Schüssen: Merkmal `disziplin-unbekannt`. `targetId` auf `lp-10m`,
     `version` +1, `refreshDisciplineCards` → Merkmal weg, `disciplineVersion` gleich, Projektion neu (`computedAt`
     später).
   - Ein Schuss mit verfälschtem Zehntel wird nach dem Nachrechnen `verdaechtig`, die Projektion `suspicious`.
   - `plannedShots: 3` an einer Scheibe mit drei Wertungsschüssen: `unvollstaendig` weg, `complete` true; zurück auf
     null (ID sagt 40): wieder `unvollstaendig`.
   - `korrigiert` und `uhr-abweichung` bleiben stehen.
   - Eine Scheibe mit gleicher Version wird nicht angefasst (Rückgabe 0).
   - Gegenprobe der Tests per Mutation: `MAPPING_FLAGS`-Filter testweise entfernen → ein Test wird rot (Backup per `cp`,
     nicht `git checkout`).
5. Commit `feat(spiegel): recompute cards after a discipline mapping change`.

### T6 — Lesen für die Seite „Disziplinen“

Dateien: `apps/spiegel/src/lib/admin/discipline-model.ts` (neu, rein), `apps/spiegel/src/lib/admin/discipline-model.test.ts`
(neu), `apps/spiegel/src/lib/admin/disciplines.ts` (neu), `apps/spiegel/src/lib/admin/disciplines.test.ts` (neu).

1. `discipline-model.ts` (ohne `db`, darf in den Client):
   ```ts
   export type DisciplineStatus = "waiting" | "suggested" | "confirmed"
   export interface DisciplineStats {
     cards: number
     lastCardAt: string | null
     /** Scheiben je Anzeige am Stand (`Card.standScoring`) */
     stand: { decimal: number; rings: number }
     /** häufigste Zahl der Wertungsschüsse (`printedShots`, ohne nur Probe) und wie oft; null ohne */
     shots: { count: number; cards: number; of: number } | null
   }
   export interface DisciplineRow {
     id: number; meytonId: number; name: string
     targetId: TargetId | null; familyId: number | null; familyName: string | null
     officialScoring: Scoring | null; plannedShots: number | null; confirmed: boolean
     status: DisciplineStatus
     /** sichtbar in den Übersichten: Scheibenbild und Familie */
     visible: boolean
     suggestion: { targetId: TargetId | null; source: "catalog" | "name" | "unknown"; plannedShotsFromId: number | null }
     stats: DisciplineStats
   }
   export function disciplineStatus(d: { confirmed: boolean; targetId: TargetId | null; familyId: number | null }): DisciplineStatus
   export function disciplineRow(input: {
     discipline: {
       id: number; meytonId: number; name: string; targetId: string | null; officialScoring: Scoring | null
       plannedShots: number | null; confirmedAt: Date | null; family: { id: number; name: string } | null
     }
     stats: DisciplineStats
   }): DisciplineRow
   ```
   (`targetId` über `isTargetId` aus `reads.ts` eingeengt, ein unbekannter Wert gilt als null.)
   `status`: bestätigt → `confirmed`; sonst sichtbar → `suggested`, sonst `waiting`. `suggestion` aus
   `resolveTarget({ disciplineId: meytonId, name })` (Quelle `admin` gibt es dort nicht, weil ohne `adminMappings`
   gerufen) und `parseDisciplineId(meytonId).plannedShots`. Dazu die Satzbausteine des Textbuchs für Zustand,
   Vorschlag, Anzeige am Stand und Schusszahl als Funktionen (`statusText`, `targetSuggestionText`, `standText`,
   `shotsText`).
2. `disciplines.ts` (jede Funktion `requireAdmin`, Anlage = erste):
   - `disciplineOverview(timeZone)`: Disziplinen mit Familie; `card.groupBy` nach `disciplineId` (`deletedAt: null`,
     `_count`, `_max.startedAt`) und nach `[disciplineId, standScoring]`; `$queryRaw` für die Schusszahl:
     `SELECT c."disciplineId", p."printedShots", count(*)::int AS n FROM "Card" c JOIN "CardProjection" p ON
     p."cardId" = c.id WHERE c."deletedAt" IS NULL AND NOT p."probeOnly" AND c."disciplineId" = ANY(${ids}) GROUP BY 1, 2`;
     Familien mit Zahl der Disziplinen und Scheiben. Rückgabe `{ rows: DisciplineRow[]; families: FamilyRow[] }`,
     sortiert: `waiting`, `suggested`, dann nach Familie und Scheibenzahl absteigend.
   - `disciplineDetail(id, timeZone)`: dieselbe Zeile für eine Disziplin der Anlage, sonst null.
   - `disciplineTaskCounts()`: `{ waiting, suggested }` über nicht bestätigte Disziplinen mit mindestens einer nicht
     gelöschten Scheibe.
3. Tests: das reine Modell für alle drei Zustände, die Vorschläge für `19110040` (Katalog), `19000001` „König LG“
   (Name), `10199005` „Zimmerstutzen“ (unbekannt), `19200020` (Schusszahl 20 aus der ID); `disciplines.ts` gegen die
   Dev-Datenbank: Zahlen stimmen, gelöschte Scheiben zählen nicht, eine Disziplin einer fremden Anlage fehlt; kein Feld
   mit Namen, Konto oder Sportpass im Ergebnis (Schlüssel prüfen).
4. Commit `feat(spiegel): admin reads for disciplines`.

### T7 — Texte

Dateien: `apps/spiegel/src/lib/admin/consequences.ts`, `apps/spiegel/src/lib/admin/consequences.test.ts`,
`apps/spiegel/src/lib/admin/help.ts`, `apps/spiegel/src/lib/admin/help.test.ts`.

1. `disciplineChange({ name, cards, before, after, targetLabel, familyName })` → `Decision`, Wortlaut genau wie im
   Textbuch-Auszug; `before`/`after` haben `targetId`, `familyId`, `officialScoring`, `plannedShots` (gespeichert:
   null/0/Zahl) und `confirmed`. Exportiert dazu `disciplineRecalculates(before, after)` (Scheibe oder Schusszahl
   geändert), die auch T8 nutzt.
2. `familyRemove({ name })` → `Decision` wie im Auszug.
3. `ADMIN_HELP.discipline`, `ADMIN_HELP.family` wie im Auszug.
4. Tests halten den Wortlaut: nur einordnen, jede Änderung einzeln, Scheibe und Familie beide weg (Satz nur einmal),
   Nachrechnen-Satz nur bei Scheibe oder Schusszahl; alle neuen Texte gegen `OLD_WORDS` (wie die bestehenden Tests).
5. Commit `feat(spiegel): texts for discipline mapping`.

### T8 — Server Actions

Dateien: `apps/spiegel/src/lib/admin/discipline-actions.ts` (neu, `"use server"`, nur direkt deklarierte async
Funktionen), `apps/spiegel/src/lib/admin/discipline-actions.test.ts` (neu, Muster aus `site-actions.test.ts`).

1. ```ts
   export async function saveDiscipline(
     disciplineId: number,
     input: {
       targetId: string            // Schlüssel aus TARGETS oder "own"
       familyId: number | null
       officialScoring: "decimal" | "rings" | "open"
       plannedShots: { mode: "id" } | { mode: "open" } | { mode: "count"; count: number }
     }
   ): Promise<ActionResult>
   ```
   `adminActor`; Zod (`count` ganzzahlig 1 bis 200, `isRowId` für die Kennungen); Disziplin und Familie müssen zur
   ersten Anlage gehören bzw. existieren, sonst „Das ließ sich nicht speichern. Bitte lade die Seite neu.“. In einer
   Transaktion: Zeile `FOR UPDATE`, `version` +1 nur bei `disciplineRecalculates`, `confirmedAt: now`, die Felder
   (`own` → null, `open` → null, `id` → null, `open`-Schusszahl → 0), bei anderer Familie `moveDisciplineFamily`.
   Danach `after(() => refreshStaleDisciplineCards(db))`, `revalidatePath("/", "layout")`, `{ success: true }`.
2. `createFamily(_prev, formData)`: Name getrimmt, 1 bis 40 Zeichen, nicht schon vorhanden (ohne Groß/Klein); Kennung
   über `familySlug(name, taken)` (neu in `discipline-model.ts`: klein, ä→ae, ö→oe, ü→ue, ß→ss, sonst Nicht-Alnum →
   `-`, Ränder weg, höchstens 40; bei Kollision `-2`, `-3`, …). `renameFamily(familyId, name)`: gleiche Prüfung, Kennung
   bleibt. `removeFamily(familyId)`: `deleteMany` mit `disciplines: { none: {} }, cards: { none: {} }` in der Bedingung;
   0 gelöscht → „Zu dieser Familie gehören noch Disziplinen oder Scheiben. Lade die Seite neu.“
3. Tests: Nicht-Admin abgewiesen; Scheibe ändern hebt `version`, Wertung allein nicht; `confirmedAt` gesetzt auch ohne
   Änderung; Familienwechsel zieht `Card.familyId` mit; Schusszahl `count`/`open`/`id` speichert 3/0/null; fremde
   Familie abgewiesen; `familySlug("Zimmerstutzen 15 m")` → `zimmerstutzen-15-m`, `familySlug("Ölpreis")` → `oelpreis`,
   Kollision → `-2`; doppelter Name abgewiesen; Familie mit Disziplin nicht entfernbar (das Mock bzw. die Dev-Datenbank
   enthält die Zeile, die die Bedingung ausschließt).
4. Commit `feat(spiegel): admin actions for disciplines and families`.

### T9 — Oberfläche

Dateien: `apps/spiegel/src/components/admin/AdminTabs.tsx`, `apps/spiegel/src/app/(app)/admin/disciplines/page.tsx`
(neu), `apps/spiegel/src/app/(app)/admin/disciplines/[id]/page.tsx` (neu),
`apps/spiegel/src/components/admin/DisciplineList.tsx` (neu), `apps/spiegel/src/components/admin/DisciplineForm.tsx`
(neu), `apps/spiegel/src/components/admin/FamilyForms.tsx` (neu), Markup-Tests `DisciplineList.test.tsx`,
`DisciplineForm.test.tsx` (neu), `apps/spiegel/src/lib/admin-path.test.ts`.

1. `AdminTabs`: `AdminTab` um `"disciplines"`, Reiter „Disziplinen“ zwischen „Konten“ und „Anlage und Brücke“.
2. Seiten wie `admin/site/page.tsx` aufgebaut (Rahmen, `AdminTabs`, `AdminHelp`), Daten aus `disciplineOverview` bzw.
   `disciplineDetail` (`notFound()` bei null), Zone über `getDisplayTimeZone()`.
3. `DisciplineList`: Abschnitte wie im Auszug; jede Zeile ist ein Link auf `/admin/disciplines/{id}` (ganze Zeile,
   conventions §7), Zustand als ruhiger Chip (`warning`-Ton für „Scheiben warten“, `foreground-2` sonst). Darunter
   `FamilyForms`: Liste mit „Umbenennen“ (Feld inline, gesteuert) und „Entfernen“ (nur ohne Disziplinen und Scheiben,
   `DecisionDialog` mit `familyRemove`), Formular „Neue Familie“ (gesteuert, `value` + `onChange`).
4. `DisciplineForm` (Client): Kopf und Zustand, vier Felder als `Segmented` aus `@vereinsheim/ui/design2` (Familie mit
   `wrap`), „Eigene Zahl“ mit einem Zahlenfeld; unter jedem Feld Vorschlag bzw. Beobachtung aus `discipline-model.ts`.
   Gesteuert; Absenden fängt `onSubmit` ab, zeigt `DecisionDialog` mit `disciplineChange`, ruft nach dem Bestätigen
   `saveDiscipline`; Fehler als Text über `getErrorMessage`, Erfolg führt zurück auf `/admin/disciplines`.
5. Markup-Tests (`renderToStaticMarkup`): Liste zeigt „Scheiben warten“ für eine wartende Zeile und keinen Chip für eine
   eingeordnete sichtbare; „wird nicht gezeigt“ für eingeordnet ohne Scheibenbild; das Formular zeigt „Wie in der
   Nummer: 40“ und den Satz zur Anzeige am Stand; „Entfernen“ fehlt an einer Familie mit Disziplinen.
   `admin-path.test.ts` um `/admin/disciplines` erweitern.
6. Commit `feat(spiegel): admin page for disciplines`.

### T10 — Aufgabe in der Übersicht und Hinweis auf Start

Dateien: `apps/spiegel/src/lib/admin/overview.ts`, `apps/spiegel/src/lib/admin/overview.test.ts`,
`apps/spiegel/src/lib/db/reads.ts`, `apps/spiegel/src/lib/db/reads.test.ts`, `apps/spiegel/src/app/(app)/page.tsx`,
`apps/spiegel/src/components/start/StartScreen.tsx`, `apps/spiegel/src/components/start/StartScreen.test.tsx`
(neu oder bestehend erweitern), `apps/spiegel/src/lib/admin/consequences.test.ts` (`OLD_WORDS` über die neuen Texte).

1. `OverviewInput.disciplines: { waiting: number; suggested: number }`; `overviewModel` hängt nach den Zustimmungen eine
   Aufgabe `id: "disciplines"`, `href: "/admin/disciplines"` an, Wortlaut wie im Auszug (wartend geht vor).
   `adminOverview` liest `disciplineTaskCounts()`.
2. `reads.ts`: `waitingForDiscipline(db, ownerId)` zählt eigene Scheiben mit `VISIBLE_CARD`, deren Disziplin
   `confirmedAt: null` hat und `targetId: null` oder `familyId: null`.
3. Start: `StartRoute` liest die Zahl mit, `StartScreen` bekommt `waiting: number` und zeigt bei > 0 über den Blöcken
   (auch im leeren Zustand) einen Absatz `text-sm text-foreground-2` mit dem Satz aus dem Auszug.
4. Tests: Aufgabe mit wartenden, mit nur vorgeschlagenen, keine ohne; `waitingForDiscipline` zählt keine gelöschte,
   keine wartende erste Scheibe (`ownerPending`), keine fremde, keine einer eingeordneten Disziplin; Start-Markup mit 0,
   1 und 3.
5. Commit `feat(spiegel): task and start hint for new disciplines`.

### T11 — Doku

Dateien: `apps/spiegel/CLAUDE.md`, `vault/spiegel/spiegel-target-library.md`, `vault/spiegel/spiegel-edge-cases.md`,
`vault/spiegel/spiegel-roadmap.md`, `vault/spiegel/spiegel-db-schema.md`, `vault/spiegel/spiegel-data-model.md`,
`vault/spiegel/spiegel-privacy.md`.

1. `apps/spiegel/CLAUDE.md`: Regel „Disziplinen einordnen“ (Felder, `confirmedAt`, Versionen und
   `refreshStaleDisciplineCards`, Gegenprobe aus `card-checks.ts`, Familie nur über `moveDisciplineFamily`, Admin sieht
   je Disziplin nur Zahlen); `Admin → Disziplinen` in den Aufbau.
2. Target-Library: Schritt 1 „Admin-Zuordnung“ ist bedienbar, Schusszahl der Zuordnung vor dem Schusscode.
3. Edge-Cases: SF-17, SF-64, SF-70 „Admin-Zuordnung (noch nicht bedienbar)“ → bedienbar unter Admin → Disziplinen;
   Leitregel „neue Disziplin jederzeit“ an SF-17.
4. Roadmap: Einzelpunkt „Disziplinen im Admin pflegen“ entfernen; neue Einzelpunkte: Brücke meldet Disziplinen vorab
   (Stufe 2, Vertrag + Brücke), neutrales Raster für eigene Scheiben, Teiler-Wertung der Vereinsspiele, Art-Vorgabe je
   Disziplin; die Freigabe der Anzeigeart 0 bleibt bei SP-1.5.
5. DB-Schema und Datenmodell: neue Spalten, Index. Privacy: „Admin sieht je Disziplin Zahlen der ganzen Anlage, nie je
   Konto“.
6. `vault-lint` grün (`/sync-graph`). Commit `docs(spiegel): discipline mapping in the vault`.

## Test steps

- Je Task: `pnpm --filter spiegel test <Datei>` bzw. `pnpm --filter @vereinsheim/shot-core test`.
- Nach T3: `meyton-ssmdb2.test.ts` unverändert grün.
- Vor jedem Commit: `pnpm check` (alle fünf Gates, im Worktree).

## Verification

1. `pnpm check` grün im Worktree.
2. Dev-Datenbank mit der Kopie (`seed:own` bzw. `dev-restore` durch den User), Dev-Server `:3002`, als Admin anmelden
   (meldet sich der User selbst an): `/admin/disciplines` zeigt die Disziplinen, Zahlen ohne Namen; eine Disziplin
   ohne Scheibenbild steht unter „Neu“ mit „Scheiben warten“, die Übersicht hat die Aufgabe.
3. Eine Disziplin auf „Luftpistole 10 m“ und eine Familie stellen, Dialog lesen, bestätigen: nach dem Lauf erscheinen
   ihre Scheiben in Liste und Start des Besitzers, `disziplin-unbekannt` ist weg (Abfrage in der Dev-Datenbank).
4. Schusszahl einer Disziplin auf eine eigene Zahl stellen: `Card.complete` und Merkmale folgen; Rekorde im Fortschritt
   zählen die Scheibe.
5. Familie anlegen, umbenennen (Adresse `?family=` bleibt gültig), leere entfernen.
6. Eine neue Disziplin per Ingest (Fall aus `ssmdb2-cases` mit unbekannter DisziplinID über `bridge-e2e` oder
   `ingest.test.ts`) kommt an, wird angelegt, die Scheibe wartet, Start des Besitzers zeigt den Hinweis.
7. Was die Dev-Daten nicht hergeben, steht im Validierungsbericht als „nicht belegt“ mit dem Test, der den Pfad deckt
   (conventions §9).
