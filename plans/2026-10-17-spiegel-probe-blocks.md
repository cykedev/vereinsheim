# Plan: Spiegel — jeder Probe-Block wird eine eigene Scheibe

> PIV-Handoff-Artefakt. Branch `feat/spiegel-probe-bloecke`. **Schema-Änderung mit Migration (T1) und ADR-Änderung
> (T2): geschützte Pfade, interaktiv** in der Hauptsession, danach autonom ab T3. Kein Deploy-Vertrag, **kein Update der
> Brücke**. Ein Commit je Task.

## Context (warum)

Beobachtung des Users am 16. Oktober 2026 (Brücke läuft im Schützenhaus): ca. 9 Probeschüsse, kurz gewartet,
„weggedrückt“ (Neustart der Probe, SF-72), dann 40 Probeschüsse. In Spiegel steht nur der zweite Block. Nachgezählt in
Produktion (nur Zählungen): Scheibe `1227451432`, 40 Schüsse in Spiegel, **51 verschiedene Schüsse in den Rohdaten**.
Der alte Block ist live angekommen und liegt in den Zeilenversionen. Die Scheibe hat ihn ersetzt, weil
`shotChange` (`apps/spiegel/src/lib/db/cards.ts`) eine verschwundene Probe als `update` derselben Revision behandelt.
So steht es in [[adr-027]] (Entscheidung vom 9. Oktober 2026, „Probe wie am Ausdruck“) und [[adr-031]] (SF-03, SF-67).

**Neue Vorgabe des Users (17. Oktober 2026):** Aus Sicht des Trainings soll alles erhalten bleiben, auch die Probe vor
der Wertung. Nach jedem Neustart der Probe beginnt in Spiegel eine neue Scheibe. Beim Übergang zur Wertung darf
ebenfalls eine neue beginnen. Das öffnet ADR-027 („nur der letzte Block“, „keine Probe neben Wertung“) wieder; mit dem
User benannt und von ihm gewollt. Die offene Frage „Soll ein Neustart der Probe eine eigene Scheibe ergeben?“ in
[[spiegel-open-questions]] ist damit beantwortet.

Datenlage der Fälle (`packages/ssmdb2-cases/cases/v1`): Blöcke über die gesendeten Lesungen haben nur SF-02 (60 Probe →
Wertung), SF-03 (5 Probe → Wertung) und SF-72 (8 Probe → Neustart → 5 Probe). SF-21 (Korrektur) und SF-71 (Riss)
bleiben je eine Scheibe.

## Annahmen (bitte vor der Freigabe prüfen)

- **A1 Ein Block = eine Scheibe, auch die Probe vor der Wertung.** Eine Scheibe ist damit immer reine Probe oder
  Wertung, wie bisher; die Wertungs-Scheibe bleibt wie am Ausdruck. Die Oberfläche braucht keinen Reiter „Probe“, S1–S4
  bleiben entfernt (ein Vergleich Probe → Wertung über zwei Scheiben ist ein späteres Feature).
- **A2 Grenze eines Blocks:** Die bisherige Scheibe ist **reine Probe** und der neue Stand teilt **keinen Schuss**
  (Fingerabdruck aus Zeit und Lage, `shotFingerprint`) mit ihr und ist nicht leer. Das trifft Neustart (SF-72) und
  Übergang zur Wertung (SF-03). Eine Scheibe mit Wertung teilt sich nie; Korrekturen bleiben Revisionen (SF-21).
- **A3 Löschen:** „Nicht meine“ entfernt wie heute alle Wartenden der Sportpassnummer, also alle Blöcke (Grabstein je
  ScheibenID). Der Papierkorb arbeitet je Scheibe: Das endgültige Löschen eines Blocks entfernt nur dessen Rohdaten; die
  weiche Sperre entsteht erst, wenn die letzte Scheibe dieser ScheibenID geht.
