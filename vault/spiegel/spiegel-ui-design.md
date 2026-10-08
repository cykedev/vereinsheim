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

**TL;DR** Spiegel ist modern, ruhig und datengetrieben: die Scheibe ist der Held, die Oberfläche bleibt kühl-neutral, Farbe kommt aus den Daten, hell und dunkel. Auf dem Handy gibt es eine untere Navigation mit zentraler Scan-Aktion, auf dem Desktop eine Analysezentrale. Der klickbare Prototyp liegt in `vault/_attachments/spiegel-konzept.html` und hat dem User gefallen.

## Grundsätze

- **Die Scheibe ist der Held.** Ergebnis groß daneben, Analyse darunter, Details auf Antippen.
- **Farbe kommt aus den Daten.** Die Oberfläche bleibt kühl-neutral (Blaugrau), damit Ringwerte, Serien und Vergleiche leuchten.
- **Daumenzone ohne Verdecken.** Navigation unten, Inhalte enden davor (die ShotsApp verdeckt dort Serienwerte).
- **Bewegung mit Bedeutung:** Wiedergabe in echter Reihenfolge, Zoom auf die Gruppe, weiche Übergänge von der Liste in die Scheibe; mit „Bewegung reduzieren“ springt alles.
- **Hell und dunkel:** dunkel für die Halle am Abend, hell für Tageslicht. Der Verein schießt nur in der 10-m-Halle; ob Phase 1 nur dunkel startet, ist offen ([[spiegel-open-questions]]).
- **Desktop ist die Analysezentrale:** Scheibe links, Kennzahlen rechts, Vergleiche nebeneinander.
- **Zahlen in Worten:** die wichtigste Beobachtung als Satz ([[spiegel-metrics]]).
- **Ganze Ringe oder Zehntel, jederzeit:** Jeder Wert lässt sich zwischen beiden Wertungen umschalten (unten).

## Navigation (Handy)

Start · Scheiben · **Scannen** (Meyton-QR, in der Mitte) · Fortschritt · Profil. Auf dem Desktop dieselben Bereiche als Seitenleiste. Abweichend vom heutigen Kopfzeilen-Schema ([[navigation-pattern]]), deshalb Teil von Design 2.

## Bildschirme

| Bildschirm | Inhalt |
|---|---|
| Start | letzte Scheibe groß, neu seit dem letzten Besuch, Aktivität, gebrochene Rekorde |
| Scheiben | Liste nach Tagen, Filter nach Disziplin und Art |
| Scheibe (Session-Detail) | Kopf mit Disziplin, Stand, Zeit, Ergebnis; Trefferbild mit Schaltern (Schwerpunkt, Streukreis, Nummern, Probe), Zoom Gruppe/Scheibe, Wiedergabe; Wertung ganze Ringe/Zehntel; Kennzahl-Kacheln mit Abstand zum 30-Tage-Schnitt; Beobachtung; Serien als kleine Scheiben im gleichen Maßstab; Schuss für Schuss (Wert, Tempo); Schusstabelle; Original-PDF |
| Vergleich | zwei Auswahlen auf einer Scheibe, Tabelle mit Differenz |
| Fortschritt | Verlauf jeder Kennzahl, Rekorde, Kalender |
| Profil | Zuordnung (Sportpass), Freigaben, Export, Löschen |
| Admin | Anlagen, Brücken-Status, Zuordnungen, Scheibenbilder, Nutzer |

## Wertung: ganze Ringe oder Zehntel

