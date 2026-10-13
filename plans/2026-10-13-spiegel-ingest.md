# Spiegel: Ingest-API, Kopplung und Adapter (SP-1.6 b)

## Kontext

Auftrag des Users (13. Oktober 2026, autonom): die Ingest-API mit der Authentifizierung, die die Brücke bedient;
dabei **die Last auf dem VPS berücksichtigen** (VPS S mit 2 GB, Spiegel mit Ziel `mem_limit` 256 MB, [[adr-026]]).
Grundlage: [[spiegel-ingest-pipeline]], [[spiegel-ingest-contract]], [[spiegel-bridge]], [[adr-027]], [[adr-031]],
Sonderfälle aus [[spiegel-edge-cases]] und die 31 Fälle in `packages/ssmdb2-cases` mit erwartetem Ergebnis.

Da sind schon: Vertrag Snapshot v1 (`parseSnapshot`), Ablage der Rohdaten (`storeSnapshot`), Schreiben einer Scheibe
mit Revisionen und Projektion (`writeRevision`), das Modell `Bridge` (nur Hash des Tokens). Es fehlt: Kopplung, Token-
Prüfung, die Endpunkte, der Adapter `meyton-ssmdb2@9`, Zustimmung am Server, Zustand der Scheibe, Admin-Seiten.

Nicht in diesem Plan: Aufträge (`commands`, SP-1.5/SP-1.7), Opt-in durch den Schützen selbst mit Bestätigung der
ersten Scheibe (SP-1.7 a), Freigabe von Modus 0 je Disziplin, Zuordnung der `Rangliste` zu einer Art, Deploy (SP-1.9).

## Last: woher sie kommt und was wir dagegen tun

**Die dominante Last sind nicht die Schüsse, sondern das Lebenszeichen.** `Scheiben.Zeitstempel` steigt alle 5 bis
10 s, solange ein Stand belegt ist; die Brücke liest dann die Scheibe neu und schickt nach zwei gleichen Lesungen einen
vollen Snapshot. Je belegtem Stand mit Opt-in also ein Snapshot alle 5 bis 10 s, auch in jeder Pause. Ohne Gegenmaßnahme
legt jeder davon eine neue Scheiben-Zeile, einen neuen Snapshot mit drei Id-Listen und einen Lauf des Adapters an
(geschätzt 1–2 KB und rund zehn Abfragen je Stück; bei drei Schützen mit Opt-in rund 6.000 Stände je Abend, über
1 GB im Jahr nur für Lebenszeichen).

- **D1 Lebenszeichen zusammenfassen** (Verfeinerung von [[adr-031]], dort als Änderung nachgetragen): Unterscheidet sich
  ein Snapshot vom letzten gespeicherten nur in `Scheiben.Zeitstempel`, legt Spiegel nichts Neues ab. Der letzte Stand
  bekommt seine neue Folgenummer, Beobachtungszeit und das Lebenszeichen (`RawSnapshot.lifesign`, `lifesignAt`), die
  Scheibe nur `lifesignAt` (und wird wieder `open`). Kein Adapter, keine Projektion. Erkannt über eine zweite Prüfsumme
  ohne das Lebenszeichen (`RawSnapshot.contentChecksum`), die Spiegel selbst rechnet; der Vertrag bleibt unverändert.
  Verloren geht nur die Folge der Zwischenwerte des Lebenszeichens (der erste steht in der Zeile, der letzte am Stand).
- **D2 Bytegrenze vor dem Parsen:** Der Körper wird als Strom gelesen und bei `MAX_BODY_BYTES` (Snapshots 4 MiB,
  Kopplung und Heartbeat 16 KiB) abgebrochen (413), `Content-Length` darüber gleich abgelehnt. Erst dann `JSON.parse`
  und der Vertrag. Der Vertrag selbst begrenzt den Speicher nicht ([[spiegel-ingest-contract]], „Grenzen“).
