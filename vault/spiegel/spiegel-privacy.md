---
id: spiegel-privacy
type: concept
title: "Spiegel — Datenschutz und Rollen"
aliases: [spiegel-datenschutz, spiegel-rollen, dsgvo-spiegel]
keywords: [datenschutz, dsgvo, einwilligung, hinweistext, sp-0.5, widerruf, verantwortlicher, auftragsverarbeitung, avv, datensparsamkeit, verdeckte wertung, preisschießen, königsschießen, rollen, trainer, admin, freigabe, export, löschen, jugendliche, erziehungsberechtigte, fixtures, öffentliches repo, probe-puffer, nicht meine, gäste-lan, netztrennung, protokolle, doppelt geprüft]
part_of: ["[[spiegel]]"]
relates_to: ["[[spiegel-assignment]]", "[[spiegel-bridge]]", "[[treffsicher-user-isolation]]"]
---

**TL;DR** Schussdaten sind personenbezogen. Spiegel lädt nur Daten hoch, denen ein Schütze zugestimmt hat oder die er ausdrücklich abholt; verdeckte Wertung verlässt das Schützenhaus nie; privat ist Standard. Das ist eine technische Sicht, keine Rechtsberatung. Einen vom Vorstand abgestimmten Einwilligungstext gibt es nicht; der Schütze bestätigt in Spiegel einen eigenen Hinweistext selbst.

## Grundsätze