- **Überall umschaltbar:** Wo ein Wert steht (Schuss, Serie, Scheibe, Kacheln, Verläufe, Rekorde, Vergleiche), lässt er sich zwischen ganzen Ringen und Zehnteln umschalten. Der Schalter ist immer erreichbar.
- **Voreinstellung** ist die amtliche Wertung der Scheibe (Feld `Wertung` je Treffer, [[spiegel-target-library]]). Wer umschaltet, behält die Wahl, bis er zurückschaltet; die amtliche Wertung bleibt als Hinweis sichtbar.
- Wo Platz ist, steht die andere Wertung klein daneben („10 · 10,5 in Zehnteln“).
- **Fehlen die Zehntel** (Ganzring-Ausdruck ohne Lage), zeigt die Zehntel-Ansicht „–“ mit Grund, keine Schätzung (SF-18).
- Rekorde und Verläufe laufen je Wertung getrennt.
- Technisch hat jede wertbasierte Kennzahl ein Gegenstück in der anderen Wertung; ein Test erzwingt das ([[spiegel-metrics]]).

## Hilfe und Erklärungen

- **Jede Zahl ist erklärt.** An jeder Kachel und jeder Karte sitzt ein „?“; es öffnet die Erklärung aus `@vereinsheim/shot-help` (nachzulesen in [[spiegel-statistics-help]]): was die Zahl misst, wie man sie liest, was man tun kann, wo man sich täuscht. Auf dem Handy als Blatt von unten, auf dem Desktop als Karte daneben, nie nur als Tooltip.
- **Erst Worte, dann Formel.** Die Formel steht aufklappbar für Profis darunter, nie davor.
- **Schalter „Erklärungen“:** zeigt an jeder Kachel und jeder Karte der Analyse den Kurzsatz sichtbar unter dem Titel, nicht nur als Tooltip; die langen Erklärungen bleiben im Blatt (seit Oktober 2026, Plan `2026-10-08-spiegel-mobile-seitenaufbau`, D3: kein aufklappbares „Was heißt das?“ mehr zwischen den Zahlen). Das „?“ einer Kachel, einer Karte, der Datenlage oder der Scheibe öffnet ihr Thema als Blatt (`Sheet` in `@vereinsheim/ui/design2` auf dem nativen `<dialog>`: Fokus, Escape und Rückkehr des Fokus übernimmt der Browser; geschlossen wird aus dem Zustand, weil das `close`-Ereignis spät oder gar nicht kommt). Die Feldnamen („Was“, „So liest du es“ …) sind die des Leitfadens; ein Test hält sie gleich.
- **Auch „–“ und „unklar“ erklären:** „ab 10 Schuss“ sagt, warum ein Wert fehlt, aber nur, wenn es an der Zahl der Schüsse liegt; fehlen Daten, nennt die Kachel sie („ohne Zeiten“, „ohne Zehntel · auf ganze Ringe schalten“, SF-18); „unklar“ sagt, was mehr Schüsse klären würden.
- **Einmal oben erklärt:** Ein Einstieg „So liest du die Analyse“ erklärt n, 95-%-Bereich, „echt“ und „unklar“ und die Wertung, damit die Karten kurz bleiben.
- **Ein Glossar** für die Begriffe (σ, R50, Median, Hotelling …), aus jeder Erklärung verlinkt.
- **Eine Quelle:** App und Doku zeigen dieselben Texte aus `@vereinsheim/shot-help` (SP-1.11). Eine Kachel holt ihr Thema mit `helpForMetric(key)`, eine Karte mit `helpTopic(id)`, eine Auswertung über ihre Katalog-ID mit `helpForCatalog(id)`. `short` ist der Satz für Kachel und Tooltip, `what`, `read`, `act`, `caution` und `minimum` sind die Erklärung, `formula` das Aufklappbare. [[spiegel-statistics-help]] wird daraus erzeugt.

## Analyse einer Scheibe

Die Auswertungen aus SP-1.10 als Bausteine (`@vereinsheim/shot-ui/analysis/AnalysisPanel`, Schritt 3 von SP-1.8,
Oktober 2026), im Labor unter den Kacheln.

- **Grundlage:** Die Analyse rechnet über alle Schüsse ohne Probe; gibt es nur Probe, über alle Probeschüsse
  (`analysisInput`, User, 8. Oktober 2026). Sie folgt nicht der Auswahl an der Scheibe; der Kopf nennt die
  Grundlage („Analyse über alle Schüsse ohne Probe“). Der Reiter Probe rechnet über die ganze Karte.