- **A4 Rückwirkend:** Ein Lauf beim Start und stündlich liest jede ScheibenID neu, deren Stände noch nicht mit dem neuen
  Adapter gelesen sind und die seit 30 Minuten ruht. Neue Blöcke erben Besitzer, Warten auf die erste Bestätigung und
  Papierkorb der vorhandenen Scheibe.
- **A5 Brücke und Vertrag bleiben unverändert.** Die Lücke bleibt: Was nicht live ankam (QR später, Brücke oder Internet
  weg), hat Meyton schon gelöscht. Ein Speicher auf der Brücke ist ein eigener Schritt ([[spiegel-open-questions]]).

## Approach

**Kennung je Block.** `Card` bekommt `block Int @default(0)`; eindeutig ist `(sourceId, scheibenId, cycle, block)`.
Grabsteine und Sperren bleiben je ScheibenID und Zyklus (die Brücke kennt nur ScheibenID und Beginn, `GET /state`).
`RawSnapshot` bekommt `block Int?`: in welchen Block ein Stand gedeutet wurde (für das Löschen eines Blocks).

**Eine reine Funktion für die Grenze.** `startsNewBlock(current, next)` und `blockEnds(previous, states)` in
`apps/spiegel/src/lib/ingest/probe-blocks.ts`. `blockEnds` bekommt die Schüsse der jüngsten Block-Scheibe (oder null)
und die gedeuteten Stände in Folge und liefert je Block den Index seines letzten Stands und ob er ein neuer Block ist.
Live und rückwirkend nutzen dieselbe Funktion.

**Live: jeder gespeicherte Stand des Stapels wird gedeutet.** Heute deutet `ingestBatch` je Scheibe nur den neuesten
Stand eines Stapels. Kommen der letzte Stand des alten Blocks und der erste des neuen im selben Stapel, wäre der alte
verloren. Künftig sammelt `toAdapt` je Scheibe alle zu deutenden Stände in Folge. Der Adapter ist rein und billig;
geschrieben wird nur der letzte Stand jedes Blocks (`writeRevision`), die übrigen bekommen nur `adapterVersion` und
`block`. Die Brücke ist zustandslos und holt nach einem Ausfall nur den aktuellen Stand nach, es gibt keine langen
Rückstände.

**Rückwirkend: neu lesen nach Adapter-Version.** `ADAPTER_VERSION` wird `meyton-ssmdb2@10`. `rereadOutdatedKeys`
(`apps/spiegel/src/lib/ingest/reread.ts`) sucht ScheibenIDs mit einer Scheibe und mindestens einem Stand ohne Quarantäne,
dessen `adapterVersion` nicht `@10` ist, und deren jüngster Stand vor mehr als 30 Minuten zuletzt beobachtet wurde. Je
Kennung: alle Stände laden (`loadSnapshot`), deuten, je Zyklus (Beginn nahe einer vorhandenen Scheibe, `SAME_CARD_MS`)
`blockEnds(null, …)`. Blöcke werden vorhandenen Scheiben über gemeinsame Fingerabdrücke zugeordnet und durchnummeriert
(erst negative Zwischennummern, dann 0…k, damit der Index nicht kollidiert). Fehlende Blöcke werden mit Besitzer,
`ownerPending` und `deletedAt` der vorhandenen Scheibe angelegt. Danach alle Stände der Kennung auf `@10` mit ihrem
Block. Ein zweiter Lauf ändert nichts (Schreiben mit älterer Folgenummer ist `stale`, Zuordnung über Fingerabdruck).

**Löschen eines Blocks.** `purgeCards` prüft nach dem Löschen der Scheibe, ob Geschwister im selben Zyklus bleiben. Ja:
kein `DeleteLock`, gelöscht werden nur die Stände mit `block` = Block der Scheibe (im Fenster von `ownSnapshots`), dann
die Rohzeilen ohne Verweis wie heute; Stände ohne `block` bleiben (der Lauf ordnet sie zu). Nein: wie heute. Der
Grabstein („Nicht meine“) entsteht wie heute bei jedem Aufruf (`upsert` je Zyklus).