- **D3 Begrenzte Parallelität:** höchstens zwei Stapel gleichzeitig in Arbeit (Semaphor im Prozess), sonst 503 mit
  `Retry-After: 2`. So bleiben Pool (10 Verbindungen) und Arbeitsspeicher beschränkt, egal wie viele Brücken senden.
- **D4 Ratenbegrenzung je Brücke** (Token-Bucket im Speicher, ein Prozess): Snapshots 20 Anfragen in 10 s, Heartbeat
  6 je Minute, Zustand 6 je Minute; Kopplung je IP 5 in 15 min und insgesamt 30 in 15 min. Antwort 429 mit
  `Retry-After` in Sekunden; die Brücke wartet so lange (SF-58). Ein Neustart des Servers leert die Eimer; das ist
  gewollt, denn sie schützen die Last, nicht die Sicherheit (die liegt beim Token).
- **D5 Im Stapel nur der neueste Stand wird gedeutet:** Alle Snapshots eines Stapels werden in Folge der Folgenummer
  abgelegt (Zeilenversionen kosten wenig), der Adapter läuft je Scheibe nur für den neuesten.
- **D6 Zeilen nicht doppelt schicken:** `storeSnapshot` liest die vorhandenen Prüfsummen der Scheibe und legt nur
  fehlende Zeilen an, statt jeden Stand mit allen Zeilen per `skipDuplicates` an die Datenbank zu senden.
- **D7 Token-Prüfung billig:** Geräte-Tokens sind 32 zufällige Bytes; gespeichert und verglichen wird SHA-256 (kein
  bcrypt, das kostete je Anfrage rund 250 ms CPU). Bei dieser Entropie ist SHA-256 der übliche Weg. `lastSeenAt`
  schreibt Spiegel höchstens einmal je Minute.
- **D8 Heartbeat klein:** eine Zeile `Bridge`, Uhrabweichung nur als neue Zeile `ClockReading`, wenn sie sich um 30 s
  ändert oder die letzte älter als eine Stunde ist; dazu der Übergang der Zustände (D13) als zwei `UPDATE`.
- **D9 Messung:** ein Lastskript (`tools/ingest-load.ts`, nicht im Gate) spielt N belegte Stände mit Lebenszeichen und
  Schüssen gegen die laufende App; gemessen werden Antwortzeiten, Abfragen und der Speicher des Standalone-Builds im
  Container mit 256 MB (wie in `apps/spiegel/CLAUDE.md`).
- **Empfehlung an die Brücke** (in [[spiegel-bridge]] nachgetragen, SP-1.4): Änderungen nur am Lebenszeichen höchstens
  alle 30 s schicken. Spiegel verlässt sich nicht darauf (D1).

## Entscheidungen zur API

- **D10 Endpunkte v1** (Next Route Handler unter `src/app/api/ingest/v1/`, `proxy.ts` lässt `api/ingest` frei):
  - `POST /pair` — `{ code, name?, version }` → `{ token, bridgeId, site: { name, timeZone } }`. Einmal-Code aus
    Admin → Anlage, 15 min gültig, einmal einlösbar, nur gehasht gespeichert (`BridgePairing`).
  - `POST /snapshots` — Stapel v1 → `{ results: [{ index, scheibenId, outcome }] }`; der Stapel als Ganzes ungültig →
    400 mit den Fehlern des Vertrags (ohne Inhalt, SF-59).
  - `POST /heartbeat` — Version, Start des Laufs, Rückstau, letzter DB-Kontakt, Dauer der Abfragen, Uhrabweichung der
    Anlage, zurückgehaltene Scheiben je Modus, Fingerabdruck der Quelle → `{ serverTime }`.
  - `GET /state` — was die Brücke beim Start und danach alle paar Minuten braucht, weil sie keinen Zustand hat
    ([[adr-027]], 8. Oktober 2026): Epoche, gehashte SportpassIDs mit Zustimmung, Grabsteine und Löschsperren der
    letzten 60 Tage, Wasserstand.
  - Fehler einheitlich `{ error: { code, message } }`, Codes fest (`unauthorized`, `rate-limited`, `busy`, `too-large`,
    `invalid`, `epoch-unconfirmed`, …). `Authorization: Bearer <token>` für alles außer `pair`.
