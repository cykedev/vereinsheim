---
id: spiegel-ingest-pipeline
type: subsystem
title: "Spiegel — Ingest-API und Normalisierung"
aliases: [ingest, ingest-api, normalisierung, rohdaten-pipeline]
keywords: [ingest, api, endpunkt, geräte-token, device token, idempotenz, snapshot, rohdatensatz, raw store, normalisierung, adapter, meyton-ssmdb2, skalen, zeitzone, epoche, revision, projektion, neu berechnen, vertrag, contract, json schema, folgenummer, kompaktierung, probe sammeln, merkmale, zustimmung, vertragsversion]
subsystem_of: ["[[spiegel-architecture]]"]
governed_by: ["[[adr-027]]"]
relates_to: ["[[spiegel-ingest-contract]]", "[[spiegel-bridge]]", "[[spiegel-data-model]]", "[[meyton-ssmdb2]]", "[[spiegel-edge-cases]]"]
---

**TL;DR** Die Brücke liefert Snapshots an eine kleine, gesicherte Ingest-API. Spiegel speichert sie unverändert als Rohdatensatz, deutet sie mit einem versionierten Adapter (`meyton-ssmdb2@9`) ins kanonische Modell und berechnet die Kennzahlen. Jeder Schritt rechts der Rohdaten ist wiederholbar.

## Endpunkte (Vertrag v1, `packages/ingest-contract`)

| Endpunkt | Zweck |
|---|---|
| `POST /api/ingest/v1/pair` | Kopplung mit Einmal-Code, liefert Geräte-Token |
| `POST /api/ingest/v1/snapshots` | Stapel von Snapshots (Scheibe + Serien + Treffer mit allen Spalten, Prüfsumme, Quelle, Epoche, Folgenummer, Beobachtungszeit, Sitzungs-Zeitzone) |
| `GET /api/ingest/v1/commands` | offene Aufträge abholen (Scheibe per ID, Fundbüro-Liste, Nachladen, Diagnose) |
| `POST /api/ingest/v1/commands/<id>/result` | Antwort auf einen Auftrag |
| `POST /api/ingest/v1/heartbeat` | Version, Rückstau, letzter DB-Kontakt, Uhrabweichung |

Sicherheit: Geräte-Token (nur gehasht gespeichert, je Anlage, widerrufbar), Ratenbegrenzung, Größenlimits je Anfrage, strikte Schema-Prüfung. Ein gestohlener Token kann nur Daten für diese Anlage einliefern, nichts lesen.

**Zustimmung doppelt geprüft:** Spiegel nimmt eine Scheibe nur an, wenn sie zu einem Opt-in oder einem offenen Auftrag passt, und verwirft den Rest ungespeichert. Ein Fehler in der Brücke kann so nichts durchreichen ([[spiegel-privacy]]). Scheiben mit Grabstein (abgelehnt oder gelöscht) nimmt Spiegel nie wieder an (SF-28).

**Logs ohne Inhalt:** Validierungsfehler protokollieren nie den Snapshot selbst, denn darin stehen Namen; ein Test prüft, dass kein `Nachname` im Log landet (SF-59).

**Vertragsversionen:** Brücken im Feld werden nicht gleichzeitig aktualisiert, bei anderen Vereinen schon gar nicht. Spiegel nimmt deshalb mindestens die vorige Vertragsversion an, und Änderungen am Vertrag sind nur additiv (SF-69).

## Rohdaten

Jeder Snapshot bleibt inhaltlich unverändert erhalten, mit Prüfsumme, Empfangszeit, Brücken-Version und Adapter-Version; gespeichert wird er als Zeilenversionen (unten). Gleiche Prüfsumme bedeutet: nichts zu tun. Ein Snapshot mit kleinerer Folgenummer als der gespeicherte ändert nichts (SF-26).

**Zeilenversionen statt Kopien:** Live kommt mit jedem Schuss ein voller Snapshot; bei 90 Schuss wären das rund 4.000 Trefferzeilen und 90-mal der Name. Spiegel speichert deshalb jede Zeile (Scheibe, Serie, Treffer) nur, wenn sie neu ist oder sich ändert, und ein Snapshot ist eine Liste von Verweisen. Der Speicher wächst linear mit den Schüssen, und auch verschwundene Zeilen bleiben belegt. Ein Snapshot, der nur Zeilen anhängt, bleibt in derselben Revision; erst eine geänderte oder fehlende Wertungszeile ergibt eine neue (SF-67).

