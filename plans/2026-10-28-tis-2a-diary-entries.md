# 2a · Einträge des Tagebuchs

Teilplan von Stufe 2 aus `plans/2026-10-26-treffsicher-in-spiegel.md` (Basisbranch `feat/treffsicher-in-spiegel`),
Kindsession `tis-2a-diary-entries`, Branch `feat/tis-2a-diary-entries` vom Basisbranch (`55349ee3`). Entscheidungen im
Koordinationsplan unter „Stufe 2 · Das Tagebuch“, Regeln in [[adr-033]] („Das Tagebuch und seine Bezüge“, „Was aus
Treffsicher umzieht“, „Datenschutz des Tagebuchs“, „Tagebuch abschaltbar“). Die Oberfläche folgt dem Designkonzept
„Tagebuch in Spiegel“ (Runde 4, 28. Oktober 2026, privates Artifact des Users), das mit dem User in vier Runden
entstanden ist.

## Kontext

Das Tagebuch ist Treffsicher 2.0. Treffsicher war eine lange Phase zum Ausprobieren. Was genutzt wurde, wird besser;
was kaum genutzt wurde, wird einfacher oder fällt weg. Grundlage sind die Zählungen in der Prod-Kopie von Treffsicher
(265 Einheiten in 6 Konten): Die Absicht ist das meistgenutzte Textfeld (51), Befinden (39) füllen fast nur zwei Konten,
Beobachtung, Erkenntnis und Lernfrage werden zusammen genutzt (24, vier Konten) und bauen über Monate aufeinander auf,
Prognose (14) und Feedback (21) fast nur bei Wettkämpfen, Ausführung je Serie bei 180 von 1037 Serien (drei Konten),
jedes übrige Textfeld höchstens 18-mal.

2a baut den Teil Tagebuch in Spiegel: Modell, Schalter im Profil, Bereich in der Leiste, Liste, Faden, Seite eines
Eintrags, Anlegen mit Vorschlag, die Zeile an der Scheibe und auf Start, Papierkorb, Hinweis beim ersten Öffnen, Export
und Konto löschen über beide Teile, das Gate. Saisonziele, Schuss-Abläufe und Anhänge folgen in 2b, Einflüsse und
Selbstbild in 2c, die Übernahme aus Treffsicher in Stufe 3.

## Schnitt

Ein Plan, ein Branch, eine Migration, in drei Teilen in dieser Reihenfolge:

- **Teil A · Modell, Grenze, Rahmen:** Schema und Migration, schmale Schnittstelle des Ergebnisteils, Nahtstellen, Gate,
  Schalter im Profil, Bereich in der Navigation.
- **Teil B · Das Tagebuch:** Liste, Faden, Anlegen mit Vorschlag, Seite eines Eintrags, Papierkorb, Hinweis beim ersten
  Öffnen, Zeile an der Scheibe und auf Start.
- **Teil C · Deine Daten:** Export (JSON) und Konto löschen über beide Teile. Beides gibt es in Spiegel noch nicht
  ([[spiegel-privacy]]); Teil C hängt nur an Teil A und lässt sich abspalten (offene Frage 1).

## Ansatz

### Drei Zonen im Code (Grenze)

| Zone         | Ordner                                                             | darf importieren                                                                                                                                                       |
| ------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tagebuch     | `apps/spiegel/src/diary/**`, `apps/spiegel/src/app/(app)/diary/**` | Pakete (`@vereinsheim/*`), aus dem Ergebnisteil nur `@/lib/results-read`, `@/lib/auth-helpers`, `@/lib/action-guards`, `@/lib/db`, `@/lib/types`, `@/lib/page-context` |
| Nahtstellen  | `apps/spiegel/src/parts/**`, dazu `src/instrumentation-node.ts`    | beide Teile                                                                                                                                                            |
| Ergebnisteil | alles übrige unter `apps/spiegel/src`, dazu `packages/shot-*`      | nie `@/diary/**`; nur `@/parts/*` als Stelle                                                                                                                           |

- **Die Stelle:** Der Ergebnisteil ruft `@/parts/*` und bekommt allgemeine Zeilen (`PartLine`: Titel, Zustand, Ziel,
  Wort der Aktion) oder fertige Kästen (Profil, Papierkorb). Er weiß nicht, woher sie kommen. Ist das Tagebuch aus,
  kommt nichts.
- **Schmale Schnittstelle** `src/lib/results-read.ts` (Ergebnisteil, nur lesend): Id, Abend, Familie, Art, Herkunft,
  Ergebnis, Schusszahl, Serien einer Scheibe. Das Tagebuch liest Scheiben nur darüber.
- **Gate** als Test in `pnpm check`: `apps/spiegel/src/parts/boundary.test.ts` liest alle `.ts`/`.tsx` der App und
  prüft die Tabelle (Importe über `@/…` und relative Pfade). Dazu greift keine Datei des Tagebuchs auf ein Modell des
  Ergebnisteils zu (`(db|tx)\.(card|cardRevision|seriesSum|shot|cardProjection|cardEvidence|printout|rawRow|rawSnapshot|rawColumnSet|tombstone|deleteLock|cardRequest|sportpassConsent|discipline|family|familyScoring|ranking|source|site|bridge)\b`),
  und keine Datei des Admins (`src/lib/admin/**`, `src/components/admin/**`, `src/app/(app)/admin/**`) importiert
  `@/parts/**` oder das Tagebuch: Der Admin sieht vom Tagebuch nichts ([[adr-033]]). Gegenprobe mit einer Probe-Datei je
  Verstoß (conventions §8).
- **Datenbank:** eine Datenbank, ein Prisma-Client. Die Tabellen des Tagebuchs haben keinen Fremdschlüssel und kein
  Relationsfeld auf Tabellen des Ergebnisteils: `cardId` und `familyId` sind Werte ohne Relation. So bekommt `Card` kein
  Feld; eine gelöschte Scheibe hinterlässt eine Id, die die Schnittstelle nicht liefert („Scheibe gelöscht“). Nur `User`
  (das gemeinsame Konto) bekommt Relationsfelder, damit Konto löschen kaskadiert.

### Modell

Ein Modell für alle Einträge, neue und übernommene, ohne Archiv und ohne Markierung der Herkunft. Befinden, Prognose,
Feedback und Ausführung je Serie liegen auf 0 bis 100. Die Oberfläche zeigt immer fünf Stufen, abgeleitet aus Bereichen
(0–19 → 1, 20–39 → 2, 40–59 → 3, 60–79 → 4, 80–100 → 5); ein Tipp speichert die Mitte der Stufe (10, 30, 50, 70, 90),
übernommene Werte bleiben genau. Die Texte sind die Felder des Konzepts.

