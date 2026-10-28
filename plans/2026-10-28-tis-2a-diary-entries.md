# 2a · Einträge des Tagebuchs

Teilplan von Stufe 2 aus `plans/2026-10-26-treffsicher-in-spiegel.md` (Basisbranch `feat/treffsicher-in-spiegel`),
Kindsession `tis-2a-diary-entries`, Branch `feat/tis-2a-diary-entries` vom Basisbranch (`55349ee3`). Entscheidungen vom 28. Oktober 2026 im Koordinationsplan unter „Stufe 2 · Das Tagebuch“, Regeln in [[adr-033]] („Das Tagebuch und seine
Bezüge“, „Was aus Treffsicher umzieht“, „Datenschutz des Tagebuchs“, „Tagebuch abschaltbar“).

## Kontext

Spiegel hält jede Scheibe (Stufe 1). Das Tagebuch aus Treffsicher zieht als eigener, streng getrennter Teil in Spiegel:
Ein Eintrag gehört einem Konto, einem Tag und einer Familie, trägt null bis viele Scheiben und hält Absicht, Befinden,
Prognose, Feedback, Reflexion und die Ausführung je Serie. 2a baut Modell, Schalter, Bereich, Liste, Seite eines
Eintrags, Anlegen mit Vorschlag, die Stelle auf der Seite einer Scheibe und auf Start, den Hinweis beim ersten Öffnen,
Export und Löschen des Kontos über beide Teile und das Gate. Saisonziele, Schuss-Abläufe und Anhänge folgen in 2b,
Einflüsse und Selbstbild in 2c, die Übernahme aus Treffsicher in Stufe 3. Treffsicher ist Herkunft, nicht Vorlage:
Skalen und Felder sind so, dass die Übernahme nichts verliert, die Oberfläche ist neu.

## Schnitt

Ein Plan, ein Branch, eine Migration, in drei Teilen in dieser Reihenfolge:

- **Teil A · Modell, Grenze, Rahmen:** Schema und Migration, schmale Schnittstelle des Ergebnisteils, Nahtstellen, Gate,
  Schalter im Profil, Bereich in der Navigation.
- **Teil B · Das Tagebuch:** Liste, Anlegen mit Vorschlag, Seite eines Eintrags mit Kästen und Blättern, Hinweis beim
  ersten Öffnen, Zeile auf der Seite einer Scheibe und auf Start.
- **Teil C · Deine Daten:** Export (JSON) und Konto löschen über beide Teile. Beides gibt es in Spiegel noch nicht
  ([[spiegel-privacy]] „Export und Löschen auf Knopfdruck“, noch nicht gebaut); 2a baut es für beide Teile. Teil C hängt
  nur an Teil A und lässt sich als eigener Teil abspalten, falls die Koordination das will (offene Frage 1).

## Ansatz

### Drei Zonen im Code (Grenze)

| Zone         | Ordner                                                             | darf importieren                                                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tagebuch     | `apps/spiegel/src/diary/**`, `apps/spiegel/src/app/(app)/diary/**` | Pakete (`@vereinsheim/*`), aus dem Ergebnisteil nur `@/lib/results-read`, `@/lib/auth-helpers`, `@/lib/action-guards`, `@/lib/db`, `@/lib/types`, `@/lib/page-context`, `@/lib/admin/consequences` (nur `Decision`, `OLD_WORDS`) |
| Nahtstellen  | `apps/spiegel/src/parts/**`                                        | beide Teile                                                                                                                                                                                                                      |
| Ergebnisteil | alles übrige unter `apps/spiegel/src`, dazu `packages/shot-*`      | nie `@/diary/**`; nur `@/parts/*` als Stelle                                                                                                                                                                                     |

- **Die Stelle:** Der Ergebnisteil ruft `@/parts/lines` und bekommt allgemeine Zeilen (`PartLine`, Titel, Zustand, Ziel,
  Wort der Aktion). Er weiß nicht, woher sie kommen. Ist das Tagebuch aus, sind es keine.
- **Schmale Schnittstelle** `src/lib/results-read.ts` (Ergebnisteil, nur lesend): Id, Abend, Familie, Art, Herkunft,
  Ergebnis, Schusszahl und die Serien einer Scheibe. Das Tagebuch liest Scheiben nur darüber.
- **Gate** als Test im Gate (`pnpm check`), `apps/spiegel/src/parts/boundary.test.ts`: liest alle `.ts`/`.tsx` der App
  und prüft die Tabelle oben (Importe über `@/…` und relative Pfade). Dazu: keine Datei des Tagebuchs greift auf ein
  Modell des Ergebnisteils zu (`(db|tx)\.(card|cardRevision|seriesSum|shot|cardProjection|cardEvidence|printout|rawRow|rawSnapshot|rawColumnSet|tombstone|deleteLock|cardRequest|sportpassConsent|discipline|family|familyScoring|ranking|source|site|bridge)\b`),
  keine Datei des Admins (`src/lib/admin/**`, `src/components/admin/**`, `src/app/(app)/admin/**`) importiert
  `@/parts/**` oder das Tagebuch (der Admin sieht vom Tagebuch nichts, [[adr-033]]). Gegenprobe: eine Probe-Datei mit
  je einem Verstoß lässt den Test rot werden (conventions §8), danach entfernt.
- **Datenbank:** eine Datenbank, ein Prisma-Client. Die Tabellen des Tagebuchs haben keinen Fremdschlüssel und kein
  Relationsfeld auf Tabellen des Ergebnisteils: `cardId` und `familyId` sind Werte ohne Relation. So bekommt `Card` kein
  Feld, und eine gelöschte Scheibe hinterlässt im Eintrag eine Id, die die Schnittstelle nicht mehr liefert: „Scheibe
  gelöscht“. Nur `User` (das gemeinsame Konto, kein Teil des Ergebnisteils) bekommt Relationsfelder, damit Konto
  löschen kaskadiert.

### Modell (Schema, additiv, eine Migration)