- **Sechs Reiter** wie in der Spielwiese: Überblick (acht Kacheln, Beobachtungen in Worten, Einstieg), Ergebnis,
  Präzision, Lage, Zeit und Verlauf, Probe. Darunter die Zeile „Datenlage“, Glossar und typische Fehlschlüsse.
  Die Reiterleiste ist ein eigener Streifen, der beim Scrollen klebt (auf dem Telefon über der Sprungleiste, ab
  768 px darunter), bleibt eine Zeile und scrollt seitlich in sich ([[spiegel-mobile]]).
- **Karten im Raster:** breite Karten allein, schmale zu zweit in Zeilen, sobald der Bereich der Karten 820 px
  breit ist (Container, nicht Fenster: ab 768 px steht die Analyse rechts neben der Scheibe), beide Karten einer
  Zeile gleich hoch, eine einzelne letzte Karte über die volle Breite; jeder Abstand 16 px. CSS-Spalten ließen
  Lücken unter der kürzeren Spalte und verschluckten Ränder (User, 8. Oktober 2026).
- **Diagramme** als SVG in Bildschirm-Pixeln (Breite gemessen, ohne Messung 600 px), Schrift 12 px, Farben aus
  den Design-2-Tokens. Punkte tragen einen dunklen Rand, Ausreißer zusätzlich einen Ring (nicht nur Rot). Das
  Schwerpunkt-Zeichen ist dasselbe wie auf der Scheibe.
- **Kopplung an die Scheibe:** Der Knopf „Vertrauensellipse auf der Scheibe“ in „Lage echt?“ schaltet die Ebene
  der Scheibe. Der Bezug der Richtungsuhr (Mitte oder Schwerpunkt) gehört der Karte.
- **Probe ohne Visier:** „Probe gegen Wertung“ nimmt die ganze Probe vor der Wertung, „Eingeschossen?“ die
  letzten fünf Probeschüsse mit Lage; das Probe-Diagramm zeichnet sie in Abgabefolge.
- **Hilfe an jeder Karte:** Titel, Katalog-IDs und Kurzsatz aus dem Thema, im Kopf ein „?“, das die Erklärung als
  Blatt öffnet; „Erklärungen“ zeigt den Kurzsatz unter dem Titel. Glossar und typische Fehlschlüsse bleiben
  aufklappbar am Ende der Analyse.

## Seitenaufbau

Die Seite einer Scheibe für Telefon, Tablet und Desktop (Schritt 4 von SP-1.8, Oktober 2026; Begründung und
Befunde in [[spiegel-mobile]]). Bausteine unter `@vereinsheim/shot-ui/layout/*` und `readout/*`.

- **Kopf** (`CardHeader`): Scheibe und Metazeile, das Ergebnis groß mit Schusszahl, die Wertung ganze
  Ringe/Zehntel, darunter ein Satz (der erste Satz der ersten Beobachtung).
- **Sprungleiste** (`SectionNav`) unter dem Kopf, klebt oben: „Scheibe · Schüsse · Zahlen · Analyse“ als Anker,
  auf dem Telefon vier gleich breite Felder, nie angeschnitten. Aktiv ist der späteste Abschnitt, dessen Anfang
  die Leiste erreicht hat (bis 40 px darunter, beim Scrollen gemessen); so ist nach einem Sprung genau dieser
  Abschnitt aktiv, auch wenn er kürzer ist als das Fenster. In der Analyse deckt auf dem Telefon ihre
  Reiterleiste die Sprungleiste ab.
- **Schalter in den Ecken der Scheibe** (`TargetControls`, wie an einer DISAG-Anzeige, User, 8. Oktober 2026):
  oben links Lupe (Ausschnitt Gruppe/Scheibe) und übrige Schüsse blass oder aus, oben rechts das „?“, unten links
  Schwerpunkt und Streukreis, unten rechts Vertrauensellipse und Nummern; runde Knöpfe zu 28 px nur mit Symbol,
  Name als Tooltip und für Screenreader. Eine Leiste über der Scheibe brach in schmalen Spalten um oder wurde
  angeschnitten und kostete Höhe. Im Ausschnitt „Scheibe“ bleibt der äußere Ring ab 290 px Kastenbreite frei.
