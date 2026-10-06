---
id: spiegel-statistics-help
type: guide
title: "Spiegel — Statistik verstehen (Hilfe)"
aliases: [statistik-hilfe, hilfe, erklärungen, statistik verstehen, glossar]
keywords: [hilfe, erklärung, erklären, verstehen, einfache sprache, glossar, so liest du, was heißt das, 95 prozent, vertrauensbereich, unsicherheit, echt, unklar, mindestzahl, sigma, r50, streukreis, mittlerer radius, ringbreiten, form, ellipse, ausreißer, schwerpunkt, lage, hotelling, vertrauensellipse, ringverlust, lageanteil, richtungsuhr, drift, von neumann, tempo, rhythmus, pause, wiedereinstieg, ermüdung, trend, theil-sen, gleitender schnitt, serien, konstanz, quote, wilson, zehnerquote, innenzehner, teiler, median, iqr, mad, probe, eingeschossen, fehlschlüsse, regression zur mitte]
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

- **Schusszahl n.** Jede Zahl steht auf einer Grundlage, die Zeile „Grundlage“ unter der Analyse
  nennt sie. Reicht die Schusszahl nicht, steht „–“ mit dem Grund („ab 10 Schuss“), nie eine 0.
- **95-%-Bereich.** „σ 1,12 mm, 95 %: 0,96 bis 1,36 mm“ heißt: Mit dieser Schusszahl liegt dein
  wahrer Wert mit großer Sicherheit in diesem Bereich. Mehr Schüsse machen ihn schmaler. Bei 10
  Schuss reicht er für σ von etwa einem Viertel darunter bis knapp die Hälfte darüber, erst bei rund
  120 Schuss auf etwa ±10 %.
- **„Echt“ und „unklar“.** „Echt“ heißt: mit 95 % kein Zufall. „Unklar“ heißt nicht „gibt es nicht“,
  sondern: Diese Schüsse reichen nicht, um es zu zeigen. Mehr Schüsse oder mehrere Scheiben klären
  es. „Unklar“ ist ein ehrliches Ergebnis, kein Fehler.
- **Ganze Ringe oder Zehntel.** Oben umschalten; jede Auswertung über Werte gibt es in beiden. In
  ganzen Ringen gehen Feinheiten verloren (10,0 und 10,9 sind beide eine 10), deshalb ist ein Trend
  dort seltener „klar“. Gleich bleiben Zehner, Innenzehner und Zehnerquote.
- **Probe und Wertung.** Lage, Streuung und Tempo der Analyse rechnen über die Wertung. Die Probe
  hat einen eigenen Reiter; nach einer Visierverstellung zählt nur die Probe danach.
- **Nummern.** Wertungsschüsse heißen 1, 2, 3 …, Probeschüsse P1, P2 …, in der Reihenfolge der
  Abgabe. Fehlt einem Schuss eine Angabe, behält er trotzdem seine Nummer.
- **Median statt Durchschnitt.** Wo „Median“ steht, zählt der mittlere Wert: Die Hälfte liegt
  darüber, die Hälfte darunter. Ein einzelner Ausreißer verschiebt ihn kaum, den Durchschnitt (Ø)
  schon.
- **Millimeter statt Teiler.** Der Teiler ist der Abstand zur Mitte in 1/100 mm. Für Gruppen rechnet
  Spiegel in Millimetern um ihren eigenen Schwerpunkt.

## Ergebnis

**Ergebnis und Ø je Schuss (E1, E2)**
- *Was:* Das Ergebnis ist die Summe aller Wertungsschüsse, der Ø teilt sie durch die Schusszahl.
  Probeschüsse zählen nicht mit.
- *So liest du es:* Der Ø je Schuss vergleicht Scheiben mit verschiedener Schusszahl fair, das
  Ergebnis nur Scheiben mit gleich vielen Schüssen. Oben schaltest du zwischen ganzen Ringen und
  Zehnteln um.
