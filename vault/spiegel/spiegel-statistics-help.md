---
id: spiegel-statistics-help
type: guide
title: "Spiegel — Statistik verstehen (Hilfe)"
aliases: [statistik-hilfe, hilfe, erklärungen, statistik verstehen, glossar]
keywords: [hilfe, erklärung, erklären, verstehen, einfache sprache, glossar, so liest du, was heißt das, 95 prozent, vertrauensbereich, unsicherheit, echt, unklar, mindestzahl, sigma, r50, streukreis, ringbreiten, form, ellipse, ausreißer, schwerpunkt, lage, hotelling, vertrauensellipse, ringverlust, richtungsuhr, drift, von neumann, tempo, rhythmus, pause, wiedereinstieg, ermüdung, trend, gleitender schnitt, serien, konstanz, quote, wilson, zehnerquote, innenzehner, teiler, median, iqr, mad, probe, eingeschossen, fehlschlüsse, regression zur mitte, mann-kendall, trefferbild, fehlschuss, verdächtiger schuss, leave-one-out]
part_of: ["[[spiegel]]"]
relates_to: ["[[spiegel-statistics]]", "[[spiegel-ui-design]]", "[[spiegel-metrics]]", "[[spiegel-vision]]"]
---

**TL;DR** Hilfe zu jeder Auswertung in Spiegel, in einfacher Sprache: was die Zahl misst, wie du sie
liest, was du damit tun kannst und wo du dich täuschen kannst. Quelle ist das Paket
`@vereinsheim/shot-help` (SP-1.11), aus dem auch die Hilfe in der App und in der Spielwiese kommt.
Die Definitionen stehen im Katalog [[spiegel-statistics]]; hier kommen erst die Worte, die Formel
steht jeweils am Ende.

Der Teil unten ist aus dem Paket erzeugt. Texte ändert man in `packages/shot-help/src/` und schreibt
diese Seite dann mit `pnpm --filter @vereinsheim/shot-help docs` neu. Ein Test im Paket vergleicht
beide und macht das Gate rot, wenn nur eine Seite geändert ist.

<!-- shot-help:start · erzeugt aus packages/shot-help (pnpm --filter @vereinsheim/shot-help docs), nicht von Hand ändern -->

## So liest du die Zahlen

- **Schusszahl n.** Jede Zahl steht auf einer Grundlage, die Zeile „Datenlage“ unter der Analyse
  nennt sie. Reicht die Schusszahl nicht, steht „–“ mit dem Grund („ab 10 Schuss“), nie eine 0.
- **95-%-Bereich.** „σ 1,12 mm, 95 %: 0,94 bis 1,36 mm“ heißt bei 30 Schuss: Dein wahrer Wert liegt
  mit großer Sicherheit in diesem Bereich. Mehr Schüsse machen ihn schmaler. Bei 10 Schuss reicht er
  für σ von etwa einem Viertel darunter bis knapp die Hälfte darüber, erst bei rund 120 Schuss auf
  etwa ±10 %.
- **„Echt“ und „unklar“.** „Echt“ heißt: Reiner Zufall brächte ein so deutliches Ergebnis nur in 5
  von 100 Fällen. Weil auf einer Scheibe mehrere Tests laufen, zeigt trotzdem etwa jede fünfte ganz
  normale Scheibe irgendwo ein „echt“, „gestreckt“, „klar“ oder einen Ausreißer. „Unklar“ heißt
  nicht „gibt es nicht“, sondern: Diese Schüsse reichen nicht, um es zu zeigen oder auszuschließen.
  Mehr Schüsse oder mehrere Scheiben klären es. Auf den Karten heißt das auch „nicht klar“, „vom
  Zufall nicht zu unterscheiden“ oder „kein Versatz nachweisbar“; es ist ein ehrliches Ergebnis,
  kein Fehler.
- **Ganze Ringe oder Zehntel.** Oben umschalten; jede Auswertung über Werte gibt es in beiden, nur
  die Zehntelverteilung allein in Zehnteln. In ganzen Ringen gehen Feinheiten verloren (10,0 und
  10,9 sind beide eine 10); beim Luftgewehr ist ein Trend dort deshalb etwas seltener „klar“. Gleich
  bleiben Zehner, Innenzehner und Zehnerquote.
- **Probe und Wertung.** Lage, Streuung und Tempo der Analyse rechnen über die Wertung, ohne Probe;
  gibt es nur Probe, über die Probe. Die Probe hat einen eigenen Reiter: „Probe gegen Wertung“ nimmt
  die ganze Probe vor der Wertung, „Eingeschossen?“ ihre letzten fünf Schüsse.
- **Nummern.** Wertungsschüsse heißen 1, 2, 3 …, Probeschüsse P1, P2 …, in der Reihenfolge der
  Abgabe. Fehlt einem Schuss eine Angabe, behält er trotzdem seine Nummer.