- **Telefon:** eine Spalte. Kopf und Scheibe (Ablesezeile `ShotLine` statt Ablese-Karte) passen auf den ersten
  Bildschirm, die Serien folgen direkt; dann Übersicht, Schüsse, Zahlen, Analyse. Die Schusstabelle zeigt die
  zehn neuesten Schüsse und „Alle 40 zeigen“, der gewählte bleibt sichtbar.
- **Ab 768 px** (`CardPage`): links die Scheibe fest unter der Leiste, höchstens so groß, dass sie samt Karte ins
  Fenster passt; rechts daneben, was man beim Blick auf die Scheibe braucht: Ablese-Karte, Serien, Übersicht,
  Schusstabelle. Zahlen und Analyse folgen darunter in voller Breite, die Scheibe scrollt dort mit weg (User,
  8. Oktober 2026: Bereiche, die neben der Scheibe bleiben, und Bereiche, die unten mehr Platz brauchen). Die
  Kacheln stehen zu fünf, die Karten der Analyse zu zweit; ihre Spalten richten sich nach der Breite des
  Bereichs, nicht des Fensters. Auch im Querformat am Telefon passt die Scheibe in die Höhe.
- **Sprung zur Scheibe mit Rücksprung:** Schaltet der Knopf „Vertrauensellipse“ in der Analyse oder eine Zeile der
  Schusstabelle die Scheibe und ist sie außer Sicht, springt die Seite zu ihr und zeigt die Pille
  „Zurück zu „Lage““. Gesprungen wird sofort wie bei Ankern, nicht gleitend.
- **Adresse:** Abschnitte und Reiter als einfache Anker (`#scheibe` … `#analyse`, `#ueberblick` … `#probe`); ein
  Reiter-Anker öffnet den Reiter, ein Reiterwechsel schreibt den Anker.
- **Optik wie am Desktop:** Umschalter, Chips und Knöpfe behalten auf dem Telefon ihre Höhe (User,
  8. Oktober 2026).

## Zeichnen der Scheibe

Die Optik ist dem User besonders wichtig: minimal, scharf, nichts Klobiges, auch stark vergrößert.

