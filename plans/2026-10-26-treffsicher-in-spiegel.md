# Treffsicher geht in Spiegel auf: Koordination

Koordinationsplan für den Weg in vier Stufen aus [[adr-033]] (SP-4.1). Dieser Plan setzt selbst keinen Code um. Er hält
fest, in welche Teilpläne die Stufen zerfallen, in welcher Reihenfolge sie laufen, was parallel gehen darf und wie die
Kindsessions arbeiten. Jeder Teilplan entsteht einzeln über `/plan` als eigene Datei unter `plans/` und wird vor der
Umsetzung freigegeben.

## Kontext

ADR-033 legt fest: eine App mit zwei streng getrennten Teilen (Ergebnisse in Spiegel, Tagebuch), ein Login, eine
Statistik; Treffsicher endet, Konten und Daten ziehen verlustfrei um. Der Weg hat vier Stufen, jede mit eigenem Plan.
SP-4.3 (Design 2 für alle Apps) ist umgesetzt, damit kann Stufe 1 beginnen.

Die Dev-Datenbank ist eine Kopie von Prod (Stand 26. Oktober 2026). Sie trägt die echten Konten beider Apps und ist
damit die Grundlage für den Abgleich der Konten und für den Prüfbestand der Übernahme.

## Branches

Entschieden mit dem User am 26. Oktober 2026:

- **Stufe 1 geht Teil für Teil nach `main`** und in Prod, sobald ein Teil fertig ist, jeweils mit OK des Users
  (ff-only). Sie berührt Treffsicher nicht und ist für sich nützlich (ADR-033); kleine Deploys sind sicherer als ein
  großes, und Spiegels Dateien laufen auf einem langen Branch gegen die Fixes auf `main` auseinander. Kindbranches von
  Stufe 1 zweigen von `main` ab.
- **Der Basisbranch `feat/treffsicher-in-spiegel` hält Tagebuch, Übernahme und Ruhestand** (V1, Stufen 2 bis 4). Er geht
  nach `main`, wenn Stufe 2 und das Werkzeug der Übernahme fertig sind, denn die Übernahme Konto für Konto braucht
  Spiegel mit Tagebuch in Prod. Kindbranches dieser Teile zweigen vom Basisbranch ab.
- Der Haupt-Checkout steht auf dem Basisbranch. Dort arbeitet nur die koordinierende Session: Teilpläne schreiben und
  committen, Kindbranches übernehmen (Basisbranch per `git merge --ff-only`, `main` per `git fetch . <branch>:main`, da
  `main` nirgends ausgecheckt ist), den Basisbranch per `git rebase main` nachziehen (keine Merge-Commits).
- Jeder Teilplan läuft in einer Kindsession auf einem eigenen Branch `feat/tis-<teil>` in einem eigenen Worktree. Die
  Teilpläne schreibt die koordinierende Session auf den Basisbranch; eine Kindsession von Stufe 1 übernimmt ihren Plan
  als ersten Commit (`git show feat/treffsicher-in-spiegel:plans/<plan>.md`).

## Regeln für Kindsessions

1. **Keine weiteren Sessions.** Eine Kindsession startet keine eigenen Sessions. Sub-Agents innerhalb der Session
   (etwa `code-reviewer` über `/review`) sind erlaubt.
2. **Ein Teilplan je Kindsession.** Sie arbeitet ihren freigegebenen Plan mit `/implement` ab, dann `/validate` und
   `/review`. Sie plant nicht neu: Weicht etwas vom Plan ab, meldet sie es an die koordinierende Session.
3. **Rückmeldung nur an die koordinierende Session**, nicht an den User. Fragen, Circuit-Breaker (etwa geschützte Pfade
   wie Schema und Migrationen, ADR-023) und der Abschluss gehen per Nachricht an die koordinierende Session, die mit
   dem User spricht und die Antwort weitergibt.
4. **Abschluss:** Vault-Notes und Lessons zuerst (der Stop-Hook verlangt sie nach Code-Commits), dann Branch auf seine
   Basis rebasen (`main` oder Basisbranch, siehe „Branches“), Gate grün im Worktree (`pnpm check`; der Stop-Hook prüft
   den Haupt-Checkout), dann melden: Branch, Commits, Bericht aus `reports/`, was nicht belegt ist, ob eine neue Brücke
   nötig ist. Kein Merge, kein Push, kein Deploy.
5. **Aufräumen nach der Übernahme:** Erst wenn die koordinierende Session meldet, dass der Branch in seiner Basis ist,
   löscht die Kindsession ihren Branch und Worktree und archiviert sich.
6. **Dev-Datenbank:** Sie ist eine Prod-Kopie und wird nie zurückgesetzt (`db-reset` und `migrate reset` sind tabu).
   Zur selben Zeit ändert höchstens eine Kindsession das Schema einer App. Eine Kindsession mit Dev-Server oder
   Skriptprüfung meldet ihren Port; zwei laufen nie auf demselben.
7. **Personendaten** (Namen, E-Mails, Sportpassnummern) nur in `reports/` (gitignored) oder im Chat, nie in Code, Tests,
   Doku oder Commits (ADR-029).

## Grundsätze

Entschieden mit dem User am 26. Oktober 2026, gelten für alle Teile:

- **Entfernen entfernt nur das, was man entfernt.** Einen Auftrag zu entfernen, nimmt nie Scheibe oder PDF mit; eine
  Scheibe zu löschen, lässt einen Tagebucheintrag stehen (ADR-033).
- **Keine Detailtiefe ist garantiert.** Eine Scheibe kann nur den Ausdruck haben, nur das Gesamtergebnis, Serien-Summen,
  Treffer in ganzen Ringen oder mit Zehnteln, Lage je Schuss oder nur als Summe, Zeit je Schuss. Jede Ansicht und jede
  Zahl kommt mit jeder Kombination zurecht und zeigt ihre Grundlage.
- **Immer das Maximum an Daten speichern.** Zehntel werden nie abgeschnitten, auch nicht bei Disziplinen in ganzen
  Ringen: gespeichert wird, was die Quelle hergibt, gewertet wird in der Ansicht (Ring und Zehntel getrennt, wie
  `Shot.ring` und `Shot.decimalTenths` heute). Eingaben von Hand und der Parser (1c) nehmen Zehntel, wo es sie gibt. Nur
  die Übernahme aus Treffsicher bringt bei Disziplinen in ganzen Ringen nur ganze Ringe, weil Treffsicher die Zehntel
  beim Import abgeschnitten hat.
- **Konsistenz, wo immer sie möglich und sinnvoll ist** (User, 27. Oktober 2026): Gleiches sieht gleich aus und steht an
  derselben Stelle, unabhängig von Herkunft oder Detailtiefe. Ein Zustand unterscheidet sich im Inhalt (Wert oder „–“
  mit Grund), nicht im Aufbau der Seite. Abweichen nur mit Grund, der im Plan steht.
- **An dem orientieren, was es schon gibt.** Bedienung und Modell knüpfen an Spiegel und Treffsicher an (etwa: erst
  Disziplin und Art wählen wie in Treffsicher), statt Neues zu erfinden.

## Teile

### V · Vorab

- **V1 Abgleich der Konten** (lesend, kein Schema, kann sofort laufen): ein Skript, das die Konten von Treffsicher und
  Spiegel über die E-Mail abgleicht (ohne Groß- und Kleinschreibung, ohne Leerzeichen am Rand), und ein Bericht nur in
  `reports/`:
  - Konten nur in Treffsicher: Für sie fehlt ein Konto in Spiegel. Mit Hinweis, ob sie Einheiten haben und wann die
    letzte war, und ob sie aktiv sind.
  - Verdacht auf eine abweichende E-Mail: Konten ohne Treffer über die E-Mail, die über andere Merkmale zusammenpassen
    könnten (gleicher oder ähnlicher Name, gleicher Teil vor dem `@`, Tippfehler in der Domain).
  - Konten in beiden: Spiegel behält sein Konto (ADR-033), mit Hinweis, wenn Rolle oder Aktiv-Status abweichen.
  - Dazu die Zählungen, die ADR-033 vor Stufe 3 verlangt, soweit sie ohne das neue Modell gehen: Konten, Einheiten,
    Favoriten.

  Das Skript liegt im Repo (ohne Daten) und läuft vor der Übernahme noch einmal gegen Prod, durch den User. Dazu
  schreibt es einen Vorschlag für die Zuordnung (Treffsicher-E-Mail → Spiegel-E-Mail), den der User prüft und der später
  die Aufrufe der Übernahme Konto für Konto speist (Stufe 3).