```prisma
// ─── Tagebuch ([[adr-033]]): eigener Teil. Liest Scheiben nur über `src/lib/results-read.ts`; `cardId` und
// `familyId` sind Werte ohne Fremdschlüssel, damit der Ergebnisteil nichts vom Tagebuch trägt

// Art eines Eintrags: mit Scheiben (Training oder Wettkampf kommt von den Scheiben), Trocken- oder Mentaltraining
enum DiaryKind {
  shooting
  dry
  mental
}

// „Hat es geklappt?“
enum DiaryOutcome {
  yes
  partly
  no
}

// zu welchem Abschnitt ein Wert auf der Skala 0 bis 100 gehört
enum DiaryScalePart {
  wellbeing
  prognosis
  feedback
}

// Einstellung des Tagebuchs je Konto; ohne Zeile aus
model DiarySettings {
  userId       String    @id
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  // für neue Konten aus, für Konten mit Einträgen aus Treffsicher an (Stufe 3)
  enabled      Boolean   @default(false)
  // der Hinweis „Nur du siehst dein Tagebuch“ ist gesehen
  noticeSeenAt DateTime? @db.Timestamptz(3)
  createdAt    DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt    DateTime  @updatedAt @db.Timestamptz(3)
}

model DiaryEntry {
  id            String                 @id @default(cuid())
  userId        String
  user          User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  // der Abend wie in Spiegel (Tag der Anzeige-Zone, vor 4 Uhr der Vortag)
  day           DateTime               @db.Date
  kind          DiaryKind              @default(shooting)
  // `Family.id`; Pflicht bei `shooting`, sonst frei
  familyId      Int?
  // Vorhaben, die erste Zeile; Titel in der Liste
  intention     String?
  // Notiz: was passiert ist, mehrzeilig
  note          String?
  // „Hat es geklappt?“, nur mit Vorhaben gefragt
  outcome       DiaryOutcome?
  // „Ich habe gelernt, dass …“ (ohne den Satzanfang gespeichert)
  learned       String?
  // „Wie schaffe ich es, …?“ (ohne den Satzanfang gespeichert); der Faden
  question      String?
  // „Was hat gestört?“
  disturbed     String?
  // Prognose: erwartetes Ergebnis in Ringen
  expectedScore Decimal?               @db.Decimal(5, 1)
  // Schlüssel der Übernahme (`treffsicher:<id>`, Stufe 3): ein zweiter Lauf ersetzt statt zu verdoppeln
  importKey     String?                @unique
  // Papierkorb: 30 Tage, danach endgültig gelöscht; die Scheiben bleiben verbunden
  deletedAt     DateTime?              @db.Timestamptz(3)
  createdAt     DateTime               @default(now()) @db.Timestamptz(3)
  updatedAt     DateTime               @updatedAt @db.Timestamptz(3)
  cards         DiaryEntryCard[]
  scales        DiaryScale[]
  executions    DiarySeriesExecution[]

  // Liste, Vorschläge
  @@index([userId, day])
  // Faden je Disziplin
  @@index([userId, familyId, day])
}

// was der Schütze an einer Scheibe entschieden hat: von Hand verknüpft oder gelöst
enum DiaryCardLink {
  linked
  released
}

// eine Scheibe steckt höchstens in einem Eintrag. Gespeichert wird nur, was der Schütze tut: Anlegen und Dazunehmen
// verknüpfen, Lösen löst. Ohne Zeile gehört eine Scheibe zum einzigen Eintrag ihres Abends und ihrer Disziplin, der
// nicht im Papierkorb liegt; das leitet `entryCards` beim Lesen ab („dazugekommen“), ohne zu schreiben
model DiaryEntryCard {
  cardId    String        @id
  entryId   String
  entry     DiaryEntry    @relation(fields: [entryId], references: [id], onDelete: Cascade)
  link      DiaryCardLink
  createdAt DateTime      @default(now()) @db.Timestamptz(3)
  updatedAt DateTime      @updatedAt @db.Timestamptz(3)

  @@index([entryId])
}

// ein Wert auf 0 bis 100: Befinden (sleep, energy, stress, motivation), Prognose und Feedback (fitness, nutrition,
// technique, tactics, mentalStrength, environment, equipment); ohne Zeile kein Wert
model DiaryScale {
  entryId String
  entry   DiaryEntry     @relation(fields: [entryId], references: [id], onDelete: Cascade)
  part    DiaryScalePart
  aspect  String
  value   Int

  @@id([entryId, part, aspect])
}

// Ausführung je Serie einer Scheibe des Eintrags, 0 bis 100 wie die übrigen Stufen; `series` wie `SeriesSum.series`
model DiarySeriesExecution {
  entryId String
  entry   DiaryEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  cardId  String
  series  Int
  value   Int

  @@id([entryId, cardId, series])
}

model User {
  …
  diarySettings DiarySettings?
  diaryEntries  DiaryEntry[]
}
```

`aspect` ist ein Text, geprüft in `src/diary/scales.ts` (eine Liste je `part`, zod), damit 2c weitere Aspekte ohne
Migration bekommt. Die Werte prüft dieselbe Datei (ganze Zahl 0 bis 100).

Abbildung aus Treffsicher (Stufe 3 setzt sie um, hier nur, damit das Modell nichts verliert):

| Treffsicher                                                                      | Tagebuch                                                                                                         |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `TrainingSession.date`, `type`, `disciplineId`                                   | `day`, `kind` (`TROCKENTRAINING` → `dry`, `MENTAL` → `mental`, sonst `shooting`, Art an der Scheibe), `familyId` |
| `trainingGoal`                                                                   | `intention`                                                                                                      |
| `Prognosis.performanceGoal`                                                      | `intention`, wenn es keine Absicht gibt, sonst Zeile „Leistungsziel: …“ in `note`                                |
| `Wellbeing.*`, `Prognosis.*` (7), `Feedback.*` (7)                               | `DiaryScale`, Wert genau                                                                                         |
| `Prognosis.expectedScore`                                                        | `expectedScore`                                                                                                  |
| `Prognosis.expectedCleanShots`                                                   | Zeile „Erwartete saubere Schüsse: …“ in `note`                                                                   |
| `Feedback.explanation`                                                           | `disturbed`                                                                                                      |
| `Feedback.goalAchieved`                                                          | `outcome` (`yes`/`no`)                                                                                           |
| `Feedback.goalAchievedNote`, `progress`, `wentWell`, `insights`, `fiveBestShots` | Zeilen mit Überschrift in `note`                                                                                 |
| `Reflection.observations`                                                        | `note` (am Anfang)                                                                                               |
| `Reflection.insight`                                                             | `learned`                                                                                                        |
| `Reflection.learningQuestion`                                                    | `question`                                                                                                       |
| `Reflection.routineFollowed`, `routineDeviation`                                 | nicht übernommen; bleibt in der Sicherung der Treffsicher-Datenbank                                              |
| `Series.executionQuality` (1–5)                                                  | `DiarySeriesExecution.value` (10, 30, 50, 70, 90)                                                                |
| `location`, `isFavourite`                                                        | Ort der Scheibe, sonst Zeile in `note`; „Favorit“ als Zeile in `note`                                            |
| `Attachment`, `Goal`, `SessionGoal`, `ShotRoutine`                               | 2b                                                                                                               |
| Ergebnis, Serien, Schüsse, Trefferlage                                           | Ergebnisteil (Stufe 1, Übernahme Stufe 3)                                                                        |

### Migration

`prisma/migrations/20261028180000_diary_entries/migration.sql`, erzeugt mit `prisma migrate diff` (Datenbank gegen
Schema, `--script`), angewandt mit `migrate deploy` (Dev-Datenbank nie zurücksetzen). Erwartet:

