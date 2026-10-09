---
id: spiegel-bridge
type: subsystem
title: "Spiegel — Brücke im Schützenhaus"
aliases: [brücke, bridge, spiegel-bridge, meyton-bridge, lokaler-agent]
keywords: [brücke, bridge, agent, raspberry pi, mini-pc, meyton-netz, ip-plan, workstation, router, read-only, select, polling, änderungserkennung, snapshot, prüfsumme, zustandslos, stateless, ohne zustand, heartbeat, kopplung, pairing, auftragskanal, fundbüro-seite, go binary, single binary, systemd, gäste-lan, gerätenetz, netztrennung, kopplungscode, probe-puffer, zustand, massenlöschung, fingerabdruck, selbst-update, lebenszeichen, zwei gleiche lesungen, zerrissene lesung, uhr je stand]
subsystem_of: ["[[spiegel-architecture]]"]
governed_by: ["[[adr-027]]"]
relates_to: ["[[meyton-ssmdb2]]", "[[spiegel-ingest-contract]]", "[[spiegel-ingest-pipeline]]", "[[spiegel-assignment]]", "[[spiegel-edge-cases]]"]
documented_in: ["[[src-ssmdb2-abend-2026-10-09]]", "[[src-ssmdb2-kopie-2026-10-09]]"]
---

**TL;DR** Ein kleines Gerät im Meyton-Netz liest die SSMDB2 nur lesend, schickt vollständige Snapshots je Scheibe unverändert per HTTPS an Spiegel, puffert bei Internetausfall und holt sich feste Aufträge selbst ab. Schützen installieren nichts; der Verein richtet die Brücke einmal ein.

## Wo sie läuft

| Ort | Vorteile | Nachteile |
|---|---|---|
| Raspberry Pi oder Mini-PC (empfohlen) | eigenes Gerät, wenig Strom, zwei Netzanschlüsse möglich, kein Display nötig | einmalig ca. 80–150 €, ein Gerät mehr |
| Vorhandener PC im Meyton-Netz | keine Hardware | läuft nicht immer, Windows-Updates, gemeinsam genutzt |
| Meyton-Server selbst (SUSE Linux) | kein Netzthema, kein Gerät mehr | Herstellergerät; laut [[adr-027]] verworfen, als Wunsch des Users wieder offen ([[spiegel-open-questions]], SP-0.4) |

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

