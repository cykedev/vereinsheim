import type { HelpText } from "@vereinsheim/ui/design2/help"

// Erklärungen der Statistik, freigegeben im Textbuch (vault/_attachments/textbuch-ringwerk-treffsicher.md, „Treffsicher:
// Statistik als Seite eines Zeitraums“). Die Ids sind die von Spiegel (`shot-help`): Dieselben Bausteine fragen nach
// ihnen, in Treffsicher antworten diese Texte über Einheiten statt Scheiben.

export const STATISTICS_TOPICS = {
  ergebnis: {
    title: "Ø je Schuss",
    short: "Der Durchschnitt deiner Wertungsschüsse je Schuss.",
    what: "Die Summe deiner Wertungsserien geteilt durch die Zahl der Wertungsschüsse. Probe zählt nicht mit. Hast du keine Einzelschüsse eingetragen, zählt je Serie die Schusszahl der Disziplin.",
    read: "Der Ø je Schuss vergleicht Einheiten mit verschiedener Schusszahl fair. In Disziplinen mit Zehnteln schaltest du oben zwischen Zehnteln und ganzen Ringen um.",
    caution:
      "In ganzen Ringen zählen nur Einheiten mit Einzelschüssen. Aus einer Serie in Zehnteln lassen sich die ganzen Ringe nicht ablesen.",
  },
  quoten: {
    title: "Zehnerquote",
    short: "Wie viele deiner Wertungsschüsse eine Zehn sind.",
    what: "Der Anteil der Zehner an deinen Wertungsschüssen. Es zählen nur Einheiten mit Einzelschüssen.",
    read: "25 % heißt: jeder vierte Schuss eine Zehn.",
    caution: "Bei wenigen Schüssen schwankt die Quote stark. Ein Abend mit 20 Schuss sagt wenig.",
  },
  "lage-echt": {
    title: "Schwerpunkt-Abstand",
    short: "Wie weit die Mitte deiner Treffer von der Mitte der Scheibe liegt.",
    what: "Die Trefferlage vom Ausdruck, waagrecht und senkrecht in mm, als ein Abstand zur Mitte.",
    read: "0,5 mm heißt: Deine Treffer liegen im Mittel einen halben Millimeter neben der Mitte. Kleiner ist besser.",
    act: "Bleibt der Abstand über mehrere Einheiten groß und in derselben Richtung, lohnt ein Blick auf die Visierung.",
    caution: "Es zählen nur Einheiten, bei denen du die Trefferlage eingetragen hast.",
  },
  "verlauf-und-form": {
    title: "Verlauf und Form",
    short: "Wie sich eine Zahl von Einheit zu Einheit entwickelt, mit deiner typischen Schwankung.",
    what: "Jeder Punkt ist eine Einheit. Die Linie ist der Schnitt der letzten fünf Einheiten. Sie ist gestrichelt, solange es noch keine fünf sind. Das Formband um die Linie zeigt, wie weit deine Einheiten üblicherweise um diesen Schnitt schwanken. Je Monat zeigt die Statistik dazu Boden und Decke: den Wert an einem schwachen Tag, den mittleren und den an einem guten Tag.",
    read: "Liegt eine Einheit im Band, war sie für deine Form normal. Etwa zwei von drei Einheiten liegen darin. Wird dein Boden über die Monate besser, werden deine schwachen Tage besser.",
    caution: "Eine einzelne Einheit außerhalb des Bands ist noch kein Formknick.",
    minimum: "Ab 1 Einheit. Das Formband ab 10 Einheiten, Boden und Decke ab 5 Einheiten im Monat.",
  },
  trainingsumfang: {
    title: "Trainingsumfang",
    short: "Wie viel du trainierst: Schüsse, Einheiten und Tage je Woche.",
    what: "Je Woche die Zahl deiner Wertungsschüsse, deiner Einheiten und der Tage mit Training. Auch Wochen ohne Training stehen da.",
    read: "Der Umfang sagt nichts über die Güte. Leg ihn neben den Verlauf. Liegen deine Einheiten in Wochen mit sehr vielen Schüssen öfter unter dem Formband, kann das Ermüdung sein.",
  },
  "zeitraum-vergleich": {
    title: "Zwei Zeiträume im Vergleich",
    short: "Ob sich eine Zahl zwischen zwei Zeiträumen wirklich verändert hat.",
    what: "Die Statistik vergleicht zwei Zeiträume. Die Werte rechnet sie über alle Schüsse. Eine Einheit mit 40 Schuss zählt viermal so viel wie eine mit 10. Sie prüft zuerst, ob deine Einheiten stärker voneinander abweichen, als der Zufall der Schüsse erklärt. Wenn nicht, zählt jeder Schuss. Wenn doch, zählt jede Einheit für sich. Einheiten nur aus Serienergebnissen vergleicht sie Einheit für Einheit.",
    read: "Steht „besser“ oder „schwächer“, entstünde so ein Unterschied durch Zufall allein in höchstens 5 von 100 Vergleichen. Steht „kein klarer Unterschied“, heißt das nicht „gleich geblieben“. Die Einheiten reichen nur nicht, es zu zeigen. „Deutlich“ heißt: Der Unterschied ist groß genug, um im Training etwas auszumachen.",
    caution: "Unter 5 Einheiten je Seite gibt es kein Urteil.",
  },
  "gegen-den-schnitt": {
    title: "Abstand zum Schnitt davor",
    short: "Wie deine Einheit zum Schnitt deiner fünf Einheiten davor passt.",
    what: "Der Unterschied zwischen dem Ø je Schuss einer Einheit und dem Schnitt deiner bis zu fünf Einheiten davor in derselben Disziplin. Die Einheit selbst zählt nicht mit.",
    read: "+0,12 heißt: 0,12 Ringe je Schuss über dem Schnitt der Einheiten davor.",
    caution: "Ein Abstand, der in deinem Formband bleibt, ist normal.",
  },
  rekorde: {
    title: "Rekorde",
    short: "Deine Bestwerte über alle Einheiten, die zählen.",
    what: "Bestes Ergebnis, beste Serie, meiste Zehner auf einer Einheit und in einer Serie, längste Folge von Zehnern, längste Folge ohne Schuss unter 9, dein bester schwächster Schuss, die kleinste Spanne zwischen bester und schwächster Serie und deine beste Form über fünf Einheiten in Folge. In Zehnteln dazu die meisten 10,9. Ergebnisse gelten je Schusszahl der Einheit, Serien je Serienlänge.",
    read: "Bei Gleichstand bleibt der frühere Rekord. Rekorde gelten über alle deine Einheiten der Disziplin, nicht nur über den Zeitraum.",
    caution: "Es zählen nur Einheiten mit Einzelschüssen in jeder Wertungsserie.",
  },
  einfluesse: {
    title: "Einflüsse",
    short: "Ob du an Tagen mit gutem Befinden oder guter Ausführung anders schießt.",
    what: "Für jedes Merkmal teilt die Statistik deine Einheiten im Zeitraum in zwei Gruppen: über deinem mittleren Wert und darunter. Einheiten genau auf dem mittleren Wert zählen zur kleineren Gruppe. Dann vergleicht sie den Ø je Schuss der beiden Gruppen, so wie zwei Zeiträume. Bei der Ausführung zählt das Mittel deiner bewerteten Wertungsserien.",
    read: "„Guter Schlaf: deutlich besser“ heißt: Nach gutem Schlaf liegt dein Ø je Schuss klar höher. „Kein klarer Unterschied“ heißt nicht, dass es keinen gibt. Die Einheiten reichen nur nicht, es zu zeigen.",
    act: "Trag das Befinden vor jeder Einheit ein. Erst mit vielen Einheiten zeigt sich ein Muster.",
    caution:
      "Ein Zusammenhang ist noch kein Grund. Wer müde ist, trainiert vielleicht auch anders.",
    minimum: "Ein Urteil ab 5 Einheiten je Gruppe.",
  },
  selbstbild: {
    title: "Selbstbild",
    short:
      "Wie du dich vor der Einheit einschätzt und wie es danach war, im Mittel über den Zeitraum.",
    what: "Je Bereich das Mittel deiner Prognose vor der Einheit und deines Feedbacks danach. Der Abstand ist Feedback minus Prognose.",
    read: "Plus heißt: besser als gedacht. Minus heißt: schlechter als gedacht. Ist ein Bereich oft im Minus, schätzt du ihn vorher zu gut ein.",
    caution:
      "Beide Werte sind deine eigene Einschätzung. Ein Urteil gibt es nicht, dafür sind es zu wenige Einheiten.",
  },
} as const satisfies Record<string, HelpText>
