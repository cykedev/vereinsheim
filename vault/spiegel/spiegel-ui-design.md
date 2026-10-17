---
id: spiegel-ui-design
type: concept
title: "Spiegel — Design 2 und Bildschirme"
aliases: [spiegel-design, design-2, spiegel-ui]
keywords: [design, ui, ux, design 2, modern, zeichnen, haarlinie, non-scaling-stroke, zoom, schwerpunkt-symbol, geviertelt, streukreis-ring, ganze ringe, zehntel, zehntelwertung, ganzringwertung, umschalten, wertung umschalten, prototyp, bottom navigation, untere navigation, scannen, session-detail, trefferbild, wiedergabe, replay, serien, kacheln, hell, dunkel, farbskala, ringwert-farben, farbenblind, archivo, geist, typografie, pwa, mobil, desktop, sonderfälle, probe-blöcke, merkmale, als wertung zählen, nicht meine, trainingsabend]
part_of: ["[[spiegel]]"]
governed_by: ["[[adr-030]]"]
relates_to: ["[[component-canon]]", "[[navigation-pattern]]", "[[spiegel-metrics]]", "[[spiegel-edge-cases]]", "[[spiegel-target-library]]", "[[spiegel-mobile]]"]
---

**TL;DR** Spiegel ist modern, ruhig und datengetrieben: die Scheibe ist der Held, die Oberfläche bleibt kühl-neutral, Farbe kommt aus den Daten, hell und dunkel. Auf dem Handy gibt es eine untere Navigation, auf dem Desktop eine Seitenleiste und eine Analysezentrale. Die Bausteine liegen in `packages/shot-ui`; ein klickbarer Prototyp liegt in `vault/_attachments/spiegel-konzept.html`.

## Grundsätze

- **Die Scheibe ist der Held.** Ergebnis groß daneben, Analyse darunter, Details auf Antippen.
- **Farbe kommt aus den Daten.** Die Oberfläche bleibt kühl-neutral (Blaugrau), damit Ringwerte, Serien und Vergleiche leuchten.
- **Daumenzone ohne Verdecken.** Navigation unten, Inhalte enden davor (die ShotsApp verdeckt dort Serienwerte).
- **Bewegung mit Bedeutung:** Der Ausschnitt gleitet beim Zoom auf die Gruppe; Wiedergabe in echter Reihenfolge und weiche Übergänge von der Liste in die Scheibe sind noch nicht gebaut. Mit „Bewegung reduzieren“ springt alles.
- **Hell und dunkel:** dunkel für die Halle am Abend, hell für Tageslicht. Die Darstellung (System, Hell, Dunkel) stellt man in Profil um, am Desktop auch unten in der Seitenleiste.
- **Desktop ist die Analysezentrale:** links die Scheibe, rechts Ergebnis, Ablesung und Schüsse, darunter die Analyse in voller Breite (siehe „Seitenaufbau“).
- **Zahlen in Worten:** die wichtigste Beobachtung als Satz ([[spiegel-metrics]]).
- **Alltagsworte vorn, Fachbegriffe im Blatt** ([[spiegel-durchsicht]]): Auf Kopf, Überblick, Start, Fortschritt
  und Listen stehen „Streuung“, „Tempo“, „sicher zwischen …“, „deutlich besser“, „kein klarer Unterschied“, „passt“
  und „versetzt“; σ, R50, T², Median und „95 %“ nur im Blatt „?“ und in den Karten der Reiter. Wochen heißen nach
  ihrem Montag („Woche ab 06.07.“), nicht „KW“. `pnpm --filter spiegel pruefen` sucht die Fachbegriffe auf den ersten
  beiden Ebenen der App.
- **Ganze Ringe oder Zehntel, jederzeit:** Jeder Wert lässt sich zwischen beiden Wertungen umschalten (unten).

## Navigation (Handy)