- **Einwilligung vor dem ersten Upload**, jederzeit widerrufbar. Das Opt-in per Sportpass ist genau diese Einwilligung: Wer seine Sportpassnummer verknüpft und zustimmt, dessen Scheiben werden automatisch hochgeladen; ohne Opt-in nur, was jemand selbst per QR abholt. Gäste und Jugendliche unterstützt Spiegel vorerst nicht; Konten gibt es nur für erwachsene Mitglieder.
- **Hinweistext statt Text vom Vorstand:** Einen Einwilligungstext vom Vorstand gibt es nicht (SP-0.5 entfällt). Spiegel zeigt beim Opt-in einen eigenen Hinweistext mit Version, den der Schütze im Profil selbst bestätigt; Spiegel speichert Zeitpunkt und Version der Bestätigung. Der Wortlaut steht unveränderlich im Code (`CONSENT_TEXTS` in `apps/spiegel/src/lib/consent/texts.ts`, Tests halten v1 und v2 fest), ein neuer ist eine neue Version. Ein Admin bestätigt danach; eintragen kann er nichts ([[spiegel-assignment]]). Es gilt **v2**: Sie sagt auch, dass Spiegel ältere Scheiben holt und dass ein Admin je Konto die Zahl der Scheiben und den Tag der letzten sieht; bestehende v1-Zustimmungen (nur Dev) bleiben.
- **Widerruf** jederzeit im Profil. Danach lädt die Brücke nichts mehr; schon hochgeladene Scheiben bleiben, der Schütze löscht sie selbst.
- **Restrisiko beim Eintragen** (bewusst so gelassen): Ein angemeldetes Konto kann ausprobieren, ob eine SportpassID schon in Spiegel steht („schon vergeben“), ohne zu erfahren, wem sie gehört. Eine abgelehnte Zeile belegt die Nummer, bis der Schütze sie entfernt oder der Admin sie löscht; der Schütze kann danach neu zustimmen, der Admin muss erneut ablehnen. Bei rund 15 Mitgliedern ohne Selbstregistrierung (Konten legt nur ein Admin an) und mit Bestätigung durch Admin und erste Scheibe ist das vertretbar; wird es ein Problem, bleibt eine Ablehnung stehen, bis der Admin sie entfernt.
- **Verantwortlich ist der Verein.** Mit dem Hoster des VPS braucht es einen Vertrag zur Auftragsverarbeitung.
- **Datensparsamkeit in der Brücke:** Scheiben ohne zugestimmten Besitzer bleiben im Schützenhaus; die Brücke kennt dafür nur gehashte Kennungen ([[spiegel-bridge]]). Sie hält keinen eigenen Zustand; die Probe fremder Scheiben höchstens begrenzt im Arbeitsspeicher, bis zum Ausschalten. Hinaus geht sie nur mit Opt-in oder Abholung.
- **Doppelt geprüft:** Spiegel nimmt nur Scheiben an, die zu einem Opt-in oder einem offenen Auftrag passen ([[spiegel-ingest-pipeline]]).
- **Falsche Zuordnung:** Wählt jemand am Stand einen fremden Namen, landet seine Scheibe beim Falschen. „Nicht meine“ nimmt sie sofort heraus; ohne Besitzer wird sie gelöscht ([[spiegel-assignment]]). Bei der ersten Scheibe entfernt „Nicht meine“ die Scheibe mit Revisionen, Schüsse, Projektion, Ausdrucke, ihre Rohdaten (Stände im Fenster von 30 Tagen um den Beginn, Zeilen ohne verbliebenen Stand), dazu ein Grabstein.
- **Grabsteine:** Abgelehnte und fremde Scheiben („Nicht meine“) merken sich Spiegel und Brücke als Grabstein, damit der nächste Abgleich sie nicht wieder hochlädt. Ein Grabstein trägt, wer gemeldet hat und unter welcher SportpassID die Scheibe kam, keine Schussdaten. Der Schütze sieht seine Meldungen mit Tag und Uhrzeit im Papierkorb, der Admin nur ihre Zahl in der Übersicht.
- **Eigene Scheibe löschen** ([[spiegel-navigation]]): erst 30 Tage Papierkorb, danach endgültig. Es bleibt eine weiche Sperre, nur der Schlüssel ohne Schussdaten, auch an die Brücke verteilt. Sie verhindert, dass der Abgleich die Scheibe von selbst zurückbringt. Ein ausdrückliches Holen (QR, „Scheibe holen“) soll sie aufheben; das kommt mit diesen Wegen (SP-1.7 b, SP-2.4). Nur der Schütze selbst sieht seine Sperren, im Papierkorb. An die Brücke gehen Sperren und Grabsteine nur für Scheiben der letzten 60 Tage (`GET /state`); ältere liest die Brücke ohnehin nicht mehr, und Spiegel verwirft einen Stand dazu selbst (`isKeyBlocked`).
- **Netztrennung:** Die Handys sind im Gäste-LAN, Anlage und Brücke im Gerätenetz. Der Standard-Zugang zur SSMDB2 ist überall gleich; die Trennung hält ihn von den Handys fern.
- **Protokolle ohne Namen:** Diagnose und Logs der Brücke enthalten keine Namen und Sportpassnummern.
- **Verdeckte Wertung** (Meyton-Modus 5: Wert und Lage verdeckt, Modus 10: Wert verdeckt, unbekannte Modi) wird nie hochgeladen. Nach einem Preis- oder Königsschießen kann ein Admin freigeben.
- **Privat ist Standard.** Jeder sieht nur seine Scheiben (wie die Per-User-Isolation in Treffsicher, [[treffsicher-user-isolation]]).
- **Export und Löschen auf Knopfdruck:** JSON und CSV; Löschen entfernt Rohdaten (alle Zeilenversionen), Ableitungen und PDFs und setzt Grabsteine; aus den Backups auf dem Server verschwinden die Daten mit deren Rotation (14 Tage). **Ausnahme:** Kopien der Sicherungen auf dem Rechner des Betreibers (`vereinsheim local-pull` nach `./backups/`, `dev-restore`, lokaler Stack) rotieren nicht; dort bleiben auch gelöschte Daten, bis der Betreiber die Kopie ersetzt oder löscht.
- **Keine echten personenbezogenen Daten im öffentlichen Repo:** Test-PDFs und Beispieldaten anonymisiert oder synthetisch ([[adr-029]]).

## Rollen

| Rolle | Sieht | Darf |
|---|---|---|
| Schütze | eigene Scheiben, Verläufe, Vergleiche | zuordnen, Notizen, Freigaben, Export, Löschen |
| Trainer | was Schützen freigegeben haben, später auch live | kommentieren, Gruppen vergleichen |
| Vereinsadmin | Anlagen, Brücken-Status, Zuordnungen; je Konto nur Zahl der Scheiben, Tag der letzten und Wartende | verbinden, Sportpassnummern bestätigen, Scheibenbilder pflegen; keine Schussbilder, keine Ergebnisse ohne Freigabe |
| Gast ohne Konto | nichts | vorerst nicht vorgesehen |

## Offene Abwägung

Weil Anlage und Brücke nach dem Training ausgeschaltet werden, ginge „Scheibe holen“ von zu Hause nur, wenn die Brücke Scheiben ohne Besitzer vorsorglich hochlädt: unsichtbar, nur per Abholung erreichbar, nach sieben Tagen gelöscht. Das verließe den Grundsatz „bleibt im Schützenhaus“. Mit dem Opt-in per Sportpass und dem QR-Weg (Ergebnis sofort aus dem PDF, Rohdaten beim nächsten Einschalten) ist das kaum noch nötig. Empfehlung: nicht vorsorglich hochladen; endgültig offen ([[spiegel-open-questions]]).
