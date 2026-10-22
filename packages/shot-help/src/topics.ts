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
    what: "Das Ergebnis ist die Summe aller Wertungsschüsse, der Ø der Durchschnitt je Schuss. Probeschüsse zählen nicht mit. Über einen Zeitraum ist der Ø alle Ringe des Zeitraums geteilt durch alle Wertungsschüsse. Eine Scheibe mit 40 Schuss zählt viermal so viel wie eine mit 10.",
    read: "Der Ø je Schuss vergleicht Scheiben mit verschiedener Schusszahl fair, das Ergebnis nur Scheiben mit gleich vielen Schüssen. Oben schaltest du zwischen ganzen Ringen und Zehnteln um. Was dir zum Höchstwert fehlt, zeigt „Ringverlust nach Ursache“ (Reiter „Lage“).",
    caution:
      "Fehlt einem Schuss der Wert, gibt es kein Ergebnis: Eine Summe über einen Teil der Schüsse wäre keins. Den Ø gibt es trotzdem, über die Schüsse mit Wert.",
    minimum: "Ab 1 Schuss.",
    formula:
      "Ergebnis = Σ vᵢ (Zehntel) bzw. Σ Ringᵢ; Ø = Σ vᵢ / n über die Schüsse mit Wert, über einen Zeitraum über alle Schüsse aller Scheiben",
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
    what: "Dieselbe Zählung in Zehnteln, jede Säule ein Wert (10,4, 10,5 …). Sie steht immer da, auch wenn die Scheibe in ganzen Ringen gewertet wird.",
    read: "Sie zeigt, wo innerhalb der Ringe deine Schüsse liegen. Viele Werte knapp unter einer Ringgrenze (9,8, 9,9) zählen in ganzen Ringen nur 9; ein, zwei Zehntel mehr, und es wäre jeweils ein Ring mehr.",
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
    minimum: "Ab 1 Schuss mit Teiler.",
    formula: "Teiler = Abstand zur Mitte in 1/100 mm",
  },
  {
    id: "serien-und-konstanz",
    title: "Serien und Konstanz",
    theme: "result",
    catalog: ["E10", "I1"],
    metrics: [],
    short: "Das Ergebnis jeder Serie und wie gleichmäßig du über die Serien schießt.",
    what: "Das Ergebnis jeder Serie, wie stark die Serien voneinander abweichen (Standardabweichung, Spanne) und wie stark ein einzelner Schuss um deinen Schnitt schwankt (Standardabweichung der Schusswerte).",
    read: "Kleine Spanne heißt gleichmäßig. Die Spanne wächst aber mit der Zahl der Serien; Scheiben mit verschieden vielen Serien vergleichst du über die Standardabweichung. Verglichen werden nur Serien der häufigsten Länge; fehlt einem Schuss der Wert, hat seine Serie keine Summe.",
    act: "Fällt eine Serie ab, sieh im Reiter „Zeit und Verlauf“ nach, ob davor eine Pause lag („Pausen und Wiedereinstieg“) oder ob es zum Ende hin nachlässt („Ermüdung“).",
    caution:
      "Ein einzelner Fehlschuss oder Abreißer hebt die Abweichung je Schuss deutlich. Sie sagt deshalb, wie gleichmäßig du an diesem Abend geschossen hast. Wie gleichmäßig du sonst schießt, sagt sie nicht.",
    minimum:
      "Ab 1 Schuss; die Abweichung je Schuss ab 2, SD und Spanne der Serien ab 2 Serien gleicher Länge.",
    formula:
      "SD und Spanne der Serien gleicher Länge; Abweichung je Schuss = SD der Schusswerte (n − 1)",
  },
  {
    id: "quoten",
    title: "Quoten mit Unsicherheit",
    theme: "result",
    catalog: ["E4", "E5", "E11", "I10"],
    metrics: ["result.tens", "result.innerTens", "result.tensRate"],
    short:
      "Wie oft du eine Schwelle erreichst; den Bereich, in dem dein wahrer Anteil liegt, zeigt der Reiter „Ergebnis“.",
    what: "Der Anteil deiner Schüsse ab einer Schwelle (Zehner; Luftgewehr auch ab 10,5, Luftpistole ab 9,0; in ganzen Ringen Ring 10 und ab Ring 9) mit 95-%-Bereich und die längste Folge ab 10,0. Über einen Zeitraum rechnet Spiegel die Zehnerquote über alle Schüsse.",
    read: "Der Punkt ist gemessen, der Balken zeigt, wo dein wahrer Anteil wahrscheinlich liegt. Bei 40 Schuss ist er noch breit: Bei 20 Zehnern aus 40 Schuss reicht er etwa von 35 % bis 65 %.",
    caution:
      "Liegen die Balken zweier Abende nicht übereinander, ist der Unterschied echt. Überlappen sie sich nur ein Stück, kann er trotzdem echt sein; liegt der Punkt des einen Abends im Balken des anderen, ist er nicht belegt. Innenzehner von Gewehr und Pistole sind nicht vergleichbar, und die längste Folge wird mit mehr Schüssen länger. In ganzen Ringen erreicht eine Schwelle über 10,0 keiner.",
    minimum: "Ab 1 Schuss.",
    formula: "Anteil = Anzahl ab Schwelle / n; 95-%-Bereich nach Wilson",
  },
  // ---------- Präzision
  {
    id: "praezision-sigma",
    title: "Streuung σ",
    theme: "precision",
    catalog: ["P5"],
    metrics: ["group.sigma"],
    short:
      "Wie stark deine Treffer um ihren Schwerpunkt streuen, kaum abhängig von der Schusszahl.",
    what: "Wie stark deine Treffer um ihren eigenen Schwerpunkt streuen, als eine Zahl in mm. Bei einer runden Gruppe liegen etwa 39 % der Treffer innerhalb von σ um den Schwerpunkt und 86 % innerhalb von 2σ. Über einen Zeitraum ist es die Streuung über alle Schüsse. Spiegel misst dabei jede Scheibe um ihre eigene Mitte.",
    read: "Kleiner ist besser. σ hängt kaum von der Schusszahl ab und ist deshalb das richtige Maß, um einen Abend mit 20 Schuss mit einem mit 40 zu vergleichen.",
    caution:
      "Bei 10 Schuss reicht der 95-%-Bereich von etwa einem Viertel darunter bis knapp die Hälfte darüber; bei stark gestreckten Gruppen ist er etwas zu schmal. Ein Fehlschuss zählt bei σ mit und kann es vervielfachen; R50 lässt ihn weg.",
    minimum: "Ab 3 Schuss.",
    formula:
      "σ̂ = √(Σ rᵢ² / (2(n − 1))) / c4(2n − 1); 95-%-Bereich über χ² mit 2(n − 1) Freiheitsgraden; über einen Zeitraum √(Σ νⱼsⱼ² / Σ νⱼ) / c4(Σ νⱼ + 1) mit νⱼ = 2(nⱼ − 1) und sⱼ = σ̂ⱼ · c4(2nⱼ − 1)",
  },
  {
    id: "masse-der-gruppe",
    title: "Maße der Gruppe",
    theme: "precision",
    catalog: ["P1", "P4", "P6", "P9"],
    metrics: ["group.enclosingDiameter", "group.r50", "group.sdX", "group.sdY"],
    short: "Streukreis, R50 und die Streuung waagrecht und senkrecht.",
    what: "Der Streukreis ist der kleinste Kreis um alle Trefferzentren, Mitte zu Mitte; die Zahl ist sein Durchmesser. R50 ist der Radius um den Schwerpunkt, in dem die Hälfte der Treffer liegt, ohne Fehlschüsse. Streuung x und y sind die typischen Abweichungen waagrecht und senkrecht.",
    read: "Einzelne weite Schüsse verändern R50 viel weniger als σ und den Streukreis, bei 10 Schuss aber merklich, weil sie den Schwerpunkt verschieben. In Ringbreiten (Luftgewehr 2,5 mm, Luftpistole 8 mm) heißt ein R50 von 0,5: Die Hälfte deiner Treffer liegt innerhalb einer halben Ringbreite um den Schwerpunkt; so lassen sich Gewehr und Pistole grob vergleichen. Ist die Streuung y deutlich größer als x, streust du vor allem senkrecht; ob das mehr als Zufall ist, sagt die Karte „Form der Gruppe“.",
    caution:
      "Der Streukreis wird mit jedem weiteren Schuss größer oder bleibt gleich: Über 40 Schuss ist er bei gleicher Präzision im Mittel rund 30 % größer als über 10. R50 fällt bei wenigen Schüssen etwas zu klein aus, bei 10 Schuss um etwa 4 %. Ein Fehlschuss bläht Streukreis und Streuung auf, R50 nicht. Streuung x und y rechnen mit allen Schüssen, die Form ohne Ausreißer; ein einzelner Abreißer hebt die Streuung nur in seiner Richtung. Abende mit unterschiedlicher Schusszahl vergleichst du über σ. Über einen Zeitraum rechnet Spiegel die Streuung x und y über alle Schüsse, jede Scheibe um ihre eigene Mitte.",
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
    what: "Die Streuung als Ellipse, ohne die Ausreißer: Das Verhältnis a/b sagt, wie gestreckt sie ist, der Winkel, in welche Richtung. Ein einzelner Abreißer zöge die Ellipse sonst in seine Richtung. a und b sind die Streuung entlang der langen und der kurzen Achse, gemessen wie Streuung x und y, aber ohne die Ausreißer.",
    read: "„Gestreckt“ steht nur, wenn ein Test zeigt, dass es kein Zufall ist. Daneben steht, ab welchem a/b das bei deiner Schusszahl gilt: bei 20 Schuss ab 1,81, bei 40 ab 1,50, bei 120 ab 1,25.",
    caution:
      "Auch eine vollkommen runde Gruppe sieht zufällig gestreckt aus: bei 20 Schuss im Median a/b 1,32, bei 40 Schuss 1,21. Eine leichte echte Streckung erkennt Spiegel auf einer Scheibe deshalb selten. „Gestreckt“ steht erst, wenn die Gruppe deutlich gestreckt ist. Ist deine Gruppe deutlich gestreckt, hält der Ausreißer-Test manchmal einen Schuss an der Spitze für einen Ausreißer, und ohne ihn wirkt die Gruppe runder. Steht „ohne Ausreißer“, schau, ob der Schuss in Richtung der Streckung liegt.",
    minimum:
      "Ab 3 Schuss ohne Ausreißer; den Winkel zeigt Spiegel nur bei einer gestreckten Gruppe ab 10 Schuss ohne Ausreißer.",
    formula:
      "Halbachsen a, b aus der Kovarianz der Schüsse ohne Ausreißer; gestreckt, wenn W = 4a²b² / (a² + b²)² < 0,05^(2/(n − 2)) (Mauchly; für eine Normalgruppe exakt, ohne die Ausreißer eine Näherung)",
  },
  {
    id: "ausreisser",
    title: "Ausreißer",
    theme: "precision",
    catalog: ["V6", "V7"],
    metrics: [],
    short: "Schüsse, die nicht zur Gruppe passen, und was sie dich kosten.",
    what: "Spiegel prüft die Treffer Schritt für Schritt: zuerst den, der am weitesten von den übrigen liegt, gemessen an ihrer Streuung. Ab 10 Schuss prüft es danach ohne ihn den nächsten, bis zu zwei Schüsse, ab 30 Schuss bis zu jedem zehnten. So verdecken sich zwei nahe Ausreißer nicht gegenseitig. Bei einer ganz normalen, runden Gruppe meldet die Regel in höchstens etwa 5 % der Scheiben fälschlich einen Ausreißer. Ist die Gruppe deutlich gestreckt (a/b um 2), passiert das öfter, umso öfter, je mehr Schüsse die Scheibe hat: bei 10 Schuss in etwa 11 %, bei 60 Schuss in etwa 18 % der Scheiben.",
    read: "Ein markierter Schuss ist ein Kandidat für die Frage „Was war da los?“ und bleibt in der Wertung. Darunter steht, wie viele Ringe die markierten Schüsse gegenüber deinem typischen Schuss (Median) gekostet haben.",
    act: "Kosten dich Ausreißer viele Ringe, lohnt die Arbeit an einem gleichmäßigen Ablauf mehr als an der Präzision. Ein einzelner Abend kann aber auch Pech sein.",
    caution:
      "Ein Ausreißer liegt weit von deiner Gruppe, nicht unbedingt weit von der Mitte: Liegt die Gruppe neben der Mitte, kann er sogar Ringe bringen. Unter 10 Schuss prüft Spiegel nur einen Schritt, dort können sich zwei gleich weite Ausreißer noch verdecken. Bei 10 Schuss findet die Regel einen einzelnen Schuss fünfmal σ neben der Gruppe (Luftgewehr bei σ 1,5 mm: 7,5 mm, drei Ringbreiten) in knapp neun von zehn Fällen, von zwei nah beieinander in etwa acht von zehn Fällen beide.",
    minimum: "Ab 5 Schuss mit Lage.",
    formula:
      "Schritt für Schritt mit den m übrigen Schüssen: T = d² / (2S² (1 + 1/(m − 1))) für den weitesten gegen das (1 − 0,04/m)-Quantil von F(2, 2(m − 2)), dann ohne ihn weiter; höchstens max(2, ⌊n/10⌋) Schritte ab 10 Schuss, darunter einer; Ausreißer sind alle bis zum letzten Schritt über seiner Grenze; Kosten = Σ (Median der übrigen − vᵢ) über die markierten Schüsse",
  },
  // ---------- Lage
  {
    id: "lage-echt",
    title: "Ist die Lage versetzt?",
    theme: "position",
    catalog: ["L1", "L2", "L3"],
    metrics: ["group.mpiDistance"],
    short: "Wo dein Schwerpunkt liegt und ob der Versatz mehr als Zufall ist.",
    what: "Der Schwerpunkt ist der Mittelpunkt aller Treffer, auf der Scheibe der kleine schwarz-weiß geviertelte Kreis. Er ist selbst nur geschätzt: Die Vertrauensellipse zeigt, wo dein wahrer Schwerpunkt mit großer Sicherheit liegt. Ein Test (Hotelling) prüft, ob der Versatz zur Mitte mehr als Zufall ist; er sagt dasselbe wie die Ellipse: Liegt die Mitte darin, ist der Versatz nicht belegt.",
    read: "Die Lage steht als Abstand und Richtung zur Mitte da, etwa 0,72 mm, davon 0,6 mm rechts und 0,4 mm tief. „Sicher versetzt“: Der Versatz ist größer, als der Zufall bei dieser Schusszahl erklärt. „Kann Zufall sein“: Auch wenn der Schwerpunkt sichtbar neben der Mitte liegt, reicht das nicht als Beleg; im Überblick heißt die Lage dann „passt“. Die Ellipse hat die Form deiner Gruppe und schrumpft mit der Schusszahl: Ihre Halbachse ist bei 10 Schuss etwa so groß wie deine Streuung σ, bei 40 Schuss etwa 0,4 σ. Sie zeigt nicht, wo deine Schüsse liegen, nur wo ihr Mittelpunkt liegen kann.",
    act: "Ist die Lage sicher versetzt, zeigt „Ringverlust nach Ursache“, wie viele Ringe sie etwa kostet.",
    minimum: "Ab 3 Schuss mit Lage, die nicht alle auf einer Linie liegen.",
    formula: "T² = n · m′ S⁻¹ m gegen 2(n − 1)/(n − 2) · F₀,₉₅(2, n − 2)",
  },
  {
    id: "ringverlust-nach-ursache",
    title: "Ringverlust nach Ursache",
    theme: "position",
    catalog: ["E9", "L4"],
    metrics: [],
    short: "Wie viele Ringe dir zum Höchstwert fehlen und wie viele davon die Lage kostet.",
    what: "Dein Ringverlust ist, was dir zum Höchstwert fehlt (10 je Schuss, in Zehnteln 10,9). Spiegel teilt ihn auf: Jeder Treffer wird um den Schwerpunkt der übrigen Schüsse verschoben und neu gewertet. Was das bringt, ist der Verlust durch die Lage, der Rest der Verlust durch die Streuung.",
    read: "Großer Lage-Anteil: Die Gruppe sitzt neben der Mitte. Großer Streuungs-Anteil: Präzision. Der Ringverlust ist die Zahl, die du kleiner machen willst; er wächst mit der Schusszahl.",
    caution:
      "Ohne belegten Versatz ist der Lage-Anteil meist leicht negativ, in ganzen Ringen oft 0: Die Gruppe um den gemessenen Versatz zu verschieben, würde dann Ringe kosten; Spiegel schreibt dann „Lage kostet nichts“, und die Streuung trägt den ganzen Ringverlust. Belastbar erst ab 10 Schuss, wenn die Lage sicher versetzt ist und die Gruppe in der Mitte Ringe bringt. Gewertet wird aus der Lage: Fehlt einem Wertungsschuss die Lage oder ist er verdächtig, gibt es keinen Ringverlust, nur die Aufteilung über die übrigen. Nie amtlich.",
    minimum:
      "Ab 2 Schuss mit Lage, belastbar ab 10; den Ringverlust gibt es nur, wenn jeder Wertungsschuss eine Lage hat.",
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
      "Erst ab 30 Schuss mehr als ein Bild, und auch dann schwankt sie stark: Bei 30 Schuss hat der stärkste Keil zufällig meist doppelt so viele Treffer wie der Schnitt. Ein starker Keil auf einer Scheibe ist deshalb noch kein Befund.",
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
    read: "Um 2 sind die Schüsse unabhängig. Deutlich darunter liegen aufeinanderfolgende Treffer näher beieinander, als die Gruppe breit ist: Die Gruppe wandert langsam, etwa weil sich der Anschlag im Lauf des Abends verändert, oder mehrere Ausreißer folgen direkt aufeinander. Über 2 springen aufeinanderfolgende Treffer eher hin und her. Auch ohne Wandern liegt der Schwerpunkt einer Zehnerserie im Mittel etwa ein Drittel σ neben dem der Scheibe.",
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
    what: "Jeder Punkt ist ein Schuss mit seinem Wert in Zehnteln, auch wenn die Scheibe in ganzen Ringen gewertet wird. Die Linie ist der Schnitt der letzten zehn (gestrichelt, solange es noch keine zehn sind). Der Trend ist eine Ausgleichsgerade durch alle Schüsse; die Zahl sagt, um wie viele Ringe der Wert eines Schusses alle 10 Schuss steigt oder sinkt. Sie rechnet in der Wertung der Scheibe, wie Ø und Beobachtungen. Bei −0,24 ist ein Schuss also zehn Schuss später im Schnitt 0,24 Ringe schwächer, eine ganze Serie 2,4 Ringe.",
    read: "„Klar fallend“ heißt: Ein so deutlicher Abfall entstünde durch Zufall allein höchstens in 5 von 100 Scheiben; „klar steigend“ gilt ebenso nach oben. Sonst ist der Trend „nicht klar“, auch wenn die Linie etwas fällt oder steigt.",
    caution:
      "Selbst ein deutliches Nachlassen zeigt eine einzelne Scheibe selten als „klar“. Beim Luftgewehr, wo fast alle Schüsse 9 oder 10 sind, ist ein Trend in ganzen Ringen etwas seltener klar. Zeigen Test und Gerade in verschiedene Richtungen (etwa wegen eines sehr schwachen letzten Schusses), gibt es kein Urteil.",
    minimum: "Ab 2 Schuss mit Wert, der Trend ab 10.",
    formula:
      "gleitender Schnitt über die letzten 10; Trend: Steigung der Ausgleichsgeraden (Ringe je Schuss) mal 10; „klar“ nach Mann-Kendall mit Korrektur für gleiche Werte (95 %), wenn die Gerade dieselbe Richtung zeigt",
  },
  {
    id: "rhythmus",
    title: "Rhythmus",
    theme: "time",
    catalog: ["Z5"],
    metrics: [],
    short: "Wie gleichmäßig du schießt, Schuss für Schuss.",
    what: "Jede Säule ist der Abstand zum vorigen Schuss, die Linie der Median der letzten fünf Abstände. Pausen (Abstände deutlich länger als dein üblicher Abstand, siehe „Pausen und Wiedereinstieg“) sind markiert und zählen nicht hinein.",
    read: "Eine ruhige Linie heißt: gleichmäßiger Ablauf. Steigt sie zum Ende (längere Abstände) oder werden die Säulen unruhiger, lohnt der Blick auf die Ermüdung.",
    minimum: "Ab 3 Schuss mit Zeit.",
    formula: "Median der letzten 5 Abstände ohne Pausen",
  },
  {
    id: "tempo-und-dauer",
    title: "Tempo und Dauer",
    theme: "time",
    catalog: ["Z1", "Z2", "Z3"],
    metrics: ["time.intervalMedian", "time.tempoSpread", "time.duration"],
    short: "Dein typischer Abstand zwischen zwei Schüssen und wie lange die Scheibe dauerte.",
    what: "Das Tempo ist der Median der Abstände zwischen zwei Schüssen; Pausen zählen nicht (ein Abstand über dem Doppelten deines üblichen Abstands, mindestens eine Minute, über drei Minuten immer). Die Tempo-Streuung sagt, wie gleichmäßig das ist: Die mittlere Hälfte deiner Abstände liegt in einem Fenster dieser Breite. Dazu die Dauer vom ersten bis zum letzten Schuss. Schießt du zwischendurch Probe, zählt der Abstand von Wertungsschuss zu Wertungsschuss.",
    caution:
      "Gleichmäßiger ist nicht automatisch besser. Die Streuung ist ein Merkmal, das du mit deinem Ergebnis vergleichen kannst. Über einen Zeitraum ist das Tempo das Mittel der Tempi deiner Scheiben: Ein Median lässt sich nicht über Scheiben zusammenrechnen.",
    minimum: "Tempo ab 3 Schuss mit Zeit, die Tempo-Streuung ab 4, die Dauer ab 2.",
    formula:
      "Tempo = Median der Abstände ohne Pausen; Pause = Abstand über max(60 s, min(180 s, 2 × Median aller Abstände bis 180 s, auch späterer Pausen)), auf ganze Sekunden, unter 5 solchen Abständen über 180 s; Tempo-Streuung = Q3 − Q1 der Abstände ohne Pausen; Dauer = letzter − erster Schuss",
  },
  {
    id: "pausen",
    title: "Pausen und Wiedereinstieg",
    theme: "time",
    catalog: ["Z4"],
    metrics: [],
    short: "Deine Pausen und ob die Schüsse danach besser oder schwächer waren als deine übrigen.",
    what: "Jede Pause und ob die bis zu drei Wertungsschüsse danach im Schnitt mehr oder weniger Ringe brachten als deine übrigen Schüsse. Pause ist ein Abstand, der deutlich länger ist als dein üblicher Abstand auf dieser Scheibe: über dem Doppelten deines üblichen Abstands, mindestens eine Minute; über drei Minuten immer. Bei einem üblichen Abstand von 40 s ist das über 1:20 min; genau 1:20 min ist noch keine Pause. Die Karte nennt die Schwelle deiner Scheibe. Probeschüsse in der Pause gehören zur Pause.",
    read: "Ein Plus heißt: Nach der Pause warst du besser als sonst, ein Minus: schwächer. „Klar stärker“ oder „klar schwächer“ steht nur, wenn ein Test es zeigt.",
    caution:
      "Drei Schüsse sind wenig: Auch wenn die Pause nichts ausmacht, liegen sie zufällig bis zu etwa einen halben Ring (Luftgewehr, σ 1,5 mm) bzw. anderthalb Ringe (Luftpistole, σ 15 mm) je Schuss neben deinem Schnitt. Deshalb steht „klar“ erst bei einem großen Unterschied. Eine kleine Wirkung der Pause zeigt eine Scheibe nicht. Auch ein klares Urteil gilt nur für diese Pause.",
    minimum:
      "Pausen ab 2 Wertungsschüssen mit Zeit; deinen üblichen Abstand erst ab 5 Abständen, davor gilt nur „über drei Minuten“. Was danach kam, nur über Schüsse mit Wert.",
    formula:
      "Pause = Abstand über max(60 s, min(180 s, 2 × Median aller Abstände bis 180 s, auch späterer Pausen)), auf ganze Sekunden, unter 5 solchen Abständen über 180 s; Wiedereinstieg = Ø der bis zu 3 Schüsse danach − Ø der übrigen; klar nach exaktem Permutationstest auf den Unterschied der Mittel (zweiseitig, 95 %, bei m Pausen 0,05/m)",
  },
  {
    id: "ermuedung",
    title: "Ermüdung",
    theme: "time",
    catalog: ["I2"],
    metrics: [],
    short: "Ob deine letzten zehn Schuss schwächer sind als die ersten zehn.",
    what: "Die letzten zehn Schuss gegen die ersten zehn, im Wert und in der Streuung (R50).",
    read: "Ein Minus beim Wert oder ein Plus bei R50 heißt: am Ende schwächer. „Klar schwächer“ oder „klar stärker“ steht nur, wenn ein Test es zeigt. Der Unterschied im Wert gilt je Schuss; über die zehn Schuss zusammen ist es das Zehnfache.",
    caution:
      "Eine einzelne Scheibe ist verrauscht: Auch ohne jede Ermüdung unterscheiden sich die ersten und die letzten zehn zufällig um bis zu etwa 0,35 Ringe je Schuss (Luftgewehr, σ 1,5 mm; in ganzen Ringen etwa 0,4) bzw. 1,1 (Luftpistole, σ 15 mm), R50 um bis zu gut die Hälfte. Deshalb steht „klar“ erst bei einem größeren Unterschied. Auch dann gilt es nur für diesen Abend.",
    minimum: "Ab 20 Wertungsschüssen mit Wert, R50 ab 20 mit Lage ohne Fehlschüsse.",
    formula:
      "Ø der letzten 10 − Ø der ersten 10; ebenso R50; klar nach Mann-Whitney (zweiseitig, 95 %, genau), wenn das Mittel dieselbe Richtung zeigt",
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
  // ---------- Datenlage
  {
    id: "datenlage",
    title: "Datenlage",
    theme: "coverage",
    catalog: ["Q1"],
    metrics: [],
    short: "Auf welcher Grundlage die Zahlen stehen.",
    what: "Wie viele Wertungsschüsse die Scheibe hat, wie vielen davon Lage, Zeit oder Wert fehlen und welche Schüsse markiert sind (Fehlschuss, verdächtig). Eine Scheibe nur mit Probe steht als Training da, ihre Probeschüsse wie Wertung gezählt.",
    read: "Je mehr fehlt, desto weniger tragen die Zahlen. Ein Schuss ohne Lage fehlt bei Streuung und Lage, ohne Zeit bei Tempo und Rhythmus. Fehlt einem Wertungsschuss der Wert, gibt es kein Ergebnis, keine Zahl der Zehner und Innenzehner und keine Summe seiner Serie; Ø und Quoten rechnen ohne ihn. Ein verdächtiger Schuss zählt nur mit seinem Wert, auch wenn er eine Lage oder Zeit hat.",
    caution:
      "In Zehnteln fehlt beim Ergebnis auch ein Schuss, der nur einen ganzen Ring hat; die Datenlage nennt ihn „ohne Zehntel“.",
  },
  {
    id: "verlauf-und-form",
    title: "Verlauf und Form",
    theme: "period",
    catalog: ["T1", "T2", "T5"],
    metrics: [],
    short: "Wie sich eine Zahl von Scheibe zu Scheibe entwickelt, mit deiner typischen Schwankung.",
    what: "Jeder Punkt ist eine Scheibe, mit dem Wert der gewählten Zahl über ihre Wertungsschüsse. Die Linie ist der Schnitt der letzten fünf Scheiben, über ihre Schüsse gerechnet (gestrichelt, solange es noch keine fünf sind). Das Formband um die Linie zeigt, wie weit deine Scheiben üblicherweise um diesen Schnitt schwanken. Je Monat zeigt Spiegel dazu Boden und Decke: den Wert, den du an einem schwachen Tag hältst, den mittleren und den, den du an einem guten Tag erreichst. Unter „Scheiben“ und beim Ablesen steht, wie weit eine Scheibe vom Schnitt der bis zu fünf Scheiben davor liegt, ohne sie selbst.",
    read: "Liegt eine Scheibe im Band, war sie für deine Form normal: Bei einem gleichbleibenden Schützen liegen etwa zwei von drei Scheiben darin. Wird dein Boden über die Monate besser (beim Ø höher, bei σ kleiner), werden deine schwachen Tage besser, auch wenn die Decke gleich bleibt. Beim Tempo gibt es kein Besser, dort zeigt Spiegel nur die Spanne.",
    caution:
      "Vergleiche nur Scheiben derselben Disziplin. Zahlen, die an der Schusszahl hängen (Ergebnis, Streukreis), passen nur bei gleicher Schusszahl zusammen; für die Streuung über verschiedene Schusszahlen nimm σ. Eine einzelne Scheibe außerhalb des Bands ist noch kein Formknick. Sind deine Werte fast immer gleich (etwa die Zahl der Innenzehner), gibt es kein Band.",
    minimum: "Ab 1 Scheibe, das Formband ab 10 Scheiben, Boden und Decke ab 5 Scheiben im Monat.",
    formula:
      "Schnitt über die letzten 5 Scheiben, bei Ø, Quote und Streuung über ihre Schüsse, sonst als Mittel der Werte; Formband = Schnitt ± 1,4826 · MAD der Abweichungen der Scheiben vom vollen Schnitt; Boden und Decke = P10 und P90 der Scheibenwerte je Monat (bei σ umgekehrt), dazu der Median („Mitte“); Abstand zum Schnitt = Wert − Schnitt der bis zu 5 Scheiben davor",
  },
  {
    id: "trainingsumfang",
    title: "Trainingsumfang",
    theme: "period",
    catalog: ["T6", "T7"],
    metrics: [],
    short:
      "Wie viel du trainierst: Schüsse, Scheiben und Tage je Woche, im Kalender jeder Trainingstag.",
    what: "Je Woche die Zahl deiner Schüsse (wie am Ausdruck, Trainings nur aus Probe zählen mit), deiner Scheiben und der Tage, an denen du geschossen hast, auch Wochen ohne Training. Der Kalender zeigt jeden Tag des Zeitraums: getönt nach deinen Schüssen an dem Abend, mit goldenem Rand, wenn ein Wettkampf dabei war. Ein Tippen führt zu dem Abend in deinen Scheiben.",
    read: "Der Umfang sagt nichts über die Güte. Leg ihn neben den Verlauf: Liegen deine Scheiben in Wochen mit sehr vielen Schüssen öfter unter dem Formband, kann das Ermüdung sein.",
    caution:
      "Hier zählt die Probe mit, das Ergebnis oben zählt nur Wertungsschüsse. Eine Netto-Zeit zeigt Spiegel nicht: Sie folgt aus den Abständen zwischen den Schüssen, die du auf jeder Scheibe siehst.",
    minimum: "Ab 1 Scheibe.",
  },
  {
    id: "form-ueber-scheiben",
    title: "Form über mehrere Scheiben",
    theme: "period",
    catalog: ["L9"],
    metrics: [],
    short: "Ob deine Gruppe über viele Abende rund ist oder in eine Richtung zieht.",
    what: "Spiegel schiebt jede Scheibe auf ihre eigene Mitte und legt alle Schüsse übereinander. So bleibt nur die Streuung, ohne die Lage der einzelnen Abende. Die Ellipse zeigt diese Gruppe: ihre lange Seite und wie viel länger sie ist als breit. Gestrichelt steht der Kreis, den eine runde Gruppe mit derselben Streuung hätte.",
    read: "„Länglich, eher waagrecht“ heißt: Deine Schüsse streuen zur Seite mehr als nach oben und unten, und das ist kein Zufall. Länge zu Breite 1,3 : 1 heißt, die lange Seite ist ein knappes Drittel länger. „Zieht in keine klare Richtung“ heißt nicht „genau rund“. Diese Schüsse zeigen nur keine Streckung.",
    caution:
      "Eine einzelne Scheibe sieht oft zufällig länglich aus. Eine leichte Streckung von 1,2 bis 1,3 sieht man erst über viele Scheiben. Ist deine Gruppe rund, meldet Spiegel bei 5 Scheiben in etwa 5 von 100 Fällen trotzdem „länglich“, ab 10 Scheiben seltener. Eine Streckung von 1,25 erkennt es bei 5 Scheiben zu 40 Schuss in knapp acht von zehn Fällen, ab 10 Scheiben fast immer. Liegen die Abende an verschiedenen Stellen, ändert das die Form hier nicht. Das zeigt die Lage.",
    minimum: "Ab 100 Schuss aus 5 Scheiben.",
    formula:
      "S = Σ (pᵢ − mⱼ)(pᵢ − mⱼ)ᵀ / ν über alle Scheiben j mit mindestens 3 Schuss, ν = Σ (nⱼ − 1); Länge zu Breite = √(λ₁/λ₂); Mauchly W = 4λ₁λ₂/(λ₁ + λ₂)², p = W^((ν − 1)/2); länglich, wenn p < 0,05 und √(λ₁/λ₂) ≥ 1,15",
  },
  {
    id: "lage-ueber-zeit",
    title: "Lage über Zeit",
    theme: "period",
    catalog: ["L10"],
    metrics: [],
    short: "Wo die Mitte deiner Schüsse liegt und ob sie über den Zeitraum versetzt ist.",
    what: "Zwei Verläufe über die Zeit: oben, wie weit die Mitte jeder Scheibe links oder rechts liegt, unten, wie weit tief oder hoch. Jeder Punkt ist eine Scheibe, die Linie der Schnitt der letzten fünf, gestrichelt die Mitte der Scheibe. So siehst du, ob deine Lage wandert.",
    read: "„Versetzt: rechts tief“ heißt: Die Mitte aller Schüsse des Zeitraums liegt rechts unter der Mitte, und das ist kein Zufall. Das ist der geviertelte Kreis im Trefferbild. „Passt“ heißt: Ein Versatz ist nicht belegt.",
    caution:
      "„Versetzt“ sagt Spiegel nur, wenn das kein Zufall sein kann. Dafür prüft Spiegel zuerst, ob deine Abende verschieden liegen, zur Seite und in der Höhe getrennt. Liegen sie gleich, zählt jeder Schuss. Liegen sie verschieden, zählt jeder Abend für sich. Wandern deine Abende nur zur Seite, zählt in der Höhe weiter jeder Schuss. Ohne Versatz meldet es in etwa 5 von 100 Fällen trotzdem „versetzt“, auch mit Scheiben zu 10 Schuss und wandernden Abenden in höchstens 6 von 100. Ein Versatz von 0,3 σ (beim Luftgewehr etwa 0,45 mm) zeigt sich bei 5 Scheiben zu 40 Schuss in sieben von zehn Fällen, ab 10 Scheiben fast immer. Wandern deine Abende nur zur Seite, zeigt sich ein Versatz in der Höhe genauso oft. Wandern sie in beide Richtungen um 0,2 σ, zeigt er sich bei 10 Scheiben in gut acht von zehn Fällen, ab 20 Scheiben fast immer. Der feine Rahmen um den geviertelten Kreis zeigt, wo deine Mitte sicher liegt.",
    minimum: "Ab 5 Scheiben mit Lage, je mindestens 3 Schuss.",
    formula:
      "Mitte x̄ = Σ nⱼmⱼ / N über alle Schüsse; je Richtung (seitlich, Höhe): W = Σ Sⱼ / (N − k), M = Σ nⱼ(mⱼ − x̄)² / (k − 1), Vortest F = M/W mit F(k − 1, N − k), Wandern bei p < 0,5; ohne Wandern V = T/N mit T = (Σ Sⱼ + (k − 1)M)/(N − 1), ν = N − 1; mit Wandern V = (B Σ nⱼ² + W N)/N², B = (M − W)/n₀, ν = k − 1; t² = x̄²/V mit F(1, ν); beide Richtungen nach Bonferroni p = min(1, 2 · min(pₓ, p_y)), versetzt bei p < 0,05; Rahmen = x̄ ± √(F₀,₉₇₅(1, ν) · V) je Richtung",
  },
  {
    id: "ausreisserrichtung",
    title: "Ausreißerrichtung",
    theme: "period",
    catalog: ["L7"],
    metrics: [],
    short: "In welche Richtung deine Schüsse aus der Gruppe reißen.",
    what: "Spiegel nimmt von jeder Scheibe das weiteste Zehntel der Schüsse, gemessen von der Mitte dieser Scheibe. Die Uhr zählt, in welche Richtung sie von dort liegen.",
    read: "„Meist nach links unten“ heißt: Deine Ausreißer gehen bevorzugt in diese Richtung, und das ist kein Zufall. Das ist etwas anderes als die Lage. Die Lage sagt, wo deine Gruppe liegt. Die Ausreißerrichtung sagt, wohin einzelne Schüsse aus ihr wegreißen.",
    caution:
      "Eine längliche Gruppe hat Ausreißer an beiden Enden. Das ist keine Richtung, und Spiegel sagt dann auch keine. Ohne Vorzugsrichtung meldet es in höchstens etwa 3 von 100 Fällen eine. Reißt jeder zehnte Schuss um 2 σ in dieselbe Richtung, erkennt Spiegel das bei 20 Scheiben zu 40 Schuss in gut der Hälfte der Fälle, bei 40 Scheiben in neun von zehn. Bei 3 σ erkennt es das ab 10 Scheiben fast immer.",
    minimum: "Ab 30 Ausreißern, gezählt aus Scheiben ab 10 Schuss.",
    formula:
      "je Scheibe die k = max(1, round(n/10)) Schüsse mit dem größten Abstand zu ihrem Schwerpunkt, Richtung von dort; Rayleigh-Test mit p = exp(√(1 + 4n + 4(n² − R²)) − (1 + 2n)) (Zar), Vorzugsrichtung bei p < 0,05",
  },
  {
    id: "gegen-den-schnitt",
    title: "Abstand zum Schnitt davor",
    theme: "period",
    catalog: ["C4"],
    metrics: [],
    short: "Wie deine Scheibe zum Schnitt deiner fünf Scheiben davor passt.",
    what: "Der Unterschied zwischen dem Ø je Schuss einer Scheibe und dem Schnitt deiner bis zu fünf Scheiben davor in derselben Disziplin; im Fortschritt zählen dazu nur Scheiben der gewählten Art, und Trainings nur aus Probe nur, wenn sie mitzählen. Die Scheibe selbst zählt nicht mit. Gezählt werden alle deine Scheiben davor, nicht nur die im gewählten Zeitraum.",
    read: "+0,12 heißt: 0,12 Ringe je Schuss über dem Schnitt der Scheiben davor. In der Grundeinstellung steht dieselbe Zahl unter Scheiben, auf Start und in der Ablesung im Fortschritt; ein Bezug für eine Scheibe überall.",
    caution:
      "Eine Scheibe ist eine Scheibe: Ein Abstand zum Schnitt, der in deinem Formband bleibt, ist normal.",
    minimum: "Ab der zweiten Scheibe; mit weniger als fünf davor über so viele, wie es gibt.",
    formula:
      "Δ = Ø je Schuss der Scheibe − Ø je Schuss über alle Wertungsschüsse der bis zu fünf Scheiben davor, ohne sie selbst",
  },
  {
    id: "rekorde",
    title: "Rekorde",
    theme: "period",
    catalog: ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R10", "R11"],
    metrics: [],
    short: "Deine Bestwerte über alle Scheiben, die zählen.",
    what: "Bestes Ergebnis, beste Serie, bester Teiler, engste Serie zu zehn und engste Scheibe, meiste 10,9 (nur in Zehnteln), meiste Zehner und Innenzehner auf einer Scheibe und in einer Serie, längste Folge von Zehnern, längste Folge ohne Schuss unter 9, dein bester schwächster Schuss, die kleinste Spanne zwischen bester und schwächster Serie und deine beste Form: der höchste Schnitt je Schuss über fünf Scheiben in Folge, über ihre Schüsse gerechnet. Ergebnis, engste Scheibe, die Zahl der 10,9, Zehner und Innenzehner auf einer Scheibe, der schwächste Schuss und die Spanne der Serien gelten je Schusszahl der Scheibe („Scheibe zu 40 Schuss“), denn 40 und 60 Schuss sind nicht vergleichbar. Die beste Serie und die Zehner einer Serie gelten je Serienlänge („Serie zu 10 Schuss“).",
    read: "Bei Gleichstand bleibt der frühere Rekord, denn er hat ihn zuerst gesetzt. Rekorde gibt es je Wertung (Zehntel oder ganze Ringe) und wahlweise nur für Training oder nur für Wettkampf; sie gelten über alle deine Scheiben, nicht nur über den gewählten Zeitraum.",
    caution:
      "Es zählen nur abgeschlossene, vollständige Scheiben. Nicht zählen Scheiben nur aus dem Ausdruck, neu gewertete, von dir ausgenommene und jede mit einem verdächtigen Schuss in der Wertung. Eine Trainingsscheibe nur mit Probe zählt mit, solange „Trainings nur aus Probe mitzählen“ im Blatt „Filter“ an ist (die Vorgabe); dann gilt ihre Probe wie Wertung, in Serien zu zehn. Ebenso eine Scheibe, deren Probe du als Wertung zählst.",
    minimum: "Ab 1 Scheibe, die beste Form ab 5 Scheiben.",
  },
  {
    id: "zeitraum-vergleich",
    title: "Zwei Zeiträume im Vergleich",
    theme: "compare",
    catalog: ["C3", "T3"],
    metrics: [],
    short: "Ob sich eine Zahl zwischen zwei Zeiträumen wirklich verändert hat.",
    what: "Spiegel vergleicht zwei Zeiträume, etwa vor und nach einem neuen Abzug. Genauso vergleicht es deine Wettkämpfe mit deinem Training im selben Zeitraum. Die Werte rechnet es über alle Schüsse. Spiegel prüft zuerst, ob deine Abende stärker voneinander abweichen, als der Zufall der Schüsse erklärt. Wenn nicht, zählt jeder Schuss. Wenn doch, zählt jeder Abend für sich. So macht ein einzelner guter oder schlechter Abend nicht zu sicher. Liegt eine Scheibe in beiden Zeiträumen, zählt sie nur in A.",
    read: "Ein Wert in Gold ist klar besser: So ein Unterschied entstünde durch Zufall allein in höchstens 5 von 100 Vergleichen. Der Satz oben nennt das „ein klarer Unterschied“. Ob kleiner besser ist, weiß Spiegel je Zahl. Bei der Streuung ist kleiner besser. Steht nichts in Gold, ist kein Unterschied belegt. Das heißt nicht „gleich geblieben“. Diese Scheiben reichen nicht, es zu zeigen oder auszuschließen. Unter 5 Scheiben je Seite steht „zu wenige Scheiben“.",
    caution:
      "Bei gleicher Form gibt Spiegel in höchstens etwa 5 % der Vergleiche trotzdem ein Urteil. Wird dein σ beim Luftgewehr von 1,5 auf 1,3 mm kleiner (40 Schuss je Scheibe, im Mittel 0,1 Ring mehr je Schuss), erkennt Spiegel das bei 5 gegen 5 Scheiben in knapp sechs von zehn Fällen, bei 10 gegen 10 in gut neun von zehn. Eine kleine Veränderung braucht viel mehr Scheiben: Bei σ 1,5 auf 1,45 mm (etwa ein Ring mehr auf 40 Schuss) erkennt es Spiegel bei 20 gegen 20 Scheiben nur in etwa jedem fünften Fall, bei 30 gegen 30 in knapp jedem dritten. Fehlt Einheiten die Streuung der Schüsse (Einheiten nur aus Serien), vergleicht Spiegel die Werte je Einheit. Zeigen Test und Mittel dann in verschiedene Richtungen, gibt es kein Urteil. Ein Unterschied zwischen Wettkampf und Training sagt, dass es so ist, nicht warum.",
    minimum: "Ein Urteil ab 5 Scheiben je Seite.",
    formula:
      "Werte über alle Schüsse; Mittel (Ø, Quote) über zwei Ebenen: je Seite Vortest auf Wandern der Abende (α 0,5), ohne Wandern V = T/N mit ν = N − 1, sonst V = (B Σ nⱼ² + W N)/N² mit ν = k − 1; t = Δ/√(Vₐ + V_b), ν nach Welch, zweiseitig, α 0,05; Streuung über die Varianzen: ohne Wandern F-Test der gepoolten Varianzen, sonst Welch-t über ln sⱼ²; ohne Streuung der Schüsse Mann-Whitney über die Werte je Scheibe; Δ = A − B",
  },
  {
    id: "scheibe-vergleich",
    title: "Zwei Scheiben im Vergleich",
    theme: "compare",
    catalog: ["C2"],
    metrics: [],
    short: "Ob zwei Scheiben sich in Ergebnis, Streuung oder Lage wirklich unterscheiden.",
    what: "Spiegel legt die Wertungsschüsse zweier Scheiben nebeneinander, wie sie auf dem Ausdruck stehen. Es vergleicht drei Dinge: die Werte der Schüsse, wie weit jeder Schuss von der Mitte seiner Scheibe liegt und wo die beiden Mitten liegen. Bei zwei Scheiben zählt jeder Schuss einzeln.",
    read: "Ein Wert in Gold ist klar besser: So ein Unterschied entstünde durch Zufall allein in höchstens 5 von 100 Vergleichen. Steht nichts in Gold, ist kein Unterschied belegt. Das heißt nicht „gleich“. Die Schüsse reichen dann nicht, um es zu zeigen.",
    caution:
      "Zwei Scheiben sind zwei Abende. Ein Unterschied zwischen ihnen sagt, dass dieser Abend anders war, nicht warum. Ob sich etwas dauerhaft verändert hat, zeigt erst der Vergleich zweier Zeiträume. Ohne Unterschied meldet Spiegel in etwa 5 von 100 Vergleichen trotzdem einen. Streut eine Scheibe 1,25-mal so weit wie die andere, erkennt Spiegel das bei 40 Schuss je Scheibe nur in etwa 4 von 10 Fällen, bei 1,5-mal so weit in gut 8 von 10. Ein kleiner Unterschied zwischen zwei Scheiben bleibt also oft unentdeckt.",
    minimum: "Ein Urteil ab 5 Schuss je Scheibe.",
    formula:
      "Ergebnis und Streuung: Mann-Whitney zweiseitig, α 0,05, über die Werte der Schüsse bzw. ihre Abstände zur Mitte ihrer Scheibe, Δ = Mittel A − Mittel B; Lage: Hotelling-T² für zwei Stichproben mit gepoolter Kovarianz, F(2, n₁ + n₂ − 3)",
  },
  {
    id: "lage-vergleich",
    title: "Lage im Vergleich",
    theme: "compare",
    catalog: ["C2", "C3"],
    metrics: [],
    short: "Ob die Mitte deiner Schüsse auf beiden Seiten an derselben Stelle liegt.",
    what: "Spiegel vergleicht, wo die Mitte der Schüsse von A und wo die von B liegt. Bei zwei Scheiben zählt jeder Schuss. Bei zwei Zeiträumen ist jede Mitte die aller Schüsse einer Seite. Liegen die Abende einer Seite verschieden, zählt dort jeder Abend für sich. Die Zahl ist der Abstand der beiden Mitten.",
    read: "Steht der Abstand in Gold, liegen die Mitten klar auseinander: Zufall allein schafft das in höchstens 5 von 100 Vergleichen. In welche Richtung, sagt der Satz oben. Ohne Gold ist kein Versatz belegt. Das heißt nicht, dass beide Mitten genau gleich liegen.",
    caution:
      "Ohne Versatz meldet Spiegel in etwa 5 von 100 Vergleichen trotzdem einen. Bei zwei Scheiben zu 40 Schuss erkennt es einen Versatz von einem halben σ (beim Luftgewehr etwa 0,75 mm) in etwa der Hälfte der Fälle. Bei zwei Zeiträumen erkennt es einen Versatz von 0,3 σ bei 5 Scheiben je Seite in gut der Hälfte der Fälle, bei 10 Scheiben je Seite in gut neun von zehn. Wandert deine Mitte von Abend zu Abend um 0,2 σ, zeigt er sich erst bei 20 Scheiben je Seite in neun von zehn Fällen.",
    minimum:
      "Ab 5 Schuss je Scheibe, bei Zeiträumen ab 5 Scheiben je Seite mit je mindestens 3 Schuss mit Lage.",
    formula:
      "Hotelling-T² für zwei Stichproben: S = ((n₁ − 1)S₁ + (n₂ − 1)S₂)/(n₁ + n₂ − 2), T² = n₁n₂/(n₁ + n₂) · dᵀS⁻¹d, F = (n₁ + n₂ − 3)/(2(n₁ + n₂ − 2)) · T², p = (1 + 2F/ν)^(−ν/2) mit ν = Zahl aller Punkte − 3, versetzt bei p < 0,05; bei Zeiträumen die Mitten über alle Schüsse und über zwei Ebenen je Richtung wie „Lage über Zeit“, Δ = A − B, V = Vₐ + V_b, ν nach Welch über die Spuren",
  },
]