**Prüfsumme** über eine kanonische Serialisierung, die Brücke und Spiegel gleich berechnen, auch in verschiedenen Sprachen; der Vertrag enthält Testvektoren (SF-27). Format, kanonische Form und Versionsregel: [[spiegel-ingest-contract]].

## Normalisierung (Adapter `meyton-ssmdb2@9`)

- **Skalen je Feld** aus einer Tabelle, festgenagelt durch Tests am echten Datensatz ([[meyton-ssmdb2]]).
- **Zeit:** Ortszeit ohne Zone plus Millisekunden → UTC mit der Zeitzone der Anlage; der Rohwert bleibt erhalten. Die Sitzungs-Zeitzone der Brücke kommt mit, falls `Zeitstempel` ein `TIMESTAMP` ist (SF-31). Die Uhrabweichung aus dem Heartbeat wird mit ihrem Messzeitpunkt gespeichert und erst ab fünf Minuten ausgeglichen, jeweils mit der nächstgelegenen Messung (SF-29).
- **Reihenfolge:** innerhalb einer Stellung nach `Treffer`, zwischen Probe und Wertung nach der Zeit. Probe kann auch nach Wertungsschüssen kommen (SF-04). Widersprechen sich Nummer und Zeit, gilt die Nummer, und die Scheibe bekommt das Merkmal `uhr-abweichung` (SF-30).
- **Probe wird gesammelt:** Probeschüsse, die in einem späteren Snapshot fehlen, bleiben erhalten; wiedererkannt werden sie an Zeit und Lage, nicht an der Nummer. Wertungsschüsse folgen immer dem neuesten Snapshot, damit Korrekturen greifen (SF-03, SF-21).
- **Disziplin und Scheibenbild** aus der DisziplinID ([[spiegel-target-library]]).
- **Epochen:** Schlüssel ist Quelle + Epoche + ScheibenID. Eine neue Epoche ist ein Ereignis der ganzen Quelle (Ablage geleert, neuer Server), das die Brücke erkennt und ein Admin bestätigt. Eine einzelne geänderte Scheibe ist eine Korrektur, keine neue Epoche, und der Beginn taugt nicht als Merkmal: Er verschiebt sich, wenn die Probe verschwindet (SF-23).
- **Unbekanntes Schema:** Zusätzliche Spalten stören den Adapter nicht. Fehlt eine erwartete Spalte oder ändert sich ihr Typ, kommen die Rohdaten in Quarantäne, bis ein Adapter sie kennt, statt mit der alten Version gedeutet zu werden (SF-25).
- **Revisionen:** ein geänderter Snapshot erzeugt eine neue Revision der kanonischen Scheibe; die Historie bleibt. Über Revisionen hinweg erkennt Spiegel einen Schuss an seinem Fingerabdruck aus Zeit, Millisekunden und Lage, nicht an der Nummer; Notizen und Teilungen hängen daran, Kennzahlwerte an der Revision (SF-22).
- **Merkmale und Zustand** setzt die Normalisierung an die Scheibe: `nur-probe`, `probe-unvollstaendig`, `unvollstaendig`, `korrigiert`, `disziplin-unbekannt` und weitere ([[spiegel-edge-cases]]).
- **Verdeckte Wertung:** Werte ohne Freigabe bleiben leer.
- **Gegenprobe:** Spiegel rechnet die Zehntelwerte aus x/y nach. Weichen alle Schüsse ab, passt das Scheibenbild nicht (falsche Disziplin, Achsen). Weicht ein einzelner ab, ist der Schuss verdächtig, etwa ein Platzhalter (x = y = 0, Teiler 0) oder ein Handeintrag; er wird markiert statt gezeichnet und zählt für keinen Rekord (SF-15, SF-16).

## Projektion

Nach jeder Änderung berechnet Spiegel die Kennzahlen der Scheibe neu ([[spiegel-metrics]]). Steigt die Version einer Kennzahl, werden ihre gespeicherten Werte neu berechnet: ohne Hintergrunddienst beim Lesen (Versionsprüfung) und nach einem Deploy einmal für alle per CLI-Befehl (SF-68).

## Erst einfach

Version 1 normalisiert synchron im Ingest-Request (kleine Stapel). Eine Warteschlange im Server kommt erst, wenn Last oder Laufzeit es verlangen; die Rohdaten machen den Umbau jederzeit möglich.
