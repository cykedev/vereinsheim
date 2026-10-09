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
- **„Sicher zwischen …“.** „Streuung 1,12 mm, sicher zwischen 0,94 und 1,36 mm“ heißt bei 30 Schuss:
  Dein wahrer Wert liegt mit großer Sicherheit (95 von 100) in diesem Bereich. Mehr Schüsse machen
  ihn schmaler. Bei 10 Schuss reicht er für σ von etwa einem Viertel darunter bis knapp die Hälfte
  darüber, erst bei rund 120 Schuss auf etwa ±10 %.
- **„Sicher“ und „kann Zufall sein“.** „Sicher“ heißt: Reiner Zufall brächte ein so deutliches
  Ergebnis nur in 5 von 100 Fällen. Weil auf einer Scheibe mehrere Tests laufen, zeigt trotzdem etwa
  jede sechste ganz normale Scheibe irgendwo ein „sicher versetzt“, „gestreckt“, „klar“ oder einen
  Ausreißer. „Kann Zufall sein“ heißt nicht „gibt es nicht“, sondern: Diese Schüsse reichen nicht,
  um es zu zeigen oder auszuschließen. Mehr Schüsse oder mehrere Scheiben klären es. „Passt“ an der
  Lage heißt dasselbe: kein Versatz belegt. Auf den Karten heißt das auch „nicht klar“ oder „kein
  Versatz nachweisbar“; es ist ein ehrliches Ergebnis, kein Fehler.
- **Ganze Ringe oder Zehntel.** Auf der Scheibe oben umschalten, für Liste, Start und Fortschritt in
  Profil; jede Auswertung über Werte gibt es in beiden, nur die Zehntelverteilung allein in
  Zehnteln. In ganzen Ringen gehen Feinheiten verloren (10,0 und 10,9 sind beide eine 10); beim
  Luftgewehr ist ein Trend dort deshalb etwas seltener „klar“. Gleich bleiben Zehner, Innenzehner
  und Zehnerquote.
- **Wie am Ausdruck.** Eine Scheibe in Spiegel ist, was der Ausdruck zeigt: Mit dem ersten
  Wertungsschuss löscht die Anlage die Probe, also rechnet Spiegel über die Wertung. Eine Scheibe
  nur mit Probe ist Training: Spiegel zeigt sie wie Wertung, mit Schüssen 1, 2, 3 …, Serien zu zehn
  und Ergebnis; das schwarze Eck oben rechts an der Scheibe und an den kleinen Scheiben der Serien
  erinnert daran, dass es Probe ist.
- **Nummern.** Schüsse heißen 1, 2, 3 … in der Reihenfolge der Abgabe, ein Training nur aus Probe
  ebenso. Fehlt einem Schuss eine Angabe, behält er trotzdem seine Nummer.
- **Median statt Durchschnitt.** Wo „Median“ steht, zählt der mittlere Wert: Die Hälfte liegt
  darüber, die Hälfte darunter. Ein einzelner Ausreißer verschiebt ihn kaum, den Durchschnitt (Ø)
  schon.
- **Millimeter statt Teiler.** Der Teiler ist der Abstand zur Mitte in 1/100 mm. Für Gruppen rechnet
  Spiegel in Millimetern um ihren eigenen Schwerpunkt.

## Auf dem Bildschirm

**Trefferbild**
- *Was:* Jeder Treffer in Kalibergröße, gefärbt nach seinem Ring: 10 rot, 9 gold, 8 türkis, 7 und
  weniger violett. Ein Training nur aus Probe trägt oben rechts ein schwarzes Eck. Die Treffer sind
  leicht durchscheinend, damit du siehst, wo sie sich überlagern.
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
- *So liest du es:* „Sicher“ oder „klar“ steht nur, wenn ein Test es zeigt: Reiner Zufall brächte
  das nur in 5 von 100 Fällen. Sonst sagt der Satz ehrlich, dass die Schüsse nicht reichen. Weil
  mehrere Tests laufen, trifft es bei etwa jeder sechsten ganz normalen Scheibe einmal zufällig zu.

## Ergebnis

**Ergebnis und Ø je Schuss (E1, E2)**
- *Was:* Das Ergebnis ist die Summe aller Wertungsschüsse, der Ø der Durchschnitt je Schuss.
  Probeschüsse zählen nicht mit.
