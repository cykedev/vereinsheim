---
id: spiegel-vergleichen
type: concept
title: "Spiegel — Vergleichen: A gegen B auf einer eigenen Seite"
aliases: [vergleich-seite, a-gegen-b, scheibe-gegen-scheibe]
keywords: [vergleichen, vergleich, a gegen b, scheibe gegen scheibe, zeitraum gegen zeitraum, wettkampf gegen training, daheim auswärts, ort, merkmal, c2, c3, c5, c6, w1, w2, w3, w4, einflüsse, eigene seite, navigation, einstieg, sp-2.2, sp-2.7]
part_of: ["[[spiegel]]"]
governed_by: ["[[adr-030]]", "[[adr-033]]"]
relates_to: ["[[spiegel-langzeit]]", "[[spiegel-durchsicht]]", "[[spiegel-statistics]]", "[[spiegel-navigation]]", "[[spiegel-roadmap]]"]
---

**TL;DR** Alle Vergleiche laufen über eine eigene Seite „Vergleichen“: zwei Seiten A und B, jede eine Scheibe, ein
Zeitraum oder eine Art, später ein Ort oder ein Merkmal, immer eine Familie und eine Wertung. Die Seite antwortet mit
einem Satz, belegt mit dem Trefferbild beider Gruppen und wenigen Zahlen und führt alle übrigen Kennzahlen als Werkzeug.
Der heute im Fortschritt eingebaute Vergleich zieht dorthin um, der Fortschritt wird einfacher. Entschieden mit dem User
am 21. Oktober 2026; noch nicht gebaut (Plan 2 der Reihe in [[spiegel-roadmap]], SP-2.2).

# Spiegel — Vergleichen

## Warum eine eigene Seite

- **Nichts Bestehendes verkomplizieren.** Ein Vergleich, der in Scheibe oder Fortschritt eingebaut ist, verdoppelt dort
  jede Zahl (Wert, Vergleichswert, Δ, Urteil) und bringt eine zweite Kurve in den Verlauf. Die Durchsicht vom
  9. Oktober 2026 hat genau diese Dichte als Hauptproblem gemessen ([[spiegel-durchsicht]]).
- **Ein Ort für alle Vergleiche.** Zeitraum gegen Zeitraum (C3), Scheibe gegen Scheibe (C2), Wettkampf gegen Training
  (W1–W4), später Merkmal (C5, C6) und Ort sind dieselbe Frage: Ist A anders als B? Eine Seite mit zwei wählbaren Seiten
  beantwortet sie alle mit denselben Bausteinen.
- **Verworfen:** C2 auf der Seite einer Scheibe („Vergleichen mit: Scheibe davor · Beste · Wählen“) und C2 als Zeitraum
  aus einer Scheibe im Fortschritt (so stand es bis zum 21. Oktober 2026 in [[spiegel-langzeit]]). Das erste macht die
  Seite einer Scheibe voller, das zweite gibt dem Verlauf einen einzigen Punkt als Hauptbild.

## A und B

| Seite | Inhalt | Einheit des Tests |
|---|---|---|
| eine Scheibe | ihre Wertungsschüsse wie am Ausdruck | der Schuss |
| ein Zeitraum | rollend, frei oder benannt, mit Art und „nur Probe“ wie im Fortschritt | die Scheibe |
| eine Art | Wettkampf oder Training in einem Zeitraum | die Scheibe |
| ein Ort (später) | daheim oder auswärts, sobald es fremde Orte gibt ([[adr-033]]) | die Scheibe |
| ein Merkmal (später) | etwa Munitionslos, sobald es Angaben dafür gibt (SP-2.3) | die Scheibe |

- **Eine Familie, eine Wertung:** Beide Seiten gehören zur selben Disziplin-Familie und rechnen in derselben Wertung
  wie überall ([[spiegel-langzeit]], Prinzip 1).