### Stufe 1 · Spiegel lernt vereinfachte Scheiben

Vorgeschlagener Schnitt, endgültig im jeweiligen `/plan`:

- **1a Angaben-Modell:** Herkunft und Angaben an der Scheibe in allen Detailtiefen (siehe Grundsätze; „nur der
  Ausdruck“ und „nur das Gesamtergebnis“ ergänzen die Tabelle in ADR-033), Serien-Summen ohne Schüsse, eingetragene
  Disziplinen ohne Meyton-ID mit Familie, fremde Orte als `Site` ohne Brücke, Projektion und `needs`/`onMissing` für die
  neuen Angaben, wie Liste, Seite der Scheibe und Fortschritt jede Detailtiefe zeigen. Schema, interaktiv. Der Plan
  entsteht gemeinsam mit dem User. Entschieden für 1a (26. Oktober 2026):
  - **Disziplinen aus derselben Liste:** Eine Scheibe von Hand, von einer fremden Anlage oder aus Treffsicher nimmt eine
    Disziplin aus Admin → Disziplinen (eingeordnet, nicht ignoriert), wie Scheiben der Brücke. Fehlt eine, legt der
    Admin sie an, auch ohne Meyton-ID (`Discipline.meytonId` wird optional). Keine Disziplinen je Schütze; die
    „eingetragenen Disziplinen“ aus ADR-033 entfallen. Der Ort ist eine eigene Angabe der Scheibe.
  - **Ort als Freitext** an der Scheibe, mit Vorschlägen aus den eigenen bisherigen Orten; keine Liste der Orte, kein
    `Site` für fremde Orte. Scheiben der Brücke tragen den Ort über ihre Anlage. Daheim ist die eigene Anlage, alles
    andere auswärts.
  - **Schusszahl bei Summen:** Ohne Einzelschüsse gilt jede Serie als ganze Serie (Serienlänge der Disziplin), ein
    Gesamtergebnis ohne Serien als volle Schusszahl der Disziplin, außer der Schütze gibt etwas anderes an. Die Zahl
    wird gespeichert, damit Ø je Schuss und Zeiträume (ADR-034) nicht neu raten. Vollständig ist eine Scheibe, wenn
    ihre Schusszahl der Disziplin entspricht; eine unvollständige zählt im Ø je Schuss, nicht bei Rekorden des
    Gesamtergebnisses.
  - **Trefferlage als Summe zählt nur für die Lage:** Sie ist die Mitte der Schüsse und geht gewichtet mit der
    Schusszahl in Versatz und Richtung über Zeiträume ein, zusammen mit den Scheiben mit Lage je Schuss. Für die
    Streuung (Streukreis, R50, σ, engste Gruppe) zählt sie nicht; die Grundlage nennt solche Scheiben. Ein Urteil
    („versetzt“) braucht die Streuung einzelner Schüsse; aus Summen allein sagt Spiegel die Lage ohne Urteil. Auf der
    Seite der Scheibe steht die Mitte als Schwerpunkt (`MpiMark`, der geviertelte Kreis) mit „nur Trefferlage vom Ausdruck“.
  - **Wörter der Herkunft** (leise im Kopf der Scheibe, Filter in der Liste statt „Nur PDF“): „gemessen“ (Brücke),
    „vom Ausdruck“ (Scan, Upload), „eingetragen“ (von Hand und aus Treffsicher). Gespeichert bleibt die Herkunft
    „Treffsicher“ getrennt, damit die Übernahme sich wiederholen und Dubletten finden kann; sichtbar und änderbar ist so
    eine Scheibe wie eine eingetragene. Fehlende Angaben zeigt die Seite als „–“ mit Grund: „wartet auf die Anlage“
    (noch ohne Werte, zählt in keiner Zahl), „nur Serien-Summen“, „nur Gesamtergebnis“, „ohne Zehntel“.
  - **Treffsicher-Einheiten ohne Werte** (weder Summe noch Schuss) werden keine Scheibe, nur ein Tagebucheintrag
    (Stufe 2 und 3).
  - **Schnitt:** 1a-1 „Modell und Fachkern“ (Schema, Projektion aus dem, was da ist; interaktiv), dann 1a-2
    „Ansichten“ (Liste, Start, Seite der Scheibe, Fortschritt, Vergleichen mit „–“ und Grund und der Grundlage in jeder
    Zahlengruppe; **1e geht darin auf**), dazu erfundene Demo-Scheiben in jeder Detailtiefe für `seed:own --demo` und
    die Skriptprüfung. 1a-1 läuft parallel zu 1b-1.
  - **Ansichten (1a-2), nach Skizzen mit dem User am 27. Oktober 2026:** Seite einer Scheibe je Detailtiefe (nur
    Serien-Summen: große Zahl, Ø je Schuss, Schusszahl und Grund, Serien als Kacheln ohne kleine Scheiben, die Analyse
    sagt in einem Satz, was fehlt; nur Gesamtergebnis: große Zahl mit Grund, Trefferlage als Schwerpunkt (`MpiMark`) auf der
    Scheibe mit „nur die Mitte der Schüsse, keine Streuung“; wartet auf die Anlage: „–“ mit Grund, Platz für PDF und ID
    vom Ausdruck). Herkunft und Ort leise im Kopf. In der Liste die Herkunft nur bei „eingetragen“ und „vom Ausdruck“,
    nie „gemessen“; „–“ immer mit Grund. Im Fortschritt und auf Start die Grundlage nur, wenn nicht alle Scheiben
    zählen („über 12 von 20 Scheiben · 6 ohne Lage je Schuss“); der Versatz nennt Scheiben nur mit Trefferlage.
    Nach der Durchsicht im Browser (27. Oktober 2026): Wo eine kleine Scheibe steht (Liste, Start, Fortschritt,
    Vergleichen, Serien auf der Seite), steht für eine Scheibe oder Serie ohne Lagen ein leiser Platzhalter, die Scheibe
    der Disziplin ohne Schüsse; auch Serien aus Summen bekommen ihn. Die Trefferlage als Summe zeigt das vorhandene
    Zeichen der Mitte (`MpiMark`), nur auf der großen Scheibe der Seite; die Platzhalter in den Übersichten tragen
    keine Mitte, wie die kleinen Scheiben gemessener Scheiben.