Start · Scheiben · **Scannen** (Meyton-QR, in der Mitte) · Fortschritt · Profil. Scannen steht erst mit dem QR-Weg (SP-1.7) in der Leiste; bis dahin hat sie vier Felder. Auf dem Desktop dieselben Bereiche als Seitenleiste ab 1024 px, im Querformat des Telefons eine schmale Leiste links. Abweichend vom Kopfzeilen-Schema der anderen Apps ([[navigation-pattern]]), deshalb Teil von Design 2. Einstieg, Liste, Auswahl, Blättern, Adressen und Löschen regelt [[spiegel-navigation]].

## Bildschirme

| Bildschirm | Inhalt |
|---|---|
| Start | „Offen (n)“ zum Bestätigen, der letzte Abend groß, neue Rekorde, Form der letzten 90 Tage ([[spiegel-navigation]]) |
| Scheiben | Liste nach Abend, eine Familie (Pflicht), Hinweis auf andere Familien am Abend-Kopf, Filter nach Art, Liste und Merkmal; die Auswahl mehrerer Scheiben ist offen |
| Scheibe (Session-Detail) | Kopf mit Disziplin, Art, Liste, Tag und Zeit und den wichtigsten Beobachtungen; Ergebnis mit den Kreisen für Art und Wertung; Trefferbild mit Schaltern in den Ecken (Ausschnitt Gruppe/Scheibe, übrige blass/aus, Schwerpunkt, Streukreis, Ellipse, Nummern); Serien als kleine Scheiben im gleichen Maßstab; Ablesung; Schusstabelle (Wert, Abstand zum vorigen Schuss); Analyse; „Scheibe löschen“. Offen: Wiedergabe, Original-PDF, Merkmale an der Scheibe, der Abstand der Kacheln zum Schnitt der bis zu fünf Scheiben davor ([[spiegel-navigation]]) |
| Vergleich | keine eigene Seite: Zeitraum gegen Zeitraum ist in die Seite eines Zeitraums eingebaut ([[spiegel-langzeit]]); Scheibe gegen Scheibe und Serien gegeneinander sind offen (SP-2.2) |
| Fortschritt | Seite eines Zeitraums wie die einer Scheibe: Verlauf, Liste der Scheiben, Zahlen, Analyse, Rekorde, Kalender ([[spiegel-langzeit]]) |
| Profil | Zustimmung per Sportpass, Darstellung, Papierkorb (30 Tage), Passwort, Abmelden; auf dem Telefon auch Admin. Freigaben, Export und Löschen des Kontos fehlen noch |
| Admin | Übersicht („Wartet auf dich“ nur mit Entscheidungen, darunter der Weg einer Scheibe Anlage → Brücke → Zustimmungen → Konten mit Stand und „?“), Konten mit Stand des Sportpasses, Anlage und Brücke mit Listen; jede Aktion mit Folgen über `DecisionDialog` ([[conventions]] §10) |

## Wertung: ganze Ringe oder Zehntel

- **Überall umschaltbar:** Wo ein Wert steht (Schuss, Serie, Scheibe, Kacheln, Verläufe, Rekorde, Vergleiche), lässt er sich zwischen ganzen Ringen und Zehnteln umschalten. Der Schalter ist immer erreichbar: auf der Seite einer Scheibe und auf Start als Kreis neben der Zahl, in Liste und Fortschritt als Chip in der Zeile der Filter.
- **Jede Scheibe und jede Familie hat ihre Wertung:** die Scheibe die gewählte, sonst die Wertung der Disziplin (Training und Wettkampf), sonst die wie am Stand, ohne alles Zehntel; die Familie für die Schnitte in Liste, Start und Fortschritt die gewählte, sonst die häufigste ihrer Scheiben. Umschalten speichert ([[spiegel-navigation]], „Wertung je Scheibe und je Familie“). „Amtlich“ nennt der Kreis die Wertung der Disziplin in Namen und Tooltip nur im Wettkampf.
- Wo Platz ist, steht die andere Wertung klein daneben („10 · 10,5 in Zehnteln“).
- **Fehlen die Zehntel** (Ganzring-Ausdruck ohne Lage), zeigt die Zehntel-Ansicht „–“ mit Grund, keine Schätzung (SF-18).
- Rekorde und Verläufe laufen je Wertung getrennt.
- Technisch hat jede wertbasierte Kennzahl ein Gegenstück in der anderen Wertung; ein Test erzwingt das ([[spiegel-metrics]]).

