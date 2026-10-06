---
id: spiegel-statistics-help
type: guide
title: "Spiegel — Statistik verstehen (Hilfe)"
aliases: [statistik-hilfe, hilfe, erklärungen, statistik verstehen, glossar]
keywords: [hilfe, erklärung, erklären, verstehen, einfache sprache, glossar, so liest du, was heißt das, 95 prozent, vertrauensbereich, unsicherheit, echt, unklar, mindestzahl, sigma, sa, r50, streukreis, mittlerer radius, ringbreiten, form, ellipse, ausreißer, schwerpunkt, lage, hotelling, vertrauensellipse, ringverlust, lageanteil, richtungsuhr, drift, von neumann, tempo, rhythmus, pause, wiedereinstieg, ermüdung, trend, theil-sen, gleitender schnitt, serien, konstanz, quote, wilson, zehnerquote, innenzehner, teiler, median, iqr, mad, probe, eingeschossen, fehlschlüsse, regression zur mitte]
part_of: ["[[spiegel]]"]
relates_to: ["[[spiegel-statistics]]", "[[spiegel-ui-design]]", "[[spiegel-metrics]]", "[[spiegel-vision]]"]
---

**TL;DR** Hilfe zu jeder Auswertung in Spiegel, in einfacher Sprache: was die Zahl misst, wie du sie
liest, was du damit tun kannst und wo du dich täuschen kannst. Die Texte sind die Quelle für die Hilfe
in der App (SP-1.11) und stehen schon in der Spielwiese hinter „Was heißt das?“. Die Definitionen mit
Formeln stehen im Katalog [[spiegel-statistics]]; diese Seite erklärt, ohne Formeln vorauszusetzen.

## So liest du die Zahlen

- **Schusszahl n.** Jede Zahl steht auf einer Grundlage, die Zeile „Grundlage“ unter der Analyse nennt
  sie. Reicht die Schusszahl nicht, steht „–“ mit dem Grund („ab 10 Schuss“), nie eine 0.
- **95-%-Bereich.** „σ 1,12 mm, 95 %: 0,96 bis 1,36 mm“ heißt: Mit dieser Schusszahl liegt dein wahrer
  Wert mit großer Sicherheit in diesem Bereich. Mehr Schüsse machen ihn schmaler. Bei 10 Schuss reicht
  er für σ von etwa einem Viertel darunter bis knapp die Hälfte darüber, erst bei rund 120 Schuss auf
  etwa ±10 %.
- **„Echt“ und „unklar“.** „Echt“ heißt: mit 95 % kein Zufall. „Unklar“ heißt nicht „gibt es nicht“,
  sondern: Diese Schüsse reichen nicht, um es zu zeigen. Mehr Schüsse oder mehrere Scheiben klären es.
  „Unklar“ ist ein ehrliches Ergebnis, kein Fehler.
- **Ganze Ringe oder Zehntel.** Oben umschalten; jede Auswertung über Werte gibt es in beiden. In
  ganzen Ringen gehen Feinheiten verloren (10,0 und 10,9 sind beide eine 10), deshalb ist ein Trend
  dort seltener „klar“. Gleich bleiben Zehner, Innenzehner und Zehnerquote.
- **Probe und Wertung.** Lage, Streuung und Tempo der Analyse rechnen über die Wertung. Die Probe hat
  einen eigenen Reiter; nach einer Visierverstellung zählt nur die Probe danach.
- **Nummern.** Wertungsschüsse heißen 1, 2, 3 …, Probeschüsse P1, P2 …, in der Reihenfolge der Abgabe.
  Fehlt einem Schuss eine Angabe, behält er trotzdem seine Nummer.
- **Median statt Durchschnitt.** Wo „Median“ steht, zählt der mittlere Wert: Die Hälfte liegt darüber,
  die Hälfte darunter. Ein einzelner Ausreißer verschiebt ihn kaum, den Durchschnitt (Ø) schon.
- **Millimeter statt Teiler.** Der Teiler ist der Abstand zur Mitte in 1/100 mm. Für Gruppen rechnet
  Spiegel in Millimetern um ihren eigenen Schwerpunkt.