- *Vorsicht:* Fehlt einem Schuss der Wert, gibt es kein Ergebnis: Eine Summe über einen Teil der
  Schüsse wäre keins.
- *Mindestzahl:* Ab 1 Schuss.
- *Formel:* `Ergebnis = Σ vᵢ (Zehntel) bzw. Σ Ringᵢ; Ø = Ergebnis / n`

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
- *Mindestzahl:* Ab 1 Schuss.
- *Formel:* `Anzahl je Zehntelwert 0,0 … 10,9`

**Bester und schwächster Schuss (E6, E7, E8)**
- *Was:* Höchster und niedrigster Wert mit Schussnummer, die drei besten und die drei weitesten
  Teiler wie auf dem Meyton-Ausdruck, dazu Durchschnitt und Median der Teiler.
- *So liest du es:* Der Median-Teiler ist dein typischer Treffer, der Durchschnitt wird von weiten
  Schüssen nach oben gezogen. Bei gleichem Wert nennt Spiegel den früheren Schuss.
- *Vorsicht:* Ein Platzhalter zählt nie als bester oder schwächster Schuss: Er trägt nur den
  amtlichen Wert, nicht deine Leistung.
- *Mindestzahl:* Ab 1 Schuss.
- *Formel:* `Teiler = Abstand zur Mitte in 1/100 mm`

**Serien und Konstanz (E9, E10, I1)**
- *Was:* Das Ergebnis jeder Serie, wie stark die Serien schwanken (Standardabweichung, Spanne) und
  wie stark ein einzelner Schuss typischerweise schwankt (MAD). Dazu der Ringverlust zum Höchstwert.
- *So liest du es:* Kleine Spanne heißt gleichmäßig. Verglichen werden nur Serien gleicher Länge;
  fehlt einem Schuss der Wert, hat seine Serie keine Summe. Der Ringverlust ist die Zahl, die du
  kleiner machen willst.
- *Was du tun kannst:* Fällt eine Serie ab, im Reiter Zeit & Verlauf nachsehen, ob davor eine Pause
  lag oder ob es zum Ende hin nachlässt.
- *Mindestzahl:* Ab 1 Schuss, die Schwankung ab 2 Serien gleicher Länge.
- *Formel:* `Ringverlust = n · 10 − Σ Ringᵢ bzw. n · 10,9 − Σ vᵢ; SD und Spanne der Serien gleicher
  Länge; MAD = Median |vᵢ − Median v|`

**Quoten mit Unsicherheit (E4, E5, E11, I10)**
- *Was:* Der Anteil deiner Schüsse ab einer Schwelle (Zehner, ab 9,0, ab 10,5) und der Innenzehner,
  jeweils mit 95-%-Bereich. Dazu die längste Folge ab 10,0.
- *So liest du es:* Der Punkt ist gemessen, der Balken zeigt, wo dein wahrer Anteil wahrscheinlich
  liegt. Bei 40 Schuss ist er noch breit.
- *Vorsicht:* Überlappen sich die Balken zweier Abende, ist der Unterschied nicht sicher. In ganzen
  Ringen erreicht eine Schwelle über 10,0 keiner.
- *Mindestzahl:* Ab 1 Schuss.
- *Formel:* `Anteil = Anzahl ab Schwelle / n; 95-%-Bereich nach Wilson`

## Präzision

**Präzision σ (P5, P9)**
- *Was:* Wie stark deine Treffer um ihren eigenen Schwerpunkt streuen, als eine Zahl in mm. Bei
  einer runden Gruppe liegen etwa 39 % der Treffer innerhalb von σ um den Schwerpunkt und 86 %
  innerhalb von 2σ.
- *So liest du es:* Kleiner ist besser. σ hängt kaum von der Schusszahl ab und ist deshalb das
  richtige Maß, um einen Abend mit 20 Schuss mit einem mit 40 zu vergleichen. In Ringbreiten
  (Luftgewehr 2,5 mm, Luftpistole 8 mm) heißt 0,5: Ein Treffer liegt im Mittel eine halbe Ringbreite
  vom Schwerpunkt. So lassen sich Gewehr und Pistole grob vergleichen.
