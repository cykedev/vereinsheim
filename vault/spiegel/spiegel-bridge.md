---
id: spiegel-bridge
type: subsystem
title: "Spiegel — Brücke im Schützenhaus"
aliases: [brücke, bridge, spiegel-bridge, meyton-bridge, lokaler-agent]
keywords: [brücke, bridge, agent, raspberry pi, mini-pc, meyton-netz, ip-plan, workstation, router, read-only, select, polling, änderungserkennung, snapshot, prüfsumme, warteschlange, outbox, heartbeat, kopplung, pairing, auftragskanal, fundbüro-seite, go binary, single binary, systemd]
subsystem_of: ["[[spiegel-architecture]]"]
governed_by: ["[[adr-027]]"]
relates_to: ["[[meyton-ssmdb2]]", "[[spiegel-ingest-pipeline]]", "[[spiegel-assignment]]"]
---

**TL;DR** Ein kleines Gerät im Meyton-Netz liest die SSMDB2 nur lesend, schickt vollständige Snapshots je Scheibe unverändert per HTTPS an Spiegel, puffert bei Internetausfall und holt sich feste Aufträge selbst ab. Schützen installieren nichts; der Verein richtet die Brücke einmal ein.

## Wo sie läuft

| Ort | Vorteile | Nachteile |
|---|---|---|
| Raspberry Pi oder Mini-PC (empfohlen) | eigenes Gerät, wenig Strom, zwei Netzanschlüsse möglich, kein Display nötig | einmalig ca. 80–150 €, ein Gerät mehr |
| Vorhandener PC im Meyton-Netz | keine Hardware | läuft nicht immer, Windows-Updates, gemeinsam genutzt |
| Meyton-Server selbst | kein Netzthema | Herstellergerät; nicht empfohlen |

## Netz

- Kabel ins Meyton-Netz, feste IP aus dem Workstation-Bereich des Meyton-IP-Plans (Server 192.168.10.200, Workstations .10.201–239), abgestimmt mit dem, der die Anlage betreut.
- Internet über den Router des Vereins, WLAN oder LTE. Kein Routing zwischen den Netzen, kein offener Port.
- Meyton sperrt den Server gegen Internetzugriff; die Brücke ändert daran nichts.

## Einrichten

1. Gerät ans Meyton-Netz und ans Internet anschließen.
2. Brücke installieren (Ziel: eine Datei plus Dienst, siehe Technik).
3. In Spiegel unter Admin → Anlagen „Brücke koppeln“; die Brücke zeigt auf ihrer Statusseite einen sechsstelligen Code.
4. Der Assistent testet den SSMDB2-Zugang und zeigt die letzten Scheiben ohne Namen.
5. Fertig: „Anlage online, letzter Schuss vor 2 Minuten“.

## Arbeitsweise

- **Nur lesen:** Standard-Zugang laut Handbuch, jede Sitzung `READ ONLY`, nur feste, versionierte SELECTs.
- **Abfragen:** jede Sekunde, solange geschossen wird, sonst alle 30 s. Änderungen über `Scheiben.Zeitstempel` und den letzten Treffer (`MAX(Zeitstempel + Millisekunden)`), mit Überlappungsfenster.
- **Probe mitschneiden:** Probeschüsse stehen womöglich nur bis zur Wertung in der Ablage ([[meyton-ssmdb2]]), deshalb liest die Brücke laufend mit.
- **Snapshots:** immer der vollständige Stand einer Scheibe (Scheibe, Serien, Treffer) mit Prüfsumme; Korrekturen kommen als neue Revision.
- **Abschluss:** Schusszahl aus der DisziplinID erreicht oder zehn Minuten Ruhe.
- **Warteschlange:** lokal (SQLite), Nachlieferung in Reihenfolge, idempotent über Quelle + Epoche + ScheibenID + Prüfsumme.
- **Heartbeat:** jede Minute Version, Rückstau, letzter DB-Kontakt, Uhrabweichung der Anlage (`SELECT NOW()` gegen NTP).
- **Aufträge** (per Abfrage alle 2 s): Scheibe per ID holen (QR-Weg), Fundbüro-Liste liefern, Zeitraum nachladen, Diagnose senden. Kein freies SQL.
- **Datensparsamkeit:** nur Scheiben mit Opt-in (gehashte SportpassIDs der Zustimmenden) oder ausdrücklich angefragte. Verdeckte Wertung (Modus 5, 10, unbekannt) nie.
- **Eigene Webseite** im Vereins-WLAN: Statusseite für den Admin; optional eine Fundbüro-Liste (nur lesend, ohne Namen), die man auf dem eigenen Handy öffnet. Ein Display braucht die Brücke nicht; abgeholt wird normalerweise über „Scheibe holen“ in Spiegel.

