---
id: spiegel-open-questions
type: guide
title: "Spiegel — Offene Fragen und Antworten"
aliases: [spiegel-fragen, spiegel-faq]
keywords: [offene fragen, antworten, entscheidungen, fragenkatalog, klärung, phase 0, sonderfälle, netztrennung, gäste-lan, probe-puffer]
part_of: ["[[spiegel]]"]
relates_to: ["[[spiegel-roadmap]]"]
---

**TL;DR** Der Fragenkatalog zu Spiegel mit dem Stand der Antworten. Fragen, die das Konzept verändern, sind markiert; beantwortete tragen Datum und Antwort. Neue Antworten hier eintragen und, wenn sie eine Entscheidung sind, als ADR festhalten.

# Spiegel — Offene Fragen und Antworten

**Legende:** *(Architektur)* = verändert das Konzept. Antworten vom 5. Oktober 2026, wenn nicht anders vermerkt.

## Anlage und Netz

- **ShootMaster-Version?** → 6.0.2. Das Schema bringt alles mit (Probe, Wertungsmodus, BesterTeiler001).
- **Ist der SSMDB2-Dienst im Kontrollzentrum aktiv (Echtzeit)?** → ja, ist aktiviert.
- **Landen Trainings ohne Starter in der SSMDB2?** *(Architektur)* → `--frei--` kommt beim Verein nicht vor; 112 Scheiben heißen `unknown`, liegen alle in der Starterliste „Trash“ und tragen trotzdem einen Sportpass ([[src-ssmdb2-kopie-2026-10-09]]). Ob ein Training ohne gewählten Schützen so aussieht, zeigt erst ein Versuch (SP-0.6).
- **Was bringt eine Scheibe in die Starterliste „Trash“?** → offen; 299 Scheiben (20 %) liegen dort (SF-78).
- **Zeigt Meyton den QR auch ohne Starter? Was steht in Link und PDF?** *(Architektur)* → ja, den QR gibt es immer, er gehört zum Ausdruck. Link auf ein PDF bei Meyton (HTTP, feste IP, zufälliger Name), im PDF Stand, Zeiten, Name mit #Nummer und eine ID ([[meyton-printout]]).
- **Router mit Internet und Gerät mit fester IP im Meyton-Netz?** *(Architektur)* → ja.
- **Wie sind die Netze getrennt?** *(Architektur)* → Die Schützen sind im Gäste-LAN, Meyton-Anlage und Brücke in einem eigenen Gerätenetz. Kein Problem, eher ein Gewinn: Alles läuft über Spiegel im Internet, und die SSMDB2 bleibt für Handys unerreichbar. Die Fundbüro-Seite auf der Brücke entfällt, gekoppelt wird per Code bei der Installation ([[spiegel-bridge]]).
- **Hat das Gerätenetz ausgehend Internet, und wer betreut Router und Firewall?** *(Architektur)* → sehr wahrscheinlich ja (9. Oktober 2026): Der Mac erreichte Anlage und Internet über dieselbe Standard-Route, ein Gateway im Meyton-Netz (HTTP 200 zu example.com). Offen, ob die Schnittstelle (`en0`) Kabel oder WLAN war, und wer den Router betreut.
- **Standard-Zugang zur SSMDB2 nutzen?** → ja (ein eigener Lese-Benutzer ist nicht vorgesehen).
- **Brücke direkt auf dem Meyton-Rechner (SUSE Linux) statt auf einem eigenen Gerät?** *(Architektur)* → offen, Tendenz ja; die Technik (Go-Binary, SP-0.4) passt zu beiden Orten. Widerspricht [[adr-027]], das den „Agent auf dem Meyton-Server“ verworfen hat (Eingriff in ein Herstellergerät); umsetzen nur mit einer neuen ADR. Technisch passt es zur Empfehlung: Ein Go-Binary für linux/amd64 läuft ohne Laufzeit auch unter SUSE ([[spiegel-bridge]]). Vorteil: kein zusätzliches Gerät, kein Netzthema, die SSMDB2 liegt lokal. Antworten vom 8. Oktober 2026: Der Rechner ist ein gewöhnliches SUSE Linux, auf dem die Meyton-Software läuft. Root haben wir, die Brücke selbst braucht ihn nicht: Sie läuft als eigener Benutzer ohne Rechte; root braucht es nur einmal beim Einrichten (Benutzer und systemd-Unit). Löscht ein Meyton-Update die Brücke, installiert der Betreiber das Binary neu; ein Selbst-Update der Brücke ist dafür nicht nötig. Die Leistung reicht, die Brücke braucht wenig. Offen bleibt, ob Meyton Fremdsoftware auf dem Rechner duldet (Gewährleistung, Support). Puffer: Die Brücke hält keinen eigenen Zustand und auch keine Probe (siehe unten). Bekommt sie einen eigenen Speicher (nächste Frage), spricht das für ein eigenes Gerät: Eine Datenbank gehört nicht auf den Meyton-Rechner.
- **Hält die Brücke doch einen eigenen Speicher?** *(Architektur)* → offen, Tendenz ja. Seit dem 17. Oktober 2026 behält Spiegel jeden live gesehenen Probe-Block als eigene Scheibe ([[adr-027]]); offen bleibt nur, was ohne Live-Upload verloren geht. Meyton löscht die Probe beim Neustart und beim Umschalten sofort; ohne Live-Upload (kein Opt-in, Brücke aus, Internet weg) ist sie dann verloren, und wie lange eine reine Probe in der Ablage bleibt, ist offen. Vorschlag: eigenes Gerät (Raspberry Pi 3 B+, 32-GB-Karte für Dauerschreiben) mit SQLite in reinem Go; jeder stabile Stand jeder Scheibe sieben Tage (die Abholfrist), hochgeladen wird weiter nur mit Opt-in oder Auftrag. Schließt auch die Lücke beim Internet-Ausfall. **Ohne USV:** Das harte Ausschalten trägt die Software: WAL und `synchronous=FULL`, eine kaputte Datenbank wird verworfen und neu angelegt (der Speicher ist eine Zugabe, den Rest haben Spiegel und SSMDB2), Aufräumen beim Start, nach dem letzten Lebenszeichen keine Schreibvorgänge, schreibgeschützte Systempartition empfohlen, ordentliches Netzteil, Stecker-Tests (SF-53). Die Folgenummer zusätzlich speichern (Pi ohne Echtzeituhr, SF-26). Später möglich: kleine USB-USV mit NUT (`shutdown.return`, Piepser abschaltbar) oder ein Aufsatz mit Superkondensatoren, der nach dem Herunterfahren wieder anläuft. Nimmt [[adr-027]] an zwei Stellen zurück (8. Oktober „ohne eigenen Zustand“, 9. Oktober „kein Probe-Puffer“); entscheiden per `/plan`.
- **Lebenszeichen als Snapshot oder im Heartbeat?** → als Snapshot, gedrosselt. `Scheiben.Zeitstempel` ändert sich alle 5 bis 10 s, solange der Stand belegt ist; ein Snapshot je Änderung brächte etwa vier je Schuss. Die Brücke schickt einen Stand, der sich nur im Lebenszeichen ändert, höchstens alle 30 s, und Spiegel vermerkt ihn ohne neue Zeilen ([[spiegel-ingest-pipeline]], „Lebenszeichen ohne neue Zeilen“); offen und ruhend leitet Spiegel daraus ab (SF-10).
- **Läuft die Anlage dauerhaft?** *(Architektur)* → nein: Meyton-Anlage und Brücke werden nach jedem Trainingsabend ausgeschaltet ([[spiegel-bridge]]).
- **Wie wird ausgeschaltet: Herunterfahren oder Strom aus?** *(Architektur)* → Strom aus, also hart. Die Brücke muss jeden Stromverlust ohne Schaden überstehen ([[spiegel-bridge]]).
- **Liegen die PDF-Ausdrucke auch auf der Meyton-Freigabe `ERGEBNIS`?** → offen; als Gast lehnt die Anlage den Zugriff ab (`smbutil`, 9. Oktober 2026). Dann bekäme auch der Opt-in-Weg das Original-PDF automatisch.
- **Welche Stände und Disziplinen gibt es?** → nur 10-m-Stände: Luftpistole und Luftgewehr, jeweils auch Auflage, dazu eigene Disziplin-Varianten (zum Beispiel „LP 40 alt“).
- **SDF und LANA?** → LANA nutzt ihr nicht; SDF offen (nur für Live).
- **Umstieg auf die neue Meyton-Linie ESTANX geplant?** → nicht bekannt; bleibt ein Risiko für später.