- *Vorsicht:* Bei 10 Schuss reicht der 95-%-Bereich von etwa einem Viertel darunter bis knapp die
  Hälfte darüber.
- *Mindestzahl:* Ab 3 Schuss.
- *Formel:* `σ̂ = √(Σ rᵢ² / (2(n − 1))) / c4(2n − 1); 95-%-Bereich über χ² mit 2(n − 1)
  Freiheitsgraden; in Ringbreiten: Ø Abstand / W`

**Maße der Gruppe (P1, P3, P4, P6, P7)**
- *Was:* Der Streukreis ist der kleinste Kreis um alle Trefferzentren, Mitte zu Mitte. Der Ø Abstand
  ist der durchschnittliche Abstand zum Schwerpunkt, R50 der Abstand, innerhalb dessen die Hälfte
  der Treffer liegt. Streuung x und y, Höhe und Breite messen die Gruppe waagrecht und senkrecht.
- *So liest du es:* R50 stören einzelne weite Schüsse kaum. Ist die Höhe deutlich größer als die
  Breite, streust du vor allem senkrecht; ob das mehr als Zufall ist, sagt die Karte „Form der
  Gruppe“.
- *Vorsicht:* Der Streukreis wächst mit jedem Schuss, Ø Abstand und R50 schrumpfen bei wenigen
  Schüssen leicht. Abende mit unterschiedlicher Schusszahl vergleichst du über σ.
- *Mindestzahl:* Ab 3 Schuss, R50 ab 5.
- *Formel:* `Streukreis: kleinster umschließender Kreis (Welzl); Ø Abstand = Σ rᵢ / n; R50 = Median
  der rᵢ; Streuung mit n − 1`

**Form der Gruppe (P8)**
- *Was:* Die Streuung als Ellipse: Das Verhältnis a/b sagt, wie gestreckt sie ist, der Winkel, in
  welche Richtung.
- *So liest du es:* „Gestreckt“ steht nur, wenn ein Test zeigt, dass es kein Zufall ist. Daneben
  steht, ab welchem a/b das bei deiner Schusszahl gilt: bei 20 Schuss ab 1,81, bei 40 ab 1,50, bei
  120 ab 1,25.
- *Vorsicht:* Auch eine vollkommen runde Gruppe sieht zufällig gestreckt aus: bei 20 Schuss im
  Median a/b 1,32, bei 40 Schuss 1,21. Eine leichte echte Streckung zeigt eine einzelne Scheibe
  deshalb selten; sichtbar wird sie über mehrere Scheiben.
- *Mindestzahl:* Ab 3 Schuss, den Winkel ab 10.
- *Formel:* `Halbachsen a, b aus der Kovarianz; gestreckt, wenn W = 4a²b² / (a² + b²)² < 0,05^(2/(n
  − 2)) (Mauchly, exakt)`

**Ausreißer (V6, V7)**
- *Was:* Spiegel prüft jeden Schuss gegen die übrigen. Bei einer ganz normalen, runden Gruppe meldet
  die Regel nur in 5 % der Scheiben fälschlich einen Ausreißer; ist die Gruppe deutlich gestreckt
  (a/b um 2), passiert das öfter, in etwa 11 bis 19 % der Scheiben.
- *So liest du es:* Ein markierter Schuss ist ein Kandidat für die Frage „Was war da los?“ und
  bleibt in der Wertung. Ø Abstand durch R50 liegt bei einer normalen Gruppe um 1,06; deutlich
  darüber heißt: Wenige weite Schüsse prägen die Gruppe.
- *Was du tun kannst:* Ist der Verlust der schwächsten 10 % groß, kosten dich einzelne Fehler viel.
  Dann lohnt die Arbeit an einem gleichmäßigen Ablauf mehr als an der Präzision.