**Was gleich bleibt.** Adapter-Logik je Snapshot (`adaptSnapshot`), Revisionen für Korrekturen, Projektion,
Übersichten, Zustände (`bridges.ts` stellt alte Blöcke ohne Lebenszeichen nach fünf Minuten auf ruhend), Brücke,
Vertrag, `GET /state`.

## Required Docs

- [`apps/spiegel/CLAUDE.md`](../apps/spiegel/CLAUDE.md) (Schichten, Migrationen nur anhängen, Tests gegen die
  Dev-Datenbank)
- [`packages/ssmdb2-cases/CLAUDE.md`](../packages/ssmdb2-cases/CLAUDE.md) (Erwartung von Hand, `cases` nach Änderung)
- [`vault/conventions.md`](../vault/conventions.md) §8, §9 (Mocks filtern, Charakterisierung, Mutation, Prüfen und
  Löschen in einer Transaktion)
- [`vault/decisions/adr-027.md`](../vault/decisions/adr-027.md), [`vault/decisions/adr-031.md`](../vault/decisions/adr-031.md)
- [`vault/spiegel/spiegel-edge-cases.md`](../vault/spiegel/spiegel-edge-cases.md) (SF-03, SF-21, SF-67, SF-71, SF-72, SF-77)
- [`vault/spiegel/spiegel-db-schema.md`](../vault/spiegel/spiegel-db-schema.md),
  [`vault/spiegel/spiegel-ingest-pipeline.md`](../vault/spiegel/spiegel-ingest-pipeline.md)

## Tasks

### T1 — Schema: Block an Scheibe und Stand *(geschützt, interaktiv)*

- `apps/spiegel/prisma/schema.prisma`: in `Card` `block Int @default(0)` mit Kommentar („Block der ScheibenID: jeder
  Neustart der Probe und der Übergang zur Wertung beginnt einen neuen, SF-03, SF-72“), `@@unique([sourceId, scheibenId,
  cycle])` → `@@unique([sourceId, scheibenId, cycle, block])`. In `RawSnapshot` `block Int?` („in welchen Block der
  Stand gedeutet wurde; null: noch nicht“).
- Migration `apps/spiegel/prisma/migrations/20261017130000_card_block/migration.sql` per `prisma migrate diff`
  (Dev-DB will sonst einen Reset), angewendet mit `prisma migrate deploy`:
  ```sql
  ALTER TABLE "Card" ADD COLUMN "block" INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE "RawSnapshot" ADD COLUMN "block" INTEGER;
  DROP INDEX "Card_sourceId_scheibenId_cycle_key";
  CREATE UNIQUE INDEX "Card_sourceId_scheibenId_cycle_block_key" ON "Card"("sourceId", "scheibenId", "cycle", "block");
  ```
- `apps/spiegel/src/lib/db/cards.ts`: `CardInput.block?: number` (Standard 0, Doku wie `cycle`); `findCard` über
  `sourceId_scheibenId_cycle_block`; `EXISTING_SELECT` und `identityUpdate` mit `block`; Anlegen setzt `block`.
  `apps/spiegel/tools/measure.ts:189` auf den neuen Schlüssel.
- Test in `cards.test.ts`: zwei Scheiben mit gleicher Quelle, ScheibenID, Zyklus und Block 0/1 sind zwei Scheiben;
  dieselbe mit Block 1 noch einmal geschrieben ist dieselbe.
- Gate: `pnpm check`.

### T2 — ADR-027 und ADR-031 *(geschützt, interaktiv)*