- *So liest du es:* Der Ø je Schuss vergleicht Scheiben mit verschiedener Schusszahl fair, das
  Ergebnis nur Scheiben mit gleich vielen Schüssen. Oben schaltest du zwischen ganzen Ringen und
  Zehnteln um. Was dir zum Höchstwert fehlt, zeigt „Ringverlust nach Ursache“ (Reiter „Lage“).
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
  einer Ringgrenze (9,8, 9,9) zählen in ganzen Ringen nur 9; ein, zwei Zehntel mehr, und es wäre
  jeweils ein Ring mehr.
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
- *Mindestzahl:* Ab 1 Schuss mit Teiler.
- *Formel:* `Teiler = Abstand zur Mitte in 1/100 mm`

**Serien und Konstanz (E10, I1)**
- *Was:* Das Ergebnis jeder Serie, wie stark die Serien voneinander abweichen (Standardabweichung,
  Spanne) und wie stark ein einzelner Schuss um deinen Schnitt schwankt (Standardabweichung der
  Schusswerte).
- *So liest du es:* Kleine Spanne heißt gleichmäßig. Die Spanne wächst aber mit der Zahl der Serien;
  Scheiben mit verschieden vielen Serien vergleichst du über die Standardabweichung. Verglichen
  werden nur Serien der häufigsten Länge; fehlt einem Schuss der Wert, hat seine Serie keine Summe.
- *Was du tun kannst:* Fällt eine Serie ab, sieh im Reiter „Zeit und Verlauf“ nach, ob davor eine
  Pause lag („Pausen und Wiedereinstieg“) oder ob es zum Ende hin nachlässt („Ermüdung“).
- *Vorsicht:* Ein einzelner Fehlschuss oder Abreißer hebt die Abweichung je Schuss deutlich. Wie
  gleichmäßig du wirklich schießt, zeigt erst der Vergleich über mehrere Scheiben.
- *Mindestzahl:* Ab 1 Schuss; die Abweichung je Schuss ab 2, SD und Spanne der Serien ab 2 Serien
  gleicher Länge.
- *Formel:* `SD und Spanne der Serien gleicher Länge; Abweichung je Schuss = SD der Schusswerte (n −
  1)`

**Quoten mit Unsicherheit (E4, E5, E11, I10)**
- *Was:* Der Anteil deiner Schüsse ab einer Schwelle (Zehner; Luftgewehr auch ab 10,5, Luftpistole
  ab 9,0; in ganzen Ringen Ring 10 und ab Ring 9) mit 95-%-Bereich und die längste Folge ab 10,0.
- *So liest du es:* Der Punkt ist gemessen, der Balken zeigt, wo dein wahrer Anteil wahrscheinlich
  liegt. Bei 40 Schuss ist er noch breit: Bei 20 Zehnern aus 40 Schuss reicht er etwa von 35 % bis
  65 %.
- *Vorsicht:* Liegen die Balken zweier Abende nicht übereinander, ist der Unterschied echt.
  Überlappen sie sich nur ein Stück, kann er trotzdem echt sein; liegt der Punkt des einen Abends im
  Balken des anderen, ist er nicht belegt. Innenzehner von Gewehr und Pistole sind nicht
  vergleichbar, und die längste Folge wird mit mehr Schüssen länger. In ganzen Ringen erreicht eine
  Schwelle über 10,0 keiner.
- *Mindestzahl:* Ab 1 Schuss.
- *Formel:* `Anteil = Anzahl ab Schwelle / n; 95-%-Bereich nach Wilson`

## Präzision

**Streuung σ (P5)**
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
- *So liest du es:* Einzelne weite Schüsse verändern R50 viel weniger als σ und den Streukreis, bei
  10 Schuss aber merklich, weil sie den Schwerpunkt verschieben. In Ringbreiten (Luftgewehr 2,5 mm,
  Luftpistole 8 mm) heißt ein R50 von 0,5: Die Hälfte deiner Treffer liegt innerhalb einer halben
  Ringbreite um den Schwerpunkt; so lassen sich Gewehr und Pistole grob vergleichen. Ist die
  Streuung y deutlich größer als x, streust du vor allem senkrecht; ob das mehr als Zufall ist, sagt
  die Karte „Form der Gruppe“.
- *Vorsicht:* Der Streukreis wird mit jedem weiteren Schuss größer oder bleibt gleich: Über 40
  Schuss ist er bei gleicher Präzision im Mittel rund 30 % größer als über 10. R50 fällt bei wenigen
  Schüssen etwas zu klein aus, bei 10 Schuss um etwa 4 %. Ein Fehlschuss bläht Streukreis und
  Streuung auf, R50 nicht. Streuung x und y rechnen mit allen Schüssen, die Form ohne Ausreißer; ein
  einzelner Abreißer hebt die Streuung nur in seiner Richtung. Abende mit unterschiedlicher
  Schusszahl vergleichst du über σ.