- **Haarlinien, die nicht mitwachsen:** Ringlinien, Trefferränder und Streukreis sind 1 px breit und bleiben es in jeder Zoomstufe (`vector-effect: non-scaling-stroke`). Keine Schatten, kein Glühen, keine dicken Ränder.
- **Treffer** in Kalibergröße, gefüllt mit der Ringwert-Farbe, mit 1-px-Rand; der Rand trennt überlappende Treffer. Die Füllung ist leicht durchscheinend (Deckkraft 0,9, vorher 0,8), der Rand voll: So bleibt sichtbar, wo Treffer sich überlagern, und die Farbe trägt trotzdem kräftig (Wunsch des Users, Oktober 2026).
- **Schussnummern** auf Wunsch (Schalter „Nummern“, anfangs aus): weiß mit dunklem Saum auf der Mitte des Treffers, in fester Bildschirmgröße (8–12 px, etwa halb so groß wie der Treffer auf dem Schirm, beim Zoomen nie größer). **Jede Nummer gehört zu ihrem Treffer:** Treffer und Nummer werden zusammen in Abgabefolge gezeichnet, ein späterer Treffer verdeckt auch die Nummer eines früheren. So sieht man, dass eine halb verdeckte Nummer zu einem tieferen Schuss gehört (Wunsch des Users, 8. Oktober 2026; vorher lagen alle Nummern in einer Ebene über allen Treffern). Darüber liegen nur Streukreis, Ellipse und Schwerpunkt; der Ausschnitt „Gruppe“ zieht eine dichte Gruppe auseinander.
- **Alles, was etwas zeigt, liegt über den Treffern:** Streukreis, Vertrauensellipse, Markierungen und der Schwerpunkt (ganz oben). Unter den Treffern verschwänden sie gerade dort, wo die Gruppe dicht ist (Wunsch des Users, Oktober 2026). Linien, die durch die Treffer laufen (Vertrauensellipse), tragen einen schmalen hellen Saum, damit sie auf farbigen Treffern lesbar bleiben; der Streukreis liegt um die Treffer und bleibt eine Haarlinie ohne Saum, auf Schwarz sähe der Saum wie eine Doppellinie aus.
- **Schwerpunkt:** ein kleiner, schwarz-weiß geviertelter Kreis (vier Segmente im Wechsel), kleiner als ein Treffer (Radius 5–8 px) und **immer ganz oben** über allen Treffern. Eine 1-px-Kontur mit 1 px hellem Saum hält ihn auf Papier, Spiegel und Treffern lesbar.
- **Streukreis:** ein 1-px-Ring in einer Farbe, die keine Ringwert-Farbe ist (Blau), **um** die Treffer gezeichnet: der Kreis durch die Zentren plus ein halbes Kaliber und 2 px Luft. Durch die Zentren gezeichnet verschwände er bei einer engen Gruppe unter den Treffern; die Zahl dazu misst weiter Mitte zu Mitte. Er erscheint ab derselben Schusszahl, ab der die Kennzahl gilt.
- **Probe-Eck** (Konvention der Probescheibe, User, 8. Oktober 2026): Zeigt die Scheibe Probe, weil alle gezeigten Schüsse Probeschüsse sind (etwa die Probe gewählt), trägt sie das schwarze Eck oben rechts; die kleine Scheibe der Probe immer. Es hängt am Ausschnitt (Schenkel 12 % der Breite), liegt unter den Treffern und fehlt, wenn Probe und Wertung zusammen zu sehen sind. Auch eine Karte nur mit Probe, die als Training wie Wertung erscheint, trägt es auf der Scheibe und an jeder Serie (User, 8. Oktober 2026).
- **Ringzahlen** in fester Bildschirmgröße (höchstens 12 px, nie größer als der Ring); sie wachsen beim Zoomen nicht mit.
- **Serien als kleine Scheiben** bei den Treffern, über der Schusstabelle: je Serie und für die Probe eine kleine Scheibe, alle im **gleichen Ausschnitt um die Mitte**, damit Lage und Streuung der Serien vergleichbar sind. Darunter das Serienergebnis in der gewählten Wertung (I1), bei der laufenden Serie „7 von 10 Schuss“; die Probe hohl, mit der Zahl der Probeschüsse. Die Kacheln (60–104 px) verteilen sich gleichmäßig auf die Zeilen, keine steht allein (Wunsch des Users, Oktober 2026).
- **Ablesung:** der Wert groß in Schriftfarbe, davor ein Punkt in der Ringwert-Farbe (Probe hohl). Gold und Türkis hätten als Schrift auf hellem Grund zu wenig Kontrast (Review, 8. Oktober 2026). Teiler und Abstand wie im Fachkern: gemessen vor der Lage, auch ohne Lage; ein verdächtiger Platzhalter ohne beides (SF-15).
- **Kein Dauer-Ring um den letzten Schuss:** In einer engen Gruppe verwirrt er. Ein neuer Schuss ploppt beim Setzen kurz auf; Ablesung und Liste nennen ihn.
- **Antippen** eines Treffers wählt ihn. Getroffen ist der Treffer der Auswahl mit der nächsten Mitte, bis 20 px daneben (gezoomt bis an seinen Rand, wenn er größer ist); blasse Schüsse nie. Auf dem Handy misst ein Treffer auf der ganzen Scheibe nur gut 8 px, so muss man ihn nicht genau treffen (User, 8. Oktober 2026). Der gewählte Treffer liegt mit Nummer und einem Haarlinien-Ring (Blau mit hellem Saum) ganz oben, die Ablesung zeigt ihn statt des letzten Schusses, ein zweites Tippen nimmt ihn zurück. In der App setzt Tippen keinen Schuss; das Labor hat dafür einen eigenen Modus.
- **Alle oder ohne Probe** (User, 8. Oktober 2026, „für korrekte Zahlen“): Die ganze Scheibe ist wählbar mit Probe („Alle“) oder ohne („Ohne Probe“, nur Wertung); Streukreis, Ellipse, Schwerpunkt, Kacheln und Tabelle rechnen danach. Grundeinstellung ist „Ohne Probe“, wenn es Probe und Wertung gibt, sonst „Alle“ (`defaultWhole`); „Ohne Probe“ erscheint nur, wenn es beides gibt. Die Übersicht bleibt die amtliche der Wertung.
- **Serien wählen: eine oder die ganze Scheibe.** Tippen auf eine kleine Scheibe zeigt nur diese Serie kräftig, eine andere wechselt, dieselbe noch einmal führt zur Grundeinstellung zurück; die Probe ist wählbar wie eine Serie. Mehrere Serien zugleich sind bewusst nicht wählbar, das ist einfacher zu bedienen (User, 8. Oktober 2026); Serien vergleichen wird eine eigene Ansicht. Die übrigen Schüsse liegen blass darunter oder sind ausgeblendet (beides im Labor zum Vergleich). Blass heißt grau statt Ringwert-Farbe (Token `--shot-faded`, Deckkraft 0,55, ohne Rand, ohne Nummer, nicht antippbar): Nur die Auswahl trägt Farbe. Mit Ringwert-Farbe und Deckkraft 0,18 gruppierte das Auge weiter nach Farbe, und die Auswahl war schwer zu unterscheiden (User, 8. Oktober 2026). Streukreis, Ellipse, Schwerpunkt und der Ausschnitt „Gruppe“ rechnen über die Auswahl, die Nummern bleiben die der ganzen Scheibe (Wunsch des Users, 8. Oktober 2026).
- **Eine andere Scheibe** steht sofort in ihrem Ausschnitt; nur ein neuer Ausschnitt derselben Scheibe gleitet (340 ms, bei „Bewegung reduzieren“ ein Sprung). Das gilt auch für eine andere Karte auf derselben Scheibe (Schlüssel der Karte, etwa die Session).
- **Hohle Treffer** (Probe, Wertung ohne Wert) sind wie alle über ihre Mitte antippbar, nicht nur am Rand; der Mauszeiger zeigt auch in ihnen die Hand (User, 8. Oktober 2026).
- **Kacheln folgen der Auswahl** wie Streukreis und Schwerpunkt: Sie rechnen über die Schüsse der Auswahl, auch die ohne Lage (jede Kennzahl wählt selbst, was sie braucht), und der Kopf nennt die Auswahl („Serie 2“). Die **Übersicht** (Ergebnis, Zehner, Innenzehner, bester Teiler) bleibt die der ganzen Scheibe, weil sie deren Ergebnis zeigt.
- **Schusstabelle:** neuester Schuss oben, nur die Schüsse der Auswahl; Nummer, Wert mit Farbpunkt (Probe hohl), Innenzehner, Teiler und der Abstand zum vorigen Schuss der Karte (nach einer Lücke in der Abgabefolge keiner, über drei Minuten als Pause in Minuten). Jede Zeile wählt ihren Schuss wie das Antippen; der Knopf in der ersten Zelle ist der Weg per Tastatur und Screenreader, denn die Treffer auf der Scheibe sind nur zum Antippen.
- **Wertung:** Der Wertungsschalter zeigt die amtliche Wertung als Hinweis daneben.
- **Kein „Visier verstellt“** (User, 8. Oktober 2026): Eine Angabe, nach welchem Probeschuss das Visier verstellt wurde, ist zu viel Komplexität für ihren Nutzen. Spiegel fragt sie weder ab noch schlägt sie vor; die Probe wird nicht gestrichelt. „Probe gegen Wertung“ nimmt die ganze Probe vor der Wertung, „Eingeschossen?“ und der Versatz Probe → Wertung ihre letzten fünf Schüsse mit Lage (SF-63).
- Die Spielwiese zeigte diese Regeln zuerst; seit Oktober 2026 sind Scheibe, Serien, Kacheln, Ablesung, Übersicht, Schusstabelle, Wertung und Hilfe echte Bausteine in `packages/shot-ui` mit den Design-2-Tokens ([[adr-030]]), zu sehen und zu prüfen im Labor (`tools/labor`, Artifact „Spiegel-Labor“). SP-1.8 setzt dieselben Bausteine mit echten Daten ein.