## Schützen und Zuordnung

- **Wie melden sich Schützen am Stand an?** *(Architektur)* → Schützenliste oder frei zugewiesen, kein LANA.
- **Wie wird zugeordnet?** *(Architektur)* → Opt-in per Sportpass als Standard („automatisch hochladen“), Meyton-QR mit Original-PDF für alles andere ([[adr-028]]).
- **Ist die SportpassID in der Schützenliste gepflegt?** → nicht bei allen; für Interessierte wird sie in der Meyton-Schützenverwaltung nachgepflegt.
- **Sollen Scheiben ohne Besitzer vorsorglich hochgeladen werden, damit „Scheibe holen“ auch von zu Hause geht?** → offen; Empfehlung nein ([[spiegel-privacy]]).
- **Fundbüro am Stand?** → kein Tablet. Weil es den QR immer gibt, ist ein Fundbüro kaum nötig; als Rückfall reicht „Scheibe holen“ in Spiegel am Abend.
- **Frist für Fundsachen?** → sieben Tage.
- **Wie viele aktive Schützen?** → etwa 10 bis 15.
- **Gäste und Jugendliche?** → vorerst keine Unterstützung; Konten nur für erwachsene Mitglieder.

## Sonderfälle

Der Katalog steht in [[spiegel-edge-cases]].

