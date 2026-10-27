---
id: spiegel-db-schema
type: subsystem
title: "Spiegel — Datenbank: Schema, Zugriffe, Messung"
aliases: [spiegel-datenbank, physisches-schema, spiegel-prisma]
keywords: [prisma, postgres, schema.prisma, migration, familyscoring, standscoring, scoringchoice, wertung der scheibe, wertung der familie, tabelle, index, indizes, cardprojection, projektion, rawrow, rawsnapshot, rawcolumnset, cardrevision, shot, fingerabdruck, lastsequence, zyklus, cycle, familycards, ownercards, cardwithshots, writerevision, shotchange, storesnapshot, refreshprojections, explain analyze, messung, performance, apps/spiegel, seriessum, writeenteredcard, importkey, place]
part_of: ["[[spiegel]]"]
governed_by: ["[[adr-031]]"]
relates_to: ["[[spiegel-data-model]]", "[[spiegel-ingest-pipeline]]", "[[spiegel-ingest-contract]]", "[[spiegel-edge-cases]]", "[[spiegel-langzeit]]", "[[spiegel-navigation]]"]
---

**TL;DR** Das physische Schema von Spiegel in `apps/spiegel/prisma/schema.prisma`: Rohdaten als Zeilenversionen, Scheiben mit Revisionen nur für Korrekturen der Wertung, je Scheibe eine Projektion. Die Zugriffe liegen in `apps/spiegel/src/lib/db/`; die Übersichten lesen nie Schüsse. Gemessen an 3.765 Scheiben: Übersicht „Alles“ 39 ms, 90 Tage 3 ms, Start 1 ms, eine Scheibe 1 ms.

## Tabellen