- **Median statt Durchschnitt.** Wo „Median“ steht, zählt der mittlere Wert: Die Hälfte liegt
  darüber, die Hälfte darunter. Ein einzelner Ausreißer verschiebt ihn kaum, den Durchschnitt (Ø)
  schon.
- **Millimeter statt Teiler.** Der Teiler ist der Abstand zur Mitte in 1/100 mm. Für Gruppen rechnet
  Spiegel in Millimetern um ihren eigenen Schwerpunkt.

## Auf dem Bildschirm

**Trefferbild**
- *Was:* Jeder Treffer in Kalibergröße, gefärbt nach seinem Ring: 10 rot, 9 gold, 8 türkis, 7 und
  weniger violett. Probeschüsse sind hohl. Die Treffer sind leicht durchscheinend, damit du siehst,
  wo sie sich überlagern.
- *So liest du es:* Die Knöpfe in den Ecken blenden ein: unten links den Schwerpunkt (kleiner
  schwarz-weiß geviertelter Kreis, der Mittelpunkt deiner Treffer) und den Streukreis (blauer Ring
  um alle Treffer; seine Zahl misst Mitte zu Mitte), unten rechts die Vertrauensellipse
  (gestrichelt: wo dein wahrer Schwerpunkt mit großer Sicherheit liegt; liegt die Mitte darin, ist
  ein Versatz nicht belegt) und die Schussnummern. Oben links zoomt die Lupe auf deine Treffer und
  wieder zurück; daneben zeigt der Knopf mit den Punkten die übrigen Schüsse blass oder blendet sie
  aus.

**Beobachtungen in Worten**
- *Was:* Die wichtigsten Befunde dieser Scheibe als Sätze, gebildet aus denselben Zahlen wie die
  Karten.
- *So liest du es:* „Echt“ oder „klar“ steht nur, wenn ein Test es zeigt: Reiner Zufall brächte das
  nur in 5 von 100 Fällen. Sonst sagt der Satz ehrlich, dass die Schüsse nicht reichen. Weil mehrere
  Tests laufen, trifft es bei etwa jeder fünften ganz normalen Scheibe einmal zufällig zu.

**Probe auf der Scheibe**
- *Was:* Die Probeschüsse um die Mitte, hohl gezeichnet, dazu der Schwerpunkt der Wertung als
  kleiner geviertelter Kreis.

## Ergebnis

**Ergebnis und Ø je Schuss (E1, E2)**
- *Was:* Das Ergebnis ist die Summe aller Wertungsschüsse, der Ø der Durchschnitt je Schuss.
  Probeschüsse zählen nicht mit.
- *So liest du es:* Der Ø je Schuss vergleicht Scheiben mit verschiedener Schusszahl fair, das
  Ergebnis nur Scheiben mit gleich vielen Schüssen. Oben schaltest du zwischen ganzen Ringen und
  Zehnteln um. Was dir zum Höchstwert fehlt, zeigt „Ringverlust nach Ursache“.
- *Vorsicht:* Fehlt einem Schuss der Wert, gibt es kein Ergebnis: Eine Summe über einen Teil der
  Schüsse wäre keins. Den Ø gibt es trotzdem, über die Schüsse mit Wert.
- *Mindestzahl:* Ab 1 Schuss.
- *Formel:* `Ergebnis = Σ vᵢ (Zehntel) bzw. Σ Ringᵢ; Ø = Σ vᵢ / n über die Schüsse mit Wert`

**Ringverteilung (V1)**
- *Was:* Wie viele Schüsse in jedem Ring liegen, dazu die Innenzehner.
- *So liest du es:* Wichtig ist die Form. Ein langer Schwanz nach unten heißt: einzelne schwache
  Schüsse. Ein breiter Block über drei, vier Ringe heißt: allgemein zu viel Streuung.
- *Was du tun kannst:* Beim Schwanz die Karten „Ausreißer“ und „Pausen und Wiedereinstieg“ ansehen,
  beim Block an der Präzision arbeiten.
- *Mindestzahl:* Ab 1 Schuss.
- *Formel:* `Anzahl je Ring 10 … 0`

**Zehntelverteilung (V2)**
- *Was:* Dieselbe Zählung in Zehnteln, jede Säule ein Wert (10,4, 10,5 …). Es gibt sie nur in der
  Zehntelwertung.
- *So liest du es:* Sie zeigt, wo innerhalb der Ringe deine Schüsse liegen. Viele Werte knapp unter
  einer Ringgrenze (9,8, 9,9) kosten in ganzen Ringen jeweils einen Ring.
- *Vorsicht:* Einzelne Säulen sind bei einer Scheibe Zufall; aussagekräftig ist die Gesamtform, etwa
  viele Werte knapp unter einer Ringgrenze.
- *Mindestzahl:* Ab 1 Schuss.
- *Formel:* `Anzahl je Zehntelwert 0,0 … 10,9`