## Hilfe und Erklärungen

- **Jede Zahl ist erklärt.** An jeder Kachel des Überblicks und jeder Karte sitzt ein „?“; es öffnet die Erklärung aus `@vereinsheim/shot-help` (nachzulesen in [[spiegel-statistics-help]]): was die Zahl misst, wie man sie liest, was man tun kann, wo man sich täuscht. Auf dem Handy als Blatt von unten, ab 768 px als Karte am rechten Rand, nie nur als Tooltip.
- **Erst Worte, dann Formel.** Die Formel steht aufklappbar für Profis darunter, nie davor.
- **Schalter „Erklärungen“:** zeigt an jeder Kachel und jeder Karte der Analyse den Kurzsatz sichtbar unter dem Titel, nicht nur als Tooltip; die langen Erklärungen bleiben im Blatt, kein aufklappbares „Was heißt das?“ zwischen den Zahlen. Das „?“ einer Kachel, einer Karte, der Datenlage oder der Scheibe öffnet ihr Thema als Blatt (`Sheet` in `@vereinsheim/ui/design2` auf dem nativen `<dialog>`: Fokus, Escape und Rückkehr des Fokus übernimmt der Browser; geschlossen wird aus dem Zustand, weil das `close`-Ereignis spät oder gar nicht kommt). Die Feldnamen („Was“, „So liest du es“ …) sind die des Leitfadens; ein Test hält sie gleich.
- **Auch „–“ und „kann Zufall sein“ erklären:** „ab 10 Schuss“ sagt, warum ein Wert fehlt, aber nur, wenn es an der Zahl der Schüsse liegt; fehlen Daten, nennt die Kachel sie („ohne Zeiten“, „ohne Zehntel · auf ganze Ringe schalten“, SF-18); „kann Zufall sein“ sagt, was mehr Schüsse klären würden.
- **Einmal oben erklärt:** Ein Einstieg „So liest du die Analyse“ erklärt n, „sicher zwischen …“, „sicher“ und „kann Zufall sein“ und die Wertung, damit die Karten kurz bleiben.
- **Ein Glossar** für die Begriffe (σ, R50, Median, Hotelling …), aus jeder Erklärung verlinkt.
- **Eine Quelle:** App und Doku zeigen dieselben Texte aus `@vereinsheim/shot-help`. Eine Kachel holt ihr Thema mit `helpForMetric(key)`, eine Karte mit `helpTopic(id)`, eine Auswertung über ihre Katalog-ID mit `helpForCatalog(id)`. `short` ist der Satz für Kachel und Tooltip, `what`, `read`, `act`, `caution` und `minimum` sind die Erklärung, `formula` das Aufklappbare. [[spiegel-statistics-help]] wird daraus erzeugt.

## Analyse einer Scheibe

Die Auswertungen des Fachkerns als Baustein `@vereinsheim/shot-ui/analysis/AnalysisPanel`, auf der Seite einer
Scheibe unter Scheibe und Schüssen.

- **Grundlage:** Die Analyse rechnet über die Scheibe wie am Ausdruck, also die Wertung; gibt es nur Probe, über alle
  Probeschüsse als Training (`analysisInput`). Sie folgt nicht der Auswahl an der Scheibe; der Kopf nennt die
  Grundlage („Analyse über alle Schüsse“ oder „über alle Probeschüsse“).
- **Fünf Reiter:** Überblick (acht Kacheln, Beobachtungen in Worten, Einstieg), Ergebnis, Präzision, Lage, Zeit und
  Verlauf. Im Überblick zählt die Kachel „Ausreißer“, wie viele aus der Gruppe fallen. Darunter die Zeile
  „Datenlage“, Glossar und typische Fehlschlüsse.
  Die Reiterleiste ist ein eigener Streifen, der beim Scrollen klebt (auf dem Telefon über der Sprungleiste, ab
  768 px darunter), bleibt eine Zeile und scrollt seitlich in sich ([[spiegel-mobile]]).