| Bereich | Tabellen | Schlüssel und Indizes | wofür |
|---|---|---|---|
| Anlage | `Site`, `Source` (Epoche), `Bridge` | `Source(siteId, epoch)` eindeutig, `Bridge.tokenHash` eindeutig | Herkunft der Daten, Geräte-Token nur als Hash |
| Rohdaten | `RawRow`, `RawColumnSet`, `RawSnapshot` | `RawRow(sourceId, scheibenId, table, checksum)` eindeutig, `RawSnapshot(sourceId, scheibenId, sequence)` eindeutig | unverändert, was die Brücke liest ([[spiegel-ingest-contract]]) |
| Sperren | `Tombstone`, `DeleteLock` | `(sourceId, scheibenId, cycle)` bzw. `(userId, sourceId, scheibenId, cycle)` eindeutig; `DeleteLock(sourceId, scheibenId)` fürs Einlesen | was nicht wiederkommen darf ([[spiegel-navigation]]); mit Beginn, damit der Adapter den Zyklus erkennt; `Tombstone.userId` (wer „nicht meine“ gemeldet hat, Index) und `sportpassId` (unter welcher Nummer; der Admin hebt Meldungen je Nummer auf) |
| Konten | `User`, `NamedPeriod`, `LoginRateLimitBucket`, `FamilyScoring` | `User.email` eindeutig, `NamedPeriod(ownerId)`, Sperren nach Schlüssel, `FamilyScoring(userId, familyId)` Primärschlüssel | Schütze mit Passwort-Hash, `sessionVersion` (neues Passwort, Rolle oder Status beenden die Sitzungen), `isActive` und `mustChangePassword` (ein Passwort vom Admin wird vor dem ersten Blick auf Daten ersetzt); benannte Zeiträume; Sperren der Anmeldung wie Ringwerk; Wertung je Familie für die Schnitte (gelöscht mit Schütze oder Familie) |
| Zustimmung | `SportpassConsent` | `(siteId, sportpassId)` eindeutig, `userId` | Opt-in per Sportpass ([[spiegel-assignment]]): `consentedAt` und `consentVersion` (Hinweistext), Entscheidungen des Admins `confirmedAt`, `rejectedAt`, `returnedAt`, dazu `firstCardConfirmedAt`; eine je Konto (Konten, die schon mehrere haben, behalten sie) |
| Disziplinen | `Family`, `Discipline` | `Family.slug` eindeutig (aus dem Fachkern oder beim Anlegen aus dem Namen, steht in der Adresse, fest), `Discipline(siteId, meytonId, name)` eindeutig (SF-70); `meytonId` optional (vom Admin ohne Meyton angelegt), NULL lässt Postgres mehrfach zu, das Anlegen prüft den Namen | Familie für Verläufe, Scheibenbild, amtliche Wertung (SF-74), Schusszahl des Admins (`plannedShots`: null aus der ID, 0 keine feste), Serienlänge (`seriesShots`: null heißt 10 bei einer Schusszahl aus Zehnern), eingeordnet (`confirmedAt`), ignoriert (`ignoredAt`), `version` für das Nachrechnen |
| Scheiben | `Card`, `CardRevision`, `Shot`, `SeriesSum` | `Card(sourceId, scheibenId, cycle, block)` eindeutig; `Card.importKey` eindeutig; `Card(ownerId, familyId, startedAt)`; `Card(ownerId, startedAt)`; `Card(sportpassId)`; `CardRevision(cardId, number)` eindeutig; `Shot(revisionId, stellung, treffer)` eindeutig; `Shot(cardId, fingerprint)`; `SeriesSum(revisionId, series)` eindeutig | die kanonische Scheibe ([[spiegel-data-model]]); Herkunft `raw`, `pdf`, `manual`, `treffsicher`, Ort als Freitext (`place`), Schlüssel der Übernahme (`importKey`, `treffsicher:<id>`) |
| Projektion | `CardProjection` | `cardId` Primärschlüssel, `version` | Kennzahlen, Rekord-Kandidaten und die Grundlage (`detail`, null vor Version 6) je Scheibe |
| Ausdruck | `Printout` | `(cardId, sha256)` eindeutig, `footerId` (SF-43) | gespeichertes Meyton-PDF mit ID im Fuß und Druckzeit; Datei unter `UPLOAD_DIR/printouts/<sha256>.pdf`, gleiche Bytes teilen sich eine Datei; dazu die Werte: `readerVersion` (Version des Lesers, null: noch nie gelesen), `layout` (`ghostscript`, `qt`, `unknown`), `valuesStatus` (`ok`, `empty`, `inconsistent`, `unreadable`) und `reading` (die Lesung ohne Name, Nummer, ID und Datum, nur bei `ok`; Migration `printout_values`) |

- **Einheiten:** Lage in µm (`xUm`, `yUm`), Abstand in 0,1 µm wie Meytons `Teiler001` (`distanceTenthsUm`), alle Zeiten als `timestamptz(3)` in UTC.
- **Rohzeilen als `json`, nicht `jsonb`:** Der Vertrag erlaubt U+0000 in Zellen, `jsonb` nicht; `json` hält den Text zudem unverändert.
- **Angaben an der Revision** ([[adr-033]], Nachtrag 27. Oktober 2026): Serien-Summen (`SeriesSum`), Gesamtergebnis
  (`CardRevision.totalRings`, `totalDecimalTenths`, `totalShots`) und Trefferlage als Summe (`centerXUm`, `centerYUm`,
  `centerShots`) gehören zur Revision wie die Schüsse; eine geänderte Angabe ist eine neue Revision. Ring und Zehntel
  einer Summe sind getrennt, jede Summe trägt ihre Schusszahl. CHECKs in der Migration `card_details` (Prisma kennt
  keine): eine Serien-Summe hat Ringe oder Zehntel, Serie und Schusszahl über 0; das Gesamtergebnis hat einen Wert
  genau dann, wenn es eine Schusszahl hat; Lage und Schusszahl der Trefferlage stehen nur zusammen. `Shot.innerTen` ist
  null, wenn er unbekannt ist (eingetragen ohne Lage). `revisionSums` liest die Angaben einer Revision (undefined ohne
  sie: Scheiben der Brücke rechnen genau wie bisher).