- *Vorsicht:* Zwei gleich weite Ausreißer können sich bei wenigen Schüssen gegenseitig verdecken.
- *Mindestzahl:* Ab 5 Schuss, der Verlust der schwächsten 10 % ab 10.
- *Formel:* `T = d² / (2S² (1 + 1/(n − 1))) gegen das (1 − 0,05/n)-Quantil von F(2, 2(n − 2));
  Verlust = Σ (Median − vᵢ) über die schwächsten 10 %`

## Lage

**Ist die Lage echt? (L1, L2, L3)**
- *Was:* Der Schwerpunkt ist der Mittelpunkt aller Treffer, auf der Scheibe der kleine schwarz-weiß
  geviertelte Kreis. Ein Test (Hotelling) prüft, ob sein Versatz zur Mitte mehr als Zufall ist; er
  berücksichtigt Streuung und Schusszahl.
- *So liest du es:* Die Lage steht als Richtung und Abstand zur Mitte da, etwa 0,6 mm rechts und 0,4
  mm tief. „Echt versetzt“: Eine Korrektur an Visier oder Anschlag kann sich lohnen. „Vom Zufall
  nicht zu unterscheiden“: nicht am Visier drehen, auch wenn der Schwerpunkt neben der Mitte liegt.
- *Was du tun kannst:* Die Vertrauensellipse auf der Scheibe zeigt, wo der wahre Schwerpunkt mit 95
  % liegt. Liegt die Mitte darin, ist der Versatz nicht belegt.
- *Mindestzahl:* Schwerpunkt ab 2 Schuss, der Test ab 3.
- *Formel:* `T² = n · m′ S⁻¹ m gegen 2(n − 1)/(n − 2) · F₀,₉₅(2, n − 2)`

**Ringverlust nach Ursache (L4)**
- *Was:* Spiegel schiebt deine Treffer so, dass der Schwerpunkt in der Mitte liegt, und wertet sie
  neu. Der Unterschied ist der Verlust durch die Lage, der Rest zum Höchstwert der Verlust durch die
  Streuung.
- *So liest du es:* Großer Lage-Anteil: Visier oder Anschlag. Großer Streuungs-Anteil: Präzision.
- *Vorsicht:* Belastbar erst ab 10 Schuss, wenn die Lage echt ist und das Verschieben etwas bringt;
  bei schiefen Gruppen kann es sogar kosten. Nie amtlich.
- *Mindestzahl:* Ab 1 Schuss, belastbar ab 10.
- *Formel:* `Lage = zentriert − Ist; Streuung = Höchstwert − zentriert`

**Lageanteil am Fehler (L5)**
- *Was:* Welcher Teil deines Abstands zur Mitte vom Versatz des Schwerpunkts kommt; der Rest ist
  Streuung.
- *So liest du es:* 10 %: Die Lage ist kein Thema. 50 %: Die Hälfte deines Fehlers ist Lage.
- *Mindestzahl:* Ab 3 Schuss.
- *Formel:* `max(0, |m|² − (Sx² + Sy²)/n) / (Σ dᵢ² / n)`

**Richtungsuhr (L6)**
- *Was:* Wie viele Treffer in welche Richtung gehen, 12 Uhr ist oben, um die Mitte oder um den
  Schwerpunkt.
- *So liest du es:* Um den Schwerpunkt zeigt sie, wohin deine weiten Schüsse gehen. Die Fläche eines
  Keils wächst mit der Zahl der Treffer.
- *Vorsicht:* Aussagekräftig erst ab 30 Schuss; darunter ist sie ein Bild, kein Befund.
- *Mindestzahl:* Ab 1 Schuss, aussagekräftig ab 30.
- *Formel:* `Anzahl je 30°-Sektor um die Mitte oder um m`

**Drift und Wanderung (L8, I6)**
- *Was:* Wie stark die Treffer von Schuss zu Schuss springen (von-Neumann-Verhältnis) und wie der
  Schwerpunkt von Serie zu Serie wandert.
