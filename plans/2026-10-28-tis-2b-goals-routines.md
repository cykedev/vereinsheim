# 2b · Saisonziele und Schuss-Abläufe im Tagebuch

Teilplan von Stufe 2 aus `plans/2026-10-26-treffsicher-in-spiegel.md` (Basisbranch `feat/treffsicher-in-spiegel`,
`8c9540e4`), Kindsession `tis-2b-goals-routines`, Branch `feat/tis-2b-goals-routines` vom Basisbranch. Entscheidungen
im Koordinationsplan unter „Designkonzept 2b, Runde 1“ (vom User am 28. Oktober 2026 mit allen Empfehlungen
freigegeben), Regeln in [[adr-033]] und [[spiegel-diary]]. Die Oberfläche folgt dem Designkonzept 2b, Runde 1
(Artifact des Users).

## Kontext

Treffsicher 2.0 für Ziele und Abläufe. Zählungen in der Prod-Kopie von Treffsicher (nur Zahlen):

- **Ziele:** 10 in 4 Konten, 8 Ergebnis- und 2 Prozessziele. 7 der 8 Ergebnisziele tragen eine Ringzahl im Titel,
  keines wurde nach dem Anlegen geändert. Zeitraum Ø 300 Tage, fast immer eine Saison. Am Ziel steht keine Disziplin,
  die verknüpften Einheiten eines Ziels haben aber immer genau eine. 120 Verknüpfungen mit Einheiten, wer verknüpft,
  verknüpft fast alles im Zeitraum, 3 liegen außerhalb des Zeitraums.
- **Abläufe:** 4 in 2 Konten, nie geändert, ohne Disziplin, 1/2/7/55 Schritte (65, 10 mit Erklärung). Lesetext, keine
  Checkliste. „Ablauf eingehalten“ ist ein Standardwert ohne Aussage (ADR-033, 2a).
- **Anhänge:** jede Datei hängt an einer Einheit mit Ergebnissen. Sie werden Ausdruck oder Beleg der Scheibe (Teil 1f
  und Stufe 3). **2b baut keine Anhänge und fasst `CardEvidence` nicht an.**

2b baut: Ziele mit Messung (dritter Reiter „Ziele“ im Tagebuch, Seite eines Ziels, Anlegen und Ändern, Papierkorb, Zeile
auf Start), Abläufe oben im Faden (Leseseite, Bearbeiten als ein Textfeld, Papierkorb), Export und Konto löschen
mit beiden, die Skriptprüfung, Vault und den Nachtrag zu ADR-033.

## Schnitt

Ein Plan, ein Branch, eine Migration, drei Teile in dieser Reihenfolge:

- **Teil A · Grundlage:** Serien in der Projektion (Fachkern), schmale Schnittstelle `resultGoalCards`, Schema und
  Migration, reine Funktionen (Saison, Messung, Text der Schritte).
- **Teil B · Ziele:** Liste, Seite, Formular, Actions, Papierkorb, Zeile auf Start.
- **Teil C · Abläufe, Daten, Prüfung, Doku:** Abläufe im Faden, Export, Skriptprüfung, Vault, ADR-033.

## Ansatz

### Grenze

Alles Neue liegt in der Zone Tagebuch (`src/diary/**`, `src/app/(app)/diary/**`). Die neuen Tabellen haben keinen
Fremdschlüssel auf den Ergebnisteil (`familyId` ist ein Wert), nur `User` kaskadiert. Das Tagebuch liest Scheiben nur
über `src/lib/results-read.ts`. Der Ergebnisteil ändert sich an genau drei Stellen, alle ohne Wissen über Ziele:

1. **Fachkern:** `CardProjection.series` (die Serien einer Scheibe in beiden Wertungen), damit „Serie ab X“ ohne
   Schüsse rechnet (ADR-031: Übersichten lesen keine Schüsse). Offene Frage 1.
2. **Schnittstelle:** `resultGoalCards` in `results-read.ts`.
3. **Stelle auf Start:** je Block eine Liste von Zeilen statt einer (`Record<string, PartLine[]>`), damit neben
   „Tagebuch · Eintrag öffnen“ die Zeile zum Ziel stehen kann. Offene Frage 2.

`boundary.test.ts` bekommt die neuen Modelle des Tagebuchs nicht in die Liste des Ergebnisteils, sonst nichts.

### Serien in der Projektion (Fachkern)

`packages/shot-core/src/analysis/projection.ts`:

```ts
/** eine Serie wie unter der Scheibe: Nummer, Schusszahl, Summe in ganzen Ringen und in Zehnteln (null ohne Wert) */
export interface ProjectedSeries {
  series: number
  shots: number
  rings: number | null
  decimal: number | null
}

export interface CardProjection {
  // … wie heute
  /** die Serien der Wertung (bei nur Probe der Probe), aus den Schüssen, sonst aus den Serien-Summen; leer ohne */
  series?: ProjectedSeries[]
}
```

- Gerechnet in `cardProjection` mit derselben Regel wie `resultCardSeries`: `seriesCurve(asOnPrintout(…), scoring)`
  je Wertung, ohne Schüsse aus `sums.series` (`rings`, `decimalTenths / 10`). Die beiden Wertungen werden je Serie
  zusammengeführt.
- `PROJECTION_VERSION` 6 → 7. `refreshProjections` holt beim Start alle Scheiben nach (wie bei jedem Anstieg).
- `resultCardSeries` bleibt (die Seite eines Eintrags liest die Serien einer Scheibe weiter darüber).
- Tests in `projection.test.ts`: Serien aus Schüssen an einer erzeugten Scheibe (Summe je Serie gegen
  `seriesCurve`), aus Summen (Fixture mit `SeriesSum` in Ringen und Zehnteln, eine Serie ohne Zehntel → `decimal`
  null), nur Probe, ohne Werte → `[]`. Der Test, der Version und Ausgabe festschreibt, wird mit der neuen Version
  aktualisiert.

### Schnittstelle `resultGoalCards`

In `apps/spiegel/src/lib/results-read.ts`, gelesen aus `overviewCards` wie `resultCards`:

```ts
/** eine eigene Scheibe einer Familie, wie ein Ziel sie zählt: Ergebnis und Serien in beiden Wertungen */
export interface GoalCard {
  id: string
  day: string
  startedAtMs: number
  kind: "training" | "competition"
  probeOnly: boolean
  /** Schüsse wie am Ausdruck */
  shots: number
  rings: number | null
  decimal: number | null
  series: ProjectedSeries[]
}

/**
 * Die sichtbaren eigenen Scheiben einer Familie mit Beginn im Zeitraum, dazu die Wertung der Familie (Vorgabe eines
 * neuen Ziels) und die häufigste Schusszahl ihrer Scheiben mit Wertung (null ohne)
 */
export async function resultGoalCards(
  db: Db,
  query: { ownerId: string; familyId: number; fromMs: number; toMs: number; timeZone: string }
): Promise<{ cards: GoalCard[]; scoring: Scoring; usualShots: number | null; usualSeriesShots: number | null }>
```

- `rings`/`decimal` aus `projection.values["result.rings"|"result.decimal"]?.value`, `series` aus
  `projection.series ?? []`, `kind` über `card.kind` (wie die Übersichten, schon mit Wahl und Liste).
- `usualShots` über `modalLength` (`@vereinsheim/shot-core/stats`) der `printedShots` aller Scheiben der Familie ohne
  nur Probe, `usualSeriesShots` ebenso über die Schusszahlen der Serien.
- Test in `results-read.test.ts` gegen die Dev-Datenbank mit eigener Anlage: zwei Scheiben der Familie, eine einer
  anderen, eine im Papierkorb, eine wartende → nur die zwei; Werte gleich `values` der Projektion.

### Modell

```prisma
// Art eines Ziels: Ergebnis (kann gemessen werden) oder Prozess (nie gemessen)
enum DiaryGoalKind {
  result
  process
}

// was ein gemessenes Ziel zählt: Scheiben, Serien oder den Schnitt der Scheiben ab einer Ringzahl
enum DiaryGoalMeasure {
  card
  series
  average
}

// welche Scheiben zählen
enum DiaryGoalCards {
  all
  training
  competition
}

// in welcher Wertung ein Ziel zählt; eigene Werte, damit das Tagebuch keinen Typ des Ergebnisteils trägt
enum DiaryGoalScoring {
  rings
  decimal
}

// ein Saisonziel ([[spiegel-diary]]): ein Satz in eigenen Worten, eine Disziplin, ein Zeitraum; ein Ergebnisziel kann
// eine Messung tragen. Spiegel zeigt die Zahlen, „Hat es geklappt?“ beantwortet der Schütze
model DiaryGoal {
  id        String            @id @default(cuid())
  userId    String
  user      User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  // `Family.id`; null nur aus der Übernahme, wenn sich keine Disziplin ergibt
  familyId  Int?
  title     String
  note      String?
  kind      DiaryGoalKind
  // Tage in der Anzeige-Zone, beide eingeschlossen
  from      DateTime          @db.Date
  to        DateTime          @db.Date
  // Messung: alle vier gesetzt oder keines (nur bei `result`)
  measure   DiaryGoalMeasure?
  // in der Wertung des Ziels, Zehntel als eine Nachkommastelle
  threshold Decimal?          @db.Decimal(6, 1)
  scoring   DiaryGoalScoring?
  // Schusszahl einer Scheibe (`card`, `average`) oder einer Serie (`series`), die zählt
  shots     Int?
  cards     DiaryGoalCards    @default(all)
  // „Hat es geklappt?“
  outcome   DiaryOutcome?
  // Schlüssel der Übernahme (`treffsicher:<id>`)
  importKey String?           @unique
  // Papierkorb: 30 Tage
  deletedAt DateTime?         @db.Timestamptz(3)
  createdAt DateTime          @default(now()) @db.Timestamptz(3)
  updatedAt DateTime          @updatedAt @db.Timestamptz(3)

  @@index([userId, to])
}

// ein Schuss-Ablauf einer Disziplin: Name und Schritte, gelesen im Faden ([[spiegel-diary]])
model DiaryRoutine {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  // `Family.id`; null nur aus der Übernahme
  familyId  Int?
  name      String
  // [{ "title": string, "description"?: string }] in Reihenfolge, geprüft mit zod (`routineSteps`)
  steps     Json
  importKey String?   @unique
  deletedAt DateTime? @db.Timestamptz(3)
  createdAt DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt DateTime  @updatedAt @db.Timestamptz(3)

  @@index([userId, familyId])
}
```

`User` bekommt `diaryGoals DiaryGoal[]` und `diaryRoutines DiaryRoutine[]`. Die Schritte als JSON wie in Treffsicher:
Sie werden nur als Ganzes gelesen und geschrieben.

### Migration

`apps/spiegel/prisma/migrations/20261029090000_diary_goals_routines/migration.sql`, rein additiv (vier Enums, zwei
Tabellen, Indizes, zwei Fremdschlüssel auf `User` mit `ON DELETE CASCADE`). Erzeugt mit `prisma migrate diff`
(Basis: die Migrationen bis `20261028180000_diary_entries`), angewandt mit `prisma migrate deploy` (Auto-Memory „Spiegel
dev DB init checksum“). **Circuit-Breaker:** Schema-Diff und SQL gehen vor dem Commit an die Koordination.

### Reine Funktionen

- **`src/diary/goals/season.ts`:** `seasonOf(day: string): { from: string; to: string; label: string }` (1. September
  bis 31. August, Label „Saison 26/27“), `nextSeason(day)`, `goalPhase(goal, today): { phase: "upcoming" | "running"
  | "past"; months: number }` (Monate bis zum Ende, aufgerundet, mindestens 1, solange es läuft). Tests: 31.08. gehört
  zur alten Saison, 01.09. zur neuen, Schaltjahr, Phasen am ersten und letzten Tag.