- **Anzeigeart** (`Shot.displayMode`, aus `Treffer.Wertung`) bleibt erhalten, ist aber nie die amtliche Wertung (SF-74). Die amtliche steht nur an der Disziplin; die Zugriffe lesen sie von dort.
- **Wertung der Scheibe** ([[spiegel-navigation]]): `Card.standScoring` ist die Wertung wie am Stand (die häufigste Anzeigeart der Schüsse wie am Ausdruck, `standScoringOf`), `Card.scoringChoice` die auf ihrer Seite gewählte. Die Zugriffe rechnen daraus mit der Wertung der Disziplin die Wertung der Scheibe (`cardScoring` in `apps/spiegel/src/lib/scoring.ts`).
- **Disziplin der Scheibe** ([[spiegel-navigation]] „Disziplin einer Scheibe“): `Card.disciplineId` ist die Disziplin, mit der Spiegel überall rechnet (Familie, Scheibenbild, Schusszahl, Zählen im Admin). Hat der Schütze eine andere gewählt, steht die vom Stand in `Card.standDisciplineId` (null: keine eigene Wahl). So bleiben alle Abfragen, wie sie sind; nur `writeRevision` und `chooseCardDiscipline` kennen die Wahl.
- **Art der Scheibe** ([[spiegel-navigation]]): `Card.kind` ist die Art der Quelle (jeder Stand schreibt sie), `Card.kindChoice` die des Schützen (kein Stand fasst sie an). Es gilt `kindChoice ?? ranking.kind ?? kind`, bei einer Scheibe nur aus Probe ohne die Rangliste; die Projektion hängt nicht an der Art. `Ranking`: die `Rangliste` der SSMDB2 je Anlage mit der Art, die der Admin zuordnet; `Card.rankingId` mit Index.
- **Familie an der Scheibe:** `Card.familyId` kopiert die Familie der Disziplin, damit Liste und Fortschritt über einen Index laufen; `moveDisciplineFamily` hängt Disziplin und Scheiben in einer Transaktion um, `writeRevision` liest die Familie mit `FOR SHARE`.
- **Zuordnung an der Scheibe:** `Card.disciplineVersion` ist die `Discipline.version`, mit der Merkmale, Gegenprobe und `complete` gerechnet sind (-1: ohne Zuordnung geschrieben, `seed:own`). Weicht sie ab, rechnet `refreshStaleDisciplineCards` die Scheibe aus den Schüssen der aktuellen Revision nach (nach dem Speichern, beim Start, stündlich); `verdaechtig` ist dabei keine Korrektur (`sameScoring`). Die Migration `discipline_mapping` hat die schon vorhandenen Spiele und Trainingsscheiben von Meyton einmal auf ignoriert gesetzt.
- **Ignoriert:** `VISIBLE_CARD` enthält `SHOWN_DISCIPLINE` (Disziplin nicht ignoriert); `PENDING_CARD` nicht, damit die Bestätigung der ersten Scheibe auch ignorierte freigibt. Die Zahlen des Admins je Konto und in der Nutzung zählen mit `COUNTED_CARD` ohne Bedingung an die Disziplin (sonst verriete das Umschalten, wer sie geschossen hat). Die Lagen (`marksOfCards`) filtern ohne Relation zur Disziplin: Mit ihr brauchte die Liste „Alles“ 110 statt 69 ms.
- **Besitz wartet** (`Card.ownerPending`): bis der Schütze die erste Scheibe einer Zustimmung bestätigt hat, zeigen die Übersichten sie nicht ([[spiegel-assignment]]). Jede Ansicht filtert über `VISIBLE_CARD` (`src/lib/db/visible.ts`), „Offen“ über `PENDING_CARD`.
- **Entfernen** (`purgeCards` in `src/lib/db/purge.ts`): Grabstein, Scheibe (Kaskade), die Stände derselben Quelle und ScheibenID, deren **Beginn aus den Trefferzeiten** bei dem der Scheibe liegt (`startHintMs`, 7 Tage), nicht die Beobachtung (die Brücke liest auch Wochen später nach), und keiner, auf den die Revision einer anderen Scheibe zeigt; dann Rohzeilen ohne verbliebenen Stand. Bleibt ein anderer Block desselben Zyklus, gehen nur die Stände dieses Blocks (`RawSnapshot.block`, dazu ungedeutete zwischen dem Block davor und seinem letzten Stand); die Löschsperre entsteht, außer ein späterer Block bleibt. Unter dem Advisory-Lock der Ablage, Scheiben in fester Folge.
- **Zyklus und Sperren** (`src/lib/db/blocks.ts`): Ein neuer Zyklus liegt über allen bisherigen der ScheibenID, auch denen von Grabsteinen und Löschsperren (`maxCycleOfKey`), sonst bekäme eine neue Scheibe den Zyklus einer entfernten. `storeSnapshot` prüft Grabsteine und Sperren (`isKeyBlocked`, 30 Tage um den Beginn) noch einmal unter seiner Sperre; ein Entfernen mitten in einem Stapel wird so nicht überschrieben.
- **Zyklus** (`cycle`, SF-77): Die ScheibenID ist ein Zähler, der nach etwa 49,7 Tagen wiederkehrt. Scheibe, Grabstein und Löschsperre tragen den Zyklus im Schlüssel.
- **Block** (`Card.block`, [[adr-027]]): Im Zyklus beginnt jeder Neustart der Probe und der Übergang zur Wertung einen neuen Block, also eine neue Scheibe. `RawSnapshot.block` hält fest, in welchen Block ein Stand gedeutet wurde (null: noch nicht oder keiner Scheibe zugeordnet), mit `adapterVersion`; `rereadOutdatedKeys` liest Stände einer älteren Version beim Start und stündlich neu. Grabsteine und Löschsperren bleiben je ScheibenID und Zyklus: Die Brücke kennt nur ScheibenID und Beginn.
- **Kaskaden:** Eine Anlage löscht alles unter sich (Quelle, Rohdaten, Scheiben mit Quelle, Disziplinen). Die Disziplin einer Scheibe hat `NO ACTION`, damit diese Kaskade nicht an der Reihenfolge scheitert; Scheiben nur aus dem PDF hängen an keiner Quelle und müssen vorher weg.
- Nicht indiziert, weil selten: `RawSnapshot.bridgeId`, `CardRevision.rawSnapshotId` (nur beim Löschen gebraucht). `Card.disciplineId` ist seit der Admin-Seite „Disziplinen“ indiziert (Nachrechnen, Familie umhängen, Zählen je Disziplin).
- **Migrationen nur anhängen:** Spiegel ist deployt; jede Schemaänderung bekommt eine neue Migration, `…_init` und jede
  andere angewandte Migration bleiben unverändert.