- *Mindestzahl:* Ab 3 Schuss, R50 ab 5.
- *Formel:* `Streukreis = Durchmesser des kleinsten umschließenden Kreises (Welzl); R50 = Median der
  rᵢ ohne Fehlschüsse; Streuung mit n − 1; in Ringbreiten: R50 / W`

**Form der Gruppe (P8)**
- *Was:* Die Streuung als Ellipse, ohne die Ausreißer: Das Verhältnis a/b sagt, wie gestreckt sie
  ist, der Winkel, in welche Richtung. Ein einzelner Abreißer zöge die Ellipse sonst in seine
  Richtung. a und b sind die Streuung entlang der langen und der kurzen Achse, gemessen wie Streuung
  x und y, aber ohne die Ausreißer.
- *So liest du es:* „Gestreckt“ steht nur, wenn ein Test zeigt, dass es kein Zufall ist. Daneben
  steht, ab welchem a/b das bei deiner Schusszahl gilt: bei 20 Schuss ab 1,81, bei 40 ab 1,50, bei
  120 ab 1,25.
- *Vorsicht:* Auch eine vollkommen runde Gruppe sieht zufällig gestreckt aus: bei 20 Schuss im
  Median a/b 1,32, bei 40 Schuss 1,21. Eine leichte echte Streckung zeigt eine einzelne Scheibe
  deshalb selten; sichtbar wird sie über mehrere Scheiben. Ist deine Gruppe deutlich gestreckt, hält
  der Ausreißer-Test manchmal einen Schuss an der Spitze für einen Ausreißer, und ohne ihn wirkt die
  Gruppe runder. Steht „ohne Ausreißer“, schau, ob der Schuss in Richtung der Streckung liegt.
- *Mindestzahl:* Ab 3 Schuss ohne Ausreißer; den Winkel zeigt Spiegel nur bei einer gestreckten
  Gruppe ab 10 Schuss ohne Ausreißer.
- *Formel:* `Halbachsen a, b aus der Kovarianz der Schüsse ohne Ausreißer; gestreckt, wenn W = 4a²b²
  / (a² + b²)² < 0,05^(2/(n − 2)) (Mauchly; für eine Normalgruppe exakt, ohne die Ausreißer eine
  Näherung)`

**Ausreißer (V6, V7)**
- *Was:* Spiegel prüft die Treffer Schritt für Schritt: zuerst den, der am weitesten von den übrigen
  liegt, gemessen an ihrer Streuung. Ab 10 Schuss prüft es danach ohne ihn den nächsten, bis zu zwei
  Schüsse, ab 30 Schuss bis zu jedem zehnten. So verdecken sich zwei nahe Ausreißer nicht
  gegenseitig. Bei einer ganz normalen, runden Gruppe meldet die Regel in höchstens etwa 5 % der
  Scheiben fälschlich einen Ausreißer. Ist die Gruppe deutlich gestreckt (a/b um 2), passiert das
  öfter, umso öfter, je mehr Schüsse die Scheibe hat: bei 10 Schuss in etwa 11 %, bei 60 Schuss in
  etwa 18 % der Scheiben.
- *So liest du es:* Ein markierter Schuss ist ein Kandidat für die Frage „Was war da los?“ und
  bleibt in der Wertung. Darunter steht, wie viele Ringe die markierten Schüsse gegenüber deinem
  typischen Schuss (Median) gekostet haben.
- *Was du tun kannst:* Kosten dich Ausreißer über mehrere Scheiben viele Ringe, lohnt die Arbeit an
  einem gleichmäßigen Ablauf mehr als an der Präzision.
- *Vorsicht:* Ein Ausreißer liegt weit von deiner Gruppe, nicht unbedingt weit von der Mitte: Liegt
  die Gruppe neben der Mitte, kann er sogar Ringe bringen. Unter 10 Schuss prüft Spiegel nur einen
  Schritt, dort können sich zwei gleich weite Ausreißer noch verdecken. Bei 10 Schuss findet die
  Regel einen einzelnen Schuss fünfmal σ neben der Gruppe (Luftgewehr bei σ 1,5 mm: 7,5 mm, drei
  Ringbreiten) in knapp neun von zehn Fällen, von zwei nah beieinander in etwa acht von zehn Fällen
  beide.
