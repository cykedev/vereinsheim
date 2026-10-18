# Plan: Playoff-Duelle gleichzeitig sicher speichern

Stand: 18. Oktober 2026 · Branch: `feat/ringwerk-playoff-concurrency` (von `feat/ringwerk-qf-correction`)

## Befund

1. **Verlorener Sieg (belegt am Prüfbestand über Ringwerks Actions):** Viertelfinale 1:1; Duell 3 eintragen und
   zugleich Duell 1 korrigieren. Beide melden Erfolg, gespeichert ist 0:2, die Duelle ergeben 1:2.
   `savePlayoffDuelResult` liest Siegstand und Status vor der Transaktion und schreibt daraus abgeleitete Werte; das
   zweite Speichern überschreibt das erste. Ebenso `deleteLastPlayoffDuel`.
2. **Schritte nach der Transaktion:** Das Protokoll und das automatische nächste Duell (`addExtraDuel`) laufen nach
   dem Commit. Scheitert das Anlegen der Verlängerung im Finale, gibt es keinen Weg zurück: Die Oberfläche bietet im
   Finale kein Duell mehr an, sobald es eines hat (`canAddDuel`).
3. **Finale nach Korrektur zum Unentschieden hängt:** Eine Korrektur legt kein Duell an. Das Finale steht offen ohne
   offenes Duell, und die Oberfläche bietet keines an.
4. **„Eintragen“ an einem entschiedenen Match:** Ein offenes Duell aus Altbestand zeigt den Knopf weiter; der Server
   lehnt die Eingabe inzwischen ab.
5. **Meldung bei gleichzeitiger Änderung:** Ein Serialisierungsfehler (Prisma `P2034`) erscheint als „konnte nicht
   gespeichert werden“.
6. **„… anlegen“ ohne Transaktion:** `advanceRound` liest die Runde und legt die nächste an, ohne dass eine Korrektur
   dazwischen auffällt.

## Ansatz

Der Siegstand eines Matches ist eine Folge seiner fertigen Duelle. Statt ihn vor der Transaktion zu lesen und zu
verschieben, **zählt Ringwerk ihn in der Transaktion aus den Duellen neu** (dieselbe Wertung wie beim Eintragen,
`storedDuelOutcome`). Alles, was davon abhängt, läuft in derselben serialisierbaren Transaktion: Prüfungen (entschiedenes
Match, beide Seiten mit genug Siegen, Sperre der nächsten Runde), Status, offene Duelle, nächstes Duell, Entfernen der
nächsten Runde, Protokoll. Zwei gleichzeitige Speichervorgänge ergeben dann entweder denselben richtigen Stand oder
einer scheitert mit einer klaren Meldung.

## Tasks

- **C1 Tests (rot).** `correction.test.ts` bzw. neue `concurrency.test.ts`: Siegstand kommt aus den Duellen in der
  Transaktion, auch wenn das vorab gelesene Match veraltet ist (Mock liefert vorab 1:1, in der Transaktion ein schon
  gespeichertes Duell mehr); Finale nach Korrektur zum Unentschieden bekommt die Verlängerung (mit
  `finaleHasSuddenDeath`), ohne sie nicht; nächstes Duell und Protokoll entstehen über den Client der Transaktion;
  `P2034` ergibt die Meldung „gleichzeitig geändert“; `advanceRound` legt in einer serialisierbaren Transaktion an.
- **C2 Umsetzung.** `src/lib/playoffs/actions/duelMutations.ts`: `persistDuelResult` schreibt die Ergebnisse, liest dann
  in der Transaktion Match und fertige Duelle, zählt die Siege, prüft, setzt Status, entfernt offene Duelle eines
  entschiedenen Matches, legt das nächste Duell an (nach einem neuen Unentschieden außerhalb des Finales wie bisher; im
  Finale, sobald es offen ist und kein offenes Duell hat, mit `finaleHasSuddenDeath`), entfernt bei geändertem Ausgang
  die nächste Runde und schreibt das Protokoll. `saveDuel.ts` und `deleteDuel.ts` rufen das, statt selbst zu rechnen.
  `match.ts`: `advanceRound` in einer serialisierbaren Transaktion. `DuelRows.tsx`: „Eintragen“ nur, wenn das Match
  nicht entschieden ist. Eine gemeinsame Meldung für `P2034`.
- **C3 Prüfung.** `pnpm check`; der Nachbau oben ergibt 1:2 oder eine Meldung, nie einen verlorenen Sieg;
  `pruefen:vergleichen` 0 Fehler; `pruefen:ablaeufe` grün.
- **C4 Doku.** `vault/apps/ringwerk/ringwerk-features.md` („Korrekturen & Löschungen“), `ringwerk.md` (Restpunkte
  erledigt). Review.

Keine Schema-Änderung. Ein Finale ohne `finaleHasSuddenDeath` bleibt nach einem Unentschieden wie heute ohne nächstes
Duell (eigene Frage an die Sportleitung, nicht Teil dieses Plans).