- **`src/diary/goals/measure.ts`:** die Messung, rein, ohne Datenbank.

  ```ts
  export interface GoalRule {
    measure: "card" | "series" | "average"
    threshold: number
    scoring: "rings" | "decimal"
    shots: number
    cards: "all" | "training" | "competition"
    from: string
    to: string
  }
  export interface GoalPoint { cardId: string; day: string; startedAtMs: number; value: number; hit: boolean }
  export interface GoalStand {
    /** gezählte Scheiben (`card`, `average`) oder Serien (`series`) */
    counted: number
    hits: number
    /** die letzten zehn gezählten */
    recent: { counted: number; hits: number }
    best: GoalPoint | null
    /** Schnitt der gezählten Scheiben; nur bei `average`, sonst null */
    mean: number | null
    points: GoalPoint[]
    /** Scheiben im Zeitraum, die nicht zählen, nach Grund (für die Grundlage) */
    left: { noValue: number; otherShots: number; noSeries: number }
  }
  export function measureGoal(rule: GoalRule, cards: readonly GoalCard[]): GoalStand
  ```

  Regeln: Eine Scheibe zählt im Zeitraum (`day` zwischen `from` und `to`), in der gewählten Art, nicht nur Probe. Bei
  `card` und `average` mit `shots` gleich der Schusszahl und einem Wert in der Wertung, sonst `otherShots` bzw.
  `noValue`. Bei `series` jede Serie mit `shots` Schuss und Wert; eine Scheibe ohne Serien zählt als `noSeries`.
  `hit` heißt Wert ≥ Schwelle (ein Wert in Zehnteln wird vorher auf eine Stelle gerundet, kein Epsilon). Nur Probe
  zählt nie und steht nicht in `left`. Tests mit festen Zahlen je Regel, dazu je eine Mutationsprobe (`>=` → `>`,
  Art-Filter weg) laut conventions §9.
- **`src/diary/goals/stand-text.ts`:** die Sätze aus `GoalStand` (siehe „Texte“), rein, mit `@vereinsheim/lib/format`.
- **`src/diary/routines/steps.ts`:** `stepsToText(steps)` und `textToSteps(text)`: Absätze durch Leerzeilen getrennt,
  erste Zeile Titel, die übrigen die Erklärung; Leerzeilen am Rand und doppelte weg, Titel und Erklärung getrimmt, eine
  Erklärung ohne Text fällt weg. Test: `textToSteps(stepsToText(s))` gleich `s` für Schritte ohne Leerzeile in der
  Erklärung (55 Schritte, ein Schritt, Schritt ohne Erklärung), eine Erklärung mit Leerzeile wird beim Speichern eine
  Zeile. Höchstens 200 Schritte, Titel bis 300, Erklärung bis 2.000 Zeichen.

### Schreiben

`src/diary/goals/goals.ts` und `src/diary/routines/routines.ts` wie `entries.ts`: jede Änderung in einer
Transaktion, die die Zeile `FOR UPDATE` sperrt und `userId` prüft, Fehler als Text aus `GOAL_ERRORS` bzw.
`ROUTINE_ERRORS`. Funktionen:

- Ziele: `createGoal`, `updateGoal` (Satz, Art, Disziplin, Zeitraum, Messung als Ganzes; Prozessziel löscht die
  Messung), `setGoalNote`, `setGoalOutcome`, `deleteGoal`, `restoreGoal`, `purgeGoalNow`.
- Abläufe: `createRoutine`, `updateRoutine` (Name und Schritte aus dem Text), `setRoutineFamily`, `deleteRoutine`,
  `restoreRoutine`, `purgeRoutineNow`.
- Prüfung mit zod in `src/diary/goals/validation.ts` und `src/diary/routines/validation.ts`: Satz 1–200 Zeichen,
  `to` ≥ `from`, Disziplin aus `resultFamilies`, Schwelle > 0, ganze Zahl bis 10 × Schusszahl bei `rings`, eine
  Stelle bis 10,9 × Schusszahl bei `decimal`, Schusszahl 1–200.
- Actions in `src/diary/goals/actions.ts` und `src/diary/routines/actions.ts` (`"use server"`, nur direkt deklarierte
  async-Funktionen), mit `guard()` wie `src/diary/actions.ts` (Sitzung, Schalter), `ActionResult`,
  `revalidatePath("/diary", "layout")` und `revalidatePath("/")` für die Zeile auf Start.
- `previewGoal(input)` (Server Action): rechnet für das Formular den Satz „Bisher in diesem Zeitraum: …“ aus
  `resultGoalCards` und `measureGoal`, ohne zu speichern; ungültige Eingabe → kein Satz.
- `purgeExpiredDiaryTrash` löscht abgelaufene Ziele und Abläufe mit; die Zahl im Log ist die Summe.

### Ziele: Oberfläche

- **Reiter:** `DiaryHeader` bekommt `current: "entries" | "thread" | "goals"` und den dritten Reiter „Ziele“
  (`/diary/goals`). Der Knopf oben heißt auf „Ziele“ „Neues Ziel“ (`/diary/goals/new`), sonst wie heute.
- **`/diary/goals`** (`GoalList`): Gruppen „Laufend“ (Ende aufsteigend), „Kommend“ (Beginn aufsteigend), „Vorbei“
  (Ende absteigend); eine leere Gruppe fehlt. Karte ganz als Link: Satz, „{Disziplin} · bis {to}“ (vorbei:
  „{from} – {to}“), darunter links der Stand in einer Zeile, rechts der Zustand („läuft“, „beginnt am {from}“, sonst
  die Antwort auf „Hat es geklappt?“ oder „vorbei“). Leer: `EmptyState` (Texte unten).