- *Mindestzahl:* Ab 5 Schuss mit Lage.
- *Formel:* `Schritt für Schritt mit den m übrigen Schüssen: T = d² / (2S² (1 + 1/(m − 1))) für den
  weitesten gegen das (1 − 0,04/m)-Quantil von F(2, 2(m − 2)), dann ohne ihn weiter; höchstens
  max(2, ⌊n/10⌋) Schritte ab 10 Schuss, darunter einer; Ausreißer sind alle bis zum letzten Schritt
  über seiner Grenze; Kosten = Σ (Median der übrigen − vᵢ) über die markierten Schüsse`

## Lage

**Ist die Lage versetzt? (L1, L2, L3)**
- *Was:* Der Schwerpunkt ist der Mittelpunkt aller Treffer, auf der Scheibe der kleine schwarz-weiß
  geviertelte Kreis. Er ist selbst nur geschätzt: Die Vertrauensellipse zeigt, wo dein wahrer
  Schwerpunkt mit großer Sicherheit liegt. Ein Test (Hotelling) prüft, ob der Versatz zur Mitte mehr
  als Zufall ist; er sagt dasselbe wie die Ellipse: Liegt die Mitte darin, ist der Versatz nicht
  belegt.
- *So liest du es:* Die Lage steht als Abstand und Richtung zur Mitte da, etwa 0,72 mm, davon 0,6 mm
  rechts und 0,4 mm tief. „Sicher versetzt“: Der Versatz ist größer, als der Zufall bei dieser
  Schusszahl erklärt. „Kann Zufall sein“: Auch wenn der Schwerpunkt sichtbar neben der Mitte liegt,
  reicht das nicht als Beleg; im Überblick heißt die Lage dann „passt“. Die Ellipse hat die Form
  deiner Gruppe und schrumpft mit der Schusszahl: Ihre Halbachse ist bei 10 Schuss etwa so groß wie
  deine Streuung σ, bei 40 Schuss etwa 0,4 σ. Sie zeigt nicht, wo deine Schüsse liegen, nur wo ihr
  Mittelpunkt liegen kann.
- *Was du tun kannst:* Ist die Lage sicher versetzt, zeigt „Ringverlust nach Ursache“, wie viele
  Ringe sie etwa kostet.
- *Mindestzahl:* Ab 3 Schuss mit Lage, die nicht alle auf einer Linie liegen.
- *Formel:* `T² = n · m′ S⁻¹ m gegen 2(n − 1)/(n − 2) · F₀,₉₅(2, n − 2)`

**Ringverlust nach Ursache (E9, L4)**
- *Was:* Dein Ringverlust ist, was dir zum Höchstwert fehlt (10 je Schuss, in Zehnteln 10,9).
  Spiegel teilt ihn auf: Jeder Treffer wird um den Schwerpunkt der übrigen Schüsse verschoben und
  neu gewertet. Was das bringt, ist der Verlust durch die Lage, der Rest der Verlust durch die
  Streuung.
- *So liest du es:* Großer Lage-Anteil: Die Gruppe sitzt neben der Mitte. Großer Streuungs-Anteil:
  Präzision. Der Ringverlust ist die Zahl, die du kleiner machen willst; er wächst mit der
  Schusszahl.
- *Vorsicht:* Ohne belegten Versatz ist der Lage-Anteil meist leicht negativ, in ganzen Ringen oft
  0: Die Gruppe um den gemessenen Versatz zu verschieben, würde dann Ringe kosten; Spiegel schreibt
  dann „Lage kostet nichts“, und die Streuung trägt den ganzen Ringverlust. Belastbar erst ab 10
  Schuss, wenn die Lage sicher versetzt ist und die Gruppe in der Mitte Ringe bringt. Gewertet wird
  aus der Lage: Fehlt einem Wertungsschuss die Lage oder ist er verdächtig, gibt es keinen
  Ringverlust, nur die Aufteilung über die übrigen. Nie amtlich.
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
- *So liest du es:* Um 2 sind die Schüsse unabhängig. Deutlich darunter liegen aufeinanderfolgende
  Treffer näher beieinander, als die Gruppe breit ist: Die Gruppe wandert langsam, etwa weil sich
  der Anschlag im Lauf des Abends verändert, oder mehrere Ausreißer folgen direkt aufeinander. Über
  2 springen aufeinanderfolgende Treffer eher hin und her. Auch ohne Wandern liegt der Schwerpunkt
  einer Zehnerserie im Mittel etwa ein Drittel σ neben dem der Scheibe.
