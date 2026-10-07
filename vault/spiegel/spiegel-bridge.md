---
id: spiegel-bridge
type: subsystem
title: "Spiegel — Brücke im Schützenhaus"
aliases: [brücke, bridge, spiegel-bridge, meyton-bridge, lokaler-agent]
keywords: [brücke, bridge, agent, raspberry pi, mini-pc, meyton-netz, ip-plan, workstation, router, read-only, select, polling, änderungserkennung, snapshot, prüfsumme, warteschlange, outbox, heartbeat, kopplung, pairing, auftragskanal, fundbüro-seite, go binary, single binary, systemd, gäste-lan, gerätenetz, netztrennung, kopplungscode, probe-puffer, zustand, massenlöschung, fingerabdruck, selbst-update]
subsystem_of: ["[[spiegel-architecture]]"]
governed_by: ["[[adr-027]]"]
relates_to: ["[[meyton-ssmdb2]]", "[[spiegel-ingest-contract]]", "[[spiegel-ingest-pipeline]]", "[[spiegel-assignment]]", "[[spiegel-edge-cases]]"]
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
- **Getrennte Netze** (Stand 5. Oktober 2026): Die Schützen sind im Gäste-LAN, Meyton-Anlage und Brücke in einem eigenen Gerätenetz. Das passt gut: Kein Handy muss die Brücke erreichen, alles läuft über Spiegel im Internet. Und der Meyton-Server, dessen Standard-Zugang auf allen Anlagen gleich ist und im Handbuch steht, bleibt für die Handys unerreichbar.
- **Internet nur ausgehend:** DNS, HTTPS zu Spiegel und NTP. Hat das Gerätenetz Internet (vermutlich, denn Meyton lädt die PDFs für den QR-Code hoch), reicht ein Kabel. Sonst LTE oder die Brücke als reiner Client im Gäste-WLAN. Kein Routing zwischen den Netzen, kein offener Port (SF-57).
- Meyton sperrt den Server gegen Internetzugriff; die Brücke ändert daran nichts.

## Einrichten

1. Gerät ans Gerätenetz anschließen (Meyton und Internet, siehe oben).
2. In Spiegel unter Admin → Anlagen „Brücke koppeln“: Spiegel zeigt einen einmaligen Kopplungscode.
3. Brücke installieren (Ziel: eine Datei plus Dienst, siehe Technik) und dabei Spiegel-Adresse und Kopplungscode eintragen. Eine Statusseite braucht es dafür nicht; aus dem Gäste-LAN wäre sie ohnehin nicht erreichbar.
4. Der Assistent in Spiegel testet über die Brücke den SSMDB2-Zugang und zeigt die letzten Scheiben ohne Namen.
5. Fertig: „Anlage online, letzter Schuss vor 2 Minuten“.

## Arbeitsweise