## Sonderfälle in der Oberfläche

Aus dem Sonderfall-Katalog ([[spiegel-edge-cases]]):

- **Nur Probe ist Training** (User, 8. Oktober 2026): Eine Scheibe ohne Wertungsschuss verhält sich genau wie Wertung, auch optisch: Schüsse 1…n gefüllt, Serien zu zehn als kleine Scheiben mit Ergebnis, Trenner in der Tabelle. Die Unterscheidung brächte hier nichts. Erst wenn nach der Probe Wertung folgt, zeigt Spiegel die Probe hohl und als P1…Pn. Umgesetzt als eine reine Funktion an der Datengrenze (`probeOnlyAsMatch`).
- **Probe beliebig lang:** gegliedert in Zehnerblöcke P1…Pn. Der Prototyp nimmt fünf Probeschüsse vor der Wertung an; das ist ein Beispiel, kein Modell (SF-02).
- **Merkmale als ruhige Hinweise** an der Scheibe (unvollständig, korrigiert, nur PDF, neu gewertet), Erklärung auf Antippen.
- **Aktionen an der Scheibe:** „Als Wertung zählen“ für eine vergessene Umschaltung (SF-05), „Disziplin korrigieren“, „Nicht meine“, „Aus Verläufen ausnehmen“, „An Schuss n teilen“.
- **Liste nach Trainingsabend:** kleine Scheiben (Aufwärmen, Abbruch) eingeklappt unter dem Abend (SF-11).
- **Wiedergabe mit Tempo-Wahl,** damit 100 Schuss nicht minutenlang dauern.
- **Leere Werte:** Eine Kennzahl ohne Wert zeigt „–“ mit Grund („zu wenige Schüsse“), nie 0.

