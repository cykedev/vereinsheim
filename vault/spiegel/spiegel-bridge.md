---
id: spiegel-bridge
type: subsystem
title: "Spiegel — Brücke im Schützenhaus"
aliases: [brücke, bridge, spiegel-bridge, meyton-bridge, lokaler-agent]
keywords: [go, golang, apps/spiegel-bridge, brücke, bridge, agent, raspberry pi, mini-pc, meyton-netz, ip-plan, workstation, router, read-only, select, polling, änderungserkennung, snapshot, prüfsumme, zustandslos, stateless, ohne zustand, heartbeat, kopplung, pairing, auftragskanal, fundbüro-seite, go binary, single binary, systemd, gäste-lan, gerätenetz, netztrennung, kopplungscode, probe-puffer, zustand, massenlöschung, fingerabdruck, selbst-update, lebenszeichen, zwei gleiche lesungen, zerrissene lesung, uhr je stand, dauerbetrieb, watchdog, sommerpause, umbuchen, abgleich, sportpass-wechsel]
subsystem_of: ["[[spiegel-architecture]]"]
governed_by: ["[[adr-027]]"]
relates_to: ["[[meyton-ssmdb2]]", "[[spiegel-ingest-contract]]", "[[spiegel-ingest-pipeline]]", "[[spiegel-assignment]]", "[[spiegel-edge-cases]]"]
documented_in: ["[[src-ssmdb2-abend-2026-10-09]]", "[[src-ssmdb2-kopie-2026-10-09]]"]
---

**TL;DR** Ein kleines Gerät im Meyton-Netz liest die SSMDB2 nur lesend und schickt vollständige Snapshots je Scheibe unverändert per HTTPS an Spiegel. Es hat keinen eigenen Zustand: Nach einem Ausfall liest es neu, statt zu puffern. Schützen installieren nichts; der Verein richtet die Brücke einmal ein.

## Wo sie läuft

| Ort | Vorteile | Nachteile |
|---|---|---|
| Raspberry Pi oder Mini-PC (empfohlen) | eigenes Gerät, wenig Strom, zwei Netzanschlüsse möglich, kein Display nötig | einmalig ca. 80–150 €, ein Gerät mehr |
| Vorhandener PC im Meyton-Netz | keine Hardware | läuft nicht immer, Windows-Updates, gemeinsam genutzt |
| Meyton-Server selbst (SUSE Linux) | kein Netzthema, kein Gerät mehr | Herstellergerät; laut [[adr-027]] verworfen, als Ort wieder offen ([[spiegel-open-questions]], SP-0.4) |

## Netz

- Kabel ins Meyton-Netz, feste IP aus dem Workstation-Bereich des Meyton-IP-Plans (Server 192.168.10.200, Workstations .10.201–239), abgestimmt mit dem, der die Anlage betreut.
- **Getrennte Netze** (Stand 5. Oktober 2026): Die Schützen sind im Gäste-LAN, Meyton-Anlage und Brücke in einem eigenen Gerätenetz. Das passt gut: Kein Handy muss die Brücke erreichen, alles läuft über Spiegel im Internet. Und der Meyton-Server, dessen Standard-Zugang auf allen Anlagen gleich ist und im Handbuch steht, bleibt für die Handys unerreichbar.
- **Internet nur ausgehend:** DNS, HTTPS zu Spiegel und NTP. Hat das Gerätenetz Internet (vermutlich, denn Meyton lädt die PDFs für den QR-Code hoch), reicht ein Kabel. Sonst LTE oder die Brücke als reiner Client im Gäste-WLAN. Kein Routing zwischen den Netzen, kein offener Port (SF-57).
- Meyton sperrt den Server gegen Internetzugriff; die Brücke ändert daran nichts.

## Einrichten

Schritt für Schritt auf dem Raspberry Pi 3 B+, mit DHCP, Zeitsynchronisierung und Updates: [[spiegel-bridge-pi]].