- `vault/decisions/adr-027.md`: Abschnitt „## Änderung (17. Oktober 2026, Entscheidung des Users zur Probe)“ nach dem
  vom 9. Oktober: Anlass (Beobachtung vom 16. Oktober, 51 zu 40), Vorgabe („aus Sicht des Trainings alles behalten“),
  Regel A1/A2, rückwirkend aus den Rohdaten, Brücke unverändert, Lücke (A5). **Ersetzt** in der Änderung vom 9. Oktober
  (Entscheidung zur Probe) „Spiegel sammelt keine Probe … unterscheidet keine Probe-Blöcke“ und die beiden Punkte
  „Training mit Wertung“ und „Reines Probe-Training“. TL;DR um einen Satz ergänzen („Seit dem 17. Oktober 2026 wird
  jeder Probe-Block eine eigene Scheibe“), Keywords `probe-block, neustart der probe, eigene scheibe`.
- `vault/decisions/adr-031.md`: Punkt „Revisionen sind Korrekturen der Wertung“: Die Probe, die Meyton löscht, beendet
  einen Block, der nächste Stand beginnt eine neue Scheibe (Verweis auf die Änderung in ADR-027); TL;DR entsprechend.
- Prüfen: `node .claude/vault-lint.mjs` grün.

### T3 — Erwartung der Fälle: Blöcke

- `packages/ssmdb2-cases/src/expected.ts`: in `ExpectedCard` optional
  `blocks?: readonly { stellung: 0 | 1; numbers: readonly number[] }[]` mit Doku („die Scheiben in Spiegel, je Block
  eine: Neustart der Probe und Übergang zur Wertung beginnen einen neuen; fehlt: eine Scheibe wie `counted`“).
- Von Hand in `packages/ssmdb2-cases/src/cases/probe.ts` (`SF_02`, `SF_03`, `SF_72`): SF-02 `[{0, numbers(1, 60)}, {1, numbers(1, 40)}]`,
  SF-03 `[{0, numbers(1, 5)}, {1, numbers(1, 20)}]`, SF-72 `[{0, numbers(1, 8)}, {0, numbers(1, 5)}]`; die Notiz „Wie am
  Ausdruck nur der letzte Block“ in SF-72 ersetzen durch „Jeder Block ist eine eigene Scheibe in Spiegel“.
- Test im Paket (dort, wo `counted` gegen die erzeugten Daten geprüft wird): der letzte Block gleicht `counted`.
- `pnpm --filter @vereinsheim/ssmdb2-cases cases`, Diff auf `cases/v1/SF-02|03|72/expected.json` beschränkt.

### T4 — Grenze eines Blocks als reine Funktion

- `apps/spiegel/src/lib/ingest/probe-blocks.ts`:
  ```ts
  /** beginnt `next` einen neuen Block nach `current` (SF-03, SF-72; [[adr-027]], Änderung vom 17. Oktober 2026)? */
  export function startsNewBlock(current: readonly ShotInput[], next: readonly ShotInput[]): boolean
  // current nicht leer, alle stellung === 0; next nicht leer; kein shotFingerprint(next) in current
  export interface BlockEnd { index: number; newBlock: boolean }
  /** je Block der Index seines letzten Stands; `newBlock`: neu gegenüber `previous` bzw. dem Block davor */
  export function blockEnds(previous: readonly ShotInput[] | null, states: readonly (readonly ShotInput[])[]): BlockEnd[]
  ```
- `probe-blocks.test.ts` (TDD): Neustart (8 Probe → 5 andere Probe) neu; Übergang (5 Probe → 1 Wertung) neu; Riss
  (Teilmenge derselben Schüsse) nicht neu; leerer nächster Stand nicht neu; Scheibe mit Wertung, Schuss korrigiert
  (Lage geändert, SF-21) nicht neu; gleiche Nummern, anderer Fingerabdruck neu; `blockEnds` über SF-72-artige Folge
  `[A8, A8, B5]` → `[{1,false},{2,true}]`, mit `previous = A8` und `[B5]` → `[{0,true}]`, mit `previous = null` und
  einem Stand → `[{0,false}]`. Gegenprobe per Mutation: Bedingung „reine Probe“ testweise auf `true` → der
  Korrektur-Test wird rot (Backup per `cp`, nicht `git checkout`).