**Beste und weiteste Teiler (E8)**
- *Was:* Die drei kleinsten und die drei größten Teiler mit Schussnummer, wie auf dem
  Meyton-Ausdruck. Der kleinste Teiler ist dein bester Schuss, der größte dein schwächster.
- *So liest du es:* Der Teiler misst feiner als der Wert: Zwei Schüsse mit 10,9 unterscheiden sich
  im Teiler noch. Bei gleichem Teiler nennt Spiegel den früheren Schuss.
- *Vorsicht:* Ein verdächtiger Schuss (Platzhalter, Handeintrag) zählt hier nicht: Er trägt nur den
  amtlichen Wert, nicht deine Leistung. Der beste Teiler wird mit mehr Schüssen besser; vergleiche
  ihn nur bei gleicher Schusszahl.
- *Mindestzahl:* Ab 1 Schuss mit Lage.
- *Formel:* `Teiler = Abstand zur Mitte in 1/100 mm`

**Serien und Konstanz (E10, I1)**
- *Was:* Das Ergebnis jeder Serie, wie stark die Serien schwanken (Standardabweichung, Spanne) und
  wie stark ein einzelner Schuss typischerweise schwankt (MAD).
- *So liest du es:* Kleine Spanne heißt gleichmäßig. Die Spanne wächst aber mit der Zahl der Serien;
  Scheiben mit verschieden vielen Serien vergleichst du über die Standardabweichung. Verglichen
  werden nur Serien der häufigsten Länge; fehlt einem Schuss der Wert, hat seine Serie keine Summe.
- *Was du tun kannst:* Fällt eine Serie ab, sieh im Reiter „Zeit und Verlauf“ nach, ob davor eine
  Pause lag („Pausen und Wiedereinstieg“) oder ob es zum Ende hin nachlässt („Ermüdung“).
- *Vorsicht:* Wie gleichmäßig du wirklich schießt, zeigt erst der Vergleich über mehrere Scheiben.
- *Mindestzahl:* Ab 1 Schuss, die Schwankung ab 2 Serien gleicher Länge.
- *Formel:* `SD und Spanne der Serien gleicher Länge; MAD = Median |vᵢ − Median v|`

**Quoten mit Unsicherheit (E4, E5, E11, I10)**
- *Was:* Der Anteil deiner Schüsse ab einer Schwelle (Zehner, ab 9,0, ab 10,5) mit 95-%-Bereich,
  dazu die Zahl deiner Zehner und Innenzehner und die längste Folge ab 10,0.
- *So liest du es:* Der Punkt ist gemessen, der Balken zeigt, wo dein wahrer Anteil wahrscheinlich
  liegt. Bei 40 Schuss ist er noch breit: Bei 20 Treffern von 40 reicht er etwa von 35 % bis 65 %.
- *Vorsicht:* Liegen die Balken zweier Abende nicht übereinander, ist der Unterschied echt.
  Überlappen sie sich nur ein Stück, kann er trotzdem echt sein; liegt der Punkt des einen Abends im
  Balken des anderen, ist er nicht belegt. Innenzehner von Gewehr und Pistole sind nicht
  vergleichbar, und die längste Folge wird mit mehr Schüssen länger. In ganzen Ringen erreicht eine
  Schwelle über 10,0 keiner.
- *Mindestzahl:* Ab 1 Schuss.
- *Formel:* `Anteil = Anzahl ab Schwelle / n; 95-%-Bereich nach Wilson`

## Präzision

**Präzision σ (P5)**
- *Was:* Wie stark deine Treffer um ihren eigenen Schwerpunkt streuen, als eine Zahl in mm. Bei
  einer runden Gruppe liegen etwa 39 % der Treffer innerhalb von σ um den Schwerpunkt und 86 %
  innerhalb von 2σ.
- *So liest du es:* Kleiner ist besser. σ hängt kaum von der Schusszahl ab und ist deshalb das
  richtige Maß, um einen Abend mit 20 Schuss mit einem mit 40 zu vergleichen.
- *Vorsicht:* Bei 10 Schuss reicht der 95-%-Bereich von etwa einem Viertel darunter bis knapp die
  Hälfte darüber; bei stark gestreckten Gruppen ist er etwas zu schmal. Ein Fehlschuss zählt bei σ
  mit und kann es vervielfachen; R50 lässt ihn weg.
- *Mindestzahl:* Ab 3 Schuss.
- *Formel:* `σ̂ = √(Σ rᵢ² / (2(n − 1))) / c4(2n − 1); 95-%-Bereich über χ² mit 2(n − 1)
  Freiheitsgraden`