## Schreiben

- **Rohdaten** (`storeSnapshot`): eine Transaktion mit Advisory-Lock auf Quelle und ScheibenID (der Schlüsselraum `(int, int)` gehört diesem Paar).
  - Folgenummer mehr als zehn Minuten in der Zukunft (`MAX_SEQUENCE_AHEAD_MS`): `future`, abgelehnt. Sonst würde sie jeden späteren Stand als veraltet abweisen.
  - Gleiche Prüfsumme wie der letzte Stand: `unchanged`, nur `lastSequence` steigt.
  - Folgenummer nicht über `lastSequence`: `stale`, nichts geändert (SF-26). Ohne `lastSequence` würde ein verspäteter Stand den wiederholten neueren überholen.
  - Sonst: Zeilen mit `skipDuplicates`, Spaltenlisten einmal je Fassung (`RawColumnSet`), der Snapshot mit den Ids seiner Zeilen je Tabelle in kanonischer Folge. `loadSnapshotData` setzt ihn wieder zusammen; seine Prüfsumme ist die gespeicherte (Test, auch mit U+0000).
  - Belegt an den eingefrorenen Fällen: SF-71 bringt den ersten Stand zweimal zurück, ohne eine Zeile neu abzulegen; SF-72 wiederholt einen Stand sofort (kein neuer Snapshot); SF-03 wächst nur um neue Zeilen.
