# Plan: Korrektur in den Playoffs hält die nächste Runde richtig

Stand: 18. Oktober 2026 · Branch: `feat/ringwerk-qf-correction` (von `feat/ringwerk-stable-order`)

## Befund (belegt am Prüfbestand, über Ringwerks Server-Actions und die Oberfläche)

Wettbewerb „L-DRR-8 · L5 Viertelfinale fertig“: Halbfinale angelegt, Halbfinale 2 fertig gespielt, dann ein Duell im
Viertelfinale korrigiert. Halbfinale 1 hat noch kein Duell, die Oberfläche bietet die Korrektur deshalb an.

1. **Der Sieger dreht, die nächste Runde bleibt:** Die Korrektur macht aus 3:2 ein 2:3. Das Viertelfinale bleibt
   „fertig“, und es greift keine Kaskade. Im Halbfinale steht weiter der alte Sieger, der jetzt verloren hat.
2. **Das Viertelfinale geht wieder auf, die Runde zerfällt:** Die Korrektur macht aus einem Sieg ein Unentschieden.
   Ringwerk löscht nur das leere Halbfinale mit diesen Teilnehmern, das andere bleibt. Nach der neuen Entscheidung gibt
   es ein Halbfinale. Die Oberfläche bietet „Finale anlegen“ an (nicht „Halbfinale anlegen“), und das **wirft**:
   Prisma vermisst den zweiten Finalisten. Der Wettbewerb kommt ohne Eingriff in die Datenbank nicht weiter.

**Ursache:** Die nächste Runde setzt Ringwerk aus *allen* Siegern einer Runde neu nach Rang
(`createNextRoundMatchups`). Ändert sich ein Sieger, können sich alle Paarungen der nächsten Runde ändern. Sperre,
Kaskade und „korrigierbar“ arbeiten aber je Teilnehmer (`nextRoundParticipantsFilter`, `canCorrect` in
`getPlayoffBracket`). Die Kaskade läuft zudem nur, wenn das Match wieder offen ist (`saveDuel.ts`), nicht, wenn der
Sieger wechselt.

## Regel (Entscheidung für den User)

Eine Runde lässt sich korrigieren, solange in der **ganzen** nächsten Runde noch kein Duell geschossen ist. Ändert die
Korrektur den Ausgang eines Matches (anderer Sieger oder wieder offen), entfernt Ringwerk die **ganze** nächste Runde.
Sie wird danach über „… anlegen“ neu gesetzt, nach Rang wie bisher. Bleibt der Sieger derselbe, bleibt die nächste
Runde.

Das ist strenger als heute: Ist im Halbfinale 2 schon ein Duell geschossen, ist das Viertelfinale 1 nicht mehr
korrigierbar. Das ist richtig, denn eine Korrektur könnte die Paarung des Halbfinales 2 ändern. Die Oberfläche
blendet die Korrektur dann aus, wie heute schon für die eigenen Teilnehmer.

## Tasks

- **K1 Charakterisierung (rot).** Tests für `savePlayoffDuelResult` und `deleteLastPlayoffDuel` mit einem Mock, das
  nach der Bedingung filtert (conventions §9): (a) Sieger dreht bei bleibendem „fertig“ → ganze nächste Runde weg;
  (b) Match geht wieder auf → ganze nächste Runde weg, nicht nur das Match mit den Teilnehmern; (c) Sieger bleibt →
  nächste Runde bleibt; (d) ein Duell irgendwo in der nächsten Runde → Korrektur und Löschen verweigert. Für
  `getPlayoffBracket`: `canCorrect` falsch, sobald irgendein Match der nächsten Runde Duelle hat. Für `advanceRound`:
  eine unvollständige nächste Runde (Daten aus dem alten Verhalten) führt nicht zu einem Wurf, sondern zu einer
  Meldung.
- **K2 Umsetzung.** `src/lib/playoffs/actions/duelMutations.ts`: `hasNextRoundDuels` und `cascadeDeleteEmptyNextRound`
  über die ganze nächste Runde (`competitionId`, `round`), Kaskade nur, wenn sich der Ausgang ändert;
  `saveDuel.ts` und `deleteDuel.ts` rufen sie so auf (die Kaskade in `deleteDuel.ts` nutzt dieselbe Funktion, in der
  Transaktion). `getPlayoffBracket`: `canCorrect` je Runde. `match.ts` (`handleMatchCompletion`): eine Runde mit
  ungerader Zahl Sieger oder fehlendem Gegner liefert eine Fehlermeldung statt zu werfen.
- **K3 Prüfung.** `pnpm check`; der Nachbau oben über die Actions (Variante 1 und 2) jetzt richtig: die nächste Runde
  ist weg und lässt sich über „Halbfinale anlegen“ neu setzen; `pruefen:vergleichen` 0 Fehler (der Prüfbestand korrigiert
  nichts); `pruefen:ablaeufe` grün, ergänzt um eine Korrektur im Viertelfinale mit Neuanlage des Halbfinales und
  Prüfung der Datenbank.
- **K4 Doku.** `vault/apps/ringwerk/playoffs-knockout-system.md` (Regel für Korrekturen), `ringwerk.md` (offener Punkt
  erledigt), `phase-locking-and-editability.md`.

## Release

Gehört zur selben Ringwerk-Auslieferung wie die eindeutige Reihenfolge. Vor dem Release auf dem VPS prüfen, ob schon
ein Bracket in einem der beiden Zustände steht (Abfrage: je Wettbewerb Zahl der Matches je Runde und Teilnehmer der
nächsten Runde gegen die Sieger der Runde davor); die echte Kopie hat keine Playoffs.
