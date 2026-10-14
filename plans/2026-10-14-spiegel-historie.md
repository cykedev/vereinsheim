# Spiegel: ältere Scheiben nachladen, Meldung „nicht meine“ aufheben (P2d)

## Kontext

User, 14. Oktober 2026: „warum laden wir nach der bestätigung oder freigabe denn nicht alle alten scheiben, die wir so
verknüpft haben? das klingt doch sinnvoll“ und „ja, P2d kommt dazu“. Dazu aus P2b: Den Grabstein einer Meldung „nicht
meine“ soll ein Admin wieder aufheben können.

Heute bringt eine bestätigte Zustimmung nur, was die Brücke ohnehin liest: den laufenden Abend und beim Start alles ab
einem Tag vor dem Wasserstand (SF-55). Ältere Scheiben unter der Nummer, die Meyton noch hat (die Kopie vom 9. Oktober
2026 reicht zwei Jahre zurück), kommen nie. Der Dialog „Zustimmung bestätigen“ sagt das ehrlich („Ältere Scheiben kommen
nicht verlässlich vollständig …“). Ein Grabstein lässt sich nicht aufheben; P2b hat ihm dafür `sportpassId` mitgegeben.

Was es schon gibt:
- Die Brücke liest in jeder Runde `ScheibenID` und `Zeitstempel` aller Scheiben der Ablage (`readLifesigns`).
- Das Nachholen (Rang 3 in `watch.plan`) läuft nur, wenn 20 Minuten nichts läuft, und höchstens 50 Scheiben je Runde.
- Filter am Rand nach gehashter SportpassID, verdeckt und gesperrt.
- `GET /state` und Heartbeat lassen sich additiv erweitern, wie `blocked[].epoch` am 13. Oktober 2026.

Das ist der Teil „Historie nachladen“ aus SP-2.5, ohne PWA und ohne Namensvorschläge. SP-1.13 (Erstbefüllung aus einer
Kopie) wird damit überflüssig: Die Brücke holt dieselbe Historie selbst.

## Entscheidungen

- **D1 Auftrag je Zustimmung** (Schema, geschützter Pfad, T1 interaktiv): `SportpassConsent.historyLoadedAt
  DateTime?`. Eine aktive Zustimmung (bestätigt, nicht abgelehnt, Konto aktiv) ohne `historyLoadedAt` ist ein offener
  Auftrag. Eine neue Zustimmung beginnt ohne; ein Wiedereintragen nach Entfernen lädt also neu, was Spiegel schon hat,
  kommt als „unverändert“ zurück. Kein eigener Auftrags-Kanal: Die Aufträge aus SP-1.5 (QR, Fundbüro) bauen später einen;
  das Nachladen braucht nur den Zustand und den Heartbeat.
- **D2 Vertrag, additiv** (`packages/ingest-contract`, `v1/api.ts`, JSON-Schema neu erzeugt):
  - `stateResponseV1.history?: { id: int, sportpassHash: string }[]` (max. 1.000): die offenen Aufträge der Anlage, `id`
    ist die Id der Zustimmung.
  - `heartbeatV1.historyDone?: int[]` (max. 100): Aufträge, die die Brücke in diesem Lauf abgearbeitet hat.
  - Nur Ids und Hashes, nie Nummern (SF-59).
  - Beide optional: Eine Brücke ohne Nachladen und ein Spiegel ohne verstehen sich weiter.
- **D3 Sperren für die ganze Historie:** Solange ein Auftrag offen ist, liefert `GET /state` alle Grabsteine und
  Löschsperren der Anlage, nicht nur die der letzten 60 Tage. Sonst schickte die Brücke eine alte, als „nicht meine“
  gemeldete Scheibe hinaus, und erst Spiegel verwürfe sie. Was Spiegel nicht nehmen darf, verlässt das Gerät nicht.