## Ergebnis

**Ringverteilung (V1)**
- *Was:* wie viele Schüsse in jedem Ring liegen, dazu die Innenzehner.
- *So liest du es:* Wichtig ist die Form. Ein langer Schwanz nach unten heißt: einzelne schwache Schüsse.
  Ein breiter Block über drei, vier Ringe heißt: allgemein zu viel Streuung.
- *Was du tun kannst:* Beim Schwanz die Karten „Ausreißer“ und „Pausen“ ansehen, beim Block an der
  Präzision arbeiten.

**Zehntelverteilung (V2)**
- *Was:* dieselbe Zählung in Zehnteln, jede Säule ein Wert (10,4, 10,5 …). Nur in der Zehntelwertung.
- *So liest du es:* Sie zeigt, wo innerhalb der Ringe deine Schüsse liegen. Viele Werte knapp unter einer
  Ringgrenze (9,8, 9,9) kosten in ganzen Ringen jeweils einen Ring.

**Bester und schwächster Schuss, Teiler (E6–E8)**
- *Was:* höchster und niedrigster Wert mit Schussnummer; die drei besten und drei weitesten Teiler wie
  auf dem Meyton-Ausdruck; Durchschnitt und Median der Teiler.
- *So liest du es:* Der Median-Teiler ist dein typischer Treffer, der Durchschnitt wird von weiten
  Schüssen nach oben gezogen. Ein Platzhalter zählt nie als bester oder schwächster Schuss; bei gleichem
  Wert nennt Spiegel den früheren Schuss.

**Ringverlust (E9)**
- *Was:* wie viele Ringe dir zum Höchstwert fehlen (10 je Schuss, in Zehnteln 10,9).
- *So liest du es:* Das ist die Zahl, die du kleiner machen willst. Woher sie kommt, zeigt
  „Ringverlust nach Ursache“ im Reiter Lage.

**Serien und Konstanz (E10, I1)**
- *Was:* das Ergebnis jeder Serie, wie stark die Serien schwanken (Standardabweichung, Spanne) und wie
  stark ein einzelner Schuss typischerweise schwankt (MAD).
- *So liest du es:* Kleine Spanne heißt gleichmäßig. Verglichen werden nur Serien gleicher Länge; eine
  Serie, der ein Wert fehlt, hat keine Summe.
- *Was du tun kannst:* Fällt eine Serie ab, im Reiter Zeit & Verlauf nachsehen, ob davor eine Pause lag
  oder ob es zum Ende hin nachlässt.

**Quoten mit Unsicherheit (E4, E5, E11, I10)**
- *Was:* der Anteil deiner Schüsse ab einer Schwelle (Zehner, ab 9,0, ab 10,5) und der Innenzehner, mit
  95-%-Bereich. Dazu die längste Folge ab 10,0.
- *So liest du es:* Der Punkt ist gemessen, der Balken zeigt, wo dein wahrer Anteil wahrscheinlich liegt.
  Bei 40 Schuss ist der Balken noch breit.
- *Vorsicht:* Überlappen sich die Balken zweier Abende, ist der Unterschied nicht sicher.

## Präzision

**Präzision σ (P5)**
- *Was:* wie stark deine Treffer um ihren eigenen Schwerpunkt streuen, als eine Zahl in mm. Bei einer
  runden Gruppe liegen etwa 39 % der Treffer innerhalb von σ um den Schwerpunkt und 86 % innerhalb
  von 2σ.
- *So liest du es:* Kleiner ist besser. σ hängt kaum von der Schusszahl ab und ist deshalb das richtige
  Maß, um einen Abend mit 20 Schuss mit einem mit 40 Schuss zu vergleichen.
- *Sa:* dieselbe Größe ohne die kleine Korrektur, so wie Meyton sie nennt (die Formel steht im Handbuch,
  gegen echte Meyton-Werte ist sie noch nicht geprüft).

**In Ringbreiten (P9)**
- *Was:* der durchschnittliche Abstand zum Schwerpunkt geteilt durch die Ringbreite (LG 2,5 mm, LP 8 mm).
- *So liest du es:* 0,5 heißt, ein Treffer liegt im Mittel eine halbe Ringbreite vom Schwerpunkt. So
  lassen sich Gewehr und Pistole grob vergleichen.