**Maße der Gruppe (P1, P4, P6, P9)**
- *Was:* Der Streukreis ist der kleinste Kreis um alle Trefferzentren, Mitte zu Mitte; die Zahl ist
  sein Durchmesser. R50 ist der Radius um den Schwerpunkt, in dem die Hälfte der Treffer liegt, ohne
  Fehlschüsse. Streuung x und y sind die typischen Abweichungen waagrecht und senkrecht.
- *So liest du es:* R50 stören einzelne weite Schüsse kaum. In Ringbreiten (Luftgewehr 2,5 mm,
  Luftpistole 8 mm) heißt ein R50 von 0,5: Die Hälfte deiner Treffer liegt innerhalb einer halben
  Ringbreite um den Schwerpunkt; so lassen sich Gewehr und Pistole grob vergleichen. Ist die
  Streuung y deutlich größer als x, streust du vor allem senkrecht; ob das mehr als Zufall ist, sagt
  die Karte „Form der Gruppe“.
- *Vorsicht:* Der Streukreis wird mit jedem weiteren Schuss größer oder bleibt gleich: Über 40
  Schuss ist er bei gleicher Präzision im Mittel rund 30 % größer als über 10. R50 fällt bei wenigen
  Schüssen etwas zu klein aus, bei 10 Schuss um etwa 4 %. Ein Fehlschuss bläht Streukreis und
  Streuung auf, R50 nicht. Abende mit unterschiedlicher Schusszahl vergleichst du über σ.
- *Mindestzahl:* Ab 3 Schuss, R50 ab 5.
- *Formel:* `Streukreis = Durchmesser des kleinsten umschließenden Kreises (Welzl); R50 = Median der
  rᵢ ohne Fehlschüsse; Streuung mit n − 1; in Ringbreiten: R50 / W`

**Form der Gruppe (P8)**
- *Was:* Die Streuung als Ellipse: Das Verhältnis a/b sagt, wie gestreckt sie ist, der Winkel, in
  welche Richtung.
- *So liest du es:* „Gestreckt“ steht nur, wenn ein Test zeigt, dass es kein Zufall ist. Daneben
  steht, ab welchem a/b das bei deiner Schusszahl gilt: bei 20 Schuss ab 1,81, bei 40 ab 1,50, bei
  120 ab 1,25.
- *Vorsicht:* Auch eine vollkommen runde Gruppe sieht zufällig gestreckt aus: bei 20 Schuss im
  Median a/b 1,33, bei 40 Schuss 1,21. Eine leichte echte Streckung zeigt eine einzelne Scheibe
  deshalb selten; sichtbar wird sie über mehrere Scheiben.
- *Mindestzahl:* Ab 3 Schuss; den Winkel zeigt Spiegel nur bei einer gestreckten Gruppe ab 10
  Schuss.
- *Formel:* `Halbachsen a, b aus der Kovarianz; gestreckt, wenn W = 4a²b² / (a² + b²)² < 0,05^(2/(n
  − 2)) (Mauchly, exakt)`

**Ausreißer (V6, V7)**
- *Was:* Spiegel prüft die Treffer Schritt für Schritt: zuerst den, der am weitesten von den übrigen
  liegt, gemessen an ihrer Streuung, dann ohne ihn den nächsten, ab 10 Schuss bis zu jedem zehnten
  Schuss. So verdecken sich zwei nahe Ausreißer nicht gegenseitig. Bei einer ganz normalen, runden
  Gruppe meldet die Regel höchstens in 5 % der Scheiben fälschlich einen Ausreißer. Ist die Gruppe
  deutlich gestreckt (a/b um 2), passiert das öfter, umso öfter, je mehr Schüsse die Scheibe hat:
  bei 10 Schuss in etwa 11 %, bei 60 Schuss in etwa 18 % der Scheiben.
- *So liest du es:* Ein markierter Schuss ist ein Kandidat für die Frage „Was war da los?“ und
  bleibt in der Wertung. Darunter steht, wie viele Ringe die markierten Schüsse gegenüber deinem
  typischen Schuss (Median) gekostet haben.
- *Was du tun kannst:* Kosten dich Ausreißer über mehrere Scheiben viele Ringe, lohnt die Arbeit an
  einem gleichmäßigen Ablauf mehr als an der Präzision.
- *Vorsicht:* Ein Ausreißer liegt weit von deiner Gruppe, nicht unbedingt weit von der Mitte: Liegt
  die Gruppe neben der Mitte, kann er sogar Ringe bringen. Unter 10 Schuss prüft Spiegel nur einen
  Schritt, dort können sich zwei gleich weite Ausreißer noch verdecken. Bei 10 Schuss findet die
  Regel einen einzelnen sehr weiten Schuss in etwa neun von zehn Fällen, von zwei nah beieinander in
  etwa acht von zehn Fällen beide.