1. Gerät ans Gerätenetz anschließen (Meyton und Internet, siehe oben).
2. In Spiegel unter Admin → Anlage und Brücke, Kasten „Brücke verbinden“, „Code erzeugen“: Spiegel zeigt den Code für die Brücke („ABCDE-FGHJK“),
   15 Minuten gültig und einmal einlösbar ([[spiegel-ingest-pipeline]]).
3. Brücke installieren: eine Datei plus Dienst (`apps/spiegel-bridge/deploy/`).
   `sudo sh install.sh spiegel-bridge-linux-arm64` legt Binary, Benutzer `spiegel-bridge`, `/etc/spiegel-bridge` (0700)
   und den Dienst an; `sudo -u spiegel-bridge /usr/local/bin/spiegel-bridge pair --url <Spiegel> --code <Code>` koppelt
   und fragt den Zugang zur SSMDB2 ab (nicht in der Befehlszeile, sonst stünde das Passwort in `ps`);
   `sudo systemctl enable --now spiegel-bridge` startet. Der Dienst läuft ohne Rechte, mit schreibgeschütztem System und
   höchstens 128 MB; ohne Konfiguration oder mit widerrufenem Token startet er nicht immer wieder neu, nach einem
   Absturz oder Hänger schon (Watchdog von systemd, [[spiegel-bridge-pi]] „Dauerbetrieb“). Eine Statusseite
   braucht es dafür nicht; aus dem Gäste-LAN wäre sie ohnehin nicht erreichbar. Windows: noch ohne Dienst.
4. Offen: ein Assistent in Spiegel, der über die Brücke den SSMDB2-Zugang testet und die letzten Scheiben ohne Namen zeigt (Diagnose als Auftrag, SP-1.5).
5. Fertig: „Anlage online, letzter Schuss vor 2 Minuten“.

## Arbeitsweise