**Streukreis, Ø Abstand, R50 (P1, P3, P4)**
- *Was:* Der Streukreis ist der kleinste Kreis um alle Trefferzentren, Mitte zu Mitte. Der Ø Abstand
  (mittlerer Radius) ist der durchschnittliche Abstand zum Schwerpunkt. R50: Die Hälfte der Treffer
  liegt näher, die Hälfte weiter; einzelne weite Schüsse stören ihn kaum.
- *Vorsicht:* Der Streukreis wächst mit jedem Schuss. Abende mit unterschiedlicher Schusszahl vergleichst
  du über σ, nicht über den Streukreis.

**Höhe und Breite (P7)**
- *Was:* wie weit die Gruppe senkrecht und waagrecht reicht.
- *So liest du es:* Ist die Höhe deutlich größer als die Breite, streust du vor allem senkrecht. Ob das
  mehr als Zufall ist, sagt die Karte „Form der Gruppe“.

**Form der Gruppe (P8)**
- *Was:* die Streuung als Ellipse; das Verhältnis a/b sagt, wie gestreckt sie ist, der Winkel, in welche
  Richtung.
- *So liest du es:* „Gestreckt“ steht nur, wenn ein Test zeigt, dass es kein Zufall ist. Den Winkel
  zeigt Spiegel erst ab 10 Schuss.
- *Vorsicht:* Jede Gruppe sieht etwas unrund aus. Bei 12 Schuss ist selbst a/b = 1,4 noch im Rahmen des
  Zufalls.

**Ausreißer (V6)**
- *Was:* Schüsse, die nicht zur Gruppe passen. Spiegel prüft jeden Schuss gegen die übrigen; bei einer
  ganz normalen, runden Gruppe meldet die Regel nur in 5 % der Scheiben fälschlich einen Ausreißer. Ist
  die Gruppe deutlich gestreckt (a/b um 2), passiert das öfter, in etwa 11 bis 19 % der Scheiben.
- *So liest du es:* Ein markierter Schuss ist ein Kandidat für die Frage „Was war da los?“. Er bleibt in
  der Wertung. Ø Abstand durch R50 liegt bei einer normalen Gruppe um 1,06; deutlich darüber heißt:
  wenige weite Schüsse prägen die Gruppe.
- *Vorsicht:* Zwei gleich weite Ausreißer können sich bei wenigen Schüssen gegenseitig verdecken.

**Verlust der schwächsten 10 % (V7)**
- *Was:* wie viele Ringe deine schwächsten 10 % gegenüber deinem typischen Schuss (Median) kosten.
- *Was du tun kannst:* Ist dieser Verlust groß, kosten dich einzelne Fehler viel. Dann lohnt die Arbeit
  an einem gleichmäßigen Ablauf mehr als an der Präzision.

## Lage

**Schwerpunkt (L1)**
- *Was:* der Mittelpunkt aller Treffer, auf der Scheibe der kleine schwarz-weiß geviertelte Kreis.
- *So liest du es:* Richtung und Abstand zur Mitte, etwa „0,6 mm rechts und 0,4 mm tief“.

**Ist die Lage echt? (L3)**
- *Was:* ein Test (Hotelling), ob der Versatz mehr als Zufall ist. Er berücksichtigt Streuung und
  Schusszahl.
- *So liest du es:* „Echt versetzt“: Eine Korrektur am Visier oder am Anschlag kann sich lohnen. „Vom
  Zufall nicht zu unterscheiden“: Nicht am Visier drehen, auch wenn der Schwerpunkt neben der Mitte liegt.
- *Vertrauensellipse:* der Bereich, in dem der wahre Schwerpunkt mit 95 % liegt. Liegt die Mitte darin,
  ist der Versatz nicht belegt.

**Ringverlust nach Ursache (L4)**
- *Was:* Spiegel schiebt deine Treffer so, dass der Schwerpunkt in der Mitte liegt, und wertet sie neu.
  Der Unterschied ist der Verlust durch die Lage, der Rest der Verlust durch die Streuung.
