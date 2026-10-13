---
id: spiegel-bridge
type: subsystem
title: "Spiegel — Brücke im Schützenhaus"
aliases: [brücke, bridge, spiegel-bridge, meyton-bridge, lokaler-agent]
keywords: [go, golang, apps/spiegel-bridge, brücke, bridge, agent, raspberry pi, mini-pc, meyton-netz, ip-plan, workstation, router, read-only, select, polling, änderungserkennung, snapshot, prüfsumme, zustandslos, stateless, ohne zustand, heartbeat, kopplung, pairing, auftragskanal, fundbüro-seite, go binary, single binary, systemd, gäste-lan, gerätenetz, netztrennung, kopplungscode, probe-puffer, zustand, massenlöschung, fingerabdruck, selbst-update, lebenszeichen, zwei gleiche lesungen, zerrissene lesung, uhr je stand]
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
2. In Spiegel unter Admin → Anlage und Brücken „Brücke koppeln“: Spiegel zeigt einen Kopplungscode („ABCDE-FGHJK“),
   15 Minuten gültig und einmal einlösbar (gebaut 13. Oktober 2026, [[spiegel-ingest-pipeline]]).
3. Brücke installieren (Ziel: eine Datei plus Dienst, siehe Technik) und dabei Spiegel-Adresse und Kopplungscode eintragen. Eine Statusseite braucht es dafür nicht; aus dem Gäste-LAN wäre sie ohnehin nicht erreichbar.
4. Der Assistent in Spiegel testet über die Brücke den SSMDB2-Zugang und zeigt die letzten Scheiben ohne Namen.
5. Fertig: „Anlage online, letzter Schuss vor 2 Minuten“.

## Arbeitsweise