- **D4 Brücke liest die SportpassID mit:** `readLifesigns` wird zu ``SELECT `ScheibenID`, `Zeitstempel`, `SportpassID`
  FROM `Scheiben` `` (eine feste Abfrage wie bisher). `Lifesign` bekommt `Sportpass *string`; die Brücke hasht ihn wie
  im Filter. Damit kennt sie je Auftrag die Scheiben, ohne sie ganz zu lesen.
- **D5 Nachladen wie das Nachholen:**
  - Eine Scheibe, deren Hash zu einem offenen Auftrag passt und die in diesem Lauf noch nicht gemeldet ist, bekommt
    Rang 3. Sie wird also nur gelesen, wenn 20 Minuten nichts läuft (SF-52), höchstens 50 je Runde, und die jüngsten
    zuerst.
  - Filter und Upload bleiben unverändert.
  - Ein Auftrag ist erledigt, wenn jede passende Scheibe gemeldet ist (`Delivered`: Spiegel hat geantwortet, oder der
    Filter hält sie zurück). Er geht dann im nächsten Heartbeat in `historyDone`.
  - Neue Aufträge greifen, sobald der Zustand neu geholt ist (alle paar Minuten), auch mitten im Lauf.
  - Ohne eigenen Speicher: Ein Neustart mitten im Nachladen beginnt von vorn. Spiegel antwortet dann „unverändert“.
- **D6 Spiegel vermerkt:** Der Heartbeat setzt `historyLoadedAt` für die genannten Ids, aber nur für Zustimmungen dieser
  Anlage, die aktiv und noch offen sind (Bedingung im `updateMany`). Eine fremde oder erfundene Id ändert nichts.
- **D7 Erste Scheibe ist die jüngste:** Mit der Historie warten womöglich Scheiben aus zwei Jahren. „Offen“ zeigt zur
  Kontrolle die **jüngste** wartende Scheibe je Nummer statt der ältesten, denn an den letzten Abend erinnert man sich.
  Dazu „und n weitere“ wie bisher. „Ja, meine“ und „Nicht meine“ gelten wie bisher für alle Wartenden der Nummer.
- **D8 Meldung „nicht meine“ aufheben (Admin):**
  - Am Konto (`/admin/users/[id]`, `SportpassSection`) steht je Zustimmung mit Grabsteinen der Nummer an dieser Anlage
    die Zeile „n Scheiben als ‚nicht meine‘ gemeldet“ und der Knopf „Meldungen aufheben“, mit `DecisionDialog`.
  - Die Action `liftNotMine(consentId)` (`adminActor`) löscht in einer Transaktion die Grabsteine
    (`reason = NOT_MINE`, Anlage und `sportpassId` der Zustimmung). An der Zustimmung setzt sie `historyLoadedAt` und
    `firstCardConfirmedAt` auf null.
  - Folge: Die Brücke holt die Scheiben nach, soweit Meyton sie noch hat. Sie kommen wartend an, der Schütze bestätigt
    sie in „Offen“. Bis dahin wartet auch jede neue Scheibe dieser Nummer. Das sagt der Dialog.
  - Ein Grabstein ohne `sportpassId` (vor P2b angelegt) lässt sich so nicht aufheben. Davon gibt es nur die zwei auf
    der Dev-Anlage.