- *So liest du es:* Großer Lage-Anteil: Visier oder Anschlag. Großer Streuungs-Anteil: Präzision.
  Belastbar erst ab 10 Schuss, wenn die Lage echt ist und das Verschieben etwas bringt. Nie amtlich.

**Lageanteil am Fehler (L5)**
- *Was:* welcher Teil deines Abstands zur Mitte vom Versatz kommt; der Rest ist Streuung.
- *So liest du es:* 10 %: Die Lage ist kein Thema. 50 %: Die Hälfte deines Fehlers ist Lage.

**Richtungsuhr (L6)**
- *Was:* wie viele Treffer in welche Richtung gehen, 12 Uhr ist oben, um die Mitte oder um den
  Schwerpunkt.
- *So liest du es:* Um den Schwerpunkt zeigt sie, wohin deine weiten Schüsse gehen. Aussagekräftig erst
  ab 30 Schuss, darunter ist sie ein Bild, kein Befund.

**Drift und Wanderung (L8, I6)**
- *Was:* wie stark die Treffer von Schuss zu Schuss springen (von-Neumann-Verhältnis) und wie der
  Schwerpunkt von Serie zu Serie wandert.
- *So liest du es:* Um 2 sind die Schüsse unabhängig voneinander. Deutlich darunter wandert die Gruppe
  langsam, etwa weil sich der Anschlag im Lauf des Abends verändert. Spiegel urteilt hier nicht, weil die
  Zahl bei wenigen Schüssen stark schwankt.

## Zeit und Verlauf

**Tempo und Tempo-Streuung (Z1, Z2)**
- *Was:* der Median der Abstände zwischen zwei Schüssen; Pausen über drei Minuten zählen nicht. Die
  Tempo-Streuung sagt, wie gleichmäßig das ist: Die mittlere Hälfte deiner Abstände liegt in einem
  Fenster dieser Breite.
- *Vorsicht:* Gleichmäßiger ist nicht automatisch besser. Die Streuung ist ein Merkmal, das du mit deinem
  Ergebnis vergleichen kannst.

**Dauer, netto, Schuss je Stunde (Z3)**
- *Was:* vom ersten bis zum letzten Schuss; netto ohne Pausen; wie viele Schüsse du je Stunde reiner
  Schießzeit schaffst.

**Pausen und Wiedereinstieg (Z4)**
- *Was:* jede Pause über drei Minuten und wie die drei Schüsse danach im Vergleich zu deinen übrigen
  Schüssen lagen.
- *Vorsicht:* Drei Schüsse sind wenig. Ob dir Pausen schaden, zeigt erst der Vergleich über mehrere
  Abende.

**Rhythmus (Z5)**
- *Was:* jede Säule ist der Abstand zum vorigen Schuss, die Linie der Median der letzten fünf Abstände.
  Pausen sind als eigene Säule markiert.
- *So liest du es:* Eine ruhige Linie heißt: gleichmäßiger Ablauf. Wird sie zum Ende länger oder
  unruhiger, lohnt der Blick auf die Ermüdung.

**Verlauf je Schuss und Trend (I3, I4)**
- *Was:* jeder Punkt ist ein Schuss, die Linie der Schnitt der letzten zehn (gestrichelt, solange es
  noch keine zehn sind). Der Trend ist eine robuste Gerade durch alle Schüsse.
- *So liest du es:* „Klar fallend“ heißt: mit 95 % wirst du über die Scheibe schwächer. Sonst ist der
  Trend „nicht klar“, auch wenn die Linie etwas fällt.

**Ermüdung (I2)**
- *Was:* die letzten zehn Schuss gegen die ersten zehn, im Wert und in der Streuung (R50).
- *Vorsicht:* Eine einzelne Scheibe ist verrauscht. Ein Muster wird es erst, wenn es auf mehreren
  Scheiben so ist.

**Serien im Vergleich (I1, I5, I6)**
- *Was:* je Serie das Ergebnis, die Streuung (R50) und wie weit ihr Schwerpunkt vom Schwerpunkt der
  ganzen Scheibe liegt.

## Probe