- **`/diary/goals/[id]`** (`GoalScreen`), eine Spalte (`PAGE_SINGLE`): Rückweg „Ziele“, Satz als `h1`, Unterzeile
  „{Disziplin} · {Art der Scheiben, nur wenn nicht alle} · {from} – {to}“ (Prozessziel: „Prozessziel“ statt der Art),
  dann Kästen in fester Folge, gleich für jedes Ziel:
  1. **Stand:** Kopf „Stand“ mit Zustand. Mit Messung: große Zahl und Satz, drei Kacheln („zuletzt“, „Bestes“,
     „Schnitt“), der Verlauf (`GoalChart`, SVG: ein Punkt je gezählter Einheit, Ziellinie gestrichelt in `gold`, Punkte
     ab der Schwelle in `gold`, die übrigen in `quiet`; Achse nur erster und letzter Monat), Grundlage (nur wenn etwas
     nicht zählt) und „Im Fortschritt ansehen ›“. Ohne Messung beim Ergebnisziel eine Zeile mit „+“ „Messung
     festlegen“ (öffnet das Formular), beim Prozessziel der Satz, dass Spiegel es nicht misst. Vor dem Beginn: „Der
     Zeitraum beginnt am {from}.“
  2. **Notiz:** leer eine Zeile mit „+“, gefüllt `EntryText` mit Speichern und Verwerfen.
  3. **Hat es geklappt?:** `OutcomeChoice`, verallgemeinert (Prop `save` statt `entryId`; der Eintrag gibt
     `saveOutcome.bind(null, id)`), mit dem leisen Satz darunter.
  4. **Einträge im Zeitraum:** Einträge der Disziplin (bei `familyId` null alle) mit Tag im Zeitraum, nicht im
     Papierkorb, neueste oben, wie Zeilen der Liste (kleine Scheibe, Vorhaben, „{Tag} · {n} Scheiben“), die ersten fünf,
     dann „Alle {n} Einträge zeigen“ (klappt auf). Ohne Einträge ein Satz.
  5. **Dieses Ziel:** „Satz, Zeitraum und Messung“ bzw. „Satz und Zeitraum“ · „Ändern“ (`/diary/goals/[id]/edit`),
     „Löschen“ mit Rückfrage, danach „Ziel gelöscht · Rückgängig“ (`useUndo`) und zurück zur Liste.
  - „Im Fortschritt ansehen“: `urlFromRoute({ page: "progress", query: { ...DEFAULT_PROGRESS, family, kind,
    includeProbeOnly: false, choice: { type: "free", from, to } } })`; bei einem Ziel, das noch läuft, `to` = heute.
- **`/diary/goals/new` und `/diary/goals/[id]/edit`** (`GoalForm`, gesteuert, conventions §9): „Was willst du
  erreichen?“, „Art“ (Segment Ergebnisziel · Prozessziel), „Disziplin“ (Chips aus `resultFamilies`, vorgewählt die
  der neuesten eigenen Scheibe), „Zeitraum“ (Segment „Saison 26/27“ · „Saison 27/28“ · „Frei“, bei „Frei“ zwei
  Datumsfelder; Vorgabe die laufende Saison), bei Ergebnisziel der Kasten „Spiegel misst mit“ (Schalter, an), darin
  „Was zählt?“ (Segment Scheibe · Serie · Schnitt), „Ab wie vielen Ringen?“ (Feld `w-0 grow max-w-28`, conventions §9),
  darunter die Zeile „in ganzen Ringen · auf 40 Schuss“ mit „Ändern“, das Wertung (Segment Ganze Ringe · Zehntel) und
  Schusszahl aufklappt (Vorgaben aus `resultGoalCards`: Wertung der Familie, `usualShots` bzw. `usualSeriesShots`),
  „Welche Scheiben?“ (Segment Alle · Training · Wettkampf), der Satz aus `previewGoal` (300 ms nach der letzten
  Änderung). Unten eine klebende Leiste mit „Abbrechen“ und „Ziel anlegen“ bzw. „Speichern“; `toast.dismiss()` beim
  Öffnen, Fehler an der Leiste (conventions §9). Verlassen mit Ungespeichertem: `useUnsavedChangesGuard`,
  `useNavigationConfirm` und Rückfrage `goalDiscard`. Ein bestehendes Ziel ohne Messung (aus der Übernahme) öffnet mit
  Schalter aus.
- **Start:** `goalStartLines(db, { ownerId, families, timeZone })` in `src/parts/lines.ts` gibt je Familie die Zeile
  des zuletzt angelegten laufenden Ziels mit Messung (`PartLine`: Titel „Ziel {Schwelle}“, Zustand „{hits} von {counted}
  Scheiben“ bzw. „Serien“, bei Schnitt „Schnitt {mean}“, Ziel `/diary/goals/[id]`, Aktion leer). `startLines` gibt
  dafür je Block eine Liste (`Record<string, PartLine[]>`): erst die Zeile des Eintrags, dann die des Ziels.
  `StartScreen` zeigt jede Zeile als `[title, state, action].filter(Boolean).join(" · ") + " ›"`; für die Zeile des
  Eintrags (Zustand leer) bleibt der Text wie heute. Tagebuch aus → keine Zeilen.

### Abläufe: Oberfläche

- **Faden** (`ThreadView`): Chips der Disziplinen mit Frage oder Ablauf (heute nur mit Frage), dann der Kasten
  „Abläufe“ (`RoutineBox`): Kopf mit „+“ (`/diary/routines/new?family=<slug>`), je Ablauf eine Zeile (Name, „{n}
  Schritte“, ganz der Link), ohne Ablauf eine Zeile mit „+“ und Satz. Darunter Satz und Zeitstrahl wie heute. Hat das
  Konto weder Frage noch Ablauf, steht der Kasten über dem Leersatz, ohne Chips.
- **`/diary/routines/[id]`** (`RoutineScreen`): Rückweg „Faden“ (zur Disziplin des Ablaufs), Name als `h1`,
  „{Disziplin} · {n} Schritte“, ein Kasten mit der nummerierten Liste (weiche gefüllte Kreise `accent-wash` mit Nummer,
  Titel fett, Erklärung mit Zeilenumbrüchen), „Dieser Ablauf“: „Schritte und Name“ · „Bearbeiten“, „Disziplin“ ·
  „Ändern“ (Blatt mit Chips), „Löschen“ mit Rückfrage und „Ablauf gelöscht · Rückgängig“.
- **`/diary/routines/new` und `/diary/routines/[id]/edit`** (`RoutineForm`): „Name“, bei neu „Disziplin“ (Chips,
  vorgewählt aus `?family=`), „Schritte“ als ein Textfeld (`textarea`, wächst mit), darunter der Hinweis mit der
  Zahl der Schritte live aus `textToSteps`. Klebende Leiste „Verwerfen“ / „Speichern“ bzw. „Ablauf anlegen“; Wächter
  und Rückfrage `routineDiscard` wie beim Ziel.

