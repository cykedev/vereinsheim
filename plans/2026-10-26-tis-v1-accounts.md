# V1 · Abgleich der Konten Treffsicher ↔ Spiegel

Teil V1 aus [`2026-10-26-treffsicher-in-spiegel.md`](2026-10-26-treffsicher-in-spiegel.md). Branch `feat/tis-v1-accounts`,
abgezweigt von `feat/treffsicher-in-spiegel`.

## Context

Bei der Übernahme (Stufe 3, [[adr-033]]) ordnen sich Konten über die E-Mail zu. Der User muss vorher wissen,

- für wen es in Spiegel noch kein Konto gibt,
- bei wem die E-Mail in beiden Apps vermutlich nicht passt (dieselbe Person, zwei Adressen), sonst entstünden zwei
  Konten,
- wie viele Konten, Einheiten und Favoriten es gibt (Zählungen, die ADR-033 vor Stufe 3 verlangt).

Die Dev-Datenbank ist eine Prod-Kopie vom 26. Oktober 2026. Der Bericht enthält Namen und E-Mails und bleibt deshalb nur
in `reports/` (gitignored, ADR-029). Vor der echten Übernahme läuft derselbe Abgleich noch einmal gegen Prod, durch den
User.

## Approach

Zwei SQL-Abfragen, je eine je Datenbank, liefern CSV (`psql --csv`). Ein Skript liest beide CSV und schreibt einen
Bericht in Markdown. Die Zuordnung ist eine reine, getestete Funktion, die Stufe 3 wiederverwendet. Keine Verbindung
zwischen den Datenbanken (ADR-002), keine neue Abhängigkeit, kein Schema.

## Files

- `apps/spiegel/src/lib/transfer/accountMatch.ts` (neu): reine Funktionen.
  - `normalizeEmail(s)`: trimmen, klein schreiben.
  - `normalizeName(s)`: trimmen, klein, ä→ae, ö→oe, ü→ue, ß→ss, mehrfache Leerzeichen zu einem, Reihenfolge von Vor- und
    Nachname egal (Wörter sortiert).
  - `matchAccounts(treffsicher, spiegel)`: liefert vier Gruppen.
    - `both`: gleiche normalisierte E-Mail. Je Paar Abweichungen in Rolle und Aktiv-Status.
    - `onlyTreffsicher`: keine gleiche E-Mail und kein Verdacht.
    - `suspected`: keine gleiche E-Mail, aber ein Spiegel-Konto ohne Treffsicher-Partner passt über eins der Merkmale:
      gleicher normalisierter Name; Name mit Abstand höchstens 2 (Levenshtein, nur ab 6 Zeichen); gleicher Teil vor dem
      `@`; gleicher Teil vor dem `@` und Domain mit Abstand höchstens 2. Je Verdacht die Merkmale, die gegriffen haben.
    - `onlySpiegel`: Spiegel-Konten ohne Partner und ohne Verdacht (nur gezählt).
  - Die Typen der Zeilen entsprechen den CSV-Spalten unten.
- `apps/spiegel/src/lib/transfer/accountMatch.test.ts` (neu): erfundene Konten (keine echten Namen), Fälle: gleiche
  E-Mail mit anderer Schreibweise und Leerzeichen; vertauschter Vor- und Nachname; Umlaut gegen „ae“; Tippfehler in der
  Domain; gleicher Teil vor dem `@` bei anderer Domain; kurzer Name unter 6 Zeichen ohne Levenshtein-Treffer; ein
  Spiegel-Konto, das schon über die E-Mail vergeben ist, wird nicht zusätzlich als Verdacht genannt. Gegenprobe per
  Mutation: `normalizeEmail` testweise ohne `toLowerCase` muss einen Test rot machen.
- `apps/spiegel/scripts/transfer/treffsicher-accounts.sql` (neu): je Konto `id, name, email, role, is_active,
  created_at, sessions, sessions_with_result, last_session, favourites, own_disciplines, goals, routines`. Gezählt über
  `TrainingSession`, `Series`, `Discipline` (eigene, `ownerId` gesetzt), `Goal`, `ShotRoutine`; `favourites` =
  Einheiten mit `isFavourite`. Prisma-Bezeichner in Anführungszeichen.
