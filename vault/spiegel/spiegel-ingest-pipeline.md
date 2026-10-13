---
id: spiegel-ingest-pipeline
type: subsystem
title: "Spiegel — Ingest-API und Normalisierung"
aliases: [ingest, ingest-api, normalisierung, rohdaten-pipeline]
keywords: [ingest, api, endpunkt, geräte-token, device token, kopplung, pairing, kopplungscode, heartbeat, zustand der brücke, ratenbegrenzung, rate limit, retry-after, bytegrenze, last, vps, lebenszeichen, lifesign, idempotenz, snapshot, rohdatensatz, raw store, normalisierung, adapter, meyton-ssmdb2, skalen, zeitzone, epoche, revision, projektion, neu berechnen, vertrag, contract, json schema, folgenummer, kompaktierung, probe sammeln, merkmale, zustimmung, vertragsversion]
subsystem_of: ["[[spiegel-architecture]]"]
governed_by: ["[[adr-027]]"]
relates_to: ["[[spiegel-ingest-contract]]", "[[spiegel-bridge]]", "[[spiegel-data-model]]", "[[meyton-ssmdb2]]", "[[spiegel-edge-cases]]"]
---

**TL;DR** Die Brücke liefert Snapshots an eine kleine, gesicherte Ingest-API. Spiegel speichert sie unverändert als Rohdatensatz, deutet sie mit einem versionierten Adapter (`meyton-ssmdb2@9`) ins kanonische Modell und berechnet die Kennzahlen. Jeder Schritt rechts der Rohdaten ist wiederholbar.

## Endpunkte (Vertrag v1, `packages/ingest-contract`)

Gebaut in SP-1.6 b (13. Oktober 2026, Plan `plans/2026-10-13-spiegel-ingest.md`): `apps/spiegel/src/app/api/ingest/v1/`,
die Logik in `src/lib/ingest/` (`http.ts`, `bridges.ts`, `ingest.ts`, Adapter `meyton-ssmdb2.ts`). Schemas, JSON-Schemas
und eingefrorene Beispiele der Anfragen und Antworten liegen im Vertrag (`@vereinsheim/ingest-contract/api`,
[[spiegel-ingest-contract]]).

| Endpunkt | Zweck |
|---|---|
| `POST /api/ingest/v1/pair` | Kopplung mit Einmal-Code (15 min, einmal), liefert Geräte-Token |
| `POST /api/ingest/v1/snapshots` | Stapel von Snapshots (1 bis 50, höchstens 4 MiB); Ergebnis je Snapshot |
| `POST /api/ingest/v1/heartbeat` | Version, Beginn des Laufs, Rückstau, letzter DB-Kontakt, Uhrabweichung, Zurückgehaltenes |
| `GET /api/ingest/v1/state` | was die Brücke ohne eigenen Zustand braucht: Epoche, gehashte SportpassIDs mit Zustimmung, Grabsteine und Löschsperren, Wasserstand |
| `GET /api/ingest/v1/commands`, `POST …/commands/<id>/result` | Aufträge (Scheibe per ID, Fundbüro, Nachladen, Diagnose): noch nicht gebaut (SP-1.5, SP-1.7) |

Ergebnis je Snapshot: `stored`, `unchanged`, `lifesign` (nur das Lebenszeichen bewegt), `stale`, `future`,
`discarded` (mit Grund `no-consent`, `blocked`, `hidden`), `quarantined`, `epoch-unconfirmed`. Fehler haben feste Codes
und feste Sätze (`unauthorized`, `rate-limited`, `busy`, `too-large`, `invalid`, `invalid-code`, …), bei `invalid` die
Fehler des Vertrags ohne Inhalt.

**Sicherheit:** Geräte-Token und Kopplungscodes nur als SHA-256 gespeichert (zufällig und lang genug, bcrypt kostete
je Anfrage nur CPU), je Anlage, widerrufbar unter Admin → Anlage und Brücken. Ein gestohlener Token kann nur Daten für
diese Anlage einliefern und den Zustand lesen (gehashte SportpassIDs, ScheibenIDs der Sperren, keine Namen). `proxy.ts`
lässt `api/ingest` ohne Sitzung durch; jeder Endpunkt außer `pair` verlangt den Token.