### Papierkorb, Export, Konto löschen

- `diaryTrash` liefert dazu Ziele („Ziel“, Satz, „noch n Tage“) und Abläufe („Ablauf“, Name); `DiaryTrash` zeigt sie in
  derselben Zeilenform unter der Überschrift „Im Tagebuch“ (heute „Einträge im Tagebuch“), mit „Wiederherstellen“ und
  „Endgültig löschen“ (Rückfragen `goalPurgeNow`, `routinePurgeNow`). Ein wiederhergestelltes Ziel steht wieder in der
  Liste, ein Ablauf wieder im Faden.
- `diaryExport` bekommt `goals` (alle Felder, `threshold` als Zahl, Tage als ISO) und `routines` (Name, Disziplin,
  Schritte), auch die im Papierkorb.
- Konto löschen: die Kaskade über `User` nimmt beides mit; `account-actions.test.ts` legt ein Ziel und einen Ablauf an
  und prüft, dass sie danach fehlen.

## Texte (Textbuch Spiegel, „Tagebuch (2b)“; erst hier freigeben, dann in den Code)

Schreibregeln conventions §10, keine Semikolons, keine Pronomen für Personen in Rückfragen. `{…}` setzt die App ein.

**Reiter und Liste** (`GOAL_TEXTS`): Reiter „Ziele“; Knopf „Neues Ziel“; Gruppen „Laufend“, „Kommend“, „Vorbei“;
Karte „{Disziplin} · bis {to}“, vorbei „{Disziplin} · {from} – {to}“; Stand „{hits} von {counted} Scheiben ab
{Schwelle}“, „{hits} von {counted} Serien ab {Schwelle}“, „Schnitt {mean} über {counted} Scheiben“, ohne Messung
„Ergebnisziel ohne Messung“ bzw. „Prozessziel · {n} Einträge im Zeitraum“; Zustand „läuft“, „beginnt am {from}“,
„vorbei“, sonst „Ja“, „Teilweise“, „Nein“. Leer: Titel „Noch kein Ziel“, Text „Ein Ziel ist ein Satz in deinen Worten
für eine Saison. Spiegel kann mitzählen, wie oft du eine Ringzahl erreichst.“, Knopf „Neues Ziel“.

**Seite eines Ziels:** Rückweg „Ziele“; Unterzeile „Prozessziel“, „Training“, „Wettkampf“; Kopf „Stand“, Zustand
„läuft · noch {n} Monate“ („noch 1 Monat“), „beginnt am {from}“, „vorbei“; große Zahl „{hits}“ mit „von {counted}
Scheiben ab {Schwelle} Ringen“ bzw. „Serien“, bei Schnitt „{mean}“ mit „Schnitt über {counted} Scheiben · Ziel
{Schwelle}“; Kacheln „{hits} von {n}“ · „zuletzt“, „{best}“ · „Bestes, {Tag}“, „{mean}“ · „Schnitt“; Grundlage „über
{n} Scheiben · {k} ohne Ergebnis zählen nicht“, „· {k} mit anderer Schusszahl zählen nicht“, „· {k} ohne Serien zählen
nicht“; Link „Im Fortschritt ansehen ›“; noch keine gezählt: „Noch keine Scheibe in diesem Zeitraum.“; vor Beginn „Der
Zeitraum beginnt am {from}.“; Ergebnisziel ohne Messung: Zeile „Messung festlegen“, „Spiegel misst dieses Ziel noch
nicht. Mit einer Ringzahl siehst du hier, wie oft du sie erreichst.“; Prozessziel: „Ein Prozessziel misst Spiegel
nicht. Wie es läuft, zeigen deine Einträge und deine Antwort unten.“; „Notiz“, leer „Woran merkst du, dass es
klappt?“, gespeichert „Notiz gespeichert.“; „Hat es geklappt?“ mit „Das sagst du selbst, wann du willst. Spiegel
urteilt nicht für dich.“; „Einträge im Zeitraum“, „Alle {n} Einträge zeigen“, leer „Noch kein Eintrag in diesem
Zeitraum.“; „Dieses Ziel“, „Satz, Zeitraum und Messung“ bzw. „Satz und Zeitraum“, „Ändern“, „Löschen“, „Danach liegt
das Ziel 30 Tage im Papierkorb im Profil. Scheiben und Einträge bleiben.“

**Formular:** Titel „Neues Ziel“ bzw. „Ziel ändern“; „Was willst du erreichen?“ (Platzhalter „zum Beispiel: 355 im
Training regelmäßig schießen“); „Art“ mit „Ergebnisziel“, „Prozessziel“; „Disziplin“; „Zeitraum“ mit „Saison {26/27}“,
„Frei“, „Von“, „Bis“, darunter „{from} bis {to}“; „Spiegel misst mit“, „Aus heißt: nur der Satz, wie ein
Prozessziel.“; „Was zählt?“ mit „Scheibe“, „Serie“, „Schnitt“; „Ab wie vielen Ringen?“; „in ganzen Ringen“ bzw. „in
Zehnteln“, „auf {n} Schuss“, „Ändern“, „Wertung“ mit „Ganze Ringe“, „Zehntel“, „Schuss je Scheibe“ bzw. „Schuss je
Serie“; „Welche Scheiben?“ mit „Alle“, „Training“, „Wettkampf“; Vorschau „Bisher in diesem Zeitraum: {hits} von
{counted} Scheiben ab {Schwelle}.“ (Serie, Schnitt entsprechend), ohne Scheiben „Bisher keine Scheibe in diesem
Zeitraum.“; Knöpfe „Abbrechen“, „Ziel anlegen“, „Speichern“; Toasts „Ziel angelegt.“, „Ziel gespeichert.“.
Feldfehler: „Bitte einen Satz.“, „Höchstens 200 Zeichen.“, „Bitte eine Disziplin wählen.“, „Das Ende liegt vor dem
Beginn.“, „Bitte eine Ringzahl wie 355.“, „Bitte eine Ringzahl wie 365,5.“, „So viele Ringe gehen auf {n} Schuss
nicht.“, „Bitte eine Schusszahl von 1 bis 200.“ Allgemein `ERRORS` aus 2a, dazu „Dieses Ziel gibt es nicht mehr.“