## Farben und Schrift (aus dem Prototyp)

- **Ringwert-Skala:** 10 rot `#e5484d`, 9 gold `#e9b10c`, 8 türkis `#1fa3c8`, ≤ 7 violett `#7c5cd6`. Mit dem Dataviz-Validator geprüft: alle Paare auch bei Farbenblindheit unterscheidbar (CVD ΔE ≥ 13). Jeder Treffer hat einen dunklen 1-px-Rand (siehe „Zeichnen der Scheibe“). Offen ist, ob stattdessen das Meyton-Schema der Treffsicher-Statistik gelten soll ([[spiegel-open-questions]]).
- **Vergleichsfarben:** A blau, B orange (geprüft).
- **Schrift:** Archivo (breit, für Zahlen und Überschriften), Geist (Text, wie heute), Geist Mono (Tabellen, Achsen).
- Kein Tortendiagramm für die Ringverteilung, sondern ein Histogramm; Zeitachsen von links nach rechts.

## Verhältnis zu `@vereinsheim/ui`

Design 2 kommt als zusätzliche Schicht ins Paket (Tokens und Bausteine); Ringwerk und Treffsicher bleiben vorerst unverändert. Spiegel nimmt vorerst nicht am Drift-Gate teil. Das ist eine bewusste Ausnahme von [[conventions]] (byte-identische Schicht, fest dunkel) und in [[adr-030]] entschieden. Der Komponenten-Kanon ([[component-canon]]) gilt weiter: PageHeader, EmptyState, ConfirmDialog, Toasts.