**Last** (der VPS hat 2 GB, Spiegel ein Ziel von 256 MB; [[adr-026]]): Grenzen, bevor gerechnet wird.
- Bytegrenze vor dem Parsen, auch beim Lesen des Stroms (4 MiB für Stapel, 16 KiB sonst), nur `application/json`.
- Token-Bucket je Brücke (Snapshots 20 in 10 s, Heartbeat und Zustand je 6 in der Minute), Kopplung je Adresse 5 und
  insgesamt 30 in 15 Minuten; Antwort 429 mit `Retry-After`.
- Höchstens zwei Stapel gleichzeitig, sonst 503 mit `Retry-After: 2`.
- Der Adapter läuft je Scheibe nur für den neuesten Stand eines Stapels; reine Lebenszeichen legen nichts ab (unten).
  Bewusst in Kauf genommen: Kämen ein Stand und seine Korrektur im selben Stapel, entstünde keine zweite Revision. Die
  Brücke hat keinen Zustand und schickt nach einem Ausfall nur den jetzigen Stand, nie eine Folge alter Stände.
- `lastSeenAt` höchstens einmal je Minute, Uhrabweichung nur bei Änderung.
- Gemessen mit `pnpm --filter spiegel ingest-load` ([[spiegel-db-schema]], „Last der Ingest-API“).

**Zustimmung doppelt geprüft:** Spiegel nimmt eine Scheibe nur an, wenn ihre SportpassID an dieser Anlage einem aktiven
Konto mit bestätigter Zustimmung gehört (`SportpassConsent`), und verwirft den Rest ungespeichert (`no-consent`). Ein
Fehler in der Brücke kann so nichts durchreichen ([[spiegel-privacy]]). Bis SP-1.7 a trägt der Admin die SportpassID am
Konto ein, nach der Zustimmung auf Papier; eine SportpassID gehört an einer Anlage höchstens einem Konto. Scheiben mit
Grabstein oder Löschsperre (Beginn in 30 Tagen um die Beobachtung) nimmt Spiegel nie wieder an (SF-28), Scheiben mit
einem verdeckten Schuss oder Anzeigeart 0 auch nicht (SF-19, SF-20; doppelt zur Brücke). Aufträge (QR-Weg) kommen mit
SP-1.7.

**Fehler beim Deuten** (Review, 13. Oktober 2026): Jede Scheibe eines Stapels wird für sich geschrieben. Ein Fehler, der
bei jeder Wiederholung wiederkäme, legt den Stand in Quarantäne; ein unerwarteter (Datenbank) beendet die Anfrage mit 500,
nachdem die übrigen geschrieben sind, und beim nächsten Senden deutet Spiegel den gespeicherten, aber nie gedeuteten Stand
nach. **Wechselt an einer Scheibe die SportpassID oder der Besitzer**, schreibt Spiegel nichts und legt den Stand in
Quarantäne; sonst landeten fremde Schüsse beim ersten Besitzer. Die Uhr des Stands misst der Adapter nur, wenn der vorige
Stand höchstens 60 s vorher gesehen wurde; nach einem Ausfall der Brücke mäße er sonst die Dauer des Ausfalls.

**Logs ohne Inhalt:** Die API schreibt nur Ereignis, Zahlen und feste Codes; unerwartete Fehler nur mit ihrem Namen (die
Meldung von Prisma enthält Werte). Ein Test schickt `Mustermann` durch jede Fehlerart und prüft Antworten und Logs
(SF-59, `src/lib/ingest/http.test.ts`).

**Vertragsversionen:** Brücken im Feld werden nicht gleichzeitig aktualisiert, bei anderen Vereinen schon gar nicht.
Spiegel nimmt deshalb mindestens die vorige Vertragsversion an, und Änderungen am Vertrag sind nur additiv (SF-69).

**Epochen** (SF-23): Die erste Epoche einer Anlage gilt mit dem ersten Snapshot. Eine neue legt Spiegel unbestätigt an
und nimmt aus ihr nichts an (`epoch-unconfirmed`), bis der Admin sie unter Anlage und Brücken bestätigt.