**Abläufe:** Kasten „Abläufe“, Zeile „{n} Schritte“ („1 Schritt“), leer „Noch kein Ablauf für {Disziplin}. Schreib auf,
wie du einen Schuss aufbaust.“; Seite: Rückweg „Faden“, „{Disziplin} · {n} Schritte“, „Dieser Ablauf“, „Schritte und
Name“, „Bearbeiten“, „Disziplin“, „Ändern“, „Löschen“, „Danach liegt der Ablauf 30 Tage im Papierkorb im Profil.“;
Formular: „Neuer Ablauf“ bzw. „Ablauf bearbeiten“, „Name“ (Platzhalter „zum Beispiel: Mein Ablauf“), „Disziplin“,
„Schritte“, Hinweis „Jeder Absatz ist ein Schritt. Die erste Zeile ist sein Titel, was darunter steht, die Erklärung.
Gerade: {n} Schritte.“, Knöpfe „Verwerfen“, „Speichern“, „Ablauf anlegen“; Toasts „Ablauf angelegt.“, „Ablauf
gespeichert.“, „Disziplin geändert.“; Feldfehler „Bitte einen Namen.“, „Bitte mindestens einen Schritt.“, „Höchstens
200 Schritte.“; allgemein „Diesen Ablauf gibt es nicht mehr.“

**Start:** „Ziel {Schwelle} · {hits} von {counted} Scheiben ›“, „… Serien ›“, „Ziel {Schwelle} · Schnitt {mean} ›“.

**Papierkorb:** Überschrift „Im Tagebuch“; Zeilen „Ziel“ · „{Satz}“ · „noch {n} Tage“, „Ablauf“ · „{Name}“ · „noch {n}
Tage“.

**Folgen** (`src/diary/consequences.ts`, Tests halten den Wortlaut):

- `goalDelete({ title })`: Titel „Ziel löschen?“; worum „Du löschst das Ziel „{title}“.“; passiert „Es liegt 30 Tage
  im Papierkorb (im Profil). So lange steht es nirgends, auch nicht auf Start.“, „Danach löscht Spiegel es endgültig,
  mit Notiz und Antwort.“; passiert nicht „Scheiben und Einträge bleiben, wie sie sind.“; rückgängig „30 Tage lang im
  Papierkorb wiederherstellen.“; Knopf „Löschen“; destruktiv. Danach „Ziel gelöscht · Rückgängig“.
- `goalPurgeNow({ title })`: Titel „Ziel endgültig löschen?“; worum „Du löschst das Ziel „{title}“ endgültig.“;
  passiert „Spiegel löscht es sofort, mit allen Angaben.“; passiert nicht „Scheiben und Einträge bleiben.“;
  rückgängig „Das lässt sich nicht rückgängig machen.“; Knopf „Endgültig löschen“.
- `goalDiscard()`: Titel „Änderungen verwerfen?“; worum „Am Ziel ist etwas geändert und noch nicht gespeichert.“;
  passiert „Die Änderungen sind weg.“; passiert nicht „Was schon gespeichert war, bleibt.“; rückgängig „Neu
  eintragen.“; Knopf „Verwerfen“; destruktiv.
- `routineDelete({ name })`, `routinePurgeNow({ name })`, `routineDiscard()`: wie beim Ziel mit „Ablauf“, passiert
  nicht „Einträge und Faden bleiben, wie sie sind.“, Toast „Ablauf gelöscht · Rückgängig“.

## Dateien

Neu:

- `apps/spiegel/prisma/migrations/20261029090000_diary_goals_routines/migration.sql`
- `apps/spiegel/src/diary/goals/`: `season.ts`, `measure.ts`, `stand-text.ts`, `validation.ts`, `goals.ts`,
  `queries.ts` (Liste, Seite, Einträge im Zeitraum, Zeile auf Start), `actions.ts`, `texts.ts`; Tests daneben
- `apps/spiegel/src/diary/routines/`: `steps.ts`, `validation.ts`, `routines.ts`, `queries.ts`, `actions.ts`,
  `texts.ts`; Tests daneben
- `apps/spiegel/src/diary/components/`: `GoalList.tsx`, `GoalScreen.tsx`, `GoalChart.tsx`, `GoalForm.tsx`,
  `RoutineBox.tsx`, `RoutineScreen.tsx`, `RoutineForm.tsx`, `DeleteGoal.tsx`, `DeleteRoutine.tsx`
- `apps/spiegel/src/app/(app)/diary/goals/page.tsx`, `goals/new/page.tsx`, `goals/[id]/page.tsx`,
  `goals/[id]/edit/page.tsx`, `routines/new/page.tsx`, `routines/[id]/page.tsx`, `routines/[id]/edit/page.tsx`

Geändert:

- `packages/shot-core/src/analysis/projection.ts` (+ Test), `packages/shot-core/CLAUDE.md`
- `apps/spiegel/prisma/schema.prisma`
- `apps/spiegel/src/lib/results-read.ts` (+ Test)
- `apps/spiegel/src/parts/lines.ts` (+ Test), `src/components/start/StartScreen.tsx`, `src/app/(app)/page.tsx`
- `apps/spiegel/src/diary/`: `components/DiaryList.tsx` (Reiter, Knopf), `components/ThreadView.tsx`,
  `components/OutcomeChoice.tsx`, `components/EntryScreen.tsx` (Prop `save`), `components/DiaryTrash.tsx`,
  `components/components.test.tsx`, `queries.ts` (`threadView`), `trash.ts`, `trash-actions.ts`, `export.ts`,
  `consequences.ts` (+ Test), `texts.ts`
- `apps/spiegel/src/parts/account-actions.test.ts`, `src/parts/account.test.ts`
- `apps/spiegel/tools/pruefen-diary.ts`, `apps/spiegel/CLAUDE.md`
- Vault: `vault/spiegel/spiegel-diary.md`, `vault/spiegel/spiegel-db-schema.md`, `vault/decisions/adr-033.md`
  (Nachtrag), `vault/spiegel/spiegel-metrics.md` (Serien in der Projektion), `vault/index.md` falls nötig

## Required Docs

