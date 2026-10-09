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
- **Hat das Gerätenetz ausgehend Internet, und wer betreut Router und Firewall?** *(Architektur)* → sehr wahrscheinlich ja (9. Oktober 2026): Der Mac erreichte Anlage und Internet über dieselbe Standard-Route, Gateway 192.168.10.x im Meyton-Netz (HTTP 200 zu example.com). Offen, ob die Schnittstelle (`en0`) Kabel oder WLAN war, und wer den Router betreut.
- **Standard-Zugang zur SSMDB2 nutzen?** → ja (ein eigener Lese-Benutzer ist nicht vorgesehen).
- **Brücke direkt auf dem Meyton-Rechner (SUSE Linux) statt auf einem eigenen Gerät?** *(Architektur)* → offen, Tendenz ja (Wunsch des Users vom 7. Oktober 2026), zu entscheiden mit SP-0.4. Widerspricht [[adr-027]], das den „Agent auf dem Meyton-Server“ verworfen hat (Eingriff in ein Herstellergerät); umsetzen nur mit einer neuen ADR. Technisch passt es zur Empfehlung: Ein Go-Binary für linux/amd64 läuft ohne Laufzeit auch unter SUSE ([[spiegel-bridge]]). Vorteil: kein zusätzliches Gerät, kein Netzthema, die SSMDB2 liegt lokal. Antworten vom 8. Oktober 2026: Der Rechner ist ein gewöhnliches SUSE Linux, auf dem die Meyton-Software läuft. Root haben wir, die Brücke selbst braucht ihn nicht: Sie läuft als eigener Benutzer ohne Rechte; root braucht es nur einmal beim Einrichten (Benutzer und systemd-Unit). Löscht ein Meyton-Update die Brücke, installiert der User das Binary neu; ein Selbst-Update der Brücke ist dafür nicht nötig. Die Leistung reicht, die Brücke braucht wenig. Offen bleibt, ob Meyton Fremdsoftware auf dem Rechner duldet (Gewährleistung, Support). Puffer: Die Brücke hält keinen eigenen Zustand und seit dem 9. Oktober 2026 auch keine Probe (siehe unten).
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

## Sonderfälle (Review vom 5. Oktober 2026)

Der Katalog steht in [[spiegel-edge-cases]].

