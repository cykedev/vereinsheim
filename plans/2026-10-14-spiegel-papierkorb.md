# Spiegel: Löschen mit Papierkorb, Sperren sichtbar (P2b)

## Kontext

Entscheidung 15 in [[spiegel-navigation]] (User, 9. Oktober 2026): Eine eigene Scheibe lässt sich löschen. Sie liegt
30 Tage im Papierkorb unter Profil und zählt so lange nirgends mit. Danach wird sie endgültig gelöscht, und eine
**weiche Sperre** (`DeleteLock`, nur der Schlüssel) hält die Brücke davon ab, sie von selbst zurückzubringen. Ein
**Grabstein** bleibt für „Nicht meine“.

Rückmeldung des Users vom 14. Oktober 2026 auf „sieht man denn die grabsteine irgendwo/irgendwie“: Heute sieht man sie
nirgends. Mit P2b sieht der Schütze im Papierkorb, was nicht von selbst wiederkommt (endgültig gelöscht und „nicht
meine“), und der Admin sieht in der Übersicht, wie viele Scheiben als „nicht meine“ gemeldet sind. Aufheben kommt mit
P2d.

Was es schon gibt: `Card.deletedAt` (jede Ansicht filtert über `VISIBLE_CARD`), `DeleteLock` und `Tombstone` im
Schema, `GET /state` verteilt beide an die Brücke, das Einlesen prüft beide (`isKeyBlocked`), `purgeCards` entfernt
Scheibe und Rohdaten mit Grabstein, die Route `trash` (`/profile/trash`) in `shot-ui`. Was fehlt: Löschen, Papierkorb,
endgültiges Löschen mit Sperre, der Ablauf nach 30 Tagen, die Anzeige der Sperren.

## Entscheidungen

- **D1 Schema** (geschützter Pfad, daher interaktiv, T1): `Tombstone` bekommt `userId String?` (wer gemeldet hat,
  `onDelete: SetNull`) und `sportpassId BigInt?` (unter welcher Nummer die Scheibe kam), dazu `@@index([userId])`. Nur so
  kann der Papierkorb die eigenen Meldungen zeigen und P2d einen Grabstein einer Zustimmung zuordnen. Die eine
  Init-Migration wird neu erzeugt und in einem Wegwerf-Postgres auf leeren Diff geprüft; die Dev-Datenbank zieht ein
  additives `ALTER TABLE` nach (zwei Spalten, ein Index).
- **D2 `purgeCards` mit Art der Sperre:** `purgeCards(tx, cardIds, block)` mit
  `block = { tombstone: reason } | { lock: true }`.
  - Grabstein wie heute, jetzt mit `userId = card.ownerId` und `sportpassId = card.sportpassId`.
  - Sperre: `DeleteLock` mit `userId = card.ownerId` (Quelle, ScheibenID, Zyklus, Beginn); eine Scheibe ohne
    Besitzer ist dabei ein Fehler des Aufrufers.
  - Eine Scheibe ohne Quelle (nur PDF, noch nicht gebaut) hat weder Rohdaten noch Sperre: Mit `lock` wird nur die
    Scheibe gelöscht, mit `tombstone` bleibt es ein Fehler.
  - Rohdaten, Reihenfolge und Advisory-Lock bleiben wie heute.
- **D3 Actions** (`src/lib/trash-actions.ts`, `ActionResult`, nie werfen, Sitzung und Kennung über `action-guards.ts`).
  Jede trägt ihre Bedingung im `updateMany`/`findFirst` selbst, unter der Sperre der Kartenzeile (`FOR UPDATE`).
  - `deleteCard(id)`: nur eine eigene, sichtbare Scheibe (`ownerId`, `VISIBLE_CARD`), setzt `deletedAt = now`. Eine
    wartende in „Offen“ hat „Nicht meine“ und lässt sich hier nicht löschen. Ein zweites Löschen sagt „Schon gelöscht.“
  - `restoreCard(id)`: nur eine eigene im Papierkorb, deren 30 Tage nicht um sind, setzt `deletedAt = null`.
  - `purgeCardNow(id)`: nur eine eigene im Papierkorb, `purgeCards(tx, [id], { lock: true })`.
  - Danach `revalidatePath("/", "layout")`.