**Zustand der Scheibe** ([[spiegel-bridge]], „Zustand statt Abschluss“): Jeder Stand mit bewegtem Lebenszeichen setzt
`open` und `lifesignAt` (Beobachtungszeit). Der Heartbeat schaltet weiter: offen → ruhend nach fünf Minuten ohne
Lebenszeichen, → endgültig nach zwölf Stunden oder wenn ein neuer Lauf der Brücke begann (die Anlage war aus).
`complete` gilt erst endgültig und ohne `unvollstaendig`; erst dann zählt die Scheibe für Rekorde (SF-66).

## Rohdaten

Jeder Snapshot bleibt inhaltlich unverändert erhalten, mit Prüfsumme, Empfangszeit, Brücken-Version und Adapter-Version; gespeichert wird er als Zeilenversionen (unten). Gleiche Prüfsumme bedeutet: nichts zu tun. Ein Snapshot mit kleinerer Folgenummer als der gespeicherte ändert nichts (SF-26).

**Lebenszeichen ohne neue Zeilen** (13. Oktober 2026, Verfeinerung von [[adr-031]]): `Scheiben.Zeitstempel` steigt alle
5 bis 10 s, solange ein Stand belegt ist, und die Brücke schickt dann jedes Mal den ganzen Stand. Unterscheidet sich ein
Snapshot vom letzten gespeicherten nur darin (Prüfsumme ohne das Lebenszeichen, `RawSnapshot.contentChecksum`), vermerkt
Spiegel Folgenummer, Beobachtungszeit und Lebenszeichen am letzten Stand und öffnet die Scheibe wieder, sonst nichts:
keine Zeile, kein Adapter, keine Projektion. Verloren geht nur die Folge der Zwischenwerte des Lebenszeichens. Im
Lastlauf waren es 81 % der Stände ([[spiegel-db-schema]], „Last der Ingest-API“).

**Zeilenversionen statt Kopien:** Live kommt mit jedem Schuss ein voller Snapshot; bei 90 Schuss wären das rund 4.000 Trefferzeilen und 90-mal der Name. Spiegel speichert deshalb jede Zeile (Scheibe, Serie, Treffer) nur, wenn sie neu ist oder sich ändert, und ein Snapshot ist eine Liste von Verweisen. Der Speicher wächst linear mit den Schüssen, und auch verschwundene Zeilen bleiben belegt. Ein Snapshot, der nur Zeilen anhängt, bleibt in derselben Revision; erst eine geänderte oder fehlende Wertungszeile ergibt eine neue (SF-67).

**Prüfsumme** über eine kanonische Serialisierung, die Brücke und Spiegel gleich berechnen, auch in verschiedenen Sprachen; der Vertrag enthält Testvektoren (SF-27). Format, kanonische Form und Versionsregel: [[spiegel-ingest-contract]].

## Normalisierung (Adapter `meyton-ssmdb2@9`)

Gebaut als reine Funktion `adaptSnapshot` (`apps/spiegel/src/lib/ingest/meyton-ssmdb2.ts`), abgenommen an allen 31
Fällen aus `packages/ssmdb2-cases` (Merkmale, Vollständigkeit, zählende Schüsse, Merkmale je Schuss). Was gebaut ist:
Skalen je Feld, Zeit als Paar aus Sekunde und Millisekunden (`zonedWallTimeMs`), Abgabefolge, Merkmale je Schuss mit
Gegenprobe, Vollständigkeit, `disziplin-unbekannt`, Uhr des Stands (Versatz am laufenden Lebenszeichen, ab einer Minute
Merkmal, ab fünf Minuten Beginn und Ende verschoben, Schusszeiten bleiben), Uhrsprung, Zustand, Quarantäne bei fehlender
oder umgetypter Spalte, Art aus `Status`. `korrigiert` und `uhr-abweichung` hält `writeRevision` dauerhaft an der
Scheibe. Eine umgeschaltete Anzeigeart ist keine Korrektur (SF-74, `shotChange`). Die Disziplin legt das Einlesen mit
Scheibenbild und Familie aus dem Fachkern an, die amtliche Wertung bleibt unbekannt, bis der Admin sie setzt. Seit dem
13. Oktober 2026 schließt der Fachkern Schüsse über der Soll-Zahl aus Lage und Abstand aus (SF-08), und das Einlesen legt
jede `Rangliste` als `Ranking` an, deren Art der Admin zuordnet.