- **Nur lesen:** Standard-Zugang laut Handbuch, nur feste, versionierte SELECTs, feste Sitzungs-Zeitzone (SF-31). Jeder Durchgang ist eine kurze Read-only-Transaktion über alle drei Tabellen (`START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY`), nie eine lang offene: Unter MyISAM sperrt ein Lesen das Schreiben von ShootMaster, unter InnoDB sähe eine lange Transaktion keine neuen Zeilen (SF-51). Vor zerrissenen Lesungen schützt die Transaktion nicht, Meyton schreibt offenbar ohne: **Ein Snapshot geht erst hinaus, wenn die nächste Lesung derselben Scheibe gleich ist**; die vorige Lesung liegt dafür im Arbeitsspeicher (SF-71, [[adr-027]], Änderung vom 9. Oktober 2026).
- **Alle Spalten:** Die Zeilen gehen mit `SELECT *` samt Spaltenliste in den Snapshot; unbekannte Spalten reisen mit, damit eine neue Meyton-Version nichts verschluckt (SF-25).
- **Filter nur nach Inhalt:** Weggelassen werden nur Scheiben ohne Treffer, nie Namen wie `--frei--`; so heißen womöglich genau die Trainings ohne Starter (SF-13).
- **Änderungen erkennen, zweistufig:** zuerst die kleine Tabelle `Scheiben`, dann Serien und Treffer der geänderten Scheiben über ihren Primärschlüssel. `Scheiben.Zeitstempel` ist ein Lebenszeichen: Er steigt alle 5 bis 10 s, solange der Stand belegt ist, auch in der Probe (SF-50 erledigt). Er kommt aber von der Uhr des Stands, die um Minuten falsch gehen kann (SF-73). Deshalb reicht die Abfrage über den ganzen Abend zurück, und geändert ist eine Scheibe, deren Zeitstempel sich gegenüber dem zuletzt gesehenen Wert im Arbeitsspeicher ändert, nicht eine, die in ein kleines Fenster gegen die Server-Uhr fällt. Zeitstempel und Millisekunden werden als Paar verglichen, nie addiert: `Zeitstempel + Millisekunden` rechnet MySQL als Zahl, und spätere Schüsse wirken dann älter (SF-32). Indizes gibt es nur als Primärschlüssel (InnoDB, Kopie vom 9. Oktober 2026): `Scheiben` liest die Brücke deshalb ganz, nur `ScheibenID`, `Zeitstempel` und `SportpassID` (1.532 Zeilen nach zwei Jahren, 5 ms), Serien und Treffer über die ScheibenID; ein Wasserstand über die ID taugt nicht, sie ist ein überlaufender Zeitzähler (SF-49, SF-77). Geändert ist auch eine Scheibe, deren SportpassID sich gegenüber der letzten Runde ändert: Wird sie in Meyton einem anderen Schützen zugewiesen, bewegt sich das Lebenszeichen womöglich nicht (offen, Schritt 12 des Schießprotokolls in [[meyton-ssmdb2]]), und die Scheibe bliebe als „ohne Zustimmung“ liegen (SF-80). Auch eine in der Schützenliste korrigierte Nummer ändert die SportpassID, dann bei allen alten Scheiben des Schützen auf einmal ([[meyton-printout]]). Aktiv werden sie dadurch nicht: Die Brücke liest jede zweimal, auch während geschossen wird, statt 20 Minuten lang jede Runde. Das Log meldet jeden Wechsel einmal als `card-reassigned` mit `lifesign=moved` oder `same`.
- **Abgleich im Leerlauf:** Wenn niemand schießt, liest die Brücke jede Scheibe neu, die sie in diesem Lauf schon gelesen hat, deren Lebenszeichen höchstens 14 Tage vor dem jüngsten liegt und deren letzte Lesung eine Stunde her ist. Das fängt Korrekturen der Aufsicht, die nach den 20 Minuten aktiver Scheibe kommen (SF-21, SF-22), und eine nachträglich geänderte Disziplin. Im Dauerbetrieb läuft er in der ersten ruhigen Runde: meist gleich nach dem Einschalten der Anlage am nächsten Abend, sonst 20 Minuten nach der letzten Bewegung. Was sich nicht geändert hat, geht nicht hinaus. Nach einem Neustart gilt für Älteres der Wasserstand (SF-55).
- **Takt:** jede Sekunde, solange geschossen wird, sonst alle 30 s. Geschossen wird fast nur dienstags und freitags, erster Schuss meist 18 bis 20 Uhr, letzte Änderung bis 22 Uhr; im Median 32 s zwischen zwei Schüssen, eine Scheibe 17 min, das Lebenszeichen läuft danach im Median noch 10 min, höchstens 2,7 h. Jede Abfrage hat ein Zeitbudget; wird es überschritten, streckt die Brücke den Takt. Ältere Scheiben lädt sie nur nach, wenn gerade niemand schießt (SF-52).
- **Probe:** Meyton löscht die Probe mit dem ersten Wertungsschuss und die alte Probe mit dem ersten Schuss nach einem Neustart der Probe ([[meyton-ssmdb2]], SF-03, SF-72). Die Brücke schickt, was in der Ablage steht, und puffert nichts; jeder stabile Stand kommt an, auch der letzte vor einem Neustart. Spiegel macht aus jedem Block eine eigene Scheibe ([[adr-027]], Änderung vom 17. Oktober 2026), ohne dass sich die Brücke ändert. Per QR später abgeholt kommt nur der letzte Block an.
- **Snapshots:** immer der vollständige Stand einer Scheibe (Scheibe, Serien, Treffer) mit Prüfsumme, Folgenummer und Beobachtungszeit; Korrekturen kommen als neue Revision, und ein älterer Stand überholt nie einen neueren (SF-26). Die Folgenummer ist die Beobachtungszeit in Millisekunden, innerhalb eines Laufs streng steigend gehalten; einen Zähler auf der Platte gibt es nicht.
- **Zustand statt Abschluss:** Eine Scheibe ist offen, solange ihr Lebenszeichen läuft, und ruhend nach fünf Minuten ohne Lebenszeichen (gemessen an der Beobachtungszeit, nicht an der Uhr des Stands); ein neues Lebenszeichen öffnet sie wieder. Das Lebenszeichen endet beim Freigeben des Stands, 16 s bis 17,5 min nach dem letzten Schuss. Endgültig wird sie erst, wenn die Anlage dazwischen aus war, oder nach zwölf Stunden ohne Änderung. Die Schusszahl aus der DisziplinID ist nur ein Hinweis, und gegen sie zählen nur Wertungsschüsse; sonst wäre LP 40 mit 60 Probeschüssen vor dem ersten Wertungsschuss „fertig“ (SF-02, SF-07, SF-08, SF-10).
- **Kein eigener Zustand** ([[adr-027]], Änderung vom 8. Oktober 2026): keine Warteschlange, keine Datenbank, auf der Platte nur die Konfiguration (Adresse, Geräte-Token). Scheitert ein Upload, liest die Brücke beim nächsten Durchgang neu und schickt erneut, in kleinen Stapeln; Spiegel verwirft unveränderte Stände an der Prüfsumme. Bremst Spiegel per Ratenbegrenzung, wartet die Brücke so lange, wie Spiegel vorgibt (SF-58).
- **Nur das Lebenszeichen geändert:** Solange sich an einer Scheibe nur
  `Zeitstempel` bewegt, reicht ein Snapshot alle 30 s; Schüsse und andere Änderungen gehen sofort. Spiegel verlässt sich
  nicht darauf: Es legt einen Stand, der sich nur im Lebenszeichen unterscheidet, ohnehin ohne neue Zeilen ab
  ([[spiegel-ingest-pipeline]], „Lebenszeichen ohne neue Zeilen“). Vorher prüft Spiegel Bytegrenze und Ratenbegrenzung;
  bei 429 oder 503 wartet die Brücke `Retry-After`.