- **D4 Ablauf nach 30 Tagen:** `purgeExpiredTrash(db, nowMs)` in `src/lib/db/trash.ts` entfernt Scheiben mit
  `deletedAt` älter als 30 Tage (`TRASH_DAYS = 30`) über `purgeCards(…, { lock: true })`, je Scheibe eine eigene
  Transaktion (eine fehlerhafte hält die übrigen nicht auf). Läuft beim Start des Servers und danach stündlich
  (`instrumentation-node.ts`, `setInterval(…).unref()`), Fehler nur als Zahl und Name ins Log. Kein Cron, kein neuer
  Dienst.
- **D5 Löschen an der Scheibe:** am Ende der Seite einer Scheibe (letzter Abschnitt unter der Analyse) ein leiser Knopf
  „Scheibe löschen“ (`Trash2`). Er fragt über `DecisionDialog` (D7). Nach dem Löschen geht die Seite den Rückweg
  (`backRoute`, sonst `/cards`) und zeigt dort „Scheibe gelöscht · Rückgängig“ (D6). Eine gelöschte eigene Scheibe
  öffnet über eine alte Adresse nicht mehr, die Seite leitet in den Papierkorb um (statt 404).
- **D6 „Rückgängig“ gleich danach:** ein Hinweis unten im Rahmen der App (`UndoBar`, Kontext in `AppShell`, damit er
  die Navigation überlebt), `role="status"`, mit „Rückgängig“ (ruft `restoreCard`). Er bleibt zehn Sekunden oder bis
  zur nächsten Navigation des Users. Fehler stehen im Hinweis als Text. Wiederverwendbar für die Auswahl (N4).
- **D7 Texte** (`consequences.ts`, Regel „Kein Knopf ohne Folge“, Wortlaut zur Freigabe):
  - `cardDelete({ evening })`, Knopf „Löschen“, destruktiv:
    - Worum: „Die Scheibe vom {evening}.“
    - Was dann passiert:
      - „Sie liegt 30 Tage im Papierkorb (Profil) und zählt so lange nirgends mit, auch nicht in Rekorden und
        Verläufen.“
      - „Danach wird sie endgültig gelöscht, mit allen Schüssen. Die Brücke bringt sie nicht von selbst zurück.“
    - Was nicht passiert: „Deine anderen Scheiben bleiben.“ und „An der Meyton-Anlage ändert sich nichts.“
    - Rückgängig: „30 Tage lang im Papierkorb wiederherstellen.“
  - `cardPurgeNow({ evening })`, Knopf „Endgültig löschen“, destruktiv:
    - Worum: „Die Scheibe vom {evening} liegt im Papierkorb.“
    - Was dann passiert:
      - „Sie wird sofort gelöscht, mit allen Schüssen.“
      - „Spiegel merkt sich nur, dass es sie gab, damit die Brücke sie nicht von selbst zurückbringt.“
    - Was nicht passiert: „An der Meyton-Anlage ändert sich nichts.“
    - Rückgängig: „Nicht möglich.“
  - **Wiederherstellen fragt nicht.** Es macht das Löschen rückgängig und hat keine Folge außer dieser. Ein Dialog
    davor wäre ein Knopf ohne Entscheidung.