- **D11 Vertrag erweitert, additiv:** `packages/ingest-contract` bekommt Schemas für Kopplung, Heartbeat, Zustand und
  die Antworten (`src/v1/api.ts`), JSON-Schemas dazu und eingefrorene Beispiele, damit die Brücke in Go dieselben
  Dateien prüft. Snapshot v1 bleibt bit-gleich.
- **D12 Zustimmung am Server** ([[spiegel-privacy]]): Spiegel nimmt eine Scheibe nur an, wenn ihre `SportpassID` an
  dieser Anlage einem Konto mit bestätigter Zustimmung gehört (`SportpassConsent`), und verwirft den Rest **ungespeichert**
  (`outcome: "discarded"`). Ebenso Grabsteine und Löschsperren (SF-28) und Scheiben mit verdeckten Wertungsschüssen
  oder Modus 0 (SF-19, SF-20; doppelt zur Brücke). Bis SP-1.7 a pflegt der Admin die SportpassIDs eines Kontos auf der
  Seite des Kontos (nach der Zustimmung auf Papier); das Profil zeigt sie dem Schützen. Eine SportpassID gehört an einer
  Anlage höchstens einem Konto (mehrdeutige nie automatisch, [[spiegel-assignment]]).
- **D13 Zustand der Scheibe** ([[spiegel-bridge]], „Zustand statt Abschluss“): Jeder Stand mit neuem Lebenszeichen setzt
  `open` und `lifesignAt`. Beim Heartbeat: `open` → `resting` nach fünf Minuten ohne Lebenszeichen; `resting`/`open` →
  `final`, wenn ein neuer Lauf der Brücke begann (die Anlage war aus) oder nach zwölf Stunden. `complete` folgt
  `final` ohne `unvollstaendig` (SF-66: Rekorde erst bei endgültig).
- **D14 Epochen** (SF-23): Die erste Quelle einer Anlage entsteht mit dem ersten Snapshot. Eine unbekannte Epoche danach
  wird abgelehnt (`epoch-unconfirmed`), bis der Admin sie unter Anlage bestätigt.
- **D15 Logs ohne Inhalt** (SF-59): Die API schreibt nur Zahlen und Codes; ein Test schickt `Mustermann` durch jede
  Antwort und jeden Logaufruf.

## Entscheidungen zum Adapter `meyton-ssmdb2@9`

Eine reine Funktion `adaptSnapshot(snapshot, context)` in `apps/spiegel/src/lib/ingest/meyton-ssmdb2.ts` mit Tests gegen
alle 31 Fälle (erwartete Merkmale, Vollständigkeit, zählende Schüsse, Merkmale je Schuss aus `ExpectedCard`).

- **D16 Skalen je Feld** aus einer Tabelle ([[meyton-ssmdb2]], „Stolperfallen“): `x`, `y` 1/100 mm → µm,
  `Ring01` Zehntel, `Ring` in `Treffer` Zehntel (nur zum Abgleich), `Teiler001` 0,1 µm, Platzhalter 2147483647 = kein
  Abstand (SF-08), `Innenzehner`, `Wertung` = Anzeigeart (SF-74), `Serie`, `Stellung`, `Treffer`.