- *So liest du es:* Um 2 sind die Schüsse unabhängig voneinander. Deutlich darunter wandert die
  Gruppe langsam, etwa weil sich der Anschlag im Lauf des Abends verändert.
- *Vorsicht:* Spiegel urteilt hier nicht: Bei wenigen Schüssen schwankt die Zahl stark.
- *Mindestzahl:* Ab 3 Schuss, die Wanderung ab 2 Serien.
- *Formel:* `von Neumann = (Σ Sprung² / k) / (Σ rᵢ² / (n − 1)); um 2 unabhängig`

## Zeit und Verlauf

**Verlauf je Schuss und Trend (I3, I4)**
- *Was:* Jeder Punkt ist ein Schuss, die Linie der Schnitt der letzten zehn (gestrichelt, solange es
  noch keine zehn sind). Der Trend ist eine robuste Gerade durch alle Schüsse.
- *So liest du es:* „Klar fallend“ heißt: Mit 95 % wirst du über die Scheibe schwächer. Sonst ist
  der Trend „nicht klar“, auch wenn die Linie etwas fällt.
- *Vorsicht:* In ganzen Ringen ist ein Trend seltener klar, weil Feinheiten verloren gehen.
- *Mindestzahl:* Ab 2 Schuss, der Trend ab 10.
- *Formel:* `gleitender Schnitt über die letzten 10; Trend: Theil-Sen-Steigung je 10 Schuss mit
  Sen-Intervall`

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
  Abstände liegt in einem Fenster dieser Breite. Dazu Dauer, Netto-Zeit ohne Pausen und Schüsse je
  Stunde reiner Schießzeit.
- *Vorsicht:* Gleichmäßiger ist nicht automatisch besser. Die Streuung ist ein Merkmal, das du mit
  deinem Ergebnis vergleichen kannst.
- *Mindestzahl:* Tempo ab 3 Schuss, Tempo-Streuung ab 4, Dauer ab 2.
- *Formel:* `Tempo = Median der Abstände ohne Pausen über 180 s; IQR = Q3 − Q1; Schüsse je Stunde =
  Abstände / Netto-Stunden`

**Pausen und Wiedereinstieg (Z4)**
- *Was:* Jede Pause über drei Minuten, die längste, und wie die drei Schüsse danach im Vergleich zu
  deinen übrigen Schüssen lagen.
- *Vorsicht:* Drei Schüsse sind wenig. Ob dir Pausen schaden, zeigt erst der Vergleich über mehrere
  Abende.
- *Mindestzahl:* Ab 2 Schuss mit Zeit.
- *Formel:* `Pause = Abstand über 180 s; Wiedereinstieg = Ø der 3 Schüsse danach − Ø der übrigen`

**Ermüdung (I2)**
- *Was:* Die letzten zehn Schuss gegen die ersten zehn, im Wert und in der Streuung (R50).
- *Vorsicht:* Eine einzelne Scheibe ist verrauscht. Ein Muster wird es erst, wenn es auf mehreren
  Scheiben so ist.
- *Mindestzahl:* Ab 20 Wertungsschüssen.
- *Formel:* `Ø der letzten 10 − Ø der ersten 10; ebenso R50`

**Serien im Vergleich (I1, I5, I6)**
- *Was:* Je Serie das Ergebnis, die Streuung (R50) und wie weit ihr Schwerpunkt vom Schwerpunkt der
  ganzen Scheibe liegt.
- *So liest du es:* Wandert der Versatz von Serie zu Serie in eine Richtung, ändert sich etwas im
  Anschlag.
- *Mindestzahl:* R50 ab 5 Schuss in der Serie.
- *Formel:* `Versatz = |Schwerpunkt der Serie − Schwerpunkt der Scheibe|`

## Probe

**Umfang der Probe (S2)**
- *Was:* Wie viele Probeschüsse du vor dem ersten Wertungsschuss abgegeben hast, wie lange die Probe
  dauerte und wie viel Zeit bis zum ersten Wertungsschuss verging.