- `vault/spiegel/spiegel-diary.md` (Zonen, Stellen, Seiten, Papierkorb)
- `vault/decisions/adr-033.md` (Tagebuch und seine Bezüge, Nachtrag 2a)
- `vault/conventions.md` (§2, §3, §9 Formulare, Toasts über Leisten, Felder fester Breite, §10 Schreibregeln)
- `apps/spiegel/CLAUDE.md` (Tagebuch, Fortschritt, Projektion), `packages/shot-core/CLAUDE.md` (Projektion gleich
  Live-Rechnung, Angaben ohne Einzelschüsse)
- `plans/2026-10-26-treffsicher-in-spiegel.md` („Designkonzept 2b, Runde 1“, Regeln für Kindsessions)

## Aufgaben

Jede Aufgabe ein Commit, Gate vor jedem Commit (`pnpm check` im Worktree). Die mit ⛔ halten an und gehen erst an die
Koordination.

**Teil A · Grundlage**

1. Plan als erster Commit (`docs(plans): 2b goals and routines`).
2. `CardProjection.series` in `projection.ts`, `PROJECTION_VERSION` 7, Tests (siehe oben), `shot-core/CLAUDE.md`.
3. `resultGoalCards` in `results-read.ts` mit Test.
4. ⛔ Schema und Migration (`DiaryGoal`, `DiaryRoutine`, Enums, `User`-Felder); `prisma migrate diff`, Diff und SQL an
   die Koordination, nach Freigabe `prisma migrate deploy` gegen die Dev-Datenbank und `prisma generate`.
5. `season.ts`, `measure.ts`, `stand-text.ts` mit Tests und Mutationsproben.
6. `routines/steps.ts` mit Tests.

**Teil B · Ziele**

7. `goals/validation.ts`, `goals/goals.ts` (Transaktionen), Tests gegen die Dev-Datenbank (eigenes Konto aus
   `test/fixtures.ts`, am Ende gelöscht): anlegen, ändern, Prozessziel löscht Messung, fremdes Konto → Fehler, Notiz,
   Antwort, löschen, wiederherstellen, endgültig.
8. `goals/queries.ts` (Liste in Gruppen, Seite mit Stand, Einträge im Zeitraum, `goalStartLine`) mit Tests;
   `goals/actions.ts` inkl. `previewGoal`, Test der Actions wie `actions.test.ts`.
9. Texte `goals/texts.ts`, Folgen in `consequences.ts` (+ Test).
10. `OutcomeChoice` mit `save`, `DiaryHeader` mit drittem Reiter und Knopf je Reiter, `GoalList` und
    `/diary/goals`; Markup-Tests in `components.test.tsx` (Gruppen, leere Gruppe fehlt, Karte ist Link).
11. `GoalChart`, `GoalScreen`, `DeleteGoal`, `/diary/goals/[id]`; Markup-Tests (feste Folge der Kästen mit und ohne
    Messung, Prozessziel, vor Beginn, Grundlage nur wenn etwas fehlt).
12. `GoalForm`, `/diary/goals/new`, `/diary/goals/[id]/edit`; Markup-Test (Messung nur bei Ergebnisziel).
13. Start: `startLines` als Liste, `goalStartLines`, `StartScreen`, `page.tsx`; Tests in `lines.test.ts` (Tagebuch
    aus → leer, Ziel ohne Messung → keine Zeile, zwei laufende → das zuletzt angelegte).
14. Papierkorb für Ziele (`trash.ts`, `trash-actions.ts`, `DiaryTrash`, `purgeExpiredDiaryTrash`) mit Tests.

**Teil C · Abläufe, Daten, Prüfung, Doku**

15. `routines/validation.ts`, `routines/routines.ts`, `routines/queries.ts`, `routines/actions.ts`, Texte, Folgen;
    Tests gegen die Dev-Datenbank wie in 7.
16. `threadView` mit Abläufen, `RoutineBox`, `ThreadView`; Markup-Tests (Konto nur mit Ablauf zeigt den Kasten).
17. `RoutineScreen`, `RoutineForm`, `DeleteRoutine`, die drei Seiten; Markup-Tests (Nummern, Erklärung mit
    Zeilenumbruch, Zahl der Schritte im Hinweis).
18. Papierkorb für Abläufe, `diaryExport` mit `goals` und `routines`, Test in `account.test.ts`; Kaskade in
    `account-actions.test.ts`.
19. Skriptprüfung in `tools/pruefen-diary.ts` (siehe „Tests und Verifikation“), Aufräumen am Ende um Ziele und
    Abläufe des Demo-Kontos erweitert.
20. ⛔ Nachtrag zu ADR-033 (Text unten) als Diff an die Koordination, nach Freigabe committen; dazu
    `spiegel-diary.md` (Ziele, Abläufe, Treffsicher-2.0-Zahlen), `spiegel-db-schema.md`, `spiegel-metrics.md`,
    `apps/spiegel/CLAUDE.md`; `vault-lint` grün.
21. `/validate` (Bericht nach `reports/`), Sichtprüfung im Browser (Telefon 390 und 360 px, Desktop, hell und dunkel)
    mit frischem Blick, `/review`, Lessons, Rebase auf den Basisbranch, Meldung an die Koordination.

### Nachtrag zu ADR-033 (Entwurf, geht in Aufgabe 20 als Diff an die Koordination)