- **Karten im Raster:** breite Karten allein, schmale zu zweit in Zeilen, sobald der Bereich der Karten 820 px
  breit ist (Container, nicht Fenster), beide Karten einer Zeile gleich hoch, eine einzelne letzte Karte über die
  volle Breite; jeder Abstand 16 px. CSS-Spalten ließen Lücken unter der kürzeren Spalte und verschluckten Ränder.
- **Diagramme** als SVG in Bildschirm-Pixeln (Breite gemessen, ohne Messung 600 px), Schrift 12 px, Farben aus
  den Design-2-Tokens. Punkte tragen einen dunklen Rand, Ausreißer zusätzlich einen Ring (nicht nur Rot). Das
  Schwerpunkt-Zeichen ist dasselbe wie auf der Scheibe.
- **Lineal** ([[spiegel-mobile]]): Verlauf, Rhythmus und Zehntel-Säulen liest man per Antippen oder
  Ziehen ab; die Werte stehen in einer Zeile über dem Diagramm, eine senkrechte Linie markiert die Stelle.
  Darunter „Werte als Tabelle“, auch bei der Richtungsuhr.
- **Kopplung an die Scheibe:** Der Knopf „Vertrauensellipse auf der Scheibe“ in „Ist die Lage versetzt?“ schaltet
  die Ebene der Scheibe. Der Bezug der Richtungsuhr (Mitte oder Schwerpunkt) gehört der Karte. „Auf der Scheibe“ im
  Lineal von Verlauf und Rhythmus wählt den Schuss dort; ein auf der Scheibe gewählter Schuss steht im Lineal.
- **Hilfe an jeder Karte:** Titel und Kurzsatz aus dem Thema (keine Katalog-IDs), im Kopf ein „?“, das die
  Erklärung als Blatt öffnet; „Erklärungen“ zeigt den Kurzsatz unter dem Titel. Glossar und typische Fehlschlüsse
  bleiben aufklappbar am Ende der Analyse.

## Seitenaufbau

Die Seite einer Scheibe für Telefon, Tablet und Desktop (Begründung und Befunde in [[spiegel-mobile]]). Bausteine
unter `@vereinsheim/shot-ui/layout/*` und `readout/*`.

- **Kopf** (`CardHeader`): Titel und Metazeile (Art, Liste aus Meyton, Tag, Uhrzeit), auf dem Telefon das Ergebnis,
  darunter die wichtigsten Beobachtungen (höchstens drei, die Lage zuerst, je ihr erster Satz; auf dem Telefon nur die
  erste, sonst rutscht die Scheibe unter die untere Leiste) und „Alle Beobachtungen ›“; ab 768 px im Raster der Seite
  über der Scheibe (`PAGE_COLUMNS`).
- **Ergebnis** (`CardResult`): groß, darunter die Schusszahl wie am Ausdruck („40 Schuss“), Zehner, Innenzehner und
  bester Teiler, rechts in der Zeile der Zahl die Kreise für Art und Wertung; alles über die ganze Scheibe. Auf dem
  Telefon im Kopf (erster Bildschirm), ab 768 px als Box rechts über der Ablesung. Eine eigene Übersicht daneben gibt
  es nicht, sie wiederholte Ergebnis und Schusszahl.
- **Sprungleiste** (`SectionNav`) unter dem Kopf, klebt oben: „Scheibe · Schüsse · Analyse“ als Anker (einen
  Abschnitt „Zahlen“ gibt es nicht, der Überblick der Analyse ist die Zahlen-Ansicht, [[spiegel-durchsicht]]), auf
  dem Telefon gleich breite Felder, nie angeschnitten. Aktiv ist der späteste Abschnitt, dessen Anfang die Leiste
  erreicht hat (bis 40 px darunter, beim Scrollen gemessen); so ist nach einem Sprung genau dieser Abschnitt aktiv,
  auch wenn er kürzer ist als das Fenster. In der Analyse deckt auf dem Telefon ihre Reiterleiste die Sprungleiste ab.