**Umfang der Probe (S2)**
- *Was:* wie viele Probeschüsse du vor dem ersten Wertungsschuss abgegeben hast, wie lange die Probe
  dauerte und wie viel Zeit bis zum ersten Wertungsschuss verging.

**Probe gegen Wertung (S3)**
- *Was:* Durchschnitt, R50 und σ der Probe nach der letzten Visierverstellung gegen die Wertung.
- *So liest du es:* σ ist der faire Vergleich, denn R50 hängt von der Schusszahl ab und die Probe hat
  meist weniger Schüsse. Ein Fehlschuss zählt bei σ mit und bläht es auf; R50 lässt ihn weg.

**Eingeschossen? (S1, S4)**
- *Was:* ein Test der letzten fünf Probeschüsse: Lagen sie echt neben der Mitte? Dazu der Abstand
  zwischen ihrem Schwerpunkt und dem der Wertung.
- *So liest du es:* „Echt neben der Mitte“: Die Wertung begann mit einem Versatz. „Kein Versatz
  nachweisbar“ heißt nicht „eingeschossen“: Fünf Schüsse erkennen nur einen deutlichen Versatz.

## Glossar

- **Schwerpunkt:** Mittelpunkt aller Treffer (Meyton: Trefferlage).
- **Streukreis:** kleinster Kreis um alle Trefferzentren, Mitte zu Mitte (Meyton: Trefferkreis).
- **σ (Sigma):** typische Streuung um den Schwerpunkt in mm, kaum von der Schusszahl abhängig.
- **Sa:** σ ohne die kleine Korrektur, wie Meyton es nennt.
- **R50:** Radius um den Schwerpunkt, in dem die Hälfte der Treffer liegt.
- **Teiler:** Abstand des Treffers zur Mitte in 1/100 mm.
- **Innenzehner:** beim Luftgewehr ist der 0,5-mm-Punkt in der Mitte ganz weggeschossen, bei der
  Luftpistole berührt der Treffer den inneren Ring von 5 mm.
- **Median:** der mittlere Wert, die Hälfte liegt darüber, die Hälfte darunter.
- **IQR:** Breite des Fensters, in dem die mittlere Hälfte der Werte liegt.
- **MAD:** typische Abweichung eines Werts vom Median.
- **Standardabweichung (SD):** typische Abweichung vom Durchschnitt.
- **95-%-Bereich:** wo der wahre Wert bei dieser Schusszahl mit großer Sicherheit liegt.
- **Hotelling-Test:** prüft, ob ein Versatz des Schwerpunkts mehr als Zufall ist.
- **Wilson-Bereich:** der 95-%-Bereich einer Quote, auch bei 0 oder 100 % sinnvoll.
- **Theil-Sen:** robuste Trendgerade, die sich von einzelnen Ausreißern nicht verbiegen lässt.
- **Mauchly-Test:** prüft, ob eine Gruppe wirklich gestreckt ist oder nur zufällig unrund aussieht.
- **Bonferroni:** Wer viele Schüsse prüft, findet zufällig einen auffälligen; die Grenze wird deshalb mit
  der Schusszahl strenger.
- **von-Neumann-Verhältnis:** vergleicht die Sprünge von Schuss zu Schuss mit der Streuung; um 2 heißt
  unabhängig.

## Typische Fehlschlüsse

1. **Eine Scheibe ist kein Muster.** Ermüdung, Pausen und Trends zeigen sich erst über mehrere Scheiben.
2. **Mehr Schüsse, größerer Streukreis.** Wer 40 Schuss mit 10 Schuss vergleicht, vergleicht die
   Schusszahl. Für Vergleiche σ nehmen.
3. **„Unklar“ ist ein Ergebnis.** Es sagt: noch nicht genug Daten. Wer trotzdem am Visier dreht,
   korrigiert oft den Zufall.
4. **Nach einem Rekord kommt meist eine schwächere Scheibe.** Das ist Statistik (Regression zur Mitte),
   kein Formverlust.
5. **Ganze Ringe verstecken Feinheiten.** 10,0 und 10,9 sind beide eine 10; für die Analyse sind
   Zehntel genauer.