- **Skalen je Feld** aus einer Tabelle, festgenagelt durch Tests am echten Datensatz ([[meyton-ssmdb2]]).
- **Zeit:** Ortszeit ohne Zone plus Millisekunden → UTC mit der Zeitzone der Anlage; der Rohwert bleibt erhalten. Die Sitzungs-Zeitzone der Brücke kommt mit, falls `Zeitstempel` ein `TIMESTAMP` ist (SF-31). Die Uhrabweichung aus dem Heartbeat wird mit ihrem Messzeitpunkt gespeichert und erst ab fünf Minuten ausgeglichen, jeweils mit der nächstgelegenen Messung (SF-29).
- **Reihenfolge:** innerhalb einer Stellung nach `Treffer`, zwischen Probe und Wertung nach der Zeit. Probe kann auch nach Wertungsschüssen kommen (SF-04). Widersprechen sich Nummer und Zeit, gilt die Nummer, und die Scheibe bekommt das Merkmal `uhr-abweichung` (SF-30).
- **Probe wie am Ausdruck:** Die Scheibe ist der jüngste stabile Stand; Spiegel sammelt keine Probe über Snapshots ([[adr-027]], Entscheidung vom 9. Oktober 2026). Bei Wertung gibt es keine Probe, nach einem Neustart der Probe nur den letzten Block.
- **Disziplin und Scheibenbild** aus der DisziplinID ([[spiegel-target-library]]).
- **Epochen:** Schlüssel ist Quelle + Epoche + ScheibenID. Eine neue Epoche ist ein Ereignis der ganzen Quelle (Ablage geleert, neuer Server), das die Brücke erkennt und ein Admin bestätigt. Eine einzelne geänderte Scheibe ist eine Korrektur, keine neue Epoche, und der Beginn taugt nicht als Merkmal: Er verschiebt sich, wenn die Probe verschwindet (SF-23).
- **Unbekanntes Schema:** Zusätzliche Spalten stören den Adapter nicht. Fehlt eine erwartete Spalte oder ändert sich ihr Typ, kommen die Rohdaten in Quarantäne, bis ein Adapter sie kennt, statt mit der alten Version gedeutet zu werden (SF-25).
- **Revisionen:** ein geänderter Snapshot erzeugt eine neue Revision der kanonischen Scheibe; die Historie bleibt. Über Revisionen hinweg erkennt Spiegel einen Schuss an seinem Fingerabdruck aus Zeit, Millisekunden und Lage, nicht an der Nummer; Notizen und Teilungen hängen daran, Kennzahlwerte an der Revision (SF-22).
- **Merkmale und Zustand** setzt die Normalisierung an die Scheibe: `nur-probe`, `unvollstaendig`, `korrigiert`, `disziplin-unbekannt` und weitere ([[spiegel-edge-cases]]).
- **Verdeckte Wertung:** Werte ohne Freigabe bleiben leer.
- **Gegenprobe:** Spiegel rechnet die Zehntelwerte aus x/y nach. Weichen alle Schüsse ab, passt das Scheibenbild nicht (falsche Disziplin, Achsen). Weicht ein einzelner ab, ist der Schuss verdächtig, etwa ein Platzhalter (x = y = 0, Teiler 0) oder ein Handeintrag; er wird markiert statt gezeichnet und zählt für keinen Rekord (SF-15, SF-16).

## Projektion

Nach jeder Änderung berechnet Spiegel die Kennzahlen der Scheibe neu ([[spiegel-metrics]]). Steigt die Version einer Kennzahl, werden ihre gespeicherten Werte neu berechnet: ohne Hintergrunddienst beim Lesen (Versionsprüfung) und nach einem Deploy einmal für alle per CLI-Befehl (SF-68).

## Erst einfach

Version 1 normalisiert synchron im Ingest-Request (kleine Stapel). Eine Warteschlange im Server kommt erst, wenn Last oder Laufzeit es verlangen; die Rohdaten machen den Umbau jederzeit möglich.
