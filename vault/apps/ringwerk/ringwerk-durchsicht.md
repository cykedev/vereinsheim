---
id: ringwerk-durchsicht
type: concept
title: "Ringwerk-Durchsicht — drei Ebenen am Telefon"
aliases: [ringwerk-usability-durchsicht]
keywords: [durchsicht, bedienbarkeit, usability, drei ebenen, antwort, telefon, erster bildschirm, liga, tabelle, spielplan, wo stehe ich, wann schieße ich, playoffs, einstieg, phase, dashboard, start, abkürzungen, RT, Pkt, Sp, Bracket, mitglied, sportleitung, prüfbestand]
feature_of: ["[[ringwerk]]"]
governed_by: ["[[adr-032]]"]
relates_to: ["[[spiegel-durchsicht]]", "[[ringwerk-design2]]", "[[ringwerk-pruefbestand]]", "[[treffsicher-durchsicht]]"]
---

**TL;DR** Gemessen am 20. Oktober 2026 am Telefon (390 × 844) an allen 95 Wettbewerben des Prüfbestands, als Mitglied
(445 Seiten) und als Sportleitung (572 Seiten; `pnpm --filter ringwerk durchsicht`). Event und Saison zeigen die
Antwort zuerst. In der Liga steht die Tabelle unter dem ganzen Spielplan: Bei 16 Teilnehmern mit Hin- und Rückrunde
sind das bis zu 26 Bildschirme bis „Wo stehe ich?“. Der Einstieg in eine Liga bleibt beim Spielplan, auch wenn die
Playoffs laufen. Ringwerk trägt den Wettkampfbetrieb: Alles hier sind Vorschläge, jede Änderung gibt der User einzeln
frei und gleicht sie mit dem Prüfbestand ab ([[ringwerk-pruefbestand]]).

# Ringwerk-Durchsicht

Methode wie [[spiegel-durchsicht]] (`@vereinsheim/pruefen/measure`), am Prüfbestand, damit jede Phase gemessen ist.
Die Bilder der ersten Bildschirme liegen lokal unter `reports/durchsicht/ringwerk/`.

## Messung (Median über die Wettbewerbe einer Art; in Klammern der erste Bildschirm)

| Seite (Mitglied) | Länge | Bedienelemente | Zahlen |
|---|---|---|---|
| Event, Rangliste | 1–1,6 | 2–3 (2–3) | 26–63 (26–35) |
| Saison, Rangliste | 1,1 | 4 (4) | 40 (40) |
| Liga bis zur Gruppenphase | 1 (max. 4,8) | 3–5 (3–4) | 2–4, max. 212 (2–4) |
| Liga in den Playoffs, Seite „Spielplan & Tabelle“ | 1,5–4,6 (max. 26,1) | 5 (4–5) | 18–141, max. 1.512 (10–22) |
| Start, 95 Wettbewerbe | 38,2 | 75 (2) | 964 (15) |
| Wettbewerbe, 95 | 60,8 | 282 (7) | 1.494 (12) |

Als Sportleitung tragen die Seiten 10–18 Bedienelemente im ersten Bildschirm (Ergebnisse eintragen, Spielplan,
Playoffs): Arbeitsansichten, gewollt. Fachbegriffe: die Kürzel „RT“, „Best. RT“, „Pkt.“, „Sp.“, „korr.“ und „Faktor“.

| Frage | Urteil |
|---|---|
| Wo stehe ich in der Liga? | mühsam: die Tabelle steht unter allen Paarungen |
| Wo stehe ich im Event, in der Saison? | gut: Rangliste im ersten Bildschirm |
| Wann schieße ich wieder? | nicht beantwortbar: Konten und Teilnehmer sind nicht verknüpft, das Mitglied sucht sich im Spielplan |
| Wie steht das Achtelfinale? | mühsam: der Einstieg zeigt die Gruppenphase, die Playoffs sind ein Reiter weiter |

## Befunde (Vorschläge)

- **R1 Tabelle vor dem Spielplan:** `competitions/[id]/schedule/page.tsx` setzt den Spielplan vor die Tabelle. Die
  Antwort („Wo stehe ich?“) gehört nach oben, der Spielplan darunter, nach Spieltagen gegliedert, der laufende
  aufgeklappt.
- **R2 Einstieg folgt der Phase:** `competitions/[id]/page.tsx` leitet eine Liga immer auf „Spielplan & Tabelle“.
  Laufen die Playoffs, wäre der Turnierbaum die Antwort.
- **R3 Start knapp:** Jede Karte auf Start zeigt ihre ganze Tabelle oder den ganzen Baum. Eine Karte mit einem Satz
  (Stand, Spitze, nächste Runde) und dem Weg zum Wettbewerb hielte Start bei vielen Wettbewerben kurz. Gemessen ist das
  am Prüfbestand mit 95 Wettbewerben; die echten Daten haben 11.
- **R4 Kürzel in Tabellen:** „RT“, „Pkt.“, „Sp.“, „korr.“ ausschreiben, wo Platz ist; am Telefon mit „?“
  ([[ringwerk-design2]], Hilfe). Die PDFs bleiben, wie sie sind.
- **R5 „Wann schieße ich wieder?“:** braucht eine Verknüpfung von Konto und Teilnehmer. Das ist eine Änderung am
  Datenmodell und eine eigene Entscheidung, keine Anpassung der Oberfläche.
- **R6 Turnierbaum mit 16:** 4–9 Bildschirme am Telefon; der erste zeigt das Achtelfinale. Die laufende Runde zuerst
  wäre die Antwort.

Nicht gemessen: Start und Liste an der Kopie der echten Daten (nur ein Admin-Konto aktiv).