- `apps/spiegel/scripts/transfer/spiegel-accounts.sql` (neu): je Konto `id, name, email, role, is_active,
  must_change_password, created_at, cards, last_card, consent` (letzter Stand der Sportpass-Zustimmung oder leer).
- `apps/spiegel/scripts/transfer/accounts-report.ts` (neu, `tsx`): liest `reports/tis-v1/treffsicher.csv` und
  `reports/tis-v1/spiegel.csv`, ruft `matchAccounts`, schreibt `reports/tis-v1/konten-<YYYY-MM-DD>.md` mit:
  1. Zählungen: Konten je App (aktiv, inaktiv), Einheiten gesamt, Einheiten mit Ergebnis, Favoriten (Konten, Einheiten),
     eigene Disziplinen, Ziele, Abläufe.
  2. „Für diese Konten fehlt ein Konto in Spiegel“: Name, E-Mail, aktiv, Einheiten, letzte Einheit; aktive mit Einheiten
     zuerst.
  3. „Hier passt die E-Mail vermutlich nicht“: je Verdacht beide Seiten mit Name, E-Mail, Merkmal.
  4. „In beiden Apps“: Anzahl, dazu nur die Paare mit abweichender Rolle oder abweichendem Aktiv-Status.
  5. „Nur in Spiegel“: Anzahl.
  Kurzer Absatz oben: Datenstand (Datum der CSV), dass der Bericht Personendaten enthält und nicht weitergegeben wird.
- `apps/spiegel/scripts/transfer/accounts.sh` (neu): `accounts.sh dev` führt beide SQL gegen den Dev-Postgres aus
  (`docker compose -f docker-compose.dev.yml exec -T db psql -U postgres -d <db> --csv`, SQL über stdin, siehe
  [[docker-exec-stdin]]), prüft, dass beide CSV mehr als eine Zeile haben, und ruft den Bericht. `accounts.sh prod`
  macht dasselbe über `ssh "$VPS_HOST"` mit `docker compose exec -T db psql …` im `VPS_REPO_PATH` aus
  `.vereinsheim.local`; diesen Modus führt nur der User aus. `bash -n` grün.
- `apps/spiegel/package.json`: Script `"transfer:accounts": "bash scripts/transfer/accounts.sh"`.

## Required Docs

- `vault/decisions/adr-033.md` (Abschnitt „Weg in vier Stufen“, Stufe 3: Konten, Zählungen)
- `vault/decisions/adr-029.md` (keine Personendaten im Repo)
- `apps/spiegel/CLAUDE.md`, `vault/conventions.md` §9 (Mutationsprobe)

## Test steps

1. `pnpm --filter spiegel test -- accountMatch` grün; Mutationsprobe wie oben (Datei vorher per `cp` sichern, nicht
   `git checkout`).
2. `pnpm --filter spiegel transfer:accounts dev` gegen die Prod-Kopie: beide CSV haben Zeilen, der Bericht liegt unter
   `reports/tis-v1/`.
3. Plausibilität: Summe der Gruppen `both + onlyTreffsicher + suspected(Treffsicher-Seite)` = Zahl der
   Treffsicher-Konten; Zahl der Einheiten im Bericht = `select count(*) from "TrainingSession"` in Treffsicher.
4. `git status` zeigt keine Datei aus `reports/`; `git grep` auf eine E-Mail-Domain aus dem Bericht findet nichts im
   Repo.
5. `pnpm check` grün.

## Verification

Die Kindsession meldet an die koordinierende Session: Pfad des Berichts, die Zählungen aus Abschnitt 1 und die Anzahl
je Gruppe (ohne Namen). Die koordinierende Session geht den Bericht mit dem User durch. Der Inhalt des Berichts geht
nicht in den Chat der Kindsession hinaus.