- **D9 Texte** (`consequences.ts`, Wortlaut zur Freigabe):
  - `consentConfirm`, Was dann passiert:
    - „Läuft die Brücke gerade, kommen neue Scheiben mit dieser Nummer innerhalb weniger Minuten, sonst beim nächsten
      Training.“
    - „Auch ältere Scheiben mit dieser Nummer holt die Brücke nach, soweit Meyton sie noch hat, aber nur, wenn gerade
      niemand schießt.“
    - „Spiegel zeigt <Schütze> die jüngste zur Kontrolle; erst danach erscheinen die Scheiben im Konto.“
  - `consentConfirm`, Was nicht passiert: „Du siehst die Schüsse von <Schütze> nicht.“ · „Scheiben mit verdeckter
    Wertung gehen nie hinaus.“ · „Was <Schütze> gelöscht oder als ‚nicht meine‘ gemeldet hat, kommt nicht wieder.“ (statt
    „Ältere Scheiben kommen nicht verlässlich …“)
  - `notMineLift({ who, sportpassId, cards, consentActive })`, Knopf „Meldungen aufheben“, nicht destruktiv:
    - Worum: „<Schütze> hat <n Scheiben> unter der SportpassID <Nummer> als ‚nicht meine‘ gemeldet.“
    - Vorher prüfen: „Hat <Schütze> gesagt, dass es doch die eigenen waren? Sonst nicht aufheben.“
    - Was dann passiert: „Die Brücke darf diese Scheiben wieder schicken und holt sie nach, soweit Meyton sie noch hat,
      wenn gerade niemand schießt.“ · „<Schütze> sieht sie zuerst in ‚Offen‘ und bestätigt sie dort; bis dahin wartet
      auch jede neue Scheibe dieser Nummer.“ Bei nicht aktiver Zustimmung statt des ersten Satzes: „Sie kommen erst,
      wenn die Zustimmung wieder bestätigt ist.“
    - Was nicht passiert: „Du siehst die Schüsse von <Schütze> nicht.“
    - Rückgängig: „<Schütze> meldet sie in ‚Offen‘ wieder als ‚nicht meine‘.“
- **D10 Zustand sichtbar, keine Aufgabe** (D0 aus P2c):
  - Im Profil des Schützen je aktiver Zustimmung „Ältere Scheiben werden nachgeladen“ bzw. „ältere Scheiben nachgeladen
    am <Datum>“.
  - In der Admin-Übersicht an „Zustimmungen“ ab einem offenen Auftrag „n ältere Bestände werden nachgeladen; die Brücke
    holt sie, wenn niemand schießt.“
  - Im Papierkorb der Satz aus P2b: „Ein Admin kann eine Meldung ‚nicht meine‘ wieder aufheben.“

## Nicht in diesem Plan

- Aufträge über einen eigenen Kanal (`GET /commands`): QR, Fundbüro, Zeitraum (SP-1.5, nach dem Deploy mit dem QR-Weg).
- „Nicht meine“ an einer schon bestätigten Scheibe (SP-1.7 c). Bis dahin löscht der Schütze eine falsch zugeordnete
  ältere Scheibe selbst.
- Vorschau vor dem Nachladen und Namensvorschläge für Scheiben ohne SportpassID (Rest von SP-2.5).
- Aufheben einer eigenen Löschsperre (Holen per QR, SP-1.7 b).

## Required Docs

- `apps/spiegel/CLAUDE.md` (Ingest-API, Zustimmung, Erste Scheibe, Löschen mit Papierkorb, Kein Knopf ohne Folge,
  genau eine Migration), `apps/spiegel-bridge/CLAUDE.md` (Nur lesen, Erkennung, Filter wie Spiegel, Nachholen beim
  Start, Heartbeat)
- `vault/spiegel/spiegel-bridge.md`, `spiegel-ingest-contract.md`, `spiegel-ingest-pipeline.md`, `spiegel-assignment.md`
  (Nachladen), `spiegel-privacy.md`
- `vault/conventions.md` §9, §10

## Dateien

