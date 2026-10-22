---
id: spiegel-vergleichen
type: concept
title: "Spiegel — Vergleichen: A gegen B auf einer eigenen Seite"
aliases: [vergleich-seite, a-gegen-b, scheibe-gegen-scheibe]
keywords: [vergleichen, vergleich, a gegen b, scheibe gegen scheibe, zeitraum gegen zeitraum, wettkampf gegen training, wettkampf und training, daheim auswärts, ort, merkmal, c2, c3, c5, c6, w1, w2, w3, w4, einflüsse, eigene seite, navigation, einstieg, umrisse, zwei farben, compare, sp-2.2, sp-2.7]
part_of: ["[[spiegel]]"]
governed_by: ["[[adr-030]]", "[[adr-033]]"]
relates_to: ["[[spiegel-langzeit]]", "[[spiegel-durchsicht]]", "[[spiegel-statistics]]", "[[spiegel-navigation]]", "[[spiegel-roadmap]]"]
---

**TL;DR** Alle Vergleiche laufen über die eigene Seite „Vergleichen“ (`/compare`): zwei Scheiben, zwei Zeiträume oder
Wettkampf und Training, später ein Ort oder ein Merkmal, immer eine Familie und eine Wertung. Die Seite antwortet mit
einem Satz, belegt mit einem Bild beider Seiten (auf die Gruppe gezoomt, Lupe für die ganze Scheibe) und einer ruhigen
Tabelle aller Zahlen, in der ein klarer Unterschied golden steht. Erreichbar über „Zeitraum · Vergleichen“ oben im
Fortschritt und am Desktop über einen Untereintrag. Der Vergleich aus dem Fortschritt ist dorthin umgezogen. Entschieden mit dem User am
21. Oktober 2026, gebaut am selben Tag (Plan 2 der Reihe in [[spiegel-roadmap]], SP-2.2).

# Spiegel — Vergleichen

## Warum eine eigene Seite

- **Nichts Bestehendes verkomplizieren.** Ein Vergleich, der in Scheibe oder Fortschritt eingebaut ist, verdoppelt dort
  jede Zahl (Wert, Vergleichswert, Δ, Urteil) und bringt eine zweite Kurve in den Verlauf. Die Durchsicht vom
  9. Oktober 2026 hat genau diese Dichte als Hauptproblem gemessen ([[spiegel-durchsicht]]).
- **Ein Ort für alle Vergleiche.** Zeitraum gegen Zeitraum (C3), Scheibe gegen Scheibe (C2), Wettkampf gegen Training
  (W1), später Merkmal (C5, C6) und Ort sind dieselbe Frage: Ist A anders als B? Eine Seite mit zwei wählbaren Seiten
  beantwortet sie alle mit denselben Bausteinen.
- **Verworfen:** C2 auf der Seite einer Scheibe („Vergleichen mit: Scheibe davor · Beste · Wählen“) und C2 als Zeitraum
  aus einer Scheibe im Fortschritt. Das erste macht die Seite einer Scheibe voller, das zweite gibt dem Verlauf einen
  einzigen Punkt als Hauptbild.

## Bedienung

- **Oben die Art** als Segment: „Zwei Scheiben · Zwei Zeiträume · Wettkampf und Training“. Beide Seiten sind immer von
  derselben Art. Ein Wechsel beginnt mit den Vorgaben der Art, bei zwei Scheiben mit den beiden neuesten der Familie.
- **Darunter eine Zeile:** die Familie (auch bei zwei Scheiben: ein Wechsel nimmt die beiden neuesten der anderen
  Familie), die Chips A (blau) und B (orange), bei Wettkampf und Training ein Chip für den Zeitraum, bei zwei Zeiträumen
  die Art für beide Seiten, am Ende die Wertung der Familie („In Zehnteln“ / „In ganzen Ringen“) wie im Fortschritt;
  umschalten speichert sie für alle Übersichten.
- **Ein Tippen auf einen Chip** öffnet ein Blatt: bei Scheiben die Scheiben der Familie (die neueste zuerst, 30 auf einmal,
  „Mehr zeigen“, die Scheibe der anderen Seite geht nicht), bei Zeiträumen dieselben Felder wie im Blatt „Filter“
  (`PeriodChoiceFields`), bei B dazu „Zeitraum davor“.
- **Die Adresse** hält die ganze Wahl, der Server rechnet jede Wahl neu. Ohne Angaben: die letzten 90 Tage gegen den
  Zeitraum davor. Eine Erinnerung an die letzte Wahl gibt es nicht.