- **Nur lesen:** Standard-Zugang laut Handbuch, nur feste, versionierte SELECTs, feste Sitzungs-Zeitzone (SF-31). Jeder Durchgang ist eine kurze Read-only-Transaktion über alle drei Tabellen (`START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY`), nie eine lang offene: Unter MyISAM sperrt ein Lesen das Schreiben von ShootMaster, unter InnoDB sähe eine lange Transaktion keine neuen Zeilen (SF-51). Vor zerrissenen Lesungen schützt die Transaktion nicht, Meyton schreibt offenbar ohne: **Ein Snapshot geht erst hinaus, wenn die nächste Lesung derselben Scheibe gleich ist**; die vorige Lesung liegt dafür im Arbeitsspeicher (SF-71, [[adr-027]], Änderung vom 9. Oktober 2026).
- **Alle Spalten:** Die Zeilen gehen mit `SELECT *` samt Spaltenliste in den Snapshot; unbekannte Spalten reisen mit, damit eine neue Meyton-Version nichts verschluckt (SF-25).
- **Filter nur nach Inhalt:** Weggelassen werden nur Scheiben ohne Treffer, nie Namen wie `--frei--`; so heißen womöglich genau die Trainings ohne Starter (SF-13).
- **Änderungen erkennen, zweistufig:** zuerst die kleine Tabelle `Scheiben`, dann Serien und Treffer der geänderten Scheiben über ihren Primärschlüssel. `Scheiben.Zeitstempel` ist ein Lebenszeichen: Er steigt alle 5 bis 10 s, solange der Stand belegt ist, auch in der Probe (SF-50 erledigt). Er kommt aber von der Uhr des Stands, die um Minuten falsch gehen kann (SF-73). Deshalb reicht die Abfrage über den ganzen Abend zurück, und geändert ist eine Scheibe, deren Zeitstempel sich gegenüber dem zuletzt gesehenen Wert im Arbeitsspeicher ändert, nicht eine, die in ein kleines Fenster gegen die Server-Uhr fällt. Zeitstempel und Millisekunden werden als Paar verglichen, nie addiert: `Zeitstempel + Millisekunden` rechnet MySQL als Zahl, und spätere Schüsse wirken dann älter (SF-32). Indizes gibt es nur als Primärschlüssel (InnoDB, Kopie vom 9. Oktober 2026): `Scheiben` liest die Brücke deshalb ganz, nur `ScheibenID` und `Zeitstempel` (1.532 Zeilen nach zwei Jahren, 5 ms), Serien und Treffer über die ScheibenID; ein Wasserstand über die ID taugt nicht, sie ist ein überlaufender Zeitzähler (SF-49, SF-77).
- **Takt:** jede Sekunde, solange geschossen wird, sonst alle 30 s. Geschossen wird fast nur dienstags und freitags, erster Schuss meist 18 bis 20 Uhr, letzte Änderung bis 22 Uhr; im Median 32 s zwischen zwei Schüssen, eine Scheibe 17 min, das Lebenszeichen läuft danach im Median noch 10 min, höchstens 2,7 h. Jede Abfrage hat ein Zeitbudget; wird es überschritten, streckt die Brücke den Takt. Ältere Scheiben lädt sie nur nach, wenn gerade niemand schießt (SF-52).
- **Probe:** Meyton löscht die Probe mit dem ersten Wertungsschuss und die alte Probe mit dem ersten Schuss nach einem Neustart der Probe ([[meyton-ssmdb2]], SF-03, SF-72). Opt-in-Scheiben gehen live hoch und bringen ihre Probe mit, solange sie dasteht; Spiegel sammelt sie über alle Snapshots, über den Fingerabdruck und je Neustart in eigenen Blöcken. **Die Brücke puffert keine Probe** ([[adr-027]], Änderung vom 9. Oktober 2026): Eine später abgeholte Scheibe (QR, Fundbüro) hat, was dann in der Ablage steht. Eine reine Probe ohne Neustart ist damit vollständig, die Probe vor einer Wertung fehlt, wie am Monitor und im Ausdruck (Merkmal `probe-unvollstaendig`).
- **Snapshots:** immer der vollständige Stand einer Scheibe (Scheibe, Serien, Treffer) mit Prüfsumme, Folgenummer und Beobachtungszeit; Korrekturen kommen als neue Revision, und ein älterer Stand überholt nie einen neueren (SF-26). Die Folgenummer ist die Beobachtungszeit in Millisekunden, innerhalb eines Laufs streng steigend gehalten; einen Zähler auf der Platte gibt es nicht.
- **Zustand statt Abschluss:** Eine Scheibe ist offen, solange ihr Lebenszeichen läuft, und ruhend nach fünf Minuten ohne Lebenszeichen (gemessen an der Beobachtungszeit, nicht an der Uhr des Stands); ein neues Lebenszeichen öffnet sie wieder. Das Lebenszeichen endet beim Freigeben des Stands, 16 s bis 17,5 min nach dem letzten Schuss. Endgültig wird sie erst, wenn die Anlage dazwischen aus war, oder nach zwölf Stunden ohne Änderung. Die Schusszahl aus der DisziplinID ist nur ein Hinweis, und gegen sie zählen nur Wertungsschüsse; sonst wäre LP 40 mit 60 Probeschüssen vor dem ersten Wertungsschuss „fertig“ (SF-02, SF-07, SF-08, SF-10).
- **Kein eigener Zustand** ([[adr-027]], Änderung vom 8. Oktober 2026): keine Warteschlange, keine Datenbank, auf der Platte nur die Konfiguration (Adresse, Geräte-Token). Scheitert ein Upload, liest die Brücke beim nächsten Durchgang neu und schickt erneut, in kleinen Stapeln; Spiegel verwirft unveränderte Stände an der Prüfsumme. Bremst Spiegel per Ratenbegrenzung, wartet die Brücke so lange, wie Spiegel vorgibt (SF-58).
- **Heartbeat:** jede Minute Version, Rückstau, letzter DB-Kontakt, Dauer der Abfragen, Uhrabweichung der Anlage (`SELECT NOW()` gegen NTP), zurückgehaltene Scheiben je Wertungsmodus und ein Fingerabdruck der Quelle (`Version`, Zeilenzahlen, älteste Zeitstempel).
- **Aufträge** (per Abfrage alle 2 s): Vorschau einer Scheibe per ID (QR-Weg) und die ganze Scheibe erst, wenn Spiegel sie nach der Gegenprobe anfordert (SF-41); Fundbüro-Liste liefern, Zeitraum nachladen, Diagnose als feste Liste ohne Personenfelder senden. Kein freies SQL.
- **Datensparsamkeit:** nur Scheiben mit Opt-in (gehashte SportpassIDs der Zustimmenden) oder ausdrücklich angefragte. Die Liste lädt die Brücke bei jedem Start von Spiegel und hält sie im Arbeitsspeicher; ohne aktuelle Liste lädt sie nichts automatisch hoch (SF-38). Abgelehnte oder gelöschte Scheiben bekommt sie mit der Liste als Grabsteine und lädt sie nie wieder hoch (SF-28).
- **Verdeckte Wertung** (Modus 5, 10, unbekannt) nie. Bei Preis- und Königsschießen ist die Probe oft sichtbar und erst die Wertung verdeckt: Ab dem ersten verdeckten Schuss verlässt von dieser Scheibe nichts mehr das Gerät, auch nicht die Kopfzeile mit ihren Summen (SF-19). Modus 0 gibt der Admin je Disziplin frei; tragen etwa Probeschüsse Modus 0, bliebe sonst still alles liegen (SF-20).
- **Statusseite** nur im Gerätenetz, für den Admin bei der Fehlersuche; im Alltag zeigt Spiegel den Status über den Heartbeat. Eine Fundbüro-Seite für Handys gibt es nicht, weil die Schützen im Gäste-LAN sind; abgeholt wird über „Scheibe holen“ in Spiegel. Ein Display braucht die Brücke nicht.