- **1b QR-Weg (SP-1.7 b):** Scannen (Kamera, Link), PDF von erlaubten Adressen in einem kurzlebigen Kindprozess,
  PDF-Volume samt Backup, Auftrag an die Brücke. Berührt Deploy-Vertrag und `scripts/`, interaktiv.
  1b liefert „PDF hängt an, die Brücke holt die Scheibe“; ein Ergebnis aus dem PDF bringt erst 1c.
  **Ohne Vorschau und ohne Bestätigung** (entschieden mit dem User am 26. Oktober 2026): Spiegel ist Tagebuch und
  Statistik der eigenen Entwicklung, an einer Zuordnung hängt nichts weiter, und wer den Ausdruck hat, kennt dessen
  Werte ohnehin. Der Scan legt einen Auftrag an wie „Scheibe per ID“ (ID und Abend aus dem PDF); die gelieferte Scheibe
  gehört sofort dem Scanner. Ist sie doch nicht die eigene, löscht man sie (Löschen mit Sperre gibt es). Gegen
  Zufallstreffer (eine ID, die zu einer anderen Scheibe am selben Abend passt) prüft Spiegel automatisch und ohne
  Oberfläche, bevor die Scheibe gespeichert wird: am selben Abend, erster Schuss vor der Druckzeit; mit 1c zusätzlich
  Schuss für Schuss gegen das PDF. Fällt eine Prüfung durch, speichert Spiegel nichts von der Brücke, der Auftrag endet
  mit „passt nicht zum Ausdruck“. Wie heute bleibt: Eine Scheibe, deren Sportpass zu einem Konto mit Zustimmung gehört,
  geht nicht an den Scanner. Damit entfallen Vorschau (SF-41), Bestätigung in „Offen“, eine Änderung am Vertrag und
  eine neue Brücke. Der Plan von 1b trägt das als Nachtrag in ADR-028 ein (Vorschau und Bestätigung ersetzt durch die
  automatischen Prüfungen, Rückweg ist Löschen).
  Weiter entschieden mit dem User am 26. Oktober 2026:
  - **Keine Liste erlaubter Adressen** beim Holen des PDFs, vorerst. Es bleiben Größengrenze, Zeitgrenze und „nur
    PDF“ (Kopf `%PDF-`). Restrisiko: Ein Link kann Spiegel Adressen im eigenen Netz abrufen lassen (SF-47 bleibt
    offen); auch das kommt als Abweichung in den Nachtrag zu ADR-028.
  - **Upload eines einzelnen PDFs** als Alternative zum Scan, wie in Treffsicher heute, etwa für alte Ausdrucke.
  - **Die Brücke im Schützenhaus kann Aufträge** („Scheibe per ID“ läuft); 1b braucht keine neue Brücke.
  - **Schnitt:** 1b-1 „Ausdruck holen und speichern“ (PDF holen, Kindprozess, Volume samt Backup und Restore,
    Aufräumen der Dateien; ohne Oberfläche, **ohne Schema**, interaktiv wegen `compose.yml` und `scripts/`; läuft
    parallel zu 1a). 1b-2 „Scannen“ **nach 1a**: `/scan` mit Kamera, Link und Upload, „Scannen“ in der Navigation;
    liegt die Scheibe des Abends schon in Spiegel, hängt der Scan nur das PDF an (SF-43), sonst legt er eine Scheibe
    an, deren einzige Angabe der Ausdruck ist, mit Disziplin und Art aus der Wahl des Schützen (vorbelegt mit der
    letzten, vorläufig bis die Brücke liefert, zur Auswahl die eingeordneten Disziplinen der eigenen Anlage); an ihr
    hängt der Auftrag an die Brücke; beim Einlesen die Prüfung der Druckzeit und der Ausgang „passt nicht zum
    Ausdruck“; Original-PDF und ID auf der Seite der Scheibe; eigene Sperre durch Scan aufheben.
  - **Verschoben:** „Teilen → Spiegel“ unter Android (SP-2.5), Auswahl nach Druckzeit ohne lesbare ID, Warnung bei
    stummer Brücke (SF-56).
  - **Vor 1b-2 live geht:** den Speicher des Lesers im echten Image auf dem VPS messen (amd64; auf dem Mac nur arm64
    nativ, 74 MiB mit `--lite-mode`, oder unter Rosetta verfälscht). Der User führt den Einzeiler aus der Doku von 1b-1
    nach dem Deploy aus. Liegt `maxRssKb` über 80 MiB, Grenze oder Speicher von Spiegel vor 1b-2 anpassen.
  - **Eine Seite „Scheibe holen“** (entschieden mit dem User am 27. Oktober 2026, Konsistenz): Kamera, Link, PDF
    hochladen und ID eintippen auf einer Seite (`/scan`), jeder Weg gleich: Liegt die Scheibe des Abends schon in
    Spiegel, öffnet Spiegel sie (ein PDF hängt nur an); sonst Disziplin und Art wählen (vorbelegt mit der letzten),
    die Scheibe entsteht sofort („wartet auf die Anlage“) und öffnet sich. Was mit dem Auftrag passiert, steht an der
    Scheibe („wartet auf die Anlage“, „nicht gefunden“, „passt nicht zum Ausdruck“); „Scheibe per ID holen“ und die
    Liste der Aufträge im Profil entfallen. Bei getippter ID ohne PDF prüft Spiegel nur den Abend. Ein Tippfehler
    ergibt eine Scheibe ohne Werte, die man löscht.
    Der Eintrag in der Mitte der Navigation heißt „Scheibe holen“, kurz „Holen“, mit dem QR-Symbol (User, 27. Oktober
    2026).
  - **Aus 1b-1 für 1b-2:** Die Sperre des Aufräumens bei leerer Tabelle hängt an `printout.count()`, dadurch bleibt die
    letzte verwaiste Datei liegen; an „keine Scheibe“ knüpfen. `printoutFile` liefert auch für eine Scheibe im
    Papierkorb; mit der Seite der Scheibe entscheiden. Next kopiert `src/lib/printouts/` samt Tests ins
    Standalone-Image (harmlos, Lesson in 1b-1).
    **ID vom Ausdruck an der Scheibe** (Wunsch des Users, 26. Oktober 2026): Die Seite einer Scheibe zeigt leise die ID,
    wie sie im Fuß des Ausdrucks steht (acht Hex-Zeichen, `printedId`), damit der Schütze Papier und Scheibe zuordnen
    kann. Bei Scheiben der Brücke steht sie schon in `Card.scheibenId`, gezeigt wird sie heute nur bei den Aufträgen im
    Profil. Nicht auf der geteilten Seite (`/share`), denn ID und Abend sind der Schlüssel für „Scheibe per ID“. Eine
    von Hand eingetragene Scheibe hat keine ID, die Zeile fehlt dann. Die ID eines Ausdrucks von einer fremden Anlage
    (1c) gehört zu deren Nummernkreis: Das Modell (1a) speichert sie so, dass sie nie mit einer ID der eigenen Anlage
    gleichgesetzt wird.
- **1c Ergebnis sofort aus dem PDF (SP-2.6), für jede Anlage:** vollständiger Parser in `packages/meyton-pdf`. Jeder
  gescannte Ausdruck ergibt sofort eine Scheibe aus dem PDF, sobald der Parser ihn lesen kann, ob von der eigenen oder
  einer fremden Anlage. Liefert die Brücke die Scheibe, kommen die Rohdaten als neue Revision derselben Scheibe dazu
  (ADR-031); „nicht gefunden“ heißt nur, dass die Scheibe beim Ergebnis aus dem PDF bleibt. Braucht 1a und 1b.
  Entschieden mit dem User am 26. Oktober 2026:
  - **Keine Erkennung fremder Anlagen.** Spiegel fragt für jeden Ausdruck die eigene Brücke; bei einem fremden endet
    der Auftrag mit „nicht gefunden“, das kostet nichts.
  - **Zwei automatische Prüfungen, bevor die Rohdaten die Scheibe ergänzen:** immer die Druckzeit aus 1b (selber
    Abend, erster Schuss vor dem Druck), die nur ID und Erstellzeit braucht und so unabhängig vom Layout bleibt
    (ADR-028); und, wenn der Parser das PDF lesen konnte, Schuss für Schuss (Ring und, wenn vorhanden, Zehntel) gegen
    die ersten Schüsse der Scheibe der Brücke. Ein Zwischenausdruck (SF-42) hat weniger Schüsse und passt trotzdem.
    Passt etwas nicht, speichert Spiegel von der Scheibe der Brücke nichts und die Scheibe bleibt beim Ergebnis aus dem
    PDF.
  - **Dubletten:** Liefert die Brücke dieselbe Scheibe ohnehin (Zustimmung per Sportpass), landet der Scan an ihr,
    abgeglichen über ID und Abend, wie bei „Scheibe per ID“.
  - **Was der Ausdruck außerdem hergibt** (entschieden mit dem User am 27. Oktober 2026, am Beispiel eines eigenen
    Ausdrucks): Wert je Schuss mit Zehnteln und Innenzehner (`*`), Zähler, Innenzehner, beste drei Teiler mit
    Schussnummer (gesamt und je Serie), die drei weitesten Teiler, Trefferlage und Trefferkreis (gesamt und je Serie)
    und das Trefferbild mit jeder Schussnummer an ihrer Stelle. Genutzt nur für Scheiben ohne Brücke; gemessene haben
    alles in den Rohdaten. Reihenfolge in 1c:
    1. **Gegenprobe zuerst** (nur lesend, lokal, an den eigenen Ausdrucken mit gemessener Scheibe dazu): Rechnet Meyton
       den Trefferkreis wie `group.enclosingDiameter`? Stimmt die Trefferlage mit der Mitte der Schüsse? Stimmen die
       Teiler? Wie weit liegen die gezeichneten Schussnummern von der gemessenen Lage? Ergebnis nur als Zahlen.
    2. **Parser und Modell:** Werte je Schuss mit Zehnteln und Innenzehnern; die genannten Teiler am jeweiligen Schuss
       (kein Mittel über diese Teilmenge, heute braucht nur „bester Teiler“ den Teiler); Trefferlage je Serie und
       Trefferkreis gesamt und je Serie als kleine Erweiterung des Modells aus 1a-1; der Trefferkreis zählt, wenn die
       Gegenprobe es trägt, beim Streukreis, nie bei R50, σ oder einem Urteil.
       **Fehlertoleranz** (entschieden mit dem User am 27. Oktober 2026): Die Zuordnung hängt nie vom Layout ab (ADR-028),
       die Werte sind ein Versuch. (a) Nie raten: Jedes Feld steht da oder fehlt; ein Schuss als Kreuz am Rand (außerhalb
       des gezeichneten Bereichs) hat keine Lage. (b) Selbstprüfung jedes Ausdrucks: gelesene Schüsse gegen Zähler,
       Innenzehner, Serien- und Gesamtsumme; bei Widerspruch übernimmt Spiegel keine Werte, die Scheibe bleibt „nur
       Ausdruck“. (c) Das PDF bleibt gespeichert, der Leser hat eine Version; ein neuer Leser liest gespeicherte Ausdrucke
       neu (wie das Nachrechnen der Projektion). (d) Layouts erkennen (Metadaten wie Producer/Creator, erkannte Zeilen); ein
       unbekanntes liest der Parser vorsichtig und meldet es dem Admin nur als Zustand. (e) Testdaten aus den eigenen
       Ausdrucken des Users über die Zeit (ohne Namen, Nummer, ID), damit eine Änderung bei Meyton einen Test fallen lässt.
       Mitgemessen in 1c-0: „initialisiert“ als Beginn der Wertung, Standnummer, Disziplin im Kopf (Vorbelegung im Blatt
       „Neue Scheibe“), Teiler jedes Schusses aus den Kreisen, Häufigkeit der Kreuze, Zahl der Layouts, Quote der
       Selbstprüfung.
    3. **1c-2 Lagen aus dem Trefferbild**, eigener Teil, nur wenn die Gegenprobe zeigt, dass die gezeichneten Lagen genau
       genug sind (95 % unter 0,5 mm); dann als eigene Angabe „vom Ausdruck“, nie gleichgesetzt mit gemessener Lage. Sonst
       das Trefferbild nur zur Anzeige auf der Seite der Scheibe, ohne in eine Zahl einzugehen (wie „geschätzt“, ADR-033).