- **Scheibe** (`writeRevision`): eine Transaktion unter demselben Advisory-Lock, dann die Familie der Disziplin (`FOR SHARE`) und die Zeile der Scheibe.
  - Folgenummer nicht über `Card.lastSequence`: `stale`, weder Schüsse noch Merkmale ändern sich.
  - Dieselbe ScheibenID mit einem Beginn mehr als sieben Tage entfernt und ohne gemeinsamen Fingerabdruck: `CardIdentityConflictError`; der Adapter nimmt den nächsten Zyklus.
  - Merkmale (Zustand, vollständig, Merkmale, Beginn, Stand, Wertung wie am Stand) setzt jeder Stand neu; Kennung, Besitzer, gewählte Wertung und gewählte Art nicht. Eine gewählte Disziplin bleibt, solange der Stand die Disziplin bringt, gegen die gewählt wurde (`standDisciplineId`); `recomputeDisciplineCard` rechnet die Merkmale dann in derselben Transaktion mit der gewählten neu. Bringt der Stand eine andere, auch die gewählte, gilt wieder seine. Eine Scheibe aus dem PDF bekommt beim ersten Snapshot ihre Quelle (Herkunft dann „raw“); eine andere Kennung ist ein Fehler. `sportpassId`: fehlt heißt nicht anfassen, `null` heißt leeren.
  - Bekommt eine Scheibe vom Ausdruck ihre Rohdaten (Quelle neu), entsteht immer eine neue Revision, ohne „korrigiert“;
    die Angaben des Ausdrucks bleiben in ihrer, der Ort wird geleert. Eingetragene Scheiben (`manual`, `treffsicher`)
    bekommen nie Rohdaten, und `writeRevision` nimmt keine eingetragene Herkunft an (`RangeError`). Die Angaben einer
    vorhandenen Scheibe ohne Quelle schreibt nur `writeEnteredCard`; mit `cardId` sperrt `writeRevision` die Zeile, bevor
    es Revision und Herkunft liest. Das Nachrechnen hält in der Prüfsumme einer Revision ohne Brücke auch ihre Angaben
    (`detailsHash`); zwei Übernahmen desselben Schlüssels laufen nacheinander (Advisory-Lock auf den Schlüssel).
  - Schüsse (`shotChange`): gleich → `unchanged`; eine Wertungszeile geändert oder weg → `created`, eine neue Revision (SF-67); sonst → `updated` in derselben Revision (neue Schüsse dazu). Löscht Meyton die Probe (SF-03, SF-72), entscheidet das Einlesen vorher über `startsNewBlock`: neuer Block, neue Scheibe.
- **Scheiben ohne Brücke** (`writeEnteredCard` / `writeEnteredCardIn` in `src/lib/db/entered.ts`): der einzige Weg für
  Scheiben vom Ausdruck (Scan, Parser), von Hand und aus Treffsicher. Die Angaben prüft und normalisiert die reine
  Funktion `checkDetails` (`src/lib/entered/details.ts`: Wertebereiche, Schusszahl mit Vorgaben der Disziplin, Schüsse,
  Serien und Gesamtergebnis passen zusammen). Dann Gegenprobe gegen das Scheibenbild, Merkmale (`detailFlags`: ohne
  Werte weder leer noch nur Probe) und Projektion. Neu: Scheibe und Revision 1, mit `importKey` ersetzt ein zweiter Lauf
  statt zu verdoppeln (fremder Besitzer: `keyTaken`). Ändern: gleiche Angaben bleiben `unchanged`, sonst eine neue
  Revision. Wer ändern darf, sagt `detailsWriter`: Rohdaten nie, vom Ausdruck nur der Ausdruck, eingetragene nur von
  Hand, eine aus Treffsicher von Hand (dann `manual`, der Schlüssel bleibt) oder von der Übernahme. `standScoring` ist
  „wie eingetragen“ (`enteredScoring`).