```prisma
// ─── Tagebuch ([[adr-033]]): eigener Teil. Liest Scheiben nur über `src/lib/results-read.ts`; `cardId` und
// `familyId` sind Werte ohne Fremdschlüssel, damit der Ergebnisteil nichts vom Tagebuch trägt

// Art eines Eintrags: mit Scheiben (Training oder Wettkampf kommt von den Scheiben), Trocken- oder Mentaltraining
enum DiaryKind {
  shooting
  dry
  mental
}

// Einstellung des Tagebuchs je Konto; ohne Zeile aus
model DiarySettings {
  userId       String    @id
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  // für neue Konten aus, für Konten mit Einträgen aus Treffsicher an (Stufe 3)
  enabled      Boolean   @default(false)
  // der Hinweis „Nur du siehst dein Tagebuch“ beim ersten Öffnen ist gesehen
  noticeSeenAt DateTime? @db.Timestamptz(3)
  createdAt    DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt    DateTime  @updatedAt @db.Timestamptz(3)
}

model DiaryEntry {
  id         String                 @id @default(cuid())
  userId     String
  user       User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  // der Abend wie in Spiegel (Tag der Anzeige-Zone, vor 4 Uhr der Vortag)
  day        DateTime               @db.Date
  kind       DiaryKind              @default(shooting)
  // `Family.id`; Pflicht bei `shooting`, sonst frei (Trocken- und Mentaltraining aus Treffsicher haben keine Disziplin)
  familyId   Int?
  // Absicht (Treffsicher `trainingGoal`)
  intention  String?
  // Text im Eintrag: was kein eigenes Feld hat (Ort ohne Scheibe, Favorit aus Treffsicher, Stufe 3)
  note       String?
  // Schlüssel der Übernahme (`treffsicher:<id>`, Stufe 3): ein zweiter Lauf ersetzt statt zu verdoppeln
  importKey  String?                @unique
  createdAt  DateTime               @default(now()) @db.Timestamptz(3)
  updatedAt  DateTime               @updatedAt @db.Timestamptz(3)
  cards      DiaryEntryCard[]
  wellbeing  DiaryWellbeing?
  prognosis  DiaryPrognosis?
  feedback   DiaryFeedback?
  reflection DiaryReflection?
  executions DiarySeriesExecution[]

  @@index([userId, day])
}

// eine Scheibe gehört höchstens zu einem Eintrag
model DiaryEntryCard {
  cardId    String     @id
  entryId   String
  entry     DiaryEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  createdAt DateTime   @default(now()) @db.Timestamptz(3)

  @@index([entryId])
}

// Befinden vor dem Training, je 0 bis 100 wie in Treffsicher
model DiaryWellbeing {
  entryId    String     @id
  entry      DiaryEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  sleep      Int
  energy     Int
  stress     Int
  motivation Int
  createdAt  DateTime   @default(now()) @db.Timestamptz(3)
  updatedAt  DateTime   @updatedAt @db.Timestamptz(3)
}

// Prognose: sieben Bereiche je 0 bis 100 und das erwartete Ergebnis, wie in Treffsicher
model DiaryPrognosis {
  entryId            String     @id
  entry              DiaryEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  fitness            Int
  nutrition          Int
  technique          Int
  tactics            Int
  mentalStrength     Int
  environment        Int
  equipment          Int
  expectedScore      Decimal?   @db.Decimal(5, 1)
  expectedCleanShots Int?
  performanceGoal    String?
  createdAt          DateTime   @default(now()) @db.Timestamptz(3)
  updatedAt          DateTime   @updatedAt @db.Timestamptz(3)
}

// Feedback: dieselben sieben Bereiche nach dem Training, dazu Texte; `goalAchieved` null heißt offen
model DiaryFeedback {
  entryId          String     @id
  entry            DiaryEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  fitness          Int
  nutrition        Int
  technique        Int
  tactics          Int
  mentalStrength   Int
  environment      Int
  equipment        Int
  explanation      String?
  goalAchieved     Boolean?
  goalAchievedNote String?
  progress         String?
  fiveBestShots    String?
  wentWell         String?
  insights         String?
  createdAt        DateTime   @default(now()) @db.Timestamptz(3)
  updatedAt        DateTime   @updatedAt @db.Timestamptz(3)
}

// Reflexion; `routineFollowed` null heißt offen
model DiaryReflection {
  entryId          String     @id
  entry            DiaryEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  observations     String?
  insight          String?
  learningQuestion String?
  routineFollowed  Boolean?
  routineDeviation String?
  createdAt        DateTime   @default(now()) @db.Timestamptz(3)
  updatedAt        DateTime   @updatedAt @db.Timestamptz(3)
}

// Ausführung je Serie einer Scheibe des Eintrags, 1 (schlecht) bis 5 (sehr gut) wie in Treffsicher; `series` ist die
// Nummer der Serie wie `SeriesSum.series` und `Shot.series`
model DiarySeriesExecution {
  id        String     @id @default(cuid())
  entryId   String
  entry     DiaryEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  cardId    String
  series    Int
  quality   Int
  createdAt DateTime   @default(now()) @db.Timestamptz(3)
  updatedAt DateTime   @updatedAt @db.Timestamptz(3)

  @@unique([entryId, cardId, series])
}

model User {
  …
  diarySettings DiarySettings?
  diaryEntries  DiaryEntry[]
}
```

Abbildung aus Treffsicher (für Stufe 3, nichts fällt weg):

| Treffsicher                                        | Tagebuch                                                                                                                                                                |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TrainingSession.date`, `type`, `disciplineId`     | `day` (Abend in der Anzeige-Zone), `kind` (`TROCKENTRAINING` → `dry`, `MENTAL` → `mental`, sonst `shooting` mit Art an der Scheibe), `familyId` (Familie der Disziplin) |
| `trainingGoal`                                     | `intention`                                                                                                                                                             |
| `location`, `isFavourite`                          | Ort der Scheibe, sonst `note`; Favorit als Text in `note`, wenn genutzt                                                                                                 |
| `Wellbeing`                                        | `DiaryWellbeing`, gleiche Felder und Skala                                                                                                                              |
| `Prognosis`                                        | `DiaryPrognosis`, gleiche Felder und Skala, `Decimal(5,1)`                                                                                                              |
| `Feedback`                                         | `DiaryFeedback`, gleiche Felder                                                                                                                                         |
| `Reflection`                                       | `DiaryReflection`, gleiche Felder                                                                                                                                       |
| `Series.executionQuality`                          | `DiarySeriesExecution.quality` je Scheibe und Serie                                                                                                                     |
| `Attachment`, `Goal`, `SessionGoal`, `ShotRoutine` | 2b                                                                                                                                                                      |
| Ergebnis, Serien, Schüsse, Trefferlage             | Ergebnisteil (Stufe 1, Übernahme Stufe 3)                                                                                                                               |

Einzige Lücke: eine Einheit `TRAINING` oder `WETTKAMPF` ganz ohne Ergebnis hat keine Scheibe, die die Art tragen
könnte (offene Frage 3).

### Migration

`prisma/migrations/20261028180000_diary_entries/migration.sql`, erzeugt mit `prisma migrate diff` (Datenbank gegen
Schema, `--script`), angewandt mit `migrate deploy` (Dev-Datenbank nie zurücksetzen, `migrate dev` will dort einen
Reset). Erwartet:

```sql
-- CreateEnum
CREATE TYPE "DiaryKind" AS ENUM ('shooting', 'dry', 'mental');