- **D8 Papierkorb** (`/profile/trash`, Server-Komponente, `requireSession`; Hülle `TrashScreen`):
  - **Im Papierkorb:** je Scheibe Datum und Uhrzeit, Disziplin, Ergebnis (aus der Projektion, keine Schüsse), „noch
    n Tage“, „Wiederherstellen“ und „Endgültig löschen“. Ohne Scheiben ein Leerzustand.
  - **Kommt nicht von selbst wieder:** eigene Sperren (`DeleteLock`) als „endgültig gelöscht“ und eigene Grabsteine
    (`Tombstone.userId`) als „als ‚nicht meine‘ gemeldet“, je mit Datum und Uhrzeit des Beginns, ohne Knopf. Darüber
    ein Satz: „Diese Scheiben bringt die Brücke nicht von selbst zurück. Ein Admin kann eine Meldung ‚nicht meine‘
    wieder aufheben.“ Den zweiten Satz erst mit P2d; bis dahin nur der erste.
  - Lesen über `trashCards(db, { ownerId })` und `blockedCards(db, { ownerId })` in `reads.ts` (nie Schüsse).
  - Im Profil ein Link „Papierkorb“ mit Zahl, wenn er nicht leer ist.
- **D9 Admin sieht die Grabsteine als Zahl:** An der Station „Zustimmungen“ der Übersicht eine Zeile „n Scheiben als
  ‚nicht meine‘ gemeldet; sie kommen nicht wieder.“ (Grabsteine der Anlage mit Grund `nicht-meine`). Nur Zustand, keine
  Aufgabe, keine Namen (D0, [[spiegel-privacy]]).
- **D10 Korrekturen an einer Scheibe im Papierkorb:** Schickt die Brücke in den 30 Tagen einen neuen Stand, schreibt
  das Einlesen ihn wie bisher; `deletedAt` bleibt (Test). Nach dem endgültigen Löschen hält die Sperre ihn ab.

## Nicht in diesem Plan

- Löschen mehrerer Scheiben über die Auswahl (N4; `UndoBar` und Actions sind dafür vorbereitet).
- Sperren und Grabsteine aufheben: Holen per QR (SP-1.7 b), Nachladen und das Aufheben einer Meldung „nicht meine“
  durch den Admin (P2d).
- Konto löschen, Export.

## Required Docs

- `apps/spiegel/CLAUDE.md` (Schichten, Übersichten lesen keine Schüsse, Privat ist Standard, Erste Scheibe, Kein Knopf
  ohne Folge, Tests gegen die Dev-Datenbank, Skriptprüfung, genau eine Migration)
- `vault/spiegel/spiegel-navigation.md` Entscheidung 15, `vault/spiegel/spiegel-privacy.md`,
  `vault/spiegel/spiegel-edge-cases.md` SF-28
- `vault/conventions.md` §9 („Prüfen und Löschen gehören in dieselbe Transaktion“), §10 (Design 2, Kein Knopf ohne
  Folge)

## Dateien

| Datei | Änderung |
| --- | --- |
| `apps/spiegel/prisma/schema.prisma`, `prisma/migrations/*_init/migration.sql` | T1: `Tombstone.userId`, `sportpassId`, Index |
| `apps/spiegel/src/lib/db/purge.ts` (+ Test) | T2: Art der Sperre |
| `apps/spiegel/src/lib/first-card-actions.ts` | T2: `{ tombstone: "nicht-meine" }` |
| `apps/spiegel/src/lib/db/trash.ts` (+ Test) | T3: `TRASH_DAYS`, `purgeExpiredTrash` |
| `apps/spiegel/src/instrumentation-node.ts` | T3: beim Start und stündlich |
| `apps/spiegel/src/lib/trash-actions.ts` (+ Test) | T4 |
| `apps/spiegel/src/lib/db/reads.ts` (+ Test) | T5: `trashCards`, `blockedCards` |
| `apps/spiegel/src/lib/admin/consequences.ts` (+ Test) | T6: `cardDelete`, `cardPurgeNow` |
| `apps/spiegel/src/components/shell/UndoBar.tsx`, `AppShell.tsx` (+ Markup-Test) | T7 |
| `apps/spiegel/src/components/card/CardScreen.tsx`, `src/app/(app)/cards/[id]/page.tsx` | T8 |
| `apps/spiegel/src/app/(app)/profile/trash/page.tsx`, `src/components/profile/TrashScreen.tsx` (+ Markup-Test), `ProfileScreen.tsx`, `profile/page.tsx` | T9 |
| `apps/spiegel/src/lib/admin/overview.ts`, `AdminOverview.tsx` (+ Tests) | T10 |
| `apps/spiegel/tools/pruefen.ts` | T11: Löschen, Rückgängig, Papierkorb |
| `apps/spiegel/CLAUDE.md`, `vault/spiegel/spiegel-navigation.md`, `spiegel-privacy.md`, `spiegel-db-schema.md` | T12 |