- **Probe aller Scheiben auf der Brücke puffern (sieben Tage), damit auch QR-Abholungen ihre Probe behalten?** *(Architektur)* → **Entschieden (9. Oktober 2026, nach dem Abend-Mitschnitt): kein Puffer**, weder auf der Platte noch im Arbeitsspeicher; die Brücke hält keinen eigenen Zustand ([[adr-027]]). Spiegel sammelt auch keine Probe über Snapshots, sondern zeigt die Scheibe wie am Ausdruck: bei Wertung ohne Probe, bei reiner Probe mit ihr (SF-03, SF-72). Eine später abgeholte Scheibe hat deshalb nur, was der Schütze nach dem Umschalten auf Wertung am Monitor sieht.
- **Überlebt eine reine Probe die Nacht und den Neustart der Anlage?** → **ja** (9. Oktober 2026): Probeschüsse vom 22. September stehen noch vollständig in der Ablage. Probe gibt es dort aber erst seit dem 22. September 2026 ([[src-ssmdb2-kopie-2026-10-09]]).
- **Wie lange hebt Meyton eine reine Probe auf?** → offen: mindestens 17 Tage belegt. Davon hängt alles ab, was nicht live hochgeht: Schützen ohne Opt-in, QR-Scan von zu Hause, Abende ohne Brücke, Nachladen älterer Scheiben (SP-2.5). Prüfen mit einer zweiten Kopie einige Wochen nach dem 9. Oktober: Stehen die reinen Probe-Scheiben vom 22. September noch da? Die 63 der Kopie vom 9. Oktober sind gesichert.
- **Welche Bedienung löst den Neustart der Probe aus?** → offen; fünfmal an einem Abend beobachtet, die alte Probe ist danach gelöscht (SF-72).
- **Soll ein Neustart der Probe in Spiegel eine eigene Scheibe ergeben statt den alten Block zu ersetzen?** *(Architektur)* → **ja, entschieden (User, 17. Oktober 2026):** Jeder Block wird eine eigene Scheibe, auch die Probe vor der Wertung, rückwirkend aus den Rohdaten ([[adr-027]]). Anlass: Am 16. Oktober standen 51 Schüsse in den Rohdaten, 40 in der Scheibe. Die Brücke bleibt unverändert. Lücke: Was nicht live ankam, hat Meyton schon gelöscht (nächste Frage zum Speicher auf der Brücke).
- **Die erste automatisch zugeordnete Scheibe vom Schützen bestätigen lassen?** → **ja**, gebaut. „Nicht meine“ bei der ersten Scheibe gibt ihr einen Grabstein, und die Zustimmung geht zurück an den Admin ([[spiegel-assignment]]).
- **Wie oft wird nur auf Probe trainiert oder die Umschaltung auf Wertung vergessen?** → oft: am 9. Oktober 2026 hatten 13 von 17 Scheiben keinen Wertungsschuss, bis zu 60 Probeschüsse ([[src-ssmdb2-abend-2026-10-09]]). Spiegel behandelt beides als vollwertiges Training.
- **Lässt sich an unserer Anlage von Wertung zurück auf Probe schalten?** → offen (SP-0.6); am 9. Oktober 2026 kam es nicht vor.
- **Welche Disziplin-Varianten gibt es, und welche zählen zusammen?** → am 9. Oktober 2026 neun: LG 20, LG 40, LG Auflage 30, LP 40, LP Auflage 30 und die Varianten „alt“ (Regel 9110 und 9210) LG 40, LG 60, LP 40, LP 60; `shot-core` löst alle über den Katalog auf. Die ganze Liste zeigt die SQL-Checkliste (SP-0.1); der Admin pflegt die Familien.
- **Wird in der Probe das Visier verstellt, und soll Spiegel ein Ereignis „Visier verstellt“ anbieten?** → **Entschieden (8. Oktober 2026): nein.** Ein solches Ereignis ist zu viel Komplexität für seinen Nutzen (SF-63).
- **Macht die Standaufsicht einen Abend lang das Schießprotokoll mit?** → offen (SP-0.6).
- **Wertet „LG/LP Training Spiegel“ in Ringen oder zählt es mit Meytons Trainingsscheibe nur Treffer?** → beim Verein **nicht in Ringen** (9. Oktober 2026): „LG Training Spiegel“ (hier `10119000`) und die LG/LP-Trainingsscheibe tragen Werte 0,0 bis 1,9 und passen nie zur Standardscheibe; Meytons Trainingsscheiben stehen im Katalog ohne Scheibe, die Vereinsdisziplin `10119000` stellt der Admin auf „ohne Scheibe“ (SF-70). Offen bleibt nur Meytons Fassung unter `19110000` und `19210000`, die beim Verein nicht vorkommt.
- **Nutzt Meytons Wertung den genauen Abstand (Teiler) oder die auf 1/100 mm gerundete Lage?** → **beantwortet (9. Oktober 2026):** an 640 Schüssen kein Unterschied. Entscheidend ist etwas anderes: Meyton wertet jede Grenze 10 µm großzügiger als die Regel; erst damit stimmen alle Zehntel und Innenzehner (SF-75).
- **Darf die Brücke bei einer QR-Anfrage zuerst nur eine Vorschau liefern und die ganze Scheibe erst nach der Gegenprobe?** → Empfehlung ja; das hält die Brücke dumm und lässt bei einer falschen ID nichts Fremdes hinaus ([[spiegel-assignment]]).