- *Mindestzahl:* Ab 5 Schuss mit Lage.
- *Formel:* `Schritt für Schritt mit den m übrigen Schüssen: T = d² / (2S² (1 + 1/(m − 1))) für den
  weitesten gegen das (1 − 0,04/m)-Quantil von F(2, 2(m − 2)), dann ohne ihn weiter; höchstens
  max(2, ⌊n/10⌋) Schritte ab 10 Schuss, darunter einer; Ausreißer sind alle bis zum letzten Schritt
  über seiner Grenze; Kosten = Σ (Median der übrigen − vᵢ) über die markierten Schüsse`

## Lage

**Ist die Lage echt? (L1, L2, L3)**
- *Was:* Der Schwerpunkt ist der Mittelpunkt aller Treffer, auf der Scheibe der kleine schwarz-weiß
  geviertelte Kreis. Er ist selbst nur geschätzt: Die Vertrauensellipse zeigt, wo dein wahrer
  Schwerpunkt mit großer Sicherheit liegt. Ein Test (Hotelling) prüft, ob der Versatz zur Mitte mehr
  als Zufall ist; er sagt dasselbe wie die Ellipse: Liegt die Mitte darin, ist der Versatz nicht
  belegt.
- *So liest du es:* Die Lage steht als Abstand und Richtung zur Mitte da, etwa 0,72 mm, davon 0,6 mm
  rechts und 0,4 mm tief. „Echt versetzt“: Eine Korrektur an Visier oder Anschlag kann sich lohnen.
  „Vom Zufall nicht zu unterscheiden“: nicht am Visier drehen, auch wenn der Schwerpunkt neben der
  Mitte liegt. Die Ellipse hat die Form deiner Gruppe und schrumpft mit der Schusszahl: Ihre
  Halbachse ist bei 10 Schuss etwa so groß wie deine Streuung σ, bei 40 Schuss etwa 0,4 σ. Sie zeigt
  nicht, wo deine Schüsse liegen, nur wo ihr Mittelpunkt liegen kann.
- *Was du tun kannst:* Ist die Lage echt versetzt, zeigt „Ringverlust nach Ursache“, wie viele Ringe
  eine Korrektur etwa bringt.
- *Mindestzahl:* Schwerpunkt ab 2 Schuss, der Test ab 3.
- *Formel:* `T² = n · m′ S⁻¹ m gegen 2(n − 1)/(n − 2) · F₀,₉₅(2, n − 2)`

**Ringverlust nach Ursache (E9, L4)**
- *Was:* Dein Ringverlust ist, was dir zum Höchstwert fehlt (10 je Schuss, in Zehnteln 10,9).
  Spiegel teilt ihn auf: Jeder Treffer wird um den Schwerpunkt der übrigen Schüsse verschoben und
  neu gewertet. Was das bringt, ist der Verlust durch die Lage, der Rest der Verlust durch die
  Streuung.
- *So liest du es:* Großer Lage-Anteil: Visier oder Anschlag. Großer Streuungs-Anteil: Präzision.
  Der Ringverlust ist die Zahl, die du kleiner machen willst; er wächst mit der Schusszahl.
- *Vorsicht:* Ohne echten Versatz ist der Lage-Anteil meist leicht negativ: Eine Korrektur würde
  dann Ringe kosten. Belastbar erst ab 10 Schuss, wenn die Lage echt ist und die Korrektur etwas
  bringt. Gewertet wird aus der Lage: Fehlt einem Wertungsschuss die Lage oder ist er verdächtig,
  gibt es keinen Ringverlust, nur die Aufteilung über die übrigen. Nie amtlich.
- *Mindestzahl:* Ab 2 Schuss mit Lage, belastbar ab 10; den Ringverlust gibt es nur, wenn jeder
  Wertungsschuss eine Lage hat.
- *Formel:* `Ringverlust = n · 10,9 − Σ vᵢ bzw. n · 10 − Σ Ringᵢ; zentriert: (pᵢ − m) · n/(n − 1),
  jeder Treffer um den Schwerpunkt der übrigen verschoben; Lage = zentriert − Ist; Streuung =
  Höchstwert − zentriert`

**Richtungsuhr (L6)**
- *Was:* Wie viele Treffer in welche Richtung gehen, 12 Uhr ist oben, um die Mitte oder um den
  Schwerpunkt.
- *So liest du es:* Um die Mitte zeigt sie, wohin deine Treffer gehen; um den Schwerpunkt, in welche
  Richtungen deine Gruppe streut, etwa vor allem nach oben und unten. Jeder Treffer zählt gleich,
  ein weiter so viel wie ein naher.
- *Vorsicht:* Erst ab 30 Schuss mehr als ein Bild, und auch dann schwankt sie stark: Bei 30 Schuss
  hat der stärkste Keil zufällig meist doppelt so viele Treffer wie der Schnitt. Ein Befund ist
  erst, was sich über mehrere Scheiben wiederholt.
- *Mindestzahl:* Ab 1 Schuss, aussagekräftig ab 30.
- *Formel:* `Anzahl je 30°-Sektor um die Mitte oder um m`