- **Schalter in den Ecken der Scheibe** (`TargetControls`, wie an einer DISAG-Anzeige): oben links Lupe (Ausschnitt
  Gruppe/Scheibe) und übrige Schüsse blass oder aus, oben rechts das „?“, unten links Schwerpunkt und Streukreis,
  unten rechts Vertrauensellipse und Nummern; runde Knöpfe zu 28 px nur mit Symbol, Name als Tooltip und für
  Screenreader. Eine Leiste über der Scheibe bräche in schmalen Spalten um oder würde angeschnitten und kostete Höhe.
  Im Ausschnitt „Scheibe“ bleibt der äußere Ring ab 290 px Kastenbreite frei. Ebenen, „übrige blass/aus“ und
  Ausschnitt merkt sich die App (Cookie).
- **Telefon:** eine Spalte. Kopf und Scheibe (Ablesezeile `ShotLine` statt Ablese-Karte) passen auf den ersten
  Bildschirm, die Serien folgen direkt; dann Schüsse und Analyse. Die Schusstabelle zeigt die zehn neuesten Schüsse
  und „Alle 40 zeigen“, der gewählte bleibt sichtbar.
- **Ab 768 px** (`CardPage`): links die Scheibe, darunter die Serien, zusammen so groß, dass beide unter der Leiste
  ins Fenster passen (`useTargetFit` misst die Spalte; bleibt für die Scheibe weniger als 280 px, passt sie allein
  ins Fenster und die Serien folgen darunter). Rechts daneben Ergebnis, Ablese-Karte und Schusstabelle; die Tabelle
  reicht höchstens bis zur Unterkante der Serien und scrollt dann in sich, mit wenigen Schüssen ist sie nur so hoch
  wie ihre Zeilen. Die Analyse folgt darunter in voller Breite, die Scheibe scrollt dort mit weg: Neben der Scheibe
  bleibt, was zu ihr gehört, unten steht, was mehr Platz braucht. Die Kacheln des Überblicks stehen zu vier, die
  Karten der Analyse zu zweit; ihre Spalten richten sich nach der Breite des Bereichs, nicht des Fensters. Auch im
  Querformat am Telefon passt die Scheibe in die Höhe.
- **Ohne Schüsse** (`NoShots`): nur Kopf, Scheibe und daneben „Noch kein Schuss“ mit einem Satz, was hier
  erscheint; keine Sprungleiste, keine leeren Kästen, keine Kacheln voller Striche. Mit dem ersten Schuss erscheint
  die ganze Seite.
- **Sprung zur Scheibe mit Rücksprung:** Schaltet der Knopf „Vertrauensellipse“ in der Analyse oder eine Zeile der
  Schusstabelle die Scheibe und ist sie außer Sicht, springt die Seite zu ihr und zeigt die Pille
  „Zurück zu „Lage““. Gesprungen wird sofort wie bei Ankern, nicht gleitend.
- **Adresse:** Abschnitte und Reiter als einfache, englische Anker (`#target` … `#analysis`, `#overview` …
  `#time`; [[spiegel-navigation]]); ein Reiter-Anker öffnet den Reiter, ein Reiterwechsel schreibt den Anker.
- **Optik wie am Desktop:** Umschalter, Chips und Knöpfe behalten auf dem Telefon ihre Höhe.

## Zeichnen der Scheibe

Minimal und scharf, nichts Klobiges, auch stark vergrößert.