## A und B

| Seite | Inhalt | Einheit des Tests |
|---|---|---|
| eine Scheibe | ihre Wertungsschüsse wie am Ausdruck | der Schuss |
| ein Zeitraum | rollend, frei, benannt oder „davor“, mit Art und „nur Probe“ wie im Fortschritt | die Scheibe |
| eine Art | Wettkampf (A) oder Training (B) in einem Zeitraum (Vorgabe zwölf Monate) | die Scheibe |
| ein Ort (später) | daheim oder auswärts, sobald es fremde Orte gibt ([[adr-033]]) | die Scheibe |
| ein Merkmal (später) | etwa Munitionslos, sobald es Angaben dafür gibt (SP-2.3) | die Scheibe |

- **Eine Familie, eine Wertung:** Beide Seiten gehören zur selben Disziplin-Familie und rechnen in der Wertung der
  Familie wie überall ([[spiegel-langzeit]], Prinzip 1). Zwei Scheiben aus verschiedenen Familien vergleicht die Seite
  nicht und sagt das.
- **Scheiben in beiden Zeiträumen** zählen nur in A; die Grundlage nennt sie.
- **Die Tests** ([[spiegel-statistics]], C2, C3, Belege B26–B28), ein Urteil ab 5 Einheiten je Seite:
  - Ø je Schuss: Mann-Whitney über die Werte der Schüsse (zwei Scheiben); bei Zeiträumen der Ø über alle Schüsse,
    geurteilt über Schüsse und Abende ([[adr-034]], `compareValues`).
  - Streuung: Der Wert ist σ. Getestet werden die Abstände der Schüsse zur Mitte ihrer Scheibe (zwei Scheiben) bzw.
    die gepoolten Varianzen, bei wandernder Präzision σ je Abend (Zeiträume, B29).
  - Lage: Hotelling-T² für zwei Stichproben über die Lagen der Schüsse (zwei Scheiben) bzw. die Mitten aller Schüsse
    über zwei Ebenen (Zeiträume, `compareCenterGroups`).

## Aufbau nach den drei Ebenen

1. **Antwort:** ein Satz über das Ergebnis je Schuss („In den letzten 90 Tagen 0,12 Ringe je Schuss mehr als im
   Zeitraum davor. Das ist ein klarer Unterschied.“), ein zweiter über Streuung und Lage. Ein Urteil nur mit Test.
2. **Belege:** das Bild beider Seiten mit der Legende der Namen, darunter eine Tabelle mit allen Zahlen (die Kacheln des
   Fortschritts und die Lage). Die Spalten heißen nach den Seiten („6 Monate“, „davor“, „02.10.“, „Wettkampf“). Ein klar
   besserer Wert steht golden, liegen die Mitten klar auseinander, der Abstand; die Regel steht einmal unter der Tabelle,
   darunter die Grundlage („A: 10 Scheiben, 398 Schuss. B: …“). Bei zwei Scheiben haben nur Ø je Schuss, Streuung und
   Lage einen Test; die übrigen Zahlen stehen ohne Gold. Fachbegriffe nur im Blatt „?“.
   Die beiden Spalten sind gleich breit und tragen nur Zahlen, die Einheit steht leise beim Namen der Zeile; die Lage
   ist eine Zahl für beide Seiten und steht als eigene Zeile darunter.
3. **Raster wie Scheibe und Fortschritt:** linksbündig, nicht zentriert; ab 768 px links das Bild, rechts Tabelle und
   Grundlage (`PAGE_COLUMNS`).
4. **Verworfen nach dem ersten Bau:** drei Zeilen mit einem Urteilssatz je Zeile und „Alle Kennzahlen“ eingeklappt. Der
   User fand das doppelt und unruhig (21. Oktober 2026).

## Das Bild

An den echten Scheiben des Users verglichen (Prototyp am 21. Oktober 2026, wieder entfernt):

- **Zwei Zeiträume und Wettkampf/Training:** zwei Umrisse auf einer Scheibe, je Seite die Fläche mit der Hälfte der
  Schüsse durchgezogen (A getönt) und die mit 9 von 10 gestrichelt, dazu beide Mitten mit einem Ring in der Farbe ihrer
  Seite. Ab 50 Schuss mit Lage je Seite, darunter Punkte wie bei zwei Scheiben. Hat eine Seite über 3.000 Schuss, ist
  sie immer ein Umriss, auch neben einer kleinen Seite mit Punkten („mixed“): So gehen nie mehr als 3.000 Punkte einer
  Seite an den Browser (etwa wenige Wettkämpfe gegen viel Training).