- **Projektion** (`cardProjection` aus `@vereinsheim/shot-core/projection`, `PROJECTION_VERSION` 6 mit der Grundlage
  `detail`): rund 1,5 KB je Scheibe, neu mit jeder Änderung an den Schüssen. `refreshProjections` rechnet veraltete nach (andere `version`, andere Revision als die aktuelle, fehlend), je Scheibe unter der Sperre ihrer Zeile, wahlweise nur eine Quelle. `refreshStaleProjections` ruft es in Stapeln, bis keine übrig ist; der Server startet das beim Start im Hintergrund (`instrumentation-node.ts`), so kommt eine neue Version ohne Zutun in den Übersichten an.
- **Wertung umschalten** (Server Actions in `src/lib/scoring-actions.ts`): `chooseCardScoring` setzt `Card.scoringChoice` nur an einer eigenen, nicht gelöschten Scheibe (`updateMany` mit Besitzer); `saveFamilyScoring` legt `FamilyScoring` an oder ändert es, nur für eine Familie mit eigenen, nicht gelöschten Scheiben.
- **Disziplin wählen** (`src/lib/card-discipline-actions.ts`): `chooseCardDiscipline` unter der Sperre wie `writeRevision` (`lockCard`: Quelle, ScheibenID, dann die Zeile), die gewählte Disziplin `FOR SHARE` vor der Prüfung, nur an einer eigenen, sichtbaren Scheibe und nur eine Disziplin aus `choiceWhere` (eingeordnet, mit Familie, Anlage und Scheibenbild der Disziplin vom Stand, nicht ignoriert, dazu die vom Stand, solange sie nicht ignoriert ist); Familie mit, `disciplineVersion` -1, dann `recomputeDisciplineCard`.
- **Art umschalten** (`src/lib/card-kind-actions.ts`): `chooseCardKind` setzt `Card.kindChoice` in einem `updateMany` (eigene, nicht gelöschte Scheibe, nicht nur aus Probe) und unterscheidet danach „gibt es nicht“ von „nur Probe“.
- **Lagen** (`CardProjection.marks`): die Schüsse wie am Ausdruck mit Lage, ohne verdächtige (SF-15, `isDrawn`), je `[x, y, Ring]` in 10 µm (`cardMarks`), rund 0,6 KB bei 40 Schuss. Sie zeichnen die kleinen Scheiben in Liste und Start und werden mit der Projektion gerechnet (`PROJECTION_VERSION` 3), aber nur für die gezeigten Scheiben gelesen.

## Lesen

| Ansicht | Zugriff | Index |
|---|---|---|
| Liste, Fortschritt | `familyCards(ownerId, familyId, Zeitraum)` | `Card(ownerId, familyId, startedAt)` oder `Card(ownerId, startedAt)`, dazu `CardProjection` über den Primärschlüssel |
| Start, Liste, Blättern | `ownerCards(ownerId)`: alle eigenen Scheiben mit Projektion, Familie und Scheibenbild; die Seite rechnet das Modell auf dem Server | `Card(ownerId, startedAt)` |
| kleine Scheiben | `marksOfCards(ownerId, ids)`: die Lagen der gezeigten Scheiben | `CardProjection` über den Primärschlüssel |
| Start (nur der Abend, Messung) | `latestCardStart`, dann `ownerCards` über den Abend | `Card(ownerId, startedAt)` rückwärts |
| Seite einer Scheibe | `cardWithShots(cardId, ownerId)`: `PageCard` mit Disziplin, Scheibenbild, Familie und Wertung der Scheibe | `Card` und `CardRevision` über den Primärschlüssel, `Shot(revisionId, …)` |
| Wertung je Familie | `familyScorings(ownerId)`: die gespeicherten nach Kennung der Familie; ohne Zeile die häufigste ihrer Scheiben (`overview.ts`) | `FamilyScoring` über den Primärschlüssel (Präfix `userId`) |