| Datei | Änderung |
| --- | --- |
| `apps/spiegel/prisma/schema.prisma`, `prisma/migrations/*_init/migration.sql` | T1: `SportpassConsent.historyLoadedAt` |
| `packages/ingest-contract/src/v1/api.ts`, `src/jsonSchema.ts` und erzeugte Schemata, Tests | T2 |
| `apps/spiegel/src/lib/ingest/bridges.ts` (+ Tests) | T3 Zustand, T4 Heartbeat |
| `apps/spiegel-bridge/internal/ssmdb2/reader.go`, `internal/watch/watch.go`, `internal/api/api.go`, `internal/run/run.go`, `internal/filter` (+ Go-Tests) | T5, T6 |
| `apps/spiegel/tools/bridge-e2e.ts` | T7 |
| `apps/spiegel/src/lib/db/reads.ts` (`pendingGroups`) (+ Test) | T8 |
| `apps/spiegel/src/lib/admin/consequences.ts`, `overview.ts`, `src/lib/consent/queries.ts`, `src/components/profile/SportpassConsents.tsx`, `src/components/profile/TrashScreen.tsx` (+ Tests) | T9 |
| `apps/spiegel/src/lib/consent/actions.ts` (`liftNotMine`), `src/lib/consent/queries.ts` (`consentsOfUser`), `src/components/admin/SportpassSection.tsx` (+ Tests) | T10 |
| `apps/spiegel/CLAUDE.md`, `apps/spiegel-bridge/CLAUDE.md`, `vault/spiegel/spiegel-bridge.md`, `spiegel-ingest-contract.md`, `spiegel-ingest-pipeline.md`, `spiegel-assignment.md`, `spiegel-roadmap.md` (SP-2.5 Teil, SP-1.13 überflüssig) | T11 |

## Aufgaben

Ablauf: **T1 interaktiv** (Schema), danach **T2–T11 autonom** (ADR-023).

1. **T1 Schema (interaktiv):** `historyLoadedAt DateTime? @db.Timestamptz(3)` an `SportpassConsent`. Die
   Init-Migration neu erzeugen und im Wegwerf-Postgres auf leeren Diff prüfen. Die Dev-Datenbank additiv nachziehen:
   `ALTER TABLE "SportpassConsent" ADD COLUMN "historyLoadedAt" TIMESTAMPTZ(3);`. Dann `prisma generate` und den
   Dev-Server neu starten (er hält sonst den alten Client, gelernt in P2b). Gate, Commit.
2. **T2 Vertrag:** `history` und `historyDone` nach D2, je mit `.meta`-Beschreibung. JSON-Schema neu erzeugen. Tests:
   alter Zustand ohne `history` gültig, neuer gültig, Hash-Muster, Höchstzahlen, `historyDone` nur ganze Zahlen ≥ 1.
3. **T3 Zustand** (`bridgeState`): Test zuerst.
   - `history` enthält genau die aktiven Zustimmungen der Anlage mit aktivem Konto und ohne `historyLoadedAt`, mit dem
     Hash wie `sportpass.hashes`. Abgelehnte, zurückgegebene, deaktivierte, fremde Anlage und schon geladene fehlen.
   - Mit offenem Auftrag kommen auch Sperren älter als 60 Tage, ohne Auftrag nicht.
   - Gegenprobe: Filter auf `historyLoadedAt` streichen → rot.
4. **T4 Heartbeat:** Test zuerst. `historyDone: [id]` setzt `historyLoadedAt` nur für aktive, offene Zustimmungen
   dieser Anlage. Eine fremde Anlage, eine abgelehnte und eine unbekannte Id ändern nichts; ein zweites Melden ändert den
   Zeitpunkt nicht. `http.test.ts`: das Feld geht durch die Grenzen.
5. **T5 Brücke liest die Nummer:**
   - `readLifesigns` nach D4, `Lifesign.Sportpass`.
   - Replay-Tests unverändert grün (Snapshots bit-gleich).
   - Neuer Test: Eine Scheibe ohne SportpassID ergibt `nil`.
6. **T6 Brücke lädt nach:**
   - `api.State.History`, `api.Heartbeat.HistoryDone` (`omitempty`).
   - Im Watcher `SetHistory(requests)` und Rang 3 für passende, noch nicht gemeldete Scheiben; `HistoryDone()` liefert
     erledigte Ids einmal.
   - `run` übergibt nach jedem Zustand die Aufträge und hängt die erledigten an den nächsten Heartbeat.
   - Go-Tests mit einer Ablage im Speicher:
     - Während etwas läuft, wird nichts nachgeladen; danach höchstens 50 je Runde, die jüngsten zuerst.
     - Gesperrte und verdeckte werden gemeldet, aber nicht geschickt, und zählen als erledigt.
     - Fertig erst nach der letzten Antwort von Spiegel; ein Auftrag ohne Scheiben ist sofort erledigt.
     - Ein neuer Auftrag mitten im Lauf greift.
   - Gegenprobe: die Bedingung „niemand schießt“ für Rang 3 aus dem Nachladen nehmen → rot.
