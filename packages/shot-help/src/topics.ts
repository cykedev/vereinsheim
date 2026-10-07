// Eine Erklärung je Karte der Oberfläche, in der Reihenfolge der Reiter. Jede Registry-Kennzahl gehört zu
// genau einem Thema, jede Katalog-ID einer Auswertung zu mindestens einem, und jede ID eines Themas zu
// einer Auswertung oder Kennzahl (Tests). Zahlen in den Texten stammen aus Katalog, Code oder
// scripts/simulate.ts (Belege B0–B16 im Katalog, vault/spiegel/spiegel-statistics.md).

import type { HelpTopic } from "./types"

export const HELP_TOPICS: readonly HelpTopic[] = [
  // ---------- Ergebnis
  {
    id: "ergebnis",
    title: "Ergebnis und Ø je Schuss",
    theme: "result",
    catalog: ["E1", "E2"],
    metrics: ["result.rings", "result.decimal", "result.decimalMean", "result.ringsMean"],
    short:
      "Die Summe deiner Wertungsschüsse und der Durchschnitt je Schuss, in ganzen Ringen oder Zehnteln.",
    what: "Das Ergebnis ist die Summe aller Wertungsschüsse, der Ø der Durchschnitt je Schuss. Probeschüsse zählen nicht mit.",
    read: "Der Ø je Schuss vergleicht Scheiben mit verschiedener Schusszahl fair, das Ergebnis nur Scheiben mit gleich vielen Schüssen. Oben schaltest du zwischen ganzen Ringen und Zehnteln um. Was dir zum Höchstwert fehlt, zeigt „Ringverlust nach Ursache“.",
    caution:
      "Fehlt einem Schuss der Wert, gibt es kein Ergebnis: Eine Summe über einen Teil der Schüsse wäre keins. Den Ø gibt es trotzdem, über die Schüsse mit Wert.",
    minimum: "Ab 1 Schuss.",
    formula: "Ergebnis = Σ vᵢ (Zehntel) bzw. Σ Ringᵢ; Ø = Σ vᵢ / n über die Schüsse mit Wert",
  },
  {
    id: "ringverteilung",
    title: "Ringverteilung",
    theme: "result",
    catalog: ["V1"],
    metrics: [],
    short: "Wie viele Schüsse in jedem Ring liegen.",
    what: "Wie viele Schüsse in jedem Ring liegen, dazu die Innenzehner.",
    read: "Wichtig ist die Form. Ein langer Schwanz nach unten heißt: einzelne schwache Schüsse. Ein breiter Block über drei, vier Ringe heißt: allgemein zu viel Streuung.",
    act: "Beim Schwanz die Karten „Ausreißer“ und „Pausen und Wiedereinstieg“ ansehen, beim Block an der Präzision arbeiten.",
    minimum: "Ab 1 Schuss.",
    formula: "Anzahl je Ring 10 … 0",
  },
  {
    id: "zehntelverteilung",
    title: "Zehntelverteilung",
    theme: "result",
    catalog: ["V2"],
    metrics: [],
    short: "Wie viele Schüsse auf jeden Zehntelwert fallen.",
    what: "Dieselbe Zählung in Zehnteln, jede Säule ein Wert (10,4, 10,5 …). Es gibt sie nur in der Zehntelwertung.",
    read: "Sie zeigt, wo innerhalb der Ringe deine Schüsse liegen. Viele Werte knapp unter einer Ringgrenze (9,8, 9,9) kosten in ganzen Ringen jeweils einen Ring.",
    caution:
      "Einzelne Säulen sind bei einer Scheibe Zufall; aussagekräftig ist die Gesamtform, etwa viele Werte knapp unter einer Ringgrenze.",
    minimum: "Ab 1 Schuss.",
    formula: "Anzahl je Zehntelwert 0,0 … 10,9",
  },
  {
    id: "extreme-und-teiler",
    title: "Beste und weiteste Teiler",
    theme: "result",
    catalog: ["E8"],
    metrics: ["result.bestTeiler"],
    short: "Deine drei besten und drei weitesten Treffer, gemessen am Teiler.",
    what: "Die drei kleinsten und die drei größten Teiler mit Schussnummer, wie auf dem Meyton-Ausdruck. Der kleinste Teiler ist dein bester Schuss, der größte dein schwächster.",
    read: "Der Teiler misst feiner als der Wert: Zwei Schüsse mit 10,9 unterscheiden sich im Teiler noch. Bei gleichem Teiler nennt Spiegel den früheren Schuss.",
    caution:
      "Ein verdächtiger Schuss (Platzhalter, Handeintrag) zählt hier nicht: Er trägt nur den amtlichen Wert, nicht deine Leistung. Der beste Teiler wird mit mehr Schüssen besser; vergleiche ihn nur bei gleicher Schusszahl.",
    minimum: "Ab 1 Schuss mit Lage.",
    formula: "Teiler = Abstand zur Mitte in 1/100 mm",
  },
  {
    id: "serien-und-konstanz",
    title: "Serien und Konstanz",
    theme: "result",
    catalog: ["E10", "I1"],
    metrics: [],
    short: "Das Ergebnis jeder Serie und wie gleichmäßig du über die Serien schießt.",
    what: "Das Ergebnis jeder Serie, wie stark die Serien schwanken (Standardabweichung, Spanne) und wie stark ein einzelner Schuss typischerweise schwankt (MAD).",
    read: "Kleine Spanne heißt gleichmäßig. Die Spanne wächst aber mit der Zahl der Serien; Scheiben mit verschieden vielen Serien vergleichst du über die Standardabweichung. Verglichen werden nur Serien der häufigsten Länge; fehlt einem Schuss der Wert, hat seine Serie keine Summe.",
    act: "Fällt eine Serie ab, sieh im Reiter „Zeit und Verlauf“ nach, ob davor eine Pause lag („Pausen und Wiedereinstieg“) oder ob es zum Ende hin nachlässt („Ermüdung“).",
    caution: "Wie gleichmäßig du wirklich schießt, zeigt erst der Vergleich über mehrere Scheiben.",
    minimum: "Ab 1 Schuss, die Schwankung ab 2 Serien gleicher Länge.",
    formula: "SD und Spanne der Serien gleicher Länge; MAD = Median |vᵢ − Median v|",
  },
  {
    id: "quoten",
    title: "Quoten mit Unsicherheit",
    theme: "result",
    catalog: ["E4", "E5", "E11", "I10"],
    metrics: ["result.tens", "result.innerTens", "result.tensRate"],
    short: "Wie oft du eine Schwelle erreichst, mit dem Bereich, in dem dein wahrer Anteil liegt.",
    what: "Der Anteil deiner Schüsse ab einer Schwelle (Zehner, ab 9,0, ab 10,5) mit 95-%-Bereich, dazu die Zahl deiner Zehner und Innenzehner und die längste Folge ab 10,0.",
    read: "Der Punkt ist gemessen, der Balken zeigt, wo dein wahrer Anteil wahrscheinlich liegt. Bei 40 Schuss ist er noch breit: Bei 20 Treffern von 40 reicht er etwa von 35 % bis 65 %.",
    caution:
      "Liegen die Balken zweier Abende nicht übereinander, ist der Unterschied echt. Überlappen sie sich nur ein Stück, kann er trotzdem echt sein; liegt der Punkt des einen Abends im Balken des anderen, ist er nicht belegt. Innenzehner von Gewehr und Pistole sind nicht vergleichbar, und die längste Folge wird mit mehr Schüssen länger. In ganzen Ringen erreicht eine Schwelle über 10,0 keiner.",
    minimum: "Ab 1 Schuss.",
    formula: "Anteil = Anzahl ab Schwelle / n; 95-%-Bereich nach Wilson",
  },
  // ---------- Präzision
  {
    id: "praezision-sigma",
    title: "Präzision σ",
    theme: "precision",
    catalog: ["P5"],
    metrics: ["group.sigma"],
    short:
      "Wie stark deine Treffer um ihren Schwerpunkt streuen, kaum abhängig von der Schusszahl.",
    what: "Wie stark deine Treffer um ihren eigenen Schwerpunkt streuen, als eine Zahl in mm. Bei einer runden Gruppe liegen etwa 39 % der Treffer innerhalb von σ um den Schwerpunkt und 86 % innerhalb von 2σ.",
    read: "Kleiner ist besser. σ hängt kaum von der Schusszahl ab und ist deshalb das richtige Maß, um einen Abend mit 20 Schuss mit einem mit 40 zu vergleichen.",
    caution:
      "Bei 10 Schuss reicht der 95-%-Bereich von etwa einem Viertel darunter bis knapp die Hälfte darüber; bei stark gestreckten Gruppen ist er etwas zu schmal. Ein Fehlschuss zählt bei σ mit und kann es vervielfachen; R50 lässt ihn weg.",
    minimum: "Ab 3 Schuss.",
    formula:
      "σ̂ = √(Σ rᵢ² / (2(n − 1))) / c4(2n − 1); 95-%-Bereich über χ² mit 2(n − 1) Freiheitsgraden",
  },
  {
    id: "masse-der-gruppe",
    title: "Maße der Gruppe",
    theme: "precision",
    catalog: ["P1", "P4", "P6", "P9"],
    metrics: ["group.enclosingDiameter", "group.r50", "group.sdX", "group.sdY"],
    short: "Streukreis, R50 und die Streuung waagrecht und senkrecht.",
    what: "Der Streukreis ist der kleinste Kreis um alle Trefferzentren, Mitte zu Mitte; die Zahl ist sein Durchmesser. R50 ist der Radius um den Schwerpunkt, in dem die Hälfte der Treffer liegt, ohne Fehlschüsse. Streuung x und y sind die typischen Abweichungen waagrecht und senkrecht.",
    read: "R50 stören einzelne weite Schüsse kaum. In Ringbreiten (Luftgewehr 2,5 mm, Luftpistole 8 mm) heißt ein R50 von 0,5: Die Hälfte deiner Treffer liegt innerhalb einer halben Ringbreite um den Schwerpunkt; so lassen sich Gewehr und Pistole grob vergleichen. Ist die Streuung y deutlich größer als x, streust du vor allem senkrecht; ob das mehr als Zufall ist, sagt die Karte „Form der Gruppe“.",
    caution:
      "Der Streukreis wird mit jedem weiteren Schuss größer oder bleibt gleich: Über 40 Schuss ist er bei gleicher Präzision im Mittel rund 30 % größer als über 10. R50 fällt bei wenigen Schüssen etwas zu klein aus, bei 10 Schuss um etwa 4 %. Ein Fehlschuss bläht Streukreis und Streuung auf, R50 nicht. Abende mit unterschiedlicher Schusszahl vergleichst du über σ.",
    minimum: "Ab 3 Schuss, R50 ab 5.",
    formula:
      "Streukreis = Durchmesser des kleinsten umschließenden Kreises (Welzl); R50 = Median der rᵢ ohne Fehlschüsse; Streuung mit n − 1; in Ringbreiten: R50 / W",
  },
  {
    id: "form-der-gruppe",
    title: "Form der Gruppe",
    theme: "precision",
    catalog: ["P8"],
    metrics: [],
    short: "Ob deine Gruppe rund ist oder in eine Richtung gestreckt.",
    what: "Die Streuung als Ellipse: Das Verhältnis a/b sagt, wie gestreckt sie ist, der Winkel, in welche Richtung.",
    read: "„Gestreckt“ steht nur, wenn ein Test zeigt, dass es kein Zufall ist. Daneben steht, ab welchem a/b das bei deiner Schusszahl gilt: bei 20 Schuss ab 1,81, bei 40 ab 1,50, bei 120 ab 1,25.",
    caution:
      "Auch eine vollkommen runde Gruppe sieht zufällig gestreckt aus: bei 20 Schuss im Median a/b 1,32, bei 40 Schuss 1,21. Eine leichte echte Streckung zeigt eine einzelne Scheibe deshalb selten; sichtbar wird sie über mehrere Scheiben.",
    minimum: "Ab 3 Schuss; den Winkel zeigt Spiegel nur bei einer gestreckten Gruppe ab 10 Schuss.",
    formula:
      "Halbachsen a, b aus der Kovarianz; gestreckt, wenn W = 4a²b² / (a² + b²)² < 0,05^(2/(n − 2)) (Mauchly, exakt)",
  },
  {
    id: "ausreisser",
    title: "Ausreißer",
    theme: "precision",
    catalog: ["V6", "V7"],
    metrics: [],
    short: "Schüsse, die nicht zur Gruppe passen, und was sie dich kosten.",
    what: "Spiegel prüft die Lage jedes Treffers gegen die übrigen: Liegt er weiter von ihrem Schwerpunkt weg, als ihre Streuung erwarten lässt? Bei einer ganz normalen, runden Gruppe meldet die Regel nur in 5 % der Scheiben fälschlich einen Ausreißer. Ist die Gruppe deutlich gestreckt (a/b um 2), passiert das öfter, umso öfter, je mehr Schüsse die Scheibe hat: bei 10 Schuss in etwa 10 %, bei 60 Schuss in etwa 20 % der Scheiben.",
    read: "Ein markierter Schuss ist ein Kandidat für die Frage „Was war da los?“ und bleibt in der Wertung. Darunter steht, wie viele Ringe die markierten Schüsse gegenüber deinem typischen Schuss (Median) gekostet haben.",
    act: "Kosten dich Ausreißer über mehrere Scheiben viele Ringe, lohnt die Arbeit an einem gleichmäßigen Ablauf mehr als an der Präzision.",
    caution:
      "Ein Ausreißer liegt weit von deiner Gruppe, nicht unbedingt weit von der Mitte: Liegt die Gruppe neben der Mitte, kann er sogar Ringe bringen. Zwei gleich weite Ausreißer können sich bei wenigen Schüssen gegenseitig verdecken: Bei 10 Schuss findet die Regel einen einzelnen sehr weiten Schuss fast immer, von zwei gleich weiten meist keinen.",
    minimum: "Ab 5 Schuss mit Lage.",
    formula:
      "T = d² / (2S² (1 + 1/(n − 1))) gegen das (1 − 0,05/n)-Quantil von F(2, 2(n − 2)); Kosten = Σ (Median der übrigen − vᵢ) über die markierten Schüsse",
  },
  // ---------- Lage
  {
    id: "lage-echt",
    title: "Ist die Lage echt?",
    theme: "position",
    catalog: ["L1", "L2", "L3"],
    metrics: ["group.mpiDistance"],
    short: "Wo dein Schwerpunkt liegt und ob der Versatz mehr als Zufall ist.",
    what: "Der Schwerpunkt ist der Mittelpunkt aller Treffer, auf der Scheibe der kleine schwarz-weiß geviertelte Kreis. Er ist selbst nur geschätzt: Die Vertrauensellipse zeigt, wo dein wahrer Schwerpunkt mit großer Sicherheit liegt. Ein Test (Hotelling) prüft, ob der Versatz zur Mitte mehr als Zufall ist; er sagt dasselbe wie die Ellipse: Liegt die Mitte darin, ist der Versatz nicht belegt.",
    read: "Die Lage steht als Abstand und Richtung zur Mitte da, etwa 0,72 mm, davon 0,6 mm rechts und 0,4 mm tief. „Echt versetzt“: Eine Korrektur an Visier oder Anschlag kann sich lohnen. „Vom Zufall nicht zu unterscheiden“: nicht am Visier drehen, auch wenn der Schwerpunkt neben der Mitte liegt. Die Ellipse hat die Form deiner Gruppe und schrumpft mit der Schusszahl: Ihre Halbachse ist bei 10 Schuss etwa so groß wie deine Streuung σ, bei 40 Schuss etwa 0,4 σ. Sie zeigt nicht, wo deine Schüsse liegen, nur wo ihr Mittelpunkt liegen kann.",
    act: "Ist die Lage echt versetzt, zeigt „Ringverlust nach Ursache“, wie viele Ringe eine Korrektur etwa bringt.",
    minimum: "Schwerpunkt ab 2 Schuss, der Test ab 3.",
    formula: "T² = n · m′ S⁻¹ m gegen 2(n − 1)/(n − 2) · F₀,₉₅(2, n − 2)",
  },
  {
    id: "ringverlust-nach-ursache",
    title: "Ringverlust nach Ursache",
    theme: "position",
    catalog: ["E9", "L4"],
    metrics: [],
    short:
      "Wie viele Ringe dir zum Höchstwert fehlen und wie viele davon eine Korrektur der Lage brächte.",
    what: "Dein Ringverlust ist, was dir zum Höchstwert fehlt (10 je Schuss, in Zehnteln 10,9). Spiegel teilt ihn auf: Jeder Treffer wird um den Schwerpunkt der übrigen Schüsse verschoben und neu gewertet. Was das bringt, ist der Verlust durch die Lage, der Rest der Verlust durch die Streuung.",
    read: "Großer Lage-Anteil: Visier oder Anschlag. Großer Streuungs-Anteil: Präzision. Der Ringverlust ist die Zahl, die du kleiner machen willst; er wächst mit der Schusszahl.",
    caution:
      "Ohne echten Versatz ist der Lage-Anteil meist leicht negativ: Eine Korrektur würde dann Ringe kosten. Belastbar erst ab 10 Schuss, wenn die Lage echt ist und die Korrektur etwas bringt. Gerechnet wird nur mit Schüssen mit Lage, aus der Lage neu gewertet; die Summe kann deshalb vom Ergebnis abweichen. Nie amtlich.",
    minimum: "Ab 2 Schuss mit Lage, belastbar ab 10.",
    formula:
      "Ringverlust = n · 10,9 − Σ vᵢ bzw. n · 10 − Σ Ringᵢ; zentriert: (pᵢ − m) · n/(n − 1), jeder Treffer um den Schwerpunkt der übrigen verschoben; Lage = zentriert − Ist; Streuung = Höchstwert − zentriert",
  },
  {
    id: "richtungsuhr",
    title: "Richtungsuhr",
    theme: "position",
    catalog: ["L6"],
    metrics: [],
    short: "In welche Richtungen deine Treffer gehen, wie auf einer Uhr.",
    what: "Wie viele Treffer in welche Richtung gehen, 12 Uhr ist oben, um die Mitte oder um den Schwerpunkt.",
    read: "Um die Mitte zeigt sie, wohin deine Treffer gehen; um den Schwerpunkt, in welche Richtungen deine Gruppe streut, etwa vor allem nach oben und unten. Jeder Treffer zählt gleich, ein weiter so viel wie ein naher.",
    caution:
      "Erst ab 30 Schuss mehr als ein Bild, und auch dann schwankt sie stark: Bei 30 Schuss hat der stärkste Keil zufällig meist doppelt so viele Treffer wie der Schnitt. Ein Befund ist erst, was sich über mehrere Scheiben wiederholt.",
    minimum: "Ab 1 Schuss, aussagekräftig ab 30.",
    formula: "Anzahl je 30°-Sektor um die Mitte oder um m",
  },
  {
    id: "drift-und-wanderung",
    title: "Drift und Wanderung",
    theme: "position",
    catalog: ["L8", "I6"],
    metrics: [],
    short: "Ob deine Gruppe im Lauf der Scheibe wandert.",
    what: "Ob die Sprünge von Schuss zu Schuss zu deiner Streuung passen (von-Neumann-Verhältnis) und wie der Schwerpunkt von Serie zu Serie wandert.",
    read: "Sind deine Schüsse unabhängig voneinander, liegt die Zahl um 2. Deutlich darunter wandert die Gruppe langsam, etwa weil sich der Anschlag im Lauf des Abends verändert.",
    caution:
      "Spiegel urteilt hier nicht: Auch ohne jedes Wandern liegt die Zahl zufällig bei 10 Schuss etwa zwischen 1,2 und 2,8 und bei 40 Schuss zwischen 1,6 und 2,4.",
    minimum: "Ab 3 Schuss mit Lage, die Wanderung ab 2 Serien mit je 2 Schuss mit Lage.",
    formula:
      "von Neumann = (Σ Sprung² / k) / (Σ rᵢ² / (n − 1)) mit k Sprüngen; um 2 bei unabhängigen Schüssen",
  },
  // ---------- Zeit und Verlauf
  {
    id: "verlauf-und-trend",
    title: "Verlauf je Schuss und Trend",
    theme: "time",
    catalog: ["I3", "I4"],
    metrics: [],
    short: "Wie sich deine Werte über die Scheibe entwickeln.",
    what: "Jeder Punkt ist ein Schuss, die Linie der Schnitt der letzten zehn (gestrichelt, solange es noch keine zehn sind). Der Trend ist eine Ausgleichsgerade durch alle Schüsse; die Zahl sagt, wie viele Ringe du je 10 Schuss zulegst oder verlierst.",
    read: "„Klar fallend“ heißt: Ein so deutlicher Abfall entstünde durch Zufall allein höchstens in 5 von 100 Scheiben; „klar steigend“ gilt ebenso nach oben. Sonst ist der Trend „nicht klar“, auch wenn die Linie etwas fällt oder steigt.",
    caution:
      "Selbst ein deutliches Nachlassen zeigt eine einzelne Scheibe selten als „klar“. In ganzen Ringen ist ein Trend etwas seltener klar, weil Feinheiten verloren gehen.",
    minimum: "Ab 1 Schuss, der Trend ab 10.",
    formula:
      "gleitender Schnitt über die letzten 10; Trend: Steigung der Ausgleichsgeraden je 10 Schuss; „klar“ nach Mann-Kendall mit Korrektur für gleiche Werte (95 %)",
  },
  {
    id: "rhythmus",
    title: "Rhythmus",
    theme: "time",
    catalog: ["Z5"],
    metrics: [],
    short: "Wie gleichmäßig du schießt, Schuss für Schuss.",
    what: "Jede Säule ist der Abstand zum vorigen Schuss, die Linie der Median der letzten fünf Abstände. Pausen über drei Minuten sind markiert und zählen nicht hinein.",
    read: "Eine ruhige Linie heißt: gleichmäßiger Ablauf. Wird sie zum Ende länger oder unruhiger, lohnt der Blick auf die Ermüdung.",
    minimum: "Ab 2 Schuss mit Zeit.",
    formula: "Median der letzten 5 Abstände ohne Pausen",
  },
  {
    id: "tempo-und-dauer",
    title: "Tempo und Dauer",
    theme: "time",
    catalog: ["Z1", "Z2", "Z3"],
    metrics: ["time.intervalMedian", "time.tempoSpread", "time.duration"],
    short: "Dein typischer Abstand zwischen zwei Schüssen und wie lange die Scheibe dauerte.",
    what: "Das Tempo ist der Median der Abstände zwischen zwei Schüssen; Pausen über drei Minuten zählen nicht. Die Tempo-Streuung sagt, wie gleichmäßig das ist: Die mittlere Hälfte deiner Abstände liegt in einem Fenster dieser Breite. Dazu die Dauer vom ersten bis zum letzten Schuss.",
    caution:
      "Gleichmäßiger ist nicht automatisch besser. Die Streuung ist ein Merkmal, das du mit deinem Ergebnis vergleichen kannst.",
    minimum: "Tempo ab 3 Schuss, Tempo-Streuung ab 4, Dauer ab 2.",
    formula:
      "Tempo = Median der Abstände ohne Pausen über 180 s; Tempo-Streuung = Q3 − Q1 der Abstände; Dauer = letzter − erster Schuss",
  },
  {
    id: "pausen",
    title: "Pausen und Wiedereinstieg",
    theme: "time",
    catalog: ["Z4"],
    metrics: [],
    short: "Deine Pausen und wie viele Ringe die Schüsse danach brachten.",
    what: "Jede Pause über drei Minuten und ob die bis zu drei Wertungsschüsse danach im Schnitt mehr oder weniger Ringe brachten als deine übrigen Schüsse.",
    caution:
      "Drei Schüsse sind wenig: Auch wenn die Pause nichts ausmacht, liegen sie zufällig bis zu etwa einen halben Ring (Luftgewehr, σ 1,5 mm) bzw. anderthalb Ringe (Luftpistole, σ 15 mm) je Schuss neben deinem Schnitt. Ob dir Pausen schaden, zeigt erst der Vergleich über mehrere Abende.",
    minimum: "Ab 2 Schuss mit Zeit.",
    formula:
      "Pause = Abstand über 180 s; Wiedereinstieg = Ø der bis zu 3 Schüsse danach − Ø der übrigen",
  },
  {
    id: "ermuedung",
    title: "Ermüdung",
    theme: "time",
    catalog: ["I2"],
    metrics: [],
    short: "Ob deine letzten zehn Schuss schwächer sind als die ersten zehn.",
    what: "Die letzten zehn Schuss gegen die ersten zehn, im Wert und in der Streuung (R50).",
    read: "Ein Minus beim Wert oder ein Plus bei R50 heißt: am Ende schwächer.",
    caution:
      "Eine einzelne Scheibe ist verrauscht: Auch ohne jede Ermüdung unterscheiden sich die ersten und die letzten zehn zufällig um bis zu etwa 0,35 Ringe je Schuss (Luftgewehr, σ 1,5 mm) bzw. 1,1 (Luftpistole, σ 15 mm), R50 um bis zu gut die Hälfte. Ein Muster wird es erst, wenn es auf mehreren Scheiben so ist.",
    minimum: "Ab 20 Wertungsschüssen mit Wert, R50 ab 20 mit Lage ohne Fehlschüsse.",
    formula: "Ø der letzten 10 − Ø der ersten 10; ebenso R50",
  },
  {
    id: "serien-im-vergleich",
    title: "Serien im Vergleich",
    theme: "time",
    catalog: ["I1", "I5", "I6"],
    metrics: [],
    short: "Ergebnis, Streuung und Lage jeder Serie nebeneinander.",
    what: "Je Serie das Ergebnis, die Streuung (R50) und wie weit ihr Schwerpunkt vom Schwerpunkt der ganzen Scheibe liegt.",
    read: "Wandert der Schwerpunkt der Serien deutlich in eine Richtung, ändert sich etwas im Anschlag.",
    caution:
      "Auch ohne jede Veränderung liegt der Schwerpunkt einer Zehnerserie im Mittel etwa ein Drittel σ neben dem der Scheibe, und R50 einer Serie schwankt stark.",
    minimum: "R50 ab 5 Schuss in der Serie, der Versatz ab 2.",
    formula: "Versatz = |Schwerpunkt der Serie − Schwerpunkt der Scheibe|",
  },
  // ---------- Probe
  {
    id: "probe-umfang",
    title: "Umfang der Probe",
    theme: "sighters",
    catalog: ["S2"],
    metrics: [],
    short: "Wie viele Probeschüsse du gebraucht hast und wie lange die Probe dauerte.",
    what: "Wie viele Probeschüsse du vor dem ersten Wertungsschuss abgegeben hast, auch in Blöcken zu zehn, wie lange die Probe dauerte und wie viel Zeit vom ersten Probeschuss bis zum ersten Wertungsschuss verging.",
    caution:
      "Probe nach Beginn der Wertung zählt hier nicht, und Platzhalter bringen keine Zeit mit.",
    minimum: "Ab 1 Probeschuss.",
  },
  {
    id: "probe-gegen-wertung",
    title: "Probe gegen Wertung",
    theme: "sighters",
    catalog: ["S3"],
    metrics: [],
    short: "Ob deine Probe so gut war wie die Wertung.",
    what: "Durchschnitt, R50 und σ der Probe nach der letzten Visierverstellung gegen die Wertung.",
    read: "σ ist der fairere Vergleich: R50 fällt bei wenigen Schüssen etwas zu klein aus, und die Probe hat meist weniger Schüsse.",
    caution:
      "Ein Fehlschuss zählt bei σ mit und bläht es auf; R50 lässt ihn weg. Mit wenigen Probeschüssen ist auch σ unsicher: Bei gleicher Präzision liegt σ aus fünf Probeschüssen zufällig zwischen etwa der Hälfte und dem Anderthalbfachen von σ der Wertung.",
    minimum: "σ ab 3, R50 ab 5 Schuss je Seite.",
  },
  {
    id: "eingeschossen",
    title: "Eingeschossen?",
    theme: "sighters",
    catalog: ["S1", "S4"],
    metrics: [],
    short: "Ob deine letzten Probeschüsse neben der Mitte lagen.",
    what: "Ein Test deiner letzten fünf Probeschüsse vor der Wertung, nach der letzten Visierverstellung: Lagen sie echt neben der Mitte? Dazu der Abstand zwischen ihrem Schwerpunkt und dem der Wertung.",
    read: "„Echt neben der Mitte“: Die Wertung begann mit einem Versatz.",
    caution:
      "„Kein Versatz nachweisbar“ heißt nicht „eingeschossen“: Fünf Schüsse erkennen nur einen deutlichen Versatz. Selbst ein Versatz so groß wie zweimal deine Streuung σ fällt nur in knapp zwei von drei Fällen auf.",
    minimum:
      "Ab 3 Probeschüssen mit Lage nach der letzten Visierverstellung, der Abstand zur Wertung zusätzlich ab 3 Wertungsschüssen mit Lage.",
    formula:
      "Hotelling-T² über die letzten fünf Probeschüsse nach der letzten Verstellung; Versatz = |m Probe − m Wertung|",
  },
  // ---------- Datenlage
  {
    id: "datenlage",
    title: "Datenlage",
    theme: "coverage",
    catalog: ["Q1"],
    metrics: [],
    short: "Auf welcher Grundlage die Zahlen stehen.",
    what: "Wie viele Wertungs- und Probeschüsse die Analyse hat, wie vielen Lage, Zeit oder Wert fehlen und welche Schüsse markiert sind (Fehlschuss, verdächtig).",
    read: "Je mehr fehlt, desto weniger tragen die Zahlen. Ein Schuss ohne Lage fehlt bei Streuung und Lage, ohne Zeit bei Tempo und Rhythmus. Fehlt einem Wertungsschuss der Wert, gibt es kein Ergebnis und keine Summe seiner Serie; Ø und Quoten rechnen ohne ihn. Ein verdächtiger Schuss zählt nur mit seinem Wert, auch wenn er eine Lage oder Zeit hat.",
    caution: "In Zehnteln fehlt beim Ergebnis auch ein Schuss, der nur einen ganzen Ring hat.",
  },
]