- **Nur lesen:** Standard-Zugang laut Handbuch, nur feste, versionierte SELECTs, feste Sitzungs-Zeitzone (SF-31). Jeder Durchgang ist eine kurze Read-only-Transaktion über alle drei Tabellen (`START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY`), nie eine lang offene: Unter MyISAM sperrt ein Lesen das Schreiben von ShootMaster, unter InnoDB sähe eine lange Transaktion keine neuen Zeilen (SF-51). Vor zerrissenen Lesungen schützt die Transaktion nicht, Meyton schreibt offenbar ohne: **Ein Snapshot geht erst hinaus, wenn die nächste Lesung derselben Scheibe gleich ist**; die vorige Lesung liegt dafür im Arbeitsspeicher (SF-71, [[adr-027]], Änderung vom 9. Oktober 2026).
- **Alle Spalten:** Die Zeilen gehen mit `SELECT *` samt Spaltenliste in den Snapshot; unbekannte Spalten reisen mit, damit eine neue Meyton-Version nichts verschluckt (SF-25).
- **Filter nur nach Inhalt:** Weggelassen werden nur Scheiben ohne Treffer, nie Namen wie `--frei--`; so heißen womöglich genau die Trainings ohne Starter (SF-13).
- **Änderungen erkennen, zweistufig:** zuerst die kleine Tabelle `Scheiben`, dann Serien und Treffer der geänderten Scheiben über ihren Primärschlüssel. `Scheiben.Zeitstempel` ist ein Lebenszeichen: Er steigt alle 5 bis 10 s, solange der Stand belegt ist, auch in der Probe (SF-50 erledigt). Er kommt aber von der Uhr des Stands, die um Minuten falsch gehen kann (SF-73). Deshalb reicht die Abfrage über den ganzen Abend zurück, und geändert ist eine Scheibe, deren Zeitstempel sich gegenüber dem zuletzt gesehenen Wert im Arbeitsspeicher ändert, nicht eine, die in ein kleines Fenster gegen die Server-Uhr fällt. Zeitstempel und Millisekunden werden als Paar verglichen, nie addiert: `Zeitstempel + Millisekunden` rechnet MySQL als Zahl, und spätere Schüsse wirken dann älter (SF-32). Indizes gibt es nur als Primärschlüssel (InnoDB, Kopie vom 9. Oktober 2026): `Scheiben` liest die Brücke deshalb ganz, nur `ScheibenID` und `Zeitstempel` (1.532 Zeilen nach zwei Jahren, 5 ms), Serien und Treffer über die ScheibenID; ein Wasserstand über die ID taugt nicht, sie ist ein überlaufender Zeitzähler (SF-49, SF-77).
- **Takt:** jede Sekunde, solange geschossen wird, sonst alle 30 s. Geschossen wird fast nur dienstags und freitags, erster Schuss meist 18 bis 20 Uhr, letzte Änderung bis 22 Uhr; im Median 32 s zwischen zwei Schüssen, eine Scheibe 17 min, das Lebenszeichen läuft danach im Median noch 10 min, höchstens 2,7 h. Jede Abfrage hat ein Zeitbudget; wird es überschritten, streckt die Brücke den Takt. Ältere Scheiben lädt sie nur nach, wenn gerade niemand schießt (SF-52).
- **Probe:** Meyton löscht die Probe mit dem ersten Wertungsschuss und die alte Probe mit dem ersten Schuss nach einem Neustart der Probe ([[meyton-ssmdb2]], SF-03, SF-72). Die Brücke schickt, was in der Ablage steht, und puffert nichts; Spiegel nimmt den jüngsten stabilen Stand, wie am Ausdruck ([[adr-027]], Entscheidung vom 9. Oktober 2026). Live und per QR kommt deshalb dasselbe an: bei Wertung keine Probe, bei reiner Probe die Probe.
- **Snapshots:** immer der vollständige Stand einer Scheibe (Scheibe, Serien, Treffer) mit Prüfsumme, Folgenummer und Beobachtungszeit; Korrekturen kommen als neue Revision, und ein älterer Stand überholt nie einen neueren (SF-26). Die Folgenummer ist die Beobachtungszeit in Millisekunden, innerhalb eines Laufs streng steigend gehalten; einen Zähler auf der Platte gibt es nicht.
- **Zustand statt Abschluss:** Eine Scheibe ist offen, solange ihr Lebenszeichen läuft, und ruhend nach fünf Minuten ohne Lebenszeichen (gemessen an der Beobachtungszeit, nicht an der Uhr des Stands); ein neues Lebenszeichen öffnet sie wieder. Das Lebenszeichen endet beim Freigeben des Stands, 16 s bis 17,5 min nach dem letzten Schuss. Endgültig wird sie erst, wenn die Anlage dazwischen aus war, oder nach zwölf Stunden ohne Änderung. Die Schusszahl aus der DisziplinID ist nur ein Hinweis, und gegen sie zählen nur Wertungsschüsse; sonst wäre LP 40 mit 60 Probeschüssen vor dem ersten Wertungsschuss „fertig“ (SF-02, SF-07, SF-08, SF-10).
- **Kein eigener Zustand** ([[adr-027]], Änderung vom 8. Oktober 2026): keine Warteschlange, keine Datenbank, auf der Platte nur die Konfiguration (Adresse, Geräte-Token). Scheitert ein Upload, liest die Brücke beim nächsten Durchgang neu und schickt erneut, in kleinen Stapeln; Spiegel verwirft unveränderte Stände an der Prüfsumme. Bremst Spiegel per Ratenbegrenzung, wartet die Brücke so lange, wie Spiegel vorgibt (SF-58).
- **Nur das Lebenszeichen geändert** (Empfehlung seit dem 13. Oktober 2026): Solange sich an einer Scheibe nur
  `Zeitstempel` bewegt, reicht ein Snapshot alle 30 s; Schüsse und andere Änderungen gehen sofort. Spiegel verlässt sich
  nicht darauf: Es legt einen Stand, der sich nur im Lebenszeichen unterscheidet, ohnehin ohne neue Zeilen ab
  ([[spiegel-ingest-pipeline]], „Lebenszeichen ohne neue Zeilen“). Vorher prüft Spiegel Bytegrenze und Ratenbegrenzung;
  bei 429 oder 503 wartet die Brücke `Retry-After`.
- **Zustand beim Start** über `GET /api/ingest/v1/state`: Epoche, gehashte SportpassIDs (`sportpassHash` über
  `Scheiben.SportpassID`), Grabsteine und Löschsperren, Wasserstand; danach alle paar Minuten neu.