**Drift und Wanderung (L8, I6)**
- *Was:* Ob die Sprünge von Schuss zu Schuss zu deiner Streuung passen (von-Neumann-Verhältnis) und
  wie der Schwerpunkt von Serie zu Serie wandert.
- *So liest du es:* Sind deine Schüsse unabhängig voneinander, liegt die Zahl um 2. Deutlich
  darunter wandert die Gruppe langsam, etwa weil sich der Anschlag im Lauf des Abends verändert.
- *Vorsicht:* Spiegel urteilt hier nicht: Auch ohne jedes Wandern liegt die Zahl zufällig bei 10
  Schuss etwa zwischen 1,2 und 2,8 und bei 40 Schuss zwischen 1,6 und 2,4.
- *Mindestzahl:* Ab 3 Schuss mit Lage, die Wanderung ab 2 Serien mit je 2 Schuss mit Lage.
- *Formel:* `von Neumann = (Σ Sprung² / k) / (Σ rᵢ² / (n − 1)) mit k Sprüngen; um 2 bei unabhängigen
  Schüssen`

## Zeit und Verlauf

**Verlauf je Schuss und Trend (I3, I4)**
- *Was:* Jeder Punkt ist ein Schuss, die Linie der Schnitt der letzten zehn (gestrichelt, solange es
  noch keine zehn sind). Der Trend ist eine Ausgleichsgerade durch alle Schüsse; die Zahl sagt, wie
  viele Ringe du je 10 Schuss zulegst oder verlierst.
- *So liest du es:* „Klar fallend“ heißt: Ein so deutlicher Abfall entstünde durch Zufall allein
  höchstens in 5 von 100 Scheiben; „klar steigend“ gilt ebenso nach oben. Sonst ist der Trend „nicht
  klar“, auch wenn die Linie etwas fällt oder steigt.
- *Vorsicht:* Selbst ein deutliches Nachlassen zeigt eine einzelne Scheibe selten als „klar“. Beim
  Luftgewehr, wo fast alle Schüsse 9 oder 10 sind, ist ein Trend in ganzen Ringen etwas seltener
  klar. Zeigen Test und Gerade in verschiedene Richtungen (etwa wegen eines sehr schwachen letzten
  Schusses), gibt es kein Urteil.
- *Mindestzahl:* Ab 1 Schuss, der Trend ab 10.
- *Formel:* `gleitender Schnitt über die letzten 10; Trend: Steigung der Ausgleichsgeraden je 10
  Schuss; „klar“ nach Mann-Kendall mit Korrektur für gleiche Werte (95 %), wenn die Gerade dieselbe
  Richtung zeigt`

**Rhythmus (Z5)**
- *Was:* Jede Säule ist der Abstand zum vorigen Schuss, die Linie der Median der letzten fünf
  Abstände. Pausen über drei Minuten sind markiert und zählen nicht hinein.
- *So liest du es:* Eine ruhige Linie heißt: gleichmäßiger Ablauf. Wird sie zum Ende länger oder
  unruhiger, lohnt der Blick auf die Ermüdung.
- *Mindestzahl:* Ab 2 Schuss mit Zeit.
- *Formel:* `Median der letzten 5 Abstände ohne Pausen`

**Tempo und Dauer (Z1, Z2, Z3)**
- *Was:* Das Tempo ist der Median der Abstände zwischen zwei Schüssen; Pausen über drei Minuten
  zählen nicht. Die Tempo-Streuung sagt, wie gleichmäßig das ist: Die mittlere Hälfte deiner
  Abstände liegt in einem Fenster dieser Breite. Dazu die Dauer vom ersten bis zum letzten Schuss.
- *Vorsicht:* Gleichmäßiger ist nicht automatisch besser. Die Streuung ist ein Merkmal, das du mit
  deinem Ergebnis vergleichen kannst.
- *Mindestzahl:* Tempo ab 3 Schuss, Tempo-Streuung ab 4, Dauer ab 2.
- *Formel:* `Tempo = Median der Abstände ohne Pausen über 180 s; Tempo-Streuung = Q3 − Q1 der
  Abstände; Dauer = letzter − erster Schuss`

**Pausen und Wiedereinstieg (Z4)**
- *Was:* Jede Pause über drei Minuten und ob die bis zu drei Wertungsschüsse danach im Schnitt mehr
  oder weniger Ringe brachten als deine übrigen Schüsse.
- *Vorsicht:* Drei Schüsse sind wenig: Auch wenn die Pause nichts ausmacht, liegen sie zufällig bis
  zu etwa einen halben Ring (Luftgewehr, σ 1,5 mm) bzw. anderthalb Ringe (Luftpistole, σ 15 mm) je
  Schuss neben deinem Schnitt. Ob dir Pausen schaden, zeigt erst der Vergleich über mehrere Abende.