Die Übersichten rechnen mit `projectedValues` und `projectedRecords`; was dabei herauskommt, ist gleich der Rechnung aus den Schüssen (Test in `packages/shot-core/src/analysis/projection.test.ts` und an der Datenbank in `reads.test.ts`, mit unvollständiger, ausgenommener, verdächtiger und als Wertung gezählter Scheibe). Eine gelöschte Scheibe (Papierkorb, `deletedAt`) fehlt in jeder Übersicht und auf ihrer Seite; die Seite einer Scheibe gibt es nur für ihren Besitzer.

## Messung

`pnpm --filter spiegel measure` (nicht im Gate) schreibt das Volumen „sehr aktiv, 5 Jahre“ (1.564 Scheiben, 47.355 Schuss, die Probe wie an der Anlage beim ersten Wertungsschuss gelöscht) und 2.200 Scheiben von 20 weiteren Mitgliedern in die Dev-Datenbank, misst je Zugriff den Median aus 15 Läufen, zeigt die Pläne (`EXPLAIN ANALYZE`) und räumt auf. Stand 10. Oktober 2026, Postgres 15 im Dev-Container auf dem Mac:

| Zugriff | ms |
|---|---|
| Fortschritt „Alles“ (1.564 Scheiben mit Projektion) | 39 |
| dieselbe Übersicht direkt über `pg`, eine Abfrage mit Join | 21 |
| Fortschritt 90 Tage | 3 |
| Start: neueste Scheibe und ihr Abend | 1 |
| Seite einer Scheibe (Schüsse der Revision) | 1 |
| ohne Projektion: alle Schüsse der Familie laden | 200 |
| Rechnen aus der Projektion: Ø je Scheibe und Rekorde | 1,5 |
| Rechnen aus den Schüssen: dasselbe | 48 |
| Schreiben einer Scheibe (Revision, Schüsse, Projektion) | 9 |
| offener Durchgang: ein Stand mehr (50 Stände mit Probe → 1 Revision, 40 Schusszeilen) | 5 |

- **Pläne:** Start und die Seite einer Scheibe laufen über Indizes (unter 0,1 ms in der Datenbank). „Alles“ liest 41 % der Tabelle `Card`; dafür wählt Postgres zu Recht einen Seq Scan (1,3 ms). 90 Tage laufen über `Card(ownerId, startedAt)`.
- **Wo die Zeit liegt:** Bei „Alles“ braucht die Datenbank rund 3 ms. Den Rest kosten das Übertragen der Projektionen (2,4 MB JSON) und Prisma (die Hälfte, siehe `pg` direkt). Wird es eng: nur die gebrauchten Schlüssel aus dem JSONB lesen oder die Übersicht direkt über `pg`.
- **Platz** (ein Lauf auf leerer Datenbank, mit Indizes): Schüsse rund 40 MB für 3.764 Scheiben, Projektionen rund 8 MB, Scheiben 2 MB.
- Ohne Datenbank kostete dieselbe Seite aus Schüssen 82 bis 362 ms reine Rechnung ([[adr-031]]).

## Start und Liste auf der Projektion

Die Modelle in `shot-ui` nehmen `ProjectedCard`. Start und
Liste rechnen sie auf dem Server; an den Browser gehen nur das Modell und die Lagen der gezeigten Scheiben. Gemessen am
10. Oktober 2026 mit `pnpm --filter spiegel measure`: 1.564 Scheiben, 47.355 Schuss, dazu 2.200 Scheiben anderer Mitglieder, Median über
7 Läufe.