## Produkt

- **Eigene App oder Treffsicher-Modul?** *(Architektur)* → eigene App, Treffsicher bekommt eine Brücke ([[adr-026]]).
- **Name?** → Spiegel.
- **Nur unser Verein oder auch andere?** *(Architektur)* → erst für uns, als Open Source; andere Vereine betreiben eine eigene Installation ([[adr-029]]).
- **M-Qnect als Messlatte testen?** → offen (SP-0.3).
- **Highlight für Version 1?** → offen; Vorschlag Session-Detail.
- **Wie wichtig ist Live?** → offen.
- **Liga-Ergebnisse für Ringwerk?** → offen.
- **Notizen, Tags, Ausrüstung schon in Version 1?** → nein, sie kommen mit SP-2.3.
- **Trainer: wer sieht wessen Daten?** → offen.
- **Ergebnis per Link teilen?** → offen.

## Open Source

- **Lizenz?** → Apache-2.0 für das ganze Repo, wie seit Mai 2026 ([[adr-029]]).
- **Name vor der Veröffentlichung prüfen?** → „Spiegel“ ist ok.

## Design

- **Was heißt „moderner“?** → Die Vorschau trifft es; Design und Funktionen gefallen ([[spiegel-ui-design]]).
- **Nur dunkel oder hell und dunkel?** → beides: Die Tokens gibt es für beide Themes, im Profil wählt man „System“, „Hell“ oder „Dunkel“ ([[adr-030]]).
- **Ringwert-Farben wie im Prototyp oder Meyton-Schema?** → offen.
- **Design 2 später für alle Apps?** → offen ([[adr-030]]).

## Betrieb und Recht

- **VPS auf 4 GB?** *(Architektur)* → nein, der VPS bleibt, wie er ist (VPS S, 2 GB). Spiegel muss ins bestehende Speicherbudget passen; laut den Messungen vor und nach dem Deploy tut es das ([[vps-resource-sizing]]).
- **Swap-Datei als Sicherheitsnetz auf dem VPS?** → offen; kostet nichts, ist aber eine Änderung am VPS. Empfohlen, sobald die Reserve knapp wird ([[vps-resource-sizing]]).
- **Wer verantwortet die Einwilligung?** → **Entschieden (14. Oktober 2026): ohne Text vom Vorstand**, SP-0.5 entfällt. Der Schütze bestätigt beim Opt-in im Profil einen versionierten Hinweistext von Spiegel selbst; Spiegel speichert Zeitpunkt und Version ([[spiegel-privacy]]).
- **Aufbewahrung der Historie?** → offen. Spiegel bewahrt Scheiben und alle Zeilenversionen ohne Frist auf, bis der Schütze löscht (Papierkorb 30 Tage); Grabsteine dauerhaft. Ein Löschkonzept braucht der Verein vermutlich (keine Rechtsberatung); eine Abstimmung mit dem Vorstand ist nicht vorgesehen (SP-0.5 entfällt). Das Nachladen älterer Scheiben nach einer Zustimmung ist gebaut (SP-2.5).
- **Was passiert beim Widerruf des Opt-ins mit schon hochgeladenen Scheiben?** → **Sie bleiben**, der Schütze kann sie selbst löschen. Die Brücke lädt danach nichts mehr hoch (SF-38).
- **Darf der Admin fremde Scheiben löschen oder verwerfen?** → offen. Festgelegt sind Zuweisen und Umhängen mit Protokoll und keine Schussbilder ohne Freigabe ([[spiegel-assignment]], [[spiegel-privacy]]); zu klären vor SP-1.7 c.
- **Gemeinsame Anmeldung für alle Apps?** → offen (SP-4.2).
- **Brücke als einzelnes Binary ohne Docker und Node?** → ja: Go, ein statisches Binary (SP-0.4, 13. Oktober 2026, [[adr-027]]).