- **Heartbeat:** jede Minute Version, Rückstau, letzter DB-Kontakt, Dauer der Abfragen, Uhrabweichung der Anlage (`SELECT NOW()` gegen NTP), zurückgehaltene Scheiben je Wertungsmodus und ein Fingerabdruck der Quelle (`Version`, Zeilenzahlen, älteste Zeitstempel).
- **Aufträge** (per Abfrage alle 2 s): Vorschau einer Scheibe per ID (QR-Weg) und die ganze Scheibe erst, wenn Spiegel sie nach der Gegenprobe anfordert (SF-41); Fundbüro-Liste liefern, Zeitraum nachladen, Diagnose als feste Liste ohne Personenfelder senden. Kein freies SQL.
- **Datensparsamkeit:** nur Scheiben mit Opt-in (gehashte SportpassIDs der Zustimmenden) oder ausdrücklich angefragte. Die Liste lädt die Brücke bei jedem Start von Spiegel und hält sie im Arbeitsspeicher; ohne aktuelle Liste lädt sie nichts automatisch hoch (SF-38). Abgelehnte oder gelöschte Scheiben bekommt sie mit der Liste als Grabsteine und lädt sie nie wieder hoch (SF-28).
- **Verdeckte Wertung** (Modus 5, 10, unbekannt) nie. Bei Preis- und Königsschießen ist die Probe oft sichtbar und erst die Wertung verdeckt: Ab dem ersten verdeckten Schuss verlässt von dieser Scheibe nichts mehr das Gerät, auch nicht die Kopfzeile mit ihren Summen (SF-19). Modus 0 gibt der Admin je Disziplin frei; tragen etwa Probeschüsse Modus 0, bliebe sonst still alles liegen (SF-20).
- **Statusseite** nur im Gerätenetz, für den Admin bei der Fehlersuche; im Alltag zeigt Spiegel den Status über den Heartbeat. Eine Fundbüro-Seite für Handys gibt es nicht, weil die Schützen im Gäste-LAN sind; abgeholt wird über „Scheibe holen“ in Spiegel. Ein Display braucht die Brücke nicht.

## Betrieb: aus nach dem Training

Meyton-Anlage und Brücke werden nach jedem Trainingsabend ausgeschaltet, und zwar hart über den Strom (bestätigt am 5. Oktober 2026). Daraus folgt:

- **Online nur am Abend.** Alles Wichtige passiert, solange geschossen wird: Opt-in-Scheiben gehen live hoch. Was beim Abschalten noch nicht oben ist, liest die Brücke beim nächsten Start erneut aus der SSMDB2; was Meyton verworfen hat (die Probe vor einer Wertung, die alte Probe vor einem Neustart), fehlt auch in Spiegel, wie am Ausdruck.
- **Nachholen beim Start:** offene Aufträge (zum Beispiel ein QR-Scan von zu Hause), Nachladen nach neuen Opt-ins, Abgleich ab dem Wasserstand, den Spiegel je Quelle kennt (SF-55). Die SSMDB2 behält die Daten, die Brücke muss sich nichts merken. Für Wertung belegt; wie lange eine reine Probe bleibt, ist offen (mindestens 17 Tage, [[spiegel-open-questions]]).
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

## Technik (entschieden 13. Oktober 2026, SP-0.4)

**Go**, ein statisches Binary ohne Laufzeit für linux/arm64, linux/amd64 und Windows (rund 6 MB), Dienst über systemd
([[adr-027]], Änderung vom 13. Oktober 2026). Weil die Brücke die Rohdaten unverändert weitergibt und alle Deutung in
Spiegel passiert, trägt sie kaum Fachlogik. Der Vertrag liegt als JSON-Schema, Testvektoren und Beispiele in
`packages/ingest-contract`; die Go-Tests lesen dieselben Dateien.

## Stand des Codes (`apps/spiegel-bridge`)

Teil a (SP-1.4 a, `plans/2026-10-13-spiegel-bruecke-leser.md`): Leser, Änderungserkennung und Snapshots, nur lokal
(`spiegel-bridge watch`). Wie oben beschrieben, mit diesen Zahlen:

- Eine Runde liest in einer Transaktion `ScheibenID` und `Zeitstempel` aller Scheiben und dann ganz: was auf eine zweite
  gleiche Lesung wartet, was sich bewegt hat (auch wenn es eine Runde warten musste) und was in den letzten **20
  Minuten** ein Lebenszeichen hatte (fängt Korrekturen ohne neues Lebenszeichen, SF-21, SF-22). Höchstens **50**
  Scheiben je Runde, wartende zuerst, dann die jüngsten, dann die am längsten nicht gelesenen.
- Beim Start gilt als neu, was bis **12 Stunden** vor dem jüngsten Lebenszeichen liegt (nicht gegen die eigene Uhr:
  die der Stände kann falsch gehen; ein Lebenszeichen mehr als einen Tag nach der Uhr der Anlage verankert das Fenster
  nicht). Den Abgleich ab dem Wasserstand in Spiegel bringt Teil c.
- Jede Runde in einer Transaktion unter REPEATABLE READ (sonst gälte `WITH CONSISTENT SNAPSHOT` nicht), mit den Spalten
  aus `information_schema` (ein neuer Typ reist sofort mit).
- Eine Scheibe, die 24 Stunden nicht in der Ablage stand, vergisst die Brücke; Fehlen ist nie eine Löschung.
- Abgenommen an allen 31 Sonderfällen in MariaDB 10.6 und 11: jeder Snapshot bit-gleich mit dem eingefrorenen, gesendet
  genau die Lesungen der Vorgabe. Die Drossel auf 30 s für reine Lebenszeichen kommt mit dem Upload (Teil b).