- *Vorsicht:* Spiegel urteilt hier nicht: Auch ohne jedes Wandern liegt die Zahl zufällig bei 10
  Schuss etwa zwischen 1,2 und 2,8 und bei 40 Schuss zwischen 1,6 und 2,4.
- *Mindestzahl:* Ab 3 Schuss mit Lage, die Wanderung ab 2 Serien mit je 2 Schuss mit Lage.
- *Formel:* `von Neumann = (Σ Sprung² / k) / (Σ rᵢ² / (n − 1)) mit k Sprüngen; um 2 bei unabhängigen
  Schüssen`

## Zeit und Verlauf

**Verlauf je Schuss und Trend (I3, I4)**
- *Was:* Jeder Punkt ist ein Schuss, die Linie der Schnitt der letzten zehn (gestrichelt, solange es
  noch keine zehn sind). Der Trend ist eine Ausgleichsgerade durch alle Schüsse; die Zahl sagt, um
  wie viele Ringe der Wert eines Schusses alle 10 Schuss steigt oder sinkt. Bei −0,24 ist ein Schuss
  also zehn Schuss später im Schnitt 0,24 Ringe schwächer, eine ganze Serie 2,4 Ringe.
- *So liest du es:* „Klar fallend“ heißt: Ein so deutlicher Abfall entstünde durch Zufall allein
  höchstens in 5 von 100 Scheiben; „klar steigend“ gilt ebenso nach oben. Sonst ist der Trend „nicht
  klar“, auch wenn die Linie etwas fällt oder steigt.
- *Vorsicht:* Selbst ein deutliches Nachlassen zeigt eine einzelne Scheibe selten als „klar“. Beim
  Luftgewehr, wo fast alle Schüsse 9 oder 10 sind, ist ein Trend in ganzen Ringen etwas seltener
  klar. Zeigen Test und Gerade in verschiedene Richtungen (etwa wegen eines sehr schwachen letzten
  Schusses), gibt es kein Urteil.
- *Mindestzahl:* Ab 2 Schuss mit Wert, der Trend ab 10.
- *Formel:* `gleitender Schnitt über die letzten 10; Trend: Steigung der Ausgleichsgeraden (Ringe je
  Schuss) mal 10; „klar“ nach Mann-Kendall mit Korrektur für gleiche Werte (95 %), wenn die Gerade
  dieselbe Richtung zeigt`

**Rhythmus (Z5)**
- *Was:* Jede Säule ist der Abstand zum vorigen Schuss, die Linie der Median der letzten fünf
  Abstände. Pausen über drei Minuten sind markiert und zählen nicht hinein.
- *So liest du es:* Eine ruhige Linie heißt: gleichmäßiger Ablauf. Steigt sie zum Ende (längere
  Abstände) oder werden die Säulen unruhiger, lohnt der Blick auf die Ermüdung.
- *Mindestzahl:* Ab 3 Schuss mit Zeit.
- *Formel:* `Median der letzten 5 Abstände ohne Pausen`

**Tempo und Dauer (Z1, Z2, Z3)**
- *Was:* Das Tempo ist der Median der Abstände zwischen zwei Schüssen; Pausen über drei Minuten
  zählen nicht. Die Tempo-Streuung sagt, wie gleichmäßig das ist: Die mittlere Hälfte deiner
  Abstände liegt in einem Fenster dieser Breite. Dazu die Dauer vom ersten bis zum letzten Schuss.
  Schießt du zwischendurch Probe, zählt der Abstand von Wertungsschuss zu Wertungsschuss.
- *Vorsicht:* Gleichmäßiger ist nicht automatisch besser. Die Streuung ist ein Merkmal, das du mit
  deinem Ergebnis vergleichen kannst.
- *Mindestzahl:* Tempo ab 3 Schuss mit Zeit, die Tempo-Streuung ab 4, die Dauer ab 2.
- *Formel:* `Tempo = Median der Abstände ohne Pausen über 180 s; Tempo-Streuung = Q3 − Q1 der
  Abstände ohne Pausen; Dauer = letzter − erster Schuss`

**Pausen und Wiedereinstieg (Z4)**
- *Was:* Jede Pause über drei Minuten und ob die bis zu drei Wertungsschüsse danach im Schnitt mehr
  oder weniger Ringe brachten als deine übrigen Schüsse. Probeschüsse in der Pause gehören zur
  Pause.