```sql
-- CreateEnum
CREATE TYPE "DiaryKind" AS ENUM ('shooting', 'dry', 'mental');
CREATE TYPE "DiaryOutcome" AS ENUM ('yes', 'partly', 'no');
CREATE TYPE "DiaryScalePart" AS ENUM ('wellbeing', 'prognosis', 'feedback');
CREATE TYPE "DiaryCardLink" AS ENUM ('linked', 'released');

-- CreateTable
CREATE TABLE "DiarySettings" (
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "noticeSeenAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "DiarySettings_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "DiaryEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "kind" "DiaryKind" NOT NULL DEFAULT 'shooting',
    "familyId" INTEGER,
    "intention" TEXT,
    "note" TEXT,
    "outcome" "DiaryOutcome",
    "learned" TEXT,
    "question" TEXT,
    "disturbed" TEXT,
    "expectedScore" DECIMAL(5,1),
    "importKey" TEXT,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "DiaryEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiaryEntryCard" (
    "cardId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "link" "DiaryCardLink" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "DiaryEntryCard_pkey" PRIMARY KEY ("cardId")
);

CREATE TABLE "DiaryScale" (
    "entryId" TEXT NOT NULL,
    "part" "DiaryScalePart" NOT NULL,
    "aspect" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    CONSTRAINT "DiaryScale_pkey" PRIMARY KEY ("entryId","part","aspect")
);

CREATE TABLE "DiarySeriesExecution" (
    "entryId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "series" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    CONSTRAINT "DiarySeriesExecution_pkey" PRIMARY KEY ("entryId","cardId","series")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiaryEntry_importKey_key" ON "DiaryEntry"("importKey");
CREATE INDEX "DiaryEntry_userId_day_idx" ON "DiaryEntry"("userId", "day");
CREATE INDEX "DiaryEntry_userId_familyId_day_idx" ON "DiaryEntry"("userId", "familyId", "day");
CREATE INDEX "DiaryEntryCard_entryId_idx" ON "DiaryEntryCard"("entryId");

-- AddForeignKey
ALTER TABLE "DiarySettings" ADD CONSTRAINT "DiarySettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiaryEntryCard" ADD CONSTRAINT "DiaryEntryCard_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "DiaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiaryScale" ADD CONSTRAINT "DiaryScale_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "DiaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiarySeriesExecution" ADD CONSTRAINT "DiarySeriesExecution_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "DiaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Rein additiv: keine bestehende Tabelle ändert sich. Rückweg auf ein älteres Image braucht nichts. Keine Änderung an
Brücke, Vertrag, `compose.yml`, `Caddyfile` oder `scripts/`. Diff und SQL gehen vor dem Commit an die koordinierende
Session (Circuit-Breaker, ADR-023).

### Schmale Schnittstelle des Ergebnisteils (`src/lib/results-read.ts`)

Nur lesend, nur eigene, sichtbare Scheiben (`VISIBLE_CARD` über die vorhandenen Zugriffe):

```ts
export interface ResultCard {
  id: string;
  /** Abend (`eveningDay`, ISO-Tag) */
  day: string;
  startedAtMs: number;
  timeUnknown: boolean;
  family: { id: number; slug: string; name: string } | null;
  targetId: TargetId | null;
  kind: "training" | "competition";
  probeOnly: boolean;
  provenance: CardProvenance;
  /** Ergebnis wie vorn in der Liste (`ListRow.result`, `resultScoring`, Stellen aus `digits`); null ohne Wert */
  result: { value: number; scoring: Scoring; digits: number } | null;
  shots: number;
}
export function resultCards(
  db,
  q: {
    ownerId: string;
    timeZone: string;
    ids?: readonly string[];
    fromMs?: number;
    toMs?: number;
  },
): Promise<ResultCard[]>;
export function resultCardSeries(
  db,
  q: { ownerId: string; cardId: string },
): Promise<
  | {
      series: number;
      shots: number;
      result: { value: number; scoring: Scoring; digits: number } | null;
    }[]
  | null