## Betrieb: aus nach dem Training

Meyton-Anlage und Brücke werden nach jedem Trainingsabend ausgeschaltet, und zwar hart über den Strom (bestätigt am 5. Oktober 2026). Daraus folgt:

- **Online nur am Abend.** Alles Wichtige passiert, solange geschossen wird: Opt-in-Scheiben gehen live hoch, Probe eingeschlossen, damit beim Abschalten möglichst wenig wartet. Was noch in der Warteschlange liegt, geht beim nächsten Start raus.
- **Nachholen beim Start:** offene Aufträge (zum Beispiel ein QR-Scan von zu Hause), Nachladen nach neuen Opt-ins, Abgleich seit dem letzten Lauf. Die SSMDB2 behält die Daten.
- **Stromverlust aushalten (Pflicht):** schreibgeschütztes System-Dateisystem (zum Beispiel Overlay-Root), Daten auf einer eigenen Partition oder SSD, Protokolle im RAM statt auf der Karte, SQLite mit WAL und vollem Sync, jede Übertragung idempotent. Hardware-Empfehlung deshalb: Mini-PC mit SSD oder Raspberry Pi mit SSD statt SD-Karte. Abnahme in SP-1.4 mit wiederholtem Ziehen des Steckers während Upload und Schreiben.
- **Startreihenfolge:** Die Brücke ist meist schneller wach als der Meyton-Server und wartet geduldig, bis MySQL antwortet.
- **Uhrzeit:** Ein Raspberry Pi ohne Echtzeituhr kennt die Zeit erst nach der Synchronisierung; vorher keine Übertragung (TLS braucht die Zeit). Schusszeiten kommen ohnehin von Meyton.
- **Status in Spiegel:** „aus, zuletzt online Di 22:14“ ist der Normalfall, kein Alarm.

## Was sie nie tut

In Meyton schreiben, einen Port ins Internet öffnen, Daten ohne Zustimmung oder Auftrag hochladen, Daten nach der Bestätigung behalten.

## Störfälle

| Was passiert | Reaktion |
|---|---|
| Internet fällt aus | Warteschlange, Nachlieferung, Status „verzögert“ |
| Meyton-Server aus | Wiederholung mit Pause, Status „Anlage nicht erreichbar“ |
| Neuer Meyton-Server, IDs beginnen neu | gleiche ID mit anderem Inhalt startet eine neue Epoche, Admin-Hinweis |
| Uhr der Anlage falsch | Abweichung im Heartbeat, Ausgleich in der Normalisierung |
| Korrektur durch die Standaufsicht | neuer Snapshot, neue Revision |
| Scheibe in Meyton gelöscht | Abgleich der letzten 30 Tage, Markierung „an der Quelle entfernt“ |

## Technik (offen, SP-0.4)

Wunsch des Users: **ein einzelnes Binary ohne Docker und Node.** Weil die Brücke die Rohdaten unverändert weitergibt und alle Deutung in Spiegel passiert, trägt sie kaum Fachlogik. Das spricht für **Go** (statisches Binary für linux/arm64, linux/amd64 und Windows, wenig Speicher, Dienst über systemd). Der Vertrag zu Spiegel liegt dann als JSON-Schema plus gemeinsamen Beispiel-Dateien in `packages/ingest-contract`, die Go- und TypeScript-Tests gleichermaßen prüfen. Alternativen: Bun- oder Deno-Binary aus TypeScript (größer, enthält eine JS-Laufzeit), Docker mit Node (teilt Code direkt, braucht aber Docker).