## Aufgaben

Ablauf: **T1 interaktiv** (Schema ist geschützter Pfad), danach **T2–T12 autonom** (ADR-023).

1. **T1 Schema (interaktiv):** Felder und Index aus D1 ergänzen. Mit `prisma migrate diff --from-empty --to-schema
   prisma/schema.prisma --script` (ohne `CREATE SCHEMA`) die Init-Migration neu erzeugen, dann `prisma generate`.
   Wegwerf-Postgres (`postgres:17-alpine` auf freiem Port), Migration einspielen, `migrate diff --from-config-datasource`
   gegen das Schema muss leer sein. Dev-Datenbank additiv:
   `ALTER TABLE "Tombstone" ADD COLUMN "userId" TEXT, ADD COLUMN "sportpassId" BIGINT;` + Fremdschlüssel und Index wie
   in der Migration. Gate, Commit.
2. **T2 `purgeCards` mit `block`:** Test zuerst in `purge.test.ts`:
   - `lock` legt `DeleteLock` mit Besitzer an, keinen Grabstein, Rohdaten weg, `isKeyBlocked` wahr.
   - `tombstone` setzt `userId` und `sportpassId`.
   - Ohne Quelle löscht `lock` nur die Scheibe, `tombstone` wirft.

   Dann der Code und der Aufruf in `first-card-actions.ts`. Gegenprobe: `userId` im Grabstein weglassen → Test rot.
3. **T3 Ablauf:** Test zuerst (`trash.test.ts`): Nach 29 Tagen bleibt die Scheibe, nach 31 Tagen ist sie weg und
   gesperrt; eine Scheibe eines anderen Kontos wird gleich behandelt; ohne `deletedAt` bleibt alles. Dann
   `purgeExpiredTrash` und der Aufruf in `instrumentation-node.ts` (Start und stündlich, `unref`).
4. **T4 Actions:** Tests zuerst (`trash-actions.test.ts`, Muster `first-card-actions.test.ts`):
   - Fremde, wartende und schon gelöschte Scheibe → Fehler, nichts geändert.
   - Löschen, Wiederherstellen, endgültig löschen jeweils mit Wirkung in der Datenbank.
   - Wiederherstellen nach 30 Tagen → Fehler.
   - Endgültig löschen einer nicht gelöschten → Fehler.
   - Ein Datenbankfehler → Text, kein Wurf.

   Dann die Actions.
5. **T5 Lesen:** `trashCards` (eigene mit `deletedAt`, neueste zuerst, mit Disziplin, Ergebnis aus der Projektion,
   `deletedAt`) und `blockedCards` (eigene `DeleteLock` und `Tombstone` mit `userId`, Art und Beginn, neueste zuerst).
   Tests: fremde fehlen, wartende fehlen, Übersichten (`ownerCards`) zeigen gelöschte weiterhin nicht.
6. **T6 Texte:** `cardDelete`, `cardPurgeNow` wie D7 in `consequences.ts`, Wortlaut-Tests wie die übrigen
   (`wellFormed`).
7. **T7 `UndoBar`:** Kontext `useUndo()` mit `show({ text, undo })`, Anzeige unten über der unteren Leiste (am Telefon)
   bzw. unten rechts (Desktop), Design-2-Tokens, `role="status"`, Knopf „Rückgängig“ mindestens `h-10`. Verschwindet nach
   zehn Sekunden oder bei einer Navigation, die nicht von `show` kam. Markup-Test.