- **D17 Zeit:** `Zeitstempel` + `Millisekunden` als Ortszeit der Anlage (`Site.timeZone`) → UTC, als Paar, nie addiert
  (SF-32). Uhr des Stands (SF-73): solange das Lebenszeichen läuft, misst der Adapter den Versatz (Beobachtungszeit
  minus Lebenszeichen) und merkt ihn an der Scheibe (`Card.clockOffsetMs`); ab einer Minute Merkmal `uhr-abweichung`,
  ab fünf Minuten wird der Beginn und das Ende der Scheibe um ihn verschoben (SF-29). Die Schusszeiten bleiben die des
  Stands, damit Abstände stimmen und ein neu gemessener Versatz keine Korrektur der Schüsse vortäuscht. Ohne Messung an
  der Scheibe gilt die nächstgelegene Uhrabweichung der Anlage aus dem Heartbeat, ebenfalls erst ab fünf Minuten.
  Eine Schusszeit über einen Tag neben der Beobachtung ergibt `uhr-abweichung` (SF-30).
- **D18 Reihenfolge** (SF-30, SF-04): innerhalb einer Stellung nach `Treffer`, zwischen Probe und Wertung nach der Zeit;
  `seq` ist die Abgabefolge über die Scheibe. Beginn aus dem ersten Schuss (`Startzeit` ist im Training leer).
- **D19 Merkmale:** je Schuss `ueber-soll` (Platzhalter-Teiler), `verdaechtig` (x = y = 0, Teiler 0, nicht 10,9),
  `fehlschuss` (Ring01 0, nicht verdeckt), dazu die Gegenprobe aus `shot-core/verify` (ein einzelner abweichender Schuss
  wird `verdaechtig`). Je Scheibe `nur-probe`, `unvollstaendig`, `ueber-soll` aus `classifyCompleteness`,
  `disziplin-unbekannt` ohne Scheibenbild, `uhr-abweichung`; `korrigiert` setzt `writeRevision`, sobald eine neue
  Revision entsteht. `korrigiert` und `uhr-abweichung` bleiben an der Scheibe, auch wenn ein späterer Stand sie nicht
  mehr zeigt.
- **D20 Disziplin:** gesucht über (Anlage, DisziplinID, Name), sonst angelegt mit Scheibenbild aus `resolveTarget` und
  Familie aus `suggestFamily` (Familie über ihre Kennung, sonst angelegt); amtliche Wertung unbekannt, bis der Admin sie
  setzt.
- **D21 Art:** `Status` leer → Training, sonst Wettkampf (an der Vereinsanlage immer leer, [[meyton-ssmdb2]]); die Wahl
  des Schützen geht vor (`kindChoice`). Die Zuordnung der `Rangliste` folgt später.
- **D22 Quarantäne** (SF-25): fehlt eine erwartete Spalte oder hat sie einen anderen Typ, legt Spiegel die Rohdaten ab
  (wenn die Zustimmung prüfbar ist) und markiert den Snapshot (`RawSnapshot.quarantine`), ohne Scheibe. Fehlt
  `SportpassID`, ist nichts prüfbar: verworfen. Zusätzliche Spalten stören nicht.
- **D23 Zyklus** (SF-77): meldet `writeRevision` einen `CardIdentityConflictError`, versucht der Ablauf den nächsten
  Zyklus (höchstens drei).

## Schema

Bis SP-1.9 gibt es genau eine Migration (`apps/spiegel/CLAUDE.md`): Die Änderung ersetzt `…_init/migration.sql`. Die
Dev-Datenbank bekommt die Änderung additiv (`prisma migrate diff --from-config-datasource --to-schema … | prisma db
execute`), ohne Daten zu verlieren; ein `migrate reset` durch den User gleicht später die Historie an.

- `BridgePairing` (Anlage, Name, Hash des Codes, gültig bis, eingelöst, angelegt von)
- `Bridge` + `runStartedAt`, `lastHeartbeatAt`, `heartbeat Json?` (letzter Inhalt, ohne Personen), `clockOffsetMs`
- `ClockReading` (Anlage, gemessen, Versatz)
- `SportpassConsent` (Konto, Anlage, SportpassID, bestätigt; eindeutig je Anlage und SportpassID)
- `RawSnapshot` + `contentChecksum`, `lifesign`, `lifesignAt`, `adapterVersion`, `quarantine`
- `Card` + `lifesignAt`, `clockOffsetMs`
- `Source` + `confirmedAt` (bestätigte Epoche)