- *Vorsicht:* Drei Schüsse sind wenig: Auch wenn die Pause nichts ausmacht, liegen sie zufällig bis
  zu etwa einen halben Ring (Luftgewehr, σ 1,5 mm) bzw. anderthalb Ringe (Luftpistole, σ 15 mm) je
  Schuss neben deinem Schnitt. Ob dir Pausen schaden, zeigt erst der Vergleich über mehrere Abende.
- *Mindestzahl:* Pausen ab 2 Wertungsschüssen mit Zeit; was danach kam, nur über Schüsse mit Wert.
- *Formel:* `Pause = Abstand über 180 s; Wiedereinstieg = Ø der bis zu 3 Schüsse danach − Ø der
  übrigen`

**Ermüdung (I2)**
- *Was:* Die letzten zehn Schuss gegen die ersten zehn, im Wert und in der Streuung (R50).
- *So liest du es:* Ein Minus beim Wert oder ein Plus bei R50 heißt: am Ende schwächer. Der
  Unterschied im Wert gilt je Schuss; über die zehn Schuss zusammen ist es das Zehnfache.
- *Vorsicht:* Eine einzelne Scheibe ist verrauscht: Auch ohne jede Ermüdung unterscheiden sich die
  ersten und die letzten zehn zufällig um bis zu etwa 0,35 Ringe je Schuss (Luftgewehr, σ 1,5 mm; in
  ganzen Ringen etwa 0,4) bzw. 1,1 (Luftpistole, σ 15 mm), R50 um bis zu gut die Hälfte. Ein Muster
  wird es erst, wenn es auf mehreren Scheiben so ist.
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

## Datenlage

**Datenlage (Q1)**
- *Was:* Wie viele Wertungsschüsse die Scheibe hat, wie vielen davon Lage, Zeit oder Wert fehlen und
  welche Schüsse markiert sind (Fehlschuss, verdächtig). Eine Scheibe nur mit Probe steht als
  Training da, ihre Probeschüsse wie Wertung gezählt.
- *So liest du es:* Je mehr fehlt, desto weniger tragen die Zahlen. Ein Schuss ohne Lage fehlt bei
  Streuung und Lage, ohne Zeit bei Tempo und Rhythmus. Fehlt einem Wertungsschuss der Wert, gibt es
  kein Ergebnis, keine Zahl der Zehner und Innenzehner und keine Summe seiner Serie; Ø und Quoten
  rechnen ohne ihn. Ein verdächtiger Schuss zählt nur mit seinem Wert, auch wenn er eine Lage oder
  Zeit hat.
- *Vorsicht:* In Zehnteln fehlt beim Ergebnis auch ein Schuss, der nur einen ganzen Ring hat; die
  Datenlage nennt ihn „ohne Zehntel“.

## Über viele Scheiben

**Verlauf und Form (T1, T2, T5)**
- *Was:* Jeder Punkt ist eine Scheibe, mit dem Wert der gewählten Zahl über ihre Wertungsschüsse.
  Die Linie ist der Schnitt der letzten fünf Scheiben (gestrichelt, solange es noch keine fünf
  sind). Das Formband um die Linie zeigt, wie weit deine Scheiben üblicherweise um diesen Schnitt
  schwanken. Je Monat zeigt Spiegel dazu Boden und Decke: den Wert, den du an einem schwachen Tag
  hältst, den mittleren und den, den du an einem guten Tag erreichst. In der Liste und beim Ablesen
  steht, wie weit eine Scheibe vom Schnitt der bis zu fünf Scheiben davor liegt, ohne sie selbst.
- *So liest du es:* Liegt eine Scheibe im Band, war sie für deine Form normal: Bei einem
  gleichbleibenden Schützen liegen etwa zwei von drei Scheiben darin. Wird dein Boden über die
  Monate besser (beim Ø höher, bei σ kleiner), werden deine schwachen Tage besser, auch wenn die
  Decke gleich bleibt. Beim Tempo gibt es kein Besser, dort zeigt Spiegel nur die Spanne.
- *Vorsicht:* Vergleiche nur Scheiben derselben Disziplin. Zahlen, die an der Schusszahl hängen
  (Ergebnis, Streukreis), passen nur bei gleicher Schusszahl zusammen; für die Streuung über
  verschiedene Schusszahlen nimm σ. Eine einzelne Scheibe außerhalb des Bands ist noch kein
  Formknick. Sind deine Werte fast immer gleich (etwa die Zahl der Innenzehner), gibt es kein Band.