7. **T7 Ende zu Ende** (`bridge-e2e`):
   - Neuer Fall mit einer Scheibe vor dem Startfenster (Tage zurück) und erledigter Zustimmung.
   - Die Brücke holt sie, `historyLoadedAt` ist danach gesetzt, die Scheibe wartet in „Offen“.
   - Ohne Auftrag (`historyLoadedAt` gesetzt) kommt sie nicht.
8. **T8 Offen zeigt die jüngste:** `pendingGroups` nimmt je Gruppe die jüngste (`startedAt desc`). Test: drei
   Wartende, gezeigt wird die neueste, `more` = 2. Die Bestätigung gilt weiter für alle.
9. **T9 Texte und Zustand:**
   - `consentConfirm` und `notMineLift` nach D9, Wortlaut-Tests.
   - Zeile in `overviewModel` (`historyPending: number`) mit Test.
   - `consentRows` liefert `historyLoadedAt`, das Profil zeigt den Stand nach D10 (Markup-Test).
   - Der Satz im Papierkorb (Markup-Test).
10. **T10 Aufheben:**
    - `liftNotMine` mit Tests zuerst: nur Admin; nur Grabsteine `NOT_MINE` dieser Anlage und Nummer, andere bleiben.
      Setzt `historyLoadedAt` und `firstCardConfirmedAt` auf null. Zweimal → „Schon aufgehoben.“, ohne Grabsteine →
      Fehlertext. Ein Datenbankfehler wird zu Text.
    - `consentsOfUser` liefert je Zustimmung die Zahl der Grabsteine. `SportpassSection` zeigt Zeile und Knopf mit
      `DecisionDialog(notMineLift)`. Markup-Test: Knopf nur ab einem Grabstein.
11. **T11 Doku:** Scope-Notizen beider Apps (Nachladen, Vertrag, Aufheben, „Offen“ zeigt die jüngste), Vault
    (Brücke: Nachladen; Vertrag: `history`, `historyDone`; Pipeline; Zuordnung; Roadmap: SP-2.5 Teil erledigt, SP-1.13
    überflüssig).

## Testschritte

- `pnpm check` grün nach jedem Task (inkl. `go vet`, `gofmt`, `go test`, `go build`).
- `pnpm --filter spiegel-bridge replay` nach T5 und T6, `pnpm --filter spiegel bridge-e2e` nach T7 (nach
  `pnpm --filter spiegel build`).
- Mutationsproben aus T3 und T6, dazu D6: Bedingung „diese Anlage“ im Heartbeat streichen → rot.
- Browser (Dev-Server :3002, Hintergrund-Tab, eigene Testdaten, nie die Daten des Users):
  - Dialog „Zustimmung bestätigen“ mit den neuen Sätzen.
  - Admin-Übersicht mit „… werden nachgeladen“.
  - Profil mit dem Stand des Nachladens.
  - Am Konto eines Testschützen mit eigenem Grabstein: „Meldungen aufheben“ mit Dialog und Wirkung (Grabstein weg,
    Zustimmung wartet wieder auf die erste Scheibe).
  - Telefon 375 px, keine Konsolenfehler.
- `pruefen --start` (nach Rückfrage beim User wegen `seed:own --demo`).

## Verifikation

Validierungsbericht `reports/2026-10-14-spiegel-historie.md` mit Gate-Ausgabe, Replay, Ende zu Ende, Mutationsproben,
Browser und „nicht belegt“; danach `/review` gegen `main`.