- **Zustand beim Start** über `GET /api/ingest/v1/state`: Epoche, gehashte SportpassIDs (`sportpassHash` über
  `Scheiben.SportpassID`), Grabsteine und Löschsperren, Wasserstand; danach alle paar Minuten neu.
- **Heartbeat:** jede Minute Version, Rückstau, letzter DB-Kontakt, Dauer der Abfragen, Uhrabweichung der Anlage (`SELECT NOW()` gegen NTP), zurückgehaltene Scheiben je Wertungsmodus und ein Fingerabdruck der Quelle (`Version`, Zeilenzahlen, älteste Zeitstempel).
- **Aufträge** (offen, SP-1.5 und SP-1.7 b; per Abfrage alle 2 s): Vorschau einer Scheibe per ID (QR-Weg) und die ganze Scheibe erst, wenn Spiegel sie nach der Gegenprobe anfordert (SF-41); Fundbüro-Liste liefern, Diagnose als feste Liste ohne Personenfelder senden. Kein freies SQL. Das Nachladen nach einer Zustimmung läuft über `GET /state` und den Heartbeat, ebenso eine **Scheibe per ID ohne Vorschau** (gebaut): `state.requests` nennt die ScheibenIDs, die Brücke liest sie beim nächsten Durchgang (alle fünf Minuten neuer Zustand), auch wenn geschossen wird, der Filter lässt sie ohne Zustimmung hinaus (verdeckt und gesperrt nicht), und `heartbeat.requestsDone` meldet `sent`, `missing` oder `held`.
- **Datensparsamkeit:** nur Scheiben mit Opt-in (gehashte SportpassIDs der Zustimmenden) oder ausdrücklich angefragte. Die Liste lädt die Brücke bei jedem Start von Spiegel und hält sie im Arbeitsspeicher; ohne aktuelle Liste lädt sie nichts automatisch hoch (SF-38). Abgelehnte oder gelöschte Scheiben bekommt sie mit der Liste als Grabsteine und lädt sie nie wieder hoch (SF-28).
- **Verdeckte Wertung** (Modus 5, 10, unbekannt) nie. Bei Preis- und Königsschießen ist die Probe oft sichtbar und erst die Wertung verdeckt: Ab dem ersten verdeckten Schuss verlässt von dieser Scheibe nichts mehr das Gerät, auch nicht die Kopfzeile mit ihren Summen (SF-19). Modus 0 gibt der Admin je Disziplin frei; tragen etwa Probeschüsse Modus 0, bliebe sonst still alles liegen (SF-20).
- **Keine Statusseite:** Den Status zeigt Spiegel über den Heartbeat. Eine Fundbüro-Seite für Handys gibt es nicht, weil die Schützen im Gäste-LAN sind; abgeholt wird über „Scheibe holen“ in Spiegel. Ein Display braucht die Brücke nicht.