### T5 — Gespeicherten Stand als Snapshot laden und aktuelle Schüsse lesen

- `apps/spiegel/src/lib/db/raw.ts`: `loadSnapshot(db, snapshotId): Promise<SnapshotV1>` aus `RawSnapshot` (`sequence`
  als Zahl, `observedAt` ISO, `sourceVersion`, `sessionTimeZone`, `contractVersion`, `checksum`), `Source.epoch`,
  `source: "meyton-ssmdb2"` und `loadSnapshotData`. Test in `raw.test.ts`: gespeichert und geladen gleich dem
  Original (`toEqual`), Prüfsumme bestätigt (`computeChecksum`).
- `apps/spiegel/src/lib/db/cards.ts`: `currentShotsOf(db, cardId): Promise<ShotInput[]>` (Schüsse der aktuellen
  Revision über `shotFromRow`, leer ohne Revision). Test in `cards.test.ts`.
- `setSnapshotsRead(db, ids: bigint[], block: number)` in `raw.ts`: setzt `adapterVersion = ADAPTER_VERSION` (als
  Parameter übergeben, `raw.ts` kennt den Adapter nicht) und `block`.

### T6 — Einlesen umbauen, ohne Verhalten zu ändern

- `apps/spiegel/src/lib/ingest/ingest.ts`: `adaptAndWrite` teilen in `adaptStored(db, target, sourceId, snapshot,
  stored, latest)` (Disziplin, Kontext, `adaptSnapshot`) und `writeAdapted(db, target, sourceId, owner, adapted,
  { cycle, block, snapshotId, sequence })` (Besitzerprüfung, Disziplin, Rangliste, `writeRevision`). `cardsOfKey` wählt
  `block` mit und sortiert `cycle desc, block desc`. Noch immer nur der neueste Stand je Scheibe, Block 0.
- Alle bestehenden Tests grün, keine Teständerung. Gate.

### T7 — Live: Blöcke erkennen

- `ingest.ts`: `toAdapt` wird `Map<string, Item[]>` (alle zu deutenden Stände der Scheibe in Folge der Folgenummer,
  auch die nachzuholenden ungedeuteten). Je Scheibe: Zyklus wie heute aus der Scheibe mit nahem Beginn; `latest` = die
  Scheibe mit dem höchsten Block dieses Zyklus; alle Stände deuten (Quarantäne je Stand wie heute); `blockEnds(latest ?
  await currentShotsOf(db, latest.id) : null, states)`; je Block den letzten Stand mit `writeAdapted` schreiben, Block =
  `latest.block` (bzw. 0) für den ersten, wenn er nicht neu ist, sonst fortlaufend +1. `setSnapshotsRead` für alle Stände
  mit ihrem Block. `previousClockOffsetMs` von `latest`. `touchLifesign` auf die Scheibe mit dem höchsten Block des
  jüngsten Zyklus.
- `meyton-ssmdb2.ts`: `ADAPTER_VERSION = "meyton-ssmdb2@10"`, Kopfkommentar entsprechend.
- `cards.ts`: Doku von `RevisionChange`/`ShotChange`/`shotChange`: Die Probe kommt und geht nur noch innerhalb eines
  Blocks; ihr Ende beginnt eine neue Scheibe (das Einlesen entscheidet vorher über `startsNewBlock`).