- **Haarlinien, die nicht mitwachsen:** Ringlinien, Trefferränder und Streukreis sind 1 px breit und bleiben es in jeder Zoomstufe (`vector-effect: non-scaling-stroke`). Keine Schatten, kein Glühen, keine dicken Ränder.
- **Treffer** in Kalibergröße, gefüllt mit der Ringwert-Farbe, mit 1-px-Rand; der Rand trennt überlappende Treffer. Die Füllung ist leicht durchscheinend (Deckkraft 0,9), der Rand voll: So bleibt sichtbar, wo Treffer sich überlagern, und die Farbe trägt trotzdem kräftig.
- **Schussnummern** auf Wunsch (Schalter „Nummern“, anfangs aus): weiß mit dunklem Saum auf der Mitte des Treffers, in fester Bildschirmgröße (8–12 px, etwa halb so groß wie der Treffer auf dem Schirm, beim Zoomen nie größer). **Jede Nummer gehört zu ihrem Treffer:** Treffer und Nummer werden zusammen in Abgabefolge gezeichnet, ein späterer Treffer verdeckt auch die Nummer eines früheren. So sieht man, dass eine halb verdeckte Nummer zu einem tieferen Schuss gehört. Darüber liegen nur Streukreis, Ellipse und Schwerpunkt; der Ausschnitt „Gruppe“ zieht eine dichte Gruppe auseinander.
- **Alles, was etwas zeigt, liegt über den Treffern:** Streukreis, Vertrauensellipse, Markierungen und der Schwerpunkt (ganz oben). Unter den Treffern verschwänden sie gerade dort, wo die Gruppe dicht ist. Linien, die durch die Treffer laufen (Vertrauensellipse), tragen einen schmalen hellen Saum, damit sie auf farbigen Treffern lesbar bleiben; der Streukreis liegt um die Treffer und bleibt eine Haarlinie ohne Saum, auf Schwarz sähe der Saum wie eine Doppellinie aus.
- **Schwerpunkt:** ein kleiner, schwarz-weiß geviertelter Kreis (vier Segmente im Wechsel), kleiner als ein Treffer (Radius 5–8 px) und **immer ganz oben** über allen Treffern. Eine 1-px-Kontur mit 1 px hellem Saum hält ihn auf Papier, Spiegel und Treffern lesbar.
- **Streukreis:** ein 1-px-Ring in einer Farbe, die keine Ringwert-Farbe ist (Blau), **um** die Treffer gezeichnet: der Kreis durch die Zentren plus ein halbes Kaliber und 2 px Luft. Durch die Zentren gezeichnet verschwände er bei einer engen Gruppe unter den Treffern; die Zahl dazu misst weiter Mitte zu Mitte. Er erscheint ab derselben Schusszahl, ab der die Kennzahl gilt.
- **Probe-Eck** (Konvention der Probescheibe): Ein Training nur aus Probe erscheint wie Wertung und trägt auf der Scheibe und an jeder seiner Serien das schwarze Eck oben rechts. Es hängt am Ausschnitt (Schenkel 12 % der Breite) und liegt unter den Treffern.
- **Ringzahlen** in fester Bildschirmgröße (höchstens 12 px, nie größer als der Ring); sie wachsen beim Zoomen nicht mit.
- **Serien als kleine Scheiben** bei den Treffern, über der Schusstabelle: je Serie eine kleine Scheibe, alle im **gleichen Ausschnitt um die Mitte**, damit Lage und Streuung der Serien vergleichbar sind. Darunter das Serienergebnis in der gewählten Wertung (I1), bei der laufenden Serie „7 von 10 Schuss“. Die Kacheln (60–104 px) verteilen sich gleichmäßig auf die Zeilen, keine steht allein.
- **Ablesung:** kompakt in einer Zeile, der Wert groß in Schriftfarbe, davor ein Punkt in der Ringwert-Farbe, daneben die andere Wertung, Teiler und Abstand zur Mitte; kein x/y, Abstand und Teiler sagen es lesbarer. Gold und Türkis hätten als Schrift auf hellem Grund zu wenig Kontrast. Teiler und Abstand wie im Fachkern: gemessen vor der Lage, auch ohne Lage; ein verdächtiger Platzhalter ohne beides (SF-15).
- **Kein Dauer-Ring um den letzten Schuss:** In einer engen Gruppe verwirrt er. Ablesung und Liste nennen den letzten Schuss; ein neu gesetzter Schuss kann kurz aufploppen (`popIndex` in `TargetView`, in der App nicht gesetzt).
- **Antippen** eines Treffers wählt ihn. Getroffen ist der Treffer der Auswahl mit der nächsten Mitte, bis 20 px daneben (gezoomt bis an seinen Rand, wenn er größer ist); blasse Schüsse nie. Auf dem Handy misst ein Treffer auf der ganzen Scheibe nur gut 8 px, so muss man ihn nicht genau treffen. Der gewählte Treffer liegt mit Nummer und einem Haarlinien-Ring (Blau mit hellem Saum) ganz oben, die Ablesung zeigt ihn statt des letzten Schusses, ein zweites Tippen nimmt ihn zurück. Tippen setzt keinen Schuss.
- **Wie am Ausdruck, je Block eine Scheibe** ([[adr-027]]): Meyton löscht die Probe mit dem ersten Wertungsschuss; die Probe davor ist in Spiegel eine eigene Scheibe (ebenso jeder Block nach einem Neustart der Probe). Eine Scheibe ist damit reine Probe oder Wertung, und die Wertungs-Scheibe zeigt, was der Ausdruck zeigt. Also gibt es keine Probe neben Wertung: keine Probe-Kachel bei den Serien, kein „Ohne Probe“, kein Reiter „Probe“, keine „P“-Nummern. „Alle“ ist die ganze Scheibe.
- **Serien wählen: eine oder die ganze Scheibe.** Tippen auf eine kleine Scheibe zeigt nur diese Serie kräftig, eine andere wechselt, dieselbe noch einmal führt zur ganzen Scheibe zurück. Mehrere Serien zugleich sind bewusst nicht wählbar, das ist einfacher zu bedienen; Serien zu vergleichen bleibt einer eigenen Ansicht (offen, SP-2.2). Die übrigen Schüsse liegen blass darunter oder sind ausgeblendet (Schalter oben links an der Scheibe). Blass heißt grau statt Ringwert-Farbe (Token `--shot-faded`, Deckkraft 0,55, ohne Rand, ohne Nummer, nicht antippbar): Nur die Auswahl trägt Farbe. Mit Ringwert-Farbe und geringer Deckkraft gruppiert das Auge weiter nach Farbe, und die Auswahl ist schwer zu unterscheiden. Streukreis, Ellipse, Schwerpunkt und der Ausschnitt „Gruppe“ rechnen über die Auswahl, die Nummern bleiben die der ganzen Scheibe.
- **Eine andere Scheibe** steht sofort in ihrem Ausschnitt; nur ein neuer Ausschnitt derselben Scheibe gleitet (340 ms, bei „Bewegung reduzieren“ ein Sprung). Das gilt auch für eine andere Karte auf derselben Scheibe (Schlüssel der Karte, etwa die Session).
- **Hohle Treffer** (Wertung ohne Wert) sind wie alle über ihre Mitte antippbar, nicht nur am Rand; der Mauszeiger zeigt auch in ihnen die Hand.
- **Kennzahlen der Auswahl:** Die Analyse rechnet immer über die ganze Scheibe wie am Ausdruck. Für eine gewählte Serie zeigen Streukreis und Schwerpunkt auf der Scheibe, ihr Ergebnis an der kleinen Scheibe und „Serien im Vergleich“ Ergebnis, R50 und Versatz je Serie; weitere Kennzahlen einer Serie fehlen (offen, [[spiegel-durchsicht]]). Das **Ergebnis** (Schusszahl, Zehner, Innenzehner, bester Teiler) bleibt das der ganzen Scheibe, weil es deren Ergebnis zeigt.
- **Schusstabelle:** neuester Schuss oben, nur die Schüsse der Auswahl; Nummer, Wert mit Farbpunkt, Innenzehner, Teiler und der Abstand zum vorigen Schuss der Karte (nach einer Lücke in der Abgabefolge keiner; eine Pause, relativ zum Takt der Karte, in Minuten und Sekunden mit „Pause“). Jede Zeile wählt ihren Schuss wie das Antippen; der Knopf in der ersten Zelle ist der Weg per Tastatur und Screenreader, denn die Treffer auf der Scheibe sind nur zum Antippen.
- **Wertung:** Der Kreis der Wertung nennt die amtliche in Namen und Tooltip.
- **Kein „Visier verstellt“:** Eine Angabe, nach welchem Probeschuss das Visier verstellt wurde, ist zu viel Komplexität für ihren Nutzen. Spiegel fragt sie weder ab noch schlägt sie vor (SF-63). Eine Auswertung der Probe gibt es nicht.
- Scheibe, Serien, Kacheln, Ablesung, Kopf, Schusstabelle, Wertung und Hilfe sind Bausteine in `packages/shot-ui` mit den Design-2-Tokens ([[adr-030]]); die App setzt sie mit echten Daten ein, `pnpm --filter spiegel pruefen` prüft ihre Bedienung.

