# Ringwerk: Spielplan-Erzeugung bei Abbruch wiederholen

Branch `feat/ringwerk-schedule-retry` (von `feat/ringwerk-playoff-concurrency`). Kein Schema, keine Migration.

## Befund

`generateCompetitionSchedule` (`apps/ringwerk/src/lib/matchups/actions.ts`) prüft die Sperre, löscht und legt an in
einer Serializable-Transaktion. Erzeugen zwei Sportleitungen gleichzeitig einen Spielplan, auch in verschiedenen
Wettbewerben, bricht Postgres einen ab (kleine Tabellen, ganz gelesen). Die Person sieht „Spielplan konnte nicht
generiert werden“ und muss noch einmal klicken. `pruefen:ablaeufe` umgeht das mit dem Mutex `alone()`.

Dazu: Wettbewerb und Einschreibungen liest die Action **vor** der Transaktion. Ein Spielplan, der parallel zu einer
Einschreibung entsteht, kann deshalb einen Teilnehmer auslassen; die Transaktion merkt davon nichts.

## Ziel

Gleichzeitiges Erzeugen gelingt. Der Spielplan entsteht immer aus dem Stand in der Transaktion.

## Tasks

- **S1 Helfer an einen neutralen Ort.** `serializable()` und `isConflict()` aus
  `src/lib/playoffs/actions/duelMutations.ts` nach `src/lib/serializable.ts`; die Playoffs importieren von dort.
  Verhalten unverändert (bis zu drei Versuche bei P2034, „could not serialize“, Deadlock).
- **S2 Spielplan in der Transaktion.** In `generateCompetitionSchedule` laufen Wettbewerb lesen, Status prüfen,
  Einschreibungen lesen, Mindestzahl prüfen, Paarungen berechnen, Sperre, Löschen und Anlegen in `serializable()`.
  Auth bleibt davor. Die Meldungen bleiben wortgleich. Bleibt der Konflikt nach drei Versuchen, lautet die Meldung
  „Der Spielplan wurde gleichzeitig geändert. Bitte die Seite neu laden und es noch einmal versuchen.“; andere Fehler
  behalten „Spielplan konnte nicht generiert werden. Bitte erneut versuchen.“
- **S3 Tests** (`src/lib/matchups/actions.test.ts`): der tx-Client bekommt `competition` und `competitionParticipant`;
  Prüfungen „nicht ACTIVE“ und „unter 4“ erwarten kein `createMany` statt keiner Transaktion. Neu: Abbruch einmal →
  Erfolg, zwei Transaktionen; Abbruch dreimal → Meldung „gleichzeitig“; anderer Fehler → kein zweiter Versuch;
  Wettbewerb und Einschreibungen werden über den tx-Client gelesen (db außerhalb wirft). Gegenprobe per Mutation
  (Retry entfernt, Lesen außerhalb).
- **S4 Werkzeug.** `alone()` in `apps/ringwerk/tools/pruefen-ringwerk/ablaeufe.ts` entfernen;
  `pnpm --filter ringwerk build` und `pruefen:ablaeufe` grün (Telefon und Desktop erzeugen nun gleichzeitig).
- **S5 Doku.** Befund „Zwei Spielpläne zugleich erzeugen bricht einen ab“ in `vault/apps/ringwerk/ringwerk.md`
  streichen; `ringwerk-features.md` (Spielplan) um Wiederholen und Lesen in der Transaktion ergänzen. Gate
  `pnpm check`, Commit, Plan löschen.

## Nicht im Umfang

Andere Transaktionen in Ringwerk (keine weiteren Serializable-Transaktionen außerhalb der Playoffs).