- Tests in `ingest.test.ts`:
  - über alle eingefrorenen Fälle mit Zustimmung: Lesung für Lesung eingelesen ergibt je ScheibenID
    `blocks?.length ?? 1` Scheiben, nach `block` geordnet, mit den Stellungen und Nummern aus `blocks` bzw. `counted`;
  - SF-72 mit Lesung 1 und 3 in **einem** Stapel: zwei Scheiben (der alte Block ging nicht verloren);
  - derselbe Stapel zweimal: keine dritte Scheibe;
  - SF-21: eine Scheibe, Merkmal `korrigiert`;
  - ein reines Lebenszeichen nach SF-72 trifft die Scheibe mit Block 1;
  - `adapterVersion` aller Stände `meyton-ssmdb2@10`, `block` gesetzt (bisher Zeile 106: `@9`).
- Gegenprobe: `startsNewBlock` testweise `false` → der Fall-Test wird für SF-02/03/72 rot.

### T8 — Rückwirkend neu lesen

- `apps/spiegel/src/lib/ingest/reread.ts`: `rereadOutdatedKeys(db, { nowMs }): Promise<{ keys: number; created: number }>`
  wie im Approach. Ziel der Anlage aus `Source → Site` (`siteId`, `timeZone`); Besitzer aus der vorhandenen Scheibe des
  Zyklus (`ownerId`, `ownerPending`), neue Blöcke mit deren `deletedAt`. Kennungen mit Grabstein im Fenster
  (`isKeyBlocked`) und ohne Scheibe überspringen, ohne sie zu markieren. Höchstens 200 Kennungen je Lauf, älteste zuerst.
- `apps/spiegel/src/instrumentation-node.ts`: `rereadKeys()` beim Start und stündlich wie `refreshDisciplines`, ins Log
  nur Zahlen („{n} Scheiben aus den Rohdaten neu gelesen, {m} Blöcke dazu“) und den Namen eines Fehlers.
- `reread.test.ts`: Zustand wie mit `@9` herstellen (SF-72-Stände 1 und 3 mit `storeSnapshot`, Scheibe nur aus Stand 3
  mit `writeRevision`, Stand 3 `@9`, Stand 1 ohne Version) → Lauf → zwei Scheiben, die vorhandene behält ihre `id` und
  wird Block 1, alle Stände `@10` mit Block; zweiter Lauf: nichts neu. Dasselbe mit Scheibe im Papierkorb → neuer Block
  auch im Papierkorb, gleiches `deletedAt`. Mit `ownerPending` → neuer Block wartet auch. Jüngster Stand vor 10 Minuten →
  übersprungen. SF-03 (Probe vor Wertung) → Probe-Scheibe Block 0, Wertung Block 1. Kennung mit Grabstein → nichts.

### T9 — Einen Block endgültig löschen

- `apps/spiegel/src/lib/db/purge.ts`: `block` mitlesen; nach dem Löschen `remaining = tx.card.count({ where: { sourceId,
  scheibenId, cycle } })`. Grabstein wie heute. `remaining > 0`: keine Sperre, `ownSnapshots` nur mit `block` = Block der
  Scheibe; `remaining === 0`: Sperre (bei `lock`) und alle `ownSnapshots` wie heute. Rohzeilen ohne Verweis wie heute.
  Kommentar von `purgeCards` um die Regel ergänzen.
- `purge.test.ts`: zwei Blöcke, Block 0 mit `lock` löschen → seine Stände weg, Block 1 samt Ständen und Schüssen da,
  keine `DeleteLock`; dann Block 1 → Sperre, keine Stände und Rohzeilen der Kennung mehr. „Nicht meine“ über beide →
  ein Grabstein, nichts mehr da. Stand ohne `block` bleibt, solange ein Geschwister bleibt.

### T10 — Doku im Vault und in den Kommentaren

- `vault/spiegel/spiegel-edge-cases.md`: SF-03 und SF-72: Absicherung „eigene Scheibe je Block“ statt „wie am Ausdruck,
  nur der letzte Block“; Leitregel 3 entsprechend; offene Frage in SF-72 („ob jeder Block eine eigene Scheibe wird“)
  entfernen.