- *Mindestzahl:* Ab 1 Scheibe, das Formband ab 10 Scheiben, Boden und Decke ab 5 Scheiben im Monat.
- *Formel:* `Schnitt über die letzten 5 Scheiben; Formband = Schnitt ± 1,4826 · MAD der Abweichungen
  der Scheiben vom vollen Schnitt; Boden und Decke = P10 und P90 der Scheibenwerte je Monat (bei σ
  umgekehrt), dazu der Median („Mitte“); Abstand zum Schnitt = Wert − Mittel der bis zu 5 Scheiben
  davor`

**Trainingsumfang (T6)**
- *Was:* Je Woche die Zahl deiner Schüsse (wie am Ausdruck, Trainings nur aus Probe zählen mit),
  deiner Scheiben und der Tage, an denen du geschossen hast, auch Wochen ohne Training.
- *So liest du es:* Der Umfang sagt nichts über die Güte. Leg ihn neben den Verlauf: Liegen deine
  Scheiben in Wochen mit sehr vielen Schüssen öfter unter dem Formband, kann das Ermüdung sein.
- *Vorsicht:* Hier zählt die Probe mit, das Ergebnis oben zählt nur Wertungsschüsse. Eine Netto-Zeit
  zeigt Spiegel nicht: Sie folgt aus den Abständen zwischen den Schüssen, die du auf jeder Scheibe
  siehst.
- *Mindestzahl:* Ab 1 Scheibe.

**Zwei Zeiträume im Vergleich (C3, T3)**
- *Was:* Spiegel vergleicht die Werte deiner Scheiben aus zwei Zeiträumen, etwa vor und nach einem
  neuen Abzug. Jede Scheibe zählt einmal, egal wie viele Schüsse sie hat. Der Unterschied ist die
  Differenz der Mittel.
- *So liest du es:* Steht „besser“ oder „schwächer“, entstünde ein so deutlicher Unterschied durch
  Zufall allein in höchstens 5 von 100 Vergleichen; der Satz oben nennt das „ein klarer
  Unterschied“. Ob kleiner besser ist, weiß Spiegel je Zahl (bei Streukreis und Streuung σ ist
  kleiner besser); beim Tempo heißt es nur „höher“ oder „tiefer“. Steht „kein klarer Unterschied“,
  heißt das nicht „gleich geblieben“: Diese Scheiben reichen nicht, es zu zeigen oder
  auszuschließen. Unter 5 Scheiben je Seite steht „zu wenige Scheiben“. „Deutlich“ davor heißt: Der
  Unterschied ist mindestens knapp ein Drittel der Streuung deiner Scheiben innerhalb der beiden
  Zeiträume, also groß genug, um im Training etwas auszumachen.
- *Vorsicht:* „Deutlich“ steht nur zusammen mit einem Urteil: Auch ohne jede Veränderung ist der
  Unterschied bei 5 gegen 5 Scheiben in etwa sechs von zehn Fällen so groß. Bei gleicher Form gibt
  Spiegel in höchstens etwa 5 % der Vergleiche trotzdem ein Urteil. Wird dein σ beim Luftgewehr von
  1,5 auf 1,3 mm kleiner (40 Schuss je Scheibe, im Mittel 0,1 Ring mehr je Schuss), erkennt Spiegel
  das bei 5 gegen 5 Scheiben in gut der Hälfte der Fälle, bei 10 gegen 10 in gut neun von zehn. Eine
  kleine Veränderung braucht viel mehr Scheiben: Bei σ 1,5 auf 1,45 mm (etwa ein Ring mehr auf 40
  Schuss) erkennt es Spiegel bei 20 gegen 20 Scheiben nur in etwa jedem fünften Fall, bei 30 gegen
  30 in knapp jedem dritten. Zeigen Test und Mittel in verschiedene Richtungen, gibt es kein Urteil.
- *Mindestzahl:* Ein Urteil ab 5 Scheiben je Seite.
- *Formel:* `Mann-Whitney über die Scheibenwerte, zweiseitig, α 0,05; bis 20 Scheiben je Seite genau
  ausgezählt, darüber Normalnäherung mit Korrektur für gleiche Werte; Δ = Mittel im Zeitraum −
  Mittel im Vergleichszeitraum; „deutlich“ (Effektstärke), wenn |Δ| ≥ 0,3 · gepoolte
  Standardabweichung der Scheibenwerte`

**Abstand zum Schnitt davor (C4)**
- *Was:* Der Unterschied zwischen dem Ø je Schuss einer Scheibe und dem Schnitt deiner bis zu fünf
  Scheiben davor in derselben Disziplin; im Fortschritt zählen dazu nur Scheiben der gewählten Art,
  und Trainings nur aus Probe nur, wenn sie mitzählen. Die Scheibe selbst zählt nicht mit. Gezählt
  werden alle deine Scheiben davor, nicht nur die im gewählten Zeitraum.