>;
export function resultMarks(
  db,
  q: { ownerId: string; ids: readonly string[] },
): Promise<Record<string, CardMark[]>>;
export function resultFamilies(
  db,
  ownerId: string,
): Promise<{ id: number; slug: string; name: string }[]>;
```

- `resultCards` nimmt `ownerCards` (mit Zeitraum) und rechnet die Werte je Familie mit `cardListModel`, damit Ergebnis
  und Wertung dieselben sind wie in der Liste. `ids` filtert; fremde, wartende und gelöschte fehlen.
- `resultCardSeries` liest die Seite der Scheibe (`cardWithShots`, immer mit `ownerId`): je Wertungsserie Nummer,
  Schusszahl, Summe (Schüsse nach `Shot.series`, ohne Schüsse die `SeriesSum`); ohne Serien leer, ohne Scheibe null.
- `resultMarks` reicht `marksOfCards` durch (kleine Scheiben in Liste, Eintrag und Vorschlägen).
- `resultFamilies`: Familien mit eingeordneten, nicht ignorierten Disziplinen der Anlage, dazu die der eigenen Scheiben.

### Nahtstellen (`src/parts/`)

- `lines.ts`: `type PartLine = { key: string; title: string; state: string; href: string; action: string }`;
  `cardLines(db, { ownerId, cardId, timeZone })` und `startLines(db, { ownerId, blocks, timeZone })`. Tagebuch aus →
  leer.
- `nav.ts`: `diaryEnabled(db, userId)` für Layout und Leiste.
- `profile.tsx`: `ProfileParts` (Kasten „Tagebuch“, mit Tagebuch der Link „Alle Scheiben“ am Telefon, Kasten „Deine
  Daten“) im Platz `parts` von `ProfileScreen`.
- `trash.tsx`: `TrashParts`, Abschnitt „Einträge im Tagebuch“ im Platz `parts` von `TrashScreen`.
- `jobs.ts`: `diaryJobs(db)`, von `instrumentation-node.ts` beim Start und stündlich gerufen: Papierkorb der Einträge
  nach 30 Tagen leeren.
- `account.ts`, `account-actions.ts`: Export und Konto löschen (Teil C).

### Navigation

- `packages/shot-ui/src/nav/areas.ts`: `Area` bekommt `"diary"`, `areaLinks` liefert `diary: { page: "diary" }`.
- `packages/shot-ui/src/nav/routes.ts`: `Route` bekommt `{ page: "diary" }` (`/diary`); Unterseiten (`/diary/thread`,
  `/diary/new`, `/diary/<id>`) bleiben `unknown`, den Bereich setzt `AppShell` über `isDiaryPath(pathname)`
  (`src/lib/diary-path.ts`, nur der Pfad, wie `admin-path.ts`).
- `packages/shot-ui/src/layout/AppFrame.tsx`: Eintrag `diary` (Tagebuch, `BookOpen`), Prop `diary: boolean`. Mit
  Tagebuch untere Leiste `start, diary, scan, progress, profile`, Seitenleiste `start, cards, diary, progress`;
  `barCurrent` macht aus `cards` am Telefon `profile` (dort steht „Alle Scheiben“). Ohne Tagebuch alles wie heute.
- `AppShell` bekommt `diary`, das Layout liest es über `@/parts/nav`. conventions §4: Tagebuch `BookOpen`.

### Oberfläche

Alle Seiten im Rahmen, eine Spalte `PAGE_SINGLE` (conventions §3), auch am Computer.

**Tagebuch `/diary` und Faden `/diary/thread`:** Kopf „Tagebuch“ mit „Neuer Eintrag“ (`Plus`), darunter der Umschalter
„Einträge · Faden“ (zwei Links mit `aria-current`, wie `ProgressSwitch`). Beim ersten Öffnen über der Liste der
Hinweis.

- Einträge: neueste oben, nach Monat. Karte (ganz der Link): Titel ist das Vorhaben, sonst die Disziplin; darunter Tag,
  Disziplin (wenn das Vorhaben Titel ist) und Scheiben mit Ergebnis; darunter zwei Zeilen der Notiz; rechts bis zu zwei
  kleine Scheiben (`MiniTarget`, ohne Lagen als Platzhalter), bei Trocken- und Mentaltraining das Symbol des
  Tagebuchs.
- Faden: Chip der Disziplin (die mit der jüngsten Frage vorgewählt), dann alle Einträge dieser Disziplin mit Frage als
  Zeitstrahl, neueste oben: „Tag · Eintrag ›“, die Frage („Wie schaffe ich es, …“), darunter „Ich habe gelernt, dass …“.
  Jeder Punkt führt in seinen Eintrag.

**Neuer Eintrag `/diary/new`** (`?card=<id>` markiert den Vorschlag dieser Scheibe; gibt es für ihren Abend und ihre
Disziplin schon einen Eintrag, leitet die Seite dorthin um): Vorschläge je Abend und Disziplin der letzten 30 Tage mit
Scheiben ohne Eintrag, der jüngste mit gefülltem Knopf. Darunter „Ohne Scheibe“: Tag, Art (`Segmented`), Disziplin
(bei „Mit Scheiben“ Pflicht), „Anlegen“.

**Seite eines Eintrags `/diary/[id]`**, von oben:

1. Rückweg „Tagebuch“, `h1` Tag, Metazeile „Disziplin · Art“ (Art der Scheiben: Training, Wettkampf; sonst
   Trockentraining, Mentaltraining).
2. Kasten der Scheiben: je Scheibe kleine Scheibe, Uhrzeit, Ergebnis, Herkunft wenn nicht gemessen, „Lösen“; von selbst
   abgeleitete mit „dazugekommen“; gelöschte als „Scheibe gelöscht“; bei mehreren Einträgen des Abends „Vom selben Abend“
   mit „Dazunehmen“.
3. Vorhaben als eine Zeile (leer: „Was nimmst du dir vor?“).
4. Notiz, immer sichtbar, mehrzeilig.
5. Vorher: die letzte Frage derselben Disziplin aus einem früheren Eintrag („Deine Frage vom 9. Juni“) mit „Als Vorhaben
   nehmen“, solange das Vorhaben leer ist; Abschnitte Befinden und Prognose (mit erwartetem Ergebnis).
6. Nachher: „Hat es geklappt?“ (nur mit Vorhaben), „Ich habe gelernt, dass …“, „Wie schaffe ich es, …?“; Abschnitte „Was
   hat gestört?“, Feedback (Prognose gestrichelt an ihrer Stufe, darunter „Erwartet … · geschossen …“), Ausführung je
   Serie (nur mit Scheiben mit Serien).
7. Kasten „Dieser Eintrag“: Tag, Art und Disziplin (änderbar nur ohne Scheiben), Löschen.

Feste Regel für Abschnitte (Befinden, Prognose, Was hat gestört?, Feedback, Ausführung je Serie): leer eine Zeile mit
„+“, gefüllt offen. Ein Tipp auf „+“ öffnet ihn im Browser; bleibt er leer, ist er nach dem Neuladen wieder eine Zeile.
Ein gefüllter Abschnitt hat unten „Entfernen“ (Rückfrage). Die Seite hängt nicht von der Art des Abends ab und nicht
davon, was jemand bisher genutzt hat.

Bedienung:

- **Stufen** (`StageRow`, fünf weiche Kreise mit 1 bis 5, 32 px wie die Kreise an der Scheibe; das Wort der Stufe unter
  dem Namen, beim Schlaf „schlecht … sehr gut“, sonst „sehr wenig … sehr viel“, bei Prognose, Feedback und Ausführung
  „schlecht … sehr gut“): Ein Tipp speichert sofort die Mitte der Stufe (`setScale`, `setExecution`), ein Tipp auf die
  gezeigte Stufe nimmt den Wert weg. Gezeigt sofort, ein Fehler steht am Abschnitt (wie `useSavedChoice`). Kein Toast.
- **Texte** (Vorhaben, Notiz, die beiden Satzanfänge, „Was hat gestört?“, erwartetes Ergebnis): gesteuerte Felder; ist
  etwas geändert, stehen „Speichern“ und „Verwerfen“ darunter; Toast nach dem Speichern. Verlassen der Seite mit
  Ungespeichertem fragt (`useUnsavedChangesGuard`, `useNavigationConfirm`, `diaryDiscard`).
- **„Hat es geklappt?“** `Segmented` Ja, Teilweise, Nein, speichert beim Tippen.
- **Scheiben vom selben Abend** (entschieden mit dem User am 28. Oktober 2026): abgeleitet beim Lesen, nie beim Laden
  geschrieben. Gibt es an einem Tag genau einen Eintrag einer Disziplin, der nicht im Papierkorb liegt, gehört jede
  Scheibe dieses Abends und dieser Disziplin ohne Zeile in `DiaryEntryCard` dazu und zeigt „dazugekommen“. Eine Zeile
  `linked` hält eine Scheibe fest in ihrem Eintrag (Anlegen aus dem Vorschlag, „Dazunehmen“), eine Zeile `released` hält
  sie aus jedem Eintrag heraus, bis sie von Hand dazugenommen wird. Gibt es an dem Tag mehrere Einträge der Disziplin,
  bietet jeder die Scheiben ohne Zeile unter „Vom selben Abend“ mit „Dazunehmen“ an. Die Regel ist eine reine Funktion
  (`entryCards` in `src/diary/cards.ts`: Einträge, Zeilen und Scheiben des Abends → je Eintrag fest, dazugekommen,
  angeboten); Liste, Eintrag, Vorschläge, Faden und die Stellen rufen sie. Kein Schreibzugriff im Render, das Einlesen
  bleibt frei vom Tagebuch.

**Papierkorb:** Löschen setzt `deletedAt` (Rückfrage, danach „Eintrag gelöscht · Rückgängig“ über `useUndo`). Der
Eintrag behält seine Scheiben. `/profile/trash` zeigt „Einträge im Tagebuch“ mit „Wiederherstellen“ und „Endgültig
löschen“; nach 30 Tagen löscht `diaryJobs` endgültig. Ein Eintrag im Papierkorb steht nirgends: nicht in Liste, Faden,
Start, an der Scheibe, nicht als Frage im nächsten Eintrag.

**Stellen:** In `CardActions` ganz oben die Zeile „Tagebuch“ (`CardScreen.own.lines`), die geteilte Seite zeigt keine.
Auf Start in jedem Block neben „Abend in Scheiben ›“ (`EveningBlock.extra` in shot-ui).

**Skizze am Telefon (390 px), Seite eines Eintrags:**

```
┌──────────────────────────────────────┐
│ ‹ Tagebuch                           │
│ Fr 13.03.                            │
│ Luftpistole · Training               │
│ ┌──────────────────────────────────┐ │
│ │ ◎ 19:55 · 374,3 Ringe · vom Aus… │ │
│ └──────────────────────────────────┘ │
│ ┌ VORHABEN ────────────────────────┐ │
│ │ Ruhe im Kopf                     │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ Griff hat extrem gut gepasst. …  │ │  Notiz
│ └──────────────────────────────────┘ │
│ Vorher                               │
│ ┌ Deine Frage vom 6. März ─────────┐ │
│ │ Wie schaffe ich es, …?           │ │
│ └──────────────────────────────────┘ │
│ ┌ Befinden ────────────────────────┐ │
│ │ Schlaf  mittel   ① ② ③ ④ ⑤      │ │
│ │ …                                │ │
│ └──────────────────────────────────┘ │
│ ┌ Prognose ──────────────────── + ┐  │
│ Nachher                              │
│ ┌ Hat es geklappt? Ja Teilw. Nein ┐  │
│ │ Ich habe gelernt, dass …         │ │
│ │ Wie schaffe ich es, …?           │ │
│ └──────────────────────────────────┘ │
│ ┌ Was hat gestört? ──────────── + ┐  │
│ ┌ Feedback ──────────────────── + ┐  │
│ ┌ Ausführung je Serie ──────────── ┐ │
│ ┌ Dieser Eintrag ──────────────────┐ │
├──────────────────────────────────────┤
│ Start  Tagebuch  (Holen)  Fortschritt  Profil │
└──────────────────────────────────────┘
```

### Deine Daten (Teil C)

- **Export:** `GET /api/account/export` (Route reicht an `parts/account.ts` durch): JSON als Strom (je 200 Scheiben eine
  Abfrage), `attachment; filename="spiegel-<ISO-Tag>.json"`, `private, no-store`, `nosniff`. Inhalt `{ "format":
"spiegel-export", "version": 1, "exportedAt", "account", "results", "diary" }`. `results` aus
  `src/lib/export/results.ts` (Scheiben samt Papierkorb mit aktueller Revision, Summen und Schüssen, Angaben der
  Ausdrucke und Belege ohne Dateien, Zustimmungen, benannte Zeiträume, Wertungen der Familien). `diary` aus
  `src/diary/export.ts` (Einstellung, Einträge mit allen Feldern, Werten und Scheiben-Ids, auch im Papierkorb).
- **Konto löschen:** `deleteOwnAccount(password)`: Sitzung, Passwort (bcrypt), ein Admin-Konto nur, wenn ein anderes
  aktives bleibt (sonst `NoticeDialog`). Eine Transaktion: Kontozeile `FOR UPDATE`, Zustimmungen löschen, alle eigenen
  Scheiben über `purgeCards(tx, ids, { lock: true })`, dann `User` löschen (Kaskade: Tagebuch, Einstellungen, Sperren,
  Zeiträume, Wertungen; Grabsteine behalten ihre Nummer ohne Konto). Danach `sweepUploadsSoon(db)`, im Browser
  `signOut({ redirect: false })` und `/login`.

## Texte (nach conventions §10; erst ins Textbuch „Tagebuch (2a)“, dann in den Code)

Folgen in `src/diary/consequences.ts` (Tagebuch) und `src/lib/admin/consequences.ts` (Konto löschen), übrige Texte in
`src/diary/texts.ts`. Tests halten den Wortlaut und prüfen gegen `OLD_WORDS`.

**Leiste, Profil, Hinweis**

- Leiste und Seitenleiste: „Tagebuch“. Profil am Telefon mit Tagebuch: Link „Alle Scheiben“.
- Kasten „Tagebuch“, aus: „Aus. Im Tagebuch hältst du fest, was du dir vornimmst, wie es lief und was du daraus
  lernst.“, Knopf „Einschalten“. An: „An. In der unteren Leiste steht Tagebuch statt Scheiben. Alle Scheiben findest du
  oben und über Start.“, Knopf „Ausschalten“.
- `diaryOn`: Titel „Tagebuch einschalten?“; worum „Du schaltest das Tagebuch ein.“; passiert: „In der unteren Leiste
  steht dann „Tagebuch“ statt „Scheiben“.“, „Alle Scheiben findest du dann im Profil und über Start. Am Computer stehen
  sie weiter in der Seitenleiste.“, „Nur du siehst dein Tagebuch. Der Admin sieht nichts davon.“; passiert nicht: „An
  deinen Scheiben ändert sich nichts.“; rückgängig „Im Profil wieder ausschalten.“; Knopf „Einschalten“.
- `diaryOff`: Titel „Tagebuch ausschalten?“; worum „Du schaltest das Tagebuch aus.“; passiert: „In der Leiste steht
  wieder „Scheiben“.“, „Auf Start und auf der Seite einer Scheibe steht dann nichts mehr vom Tagebuch.“; passiert nicht:
  „Deine Einträge bleiben gespeichert. Sie sind nur nicht zu sehen.“, „An deinen Scheiben ändert sich nichts.“;
  rückgängig „Im Profil wieder einschalten. Dann sind alle Einträge wieder da.“; Knopf „Ausschalten“.
- Toasts: „Tagebuch eingeschaltet.“, „Tagebuch ausgeschaltet.“
- Hinweis beim ersten Öffnen: Titel „Nur du siehst dein Tagebuch“; „Was du hier schreibst, sieht niemand sonst. Auch der
  Admin nicht, auch keine Zahlen daraus.“, „Teilst du eine Scheibe, bleibt das Tagebuch privat.“, „Ein Eintrag gehört
  zu einem Tag und einer Disziplin. Er kann die Scheiben dieses Abends tragen.“; Knopf „Verstanden“.

**Liste und Faden**

- Titel „Tagebuch“, Aktion „Neuer Eintrag“, Umschalter „Einträge“ · „Faden“.
- Leer: Titel „Noch kein Eintrag“, Text „Ein Eintrag hält fest, was du dir vornimmst, wie es lief und was du daraus
  lernst. Er gehört zu einem Tag und trägt die Scheiben dieses Abends.“, Knopf „Neuer Eintrag“.
- Zeile der Karte: „Fr 13.03. · 1 Scheibe · 374,3 Ringe“, „2 Scheiben“, „Noch keine Scheibe“, „Trockentraining“,
  „Mentaltraining“; ist das Vorhaben Titel, steht die Disziplin nach dem Tag.
- Faden: „Deine Fragen und was du gelernt hast, neueste oben.“; je Punkt „Fr 13.03. · Eintrag ›“, „Wie schaffe ich es,
  …“, „Ich habe gelernt, dass …“. Leer: „Noch keine Frage. Im Eintrag unter Nachher steht „Wie schaffe ich es, …?“.“

**Neuer Eintrag**

- Titel „Neuer Eintrag“, Untertitel „Wähle einen Abend mit Scheiben. Oder trag ein Training ohne Scheibe ein.“
- „Abende mit Scheiben“, Zeile „Fr 13.03. · Luftpistole“, „3 Scheiben · 19:02 bis 20:15“, Knopf „Anlegen“. Leer: „In den
  letzten 30 Tagen gibt es keine Scheibe ohne Eintrag.“
- „Ohne Scheibe“: „Tag“, „Art“ („Mit Scheiben“, „Trockentraining“, „Mentaltraining“), „Disziplin“; unter „Mit Scheiben“:
  „Die Scheiben kommen von selbst dazu, sobald Spiegel sie hat.“; Knopf „Anlegen“.
- Fehler: „Bitte eine Disziplin wählen.“, „Dieser Tag liegt in der Zukunft.“, „Diese Scheiben stecken schon in einem
  Eintrag. Lade die Seite neu.“ Toast „Eintrag angelegt.“

**Seite eines Eintrags**

- Rückweg „Tagebuch“; Metazeile „Luftpistole · Training“, „Luftpistole · Wettkampf“, „Trockentraining“,
  „Mentaltraining · Luftpistole“.
- Scheiben: „19:55 · 374,3 Ringe“, „· vom Ausdruck“, „· eingetragen“, ohne Uhrzeit „Uhrzeit unbekannt“; „dazugekommen“;
  „Scheibe gelöscht“; Knopf „Lösen“; „Vom selben Abend“, Knopf „Dazunehmen“. Ohne Scheibe: „Noch keine Scheibe. Sie
  kommt von selbst dazu, sobald Spiegel eine von diesem Abend hat.“
- Vorhaben: Überschrift „Vorhaben“, leer „Was nimmst du dir vor?“. Toast „Vorhaben gespeichert.“
- Notiz: leer „Notiz: Was ist passiert? Gern in Stichpunkten.“ Toast „Notiz gespeichert.“
- „Vorher“, „Nachher“.
- Faden im Eintrag: „Deine Frage vom 9. Juni“, „Wie schaffe ich es, …“, Knopf „Als Vorhaben nehmen“.
- Befinden: Hinweis „1 wenig · 5 viel, beim Schlaf 1 schlecht · 5 gut“; Zeilen „Schlaf“, „Energie“, „Stress“,
  „Motivation“; unter dem Namen das Wort der Stufe oder „noch offen“.
- Prognose: Hinweis „Wie gut bist du heute? Gut vor einem Wettkampf.“; „Kondition“, „Ernährung“, „Technik“, „Taktik“,
  „Mentale Stärke“, „Umfeld“, „Material“; „Erwartetes Ergebnis“ … „Ringe“.
- „Hat es geklappt?“ Ja · Teilweise · Nein.
- „Ich habe gelernt, dass …“ (leer „… den Satz zu Ende schreiben“), „Wie schaffe ich es, …?“ (leer „… deine Frage für das
  nächste Mal“). Toasts „Gespeichert.“
- „Was hat gestört?“, Hinweis „Stand, Licht, Griff, Nerven …“.
- Feedback: Hinweis „Wie gut warst du wirklich? Gestrichelt deine Prognose.“; ohne Wert mit Prognose „Prognose: gut“;
  darunter „Erwartet 342 Ringe · geschossen 338 Ringe“.
- Ausführung je Serie: Hinweis „Wie gut war die Technik? Unabhängig vom Ergebnis.“; Zeile „Serie 1 · 89 Ringe“.
- Stufen: „sehr wenig“, „wenig“, „mittel“, „viel“, „sehr viel“; „schlecht“, „mäßig“, „mittel“, „gut“, „sehr gut“.
- „Dieser Eintrag“: „Tag, Art und Disziplin“, mit Scheiben „Kommt von den Scheiben.“, sonst Knopf „Ändern“; „Löschen“,
  „Danach liegt der Eintrag 30 Tage im Papierkorb im Profil. Die Scheiben bleiben.“
- Feldfehler: „Bitte ein Ergebnis wie 340 oder 340,5.“, „Höchstens 2.000 Zeichen.“ Allgemein: „Das ließ sich nicht
  speichern. Bitte noch einmal versuchen.“, „Diesen Eintrag gibt es nicht mehr.“

**Folgen** (`src/diary/consequences.ts`)

- `diaryCardRelease({ when, executions })`: Titel „Scheibe lösen?“; worum „Du löst die Scheibe vom {when} aus diesem
  Eintrag.“; passiert: „Die Scheibe steht dann in keinem Eintrag. Von selbst kommt sie nicht wieder dazu.“ und mit
  Bewertungen „Die Ausführung ihrer Serien geht mit.“; passiert nicht: „Die Scheibe bleibt in Spiegel, mit allen
  Schüssen.“, „Die übrigen Angaben im Eintrag bleiben.“; rückgängig „Die Scheibe unter „Vom selben Abend“ wieder
  dazunehmen.“; Knopf „Lösen“; destruktiv nur mit Bewertungen.
- `diarySectionRemove({ name, day })`: Titel „{name} entfernen?“; worum „Du entfernst {name} aus dem Eintrag vom
  {day}.“; passiert: „Die Werte sind dann weg. Der Abschnitt ist wieder eine Zeile mit „+“.“; passiert nicht: „Die
  übrigen Angaben im Eintrag bleiben.“; rückgängig „Neu eintragen.“; Knopf „Entfernen“; destruktiv.
- `diaryEntryDelete({ day, family })`: Titel „Eintrag löschen?“; worum „Du löschst den Eintrag vom {day} ({family}).“;
  passiert: „Er liegt 30 Tage im Papierkorb (im Profil). So lange steht er nirgends, auch nicht auf Start und an den
  Scheiben.“, „Danach löscht Spiegel ihn endgültig, mit Notiz, Befinden, Prognose und Feedback.“; passiert nicht: „Die
  Scheiben bleiben in Spiegel, mit allen Schüssen.“, „Deine anderen Einträge bleiben.“; rückgängig „30 Tage lang im
  Papierkorb wiederherstellen.“; Knopf „Löschen“; destruktiv. Danach „Eintrag gelöscht · Rückgängig“.
- `diaryEntryPurgeNow({ day })`: wie `cardPurgeNow` für einen Eintrag: Titel „Eintrag endgültig löschen?“; worum „Du
  löschst den Eintrag vom {day} endgültig.“; passiert „Spiegel löscht ihn sofort, mit allen Angaben.“; passiert nicht
  „Die Scheiben bleiben in Spiegel.“; rückgängig „Das lässt sich nicht rückgängig machen.“; Knopf „Endgültig löschen“.
- `diaryDiscard()`: Titel „Änderungen verwerfen?“; worum „Im Eintrag ist ein Text geändert und noch nicht gespeichert.“;
  passiert „Die Änderungen sind weg.“; passiert nicht „Was schon gespeichert war, bleibt.“; rückgängig „Den Text neu
  schreiben.“; Knopf „Verwerfen“; destruktiv.

**Papierkorb:** Unterzeile „Gelöschte Scheiben und Einträge liegen hier 30 Tage und zählen nirgends mit. Danach werden
sie endgültig gelöscht.“ (gilt auch ohne Tagebuch, die Scheiben-Zeile bleibt sonst wie heute); Abschnitt „Einträge im
Tagebuch“, je Eintrag Tag, „Luftpistole · 1 Scheibe“, „noch 30 Tage“, „Wiederherstellen“, „Endgültig löschen“.
Leerzustand unverändert.

**Zeilen an den Stellen:** Scheibe, Titel „Tagebuch“: „Im Eintrag vom Fr 13.03.“ · „Eintrag öffnen“, sonst „Noch in
keinem Eintrag.“ · „Eintrag anlegen“. Start: „Tagebuch · Eintrag öffnen ›“ bzw. „Tagebuch · Eintrag anlegen ›“.

**Deine Daten:** Kasten „Deine Daten“; „Herunterladen“, „Alle Scheiben und das Tagebuch in einer Datei (JSON). Ausdrucke
und Belege als PDF oder Foto sind nicht darin.“; „Konto löschen“, „Löscht dein Konto mit allen Scheiben und dem
Tagebuch.“ `accountDelete({ email })`: Titel „Konto löschen?“; worum „Du löschst dein Konto {email}.“; vorher prüfen
„Lade vorher deine Daten herunter, wenn du sie behalten willst.“; passiert: „Spiegel löscht sofort alle deine Scheiben,
mit Schüssen, Ausdrucken und Belegen.“, „Spiegel löscht dein Tagebuch mit allen Einträgen.“, „Deine Sportpassnummer ist
danach mit keinem Konto mehr verbunden. Spiegel holt keine Scheiben mehr von der Anlage.“, „Du wirst abgemeldet. Mit
dieser E-Mail kannst du dich nicht mehr anmelden.“; passiert nicht: „An der Meyton-Anlage ändert sich nichts.“, „Die
Sicherungen auf dem Server behalten die Daten noch bis zu 14 Tage. Danach sind sie auch dort weg.“; rückgängig „Das
lässt sich nicht rückgängig machen. Ein neues Konto legt der Admin an.“; Knopf „Konto endgültig löschen“; Feld „Dein
Passwort“. Fehler „Das Passwort stimmt nicht.“; `NoticeDialog` „Konto löschen geht gerade nicht“, „Dieses Konto ist das
einzige mit der Rolle Admin. Erst ein zweites Admin-Konto anlegen. Dann geht es.“

## Dateien

Neu:

- `apps/spiegel/prisma/migrations/20261028180000_diary_entries/migration.sql`
- `apps/spiegel/src/lib/results-read.ts`, `src/lib/diary-path.ts`, `src/lib/export/results.ts` (+ Tests)
- `apps/spiegel/src/parts/`: `lines.ts`, `nav.ts`, `profile.tsx`, `trash.tsx`, `jobs.ts`, `account.ts`,
  `account-actions.ts`, `boundary.test.ts` (+ Tests)
- `apps/spiegel/src/diary/`: `settings.ts`, `scales.ts` (Aspekte, Stufe ↔ Wert, Wörter), `queries.ts` (Liste, Faden,
  Eintrag, letzte Frage), `proposals.ts` (rein), `cards.ts` (rein: `entryCards`), `trash.ts`, `summaries.ts` (rein: Zeilen
  der Liste), `validation.ts` (zod), `actions.ts` (`"use server"`), `consequences.ts`, `texts.ts`, `export.ts`;
  `components/`: `DiarySwitch`, `DiaryNotice`, `DiaryList`, `ThreadView`, `NewEntryScreen`, `EntryScreen`,
  `EntryCards`, `EntryText` (Feld mit Speichern/Verwerfen), `EntrySection` (Zeile mit „+“ oder offen), `StageRow`,
  `OutcomeChoice`, `ThreadHint`, `EntryActions`, `DiaryTrash`; Tests neben den Dateien
- `apps/spiegel/src/app/(app)/diary/page.tsx`, `thread/page.tsx`, `new/page.tsx`, `[id]/page.tsx`
- `apps/spiegel/src/app/api/account/export/route.ts`
- `apps/spiegel/tools/pruefen-diary.ts`

Geändert:

- `apps/spiegel/prisma/schema.prisma`
- `packages/shot-ui/src/nav/areas.ts`, `nav/routes.ts`, `layout/AppFrame.tsx`, `start/EveningBlock.tsx` (+ Tests),
  `packages/shot-ui/CLAUDE.md`
- `apps/spiegel/src/components/shell/AppShell.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`,
  `src/components/start/StartScreen.tsx`, `src/app/(app)/cards/[id]/page.tsx`, `src/components/card/CardScreen.tsx`,
  `CardActions.tsx`, `src/app/(app)/profile/page.tsx`, `src/components/profile/ProfileScreen.tsx`,
  `src/app/(app)/profile/trash/page.tsx`, `src/components/profile/TrashScreen.tsx`, `src/instrumentation-node.ts`,
  `src/lib/admin/consequences.ts` (+ Tests)
- `apps/spiegel/tools/pruefen.ts`, `apps/spiegel/CLAUDE.md`
- Vault: neue Note `vault/spiegel/spiegel-diary.md` (Treffsicher 2.0, Zahlen, Zonen, Modell, Seiten, Faden, Stellen,
  Gate), dazu `spiegel-navigation.md`, `spiegel-privacy.md` (Export und Löschen gebaut, Tagebuch privat),
  `spiegel-data-model.md`, `spiegel-db-schema.md`, `spiegel-roadmap.md`, `vault/conventions.md` §4, ADR-033 Nachtrag
  „2a“ (Circuit-Breaker), `vault/index.md`.

## Required Docs

- `vault/decisions/adr-033.md` (ganz), `adr-031.md`, `vault/spiegel/spiegel-privacy.md`, `spiegel-navigation.md`,
  `spiegel-data-model.md`
- `vault/conventions.md` §2 (Diese Scheibe, DecisionDialog, EmptyState, Toasts, Datenverlust), §3, §4, §6, §8, §9
  (gesteuerte Formulare, Tests nur eigene Zeilen, Toast über klebender Leiste), §10
- `apps/spiegel/CLAUDE.md`, `packages/shot-ui/CLAUDE.md`, `packages/ui/CLAUDE.md`
- `apps/spiegel/src/lib/db/reads.ts`, `src/lib/db/purge.ts`, `src/lib/trash-actions.ts`, `src/lib/db/trash.ts`,
  `src/components/card/ActionRow.tsx`, `CardActions.tsx`, `src/components/shell/useSavedChoice*`,
  `src/components/entered/EnteredCardForm.tsx`, `tools/pruefen.ts`
- Das Designkonzept (Runde 4) als Vorlage der Oberfläche; Treffsicher nur als Herkunft der Felder
  (`apps/treffsicher/prisma/schema.prisma`).

## Aufgaben

**Teil A · Modell, Grenze, Rahmen**

1. Schema und Migration (Circuit-Breaker): Modell oben, `migrate diff` → SQL, Diff und SQL an die Koordination (Kopie
   im Notizordner `2a-task1-schema.diff`, `2a-task1-migration.sql`), nach OK `migrate deploy` auf Dev und
   `db:generate`. Commit `feat(spiegel): diary tables in the schema`.
2. `src/lib/results-read.ts` mit Tests gegen die Dev-Datenbank (eigene Testanlage): nur eigene, sichtbare Scheiben,
   `ids`, Abend vor 4 Uhr, Ergebnis gleich `cardListModel`, Serien aus Schüssen und aus Summen, fremde Scheibe null.
3. `src/parts/boundary.test.ts` mit Gegenprobe (je Verstoß eine Probe-Datei: Ergebnisteil importiert `@/diary/x`,
   Tagebuch importiert `@/lib/db/cards`, Tagebuch schreibt `db.card.update`, Admin importiert `@/parts/lines`).
4. `src/diary/settings.ts`, `src/diary/scales.ts` und `src/parts/nav.ts` mit Tests: ohne Zeile aus, an, aus, Hinweis
   einmal; Stufe aus Wert an allen Grenzen (0, 19, 20, …, 80, 100), Mitte je Stufe, Aspekte je Teil, Wörter je Zeile.
5. Navigation: `areas.ts`, `routes.ts`, `AppFrame` (`diary`), `diary-path.ts`, `AppShell`, Layout; Markup-Tests beider
   Leisten mit und ohne Tagebuch, `barCurrent` für `cards` und `diary`.
6. Profil: `ProfileParts` (Kasten „Tagebuch“ mit `diaryOn`/`diaryOff`, „Alle Scheiben“ am Telefon nur mit Tagebuch),
   Platz `parts` in `ProfileScreen`, Action `setDiaryEnabledAction`; Wortlaut- und Markup-Tests.

**Teil B · Das Tagebuch**

7. `validation.ts`, `summaries.ts`, `proposals.ts` mit Tests: Texte leer → null, höchstens 2.000 Zeichen, Zeilenumbrüche
   bleiben; erwartetes Ergebnis „340“, „340,5“, „340.5“, „340,55“ Fehler; Zeilen der Liste aus den Texten oben;
   Vorschläge je Abend und Disziplin, ohne Scheiben in Einträgen, neueste zuerst, `card` markiert seine Gruppe.
8. `cards.ts` (rein) mit Tests: genau ein Eintrag → Scheibe ohne Zeile dazugekommen; zwei Einträge desselben Abends und
   derselben Disziplin → die Scheibe nur angeboten, in beiden; `linked` bleibt in ihrem Eintrag, auch bei zwei Einträgen;
   `released` weder dazugekommen noch angeboten außer zum Dazunehmen von Hand; ein Eintrag im Papierkorb zählt nicht mit
   und hält seine `linked`-Scheiben; andere Disziplin oder anderer Abend nie. Dann `queries.ts`, `actions.ts` mit Tests gegen die Dev-Datenbank (nur eigene Zeilen): Anlegen aus Vorschlag
   (fremde Scheibe abgelehnt, eine Scheibe in zwei Einträgen abgelehnt, Prüfung und Schreiben in einer Transaktion),
   ohne Scheibe (Disziplin Pflicht bei `shooting`, Tag nicht in der Zukunft); Lösen schreibt `released` (auch für eine
   dazugekommene) und nimmt die Ausführung der Scheibe mit; Dazunehmen schreibt `linked`; Lesen schreibt nichts (Zählung
   der Zeilen vor und nach dem Laden einer Seite gleich); `setScale` (Mitte gespeichert, gleiche Stufe → weg, genauer Wert bleibt, bis eine andere Stufe
   getippt wird); `setExecution` nur für Serien verbundener Scheiben; Texte speichern; „Als Vorhaben nehmen“; letzte
   Frage derselben Disziplin aus einem früheren, nicht gelöschten Eintrag; Faden je Disziplin, neueste oben; Löschen,
   Wiederherstellen, endgültig; fremder Eintrag „Diesen Eintrag gibt es nicht mehr.“; jede Action prüft
   `diaryEnabled`.
9. Seiten `/diary`, `/diary/thread`, `/diary/new`, `/diary/[id]` mit `DiarySwitch`, `DiaryNotice`, `DiaryList`,
   `ThreadView`, `NewEntryScreen`, `EntryScreen`, `EntryCards`; Tagebuch aus → `/diary*` leitet nach `/profile` um;
   Markup-Tests (Leerzustände, Hinweis nur ohne `noticeSeenAt`, „dazugekommen“, „Scheibe gelöscht“, „Hat es geklappt?“
   nur mit Vorhaben, Ausführung nur mit Serien, Tag/Art/Disziplin gesperrt mit Scheiben).
10. Bedienung im Eintrag: `StageRow` (Kreise, Wort, Tippen, zurücknehmen, Fehler am Abschnitt), `EntrySection` (Zeile
    mit „+“, offen, „Entfernen“ mit `diarySectionRemove`), `EntryText` (gesteuert, Speichern/Verwerfen, Wächter beim
    Verlassen mit `diaryDiscard`), `OutcomeChoice`, `ThreadHint`; Markup-Tests je Baustein.
11. Papierkorb: `src/diary/trash.ts`, `parts/trash.tsx`, `parts/jobs.ts`, Einbau in `TrashScreen` und
    `instrumentation-node.ts`, Rückgängig nach dem Löschen; Tests (30 Tage, Wiederherstellen, endgültig, Eintrag im
    Papierkorb fehlt in Liste, Faden, Stellen und als Frage).
12. Stellen: `parts/lines.ts` mit Tests (aus → keine Zeile; im Eintrag; ohne Eintrag; Start je Block),
    `EveningBlock.extra` (shot-ui, Markup-Test), `StartScreen` `lines`, `CardActions` und `CardScreen.own.lines`
    (Markup-Test: Zeile oben, keine auf der geteilten Seite).

**Teil C · Deine Daten**

13. `src/lib/export/results.ts`, `src/diary/export.ts`, `parts/account.ts`, Route; Tests: nur eigene Daten, Papierkorb
    dabei, alle Felder und Werte des Tagebuchs, gültiges JSON über mehrere Stapel (201 Scheiben), Kopfzeilen, ohne
    Sitzung 401.
14. `deleteOwnAccount` und `accountDelete` mit Tests gegen die Dev-Datenbank (Testkonto mit Testanlage): falsches
    Passwort ändert nichts, einziges Admin-Konto abgelehnt, danach keine Zeile mehr mit dem Konto, Grabstein bleibt ohne
    Konto, fremde Scheibe bleibt; Kasten „Deine Daten“ mit Dialog und Passwortfeld (Markup-Test).

**Abschluss**

15. Skriptprüfung `tools/pruefen-diary.ts`, Abschnitt „Tagebuch“ in `pruefen.ts` (Demo-Konto): einschalten im Profil
    (Dialog) → Leiste mit „Tagebuch“ (Telefon), „Alle Scheiben“ im Profil → Hinweis, „Verstanden“, nach Neuladen weg →
    Neuer Eintrag aus dem ersten Vorschlag → Vorhaben und Notiz schreiben, speichern, Verlassen mit Ungespeichertem
    fragt → Befinden: „+“, vier Tipps, Neuladen zeigt sie, ein Tipp auf dieselbe Stufe nimmt sie weg → Satzanfänge →
    zweiter Eintrag derselben Disziplin zeigt die Frage, „Als Vorhaben nehmen“ → Faden zeigt beide Fragen, neueste oben →
    Zeile „Tagebuch“ an der Scheibe und auf Start → Scheibe lösen → Eintrag löschen, Rückgängig, wieder löschen,
    Papierkorb, endgültig → ausschalten. Kein seitliches Scrollen bei 390 und 360 px. Am Ende Einträge des Demo-Kontos
    gelöscht, Tagebuch aus. Export: Datei laden, JSON parsen, beide Teile. Konto löschen nur der Dialog mit falschem
    Passwort.
16. Vault-Notes, ADR-033-Nachtrag (Circuit-Breaker), `apps/spiegel/CLAUDE.md`, `packages/shot-ui/CLAUDE.md`, Lessons;
    Texte ins Textbuch Spiegel unter „Tagebuch (2a)“; Plan per letztem Commit entfernen.

## Tests und Verifikation

- `pnpm check` im Worktree grün (lint, format, test, tsc, `next build` aller Apps), Vault-Lint grün; `turbo run test
lint --dry=json` zeigt die Änderung in `packages/shot-ui` in den Hashes von Spiegel und Treffsicher.
- Gegenprobe des Gates (Aufgabe 3) und Mutationen: `resultCards` ohne Filter auf `ownerId` → rot; `entryCards` ohne
  Prüfung „genau ein Eintrag“ → rot.
- Browser mit Dev-Server aus dem Worktree auf Port 3022 (`next dev --port 3022`, die erzeugte `AGENTS.md` löschen),
  Demo-Konto: Telefon (390 px) und Desktop, hell und dunkel, die Wege aus Aufgabe 15 von Hand und gegen das
  Designkonzept gehalten. `pnpm --filter spiegel pruefen` gegen :3022 grün.
- Danach in **einem** Befehl: `seed:own --demo`, Prüfung, `seed:own --email <Konto des Users>` (Adresse nur auf der
  Kommandozeile).
- Nicht belegt bleibt voraussichtlich: Konto löschen im Browser mit einem echten Konto (nur Tests gegen ein Testkonto),
  Export eines großen Kontos im Container mit 320 MB.

Keine neue Brücke. Migration ja (additiv, nur neue Tabellen).

## Entscheidungen

Freigegeben vom User am 28. Oktober 2026 (Konzept Runde 4 und dieser Plan):

- Export und Konto löschen in 2a als Teil C. Export nur als JSON, ohne Dateien; ZIP später.
- Einheiten „Training“ oder „Wettkampf“ ganz ohne Ergebnis (Stufe 3): Zeile „Art: Wettkampf“ in der Notiz.
- „Disziplin“ als Wort für die Familie. Gate als Test in `pnpm check`. Einträge löschen mit Papierkorb.
- Faden: neueste Frage oben. Gefüllte Abschnitte sind nicht zuklappbar, nur leerbar („Entfernen“).
- Scheiben vom selben Abend werden beim Lesen abgeleitet, nicht beim Laden geschrieben; gespeichert werden nur
  Verknüpfen von Hand und Lösen (`DiaryEntryCard.link`). Bei zwei Einträgen am selben Tag wird die Scheibe nur angeboten.