| | aus Schüssen | aus der Projektion |
| --- | --- | --- |
| an den Browser, Start | alle Scheiben mit Schüssen, 7.982 KB | 5 KB |
| an den Browser, Liste „Alles“ | dasselbe | 1.040 KB (30 Zeilen je Monat, Lagen jeder Zeile) |
| Start auf dem Server (lesen, rechnen, Lagen) | – | 70 ms |
| Liste „Alles“ auf dem Server | – | 69 ms, davon 42 ms Lesen |
| Fortschritt „Alles“ auf dem Server (lesen, rechnen, leicht machen) | – | 64 ms |
| an den Browser, Fortschritt „Alles“ | dasselbe | 936 KB (leichtes Modell: eine Zeile je Scheibe für Liste und Verlauf, Werte, Abstände; Lagen nur der Ablesung) |

Das Trefferbild über einen Zeitraum (L9, L10, L7) liest nur die Lagen der Projektion (`patternCardsOf`) und rechnet das
Muster auf dem Server (`periodPatternAction`, erst wenn Bild oder Reiter es brauchen). Gemessen am 21. Oktober 2026 mit
demselben Volumen:

| Trefferbild | Lagen lesen und Muster rechnen | an den Browser |
| --- | --- | --- |
| „Alles“ (1.564 Scheiben, über 3.000 Schuss) | 56 ms | 156 KB (Raster 64 × 64 für die Umrisse, Schwerpunkt je Scheibe mit Kennung) |
| letzte 90 Tage (76 Scheiben, bis 3.000 Schuss) | 8 ms | 51 KB (jeder Treffer mit seinem Band der Dichte, Raster 64 × 64 für die Umrisse) |

Zwei Befunde der Messung:
- **Datum je Zeile:** `@vereinsheim/lib/format` baute für jeden Aufruf einen neuen `Intl.DateTimeFormat`, etwa 70 µs.
  Allein der Abend jeder Scheibe kostete so 107 ms; mit vorgehaltenen Formattern sank Start von 319 auf 70 ms.
- **Rundung an der Hälfte:** 9,065 zeigte `toFixed` je nach Rechenweg als 9,06 oder 9,07. `formatValue` rundet deshalb
  kaufmännisch, unabhängig vom Rauschen der Gleitkommazahl.

## Last der Ingest-API

Gemessen am 13. Oktober 2026 mit `pnpm --filter spiegel ingest-load` gegen den Standalone-Build in `node:24-alpine` mit `--memory=256m`
(Speicher aus `docker stats`), Dev-Datenbank auf dem Mac:

| Lauf | Ergebnis |
|---|---|
| 12 belegte Stände, 20 min Abend in Echtzeit (Probe, 40 Schuss im Takt der Anlage, Lebenszeichen alle 7 s) | 983 Anfragen, 1.744 Stände, keine 429/503; p50 27 ms, p95 56 ms, höchstens 172 ms; Container 102–120 MiB (86 MiB nach dem Start) |
| davon reine Lebenszeichen | 1.421 (81 %), vermerkt ohne Zeile; abgelegt 323 Stände mit 969 Zeilen |
| schlimmster Fall: zwei Stapel à 3,66 MiB gleichzeitig (100 neue Scheiben à 280 Schuss) | beide 200, 12 s, Spitze 185 MiB |

Folgerung: Ein Abend mit einem Dutzend Schützen mit Zustimmung kostet Spiegel wenig; die Grenzen (4 MiB, zwei Stapel
gleichzeitig) halten den schlimmsten Fall unter 256 MB. Die Brücke schickt ein reines Lebenszeichen trotzdem höchstens
alle 30 s ([[spiegel-bridge]]): Jede Anfrage kostet eine Anmeldung und eine Abfrage.

## Offen

- Noch nicht im Schema: Zuordnung mit Protokoll (SP-1.7 c), Einheit, Notiz, Tag, Ausrüstung ([[spiegel-data-model]]).