- *Mindestzahl:* Ab 2 Wertungsschüssen mit Zeit und Wert.
- *Formel:* `Pause = Abstand über 180 s; Wiedereinstieg = Ø der bis zu 3 Schüsse danach − Ø der
  übrigen`

**Ermüdung (I2)**
- *Was:* Die letzten zehn Schuss gegen die ersten zehn, im Wert und in der Streuung (R50).
- *So liest du es:* Ein Minus beim Wert oder ein Plus bei R50 heißt: am Ende schwächer.
- *Vorsicht:* Eine einzelne Scheibe ist verrauscht: Auch ohne jede Ermüdung unterscheiden sich die
  ersten und die letzten zehn zufällig um bis zu etwa 0,35 Ringe je Schuss (Luftgewehr, σ 1,5 mm)
  bzw. 1,1 (Luftpistole, σ 15 mm), R50 um bis zu gut die Hälfte. Ein Muster wird es erst, wenn es
  auf mehreren Scheiben so ist.
- *Mindestzahl:* Ab 20 Wertungsschüssen mit Wert, R50 ab 20 mit Lage ohne Fehlschüsse.
- *Formel:* `Ø der letzten 10 − Ø der ersten 10; ebenso R50`

**Serien im Vergleich (I1, I5, I6)**
- *Was:* Je Serie das Ergebnis, die Streuung (R50) und wie weit ihr Schwerpunkt vom Schwerpunkt der
  ganzen Scheibe liegt.
- *So liest du es:* Wandert der Schwerpunkt der Serien deutlich in eine Richtung, ändert sich etwas
  im Anschlag.
- *Vorsicht:* Auch ohne jede Veränderung liegt der Schwerpunkt einer Zehnerserie im Mittel etwa ein
  Drittel σ neben dem der Scheibe, und R50 einer Serie schwankt stark.
- *Mindestzahl:* R50 ab 5 Schuss in der Serie, der Versatz ab 2.
- *Formel:* `Versatz = |Schwerpunkt der Serie − Schwerpunkt der Scheibe|`

## Probe

**Umfang der Probe (S2)**
- *Was:* Wie viele Probeschüsse du vor dem ersten Wertungsschuss abgegeben hast, auch in Blöcken zu
  zehn, wie lange die Probe dauerte und wie viel Zeit vom ersten Probeschuss bis zum ersten
  Wertungsschuss verging.
- *Vorsicht:* Probe nach Beginn der Wertung zählt hier nicht, und Platzhalter bringen keine Zeit
  mit.
- *Mindestzahl:* Ab 1 Probeschuss.

**Probe gegen Wertung (S3)**
- *Was:* Durchschnitt, R50 und σ der ganzen Probe vor der Wertung gegen die Wertung.
- *So liest du es:* σ ist der fairere Vergleich: R50 fällt bei wenigen Schüssen etwas zu klein aus,
  und die Probe hat meist weniger Schüsse.
- *Vorsicht:* Ein Fehlschuss zählt bei σ mit und bläht es auf; R50 lässt ihn weg. Mit wenigen
  Probeschüssen ist auch σ unsicher: Bei gleicher Präzision liegt σ aus fünf Probeschüssen zufällig
  zwischen etwa der Hälfte und dem Anderthalbfachen von σ der Wertung.
- *Mindestzahl:* σ ab 3, R50 ab 5 Schuss je Seite.

**Eingeschossen? (S1, S4)**
- *Was:* Ein Test deiner letzten fünf Probeschüsse vor der Wertung: Lagen sie echt neben der Mitte?
  Dazu der Abstand zwischen ihrem Schwerpunkt und dem der Wertung.
- *So liest du es:* „Echt neben der Mitte“: Deine letzten Probeschüsse lagen daneben. Ob die Wertung
  mit diesem Versatz weiterging, zeigt der Versatz Probe → Wertung.
- *Vorsicht:* „Kein Versatz nachweisbar“ heißt nicht „eingeschossen“: Fünf Schüsse erkennen nur
  einen deutlichen Versatz. Selbst ein Versatz so groß wie zweimal deine Streuung σ fällt nur in
  knapp zwei von drei Fällen auf.
- *Mindestzahl:* Ab 3 Probeschüssen mit Lage, der Abstand zur Wertung zusätzlich ab 3
  Wertungsschüssen mit Lage.
- *Formel:* `Hotelling-T² über die letzten fünf Probeschüsse mit Lage; Versatz = |m Probe − m
  Wertung|`

## Datenlage

**Datenlage (Q1)**
- *Was:* Wie viele Wertungs- und Probeschüsse die Analyse hat, wie vielen Lage, Zeit oder Wert
  fehlen und welche Schüsse markiert sind (Fehlschuss, verdächtig).