- **Zwei Scheiben:** beide übereinander, jeder Schuss in der Farbe seiner Seite, dazu beide Mitten. Die Ringwerte stehen
  in den Zahlen.
- **Zoom:** Das Bild öffnet auf der Gruppe beider Seiten (bei Umrissen bis 95 von 100 Schüssen um ihre gemeinsame Mitte,
  bei Punkten bis zum weitesten, Ausschnitt wie `groupView` der Scheibe). Die Lupe oben links zeigt die ganze Scheibe
  und zurück, wie auf der Seite einer Scheibe.
- **Mitten** tragen einen Ring in der Farbe ihrer Seite, keine Buchstaben; die Namen stehen in der Legende darunter.
- **Farben:** die Tokens `compare-a` (Blau) und `compare-b` (Orange), in beiden Darstellungen gleich wie die Scheibe;
  Linien und Buchstaben mit dunklem Saum. Text bleibt in der Schriftfarbe.
- **Verworfen:** zwei Bilder nebeneinander (man schaut hin und her, am Telefon je etwa 165 px), A als Treffer in
  Dichtefarbe mit B als Umriss (ungleich gewichtet), bei zwei Scheiben A gefüllt und B als Ring (zu unruhig).

## Einstiege und Navigation

- **Unterseite von Fortschritt:** Die untere Leiste hat höchstens fünf Einträge (mit Scannen voll), und das Tagebuch aus
  [[adr-033]] braucht einen. Deshalb steht oben im Fortschritt und auf der Seite selbst der Umschalter
  „Zeitraum · Vergleichen“ (Links, `ProgressSwitch`), am Desktop zusätzlich „Vergleichen“ eingerückt unter Fortschritt in
  der Seitenleiste (`FrameItem.sub`). Auf dem Telefon ist dann Fortschritt markiert. Die Adresse ist `/compare` (schon im
  Routen-Modell), nicht `/progress/compare`.
- **Von der Scheibe:** „Mit der Scheibe davor vergleichen“ über „Teilen“, A = diese Scheibe, B = die davor in der Familie.
- **Aus dem Fortschritt:** „Genauer vergleichen“ hinter dem Satz „Werde ich besser?“ mit seinem Paar, bei „Alles“ die
  letzten 90 Tage gegen die 90 davor.
- **Von Start:** Die Zeile „Form der letzten 90 Tage“ führt mit genau diesem Paar auf die Seite.
- **Aus der Liste:** zwei Scheiben markieren, dann „Vergleichen“; offen, mit der Auswahl in der Liste (SP-1.8).

## Was aus dem Fortschritt umgezogen ist

„Vergleichen mit“ im Blatt „Filter“, die zweite Kurve im Verlauf und Vergleichswert, Δ und Urteil in Ergebnis-Box und
Kacheln gibt es in Spiegel nicht mehr. Die geteilten Bausteine behalten den Vergleich (`withCompare`), Treffsicher nutzt
ihn weiter. Der Satz im Kopf vergleicht still mit dem Zeitraum davor und verweist auf die Seite. Eine Adresse mit
`compare=` leitet der Server mit ihrem Paar auf die Seite um.

## Bezug zu ADR-033

- **Ein Kern für alle A-gegen-B-Fragen:** reine Funktionen in `shot-core` (`compareSides`, `compareCenters`,
  `compareShots`, `comparePicture`) über Werte und Punkte, nicht über Spiegels Scheiben. Die Einflüsse des Tagebuchs
  (Befinden, K6) können denselben Kern nutzen, ohne dass der Ergebnisteil das Tagebuch kennt.
- **Angaben statt Herkunft:** Jede Zahl der Seite nennt die Angabe, die sie braucht. Scheiben ohne Lage zählen im
  Ergebnis, nicht im Bild, und die Grundlage nennt sie. Eine Trefferlage als Summe (Ausdruck) kann später als Mitte einer
  Scheibe in die Lage zählen, nie in das Bild.
- **Ort als Seite:** Sobald fremde Orte existieren, ist „auswärts gegen daheim“ nur eine weitere Art.

## Offen

- Die Auswahl zweier Scheiben in der Liste (SP-1.8).
- Ort und Merkmal als Arten (nach [[adr-033]] bzw. SP-2.3).
- W2–W4 (Schluss- und Startphase, Tempo unter Druck) als Zeilen der Seite brauchen Serien und Zeit; mit Plan 3.