- **1d Handeingabe (SP-4.4):** „Ergebnis eintragen“ je Serie und je Schuss, Trefferlage als Summe, Beleg an der Scheibe,
  eigene Einträge ändern und löschen. Braucht 1a, für den Beleg den Datei-Speicher aus 1b.
  Entschieden mit dem User am 28. Oktober 2026:
  - **Einstieg in „Scheibe holen“** als weiterer Weg „Von Hand eintragen“, zuerst das Blatt „Disziplin und Art“ wie
    bei den anderen Wegen.
  - **Eingabe wie in Treffsicher:** je Serie eine Summe, je Serie aufklappbar „Schüsse einzeln“; ohne Serien nur das
    Gesamtergebnis; Zehntel oder ganze Ringe, wie vorhanden; Trefferlage optional als Summe (Betrag in mm und Richtung).
  - **Ein Beleg je Scheibe**, Foto oder PDF, optional, im Kasten „Diese Scheibe“; Fotos verkleinert der Browser unter
    die Grenze von 5 MiB je Anfrage.
  - **Ändern:** Eingetragene Scheiben ganz (Werte, Datum, Ort, Beleg, Löschen), jede Änderung als neue Revision.
    Scheiben vom Ausdruck oder der Anlage: Werte nicht, nur Disziplin, Art und Ort wie heute.
  - **Admin → Disziplinen:** neue Disziplin ohne Meyton-ID anlegen (Name, Familie, Scheibenbild, Schusszahl, Serienlänge,
    Wertung).