## Betrieb: Anlage aus nach dem Training

Die Meyton-Anlage wird nach jedem Trainingsabend ausgeschaltet, und zwar hart über den Strom (bestätigt am 5. Oktober 2026), im Sommer auch für Wochen. Die Brücke darf dauerhaft laufen oder mit ausgeschaltet werden (User, 16. Oktober 2026; [[adr-027]], Änderung vom 16. Oktober 2026; Betrieb in [[spiegel-bridge-pi]] „Dauerbetrieb“). Daraus folgt:

- **Die Anlage ist nur am Abend erreichbar.** Alles Wichtige passiert, solange geschossen wird: Opt-in-Scheiben gehen live hoch. Was beim Abschalten noch nicht oben ist, liest die Brücke beim nächsten Start erneut aus der SSMDB2; was Meyton verworfen hat (die Probe vor einer Wertung, die alte Probe vor einem Neustart), fehlt auch in Spiegel, wie am Ausdruck.
- **Nachholen beim Start:** offene Aufträge (zum Beispiel ein QR-Scan von zu Hause), Nachladen nach neuen Opt-ins, Abgleich ab dem Wasserstand, den Spiegel je Quelle kennt (SF-55). Die SSMDB2 behält die Daten, die Brücke muss sich nichts merken. Für Wertung belegt; wie lange eine reine Probe bleibt, ist offen (mindestens 17 Tage, [[spiegel-open-questions]]). Läuft die Brücke durch, behält sie, was noch wartet, im Speicher und schickt es, sobald die Anlage wieder an ist; vergessen wird nur in einer gelungenen Runde. Nachgeholt ab dem Wasserstand wird nur nach einem Neustart der Brücke, und das an der ersten gelungenen Runde, auch Wochen nach dem Start.
- **Stromverlust ist harmlos:** Die Brücke schreibt nichts außer der Konfiguration, die nur beim Koppeln entsteht; ein hartes Ausschalten kann nichts beschädigen. Jede Übertragung ist idempotent über Quelle + Epoche + ScheibenID + Prüfsumme (SF-53). Kein SQLite, kein Overlay-Root, keine SSD-Pflicht.
- **Updates:** Gibt es ein Selbst-Update, dann atomar (neue Datei schreiben, prüfen, umbenennen; die vorige bleibt als Rückfall, SF-54). Auf dem Meyton-Rechner reicht notfalls, das Binary nach einem Meyton-Update neu zu installieren.
- **Startreihenfolge:** Die Brücke ist meist schneller wach als der Meyton-Server und wartet geduldig, bis MySQL antwortet.
- **Uhrzeit** (SF-33, SF-79): Ein Raspberry Pi ohne Echtzeituhr startet mit der Uhr vom letzten Abend (fake-hwclock), bis NTP antwortet. TLS klappt damit; ohne Prüfung schickte die Brücke Stände mit der alten Zeit, Spiegel verschöbe die Scheiben um die Verspätung und hielte die richtige Uhr der Anlage für falsch. Deshalb misst die Brücke ihre Uhr mit jedem Heartbeat an `serverTime` von Spiegel (Mitte der Anfrage, unsicher um die halbe Umlaufzeit). Ungeprüft oder mehr als 30 s daneben, hält sie Stände und Uhrabweichung der Anlage zurück und meldet `clock`; nichts geht verloren, sie liest danach neu. Spiegel lehnt zusätzlich Beobachtungen ab, die mehr als 15 min vor der Empfangszeit liegen (`past`). Die Brücke stellt ihre Uhr nicht selbst und nimmt nie `NOW()` der Anlage als Maßstab (SF-29: die kann selbst falsch gehen); NTP bleibt Voraussetzung. Liegt die Uhr vor dem Beginn des Zertifikats, scheitert TLS mit dem Code `tls-time`, nach seinem Ende mit `tls-expired`. Verworfen: die Zeit von Spiegel übernehmen (letzte `serverTime` plus monotone Zeit); das hielte die Brücke auch ohne NTP am Laufen, änderte aber die Bedeutung jeder Zeit im Vertrag und hinge am monotonen Takt, der unter Linux im Ruhezustand steht. Schusszeiten kommen ohnehin von Meyton.
- **Status in Spiegel:** „aus, zuletzt online Di 22:14“ ist der Normalfall, kein Alarm. Kommt aber ein QR-Scan von einem Abend, an dem die Brücke keinen Kontakt hatte, warnt Spiegel den Admin (SF-56).