- **Probe aller Scheiben auf der Brücke puffern (sieben Tage), damit auch QR-Abholungen ihre Probe behalten?** *(Architektur)* → nein, nicht auf der Platte (8. Oktober 2026): Die Brücke hält keinen eigenen Zustand ([[adr-027]], Änderung vom 8. Oktober 2026). Erlaubt ist höchstens ein begrenzter Puffer im Arbeitsspeicher; auch ganz ohne Probe ist es in Ordnung, dann hat eine später abgeholte Scheibe nur, was der Schütze nach dem Umschalten auf Wertung am Monitor sieht. Ob ein Puffer nötig ist, zeigt SP-0.6. → **Entschieden (9. Oktober 2026, nach dem Abend-Mitschnitt, vom User delegiert): kein Puffer**, auch nicht im Arbeitsspeicher. Spiegel sammelt die Probe über die live gesehenen Snapshots; eine reine Probe ohne Neustart steht vollständig in der Ablage, die Probe vor einer Wertung hat keine Garantie ([[adr-027]], Änderung vom 9. Oktober 2026; SF-03, SF-72).
- **Überlebt eine reine Probe die Nacht und den Neustart der Anlage?** → **ja** (9. Oktober 2026): Probeschüsse vom 22. September stehen noch vollständig in der Ablage. Probe gibt es dort aber erst seit September 2026 ([[src-ssmdb2-kopie-2026-10-09]]).
- **Welche Bedienung löst den Neustart der Probe aus?** → offen; fünfmal an einem Abend beobachtet, die alte Probe ist danach gelöscht (SF-72).
- **Die erste automatisch zugeordnete Scheibe vom Schützen bestätigen lassen?** → offen; Empfehlung ja.
- **Wie oft wird nur auf Probe trainiert oder die Umschaltung auf Wertung vergessen?** → oft: am 9. Oktober 2026 hatten 13 von 17 Scheiben keinen Wertungsschuss, bis zu 60 Probeschüsse ([[src-ssmdb2-abend-2026-10-09]]). Spiegel behandelt beides als vollwertiges Training.
- **Lässt sich an unserer Anlage von Wertung zurück auf Probe schalten?** → offen (SP-0.6); am 9. Oktober 2026 kam es nicht vor.
- **Welche Disziplin-Varianten gibt es, und welche zählen zusammen?** → am 9. Oktober 2026 neun: LG 20, LG 40, LG Auflage 30, LP 40, LP Auflage 30 und die Varianten „alt“ (Regel 9110 und 9210) LG 40, LG 60, LP 40, LP 60; `shot-core` löst alle über den Katalog auf. Die ganze Liste zeigt die SQL-Checkliste (SP-0.1); der Admin pflegt die Familien.
- **Wird in der Probe das Visier verstellt, und soll Spiegel ein Ereignis „Visier verstellt“ anbieten?** → **Entschieden (8. Oktober 2026, User): nein.** Ein solches Ereignis ist zu viel Komplexität für seinen Nutzen; ohne Angabe rechnet Spiegel mit den letzten fünf Probeschüssen (SF-63). Der frühere Vorschlag (7. Oktober 2026) lautete: ja, nachträglich, weil die Daten ohnehin erst nach dem Schießen kommen und Meyton Verstellungen nicht aufzeichnet. (1) Spiegel schlägt bei einem deutlichen Lagesprung in der Probe vor („Nach P4 springt die Lage um 3,2 mm nach links. Hast du da verstellt?“), ein Tipp bestätigt; (2) von Hand „Hier verstellt“ zwischen zwei Probeschüssen setzen und wieder entfernen; (3) ohne Angabe rechnet Spiegel mit den letzten fünf Probeschüssen und sagt das auf der Karte. Live am Stand ginge es auch, weil das Ereignis über die Zeit am nächsten Schuss hängt. Offen: wie oft Schützen in der Probe wirklich verstellen (SP-0.6) und die Erkennung als Test (Schwerpunkt vor gegen nach einem Schuss, mehrere Kandidaten mit Bonferroni).
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
- **Notizen, Tags, Ausrüstung schon in Version 1?** → offen.
- **Trainer: wer sieht wessen Daten?** → offen.
- **Ergebnis per Link teilen?** → offen.

## Open Source

- **Lizenz?** → Apache-2.0 für das ganze Repo, wie seit Mai 2026 ([[adr-029]]).
- **Name vor der Veröffentlichung prüfen?** → „Spiegel“ ist ok.

## Design

- **Was heißt „moderner“?** → Die Vorschau trifft es; Design und Funktionen gefallen ([[spiegel-ui-design]]).
- **Nur dunkel oder hell und dunkel?** → offen. Neuer Vorschlag nach dem Review: Phase 1 nur dunkel, Tokens von Anfang an für beide. [[adr-030]] begründet den Hellmodus mit der Sonne am 50-m-Stand, den der Verein nicht hat, und ohne ihn halbiert sich die Sichtprüfung in SP-1.8.
- **Ringwert-Farben wie im Prototyp oder Meyton-Schema?** → offen.
- **Design 2 später für alle Apps?** → offen ([[adr-030]]).

## Betrieb und Recht

- **VPS auf 4 GB?** *(Architektur)* → nein, der VPS bleibt, wie er ist (VPS S, 2 GB). Spiegel muss ins bestehende Speicherbudget passen; laut Messung vom 5. Oktober (948 MiB verfügbar) tut es das ([[spiegel-architecture]]).
- **Swap-Datei als Sicherheitsnetz auf dem VPS?** → offen; kostet nichts, ist aber eine Änderung am VPS.
- **Wer verantwortet die Einwilligung?** → offen (SP-0.5).
- **Aufbewahrung und Nachladen der Historie?** → offen.
- **Gemeinsame Anmeldung für alle Apps?** → offen (SP-4.2).
- **Brücke als einzelnes Binary ohne Docker und Node?** → gewünscht, endgültig in SP-0.4 ([[adr-027]]).