- **1e Grundlage sichtbar:** geht in 1a-2 auf (entschieden mit dem User am 26. Oktober 2026).
- **1f Mehrere Belege je Scheibe:** `CardEvidence` trägt statt eines Belegs eine Liste, mit Originalnamen. Ein eigener
  Teil nach `main`, weil er den Ergebnisteil betrifft und auch ohne Tagebuch nützt (Fotos von Ergebnislisten
  auswärts). Grundlage für Stufe 3: Jeder Anhang aus Treffsicher wird Ausdruck oder Beleg seiner Scheibe (entschieden
  mit dem User am 28. Oktober 2026, aus dem Konzept 2b). Erst ein Designkonzept, dann Plan und Bau.
  **Designkonzept 1f, Runde 1** (https://claude.ai/artifact/5AKqZGGpnJKA1hH3UThdVY), vom User mit allen Empfehlungen
  freigegeben (29. Oktober 2026). Grundlage: 69 Anhänge an 56 Einheiten in 4 Konten (20 Fotos, fast alle Ergebnislisten
  von Wettkämpfen; 49 PDFs, 25 davon `print_…`), keiner beschriftet; 69 von 94 Einheiten des größten Kontos haben schon
  eine Scheibe in Spiegel.
  - **Belege an jeder eigenen Scheibe**, auch gemessen und vom Ausdruck (statt nur an eingetragenen, Entscheidung 1d).
  - **Bis zu 10 je Scheibe**, je höchstens 4 MiB, mehrere Dateien in einem Zug; „Ersetzen“ fällt weg.
  - **Zeile „Belege“** im Kasten „Diese Scheibe“, leer wie gefüllt an derselben Stelle: Vorschaubild, Originalname,
    Größe, Tag; ein Tipp öffnet die Datei im Browser, × entfernt nach Rückfrage (nennt die Datei, die übrigen bleiben).
    Keine Beschriftung, kein Umbenennen, kein Zeichen in Liste und Start, kein eigener Bildbetrachter.
  - **Ein Meyton-Ausdruck bleibt kein Beleg**, je Datei mit Hinweis auf „Scheibe holen“; Stufe 3 hängt Meyton-PDFs aus
    Treffsicher als Ausdruck an.
  - **Nie auf der geteilten Seite**; im Export mit Art, Größe, Tag und neu dem Namen.

Reihenfolge: 1b-1 und 1a-1 parallel (1b-1 ändert kein Schema), dann 1a-2; danach 1b-2, 1d und 1c in einer Reihenfolge,
die wir nach 1a festlegen. Jeder Teil geht einzeln nach `main` und in Prod.

### Stufe 2 · Das Tagebuch

Eigener Teil mit eigenem Datenmodell, neu entworfen (Einträge, Befinden, Prognose und Feedback, Reflexion, Ausführung je
Serie, Anhänge, Saisonziele, Schuss-Abläufe, Einflüsse, Selbstbild, Schalter im Profil, Gate gegen Importe zwischen den
Teilen). Der Entwurf der Oberfläche mit dem User kann beginnen, während Stufe 1 umgesetzt wird; die Teilpläne folgen,
wenn das Modell aus 1a steht.

Entschieden mit dem User am 28. Oktober 2026:

- **Drei Teilpläne:** 2a Einträge (Modell, Schalter im Profil, Bereich, Liste, Seite eines Eintrags, Hinweis beim
  ersten Öffnen, Export und Löschen, Gate), 2b Saisonziele, Schuss-Abläufe und Anhänge, 2c Einflüsse und Selbstbild.
  Skalen von Befinden und Prognose wie in Treffsicher, damit die Übernahme nichts verliert.
- **Navigation:** Mit Tagebuch steht es in der unteren Leiste statt Scheiben (Start, Tagebuch, Holen, Fortschritt,
  Profil); die Scheiben erreicht man über Start und am Desktop in der Seitenleiste. Ohne Tagebuch bleibt alles wie
  heute.
- **Eintrag in Abschnitten:** Die Seite eines Eintrags zeigt Vorher (Absicht, Befinden, Prognose) und Nachher
  (Feedback, Reflexion, Ausführung je Serie) als Kästen; jeder öffnet ein eigenes kurzes Formular. Kein langes
  Formular wie in Treffsicher.
- **Verweis über eine Stelle:** Die Seite einer Scheibe (Kasten „Diese Scheibe“) und Start haben eine Stelle, an die das
  Tagebuch eine Zeile zum Eintrag setzt. Der Ergebnisteil kennt nur die Stelle, nicht das Tagebuch; das Gate bleibt.
- **Erst ein Designkonzept, dann Plan und Bau** (User): je Teil ein Konzept als Artifact mit den Screens am Telefon und
  am Desktop; Bedienbarkeit, schön, professionell und nützlich zählen am meisten. Geplant wird erst nach der Freigabe.
- **Treffsicher 2.0** (User): Treffsicher war eine lange Test- und Evaluationsphase. Das Tagebuch entwickelt daraus
  sinnvoll weiter: Was genutzt wurde, wird besser; was kaum genutzt wurde, wird einfacher oder fällt weg. Grundlage ist
  die Nutzung aller Konten (Zählung und Inhalte, nur als Muster). Keine Sonderbehandlung für übernommene Daten: ein
  Modell und eine Anzeige für alle; Werte wie Befinden bleiben intern auf 0–100, die Oberfläche zeigt fünf Stufen.
- **Designkonzept 2a, Runde 3** (https://claude.ai/artifact/2m3QyyCkx7LNnchg9Nk5Te), Rückmeldung des Users: Vorhaben als
  erste Zeile, darunter die Notiz; Vorher mit dem Faden (letzte Lernfrage, „Als Vorhaben nehmen“) und Befinden; Nachher
  mit „Hat es geklappt?“, den Satzanfängen „Ich habe gelernt, dass …“ und „Wie schaffe ich es, …?“ und „Was hat
  gestört?“ (immer, eingeklappt). Der Faden der Lernfragen als Zeitstrahl wird eine eigene Ansicht, schon in 2a. Leere
  Abschnitte sind eine Zeile mit „+“, gefüllte offen; die Seite hängt nicht von der Nutzung ab.
- **Designkonzept 2b, Runde 1** (https://claude.ai/artifact/89ohQLbvhxYSyuDfJvpV35), vom User mit allen Empfehlungen
  freigegeben (28. Oktober 2026):
  - **Ziele:** Satz, Disziplin, Zeitraum, Ergebnis- oder Prozessziel. Ein Ergebnisziel kann eine Messung tragen
    (Scheibe, Serie oder Schnitt ab X Ringen; alle, Training oder Wettkampf). Spiegel zeigt die Zahlen, urteilt aber nicht:
    „Hat es geklappt?“ beantwortet der Schütze. Kein Anhaken von Einträgen, „Einträge im Zeitraum“ wird aus Disziplin und
    Zeitraum abgeleitet. Dritter Reiter „Ziele“ im Tagebuch, eine Zeile auf Start (laufende Ziele mit Messung, eins je
    Disziplin). Saison vorbelegt vom 1. September bis 31. August. Übernahme ohne geratene Messung; die
    Verknüpfungen außerhalb des Zeitraums in den Prüfbestand.
  - **Schuss-Abläufe:** oben im Faden ihrer Disziplin, eigene Leseseite je Ablauf, Bearbeiten als ein Textfeld (Absatz =
    Schritt, erste Zeile = Titel). Weicht von ADR-033 ab (eigene Seite im Tagebuch), vom User wieder aufgemacht.
  - **Anhänge:** keine im Tagebuch. Jede Datei wird Ausdruck oder Beleg ihrer Scheibe (Teil 1f). Weicht von ADR-033 ab
    („Anhänge bleiben im Tagebuch“), vom User wieder aufgemacht. Der Nachtrag zu ADR-033 kommt mit 2b.
- **Designkonzept 2c, Runde 2** (https://claude.ai/artifact/PuQTCAECDnDYxBjMLPjMUe), vom User mit allen Empfehlungen
  freigegeben (29. Oktober 2026). Grundlage: 36 Einheiten mit Befinden und Ergebnis in 4 Konten (26 in einem, in 90
  Tagen nie mehr als 9), 180 bewertete Serien an 48 Einheiten, 10 Einheiten mit Prognose und Feedback (höchstens 4 je
  Konto).
  - **Fünfter Reiter „Auswertung“** im Tagebuch, je Disziplin (Chips wie „Fragen“), Zeitraum „Alles“ (Vorgabe) oder
    eine Saison mit Einträgen. Der Fortschritt bleibt, wie er ist (ADR-033).
  - **Einflüsse gegen die Form:** Je Eintrag der Abstand seines Ø je Schuss zum Schnitt der fünf Scheiben derselben
    Disziplin davor; Einträge ohne fünf Scheiben davor zählen nicht und werden genannt. Gruppen über und unter dem
    mittleren Wert wie in Treffsicher, Urteil ab 5 je Seite (ADR-034). Nur Schlaf, Energie, Stress, Motivation, nur der
    Ø je Schuss (keine Streuung: zu viele Vergleiche für wenige Einträge). Urteile wie „Viel Energie: besser“, „Kein
    klarer Unterschied“, „Noch kein Urteil“. Ein Einfluss öffnet eine Seite mit den Einträgen nach Stufe.
  - **Selbstbild:** „Merkst du, wann eine Serie gut ist?“ (Ausführung, Serie gegen Serie desselben Abends, mit
    Urteil), „Erwartet und geschossen“ (Liste je Eintrag), „Vorher und nachher“ (Mittel je Bereich in fünf Stufen).
    Die beiden letzten ohne Urteil.
  - **Reiter in einer Zeile, die wischt** (User, gilt für alle Reiter in allen Apps): eigener Teil „Reiter“ nach
    `main`, gemeinsamer Baustein in `@vereinsheim/ui`; Auswahlen im Blatt „Filter“ brechen weiter um.
  - **Vorschau mit den Daten des Users** als Teil von 2c (User): ein Werkzeug nur für die Dev-DB nimmt die
    Treffsicher-Ergebnisse ohne Scheibe in Spiegel als Scheiben „aus Treffsicher“ mit und legt die Ausführung auf die
    Serien, alles mit `preview:` und löschbar. Mit den vorhandenen Scheiben allein hätten nur 12 von 26 Einträgen mit
    Befinden eine Scheibe. Die Prüfung ist eine Vorschau auf Stufe 3.

### Stufe 3 · Die Daten ziehen um

Übernahme mit Prüfbestand, Dubletten mit Scheiben der Brücke (Grundlage: V1). Teilpläne nach Stufe 2.

**Konto für Konto per CLI** (gewünscht vom User am 26. Oktober 2026): Die Übernahme läuft für ein Konto auf einmal,
mit Quelle und Ziel, etwa `--from <E-Mail in Treffsicher> --to <E-Mail in Spiegel>`. Damit

- ordnet der User Konten mit abweichender E-Mail selbst zu, statt dass nur die gleiche E-Mail zählt,
- lässt sich zuerst ein einzelnes Konto übernehmen und prüfen, während alle anderen weiter in Treffsicher arbeiten.

Folgen, die der Teilplan von Stufe 3 klärt:

- **Ziel fehlt:** Gibt es das Ziel-Konto in Spiegel nicht, legt die Übernahme es an, mit dem Passwort aus Treffsicher
  (ADR-033).
- **Wiederholbar je Konto:** Ein zweiter Lauf für dasselbe Konto ändert nichts oder ersetzt, was der erste übernommen
  hat. Der Prüfbestand läuft je Konto.
- **Drei Befehle** (Ergänzungen, entschieden mit dem User am 26. Oktober 2026):
  - einzeln mit `--from`/`--to`, zum Testen und für die Fälle mit `check`;
  - über die geprüfte Zuordnungsdatei aus V1 für alle Zeilen mit `ok` und `new`;
  - `status`: wer übernommen ist, wer nicht, und welche Zeilen der Datei offen sind. So geht niemand vergessen.
- **Nur geprüfte Zeilen:** Der Lauf über die Datei lehnt Zeilen mit `check` ab und bricht ab, wenn dasselbe `from`
  mehrmals mit verschiedenem `to` steht. `parseMappingCsv` aus V1 prüft nur das Format; diese Regeln gehören ins CLI.
  Zweitnamen („Erika Maria Muster“ gegen „Erika Muster“) erkennt der Abgleich aus V1 nicht.
- **Abbruch statt Zusammenführen:** Zeigen zwei Treffsicher-Konten auf dasselbe Spiegel-Konto, oder trägt das Ziel schon
  Übernommenes aus einem anderen Treffsicher-Konto, bricht der Lauf ab und sagt warum. Ein Tippfehler in der Datei
  vermischt so nie zwei Personen.
- **Kurze Zeit mit beiden Apps:** Solange übernommene und nicht übernommene Konten nebeneinander stehen, braucht
  Treffsicher die Sperre je Konto, und Mitglieder müssen wissen, welche App gilt. Der Teilplan von Stufe 4 legt vorher
  einen Zeitplan fest: erst das Konto des Users, dann alle übrigen in Tagen, nicht Monaten.
- **Nach der Übernahme ist das Konto in Treffsicher nur lesend**, mit Hinweis auf Spiegel. Sonst gingen Einträge
  verloren, die danach noch in Treffsicher entstehen. Das ist eine kleine Änderung an Treffsicher, die der Ruhestand
  ohnehin braucht.
- **Zwei Datenbanken:** Die Übernahme liest Treffsicher und schreibt Spiegel. Die Apps selbst greifen nie quer
  (ADR-002); das CLI läuft als eigener Schritt mit Zugang zu beiden, auch für die Dateien der Anhänge.
- **Ausdrucke aus Treffsicher werden gelesen** (gewünscht vom User am 27. Oktober 2026): Hängt an einer Einheit in
  Treffsicher ein Meyton-PDF (in der Prod-Kopie 49 PDFs an 48 Einheiten), übernimmt die Übernahme es als Ausdruck der
  Scheibe und liest es mit dem Leser aus 1c. Passt der Ausdruck zur Einheit (Tag, Disziplin, Summen), werden seine
  Werte und Lagen eine neue Revision über den eingetragenen Zahlen, die als frühere Revision bleiben. Passt er nicht,
  hängt er ohne Werte an und steht im Prüfbestand. Trägt Spiegel schon eine Scheibe mit derselben ID im Fuß (von der
  Brücke oder per Import), entsteht keine zweite: Die Einheit ergänzt diese Scheibe.
- **Ein später geholter Ausdruck ergänzt die übernommene Scheibe** (gewünscht vom User am 27. Oktober 2026): Holt der
  Schütze später einen Ausdruck (Scan, Link, Upload, `printout-import`), zu dem es keine Scheibe mit dieser ID gibt,
  sucht Spiegel unter den übernommenen Scheiben desselben Kontos eine, die passt (Tag, Disziplin, Gesamt- und
  Seriensummen, soweit eingetragen). Passt genau eine, hängt der Ausdruck dort an, und seine Werte werden eine neue
  Revision. Passen keine oder mehrere, rät Spiegel nicht: Es entsteht eine neue Scheibe, bei mehreren mit Hinweis. Ein
  reiner Probe-Ausdruck passt nie zu einer Einheit, die nur die Wertung trägt.
- **Aufruf** über das Ops-CLI `vereinsheim`, auf dem VPS und lokal gegen die Prod-Kopie.
- **Zeitpunkt in Prod:** Konto für Konto in Prod geht erst, wenn Spiegel mit Tagebuch deployt ist, also nach dem Merge
  des Basisbranchs (siehe „Branches“). Bis dahin wird die Übernahme nur lokal gegen die Prod-Kopie geübt.
- **ADR-033** sagt „Konten ordnen sich über die E-Mail zu“ und „Treffsicher läuft erst nur lesend“ (als Ganzes). Die
  Zuordnung je Konto und das Lesend je Konto verfeinern das; der Teilplan trägt es als Entscheidung in ADR-033 nach.

Entschieden mit dem User am 29. Oktober 2026 (Planung Stufe 3):

- **Einschießen zählt nicht, Trainings im Probe-Modus schon** (korrigiert am selben Tag): Zuerst entschieden war
  „Als Wertung zählen“ je Scheibe (SF-05), auf die falsche Annahme hin, Probe-Scheiben fehlten im Fortschritt. Sie
  zählen dort aber schon (Schalter „Scheiben nur aus Probe mitzählen“, Vorgabe ja), auch das Einschießen vor einer
  Wertung. Neu, nach dem Designkonzept 3c/3e (https://claude.ai/artifact/84tuTUTfmPcxXVXYQMSnKV), vom User mit allen
  Empfehlungen freigegeben: eine Regel für Fortschritt, Vergleichen, Start, Rekorde und (nach dem Rebase) die Auswertung
  im Tagebuch. **Einschießen ist eine Scheibe „nur Probe“ vor einer Wertung ihres Abends in ihrer Familie** und
  zählt nicht; jede andere Scheibe „nur Probe“ zählt wie ein Training (User beim Plan 3c: Probe nach einer Wertung ist
  weiteres Training, im Mittel 26 Schuss und 45 Minuten danach). Der Schalter heißt „Einschießen mitzählen“, Vorgabe
  aus; die Liste zeigt alles und nennt das Einschießen. In der Prod-Kopie 92 Scheiben „nur Probe“ in 7 Konten, 16 davon
  Einschießen. Die Übernahme legt an einem Abend mit Probe-Scheibe keine zweite Scheibe aus Treffsicher an.
- **Prüfbestand als Bericht je Konto** für den Betreiber (lokal bzw. auf dem VPS, nie im Repo), nicht in der App.
- **Schnitt in fünf Teile:**
  - **3a Übernahme eines Kontos** (Basisbranch): `--from`/`--to`, Konto anlegen, Scheiben aus Treffsicher mit
    Dubletten-Regel gegen Scheiben der Anlage und vom Ausdruck (auch gegen Scheiben „nur Probe“), Einträge mit
    Stufen und Ausführung je Serie, Ziele und Abläufe nach dem Nachtrag 2b, Anhänge als Ausdruck (gelesen, passt er,
    eine neue Revision) oder Beleg, Prüfbestand, wiederholbar, Abbruch statt Zusammenführen. Baut auf den Funktionen
    der Vorschau aus 2c auf; die Vorschau wird vorher gelöscht.
  - **3b Betrieb** (Basisbranch): Lauf über die geprüfte Zuordnungsdatei aus V1 (nur `ok` und `new`), `status`,
    `vereinsheim transfer` im Ops-CLI, Zugang zu beiden Datenbanken und den Dateien der Anhänge auf dem VPS, Probe gegen
    die Prod-Kopie, Nachtrag zu ADR-033.
  - **3c Einschießen** (nach `main`): eine Regel für Scheiben „nur Probe“, Schalter „Einschießen mitzählen“.
  - **3d Ein später geholter Ausdruck ergänzt die übernommene Scheibe** (Basisbranch).
  - **3e Treffsicher lesend je Konto** (nach `main`): Hinweis auf jeder Seite mit „Zu Spiegel“, keine Änderungen mehr
    (auch kein Passwort), der Server lehnt sie ab, PDF und Admin bleiben. Das Merkmal „umgezogen“ setzt nur die
    Übernahme in der Datenbank von Treffsicher, ein eigener Befehl hebt es auf; Treffsicher braucht dafür eine kleine
    Migration und ein Release vor dem ersten Umzug.
  - Reihenfolge: 3c und 3e nach `main`, parallel; 3a plant danach und nimmt 3e (das Merkmal) nach dem Rebase auf.

Entschieden mit dem User am 29. Oktober 2026 (Plan 3a, je mit der Empfehlung), nach einer Zählung über alle 9 Zeilen der
Zuordnung (265 Einheiten in 6 Konten: 141 neue Scheiben, 54 mit passender Scheibe, 52 an Abenden nur aus Probe,
2 unsicher, 13 ohne Ergebnis, 4 mit unbekannter Familie):

- **Unsichere Dublette: beide behalten.** Keine passende gewertete Scheibe am Abend → die Scheibe aus Treffsicher
  entsteht trotzdem, der Bericht nennt den Fall. Weicht ab von ADR-033 („Offen“ mit Folgen-Dialog); der Nachtrag kommt
  mit der Übernahme von 3a.
- **Familie unbekannt: stoppen**, Zuordnung mit `--family "<Name>=<Kennung>"`; ebenso ohne Disziplin mit der Schusszahl.
- **Neues Konto:** Rolle immer Schütze, aktiv oder deaktiviert wie in Treffsicher, Name und Passwort mit.
- **Zweiter Lauf: Geändertes bleibt** (Scheiben über die Herkunft, Tagebuch über `updatedAt` gegen `movedToSpiegelAt`).
- Kein Designkonzept: 3a hat keine neue Oberfläche, nur Ausgabe und Bericht des CLI.

Umgesetzt in 3a (30. Oktober 2026), mit dem User nach der Probe mit echten Daten entschieden; alles im Nachtrag 3a von
[[adr-033]] und in [[spiegel-account-transfer]]: nur Werte ohne Eintrag, Disziplin in Stufen (genau, größer, größte;
`--discipline` bei Gleichstand), Probe-Ausdruck übernehmen, kein Ausdruck geht still verloren, Hauptbuch der Übernahme
mit Migration (ersetzt `updatedAt` gegen `movedToSpiegelAt`). Für 3b mitnehmen:

- Zwei Ausdrucke an einer übernommenen Scheibe: Ein späteres Neulesen kann die Werte des nicht passenden nehmen.
- `kindChoice` setzt ein neuer Lauf nicht neu.
- Probe nur für das Konto des Users echt gelaufen; die übrigen Konten nur als Probelauf (alle Exit 0).

Alle drei erledigt in 3b (30. Oktober 2026, Nachtrag 3b in [[adr-033]]): Die Übung gegen die Prod-Kopie lief für alle
neun Konten der Zuordnung ohne Befund. Offen für den ersten Lauf in Prod: `--vps` gegen den echten VPS (Quoting über
`ssh`, Login-Shell), Speicher auf amd64 (gemessen nur arm64, im Container höchstens 142 MiB von 320); vorher auf dem VPS
`git pull`, Ablauf in [[operations]] „Übernahme aus Treffsicher“.

### Stufe 4 · Ruhestand von Treffsicher

Erst nur lesend mit Hinweis und Weiterleitung, dann abgeschaltet. Berührt Deploy-Vertrag, Caddy und das CLI. Mit dem
Speicher von Treffsicher (320 MB) bekommt Spiegel mehr als heute 256 MB (gewünscht vom User am 26. Oktober 2026). Teilplan
nach Stufe 3. Wie Treffsicher lesend läuft, solange der Basisbranch nicht auf `main` ist, klärt dieser Teilplan.

## Release von Stufe 1 (27. Oktober 2026)

Deployt vom User am 27. Oktober 2026, nur Spiegel (`APPS=spiegel`), `main` auf `3f91dd55`: 1b-1, 1a-1, 1a-2, ADR-035,
1b-2, 1c-0, 1c und der Fix der Hooks (Node aus `.nvmrc`). Vorher auf `main` der ganze Stack mit den echten Images grün
(`tools/stack-e2e/run.sh --bridge --ops`: Apps, Migratoren, Grenzen, Brücke, Deploy, Backup und Restore samt
Ausdrucken, Rollback; Leser im Image 73 MiB, Spiegel in der Spitze 137 MiB).

Erledigt:

- **Migrationen** `20261027120000_card_details`, `20261027180000_card_request_print_mismatch`,
  `20261027200000_printout_values` (alle additiv), neues Volume `uploads_spiegel`.
- **Echter Luftgewehr-Ausdruck** lokal gelesen (Leser v2): 60 Schüsse in 6 Serien, alle mit Wert und Lage; Ring 10 und
  Innenzehn sind dort ein Kreis. Nichts davon gespeichert.
- **Eigene Ausdrucke in Prod** importiert (User): 38 Ausdrucke.
- **Leser auf dem VPS gemessen** (amd64, gegen alle 38): alle mit Werten, 72 bis 79 MiB. Container: Spiegel 165 MiB,
  Spitze 201 MiB von 256 ([[vps-resource-sizing]], Branch `feat/vps-reader-measurement`).

Offen:

- **Speicher:** Spiegel 320 MB, Treffsicher 256 MB (Heap je 160), deployt am 27. Oktober 2026 abends.
- **Am echten Telefon:** QR-Code scannen am iPhone über HTTPS funktioniert (User, 27. Oktober 2026).
- **Rückweg auf ein älteres Image:** vorher `UPDATE "CardRequest" SET status = 'mismatch' WHERE status =
'printMismatch';` (das alte Image kennt den Wert nicht).
- **Node 26 Pflicht** (`engine-strict`): `pnpm install` und `pnpm dev` brechen unter älterem Node hart ab.

**Zweites Release am 27. Oktober 2026 abends** (alle drei Apps, `main` `bc47bbd1`): Art auch für Scheiben nur aus
Probe, Toasts über der unteren Leiste, Speichergrenzen, Holen mit Ausdruck ohne Sperre bei zehn Aufträgen (Migration
`20261027220000_card_request_window_at`, additiv; die Brücke bekommt je Konto die zehn neuesten Aufträge). Vorher auf
`main` der Stack mit Brücke grün. Läuft laut User ohne Fehler. Offen danach: den Text „Grenze der Aufträge beim
Holen“ ins Textbuch Spiegel (steht in `reports/2026-10-27-fetch-no-request-cap.md`).

**Drittes Release am 30. Oktober 2026** (alle drei Apps, `main` `fcb9aa69`, vom User): 1d und 1f zusammen, 3c, R (auch
Ringwerk), 3e (Treffsicher lesend je Konto, vor dem ersten Umzug) und das Restore über eine frische Datenbank.
Migrationen `20261028120000_hand_entry`, `20261029120000_evidence_list` (Spiegel) und
`20261029160000_user_moved_to_spiegel` (Treffsicher), alle additiv; keine neue Brücke. Vorher auf `main` der Stack mit
Brücke und Betrieb grün. Danach `projection-check dump|compare` mit `main` gegen den Basisbranch (Version 6 → 7) auf
der Prod-Kopie von 14:14 nach dem Deploy: 285 gleich, keine Abweichung. Am iPhone in Prod geprüft (User): Foto aus der
Kamera, HEIC aus der Mediathek (als JPEG mit Namen) und ein PDF als Beleg. Auf dem Basisbranch (`e6280f4f`) der Stack mit
Brücke, Betrieb und Übernahme grün.

**Viertes Release am 30. Oktober 2026: der Basisbranch** (`main` per Fast-forward auf `0bbc4d75`, alle drei Apps, vom
User): Stufe 2 (Tagebuch) und 3a/3b (Übernahme). Migrationen Tagebuch, Ziele und Abläufe, Hauptbuch der Übernahme, alle
additiv; Projektion auf Version 7. Ringwerk lief unverändert weiter (nichts geändert seit `fcb9aa69`).

**Übernahme in Prod am 30. Oktober 2026** (User, über `vereinsheim transfer --vps`): `status` vorher 9 offen und 0
außerhalb der Datei; Probelauf über alle 9 Zeilen ohne Befund; dann das Konto des Users, danach die übrigen. Die drei
Konten ohne Einheit in Treffsicher hat der User aus der Zuordnung genommen, sie bleiben nur in Treffsicher. Übernommen
sind 6 Konten, je Exit 0 ohne Befund, Speicher je Lauf höchstens 186 MiB. Folgepunkte: die Warnung von Compose, dass
`vereinsheim_uploads_spiegel` ohne seine Labels angelegt ist; die `DeprecationWarning` von `pg` (zwei Abfragen zugleich
auf einer Verbindung der Übernahme, scheitert erst mit `pg` 9); 3d; Stufe 4 mit Zeitplan für die Mitglieder.

## Wie es weitergeht

1. **1d Handeingabe** ist in `main` (`dbc9e45c`, Migration `20261028120000_hand_entry`, keine neue Brücke) und wartet
   aufs Release. Danach am iPhone prüfen: ein HEIC-Foto als Beleg und einen PDF-Beleg in Safari öffnen.
2. **Stufe 2 Tagebuch** ist fertig im Basisbranch: 2a (Einträge, Fragen, Papierkorb, Export), 2b (Ziele, Abläufe) und
   2c (Reiter „Auswertung“: Einflüsse gegen die Form, Selbstbild), Migrationen `20261028180000_diary_entries` und
   `20261029090000_diary_goals_routines`, 2c ohne Migration. 2b hebt die Projektion auf Version 7 (Serien): vor dem
   Release `projection-check dump|compare` auf der Prod-Kopie. Teil R (Reiter in einer Zeile, `TabBar`, mit R2 für die
   Art des Vergleichs) und 1f (bis zu 10 Belege an jeder eigenen Scheibe, Migration `20261029120000_evidence_list`)
   sind in `main` (`39dca9f4`) und warten aufs Release von Spiegel und Ringwerk (Ringwerk an einem Tag ohne
   Wettkampf). **1d und 1f gehen zusammen in ein Release:** Ein Image mit 1d ohne 1f entfernte an einer Scheibe mit
   mehreren Belegen alle auf einmal. Offen für später: Vorschaubilder der Belege laden je Besuch die ganze Datei
   (`private, no-store`), ein Zwischenspeicher als eigener kleiner Schritt (User, 29. Oktober 2026). In der Dev-DB stehen Vorschau-Daten des Users aus dem Werkzeug von 2c
   (`pnpm --filter spiegel diary-preview`): 94 Einträge (`preview:`), 24 Scheiben „aus Treffsicher“
   (`treffsicher:preview-`), dazu 10 erfundene Ziele und 2 Abläufe aus 2b (`preview:`). Vor der Übernahme in Stufe 3
   löschen mit `pnpm --filter spiegel diary-preview --delete --to <E-Mail in Spiegel>`. Bericht der Datenprüfung:
   `reports/tis-2c/data-check.md` (lokal). Als Nächstes 1f (mehrere Belege je Scheibe, Konzept zuerst, nach `main`) und
   Stufe 3.
3. **Stufe 3 Übernahme**, dann **Stufe 4 Ruhestand**.

Für später festgehalten: Randfall „Wertung endgültig gelöscht, Probe des Abends bleibt“: Holen öffnet die Probe, die
Sperre der Wertung bleibt; Reiter Lage der Skriptprüfung (`vault/incidents/pruefen-reiter-lage-scroll-jump.md`, auf
`main` 177/178); Lage des Toasts in die Skriptprüfung aufnehmen; das Tracing aus `apps/spiegel/src/lib/printouts/files.ts`
eingrenzen (zieht lokal `uploads/` nach `.next/standalone`, conventions §9); `printout-import` legt Aufträge an die
Anlage an (mit dem Fenster gefahrlos); „Als Wertung zählen“ (SF-05) für Probe,
die eigentlich die Wertung war; ein Zeitfenster für `overviewCards` (rechnet wie Start über alle eigenen Scheiben,
Befund aus dem Review von 2a).

## Stand

| Teil | Plan                                         | Branch                                     | Session                  | Stand                                                   |
| ---- | -------------------------------------------- | ------------------------------------------ | ------------------------ | ------------------------------------------------------- |
| V1   | `plans/2026-10-26-tis-v1-accounts.md`        | `feat/tis-v1-accounts`                     | tis-v1-accounts          | im Basisbranch, Plan entfernt                           |
| 1a-1 | `plans/2026-10-27-tis-1a1-card-details.md`   | `feat/tis-1a1-card-details` (von `main`)   | tis-1a1-card-details     | in `main` (`a7c98a09`), deployt (bis 30.10.)              |
| 1a-2 | `plans/2026-10-27-tis-1a2-views.md`          | `feat/tis-1a2-views` (von `main`)          | tis-1a2-views            | in `main` (`38fc63b6`), deployt (bis 30.10.)              |
| 1b-1 | `plans/2026-10-26-tis-1b1-printouts.md`      | `feat/tis-1b1-printouts` (von `main`)      | tis-1b1-printouts        | in `main` (`f0213d9a`), deployt (bis 30.10.)              |
| 1b-2 | `plans/2026-10-27-tis-1b2-fetch-card.md`     | `feat/tis-1b2-fetch-card` (von `main`)     | tis-1b2-fetch-card       | in `main` (`053c11b8`), deployt (bis 30.10.)              |
| 1c-0 | `plans/2026-10-27-tis-1c0-printout-check.md` | `feat/tis-1c0-printout-check` (von `main`) | tis-1c0-printout-check   | in `main` (`028234b0`); Ergebnis in [[meyton-printout]] |
| 1c   | `plans/2026-10-27-tis-1c-printout-values.md` | `feat/tis-1c-printout-values` (von `main`) | `tis-1c-printout-values` | in `main` (`88ea1140`); Luftgewehr-Fix, Leser v2        |
| 1d   | `plans/2026-10-28-tis-1d-hand-entry.md`      | `feat/tis-1d-hand-entry` (von `main`)      | `tis-1d-hand-entry`      | in `main` (`dbc9e45c`), deployt (bis 30.10.)              |
| 1e   |                                              |                                            |                          | in 1a-2                                                 |
| 1f   | `plans/2026-10-29-tis-1f-evidence-list.md`   | `feat/tis-1f-evidence-list` (von `main`)   | `tis-1f-evidence-list`   | in `main` (`39dca9f4`), deployt (bis 30.10.); Plan entfernt |
| 2a   | `plans/2026-10-28-tis-2a-diary-entries.md`   | `feat/tis-2a-diary-entries` (vom Basis)    | `tis-2a-diary-entries`   | deployt 30.10., Basisbranch (`3fd30d85`), Plan entfernt              |
| 2b   | `plans/2026-10-28-tis-2b-goals-routines.md`  | `feat/tis-2b-goals-routines` (vom Basis)   | `tis-2b-goals-routines`  | deployt 30.10., Basisbranch (`b51a030b`), Plan entfernt              |
| 2c   | `plans/2026-10-29-tis-2c-diary-analysis.md`  | `feat/tis-2c-diary-analysis` (vom Basis)   | `tis-2c-diary-analysis`  | deployt 30.10., Basisbranch (`69bedd2a`), Plan entfernt              |
| R    | `plans/2026-10-29-tis-r-tab-bar.md`          | `feat/tis-r-tab-bar` (von `main`)          | `tis-r-tab-bar`          | in `main` (`290da9e5`, mit R2), deployt (bis 30.10.); Plan entfernt |
| 3a   | `plans/2026-10-29-tis-3a-transfer.md`        | `feat/tis-3a-transfer` (vom Basis)         | `tis-3a-transfer`        | deployt 30.10., Basisbranch (`b8ae4506`), Plan entfernt              |
| 3b   | `plans/2026-10-30-tis-3b-transfer-ops.md`    | `feat/tis-3b-transfer-ops` (vom Basis)     | `tis-3b-transfer-ops`    | deployt 30.10., Basisbranch (`b75352f1`), Plan entfernt              |
| 3c   | `plans/2026-10-29-tis-3c-warmup.md`          | `feat/tis-3c-warmup` (von `main`)          | `tis-3c-warmup`          | in `main` (`52dffad1`), deployt (bis 30.10.); Plan entfernt |
| 3d   |                                              | (vom Basis)                                |                          | entschieden (29.10.), Plan offen                        |
| 3e   | `plans/2026-10-29-tis-3e-read-only.md`       | `feat/tis-3e-read-only` (von `main`)       | `tis-3e-read-only`       | in `main` (`0000933f`), deployt (bis 30.10.); Plan entfernt |
| U1   | `plans/2026-10-31-tis-u1-nav-compare.md`     | `feat/tis-u1-nav-compare` (vom Basis)      | `tis-u1-nav-compare`     | freigegeben und gestartet (31.10.)                       |
| 4    |                                              |                                            |                          | offen                                                   |

## Verification

Jeder Teilplan hat seine eigene Verifikation. Vor dem Merge nach `main`: Gate grün auf dem Basisbranch, Stack Ende zu
Ende mit `tools/stack-e2e/run.sh`, Prüfbestand der Übernahme auf der Prod-Kopie grün.