- *So liest du es:* Je mehr fehlt, desto weniger tragen die Zahlen. Ein Schuss ohne Lage fehlt bei
  Streuung und Lage, ohne Zeit bei Tempo und Rhythmus. Fehlt einem Wertungsschuss der Wert, gibt es
  kein Ergebnis, keine Zahl der Zehner und Innenzehner und keine Summe seiner Serie; Ø und Quoten
  rechnen ohne ihn. Ein verdächtiger Schuss zählt nur mit seinem Wert, auch wenn er eine Lage oder
  Zeit hat.
- *Vorsicht:* In Zehnteln fehlt beim Ergebnis auch ein Schuss, der nur einen ganzen Ring hat.

## Glossar

- **Schwerpunkt:** Mittelpunkt aller Treffer (Meyton: Trefferlage).
- **Streukreis:** Kleinster Kreis um alle Trefferzentren, Mitte zu Mitte; die Zahl ist sein
  Durchmesser. Meyton druckt einen „Trefferkreis“; ob er genau dasselbe misst, prüft Spiegel noch an
  Rohdaten.
- **Vertrauensellipse:** Bereich um den gemessenen Schwerpunkt, in dem der wahre Schwerpunkt mit
  großer Sicherheit (95 %) liegt. Liegt die Scheibenmitte darin, ist ein Versatz nicht belegt. Sie
  schrumpft mit der Schusszahl, die Gruppe nicht.
- **σ (Sigma):** Typische Streuung um den Schwerpunkt in mm, kaum von der Schusszahl abhängig.
- **R50:** Radius um den Schwerpunkt, in dem die Hälfte der Treffer liegt, ohne Fehlschüsse.
- **Fehlschuss:** Ein Nuller oder ein Treffer weit außen, in den Daten markiert; R50 lässt ihn weg,
  die übrigen Maße zählen ihn mit.
- **Verdächtiger Schuss:** Platzhalter oder Handeintrag; er zählt nur mit seinem amtlichen Wert, nie
  mit Lage, Teiler oder Zeit.
- **Teiler:** Abstand des Treffers zur Mitte in 1/100 mm.
- **Innenzehner:** Beim Luftgewehr ist der 0,5-mm-Punkt in der Mitte ganz weggeschossen, bei der
  Luftpistole berührt der Treffer den inneren Ring von 5 mm.
- **Median:** Der mittlere Wert: Die Hälfte liegt darüber, die Hälfte darunter.
- **IQR:** Breite des Fensters, in dem die mittlere Hälfte der Werte liegt.
- **MAD:** Typische Abweichung eines Werts vom Median.
- **Standardabweichung (SD):** Typische Abweichung vom Durchschnitt.
- **95-%-Bereich:** Wo der wahre Wert bei dieser Schusszahl mit großer Sicherheit liegt.
- **Hotelling-Test:** Prüft, ob ein Versatz des Schwerpunkts mehr als Zufall ist.
- **Wilson-Bereich:** Der 95-%-Bereich einer Quote, auch bei 0 oder 100 % sinnvoll.
- **Mann-Kendall-Test:** Prüft, ob die Werte über die Scheibe eher steigen oder fallen, und kommt
  mit vielen gleichen Werten zurecht.
- **Mauchly-Test:** Prüft, ob eine Gruppe wirklich gestreckt ist oder nur zufällig unrund aussieht.
- **Bonferroni:** Wer viele Schüsse prüft, findet zufällig einen auffälligen; die Grenze wird
  deshalb mit der Schusszahl strenger.
- **von-Neumann-Verhältnis:** Vergleicht die Sprünge von Schuss zu Schuss mit der Streuung; bei
  unabhängigen Schüssen liegt es um 2.

## Typische Fehlschlüsse

1. **Eine Scheibe ist kein Muster.** Was eine Scheibe zeigt, gilt für diesen Abend. Ob Ermüdung,
   Pausen oder ein Abfall dich regelmäßig betreffen, zeigt erst der Vergleich über mehrere Scheiben.
2. **Mehr Schüsse, größerer Streukreis.** Bei gleicher Präzision ist der Streukreis über 40 Schuss
   im Mittel rund 30 % größer als über 10. Wer so vergleicht, vergleicht vor allem die Schusszahl.
   Für Vergleiche σ nehmen.
3. **„Unklar“ ist ein Ergebnis.** Es sagt: Diese Schüsse zeigen nichts, was über den Zufall
   hinausgeht. Vielleicht gibt es nichts, vielleicht ist es für diese Schusszahl zu klein. Wer
   trotzdem am Visier dreht, korrigiert oft den Zufall und verliert dabei im Mittel Ringe.
4. **Nach einem Rekord kommt meist eine schwächere Scheibe.** Das ist meist Statistik (Regression
   zur Mitte) und für sich kein Zeichen von Formverlust.
5. **Ganze Ringe verstecken Feinheiten.** 10,0 und 10,9 sind beide eine 10; für die Analyse sind
   Zehntel genauer.

<!-- shot-help:end -->