- **Nur lesen:** Standard-Zugang laut Handbuch, nur feste, versionierte SELECTs, feste Sitzungs-Zeitzone (SF-31). Jeder Durchgang ist eine kurze Read-only-Transaktion über alle drei Tabellen (`START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY`), nie eine lang offene: Unter MyISAM sperrt ein Lesen das Schreiben von ShootMaster, unter InnoDB sähe eine lange Transaktion keine neuen Zeilen (SF-51).
- **Alle Spalten:** Die Zeilen gehen mit `SELECT *` samt Spaltenliste in den Snapshot; unbekannte Spalten reisen mit, damit eine neue Meyton-Version nichts verschluckt (SF-25).
- **Filter nur nach Inhalt:** Weggelassen werden nur Scheiben ohne Treffer, nie Namen wie `--frei--`; so heißen womöglich genau die Trainings ohne Starter (SF-13).
- **Änderungen erkennen, zweistufig:** zuerst die kleine Tabelle `Scheiben` über `Zeitstempel` (mit Überlappungsfenster), dann die Treffer der geänderten Scheiben über ihren Primärschlüssel. Zeitstempel und Millisekunden werden als Paar verglichen, nie addiert: `Zeitstempel + Millisekunden` rechnet MySQL als Zahl, und spätere Schüsse wirken dann älter (SF-32). Ob `Scheiben.Zeitstempel` auch bei Probeschüssen steigt und welche Indizes es gibt, klärt Phase 0; jede Abfrageform wird vorher mit `EXPLAIN` geprüft (SF-49, SF-50).
- **Takt:** jede Sekunde, solange geschossen wird, sonst alle 30 s. Jede Abfrage hat ein Zeitbudget; wird es überschritten, streckt die Brücke den Takt. Ältere Scheiben lädt sie nur nach, wenn gerade niemand schießt (SF-52).
- **Probe sichern:** Probeschüsse stehen womöglich nur bis zum ersten Wertungsschuss in der Ablage ([[meyton-ssmdb2]]). Die Brücke hält deshalb die Probe **aller** Scheiben lokal fest, nicht nur die mit Opt-in, und löscht sie nach dem Upload oder nach sieben Tagen. Nur so behalten auch QR- und Fundbüro-Abholungen ihre Probe. Wie vollständig die Probe erfasst ist, steht an der Scheibe (Merkmal `probe-unvollstaendig`, SF-03); zum Datenschutz siehe [[spiegel-privacy]].
- **Snapshots:** immer der vollständige Stand einer Scheibe (Scheibe, Serien, Treffer) mit Prüfsumme, Folgenummer und Beobachtungszeit; Korrekturen kommen als neue Revision, und ein älterer Stand überholt nie einen neueren (SF-26).
- **Zustand statt Abschluss:** Eine Scheibe ist offen, solange Schüsse kommen, und ruhend nach zehn Minuten Ruhe; ein neuer Schuss öffnet sie wieder. Endgültig wird sie erst, wenn die Anlage dazwischen aus war, oder nach zwölf Stunden ohne Änderung. Die Schusszahl aus der DisziplinID ist nur ein Hinweis, und gegen sie zählen nur Wertungsschüsse; sonst wäre LP 40 mit 60 Probeschüssen vor dem ersten Wertungsschuss „fertig“ (SF-02, SF-07, SF-08, SF-10).
- **Warteschlange:** lokal (SQLite), Nachlieferung in Reihenfolge und in kleinen Stapeln, idempotent über Quelle + Epoche + ScheibenID + Prüfsumme. Ein noch nicht gesendeter Snapshot wird durch den nächsten ersetzt; verschwundene Probe hält der Probe-Puffer. Bremst Spiegel per Ratenbegrenzung, wartet die Brücke so lange, wie Spiegel vorgibt (SF-58).
- **Heartbeat:** jede Minute Version, Rückstau, letzter DB-Kontakt, Dauer der Abfragen, Uhrabweichung der Anlage (`SELECT NOW()` gegen NTP), zurückgehaltene Scheiben je Wertungsmodus und ein Fingerabdruck der Quelle (`Version`, Zeilenzahlen, älteste Zeitstempel).
- **Aufträge** (per Abfrage alle 2 s): Vorschau einer Scheibe per ID (QR-Weg) und die ganze Scheibe erst, wenn Spiegel sie nach der Gegenprobe anfordert (SF-41); Fundbüro-Liste liefern, Zeitraum nachladen, Diagnose als feste Liste ohne Personenfelder senden. Kein freies SQL.
- **Datensparsamkeit:** nur Scheiben mit Opt-in (gehashte SportpassIDs der Zustimmenden) oder ausdrücklich angefragte. Die Liste lädt die Brücke bei jedem Start neu und prüft sie vor jedem Versand aus der Warteschlange; ohne aktuelle Liste lädt sie nichts automatisch hoch (SF-38). Abgelehnte oder gelöschte Scheiben kennt sie als Grabstein und lädt sie nie wieder hoch (SF-28).
- **Verdeckte Wertung** (Modus 5, 10, unbekannt) nie. Bei Preis- und Königsschießen ist die Probe oft sichtbar und erst die Wertung verdeckt: Ab dem ersten verdeckten Schuss verlässt von dieser Scheibe nichts mehr das Gerät, auch nicht die Kopfzeile mit ihren Summen (SF-19). Modus 0 gibt der Admin je Disziplin frei; tragen etwa Probeschüsse Modus 0, bliebe sonst still alles liegen (SF-20).
- **Statusseite** nur im Gerätenetz, für den Admin bei der Fehlersuche; im Alltag zeigt Spiegel den Status über den Heartbeat. Eine Fundbüro-Seite für Handys gibt es nicht, weil die Schützen im Gäste-LAN sind; abgeholt wird über „Scheibe holen“ in Spiegel. Ein Display braucht die Brücke nicht.

## Betrieb: aus nach dem Training

Meyton-Anlage und Brücke werden nach jedem Trainingsabend ausgeschaltet, und zwar hart über den Strom (bestätigt am 5. Oktober 2026). Daraus folgt:

- **Online nur am Abend.** Alles Wichtige passiert, solange geschossen wird: Opt-in-Scheiben gehen live hoch, Probe eingeschlossen, damit beim Abschalten möglichst wenig wartet. Was noch in der Warteschlange liegt, geht beim nächsten Start raus.
- **Nachholen beim Start:** offene Aufträge (zum Beispiel ein QR-Scan von zu Hause), Nachladen nach neuen Opt-ins, Abgleich seit dem letzten Lauf. Die SSMDB2 behält die Daten.
- **Stromverlust aushalten (Pflicht):** schreibgeschütztes System-Dateisystem (zum Beispiel Overlay-Root), Daten auf einer eigenen Partition oder SSD, Protokolle im RAM statt auf der Karte, SQLite mit WAL und vollem Sync, jede Übertragung idempotent. Hardware-Empfehlung deshalb: Mini-PC mit SSD oder Raspberry Pi mit SSD statt SD-Karte. Abnahme in SP-1.4 mit wiederholtem Ziehen des Steckers während Upload und Schreiben (SF-53).
- **Selbst-Update atomar:** neue Datei schreiben, prüfen, umbenennen; die vorige Version bleibt als Rückfall, falls die neue nicht startet (SF-54).
- **Wasserstand auch in Spiegel:** Spiegel kennt den letzten bestätigten Stand je Quelle. Eine getauschte Brücke oder eine neue SSD holt ab dort nach (SF-55).
- **Startreihenfolge:** Die Brücke ist meist schneller wach als der Meyton-Server und wartet geduldig, bis MySQL antwortet.
- **Uhrzeit:** Ein Raspberry Pi ohne Echtzeituhr kennt die Zeit erst nach der Synchronisierung; vorher keine Übertragung (TLS braucht die Zeit). Ist NTP gesperrt, stellt die Brücke ihre Uhr grob nach `SELECT NOW()` der Anlage. Schusszeiten kommen ohnehin von Meyton (SF-33).
- **Status in Spiegel:** „aus, zuletzt online Di 22:14“ ist der Normalfall, kein Alarm. Kommt aber ein QR-Scan von einem Abend, an dem die Brücke keinen Kontakt hatte, warnt Spiegel den Admin (SF-56).

## Was sie nie tut

In Meyton schreiben, einen Port ins Internet öffnen, Daten ohne Zustimmung oder Auftrag hochladen, Daten nach der Bestätigung behalten, gepufferte Probe länger als sieben Tage aufheben, Namen oder Sportpassnummern in Protokolle schreiben (SF-59).

## Störfälle

| Was passiert | Reaktion |
|---|---|
| Internet fällt aus | Warteschlange, Nachlieferung, Status „verzögert“ |
| Meyton-Server aus | Wiederholung mit Pause, Status „Anlage nicht erreichbar“ |
| Ablage geleert oder neuer Meyton-Server | Der Fingerabdruck der Quelle ändert sich, oder viele Scheiben fehlen auf einmal: Die Brücke hält Löschmeldungen zurück und meldet einen möglichen Reset; eine neue Epoche gilt erst nach Bestätigung durch den Admin (SF-23) |
| Abfrage scheitert oder liefert nichts, etwa bei einer nach dem Stromaus beschädigten Tabelle | nie als Löschung werten; wiederholen, Status „Anlage meldet Fehler“ (SF-24) |
| Uhr der Anlage falsch | Abweichung im Heartbeat, Ausgleich in der Normalisierung |
| Korrektur durch die Standaufsicht | neuer Snapshot, neue Revision |
| Einzelne Scheibe in Meyton gelöscht | Abgleich der letzten 30 Tage, Markierung „an der Quelle entfernt“, nie Löschen in Spiegel |
| Meyton-Update ändert das Schema | Die Brücke liest weiter mit allen Spalten und meldet die Version; Spiegel bekommt bei Bedarf eine neue Adapter-Version (SF-25) |
| Gerät oder SSD getauscht | neu koppeln, Nachholen ab dem letzten bestätigten Stand in Spiegel (SF-55) |

## Technik (offen, SP-0.4)

Wunsch des Users: **ein einzelnes Binary ohne Docker und Node.** Weil die Brücke die Rohdaten unverändert weitergibt und alle Deutung in Spiegel passiert, trägt sie kaum Fachlogik. Das spricht für **Go** (statisches Binary für linux/arm64, linux/amd64 und Windows, wenig Speicher, Dienst über systemd). Der Vertrag zu Spiegel liegt dann als JSON-Schema plus gemeinsamen Beispiel-Dateien in `packages/ingest-contract`, die Go- und TypeScript-Tests gleichermaßen prüfen. Alternativen: Bun- oder Deno-Binary aus TypeScript (größer, enthält eine JS-Laufzeit), Docker mit Node (teilt Code direkt, braucht aber Docker).