## Sonderfälle in der Oberfläche

Aus dem Sonderfall-Katalog ([[spiegel-edge-cases]]):

- **Nur Probe ist Training:** Eine Scheibe ohne Wertungsschuss verhält sich genau wie Wertung, auch optisch: Schüsse 1…n gefüllt, Serien zu zehn als kleine Scheiben mit Ergebnis, Trenner in der Tabelle. Die Unterscheidung brächte hier nichts; das schwarze Eck oben rechts an Scheibe und Serien erinnert an die Probe. Folgt Wertung, bleibt wie am Ausdruck nur die Wertung. Umgesetzt als eine reine Funktion an der Datengrenze (`asOnPrintout`).
- **Merkmale als ruhige Hinweise** an der Scheibe (unvollständig, korrigiert, nur PDF, neu gewertet), Erklärung auf Antippen. Offen; heute filtert die Liste nach Merkmal.
- **Aktionen an der Scheibe:** „Als Wertung zählen“ für eine vergessene Umschaltung (SF-05), „Disziplin korrigieren“, „Nicht meine“, „Aus Verläufen ausnehmen“, „An Schuss n teilen“. Offen; heute gibt es „Scheibe löschen“ (Papierkorb) und „Nicht meine“ für die erste Scheibe einer Zustimmung unter „Offen“.
- **Liste nach Trainingsabend:** alle Scheiben eines Abends gleichberechtigt, die neueste oben; kleine Scheiben (Aufwärmen, Abbruch) eingeklappt unter dem Abend erst, wenn echte Daten zeigen, dass es sie gibt (SF-11).
- **Wiedergabe mit Tempo-Wahl,** damit 100 Schuss nicht minutenlang dauern (offen).
- **Leere Werte:** Eine Kennzahl ohne Wert zeigt „–“ mit Grund („zu wenige Schüsse“), nie 0.

