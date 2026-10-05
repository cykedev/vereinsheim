---
id: spiegel-ingest-pipeline
type: subsystem
title: "Spiegel — Ingest-API und Normalisierung"
aliases: [ingest, ingest-api, normalisierung, rohdaten-pipeline]
keywords: [ingest, api, endpunkt, geräte-token, device token, idempotenz, snapshot, rohdatensatz, raw store, normalisierung, adapter, meyton-ssmdb2, skalen, zeitzone, epoche, revision, projektion, neu berechnen, vertrag, contract, json schema]
subsystem_of: ["[[spiegel-architecture]]"]
governed_by: ["[[adr-027]]"]
relates_to: ["[[spiegel-bridge]]", "[[spiegel-data-model]]", "[[meyton-ssmdb2]]"]
---

**TL;DR** Die Brücke liefert Snapshots an eine kleine, gesicherte Ingest-API. Spiegel speichert sie unverändert als Rohdatensatz, deutet sie mit einem versionierten Adapter (`meyton-ssmdb2@9`) ins kanonische Modell und berechnet die Kennzahlen. Jeder Schritt rechts der Rohdaten ist wiederholbar.

## Endpunkte (Vertrag v1, `packages/ingest-contract`)

| Endpunkt | Zweck |
|---|---|
| `POST /api/ingest/v1/pair` | Kopplung mit Einmal-Code, liefert Geräte-Token |
| `POST /api/ingest/v1/snapshots` | Stapel von Snapshots (Scheibe + Serien + Treffer, Prüfsumme, Quelle, Epoche) |
| `GET /api/ingest/v1/commands` | offene Aufträge abholen (Scheibe per ID, Fundbüro-Liste, Nachladen, Diagnose) |
| `POST /api/ingest/v1/commands/<id>/result` | Antwort auf einen Auftrag |
| `POST /api/ingest/v1/heartbeat` | Version, Rückstau, letzter DB-Kontakt, Uhrabweichung |

Sicherheit: Geräte-Token (nur gehasht gespeichert, je Anlage, widerrufbar), Ratenbegrenzung, Größenlimits je Anfrage, strikte Schema-Prüfung. Ein gestohlener Token kann nur Daten für diese Anlage einliefern, nichts lesen.

## Rohdaten

Jeder Snapshot wird unverändert als Rohdatensatz gespeichert (JSON, Prüfsumme, Empfangszeit, Brücken-Version, Adapter-Version). Gleiche Prüfsumme bedeutet: nichts zu tun.

## Normalisierung (Adapter `meyton-ssmdb2@9`)

- **Skalen je Feld** aus einer Tabelle, festgenagelt durch Tests am echten Datensatz ([[meyton-ssmdb2]]).
- **Zeit:** Ortszeit ohne Zone plus Millisekunden → UTC mit der Zeitzone der Anlage; die Uhrabweichung aus dem Heartbeat wird berücksichtigt; der Rohwert bleibt erhalten.
- **Reihenfolge:** Probe (Stellung 0) zuerst, dann Stellungen 1…n, darin `Treffer` aufsteigend.
- **Disziplin und Scheibenbild** aus der DisziplinID ([[spiegel-target-library]]).
- **Epochen:** Schlüssel ist Quelle + Epoche + ScheibenID. Gleiche ID mit anderem Inhalt (anderer Stand, anderer Beginn) startet eine neue Epoche.
- **Revisionen:** ein geänderter Snapshot erzeugt eine neue Revision der kanonischen Scheibe; die Historie bleibt.
- **Verdeckte Wertung:** Werte ohne Freigabe bleiben leer.
- **Gegenprobe:** Spiegel rechnet die Zehntelwerte aus x/y nach; Abweichungen markieren ein falsches Scheibenbild.

## Projektion

Nach jeder Änderung berechnet Spiegel die Kennzahlen der Scheibe neu ([[spiegel-metrics]]). Steigt die Version einer Kennzahl, werden ihre gespeicherten Werte neu berechnet.

## Erst einfach

Version 1 normalisiert synchron im Ingest-Request (kleine Stapel). Eine Warteschlange im Server kommt erst, wenn Last oder Laufzeit es verlangen; die Rohdaten machen den Umbau jederzeit möglich.