8. **T8 Scheibe:** Abschnitt „Löschen“ am Ende (`below`), Knopf mit `DecisionDialog(cardDelete)`, nach Erfolg
   `router.replace` auf den Rückweg und `undo.show({ text: "Scheibe gelöscht", undo: restoreCard })`. Fehler als Text im
   Abschnitt. Die Seite: eigene gelöschte Scheibe → `redirect("/profile/trash")`, sonst `notFound()` wie bisher (Test
   über eine Hilfsfunktion in `reads.ts`, `ownCardState`: sichtbar, im Papierkorb, keine).
9. **T9 Papierkorb:** Seite und `TrashScreen` nach D8, `PageHeader`-Stil der App (Titel wie Profil), Leerzustand,
   Knöpfe mit `DecisionDialog(cardPurgeNow)` bzw. direkt „Wiederherstellen“, Fehler als Text an der Zeile. Profil: Link
   „Papierkorb (n)“ (Zahl aus `trashCards`), auch ohne Scheiben erreichbar, wenn Sperren bestehen. Markup-Test:
   Tage-Rest, beide Listen, kein Knopf an den Sperren.
10. **T10 Admin:** `overviewModel` bekommt `notMine: number` und zeigt an der Station „Zustimmungen“ die Zeile aus D9
    ab 1. `adminOverview` zählt Grabsteine der Anlage mit Grund `nicht-meine`. Tests.
11. **T11 Skriptprüfung:** neue Prüfung `papierkorb` in `pruefen.ts`: eine Scheibe des Demo-Kontos löschen, Dialog
    sagt „30 Tage“, „Rückgängig“ bringt sie zurück, erneut löschen, Papierkorb zeigt sie, „Wiederherstellen“, Liste
    zeigt sie wieder. Ohne endgültiges Löschen (die Demo-Daten bleiben vollständig).
12. **T12 Doku:** Scope-Notiz (Papierkorb, Ablauf, `UndoBar`, `purgeCards` mit `block`), Entscheidung 15 mit Stand,
    Privacy (wer was sieht), DB-Schema (`Tombstone.userId`, `sportpassId`). Plan P2d um „Grabstein aufheben“ in der
    Übersicht der Pläne vormerken (Abschnitt „Nicht in diesem Plan“ dort, wenn P2d entsteht).

## Testschritte

- `pnpm check` grün nach jedem Task; Spiegel ohne Cache einmal am Ende.
- Mutationsproben: `userId` im Grabstein weglassen (T2), die 30-Tage-Grenze in `restoreCard` streichen (T4), den
  Filter `deletedAt: null` in `blockedCards`/`trashCards` vertauschen (T5). Jede muss einen Test rot machen.
- Browser (Dev-Server :3002, eigener Hintergrund-Tab, eigenes Testkonto mit eigenen Scheiben, nie die Daten des Users):
  - Scheibe löschen: Dialog mit Folgen, Rückweg, „Scheibe gelöscht · Rückgängig“, Rückgängig bringt sie zurück.
  - Erneut löschen: Die Scheibe fehlt in Start, Liste und Fortschritt. Der Papierkorb zeigt „noch 30 Tage“.
    Wiederherstellen.
  - Endgültig löschen mit Dialog: Die Sperre steht unter „Kommt nicht von selbst wieder“.
  - Alte Adresse der gelöschten Scheibe leitet in den Papierkorb.
  - Admin-Übersicht zeigt die Zahl der „nicht meine“-Meldungen.
  - Telefon 375 px ohne seitliches Scrollen, keine Konsolenfehler.
- `pruefen --start --nur papierkorb` (vorher beim User nachfragen, ob `seed:own --demo` gerade stört).

## Verifikation

Validierungsbericht `reports/2026-10-14-spiegel-papierkorb.md` mit Gate-Ausgabe, Mutationsproben, Browser-Befunden und
„nicht belegt“; danach `/review` gegen `main`.