## Farben und Schrift (aus dem Prototyp)

- **Ringwert-Skala:** 10 rot `#e5484d`, 9 gold `#e9b10c`, 8 türkis `#1fa3c8`, ≤ 7 violett `#7c5cd6`. Mit dem Dataviz-Validator geprüft: alle Paare auch bei Farbenblindheit unterscheidbar (CVD ΔE ≥ 13). Jeder Treffer hat einen dunklen 1-px-Rand (siehe „Zeichnen der Scheibe“). Offen ist, ob stattdessen das Meyton-Schema der Treffsicher-Statistik gelten soll ([[spiegel-open-questions]]).
- **Vergleichsfarben:** A blau, B orange (geprüft).
- **Schrift:** Archivo (breit, für Zahlen und Überschriften), Geist (Text, wie heute), Geist Mono (Tabellen, Achsen).
- Kein Tortendiagramm für die Ringverteilung, sondern ein Histogramm; Zeitachsen von links nach rechts.

## Verhältnis zu `@vereinsheim/ui`

Design 2 kommt als zusätzliche Schicht ins Paket (Tokens und Bausteine); Ringwerk und Treffsicher bleiben vorerst unverändert. Spiegel nimmt vorerst nicht am Drift-Gate teil. Das ist eine bewusste Ausnahme von [[conventions]] (byte-identische Schicht, fest dunkel) und in [[adr-030]] entschieden. Der Komponenten-Kanon ([[component-canon]]) gilt weiter: PageHeader, EmptyState, ConfirmDialog, Toasts.
