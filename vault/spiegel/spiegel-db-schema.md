---
id: spiegel-db-schema
type: subsystem
title: "Spiegel — Datenbank: Schema, Zugriffe, Messung"
aliases: [spiegel-datenbank, physisches-schema, spiegel-prisma]
keywords: [prisma, postgres, schema.prisma, migration, tabelle, index, indizes, cardprojection, projektion, rawrow, rawsnapshot, rawcolumnset, cardrevision, shot, fingerabdruck, lastsequence, zyklus, cycle, familycards, ownercards, cardwithshots, writerevision, shotchange, storesnapshot, refreshprojections, explain analyze, messung, performance, apps/spiegel]
part_of: ["[[spiegel]]"]
governed_by: ["[[adr-031]]"]
relates_to: ["[[spiegel-data-model]]", "[[spiegel-ingest-pipeline]]", "[[spiegel-ingest-contract]]", "[[spiegel-edge-cases]]", "[[spiegel-langzeit]]", "[[spiegel-navigation]]"]
---

**TL;DR** Das physische Schema von Spiegel in `apps/spiegel/prisma/schema.prisma` (SP-1.6 a Teil 1, Oktober 2026): Rohdaten als Zeilenversionen, Scheiben mit Revisionen nur für Korrekturen der Wertung, je Scheibe eine Projektion. Die Zugriffe liegen in `apps/spiegel/src/lib/db/`; die Übersichten lesen nie Schüsse. Gemessen an 3.765 Scheiben: Übersicht „Alles“ 39 ms, 90 Tage 3 ms, Start 1 ms, eine Scheibe 1 ms.

## Tabellen

| Bereich | Tabellen | Schlüssel und Indizes | wofür |
|---|---|---|---|
| Anlage | `Site`, `Source` (Epoche), `Bridge` | `Source(siteId, epoch)` eindeutig, `Bridge.tokenHash` eindeutig | Herkunft der Daten, Geräte-Token nur als Hash |
| Rohdaten | `RawRow`, `RawColumnSet`, `RawSnapshot` | `RawRow(sourceId, scheibenId, table, checksum)` eindeutig, `RawSnapshot(sourceId, scheibenId, sequence)` eindeutig | unverändert, was die Brücke liest ([[spiegel-ingest-contract]]) |
| Sperren | `Tombstone`, `DeleteLock` | `(sourceId, scheibenId, cycle)` bzw. `(userId, sourceId, scheibenId, cycle)` eindeutig; `DeleteLock(sourceId, scheibenId)` fürs Einlesen | was nicht wiederkommen darf ([[spiegel-navigation]]); mit Beginn, damit der Adapter den Zyklus erkennt |
| Konten | `User`, `NamedPeriod`, `LoginRateLimitBucket` | `User.email` eindeutig, `NamedPeriod(ownerId)`, Sperren nach Schlüssel | Schütze mit Passwort-Hash, `sessionVersion` (neues Passwort, Rolle oder Status beenden die Sitzungen), `isActive` und `mustChangePassword` (ein Passwort vom Admin wird vor dem ersten Blick auf Daten ersetzt); benannte Zeiträume; Sperren der Anmeldung wie Ringwerk; SportpassIDs (mehrere je Konto, SF-39) mit SP-1.7 |
| Disziplinen | `Family`, `Discipline` | `Family.slug` eindeutig (`FamilyId` aus dem Fachkern, steht in der Adresse), `Discipline(siteId, meytonId, name)` eindeutig (SF-70) | Familie für Verläufe, Scheibenbild, amtliche Wertung (SF-74) |
| Scheiben | `Card`, `CardRevision`, `Shot` | `Card(sourceId, scheibenId, cycle)` eindeutig; `Card(ownerId, familyId, startedAt)`; `Card(ownerId, startedAt)`; `Card(sportpassId)`; `CardRevision(cardId, number)` eindeutig; `Shot(revisionId, stellung, treffer)` eindeutig; `Shot(cardId, fingerprint)` | die kanonische Scheibe ([[spiegel-data-model]]) |
| Projektion | `CardProjection` | `cardId` Primärschlüssel, `version` | Kennzahlen und Rekord-Kandidaten je Scheibe |
| Ausdruck | `Printout` | `(cardId, sha256)` eindeutig, `footerId` (SF-43) | gespeichertes Meyton-PDF mit ID im Fuß und Druckzeit |