## Aufgaben

1. Vertrag: `src/v1/api.ts` (Kopplung, Heartbeat, Zustand, Antworten, Fehler), JSON-Schemas, Beispiele, Tests; Note
   [[spiegel-ingest-contract]] „Noch nicht im Vertrag“ → „API v1“.
2. `@vereinsheim/lib/format`: `zonedWallTimeMs(wall, timeZone)` (Ortszeit ohne Zone → UTC), mit Tests an der Umstellung.
3. Adapter `meyton-ssmdb2@9` als reine Funktion mit Tests gegen alle Fälle (Merkmale, Vollständigkeit, zählende Schüsse,
   Schuss-Merkmale, Zeit, Quarantäne bei fehlender Spalte und anderem Typ).
4. Schema und Migration ersetzen; Dev-Datenbank additiv nachziehen; `prisma generate`.
5. `storeSnapshot`: D1 (Lebenszeichen), D6 (nur fehlende Zeilen), Rückgabe des vorigen Lebenszeichens; Tests.
6. `writeRevision`: dauerhafte Merkmale, `korrigiert` bei neuer Revision, `lifesignAt`, `clockOffsetMs`; Tests.
7. Ablauf `ingestBatch` (`src/lib/ingest/ingest.ts`): Quelle und Epoche, Zustimmung, Grabsteine, verdeckt, Ablage, Adapter
   nur für den neuesten Stand je Scheibe, Zyklus; Tests mit den eingefrorenen Fällen gegen die Dev-Datenbank (Fall rein →
   Scheibe raus wie erwartet, auch Korrektur, Riss, Zyklus).
8. Kopplung, Token, Heartbeat (Zustände, Uhr), Zustand der Brücke (`src/lib/ingest/bridges.ts`); Tests.
9. HTTP-Schicht: Body mit Grenze, Ratenbegrenzung, Semaphor, Fehlerform, Route Handler, `proxy.ts`; Tests der Grenzen und
   ein Test gegen Inhalte in Antworten und Logs (SF-59).
10. Admin: Anlage (Name, Zeitzone, Epoche bestätigen), Brücken (koppeln mit Code, Liste mit Status, widerrufen),
    SportpassIDs am Konto; Profil zeigt die eigenen.
11. Lastskript und Messung (D9); Ergebnis in [[spiegel-db-schema]].
12. Doku: [[spiegel-ingest-pipeline]], [[spiegel-bridge]] (Empfehlung Lebenszeichen), [[adr-031]] (Änderung D1),
    [[spiegel-roadmap]] (SP-1.6 b), `apps/spiegel/CLAUDE.md`, Architekturkarte.

## Prüfung

- `pnpm check` grün; die neuen Tests laufen gegen die Dev-Datenbank.
- Abnahme SP-1.6: Snapshot rein → kanonische Scheibe raus, auch bei Korrektur und Epochenwechsel; Sonderfälle SF-01,
  SF-02, SF-03, SF-04, SF-07, SF-08, SF-09, SF-15, SF-21, SF-22, SF-23, SF-25, SF-26, SF-28, SF-29, SF-30, SF-31, SF-59,
  SF-67, SF-69 je mit dem Test, der sie abdeckt (Bericht).
- Gegenproben: Zustimmung testweise abgeschaltet → der Test der verworfenen Scheibe wird rot; Lebenszeichen-Weg
  abgeschaltet → der Test, dass ein Lebenszeichen keine Zeile anlegt, wird rot.
- Ende-zu-Ende über HTTP: koppeln, Zustand holen, Fall SF-03 als Folge von Stapeln senden, Heartbeat, Scheibe im Browser
  beim Konto mit der Zustimmung.
- Last: Messung nach D9 im Container.
