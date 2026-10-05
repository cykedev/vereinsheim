---
id: spiegel-privacy
type: concept
title: "Spiegel — Datenschutz und Rollen"
aliases: [spiegel-datenschutz, spiegel-rollen, dsgvo-spiegel]
keywords: [datenschutz, dsgvo, einwilligung, widerruf, verantwortlicher, auftragsverarbeitung, avv, datensparsamkeit, verdeckte wertung, preisschießen, königsschießen, rollen, trainer, admin, freigabe, export, löschen, jugendliche, erziehungsberechtigte, fixtures, öffentliches repo, probe-puffer, nicht meine, gäste-lan, netztrennung, protokolle, doppelt geprüft]
part_of: ["[[spiegel]]"]
relates_to: ["[[spiegel-assignment]]", "[[spiegel-bridge]]", "[[treffsicher-user-isolation]]"]
---

**TL;DR** Schussdaten sind personenbezogen. Spiegel lädt nur Daten hoch, denen ein Schütze zugestimmt hat oder die er ausdrücklich abholt; verdeckte Wertung verlässt das Schützenhaus nie; privat ist Standard. Das ist eine technische Sicht, keine Rechtsberatung: den Einwilligungstext stimmt der Vorstand ab.

## Grundsätze

- **Einwilligung vor dem ersten Upload**, jederzeit widerrufbar. Das Opt-in per Sportpass ist genau diese Einwilligung: Wer seine Sportpassnummer verknüpft und zustimmt, dessen Scheiben werden automatisch hochgeladen; ohne Opt-in nur, was jemand selbst per QR abholt. Gäste und Jugendliche unterstützt Spiegel vorerst nicht; Konten gibt es nur für erwachsene Mitglieder.
- **Verantwortlich ist der Verein.** Mit dem Hoster des VPS braucht es einen Vertrag zur Auftragsverarbeitung.
- **Datensparsamkeit in der Brücke:** Scheiben ohne zugestimmten Besitzer bleiben im Schützenhaus; die Brücke kennt dafür nur gehashte Kennungen ([[spiegel-bridge]]). Die Probe aller Scheiben puffert sie dort bis zu sieben Tage, weil Meyton sie womöglich mit dem ersten Wertungsschuss verwirft; hinaus geht sie nur mit Opt-in oder Abholung.
- **Doppelt geprüft:** Spiegel nimmt nur Scheiben an, die zu einem Opt-in oder einem offenen Auftrag passen ([[spiegel-ingest-pipeline]]).
- **Falsche Zuordnung:** Wählt jemand am Stand einen fremden Namen, landet seine Scheibe beim Falschen. „Nicht meine“ nimmt sie sofort heraus; ohne Besitzer wird sie gelöscht ([[spiegel-assignment]]).
- **Grabsteine:** Gelöschte und abgelehnte Scheiben merken sich Spiegel und Brücke als Grabstein, damit der nächste Abgleich sie nicht wieder hochlädt.
- **Netztrennung:** Die Handys sind im Gäste-LAN, Anlage und Brücke im Gerätenetz. Der Standard-Zugang zur SSMDB2 ist überall gleich; die Trennung hält ihn von den Handys fern.
- **Protokolle ohne Namen:** Diagnose und Logs der Brücke enthalten keine Namen und Sportpassnummern.
- **Verdeckte Wertung** (Meyton-Modus 5: Wert und Lage verdeckt, Modus 10: Wert verdeckt, unbekannte Modi) wird nie hochgeladen. Nach einem Preis- oder Königsschießen kann ein Admin freigeben.
- **Privat ist Standard.** Jeder sieht nur seine Scheiben (wie die Per-User-Isolation in Treffsicher, [[treffsicher-user-isolation]]).
- **Export und Löschen auf Knopfdruck:** JSON und CSV; Löschen entfernt Rohdaten (alle Zeilenversionen), Ableitungen und PDFs und setzt Grabsteine; aus den Backups verschwinden die Daten mit deren Rotation.
- **Keine echten personenbezogenen Daten im öffentlichen Repo:** Test-PDFs und Beispieldaten anonymisiert oder synthetisch ([[adr-029]]).

## Rollen

| Rolle | Sieht | Darf |
|---|---|---|
| Schütze | eigene Scheiben, Verläufe, Vergleiche | zuordnen, Notizen, Freigaben, Export, Löschen |
| Trainer | was Schützen freigegeben haben, später auch live | kommentieren, Gruppen vergleichen |
| Vereinsadmin | Anlagen, Brücken-Status, Zuordnungen | koppeln, Zuordnungen bestätigen, Scheibenbilder pflegen; keine Schussbilder ohne Freigabe |
| Gast ohne Konto | nichts | vorerst nicht vorgesehen |

## Offene Abwägung

Weil Anlage und Brücke nach dem Training ausgeschaltet werden, ginge „Scheibe holen“ von zu Hause nur, wenn die Brücke Scheiben ohne Besitzer vorsorglich hochlädt: unsichtbar, nur per Abholung erreichbar, nach sieben Tagen gelöscht. Das verließe den Grundsatz „bleibt im Schützenhaus“. Mit dem Opt-in per Sportpass und dem QR-Weg (Ergebnis sofort aus dem PDF, Rohdaten beim nächsten Einschalten) ist das kaum noch nötig. Empfehlung: nicht vorsorglich hochladen; endgültig offen ([[spiegel-open-questions]]).