-- CreateTable
CREATE TABLE "DiarySettings" (
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "noticeSeenAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "DiarySettings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "DiaryEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "kind" "DiaryKind" NOT NULL DEFAULT 'shooting',
    "familyId" INTEGER,
    "intention" TEXT,
    "note" TEXT,
    "importKey" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "DiaryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaryEntryCard" (
    "cardId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiaryEntryCard_pkey" PRIMARY KEY ("cardId")
);

-- CreateTable
CREATE TABLE "DiaryWellbeing" (
    "entryId" TEXT NOT NULL,
    "sleep" INTEGER NOT NULL,
    "energy" INTEGER NOT NULL,
    "stress" INTEGER NOT NULL,
    "motivation" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "DiaryWellbeing_pkey" PRIMARY KEY ("entryId")
);

-- CreateTable
CREATE TABLE "DiaryPrognosis" (
    "entryId" TEXT NOT NULL,
    "fitness" INTEGER NOT NULL,
    "nutrition" INTEGER NOT NULL,
    "technique" INTEGER NOT NULL,
    "tactics" INTEGER NOT NULL,
    "mentalStrength" INTEGER NOT NULL,
    "environment" INTEGER NOT NULL,
    "equipment" INTEGER NOT NULL,
    "expectedScore" DECIMAL(5,1),
    "expectedCleanShots" INTEGER,
    "performanceGoal" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "DiaryPrognosis_pkey" PRIMARY KEY ("entryId")
);

-- CreateTable
CREATE TABLE "DiaryFeedback" (
    "entryId" TEXT NOT NULL,
    "fitness" INTEGER NOT NULL,
    "nutrition" INTEGER NOT NULL,
    "technique" INTEGER NOT NULL,
    "tactics" INTEGER NOT NULL,
    "mentalStrength" INTEGER NOT NULL,
    "environment" INTEGER NOT NULL,
    "equipment" INTEGER NOT NULL,
    "explanation" TEXT,
    "goalAchieved" BOOLEAN,
    "goalAchievedNote" TEXT,
    "progress" TEXT,
    "fiveBestShots" TEXT,
    "wentWell" TEXT,
    "insights" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "DiaryFeedback_pkey" PRIMARY KEY ("entryId")
);

-- CreateTable
CREATE TABLE "DiaryReflection" (
    "entryId" TEXT NOT NULL,
    "observations" TEXT,
    "insight" TEXT,
    "learningQuestion" TEXT,
    "routineFollowed" BOOLEAN,
    "routineDeviation" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "DiaryReflection_pkey" PRIMARY KEY ("entryId")
);

-- CreateTable
CREATE TABLE "DiarySeriesExecution" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "series" INTEGER NOT NULL,
    "quality" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "DiarySeriesExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiaryEntry_importKey_key" ON "DiaryEntry"("importKey");
CREATE INDEX "DiaryEntry_userId_day_idx" ON "DiaryEntry"("userId", "day");
CREATE INDEX "DiaryEntryCard_entryId_idx" ON "DiaryEntryCard"("entryId");
CREATE UNIQUE INDEX "DiarySeriesExecution_entryId_cardId_series_key" ON "DiarySeriesExecution"("entryId", "cardId", "series");

-- AddForeignKey
ALTER TABLE "DiarySettings" ADD CONSTRAINT "DiarySettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiaryEntryCard" ADD CONSTRAINT "DiaryEntryCard_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "DiaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiaryWellbeing" ADD CONSTRAINT "DiaryWellbeing_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "DiaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiaryPrognosis" ADD CONSTRAINT "DiaryPrognosis_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "DiaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiaryFeedback" ADD CONSTRAINT "DiaryFeedback_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "DiaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiaryReflection" ADD CONSTRAINT "DiaryReflection_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "DiaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiarySeriesExecution" ADD CONSTRAINT "DiarySeriesExecution_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "DiaryEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Rein additiv: keine bestehende Tabelle ändert sich. Rückweg auf ein älteres Image braucht nichts, es liest die neuen
Tabellen nicht. Keine Änderung an Brücke, Vertrag, `compose.yml`, `Caddyfile` oder `scripts/`. Diff und SQL gehen vor
dem Commit an die koordinierende Session (Circuit-Breaker, ADR-023).

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
export function resultFamilies(
  db,
  ownerId: string,
): Promise<{ id: number; slug: string; name: string }[]>;
```

- `resultCards` nimmt `ownerCards` (mit Zeitraum) und baut die Werte je Familie mit `cardListModel`, damit Ergebnis und
  Wertung dieselben sind wie in der Liste. Mit `ids` filtert es auf diese; unbekannte, fremde, wartende und gelöschte
  fehlen einfach.
- `resultCardSeries` liest die Seite der Scheibe (`cardWithShots`, immer mit `ownerId`) und gibt je Wertungsserie
  Nummer, Schusszahl und Summe (Schüsse nach `Shot.series`, ohne Schüsse die `SeriesSum`); ohne Serien eine leere Liste,
  ohne Scheibe null.
- `resultFamilies`: Familien mit eingeordneten, nicht ignorierten Disziplinen der Anlage, dazu die der eigenen
  Scheiben, nach Name.

### Nahtstellen (`src/parts/`)

- `parts/lines.ts`: `type PartLine = { key: string; title: string; state: string; href: string; action: string }`;
  `cardLines(db, { ownerId, cardId, timeZone })` und `startLines(db, { ownerId, blocks: { family: string; day: string; cardIds: string[] }[], timeZone })`
  → `Record<string, PartLine>` je `family`. Beide fragen zuerst `diaryEnabled`; aus → leer.
- `parts/nav.ts`: `diaryEnabled(db, userId)` für Layout und Leiste.
- `parts/profile.tsx`: Server-Komponente `ProfileParts`, setzt den Kasten „Tagebuch“ (Client `DiarySwitch` aus
  `src/diary/components/`) in den Platz `parts` von `ProfileScreen`.
- `parts/account.ts`: Export und Konto löschen (Teil C) über beide Teile.

### Navigation (Teil A)

- `packages/shot-ui/src/nav/areas.ts`: `Area` bekommt `"diary"`; `areaLinks` liefert `diary: { page: "diary" }`.
- `packages/shot-ui/src/nav/routes.ts`: `Route` bekommt `{ page: "diary" }` (`/diary`); Unterseiten (`/diary/new`,
  `/diary/<id>`) bleiben `unknown` wie die Unterseiten von Admin, den Bereich setzt `AppShell` über
  `isDiaryPath(pathname)` (`src/lib/diary-path.ts`, Ergebnisteil, nur der Pfad, wie `admin-path.ts`).
- `packages/shot-ui/src/layout/AppFrame.tsx`: Eintrag `diary: { label: "Tagebuch", short: "Tagebuch", Icon: BookOpen }`,
  Prop `diary: boolean`. Mit Tagebuch: untere Leiste `start, diary, scan, progress, profile`, Seitenleiste
  `start, cards, diary, progress`; `barCurrent` macht aus `cards` am Telefon `start` (die Scheiben erreicht man dort
  über Start). Ohne Tagebuch alles wie heute.
- `AppShell` bekommt `diary: boolean`, das Layout liest es über `@/parts/nav`.
- Symbol `BookOpen` wie in Treffsicher (conventions §4 ergänzen: Tagebuch `BookOpen`).

### Oberfläche (Teil B)

Alle Seiten im Rahmen, eine Spalte `PAGE_SINGLE` (conventions §3), `PageHeader` bzw. Rückweg und rohes `h1` wie die
Detailseiten.

**Liste `/diary`** (Server lädt Einträge des Kontos, neueste zuerst, gruppiert nach Monat wie die Scheiben-Liste):
Kopf `PageHeader` „Tagebuch“ mit Aktion „Neuer Eintrag“ (`Plus`). Je Eintrag eine Karte, die ganze Karte ist der Link:
Zeile 1 Tag und Disziplin, Zeile 2 Art bzw. Scheiben mit Ergebnis, Zeile 3 die Absicht (eine Zeile, abgeschnitten),
Zeile 4 was ausgefüllt ist. Über der Liste beim ersten Öffnen der Hinweis.

**Anlegen `/diary/new`** (`?card=<id>` markiert den Vorschlag dieser Scheibe; steckt sie schon in einem Eintrag, leitet
die Seite dorthin um): Vorschläge je Abend und Familie der letzten 30 Tage mit Scheiben ohne Eintrag, neueste zuerst,
je eine Zeile mit „Anlegen“. Darunter „Ohne Scheibe“: Tag, Art, Disziplin, „Anlegen“. Anlegen schreibt den Eintrag mit
allen Scheiben des Vorschlags und öffnet ihn.

**Seite eines Eintrags `/diary/[id]`:** Rückweg „Tagebuch“, `h1` Tag, Metazeile Disziplin und Art. Kasten „Scheiben“
(nur Art „Mit Scheiben“): jede Scheibe mit Uhrzeit und Ergebnis als Link auf ihre Seite, „Lösen“; eine Scheibe, die
die Schnittstelle nicht mehr liefert, als „Scheibe gelöscht“ mit „Lösen“. Darunter „Vom selben Abend“: Scheiben
desselben Abends und derselben Familie ohne Eintrag, je „Dazunehmen“. Dann Überschrift „Vorher“ mit den Kästen
Absicht, Befinden, Prognose; „Nachher“ mit Feedback, Reflexion, Ausführung je Serie (nur mit Scheiben). Jeder Kasten:
Titel, Zusammenfassung oder „Noch nichts eingetragen“, Knopf „Eintragen“ bzw. „Ändern“; der Knopf öffnet ein Blatt
(`Sheet` aus `@vereinsheim/ui/design2/sheet`) mit dem kurzen Formular, gesteuert (`value` + `onChange`, §9), unten
„Speichern“ und „Abbrechen“, bei Änderungen fragt Schließen nach (`diaryDiscard`). Ist der Kasten gefüllt, steht im
Blatt zusätzlich „Entfernen“ (`diarySectionRemove`). Am Ende Kasten „Dieser Eintrag“ mit den Zeilen Tag, Art und
Disziplin (änderbar nur ohne Scheiben), Notiz, Löschen (`ActionRow` wie „Diese Scheibe“).

Skalen: Befinden, Prognose und Feedback mit `Slider` aus `@vereinsheim/ui/slider` (0 bis 100, Schritt 1, Wert als Zahl
daneben, Vorgabe 50 wie in Treffsicher). Ausführung je Serie als `Segmented` „–“, „1“ … „5“ je Serie. Ziel erreicht
und Schuss-Ablauf eingehalten als `Segmented` „Ja“, „Nein“, „Offen“ (drei Zustände wie `Boolean?`).

**Skizze am Telefon (390 px), Seite eines Eintrags:**

```
┌──────────────────────────────────────┐
│ ‹ Tagebuch                           │
│ Di 28.10.2026                        │
│ Luftpistole · Mit Scheiben           │
│ ┌ Scheiben ────────────────────────┐ │
│ │ 19:02  372 Ringe          Lösen  │ │
│ │ 19:48  368 Ringe          Lösen  │ │
│ │ Vom selben Abend                 │ │
│ │ 20:30  95 Ringe       Dazunehmen │ │
│ └──────────────────────────────────┘ │
│ Vorher                               │
│ ┌ Absicht                  Ändern ─┐ │
│ │ Abzug ruhig durchziehen          │ │
│ └──────────────────────────────────┘ │
│ ┌ Befinden              Eintragen ─┐ │
│ │ Noch nichts eingetragen          │ │
│ └──────────────────────────────────┘ │
│ ┌ Prognose              Eintragen ─┐ │
│ └──────────────────────────────────┘ │
│ Nachher                              │
│ ┌ Feedback · Reflexion · Ausführung┐ │
│ │ (drei Kästen wie oben)           │ │
│ └──────────────────────────────────┘ │
│ ┌ Dieser Eintrag ──────────────────┐ │
│ │ Notiz                 Eintragen  │ │
│ │ Löschen                 Löschen  │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ Start  Tagebuch  (Holen)  Fortschritt  Profil │
└──────────────────────────────────────┘

Blatt „Befinden“ (von unten):
┌──────────────────────────────────────┐
│ Befinden                             │
│ Wie geht es dir vor dem Training?    │
│ Schlaf       ───────●──────     70   │
│ Energie      ─────●────────     60   │
│ Stress       ──●───────────     30   │
│ Motivation   ────────●─────     80   │
│ 0 heißt sehr wenig, 100 sehr viel.   │
│ [ Speichern ]          Abbrechen     │
└──────────────────────────────────────┘
```

**Zeile auf der Seite einer Scheibe:** In `CardActions` ganz oben (fachlich, vor „Eintrag“ der eingetragenen Scheibe),
je `PartLine` eine `ActionRow` mit Link als Aktion. `CardScreen.own` bekommt `lines: PartLine[]`; die geteilte Seite
(`own={null}`) zeigt keine.

**Zeile auf Start:** `EveningBlock` (shot-ui) bekommt `extra?: ReactNode`, gezeichnet in der letzten Zeile neben
„Abend in Scheiben ›“ (`flex flex-wrap gap-x-4`). `StartScreen` bekommt `lines: Record<string, PartLine>` und setzt je
Block `${line.title} · ${line.action} ›` als Link. Die Route `/` reicht die Blöcke (`family`, `day`, Ids der Zeilen) an
`startLines`.

### Deine Daten (Teil C)

- **Export:** Route `GET /api/account/export` (`src/app/api/account/export/route.ts`, reicht an `parts/account.ts`
  durch): JSON als Strom (`ReadableStream`, je 200 Scheiben eine Abfrage), Kopfzeilen `attachment;
filename="spiegel-<ISO-Tag>.json"`, `private, no-store`, `nosniff`. Inhalt:
  `{ "format": "spiegel-export", "version": 1, "exportedAt", "account": { name, email, createdAt }, "results": {…}, "diary": {…} }`.
  `results` aus `src/lib/export/results.ts` (Ergebnisteil): Scheiben samt Papierkorb (Beginn, Ende, Uhrzeit bekannt,
  Disziplin mit Name, Familie, Art, gewählte Art und Wertung, Herkunft, Ort, Stand, Merkmale, gelöscht am, aktuelle
  Revision mit Gesamtergebnis, Trefferlage als Summe, Serien-Summen und Schüssen), Angaben der Ausdrucke und Belege
  (ID im Fuß, Druckzeit, Typ, Größe; keine Dateien), Zustimmungen per Sportpass, benannte Zeiträume, Wertungen der
  Familien. `diary` aus `src/diary/export.ts`: Einstellung und alle Einträge mit allen Teilen, Scheiben als Id.
- **Konto löschen:** Action `deleteOwnAccount(password)` in `src/parts/account-actions.ts`: Sitzung, Passwort mit
  bcrypt gegen das eigene Konto, ein Konto mit der Rolle Admin nur, wenn ein anderes aktives Admin-Konto bleibt (sonst
  `NoticeDialog`). In einer Transaktion: Kontozeile `FOR UPDATE`, Zustimmungen per Sportpass löschen (die Brücke bekommt
  danach nichts mehr für diese Nummer), alle eigenen Scheiben über `purgeCards(tx, ids, { lock: true })` (Rohdaten,
  Revisionen, Ausdrucke, Belege, Aufträge zurückgezogen), dann `User` löschen (Kaskade: Tagebuch, Einstellungen,
  Sperren, Zeiträume, Wertungen; Grabsteine behalten ihre Nummer ohne Konto, `SetNull`). Danach `sweepUploadsSoon(db)`,
  im Browser `signOut({ redirect: false })` und `/login`.
- Profil bekommt den Kasten „Deine Daten“ (`ProfileParts`) mit „Herunterladen“ und „Konto löschen“.

## Texte (nach conventions §10, erst ins Textbuch „Tagebuch (2a)“, dann in den Code)

Die Folgen stehen in `src/diary/consequences.ts` (Tagebuch) und `src/lib/admin/consequences.ts` (Konto löschen, Teil
des Rahmens: dort stehen schon die Dialoge zum Konto); die übrigen Texte in `src/diary/texts.ts`. Tests halten den
Wortlaut und prüfen gegen `OLD_WORDS`.

**Leiste und Profil**

- Eintrag der Navigation: „Tagebuch“.
- Kasten „Tagebuch“ im Profil, Zustand aus: „Aus. Im Tagebuch hältst du fest, was du dir vornimmst, wie es dir geht und
  was du gelernt hast.“ Knopf „Einschalten“.
- Zustand an: „An. In der unteren Leiste steht Tagebuch statt Scheiben. Deine Scheiben findest du über Start.“ Knopf
  „Ausschalten“.
- `diaryOn`: Titel „Tagebuch einschalten?“; worum: „Du schaltest das Tagebuch ein.“; passiert: „In der unteren Leiste
  steht dann „Tagebuch“ statt „Scheiben“.“, „Deine Scheiben findest du dann über Start. Am Computer stehen sie weiter
  in der Seitenleiste.“, „Nur du siehst dein Tagebuch. Der Admin sieht nichts davon.“; passiert nicht: „An deinen
  Scheiben ändert sich nichts.“; rückgängig: „Im Profil wieder ausschalten.“; Knopf „Einschalten“.
- `diaryOff`: Titel „Tagebuch ausschalten?“; worum: „Du schaltest das Tagebuch aus.“; passiert: „In der Leiste steht
  wieder „Scheiben“.“, „Auf Start und auf der Seite einer Scheibe steht dann nichts mehr vom Tagebuch.“; passiert nicht:
  „Deine Einträge bleiben gespeichert. Sie sind nur nicht zu sehen.“, „An deinen Scheiben ändert sich nichts.“;
  rückgängig: „Im Profil wieder einschalten. Dann sind alle Einträge wieder da.“; Knopf „Ausschalten“.
- Toasts: „Tagebuch eingeschaltet.“, „Tagebuch ausgeschaltet.“

**Hinweis beim ersten Öffnen** (Kasten über der Liste, bis „Verstanden“):
Titel „Nur du siehst dein Tagebuch“. Text: „Was du hier schreibst, sieht niemand sonst. Auch der Admin nicht, auch keine
Zahlen daraus.“ „Teilst du eine Scheibe, bleibt das Tagebuch privat.“ „Ein Eintrag gehört zu einem Tag und einer
Disziplin. Er kann die Scheiben dieses Abends tragen.“ Knopf „Verstanden“.

**Liste**

- Titel „Tagebuch“, Aktion „Neuer Eintrag“.
- Leerzustand (`EmptyState`): Titel „Noch kein Eintrag“, Text „Ein Eintrag hält fest, was du dir vornimmst, wie es dir
  geht und was du gelernt hast. Er gehört zu einem Tag und kann die Scheiben dieses Abends tragen.“, Knopf „Neuer
  Eintrag“.
- Zeile 2: „1 Scheibe · 372 Ringe“, „2 Scheiben · 372 und 368 Ringe“ (mehr als zwei: „3 Scheiben · bis 375 Ringe“),
  „Noch keine Scheibe“, „Trockentraining“, „Mentaltraining“. Ergebnis in Zehnteln mit Komma, Einheit „Ringe“.
- Zeile 4: „Vorher: Absicht, Befinden · Nachher: noch nichts“, „Vorher: noch nichts · Nachher: Feedback, Reflexion“.

**Neuer Eintrag**

- Titel „Neuer Eintrag“, Untertitel „Wähle einen Abend mit Scheiben. Oder trag ein Training ohne Scheibe ein.“
- Abschnitt „Abende mit Scheiben“, Zeile „Di 28.10.2026 · Luftpistole“, darunter „3 Scheiben · 19:02 bis 20:15“, Knopf
  „Anlegen“. Leer: „In den letzten 30 Tagen gibt es keine Scheibe ohne Eintrag.“
- Abschnitt „Ohne Scheibe“: Felder „Tag“, „Art“ (`Segmented`: „Mit Scheiben“, „Trockentraining“, „Mentaltraining“),
  „Disziplin“ (bei „Mit Scheiben“ Pflicht, sonst „ohne“ wählbar). Satz unter „Mit Scheiben“: „Die Scheiben kommen dazu,
  sobald Spiegel sie hat. Du findest sie dann im Eintrag unter „Vom selben Abend“.“ Knopf „Anlegen“.
- Fehler: „Bitte eine Disziplin wählen.“, „Dieser Tag liegt in der Zukunft.“, „Diese Scheiben stecken schon in einem
  Eintrag. Lade die Seite neu.“
- Toast „Eintrag angelegt.“

**Seite eines Eintrags**

- Rückweg „Tagebuch“. Metazeile: „Luftpistole · Mit Scheiben“, „Trockentraining“, „Mentaltraining · Luftpistole“.
- Kasten „Scheiben“: Zeile „19:02 · 372 Ringe“ (ohne Uhrzeit: „Uhrzeit unbekannt · 372 Ringe“; ohne Wert „–“ mit dem
  Grund aus der Liste), Knopf „Lösen“. Gelöscht: „Scheibe gelöscht“, Knopf „Lösen“. Leer: „Noch keine Scheibe. Sobald
  Spiegel eine Scheibe von diesem Abend hat, steht sie unten zum Dazunehmen.“ Abschnitt „Vom selben Abend“, Knopf
  „Dazunehmen“.
- Überschriften „Vorher“, „Nachher“. Kästen „Absicht“, „Befinden“, „Prognose“, „Feedback“, „Reflexion“, „Ausführung je
  Serie“; leer „Noch nichts eingetragen“; Knöpfe „Eintragen“, „Ändern“.
- Zusammenfassungen: Befinden „Schlaf 70 · Energie 60 · Stress 30 · Motivation 80“; Prognose „Erwartet 372,0 Ringe ·
  Leistungsziel: …“ (ohne Ergebnis „7 Bereiche eingeschätzt“); Feedback „Ziel erreicht“, „Ziel nicht erreicht“ oder „7
  Bereiche eingeschätzt“; Reflexion der Anfang der Beobachtungen, sonst der Erkenntnis; Ausführung „4 von 6 Serien
  bewertet · Ø 3,5“.
- Kasten „Dieser Eintrag“: Zeile „Tag, Art und Disziplin“, Zustand bei Scheiben „Kommt von den Scheiben.“, Knopf
  „Ändern“; Zeile „Notiz“, Zustand der Anfang der Notiz oder „Keine Notiz“; Zeile „Löschen“, Zustand „Der Eintrag geht.
  Die Scheiben bleiben.“, Knopf „Löschen“.

**Blätter**

- „Absicht“: Feld „Was nimmst du dir vor?“, Hinweis „Ein Satz reicht. Etwa: Abzug ruhig durchziehen.“ Toast „Absicht
  gespeichert.“
- „Befinden“: Satz „Wie geht es dir vor dem Training?“, Regler „Schlaf“, „Energie“, „Stress“, „Motivation“, darunter
  „0 heißt sehr wenig, 100 sehr viel.“ Toast „Befinden gespeichert.“
- „Prognose“: Satz „Wie gut bist du heute in diesen Bereichen?“, Regler „Kondition“, „Ernährung“, „Technik“, „Taktik“,
  „Mentale Stärke“, „Umfeld“, „Material“, darunter „0 heißt schlecht, 100 sehr gut.“; Felder „Erwartetes Ergebnis in
  Ringen“, „Erwartete saubere Schüsse“, „Leistungsziel“. Toast „Prognose gespeichert.“
- „Feedback“: Satz „Wie gut warst du heute wirklich?“, dieselben sieben Regler; Felder „Was erklärt den Unterschied zur
  Prognose?“, „Leistungsziel erreicht“ (Ja, Nein, Offen), „Anmerkung zum Ziel“, „Fortschritte durch dieses Training“,
  „Was lief besonders gut?“, „Die fünf besten Schüsse“, „Aha-Erlebnisse“. Toast „Feedback gespeichert.“
- „Reflexion“: Felder „Beobachtungen“, „Heute ist mir klar geworden, dass …“, „Was kann ich tun, um …?“,
  „Schuss-Ablauf eingehalten“ (Ja, Nein, Offen), bei Nein „Was war anders?“. Toast „Reflexion gespeichert.“
- „Ausführung je Serie“: Satz „Wie gut hast du die Technik in jeder Serie ausgeführt? Unabhängig vom Ergebnis.“, je
  Scheibe die Überschrift „19:02 · 372 Ringe“, je Serie „Serie 1 · 93 Ringe“ und „–“, „1“ … „5“, Legende „1 schlecht ·
  2 mäßig · 3 mittel · 4 gut · 5 sehr gut“. Scheibe ohne Serien: „Diese Scheibe hat keine Serien.“ Toast „Ausführung
  gespeichert.“
- „Tag, Art und Disziplin“: dieselben Felder wie „Ohne Scheibe“. Toast „Eintrag gespeichert.“
- „Notiz“: Feld „Notiz“, Hinweis „Was sonst zum Training gehört, etwa der Ort.“ Toast „Notiz gespeichert.“
- Feldfehler: „Bitte eine Zahl von 0 bis 100.“, „Bitte ein Ergebnis wie 372 oder 372,5.“, „Bitte eine ganze Zahl ab 0.“,
  „Höchstens 2.000 Zeichen.“ Allgemein: „Das ließ sich nicht speichern. Bitte noch einmal versuchen.“, „Diesen Eintrag
  gibt es nicht mehr.“

**Folgen im Tagebuch** (`src/diary/consequences.ts`)

- `diaryCardRelease({ when, executions })`: Titel „Scheibe lösen?“; worum: „Du löst die Scheibe vom {when} aus diesem
  Eintrag.“; passiert: „Die Scheibe steht dann in keinem Eintrag. Beim nächsten neuen Eintrag schlägt das Tagebuch sie
  wieder vor.“ und mit Bewertungen „Die Ausführung ihrer Serien geht mit. Das sind {n} Bewertungen.“ (1: „eine
  Bewertung“); passiert nicht: „Die Scheibe bleibt in Spiegel, mit allen Schüssen.“, „Die übrigen Angaben im Eintrag
  bleiben.“; rückgängig: „Die Scheibe unter „Vom selben Abend“ wieder dazunehmen.“ (mit Bewertungen dazu „Die
  Ausführung dann neu eintragen.“); Knopf „Lösen“; destruktiv nur mit Bewertungen.
- `diarySectionRemove({ name, day })`: Titel „{name} entfernen?“; worum: „Du entfernst {name} aus dem Eintrag vom
  {day}.“; passiert: „Die Angaben sind dann weg. Der Kasten zeigt wieder „Noch nichts eingetragen“.“; passiert nicht:
  „Die übrigen Angaben im Eintrag bleiben.“; rückgängig: „Neu eintragen.“; Knopf „Entfernen“; destruktiv.
- `diaryEntryDelete({ day, family })`: Titel „Eintrag löschen?“; worum: „Du löschst den Eintrag vom {day}
  ({family}).“; passiert: „Absicht, Befinden, Prognose, Feedback, Reflexion und die Ausführung je Serie sind dann
  weg.“, „Spiegel löscht den Eintrag sofort. Es gibt keinen Papierkorb für Einträge.“; passiert nicht: „Die Scheiben
  bleiben in Spiegel, mit allen Schüssen.“, „Deine anderen Einträge bleiben.“; rückgängig: „Das lässt sich nicht
  rückgängig machen.“; Knopf „Löschen“; destruktiv. Toast „Eintrag gelöscht.“
- `diaryDiscard({ name })`: Titel „Änderungen verwerfen?“; worum: „Im Blatt „{name}“ ist etwas geändert und noch nicht
  gespeichert.“; passiert: „Das Blatt schließt. Die Änderungen sind weg.“; passiert nicht: „Was schon gespeichert war,
  bleibt.“; rückgängig: „Das Blatt noch einmal öffnen und neu eintragen.“; Knopf „Verwerfen“; destruktiv.

**Zeilen an den Stellen**

- Seite einer Scheibe, Titel „Tagebuch“: im Eintrag „Im Eintrag vom Di 28.10.2026.“, Aktion „Eintrag öffnen“; sonst
  „Noch in keinem Eintrag.“, Aktion „Eintrag anlegen“.
- Start, je Block: „Tagebuch · Eintrag öffnen ›“ bzw. „Tagebuch · Eintrag anlegen ›“ (die Scheiben des Blocks in
  verschiedenen Einträgen: der Eintrag der neuesten).

**Deine Daten** (Profil)

- Kasten „Deine Daten“. Zeile „Herunterladen“, Zustand „Alle Scheiben und das Tagebuch in einer Datei (JSON).
  Ausdrucke und Belege als PDF oder Foto sind nicht darin.“, Knopf „Herunterladen“.
- Zeile „Konto löschen“, Zustand „Löscht dein Konto mit allen Scheiben und dem Tagebuch.“, Knopf „Konto löschen“.
- `accountDelete({ email })` in `src/lib/admin/consequences.ts`: Titel „Konto löschen?“; worum: „Du löschst dein Konto
  {email}.“; vorher prüfen: „Lade vorher deine Daten herunter, wenn du sie behalten willst.“; passiert: „Spiegel löscht
  sofort alle deine Scheiben, mit Schüssen, Ausdrucken und Belegen.“, „Spiegel löscht dein Tagebuch mit allen
  Einträgen.“, „Deine Sportpassnummer ist danach mit keinem Konto mehr verbunden. Spiegel holt keine Scheiben mehr von
  der Anlage.“, „Du wirst abgemeldet. Mit dieser E-Mail kannst du dich nicht mehr anmelden.“; passiert nicht: „An der
  Meyton-Anlage ändert sich nichts.“, „Die Sicherungen auf dem Server behalten die Daten noch bis zu 14 Tage. Danach
  sind sie auch dort weg.“; rückgängig: „Das lässt sich nicht rückgängig machen. Ein neues Konto legt der Admin an.“;
  Knopf „Konto endgültig löschen“; destruktiv. Feld im Dialog „Dein Passwort“, Knopf gesperrt, solange es leer ist.
- Fehler: „Das Passwort stimmt nicht.“ `NoticeDialog` letztes Admin-Konto: Titel „Konto löschen geht gerade nicht“,
  Text „Dieses Konto ist das einzige mit der Rolle Admin. Erst ein zweites Admin-Konto anlegen. Dann geht es.“

## Dateien

Neu:

- `apps/spiegel/prisma/migrations/20261028180000_diary_entries/migration.sql`
- `apps/spiegel/src/lib/results-read.ts` (+ Test), `src/lib/diary-path.ts` (+ Test), `src/lib/export/results.ts` (+ Test)
- `apps/spiegel/src/parts/lines.ts`, `nav.ts`, `profile.tsx`, `account.ts`, `account-actions.ts`, `boundary.test.ts`
  (+ Tests je Datei)
- `apps/spiegel/src/diary/`: `settings.ts`, `queries.ts`, `proposals.ts` (rein: Vorschläge je Abend und Familie),
  `summaries.ts` (rein: Zusammenfassungen der Kästen und Zeilen der Liste), `validation.ts` (zod), `actions.ts`
  (`"use server"`, nur direkt deklarierte async-Funktionen), `consequences.ts`, `texts.ts`, `export.ts`, dazu
  `components/` (`DiarySwitch`, `DiaryNotice`, `DiaryList`, `NewEntryScreen`, `EntryScreen`, `EntryCards`, `SectionBox`,
  `SectionSheet`, je ein Formular `IntentionForm`, `WellbeingForm`, `PrognosisForm`, `FeedbackForm`,
  `ReflectionForm`, `ExecutionForm`, `BasicsForm`, `NoteForm`, `ScaleRows`, `TriState`); Tests neben den Dateien
- `apps/spiegel/src/app/(app)/diary/page.tsx`, `new/page.tsx`, `[id]/page.tsx`
- `apps/spiegel/src/app/api/account/export/route.ts`
- `apps/spiegel/tools/pruefen-diary.ts` (Abschnitt der Skriptprüfung)

Geändert:

- `apps/spiegel/prisma/schema.prisma` (Modell oben)
- `packages/shot-ui/src/nav/areas.ts`, `nav/routes.ts`, `layout/AppFrame.tsx`, `start/EveningBlock.tsx` (+ Tests),
  `packages/shot-ui/CLAUDE.md`
- `apps/spiegel/src/components/shell/AppShell.tsx`, `src/app/(app)/layout.tsx`, `src/app/(app)/page.tsx`,
  `src/components/start/StartScreen.tsx`, `src/app/(app)/cards/[id]/page.tsx`, `src/components/card/CardScreen.tsx`,
  `src/components/card/CardActions.tsx`, `src/app/(app)/profile/page.tsx`, `src/components/profile/ProfileScreen.tsx`,
  `src/lib/admin/consequences.ts` (+ Tests)
- `apps/spiegel/tools/pruefen.ts` (Abschnitt „Tagebuch“), `apps/spiegel/CLAUDE.md`
- Vault: neue Note `vault/spiegel/spiegel-diary.md` (Tagebuch: Zonen, Modell, Seiten, Stellen, Gate), dazu
  `spiegel-navigation.md` (Bereich Tagebuch, Leiste), `spiegel-privacy.md` (Export und Löschen gebaut, Tagebuch privat),
  `spiegel-data-model.md` und `spiegel-db-schema.md` (Tabellen), `spiegel-roadmap.md`, `vault/conventions.md` §4
  (Tagebuch `BookOpen`), ADR-033 Nachtrag „2a“ (Circuit-Breaker: Diff an die Koordination), `vault/index.md`.

## Required Docs

- `vault/decisions/adr-033.md` (ganz), `adr-031.md`, `vault/spiegel/spiegel-privacy.md`, `spiegel-navigation.md`,
  `spiegel-data-model.md`
- `vault/conventions.md` §2 (Diese Scheibe, DecisionDialog, EmptyState, Toasts, Datenverlust), §3 (Raster), §4, §6,
  §8 (Gate), §9 (gesteuerte Formulare, Tests nur eigene Zeilen, Toast über klebender Leiste), §10 (Texte)
- `apps/spiegel/CLAUDE.md`, `packages/shot-ui/CLAUDE.md`, `packages/ui/CLAUDE.md`
- `apps/spiegel/src/lib/db/reads.ts` (`ownerCards`, `cardWithShots`, `VISIBLE_CARD`), `src/lib/db/purge.ts`,
  `src/lib/trash-actions.ts` (Muster der Actions), `src/components/card/ActionRow.tsx`, `CardActions.tsx`,
  `src/components/entered/EnteredCardForm.tsx` (Formular, Verwerfen), `tools/pruefen.ts`
- Treffsicher als Herkunft der Felder: `apps/treffsicher/prisma/schema.prisma`,
  `apps/treffsicher/src/components/app/sessions/*Form.tsx`

## Aufgaben

**Teil A · Modell, Grenze, Rahmen**

1. Schema und Migration (Circuit-Breaker): Modell oben, `migrate diff` → SQL, Diff und SQL an die Koordination (Kopie
   in den Notizordner `2a-task1-schema.diff`, `2a-task1-migration.sql`), nach OK `migrate deploy` auf Dev und
   `db:generate`. Commit `feat(spiegel): diary tables in the schema`.
2. `src/lib/results-read.ts` mit Tests gegen die Dev-Datenbank (eigene Testanlage wie `entered.test.ts`): nur eigene
   und sichtbare Scheiben, `ids` filtert, fremde/wartende/gelöschte fehlen, `day` vor 4 Uhr der Vortag, Ergebnis gleich
   `cardListModel`, `resultCardSeries` aus Schüssen und aus Serien-Summen, ohne Serien leer, fremde Scheibe null.
3. `src/parts/boundary.test.ts` mit Gegenprobe (Probe-Datei mit je einem Verstoß: Ergebnisteil importiert
   `@/diary/x`, Tagebuch importiert `@/lib/db/cards`, Tagebuch schreibt `db.card.update`, Admin importiert
   `@/parts/lines`; jeder einzeln rot, danach Datei weg).
4. `src/diary/settings.ts` (`diarySettings`, `setDiaryEnabled`, `markNoticeSeen`) und `src/parts/nav.ts` mit Tests
   (ohne Zeile aus, an und aus, Hinweis einmal).
5. Navigation: `areas.ts`, `routes.ts` (`/diary` hin und zurück, Unterseiten `unknown`), `AppFrame` (`diary`),
   `diary-path.ts`, `AppShell`, Layout; Markup-Tests für beide Leisten mit und ohne Tagebuch, `barCurrent` für
   `cards` und `diary`.
6. Kasten „Tagebuch“ im Profil: `DiarySwitch` mit `diaryOn`/`diaryOff`, Action `setDiaryEnabledAction` (Sitzung,
   `revalidatePath("/", "layout")`, Toast), `ProfileParts`, Platz `parts` in `ProfileScreen`; Wortlaut-Tests
   (`consequences.test.ts` des Tagebuchs, `OLD_WORDS`), Markup-Test.

**Teil B · Das Tagebuch**

7. `src/diary/validation.ts` und `summaries.ts` mit Tests: Skalen 0 bis 100 (Grenzen, keine Kommazahl), Ergebnis
   „372“, „372,5“, „372.5“ (→ `Decimal`), „372,55“ Fehler, saubere Schüsse ganz ab 0, Texte höchstens 2.000 Zeichen,
   leer → null, drei Zustände Ja/Nein/Offen → true/false/null, Qualität 1 bis 5 oder leer; jede Zusammenfassung und
   jede Zeile der Liste aus den Texten oben.
8. `src/diary/proposals.ts` (rein) mit Tests: Gruppen je Abend und Familie aus `ResultCard`, ohne Scheiben in
   Einträgen, neueste zuerst, Scheiben ohne Familie fehlen, `card` markiert seine Gruppe.
9. `src/diary/queries.ts` und `actions.ts` mit Tests gegen die Dev-Datenbank (nur eigene Zeilen): Anlegen aus
   Vorschlag (Scheiben anderer Konten abgelehnt, eine Scheibe in zwei Einträgen abgelehnt über den Schlüssel, Prüfung
   und Schreiben in einer Transaktion), ohne Scheibe (Familie Pflicht bei `shooting`, Tag nicht in der Zukunft),
   Dazunehmen nur gleicher Abend und gleiche Familie, Lösen nimmt die Ausführung dieser Scheibe mit, jeder Kasten
   speichern und entfernen, Ausführung nur für Serien der verbundenen Scheiben, Tag/Art/Disziplin nur ohne Scheiben,
   Notiz, Löschen; fremder Eintrag „Diesen Eintrag gibt es nicht mehr.“; jede Action prüft `diaryEnabled`.
10. Seiten `/diary`, `/diary/new`, `/diary/[id]` mit `DiaryNotice`, `DiaryList`, `NewEntryScreen`, `EntryScreen`,
    `EntryCards`; Markup-Tests (Leerzustand, Hinweis nur ohne `noticeSeenAt`, „Scheibe gelöscht“, „Vom selben Abend“,
    Kasten „Ausführung je Serie“ nur mit Scheiben, Tag/Art/Disziplin gesperrt mit Scheiben). Tagebuch aus → `/diary*`
    leitet nach `/profile` um.
11. Blätter und Formulare (`SectionSheet`, die acht Formulare, `ScaleRows`, `TriState`), gesteuert, Verwerfen mit
    `diaryDiscard`, Entfernen mit `diarySectionRemove`, Toasts; Markup-Tests je Formular (Felder, Vorbelegung aus dem
    Gespeicherten, „Was war anders?“ nur bei Nein).
12. Stellen: `parts/lines.ts` mit Tests (aus → keine Zeile; Scheibe im Eintrag; ohne Eintrag; Start: Block mit
    Scheiben in zwei Einträgen nimmt den der neuesten), `EveningBlock.extra` (shot-ui, Markup-Test), `StartScreen`
    `lines`, `CardActions` und `CardScreen.own.lines` (Markup-Test: Zeile oben im Kasten, keine auf der geteilten Seite).

**Teil C · Deine Daten**

13. `src/lib/export/results.ts`, `src/diary/export.ts`, `parts/account.ts`, Route; Tests: nur eigene Daten (eine
    Scheibe und ein Eintrag eines anderen Testkontos fehlen), Scheiben im Papierkorb dabei, alle Teile des Tagebuchs,
    gültiges JSON über mehrere Stapel (201 Scheiben), Kopfzeilen, ohne Sitzung 401.
14. `deleteOwnAccount` und `accountDelete` mit Tests gegen die Dev-Datenbank (Testkonto mit Testanlage): falsches
    Passwort ändert nichts, einziges Admin-Konto abgelehnt, danach keine Zeile mehr mit dem Konto (Scheiben, Revisionen,
    Rohdaten der Scheiben, Zustimmungen, Aufträge, Tagebuch), Grabstein bleibt ohne Konto, Scheibe eines anderen
    Kontos bleibt; Kasten „Deine Daten“ mit Dialog und Passwortfeld (Markup-Test).

**Abschluss**

15. Skriptprüfung `tools/pruefen-diary.ts`, eingehängt in `pruefen.ts` als Abschnitt „Tagebuch“ (Demo-Konto, `--port`
    über `BASE`): einschalten im Profil (Dialog) → Leiste zeigt „Tagebuch“ statt „Scheiben“ (Telefon), Seitenleiste
    beide (Desktop) → Hinweis, „Verstanden“, nach Neuladen weg → Neuer Eintrag aus dem ersten Vorschlag → Seite des
    Eintrags: jeder Kasten öffnet sein Blatt, speichern, Zusammenfassung steht, Schließen mit Änderung fragt → Scheibe
    lösen und wieder dazunehmen → Zeile „Tagebuch“ auf der Seite einer Scheibe des Eintrags führt zum Eintrag, auf Start
    ebenso → Eintrag löschen → ausschalten, Leiste wie vorher. Kein seitliches Scrollen bei 390 und 360 px auf den drei
    Seiten. Am Ende Einträge des Demo-Kontos gelöscht, Tagebuch aus. Export: Datei laden, JSON parsen, beide Teile da.
    Konto löschen nicht in der Skriptprüfung (würde das Demo-Konto löschen), nur der Dialog mit falschem Passwort.
16. Vault-Notes, ADR-033-Nachtrag (Circuit-Breaker), `apps/spiegel/CLAUDE.md`, `packages/shot-ui/CLAUDE.md`, Lessons;
    Texte ins Textbuch Spiegel unter „Tagebuch (2a)“; Plan per letztem Commit entfernen.

## Tests und Verifikation

- `pnpm check` im Worktree grün (lint, format, test, tsc, `next build` aller Apps), Vault-Lint grün; `turbo run test
lint --dry=json` zeigt die Änderung in `packages/shot-ui` in den Hashes von Spiegel und Treffsicher (beide nutzen
  shot-ui).
- Gegenprobe des Gates (Aufgabe 3) und eine Mutation: `resultCards` ohne Filter auf `ownerId` → Test rot.
- Browser mit Dev-Server aus dem Worktree auf Port 3022 (`next dev --port 3022`, die erzeugte `AGENTS.md` löschen),
  Demo-Konto (`seed:own --demo`): Telefon (390 px) und Desktop, hell und dunkel; alle Wege aus Aufgabe 15 von Hand,
  Treffsicher-Felder gegen die Formulare gehalten. `pnpm --filter spiegel pruefen --start` (eigener Build, Port 3012)
  bzw. gegen :3022 grün.
- Danach in **einem** Befehl: `seed:own --demo`, Prüfung, `seed:own --email <Konto des Users>` (Adresse nur auf der
  Kommandozeile).
- Nicht belegt bleibt voraussichtlich: Konto löschen im Browser mit einem echten Konto (nur Tests gegen ein Testkonto),
  Export eines Kontos mit 1.500 Scheiben im Container mit 320 MB (gemessen nur lokal, nicht im Container).

Keine neue Brücke. Migration ja (additiv, nur neue Tabellen).

## Offene Fragen an die Koordination

1. **Export und Konto löschen gibt es in Spiegel noch nicht.** 2a baut beide neu, für beide Teile (Teil C). Empfehlung:
   in 2a lassen, als letzter Teil; Alternative: eigener Teil 2a-2.
2. **Export nur als JSON, ohne Dateien.** Ausdrucke und Belege (PDF, Fotos) stehen nur mit ihren Angaben darin, CSV
   gibt es nicht ([[spiegel-privacy]] nennt JSON und CSV). Empfehlung: so lassen, ZIP mit Dateien später.
3. **Einheiten „Training“ oder „Wettkampf“ ganz ohne Ergebnis** (Treffsicher) werden Einträge „Mit Scheiben“ ohne
   Scheibe; Training oder Wettkampf hängt in Spiegel an der Scheibe. Empfehlung: Stufe 3 schreibt die Art dann in die
   Notiz. Alternative: ein Feld `plannedKind` am Eintrag (widerspricht „Art entfällt am Eintrag“).
4. **„Disziplin“ als Wort für die Familie** in der Oberfläche des Tagebuchs, wie die Überschrift der Blöcke auf Start.
5. **Gate als Test in `pnpm check`** statt in `consistency-check.sh`: läuft vor jedem Commit, nicht erst beim Release.
6. **Einträge löschen ohne Papierkorb** (sofort, Rückfrage sagt es). Ein Papierkorb wie bei Scheiben wäre mehr Bau.