- **Scheiben in beiden Seiten** zählen nur in A, wie heute im Fortschritt.
- **Zwei Scheiben** vergleicht Spiegel Schuss für Schuss (Werte, Lage, Streuung); sobald eine Seite mehrere Scheiben
  hat, ist die Scheibe die Einheit, wie in C3 ([[spiegel-statistics]]).

## Aufbau nach den drei Ebenen

1. **Antwort:** ein Satz, etwa „Im Wettkampf 0,2 Ringe je Schuss schwächer. Die Streuung ist gleich.“ Ein Urteil nur
   mit Test, sonst „kein klarer Unterschied“.
2. **Belege:** das Trefferbild beider Gruppen übereinander (A gefüllt, B als Linie) und wenige Zahlen mit Urteil in
   Alltagsworten, darunter die Grundlage („Lage über 7 von 9 Scheiben, 2 vom Ausdruck ohne Lage“).
3. **Werkzeug:** alle Kennzahlen beider Seiten, Fachbegriffe nur im Blatt „?“.

Eine Zeile Bedienung: die beiden Seiten als Chips, ein Tippen öffnet die Wahl als Blatt.

## Einstiege und Navigation

- **Kein Platz in der Navigation:** Die untere Leiste hat höchstens fünf Einträge, und das Tagebuch aus [[adr-033]]
  braucht einen. „Vergleichen“ ist eine Seite unter Fortschritt (`/progress/compare`, Bereich Fortschritt).
- **Von der Scheibe:** „Vergleichen“ öffnet A = diese Scheibe, B = die Scheibe davor in der Familie.
- **Aus der Liste:** zwei Scheiben markieren, dann „Vergleichen“ (die Auswahl in der Liste ist ohnehin offen,
  [[spiegel-navigation]]).
- **Aus dem Fortschritt:** Der Satz „Werde ich besser?“ führt mit seinem Paar (Zeitraum gegen Zeitraum davor) auf die
  Seite; aus dem Überblick der Analyse führt eine Erkenntnis wie „Im Wettkampf schwächer“ mit ihrem Paar dorthin.

## Was aus dem Fortschritt umzieht

„Vergleichen mit“ im Blatt „Filter“, die zweite Kurve im Verlauf und Vergleichswert, Δ und Urteil in Ergebnis-Box und
Kacheln. Der Satz im Kopf bleibt: Er vergleicht weiter still mit dem Zeitraum davor und verweist auf die Seite. Eine
Adresse mit `compare=` führt nach dem Umzug auf die Seite Vergleichen mit diesem Paar.

## Bezug zu ADR-033

- **Ein Kern für alle A-gegen-B-Fragen:** eine reine Funktion in `shot-core` über Werte je Scheibe (oder je Schuss bei
  zwei Scheiben), nicht in der Seite. Die Einflüsse des Tagebuchs (Befinden, K6) können denselben Kern nutzen, ohne
  dass der Ergebnisteil das Tagebuch kennt; die Abhängigkeit bleibt in eine Richtung.
- **Angaben statt Herkunft:** Jede Zahl der Seite nennt die Angabe, die sie braucht (Lage, Zeit, Zehntel). Scheiben vom
  Ausdruck oder von Hand zählen, so weit ihre Angaben reichen; eine Trefferlage als Summe zählt im Schwerpunkt, nie im
  Dichtebild.
- **Ort als Seite:** Sobald fremde Orte existieren, ist „auswärts gegen daheim“ nur eine weitere Wahl für A und B.

## Offen

- Wie die Wahl einer Seite im Blatt aussieht (Scheibe aus einer Liste, Zeitraum wie im Blatt „Filter“).
- Ob die Seite „Vergleichen“ sich die letzte Wahl merkt wie der Fortschritt den Zeitraum.
- W2–W4 (Schluss- und Startphase, Tempo unter Druck) als Zeilen der Seite brauchen Serien und Zeit; mit Plan 3.