- **Einheiten:** Lage in µm (`xUm`, `yUm`), Abstand in 0,1 µm wie Meytons `Teiler001` (`distanceTenthsUm`), alle Zeiten als `timestamptz(3)` in UTC.
- **Rohzeilen als `json`, nicht `jsonb`:** Der Vertrag erlaubt U+0000 in Zellen, `jsonb` nicht; `json` hält den Text zudem unverändert.
- **Anzeigeart** (`Shot.displayMode`, aus `Treffer.Wertung`) bleibt erhalten, ist aber nie die amtliche Wertung (SF-74). Die amtliche steht nur an der Disziplin; die Zugriffe lesen sie von dort.
- **Familie an der Scheibe:** `Card.familyId` kopiert die Familie der Disziplin, damit Liste und Fortschritt über einen Index laufen; `setDisciplineFamily` hängt Disziplin und Scheiben in einer Transaktion um, `writeRevision` liest die Familie mit `FOR SHARE`.
- **Zyklus** (`cycle`, SF-77): Die ScheibenID ist ein Zähler, der nach etwa 49,7 Tagen wiederkehrt. Scheibe, Grabstein und Löschsperre tragen den Zyklus im Schlüssel.
- **Kaskaden:** Eine Anlage löscht alles unter sich (Quelle, Rohdaten, Scheiben mit Quelle, Disziplinen). Die Disziplin einer Scheibe hat `NO ACTION`, damit diese Kaskade nicht an der Reihenfolge scheitert; Scheiben nur aus dem PDF hängen an keiner Quelle und müssen vorher weg.
- Nicht indiziert, weil selten: `Card.disciplineId`, `RawSnapshot.bridgeId`, `CardRevision.rawSnapshotId` (nur beim Löschen gebraucht).

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
  - Merkmale (Zustand, vollständig, Merkmale, Beginn, Stand) setzt jeder Stand neu; Kennung und Besitzer nicht. Eine Scheibe aus dem PDF bekommt beim ersten Snapshot ihre Quelle (Herkunft dann „raw“); eine andere Kennung ist ein Fehler. `sportpassId`: fehlt heißt nicht anfassen, `null` heißt leeren.
  - Schüsse (`shotChange`): gleich → `unchanged`; eine Wertungszeile geändert oder weg → `created`, eine neue Revision (SF-67); sonst → `updated` in derselben Revision: neue Schüsse dazu, Probe weg (SF-03) oder neu begonnen (SF-72).
- **Projektion** (`cardProjection` aus `@vereinsheim/shot-core/projection`): rund 1,5 KB je Scheibe, neu mit jeder Änderung an den Schüssen. `refreshProjections` rechnet veraltete nach (andere `version`, andere Revision als die aktuelle, fehlend), je Scheibe unter der Sperre ihrer Zeile, wahlweise nur eine Quelle.

## Lesen

| Ansicht | Zugriff | Index |
|---|---|---|
| Liste, Fortschritt | `familyCards(ownerId, familyId, Zeitraum)` | `Card(ownerId, familyId, startedAt)` oder `Card(ownerId, startedAt)`, dazu `CardProjection` über den Primärschlüssel |
| Start | `latestCardStart`, dann `ownerCards` über den Abend | `Card(ownerId, startedAt)` rückwärts |
| Seite einer Scheibe | `cardWithShots(cardId, ownerId)`: `PageCard` mit Disziplin, Scheibenbild und Familie | `Card` und `CardRevision` über den Primärschlüssel, `Shot(revisionId, …)` |
| Übergang bis SP-1.8: Start, Liste, Blättern | `ownerCardsWithShots(ownerId)`: alle eigenen Scheiben mit Schüssen | `Card(ownerId, startedAt)` |

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
- Ohne Datenbank kostete dieselbe Seite aus Schüssen 82 bis 362 ms reine Rechnung (Plan `plans/2026-10-10-spiegel-datenmodell.md`).

## Offen

- Adapter Snapshot → Scheibe (fängt `CardIdentityConflictError` und nimmt den nächsten Zyklus; prüft Grabstein und Löschsperre über Beginn und Zyklus), Ingest-API mit Geräte-Token (Ergebnisse mit `bigint` vor JSON umwandeln), Zähler für `stale` und `future` (SP-1.6 b, [[spiegel-ingest-pipeline]]). Tests mit den eingefrorenen Folgen SF-03 und SF-72 durch den Adapter.
- Start und Liste auf die Projektion umstellen (SP-1.8) und `ownerCardsWithShots` streichen, vor dem ersten Deploy: Gemessen im Container mit 256 MB (10. Oktober 2026, 32 Scheiben) lief Spiegel zuerst mit 117 MiB nach dem Start und 213 bis 227 MiB unter Last, nach den Korrekturen aus dem Review mit 57 und 147 bis 152 MiB, ohne Abbruch; mit vielen Scheiben trüge jede Seite aber alle Schüsse.
- Modelle von Liste, Fortschritt und Start auf `ProjectedCard` (SP-1.8).
- Noch nicht im Schema: Stand, Schützen-Identität, SportpassIDs und Zuordnung mit Protokoll (SP-1.7), amtliche Summen je Serie, Einheit, Notiz, Tag, Ausrüstung ([[spiegel-data-model]]).
- **Eine Migration bis zum ersten Deploy** (User, 10. Oktober 2026): Bis SP-1.9 ersetzt jede Schemaänderung die eine Migration `init`, statt eine weitere anzulegen; die Dev-Datenbank setzt der User danach zurück. Ab dem ersten Deploy nur noch neue Migrationen.
