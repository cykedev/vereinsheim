---
id: spiegel-privacy
type: concept
title: "Spiegel — Datenschutz und Rollen"
aliases: [spiegel-datenschutz, spiegel-rollen, dsgvo-spiegel]
keywords: [datenschutz, dsgvo, einwilligung, widerruf, verantwortlicher, auftragsverarbeitung, avv, datensparsamkeit, verdeckte wertung, preisschießen, königsschießen, rollen, trainer, admin, freigabe, export, löschen, jugendliche, erziehungsberechtigte, fixtures, öffentliches repo]
part_of: ["[[spiegel]]"]
relates_to: ["[[spiegel-assignment]]", "[[spiegel-bridge]]", "[[treffsicher-user-isolation]]"]
---

**TL;DR** Schussdaten sind personenbezogen. Spiegel lädt nur Daten hoch, denen ein Schütze zugestimmt hat oder die er ausdrücklich abholt; verdeckte Wertung verlässt das Schützenhaus nie; privat ist Standard. Das ist eine technische Sicht, keine Rechtsberatung: den Einwilligungstext stimmt der Vorstand ab.

## Grundsätze

- **Einwilligung vor dem ersten Upload**, jederzeit widerrufbar. Das Opt-in per Sportpass ist genau diese Einwilligung: Wer seine Sportpassnummer verknüpft und zustimmt, dessen Scheiben werden automatisch hochgeladen; ohne Opt-in nur, was jemand selbst per QR abholt. Für Jugendliche willigen die Erziehungsberechtigten ein.
- **Verantwortlich ist der Verein.** Mit dem Hoster des VPS braucht es einen Vertrag zur Auftragsverarbeitung.
- **Datensparsamkeit in der Brücke:** Scheiben ohne zugestimmten Besitzer bleiben im Schützenhaus; die Brücke kennt dafür nur gehashte Kennungen ([[spiegel-bridge]]).
- **Verdeckte Wertung** (Meyton-Modus 5: Wert und Lage verdeckt, Modus 10: Wert verdeckt, unbekannte Modi) wird nie hochgeladen. Nach einem Preis- oder Königsschießen kann ein Admin freigeben.
- **Privat ist Standard.** Jeder sieht nur seine Scheiben (wie die Per-User-Isolation in Treffsicher, [[treffsicher-user-isolation]]).
- **Export und Löschen auf Knopfdruck:** JSON und CSV; Löschen entfernt Rohdaten, Ableitungen und PDFs.
- **Keine echten personenbezogenen Daten im öffentlichen Repo:** Test-PDFs und Beispieldaten anonymisiert oder synthetisch ([[adr-029]]).

## Rollen

| Rolle | Sieht | Darf |
|---|---|---|
| Schütze | eigene Scheiben, Verläufe, Vergleiche | zuordnen, Notizen, Freigaben, Export, Löschen |
| Trainer | was Schützen freigegeben haben, später auch live | kommentieren, Gruppen vergleichen |
| Vereinsadmin | Anlagen, Brücken-Status, Zuordnungen | koppeln, Zuordnungen bestätigen, Scheibenbilder pflegen; keine Schussbilder ohne Freigabe |
| Gast ohne Konto | nichts | mit Konto über den Meyton-QR einsteigen |

## Offene Abwägung

Weil Anlage und Brücke nach dem Training ausgeschaltet werden, ginge „Scheibe holen“ von zu Hause nur, wenn die Brücke Scheiben ohne Besitzer vorsorglich hochlädt: unsichtbar, nur per Abholung erreichbar, nach sieben Tagen gelöscht. Das verließe den Grundsatz „bleibt im Schützenhaus“. Mit dem Opt-in per Sportpass und dem QR-Weg (Ergebnis sofort aus dem PDF, Rohdaten beim nächsten Einschalten) ist das kaum noch nötig. Empfehlung: nicht vorsorglich hochladen; endgültig offen ([[spiegel-open-questions]]).