- `vault/spiegel/spiegel-ingest-pipeline.md`: Abschnitt Normalisierung `@10`; „Probe wie am Ausdruck“ ersetzen durch die
  Regel; „jeder gespeicherte Stand eines Stapels wird gedeutet, geschrieben nur der letzte je Block“; neu lesen nach
  Adapter-Version (`rereadOutdatedKeys`).
- `vault/spiegel/spiegel-bridge.md` (Punkt *Probe*), `vault/meyton/meyton-ssmdb2.md` (Zeile zur gelöschten Probe, Spalte
  Folge), `vault/spiegel/spiegel-data-model.md` (Revisionen, Kennung mit Block), `vault/spiegel/spiegel-db-schema.md`
  (`Card.block`, `RawSnapshot.block`, `shotChange`, Löschen eines Blocks, Lauf beim Start),
  `vault/spiegel/spiegel-ui-design.md` (Punkt „Wie am Ausdruck“: eine Scheibe je Block, die Wertungs-Scheibe wie am
  Ausdruck), `vault/spiegel/spiegel-statistics.md` (S1–S4: Begründung „die Probe ist eine eigene Scheibe“),
  `vault/spiegel/spiegel-architecture.md` und `vault/architecture/architecture.md` (`@10`).
- `vault/spiegel/spiegel-open-questions.md`: Frage „eigene Scheibe nach Neustart“ als beantwortet (17. Oktober 2026,
  [[adr-027]]) entfernen; „Hält die Brücke doch einen eigenen Speicher?“ um den Satz ergänzen, dass nur noch die Lücke
  ohne Live-Upload offen ist.
- `apps/spiegel/CLAUDE.md`: Regel „Revisionen sind Korrekturen der Wertung“ (Ende der Probe beginnt eine neue Scheibe,
  `Card.block`), „Ingest-API“ („Adapter je Scheibe nur für den neuesten Stand“ → jeder gespeicherte Stand, geschrieben
  der letzte je Block), „Löschen mit Papierkorb“ (Löschen eines Blocks), Lauf `rereadOutdatedKeys` beim Start.
- `/sync-graph`; `vault-lint` grün.

## Verification

1. `pnpm check` grün (Gate je Task).
2. `pnpm --filter spiegel test -- probe-blocks ingest reread purge raw cards` grün; Gegenproben aus T4 und T7 belegt.
3. `pnpm --filter @vereinsheim/ssmdb2-cases cases` ändert nur SF-02, SF-03, SF-72.
4. `pnpm --filter spiegel bridge-e2e` grün (echte Brücke gegen den eigenen Build): Brücke unverändert, SF-72 ergibt zwei
   Scheiben.
5. Rückwirkend an echten Daten (nur wenn der User vorher `dev-restore` laufen lässt): Dev-Server starten, Log „… neu
   gelesen“, dann gegen die Dev-DB je Scheibe vom 16. Oktober die Summe der Schüsse aller Blöcke gleich `je_gesehen`
   (Abfrage aus der Session, über `"scheibenId"` gruppiert). Sonst im Bericht „nicht belegt“ mit Verweis auf
   `reread.test.ts`.
6. Sichtprüfung in Chrome (`pnpm --filter spiegel pruefen` bzw. Browser): Abend mit zwei Probe-Blöcken zeigt zwei
   Scheiben in der Liste, beide öffnen; mit `seed:own --demo`, danach `seed:own` im selben Befehl.

## Nicht im Umfang

- Speicher auf der Brücke (schließt die Lücke ohne Live-Upload, braucht eine neue Brücke auf dem Pi).
- Vergleich Probe → Wertung über zwei Scheiben (S1–S4 neu), Verknüpfung der Blöcke in der Oberfläche.
- Eine gemischte Lesung (Probe und erster Wertungsschuss zugleich) ist nicht beobachtet (Probe und Wertung wechseln in
  derselben Lesung, [[src-ssmdb2-abend-2026-10-09]]); sie bliebe ein Block wie heute.
