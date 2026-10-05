---
id: spiegel-open-questions
type: guide
title: "Spiegel — Offene Fragen und Antworten"
aliases: [spiegel-fragen, spiegel-faq]
keywords: [offene fragen, antworten, entscheidungen, fragenkatalog, klärung, phase 0]
part_of: ["[[spiegel]]"]
relates_to: ["[[spiegel-roadmap]]"]
---

**TL;DR** Der Fragenkatalog zu Spiegel mit dem Stand der Antworten. Fragen, die das Konzept verändern, sind markiert; beantwortete tragen Datum und Antwort. Neue Antworten hier eintragen und, wenn sie eine Entscheidung sind, als ADR festhalten.

# Spiegel — Offene Fragen und Antworten

**Legende:** *(Architektur)* = verändert das Konzept. Antworten vom 5. Oktober 2026, wenn nicht anders vermerkt.

## Anlage und Netz

- **ShootMaster-Version?** → 6.0.2. Das Schema bringt alles mit (Probe, Wertungsmodus, BesterTeiler001).
- **Ist der SSMDB2-Dienst im Kontrollzentrum aktiv (Echtzeit)?** → offen (SP-0.1).
- **Landen Trainings ohne Starter in der SSMDB2?** *(Architektur)* → unbekannt, SP-0.1.
- **Zeigt Meyton den QR auch ohne Starter? Was steht in Link und PDF?** *(Architektur)* → teilweise: Link auf ein PDF bei Meyton (HTTP, feste IP, zufälliger Name), im PDF Stand, Zeiten, Name mit #Nummer und eine ID ([[meyton-printout]]). Offen: QR ohne Starter (SP-0.2).
- **Router mit Internet und Gerät mit fester IP im Meyton-Netz?** *(Architektur)* → ja.
- **Standard-Zugang zur SSMDB2 nutzen?** → ja (ein eigener Lese-Benutzer ist nicht vorgesehen).
- **Läuft die Anlage dauerhaft?** *(Architektur)* → nein: Meyton-Anlage und Brücke werden nach jedem Trainingsabend ausgeschaltet ([[spiegel-bridge]]).
- **Wie wird ausgeschaltet: Herunterfahren oder Strom aus?** → offen; bestimmt, wie robust das Dateisystem der Brücke sein muss.
- **Liegen die PDF-Ausdrucke auch auf der Meyton-Freigabe `ERGEBNIS`?** → offen (SP-0.1); dann bekäme auch der Opt-in-Weg das Original-PDF automatisch.
- **Welche Stände und Disziplinen gibt es?** → offen; bestimmt die Scheibenbilder für Version 1.
- **SDF und LANA?** → LANA nutzt ihr nicht; SDF offen (nur für Live).
- **Umstieg auf die neue Meyton-Linie ESTANX geplant?** → offen; bräuchte einen zweiten Adapter.

## Schützen und Zuordnung

- **Wie melden sich Schützen am Stand an?** *(Architektur)* → Schützenliste oder frei zugewiesen, kein LANA.
- **Wie wird zugeordnet?** *(Architektur)* → Opt-in per Sportpass als Standard („automatisch hochladen“), Meyton-QR mit Original-PDF für alles andere ([[adr-028]]).
- **Ist die SportpassID in der Schützenliste gepflegt?** → offen; Voraussetzung für das Opt-in.
- **Sollen Scheiben ohne Besitzer vorsorglich hochgeladen werden, damit „Scheibe holen“ auch von zu Hause geht?** → offen; Empfehlung nein ([[spiegel-privacy]]).
- **Fundbüro am Stand?** → kein Tablet und kein Display; „Scheibe holen“ in Spiegel am Abend reicht, falls überhaupt nötig.
- **Frist für Fundsachen?** → Vorschlag sieben Tage.
- **Wie viele aktive Schützen?** → offen.
- **Gäste und Jugendliche?** → offen (Einwilligung der Eltern).

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
- **Nur dunkel oder hell und dunkel?** → offen; Vorschlag beides.
- **Ringwert-Farben wie im Prototyp oder Meyton-Schema?** → offen.
- **Design 2 später für alle Apps?** → offen ([[adr-030]]).

## Betrieb und Recht

- **VPS auf 4 GB?** → offen.
- **Wer verantwortet die Einwilligung?** → offen (SP-0.5).
- **Aufbewahrung und Nachladen der Historie?** → offen.
- **Gemeinsame Anmeldung für alle Apps?** → offen (SP-4.2).
- **Brücke als einzelnes Binary ohne Docker und Node?** → gewünscht, endgültig in SP-0.4 ([[adr-027]]).