- *Vorsicht:* Probe nach Beginn der Wertung zählt hier nicht, und Platzhalter bringen keine Zeit
  mit.
- *Mindestzahl:* Ab 1 Probeschuss.

**Probe gegen Wertung (S3)**
- *Was:* Durchschnitt, R50 und σ der Probe nach der letzten Visierverstellung gegen die Wertung.
- *So liest du es:* σ ist der faire Vergleich: R50 hängt von der Schusszahl ab, und die Probe hat
  meist weniger Schüsse.
- *Vorsicht:* Ein Fehlschuss zählt bei σ mit und bläht es auf; R50 lässt ihn weg.
- *Mindestzahl:* σ ab 3, R50 ab 5 Schuss je Seite.

**Eingeschossen? (S1, S4)**
- *Was:* Ein Test der letzten fünf Probeschüsse vor der Wertung: Lagen sie echt neben der Mitte?
  Dazu der Abstand zwischen ihrem Schwerpunkt und dem der Wertung.
- *So liest du es:* „Echt neben der Mitte“: Die Wertung begann mit einem Versatz.
- *Vorsicht:* „Kein Versatz nachweisbar“ heißt nicht „eingeschossen“: Fünf Schüsse erkennen nur
  einen deutlichen Versatz.
- *Mindestzahl:* Der Test ab 3 Probeschüssen mit Lage, der Versatz ab 3 Probe- und 3
  Wertungsschüssen.
- *Formel:* `Hotelling-T² über die letzten fünf Probeschüsse; Versatz = |m Probe − m Wertung|`

## Datenlage

**Datenlage (Q1)**
- *Was:* Wie viele Wertungs- und Probeschüsse die Analyse hat, wie vielen Lage, Zeit oder Wert
  fehlen und welche Schüsse markiert sind (Fehlschuss, verdächtig).
- *So liest du es:* Je mehr fehlt, desto weniger tragen die Zahlen. Ein Schuss ohne Lage fehlt bei
  Streuung und Lage, ohne Zeit beim Tempo, ohne Wert beim Ergebnis.

## Glossar

- **Schwerpunkt:** Mittelpunkt aller Treffer (Meyton: Trefferlage).
- **Streukreis:** Kleinster Kreis um alle Trefferzentren, Mitte zu Mitte (Meyton: Trefferkreis).
- **σ (Sigma):** Typische Streuung um den Schwerpunkt in mm, kaum von der Schusszahl abhängig.
- **R50:** Radius um den Schwerpunkt, in dem die Hälfte der Treffer liegt.
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
- **Theil-Sen:** Robuste Trendgerade, die sich von einzelnen Ausreißern nicht verbiegen lässt.
- **Mauchly-Test:** Prüft, ob eine Gruppe wirklich gestreckt ist oder nur zufällig unrund aussieht.
- **Bonferroni:** Wer viele Schüsse prüft, findet zufällig einen auffälligen; die Grenze wird
  deshalb mit der Schusszahl strenger.
- **von-Neumann-Verhältnis:** Vergleicht die Sprünge von Schuss zu Schuss mit der Streuung; um 2
  heißt unabhängig.

## Typische Fehlschlüsse

1. **Eine Scheibe ist kein Muster.** Ermüdung, Pausen und Trends zeigen sich erst über mehrere
   Scheiben.
2. **Mehr Schüsse, größerer Streukreis.** Wer 40 Schuss mit 10 Schuss vergleicht, vergleicht die
   Schusszahl. Für Vergleiche σ nehmen.
3. **„Unklar“ ist ein Ergebnis.** Es sagt: noch nicht genug Daten. Wer trotzdem am Visier dreht,
   korrigiert oft den Zufall.
4. **Nach einem Rekord kommt meist eine schwächere Scheibe.** Das ist Statistik (Regression zur
   Mitte), kein Formverlust.
5. **Ganze Ringe verstecken Feinheiten.** 10,0 und 10,9 sind beide eine 10; für die Analyse sind
   Zehntel genauer.

<!-- shot-help:end -->