- *So liest du es:* +0,12 heißt: 0,12 Ringe je Schuss über dem Schnitt der Scheiben davor. In der
  Grundeinstellung steht dieselbe Zahl in der Liste der Scheiben, auf Start und in der Ablesung im
  Fortschritt; ein Bezug für eine Scheibe überall.
- *Vorsicht:* Eine Scheibe ist eine Scheibe: Ein Abstand zum Schnitt, der in deinem Formband bleibt,
  ist normal.
- *Mindestzahl:* Ab der zweiten Scheibe; mit weniger als fünf davor über so viele, wie es gibt.
- *Formel:* `Δ = Ø je Schuss der Scheibe − Mittel der Ø je Schuss der bis zu fünf Scheiben davor,
  ohne sie selbst`

**Rekorde (R1, R2, R3, R4, R5, R6, R7, R8)**
- *Was:* Bestes Ergebnis, beste Serie, bester Teiler, engste Serie zu zehn und engste Scheibe,
  meiste 10,9 (nur in Zehnteln), meiste Zehner und Innenzehner, längste Folge von Zehnern und deine
  beste Form: der höchste Schnitt je Schuss über fünf Scheiben in Folge. Ergebnis, engste Scheibe
  und die Zahl der 10,9, Zehner und Innenzehner führt Spiegel je Schusszahl, die beste Serie je
  Serienlänge, denn 40 und 60 Schuss sind nicht vergleichbar.
- *So liest du es:* Bei Gleichstand bleibt der frühere Rekord, denn er hat ihn zuerst gesetzt.
  Rekorde gibt es je Wertung (Zehntel oder ganze Ringe) und wahlweise nur für Training oder nur für
  Wettkampf; sie gelten über alle deine Scheiben, nicht nur über den gewählten Zeitraum.
- *Vorsicht:* Es zählen nur abgeschlossene, vollständige Scheiben. Nicht zählen Scheiben nur aus dem
  Ausdruck, neu gewertete, von dir ausgenommene und jede mit einem verdächtigen Schuss in der
  Wertung. Eine Trainingsscheibe nur mit Probe zählt mit, solange „Trainings nur aus Probe
  mitzählen“ im Blatt „Filter“ an ist (die Vorgabe); dann gilt ihre Probe wie Wertung, in Serien zu
  zehn. Ebenso eine Scheibe, deren Probe du als Wertung zählst.
- *Mindestzahl:* Ab 1 Scheibe, die beste Form ab 5 Scheiben.

## Glossar

- **Schwerpunkt:** Mittelpunkt aller Treffer (Meyton: Trefferlage).
- **Streukreis:** Kleinster Kreis um alle Trefferzentren, Mitte zu Mitte; die Zahl ist sein
  Durchmesser. Meytons „Trefferkreis“ ist derselbe Kreis plus ein Kaliber (4,5 mm), deshalb größer.
- **Vertrauensellipse:** Bereich um den gemessenen Schwerpunkt, in dem der wahre Schwerpunkt mit
  großer Sicherheit (95 %) liegt. Liegt die Scheibenmitte darin, ist ein Versatz nicht belegt. Sie
  schrumpft mit der Schusszahl, die Gruppe nicht.
- **σ (Sigma):** Streuung je Richtung in mm, gemittelt aus waagrecht und senkrecht; der typische
  Abstand vom Schwerpunkt ist größer (R50 ≈ 1,18 σ bei einer runden Gruppe). Kaum von der Schusszahl
  abhängig.
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
3. **„Kann Zufall sein“ ist ein Ergebnis.** Es sagt: Diese Schüsse zeigen nichts, was über den
   Zufall hinausgeht. Vielleicht gibt es nichts, vielleicht ist es für diese Schusszahl zu klein.
   Wer trotzdem auf einen Versatz reagiert, den der Zufall erklärt, verschiebt seine Gruppe oft weg
   von der Mitte und verliert dabei im Mittel Ringe.
4. **Nach einem Rekord kommt meist eine schwächere Scheibe.** Das ist meist Statistik (Regression
   zur Mitte) und für sich kein Zeichen von Formverlust.
5. **Ganze Ringe verstecken Feinheiten.** 10,0 und 10,9 sind beide eine 10; für die Analyse sind
   Zehntel genauer.

<!-- shot-help:end -->