## Betrieb: aus nach dem Training

Meyton-Anlage und Brücke werden nach jedem Trainingsabend ausgeschaltet, und zwar hart über den Strom (bestätigt am 5. Oktober 2026). Daraus folgt:

- **Online nur am Abend.** Alles Wichtige passiert, solange geschossen wird: Opt-in-Scheiben gehen live hoch, Probe eingeschlossen. Was beim Abschalten noch nicht oben ist, liest die Brücke beim nächsten Start erneut aus der SSMDB2; was Meyton bis dahin verworfen hat (die Probe vor einer Wertung, die alte Probe vor einem Neustart), ist für diesen Abend weg.
- **Nachholen beim Start:** offene Aufträge (zum Beispiel ein QR-Scan von zu Hause), Nachladen nach neuen Opt-ins, Abgleich ab dem Wasserstand, den Spiegel je Quelle kennt (SF-55). Die SSMDB2 behält die Daten, die Brücke muss sich nichts merken.
- **Stromverlust ist harmlos:** Die Brücke schreibt nichts außer der Konfiguration, die nur beim Koppeln entsteht; ein hartes Ausschalten kann nichts beschädigen. Jede Übertragung ist idempotent über Quelle + Epoche + ScheibenID + Prüfsumme (SF-53). Kein SQLite, kein Overlay-Root, keine SSD-Pflicht.
- **Updates:** Gibt es ein Selbst-Update, dann atomar (neue Datei schreiben, prüfen, umbenennen; die vorige bleibt als Rückfall, SF-54). Auf dem Meyton-Rechner reicht notfalls, das Binary nach einem Meyton-Update neu zu installieren.
- **Startreihenfolge:** Die Brücke ist meist schneller wach als der Meyton-Server und wartet geduldig, bis MySQL antwortet.
- **Uhrzeit:** Ein Raspberry Pi ohne Echtzeituhr kennt die Zeit erst nach der Synchronisierung; vorher keine Übertragung (TLS braucht die Zeit). Ist NTP gesperrt, stellt die Brücke ihre Uhr grob nach `SELECT NOW()` der Anlage. Schusszeiten kommen ohnehin von Meyton (SF-33).
- **Status in Spiegel:** „aus, zuletzt online Di 22:14“ ist der Normalfall, kein Alarm. Kommt aber ein QR-Scan von einem Abend, an dem die Brücke keinen Kontakt hatte, warnt Spiegel den Admin (SF-56).

## Was sie nie tut

In Meyton schreiben, einen Port ins Internet öffnen, Daten ohne Zustimmung oder Auftrag hochladen, Daten nach der Bestätigung behalten, etwas außer der Konfiguration auf die Platte schreiben, Namen oder Sportpassnummern in Protokolle schreiben (SF-59).

## Störfälle

| Was passiert | Reaktion |
|---|---|
| Internet fällt aus | nichts puffern; danach bzw. beim nächsten Start neu lesen und schicken, Status „verzögert“; was Meyton inzwischen verworfen hat, fehlt |
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