> ## Nachtrag (28. Oktober 2026): Ziele und Abläufe (2b)
>
> Entschieden mit dem User am 28. Oktober 2026 nach dem Designkonzept 2b, Runde 1. Grundlage sind die Zählungen in der
> Prod-Kopie: 10 Ziele in 4 Konten (8 Ergebnisziele, 7 mit einer Ringzahl im Titel, keines geändert), 4 Abläufe in
> 2 Konten (nie geändert), 69 Anhänge an 56 Einheiten, jede davon mit Ergebnissen.
>
> - **Ziele messen, nicht urteilen.** Ein Ziel ist ein Satz, eine Disziplin und ein Zeitraum (Vorgabe die Saison vom
>   1. September bis 31. August). Ein Ergebnisziel kann eine Messung tragen: Scheibe, Serie oder Schnitt ab einer
>   Ringzahl, in einer Wertung, auf eine Schusszahl, für alle Scheiben, Training oder Wettkampf. Spiegel zeigt, wie oft
>   und wie zuletzt, ein Urteil fällt Spiegel nicht: „Hat es geklappt?“ beantwortet der Schütze. Die Messung liest
>   Scheiben nur über die schmale Schnittstelle (`resultGoalCards`), die Serien kommen aus der Projektion.
> - **Kein Anhaken.** Einheiten werden nicht mehr an Ziele gehängt. „Einträge im Zeitraum“ ergibt sich aus Disziplin und
>   Zeitraum. Die Übernahme nimmt Satz, Beschreibung als Notiz, Art und Zeitraum, rät keine Messung und leitet die
>   Disziplin aus den verknüpften Einheiten ab. Verknüpfungen außerhalb des Zeitraums stehen im Prüfbestand, alle
>   bleiben in der Sicherung der Treffsicher-Datenbank.
> - **Abläufe im Faden** (wieder aufgemacht vom User, statt „eigene Seite im Tagebuch“ in „Was aus Treffsicher
>   umzieht“): Die Abläufe einer Disziplin stehen oben im Faden, jeder mit eigener Leseseite. Bearbeitet wird ein
>   Ablauf als ein Textfeld (Absatz = Schritt, erste Zeile = Titel).
> - **Keine Anhänge im Tagebuch** (wieder aufgemacht vom User, statt „Anhänge bleiben im Tagebuch“): Jede Datei aus
>   Treffsicher wird Ausdruck oder Beleg ihrer Scheibe. Mehrere Belege je Scheibe bringt Teil 1f im Ergebnisteil.
> - Zeile „Anhänge“ in „Was aus Treffsicher umzieht“ gilt damit als: Meyton-PDFs werden Ausdrucke, alle übrigen Dateien
>   Belege der Scheibe ihrer Einheit; „Schuss-Abläufe“ als: bleibt, im Faden der Disziplin.

## Tests und Verifikation

- **Gate:** `pnpm check` im Worktree (Stop-Hook prüft den Haupt-Checkout, Auto-Memory). `boundary.test.ts` bleibt grün
  ohne neue Ausnahme.
- **Unit:** Saison, Messung (mit Mutationsproben), Sätze, Schritte (Hin und zurück), Validierung, Folgen (Wortlaut,
  `OLD_WORDS`-Stil: keine Semikolons), Projektion (Serien, Version).
- **Dev-Datenbank:** Schreiben und Lesen von Zielen und Abläufen mit eigenem Testkonto, `resultGoalCards`,
  `startLines`, Papierkorb, Export, Kaskade beim Konto löschen (in der Transaktion, die zurückrollt).
- **Markup:** `components.test.tsx` mit `renderToStaticMarkup` für Liste, Seite, Formular, Faden, Ablauf.
- **Skriptprüfung** (`pnpm --filter spiegel pruefen --start --nur Tagebuch`, mit `seed:own --demo` und danach
  `seed:own` in einem Befehl, Auto-Memory): Tagebuch einschalten, Reiter „Ziele“, Leerzustand, „Neues Ziel“ mit Messung
  „Scheibe ab“ einer Zahl unter dem besten Demo-Ergebnis, Vorschau erscheint, anlegen, Seite zeigt Stand mit Zahl und
  Verlauf, „Im Fortschritt ansehen“ öffnet `/progress` mit freiem Zeitraum, Notiz speichern, „Hat es geklappt?“ Ja und
  wieder weg, ändern auf „Serie“, Start zeigt „Ziel … ›“ und führt zum Ziel, löschen mit Rückgängig, löschen und im
  Papierkorb wiederherstellen; Faden: Kasten „Abläufe“, neuer Ablauf aus drei Absätzen → Leseseite mit drei Nummern,
  bearbeiten, Verlassen mit Ungespeichertem fragt, löschen mit Rückgängig; kein seitliches Scrollen bei 390 und 360 px
  (`innerWidth === visualViewport.width`) auf allen neuen Seiten; keine Skriptfehler. Am Ende alles des Demo-Kontos
  gelöscht, Tagebuch aus.
- **Sichtprüfung im Browser** gegen das Konzept, Telefon und Desktop, hell und dunkel; was die Dev-Daten nicht hergeben
  (etwa ein Ziel mit Zehnteln), steht im Bericht als „nicht belegt“ mit dem Test, der den Pfad abdeckt.
- **Projektion:** nach dem Start `refreshStaleProjections` gegen die Dev-Datenbank; Stichprobe: Serien einer
  gemessenen Scheibe gleich den Serien auf ihrer Seite.
- Keine neue Brücke nötig (kein Vertrag berührt).

## Offene Fragen an die Koordination

1. **Serien in der Projektion** (Fachkern, `PROJECTION_VERSION` 7): Ohne sie müsste „Serie ab X“ die Schüsse aller
   Scheiben einer Saison lesen, gegen ADR-031. Es ist eine Änderung in `packages/shot-core` (Ergebnisteil), ohne Wissen
   über Ziele. Empfehlung: so. Alternative: „Serie“ liest die Serien je Scheibe über `resultCardSeries` (eine Abfrage
   je Scheibe), nur auf der Seite des Ziels, Start zeigt für Serien-Ziele keine Zeile.
2. **Zeilen auf Start als Liste:** Die Stelle aus 2a trägt eine Zeile je Block. Für die Zeile zum Ziel wird sie eine
   Liste (`StartScreen` zeigt alle Zeilen eines Blocks, der Ergebnisteil weiß nicht, woher). Empfehlung: so.
3. **Schusszahl und Wertung am Ziel:** Ohne sie zählte eine Scheibe mit 20 Schuss gegen eine Schwelle für 40, und
   „355“ hieße in Zehnteln etwas anderes. Beides ist vorbelegt (Wertung der Familie, häufigste Schusszahl) und steht als
   eine Zeile mit „Ändern“, nicht als eigene Fragen. Empfehlung: so.
4. **Papierkorb auch für Ziele und Abläufe** (30 Tage, wie Einträge, wie im Konzept „Dieses Ziel“). Empfehlung: so.