## Was sie nie tut

In Meyton schreiben, einen Port ins Internet öffnen, Daten ohne Zustimmung oder Auftrag hochladen, Daten nach der Bestätigung behalten, etwas außer der Konfiguration auf die Platte schreiben, Namen oder Sportpassnummern in Protokolle schreiben (SF-59).

## Störfälle

| Was passiert | Reaktion |
|---|---|
| Internet fällt aus | nichts puffern; danach bzw. beim nächsten Start neu lesen und schicken, Status „verzögert“; was Meyton inzwischen verworfen hat, fehlt |
| Meyton-Server aus | Wiederholung mit Pause, Status „Anlage nicht erreichbar“ |
| Ablage geleert oder neuer Meyton-Server | Der Fingerabdruck der Quelle ändert sich, oder viele Scheiben fehlen auf einmal: Die Brücke hält Löschmeldungen zurück und meldet einen möglichen Reset; eine neue Epoche eröffnet sie nicht, Spiegel zeigt dem Admin einen Hinweis (SF-23) |
| Abfrage scheitert oder liefert nichts, etwa bei einer nach dem Stromaus beschädigten Tabelle | nie als Löschung werten; wiederholen, Status „Anlage meldet Fehler“ (SF-24) |
| Uhr der Anlage falsch | Abweichung im Heartbeat, Ausgleich in der Normalisierung |
| Uhr der Brücke falsch (Pi vor NTP) | Messung an `serverTime`, Stände und Abweichung zurückgehalten, Status `clock`; Spiegel lehnt alte Beobachtungen ab (SF-79) |
| Korrektur durch die Standaufsicht | neuer Snapshot, neue Revision |
| Einzelne Scheibe in Meyton gelöscht | Abgleich der letzten 30 Tage, Markierung „an der Quelle entfernt“, nie Löschen in Spiegel |
| Meyton-Update ändert das Schema | Die Brücke liest weiter mit allen Spalten und meldet die Version; Spiegel bekommt bei Bedarf eine neue Adapter-Version (SF-25) |
| Gerät oder SSD getauscht | neu koppeln, Nachholen ab dem letzten bestätigten Stand in Spiegel (SF-55) |
| Epoche ohne neue Nummer bestätigt | bekannte Grenze: Zurückgewiesene Stände (`epoch-unconfirmed`) schickt die Brücke nur bei einer neuen Epochennummer erneut; heute nicht erreichbar, weil niemand eine Epoche in der Oberfläche bestätigt |

## Technik

**Go**, ein statisches Binary ohne Laufzeit für linux/arm64, linux/amd64 und Windows (rund 6 MB), Dienst über systemd mit Watchdog
([[adr-027]], Änderung vom 13. Oktober 2026). Weil die Brücke die Rohdaten unverändert weitergibt und alle Deutung in
Spiegel passiert, trägt sie kaum Fachlogik. Der Vertrag liegt als JSON-Schema, Testvektoren und Beispiele in
`packages/ingest-contract`; die Go-Tests lesen dieselben Dateien.

## Stand des Codes (`apps/spiegel-bridge`)

**Lesen** (`spiegel-bridge watch` liest nur lokal): Leser, Änderungserkennung und Snapshots wie oben beschrieben, mit
diesen Zahlen:

- Eine Runde liest in einer Transaktion `ScheibenID` und `Zeitstempel` aller Scheiben und dann ganz: was auf eine zweite
  gleiche Lesung wartet, was sich bewegt hat (auch wenn es eine Runde warten musste) und was in den letzten **20
  Minuten** ein Lebenszeichen hatte (fängt Korrekturen ohne neues Lebenszeichen, SF-21, SF-22). Höchstens **50**
  Scheiben je Runde, wartende zuerst, dann die jüngsten, dann die am längsten nicht gelesenen.
- Beim Start gilt als neu, was bis **12 Stunden** vor dem jüngsten Lebenszeichen liegt (nicht gegen die eigene Uhr:
  die der Stände kann falsch gehen; ein Lebenszeichen mehr als einen Tag nach der Uhr der Anlage verankert das Fenster
  nicht). Den Abgleich ab dem Wasserstand in Spiegel bringt das Nachholen beim Start (unten).
- Jede Runde in einer Transaktion unter REPEATABLE READ (sonst gälte `WITH CONSISTENT SNAPSHOT` nicht), mit den Spalten
  aus `information_schema` (ein neuer Typ reist sofort mit).
- Eine Scheibe, die 24 Stunden nicht in der Ablage stand, vergisst die Brücke; Fehlen ist nie eine Löschung.
- Abgenommen an allen 31 Sonderfällen in MariaDB 10.6 und 11: jeder Snapshot bit-gleich mit dem eingefrorenen, gesendet
  genau die Lesungen der Vorgabe.

**Koppeln und Hochladen:** `spiegel-bridge pair` und `run`.

- **Konfiguration** als JSON (Adresse, Brücken-Id, Token, Zugang zur SSMDB2), geschrieben nur beim Koppeln, atomar mit
  Rechten 0600; Ort `/etc/spiegel-bridge/config.json` bzw. `%ProgramData%\spiegel-bridge\config.json`.
- **Filter am Rand:** nur Scheiben mit Zustimmung (Hash der SportpassID aus `GET /state`), keine
  mit verdecktem Schuss oder Modus 0 (die ganze Scheibe ab dem ersten, im Heartbeat je Anzeigeart gezählt), keine
  gesperrten. Dieselben Regeln, nach denen Spiegel verwirft: Was Spiegel nicht nehmen darf, verlässt das Gerät nicht.
- **Upload ohne Warteschlange:** Ein Stand gilt erst mit der Antwort von Spiegel als gesendet; bis dahin liest die Brücke
  die Scheibe jede Runde neu. Nur-Lebenszeichen höchstens alle 30 s. `Retry-After` bei 429 und 503, 413 teilt den
  Stapel, 401 beendet den Lauf (neu koppeln).
- **Heartbeat** jede Minute mit Status, Rückstau, Uhrabweichung der Anlage (`NOW(3)`), zurückgehaltenen Scheiben und
  Fingerabdruck; ein möglicher Reset wird gemeldet, eine neue Epoche eröffnet die Brücke nicht von selbst. Die Antwort
  trägt `serverTime`: Daran misst die Brücke ihre eigene Uhr (SF-79, Status `clock`, Zustand im Admin, keine Aufgabe).
- **Nachholen beim Start** (SF-55): ab einem Tag vor dem Wasserstand, den Spiegel meldet, in der Zone der Anlage;
  gelesen wird das erst, wenn 20 Minuten nichts läuft (SF-52). Damit ist der letzte Abend samt späten Korrekturen beim
  nächsten Start abgeglichen. Was Spiegel schon hat, kommt als „unverändert“ zurück.
- **Ende zu Ende** (`pnpm --filter spiegel bridge-e2e`): eigener Build, MariaDB, SF-03, SF-13 und SF-19 mit Zeiten von
  jetzt; es kommen genau die erlaubten Stände an, je eine Scheibe beim Konto mit Zustimmung. Nebenbei gelernt: Mit den
  Datumsangaben der Fälle (Tage zurück) misst Spiegel Tage Uhrversatz und schaltet eine Scheibe über den Heartbeat
  endgültig, bevor der nächste Stand kommt; der wird dann ein neuer Zyklus. Ein echter Abend hat das nicht.
