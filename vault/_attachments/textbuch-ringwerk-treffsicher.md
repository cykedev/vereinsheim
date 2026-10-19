# Textbuch Ringwerk und Treffsicher

Neue Texte stehen hier zuerst, als „alt → neu“. Ein Mensch liest sie und gibt sie frei. Erst danach kommen sie in den
Code. Die Schreibregeln stehen in `vault/conventions.md` §10 („So schreiben wir“).

Zeichen: `{…}` ist ein Wert, den die App einsetzt. „(nur wenn …)“ heißt, die Zeile erscheint nur in diesem Fall.

Jeder Dialog hat dieselben Teile: Titel, Worum es geht, Vorher prüfen (nur wenn es etwas zu prüfen gibt), Was dann
passiert, Was nicht passiert, Rückgängig, Knopf. Daneben steht immer „Abbrechen“.

---

## Treffsicher: Folgen vor dem Bestätigen (TC0)

**Status: freigegeben am 19. Oktober 2026**

### 1. Einheit löschen

Ort: Seite einer Einheit, Knopf „Löschen“.

**alt:** „Einheit löschen?“ · „Diese Aktion kann nicht rückgängig gemacht werden.“ · Knopf „Löschen“

**neu:**

- **Titel:** Einheit vom {Mi 14.10.2026 um 18:30} löschen?
- **Worum:** Die Einheit vom {Mi 14.10.2026 um 18:30} steht in deinem Tagebuch. {Luftgewehr (Zehntel)}, {Training}.
- **Was dann passiert:**
  - Die Einheit verschwindet aus dem Tagebuch und aus der Statistik.
  - Mit ihr gehen die Serien und Schüsse, das Befinden, die Prognose, das Feedback und die Reflexion.
  - (nur wenn Anhänge) Die {2} angehängten Dateien werden gelöscht.
  - (nur wenn Zielen zugeordnet) {2} Ziele zählen diese Einheit nicht mehr mit.
- **Was nicht passiert:**
  - Die Ziele selbst bleiben. Die Disziplin und deine Abläufe bleiben.
- **Rückgängig:** Nicht möglich. Die Einheit lässt sich nur neu erfassen.
- **Knopf:** Einheit löschen

### 2. Anhang löschen

Ort: Seite einer Einheit, Karte „Anhänge“, Knopf am Anhang.

**alt:** „Anhang löschen?“ · „"{name}" wird dauerhaft entfernt.“ · Knopf „Löschen“

**neu:**

- **Titel:** Anhang „{scheibe.jpg}“ löschen?
- **Worum:** Die Datei „{scheibe.jpg}“ hängt an dieser Einheit.
- **Was dann passiert:**
  - Die Datei wird gelöscht und verschwindet aus der Einheit.
- **Was nicht passiert:**
  - Die Einheit und ihre Ergebnisse bleiben.
- **Rückgängig:** Nicht möglich. Hast du die Datei noch, kannst du sie neu hochladen.
- **Knopf:** Anhang löschen

### 3. Ziel löschen

Ort: Ziele, Seite eines Ziels, Knopf „Löschen“.

**alt:** „Ziel löschen?“ · „Das Ziel und alle Verknüpfungen zu Einheiten werden entfernt.“ · Knopf „Löschen“

**neu:**

- **Titel:** Ziel „{380 Ringe im Wettkampf}“ löschen?
- **Worum:** Das Ziel gilt vom {01.09.2026} bis {31.12.2026}. (nur wenn zugeordnet) {4} Einheiten sind ihm zugeordnet.
- **Was dann passiert:**
  - Das Ziel verschwindet unter „Ziele“.
  - (nur wenn zugeordnet) Die {4} Einheiten zeigen es nicht mehr an.
- **Was nicht passiert:**
  - Keine Einheit wird gelöscht. Ergebnisse und Statistik bleiben gleich.
- **Rückgängig:** Nicht möglich. Du kannst das Ziel neu anlegen und die Einheiten wieder zuordnen.
- **Knopf:** Ziel löschen

### 4. Ablauf löschen

Ort: Ablauf, Seite eines Ablaufs, Knopf „Löschen“.

**alt:** „Ablauf löschen?“ · „Diese Aktion kann nicht rückgängig gemacht werden.“ · Knopf „Löschen“

**neu:**

- **Titel:** Ablauf „{Luftgewehr stehend}“ löschen?
- **Worum:** Der Ablauf „{Luftgewehr stehend}“ beschreibt deinen Schuss in {8} Schritten.
- **Was dann passiert:**
  - Der Ablauf verschwindet unter „Ablauf“.
- **Was nicht passiert:**
  - Einheiten bleiben. Was du in einer Reflexion zum Ablauf notiert hast, bleibt stehen.
- **Rückgängig:** Nicht möglich. Du kannst den Ablauf neu anlegen.
- **Knopf:** Ablauf löschen

### 5. Disziplin archivieren

Ort: Disziplinen, Seite einer Disziplin, Knopf „Archivieren“. Eine Standarddisziplin archiviert nur ein Admin.

**alt:** „Disziplin archivieren?“ · „Archivierte Disziplinen erscheinen nicht mehr in der Auswahl.“ · Knopf
„Archivieren“

**neu, eigene Disziplin:**

- **Titel:** Disziplin „{Luftpistole Auflage}“ archivieren?
- **Worum:** „{Luftpistole Auflage}“ ist eine deiner eigenen Disziplinen.
- **Was dann passiert:**
  - Bei einer neuen Einheit und einem neuen Ablauf steht sie nicht mehr zur Auswahl.
  - (nur wenn Lieblingsdisziplin) Sie ist danach nicht mehr deine Lieblingsdisziplin.
- **Was nicht passiert:**
  - Einheiten mit dieser Disziplin bleiben. Ihre Ergebnisse zählen weiter in der Statistik.
- **Rückgängig:** Unter „Disziplinen“ mit „Aktivieren“. Die Lieblingsdisziplin wählst du dann neu.
- **Knopf:** Archivieren

**neu, Standarddisziplin (Admin):**

- **Titel:** Standarddisziplin „{Luftgewehr (Zehntel)}“ archivieren?
- **Worum:** „{Luftgewehr (Zehntel)}“ ist eine Standarddisziplin. Alle Konten sehen sie.
- **Was dann passiert:**
  - Für alle Konten steht sie bei einer neuen Einheit und einem neuen Ablauf nicht mehr zur Auswahl.
  - Wer sie als Lieblingsdisziplin gewählt hat, verliert diese Wahl.
- **Was nicht passiert:**
  - Einheiten mit dieser Disziplin bleiben, bei allen Konten. Ihre Ergebnisse zählen weiter in der Statistik.
- **Rückgängig:** Unter „Disziplinen“ mit „Aktivieren“. Die Lieblingsdisziplin wählt jedes Konto selbst neu.
- **Knopf:** Archivieren

### 6. Disziplin wieder aktivieren

Ort: Disziplinen, Seite einer archivierten Disziplin, Knopf „Aktivieren“.

**alt:** „Disziplin aktivieren?“ · „Die Disziplin wird wieder in der Auswahl angezeigt.“ · Knopf „Aktivieren“

**neu:**

- **Titel:** Disziplin „{Luftpistole Auflage}“ wieder aktivieren?
- **Worum:** „{Luftpistole Auflage}“ ist archiviert.
- **Was dann passiert:**
  - Bei einer neuen Einheit und einem neuen Ablauf steht sie wieder zur Auswahl. (nur Standarddisziplin) Das gilt
    für alle Konten.
- **Was nicht passiert:**
  - Eine frühere Wahl als Lieblingsdisziplin kommt nicht zurück.
- **Rückgängig:** Mit „Archivieren“.
- **Knopf:** Aktivieren

### 7. Disziplin löschen

Ort: Disziplinen, Seite einer Disziplin. Den Knopf gibt es nur, solange keine Einheit und kein Ablauf die Disziplin
verwendet.

**alt:** „Disziplin endgültig löschen?“ · „Diese Aktion kann nicht rückgängig gemacht werden.“ · Knopf „Löschen“

**neu:**

- **Titel:** Disziplin „{Luftpistole Auflage}“ löschen?
- **Worum:** Keine Einheit und kein Ablauf verwendet „{Luftpistole Auflage}“. Nur deshalb lässt sie sich löschen.
- **Was dann passiert:**
  - Die Disziplin verschwindet unter „Disziplinen“ und aus der Auswahl. (nur Standarddisziplin) Das gilt für alle
    Konten.
  - Wer sie als Lieblingsdisziplin gewählt hat, verliert diese Wahl.
- **Was nicht passiert:**
  - Keine Einheit wird gelöscht.
- **Rückgängig:** Nicht möglich. Du kannst sie neu anlegen. Soll sie nur aus der Auswahl verschwinden, archiviere sie
  stattdessen.
- **Knopf:** Disziplin löschen

### 8. Konto deaktivieren (Admin)

Ort: Admin, Liste der Konten, Knopf „Deaktivieren“. Aktivieren fragt nicht, es hat keine Folgen außer der Anmeldung.

**alt:** „Nutzer deaktivieren?“ · „Der Account "{Name} <{E-Mail}>" kann sich danach nicht mehr anmelden.“ · Knopf
„Deaktivieren“

**neu:**

- **Titel:** Konto von {Erika Muster} deaktivieren?
- **Worum:** {Erika Muster} meldet sich mit {erika@example.org} an.
- **Was dann passiert:**
  - {Erika Muster} kann sich nicht mehr anmelden.
  - Ist {Erika Muster} gerade angemeldet, endet das beim nächsten Klick.
- **Was nicht passiert:**
  - Es wird nichts gelöscht. Einheiten, Ziele und Abläufe von {Erika Muster} bleiben.
- **Rückgängig:** Unter „Admin“ mit „Aktivieren“. Danach gilt das bisherige Passwort wieder.
- **Knopf:** Deaktivieren

Ohne Namen steht die E-Mail-Adresse an der Stelle des Namens.

### 9. Ohne Speichern verlassen

Ort: Formular einer Einheit und eines Ablaufs, wenn du mit Änderungen „Abbrechen“ tippst oder die Seite verlässt.

**alt:** „Ungespeicherte Änderungen verwerfen?“ · „Es gibt nicht gespeicherte Änderungen. Beim Verlassen gehen sie
verloren.“ · Knopf „Verwerfen“

**neu:**

- **Titel:** Ohne Speichern verlassen?
- **Worum:** Du hast hier etwas geändert und noch nicht gespeichert.
- **Was dann passiert:**
  - Deine Änderungen gehen verloren.
- **Was nicht passiert:**
  - Was vorher gespeichert war, bleibt.
- **Rückgängig:** Nicht möglich. Mit „Abbrechen“ bleibst du hier und kannst speichern.
- **Knopf:** Verwerfen

### Alte Wörter

Diese Wörter dürfen in den Dialogen nicht mehr stehen (Test): „Account“, „Nutzer“ (in der Oberfläche „Konto“),
„Session“, „Diese Aktion kann nicht rückgängig gemacht werden“, „endgültig“, „dauerhaft entfernt“, „Verknüpfung“. Dazu
die Grundregel: kein Semikolon, keine drei Punkte.

---

## Treffsicher: Hilfe (TD0)

**Status: freigegeben am 19. Oktober 2026**

Die Erklärung öffnet sich über „?“ als Blatt. Der Schalter „Erklärungen“ auf der Seite einer Einheit zeigt den Kurzsatz
unter dem Titel der Karte, wie in Spiegel. Felder: Kurz, Was es ist, So liest du es, Was du tun kannst, Vorsicht.

### Prognose und Feedback

Ort: Seite einer Einheit, Karte „Vergleich Prognose vs. Feedback“. Die Karte heißt neu **„Prognose und Feedback“**.

- **Titel:** Prognose und Feedback
- **Kurz:** Wie du dich vor der Einheit eingeschätzt hast und wie es danach war.
- **Was es ist:** Vor der Einheit schätzt du dich in sieben Bereichen ein, von 0 bis 100. Das ist die Prognose. Nach
  der Einheit schätzt du dieselben Bereiche noch einmal ein. Das ist das Feedback.
- **So liest du es:** „Differenz“ ist Feedback minus Prognose. Grün heißt: besser als gedacht. Rot heißt: schlechter
  als gedacht. 0 heißt: wie gedacht.
- **Was du tun kannst:** Ist ein Bereich oft rot, schätzt du ihn vorher zu gut ein. Diesen Bereich lohnt es sich im
  Training anzusehen.
- **Vorsicht:** Beide Werte sind deine eigene Einschätzung. Sie messen nichts. Eine einzelne Einheit sagt wenig. Erst
  mehrere Einheiten zeigen ein Muster.

### Befinden

Ort: Seite einer Einheit, Karte „Befinden“.

- **Titel:** Befinden
- **Kurz:** Wie es dir vor der Einheit ging: Schlaf, Energie, Stress und Motivation.
- **Was es ist:** Vor der Einheit trägst du vier Werte ein, jeweils von 0 bis 100. Schlaf: wie gut du geschlafen hast.
  Energie: wie frisch du dich fühlst. Stress: wie angespannt du bist. Motivation: wie viel Lust du auf die Einheit
  hast.
- **So liest du es:** Bei Schlaf, Energie und Motivation ist ein hoher Wert gut. Bei Stress ist ein hoher Wert
  schlecht.
- **Was du tun kannst:** Trägst du das Befinden oft ein, zeigt die Statistik, ob deine Ergebnisse damit zusammenhängen.
- **Vorsicht:** Trag die Werte vor der Einheit ein, nicht danach. Sonst färbt das Ergebnis die Einschätzung.

---

## Treffsicher: „–“ mit Grund (TD3)

**Status: freigegeben am 19. Oktober 2026**

Wo heute eine 0, ein leeres Feld oder ein Strich ohne Erklärung steht, steht künftig „–“ und daneben (oder als Tooltip
und für Screenreader) der Grund.

| Ort                                          | alt                       | neu: Grund                    |
| -------------------------------------------- | ------------------------- | ----------------------------- |
| Einheit, Karte „Ergebnis“, Gesamtergebnis    | „–“                       | noch kein Ergebnis eingetragen |
| Einheit, Serie ohne Ringe                    | „–“                       | ohne Ergebnis                 |
| Einheit, Spalte „Schüsse“                    | „–“                       | ohne Einzelschüsse            |
| Einheit, „Ausführung“ ohne Bewertung         | fünf leere Punkte (wie 0) | „–“ nicht bewertet            |
| Admin, Konto ohne Namen                      | „—“                       | „–“ ohne Namen                |
| Admin, „Letzte Session-Änderung“ ohne Datum  | „—“                       | „–“ noch keine Einheit        |

Dazu heißt „Letzte Session-Änderung“ in der Liste der Konten neu **„Letzte Änderung an einer Einheit“**.

---

## Treffsicher: Statistik als Seite eines Zeitraums (G4–G8)

**Status: Entwurf, wartet auf Freigabe**

Die Statistik wird die Seite eines Zeitraums aus Spiegel (Fortschritt). Die Bausteine kommen aus `shot-ui`. Neu sind
nur die Wörter für Treffsicher, die beiden Reiter „Einflüsse“ und „Selbstbild“ und die Erklärungen hinter dem „?“.

### Wörter auf der Seite

Spiegel sagt „Scheibe“, Treffsicher sagt **„Einheit“**. Beide Wörter sind weiblich, die Sätze bleiben sonst gleich.

| Ort                          | Spiegel                                                   | Treffsicher                                                              |
| ---------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------ |
| Titel der Seite (Navigation) | Fortschritt                                               | Statistik                                                                |
| Kopfzeile                    | {LG 40} · {12} Scheiben · {Tage}                          | {Luftgewehr} · {12} Einheiten · {Tage}                                   |
| Ablesung                     | Neueste Scheibe · Gewählte Scheibe · Scheibe öffnen       | Neueste Einheit · Gewählte Einheit · Einheit öffnen                      |
| Ablesung, erste              | erste Scheibe, kein Schnitt davor                         | erste Einheit, kein Schnitt davor                                        |
| Abstand                      | +0,03 zum Schnitt der 5 Scheiben davor                    | +0,03 zum Schnitt der 5 Einheiten davor                                  |
| Abschnitt                    | Scheiben                                                  | Einheiten                                                                |
| Liste                        | Keine Scheibe im Zeitraum. · Scheibe vom {Datum} wählen   | Keine Einheit im Zeitraum. · Einheit vom {Datum} wählen                  |
| Liste, Ende                  | Alle in Scheiben zeigen                                   | entfällt (das Tagebuch filtert nicht nach Zeitraum)                      |
| Kacheln                      | Mittel je Scheibe · keine Scheibe mit Wert                | Mittel je Einheit · keine Einheit mit Wert                               |
| Ergebnis-Box                 | {12} Scheiben · {480} Wertungsschüsse · beste Scheibe zu 40 Schuss | {12} Einheiten · {480} Wertungsschüsse · beste Einheit zu 40 Schuss |
| Vergleich                    | zu wenige Scheiben                                        | zu wenige Einheiten                                                      |
| Verlauf                      | je Scheibe · Für einen Verlauf braucht es zwei Scheiben mit Wert. | je Einheit · Für einen Verlauf braucht es zwei Einheiten mit Wert. |
| Umfang                       | {140} Schuss, {3} Scheiben, {2} Tage                      | {140} Schuss, {3} Einheiten, {2} Tage                                    |
| Rekorde                      | Scheibe zu 40 Schuss · Beste Form (Ø über 5 Scheiben)     | Einheit zu 40 Schuss · Beste Form (Ø über 5 Einheiten)                   |
| Analyse                      | Analyse über die Scheiben                                 | Analyse über die Einheiten                                               |
| Leerer Zeitraum              | Keine Scheibe in diesem Zeitraum. Wähle oben einen längeren Zeitraum oder eine andere Art. | Keine Einheit in diesem Zeitraum. Wähle oben einen längeren Zeitraum oder eine andere Art. |

Abweichend von Spiegel:

- **Kein Rekord:** „Noch kein Rekord: Es zählen nur abgeschlossene, vollständige Scheiben.“ → „Noch kein Rekord. Es
  zählen nur Einheiten mit Einzelschüssen in jeder Serie.“
- **Noch nichts da** (keine Einheit mit Disziplin und Ergebnis): „Noch keine Einheit mit Ergebnis. Trag eine Einheit
  mit Disziplin und Serien ein. Dann steht hier dein Verlauf.“
- **Kennzahlen im Verlauf:** Ø je Schuss · Zehner · Lage. Streuung und Tempo gibt es nicht, denn Treffsicher kennt
  weder die Lage jedes Schusses noch die Zeit.
- **Kacheln:** Ø je Schuss · Zehnerquote · Schwerpunkt-Abstand (aus der Trefferlage des Ausdrucks, in mm).
- **Wertung:** Nur bei Disziplinen in Zehnteln steht der Umschalter „In Zehnteln“ / „In ganzen Ringen“.
- **Blatt „Filter“:** ohne „Trainings nur aus Probe mitzählen“. In Treffsicher zählt Probe nie.
- **Umfang:** nur „Umfang je Woche“, ohne Kalender. Im Kalender führt in Spiegel jeder Tag zur Liste an diesem Abend.
  Das Tagebuch kennt diesen Filter nicht.

### Reiter der Analyse

Unter „Was der Zeitraum zeigt“ stehen vier Reiter: **Rekorde · Trefferlage · Einflüsse · Selbstbild**.

### Unter „Zahlen“: Ringverteilung und Tabelle (erhalten aus der alten Statistik)

Wunsch des Users (19. Oktober 2026): Die Tabelle und die Trefferlage der alten Statistik bleiben erhalten, in der Art
von Spiegel.

- **Ringverteilung:** Titel „Ringverteilung“, daneben „{320} Wertungsschüsse aus {8} Einheiten“, darunter je Ring
  Anzahl und Anteil.
- **Tabelle:** Titel „Serien je Einheit“ (alt: der Name der Disziplin), daneben „{8} Einheiten“. Spalten, Gruppen und
  Ø-Zeilen wie bisher („Serie 1“ … „Gesamt“, „Σ alle“, „{3}er Serien“, „Ø aller Serien“). Jedes Datum führt zur
  Einheit. Zahlen mit Komma statt Punkt.

### Trefferlage (erhalten, neu gezeichnet)

Ort: Statistik, Reiter „Trefferlage“.

- **Unterzeile:** „Lage vom Ausdruck, im Mittel über {7} Einheiten: {0,20 mm rechts} und {0,10 mm hoch}.“ Auf null
  „waagrecht mittig“ bzw. „senkrecht mittig“.
- **Karte „Lage je Einheit“:** je Einheit ein Punkt, rechts und hoch positiv, das Mittel als Schwerpunkt-Zeichen.
- **Karte „Lage im Verlauf“:** Legende „waagrecht (rechts +)“ · „senkrecht (hoch +)“. Das Lineal nennt „{12.10.2026} ·
  {0,40 mm rechts} und {0,20 mm hoch}“. „Werte als Tabelle“ mit den Spalten „Datum“, „waagrecht (rechts +)“,
  „senkrecht (hoch +)“.
- **Ohne Werte:** „Im Zeitraum hast du keine Trefferlage eingetragen.“

### Einflüsse (neu)

Ort: Statistik, Reiter „Einflüsse“. Eine Karte je Merkmal, in dieser Reihenfolge: Schlaf, Energie, Stress, Motivation,
Ausführung.

- **Unterzeile:** Ø je Schuss an Tagen mit hohem gegen niedrigen Wert, im gewählten Zeitraum.
- **Zwei Zeilen je Karte**, je mit Ø je Schuss und Zahl der Einheiten:

  | Merkmal    | hoch               | niedrig              |
  | ---------- | ------------------ | -------------------- |
  | Schlaf     | Guter Schlaf       | Schlechter Schlaf    |
  | Energie    | Viel Energie       | Wenig Energie        |
  | Stress     | Viel Stress        | Wenig Stress         |
  | Motivation | Hohe Motivation    | Niedrige Motivation  |
  | Ausführung | Gute Ausführung    | Schwache Ausführung  |

  Beispiel: „Guter Schlaf · 9,21 · 8 Einheiten“ und „Schlechter Schlaf · 9,05 · 7 Einheiten“.
- **Urteil darunter**, in denselben Worten wie der Vergleich zweier Zeiträume, immer vom hohen Wert aus gesehen:
  - „Guter Schlaf: deutlich besser“ · „Viel Stress: schwächer“
  - „Kein klarer Unterschied“
  - „Zu wenige Einheiten. Für ein Urteil braucht es auf jeder Seite 5. Wähle oben einen längeren Zeitraum.“
- **Ohne Werte:** „Im Zeitraum hast du kein Befinden eingetragen.“ · „Im Zeitraum hast du keine Serie bewertet.“
- **Alle Werte gleich** (keine Einheit über oder unter der Mitte): „Deine Werte sind im Zeitraum alle gleich. So gibt es
  nichts zu vergleichen.“
- Mit Urteil oder „Kein klarer Unterschied“ steht der Unterschied dahinter: „· Δ +0,16“.

### Selbstbild (neu)

Ort: Statistik, Reiter „Selbstbild“. Eine Zeile je Bereich: Kondition, Ernährung, Technik, Taktik, Mentale Stärke,
Umfeld, Material.

- **Unterzeile:** Prognose vor und Feedback nach der Einheit, im Mittel über {4} Einheiten.
- **Je Zeile:** der Bereich, zwei Balken von 0 bis 100 (Prognose leise, Feedback in der Farbe der App), dazu die Zahlen
  „Prognose {62} · Feedback {70} · Abstand +8“.
- **Kein Urteil.** Dafür sind es zu wenige Einheiten.
- **Unter den Zeilen:** „Oben die Prognose, unten das Feedback. Abstand ist Feedback minus Prognose. Plus heißt: besser
  als gedacht.“
- **Ohne Werte:** „Im Zeitraum gibt es keine Einheit mit Prognose und Feedback.“

### Ringverteilung der Einheit (G7)

Ort: Seite einer Einheit, Karte „Schussverteilung“ (Säulen). Neu wie Spiegel: Balken je Ring in den Trefferfarben.

- **Titel:** „Schussverteilung“ → **„Ringverteilung“**
- **Je Ring:** die Anzahl und der Anteil, etwa „12 · 30 %“.
- **Darunter:** „{40} Wertungsschüsse, Probe zählt nicht“

### Erklärungen hinter dem „?“

**Frage an dich:** Der Plan sagt „gleiche Texte wie Spiegel“. Spiegels Texte sprechen aber von Scheiben, vom Kalender,
von „Trainings nur aus Probe“, von Streuung und Ellipse. Das stimmt in Treffsicher nicht. Vorschlag: eigene Fassungen
für Treffsicher, aus Spiegels Wortlaut gekürzt. Spiegel bleibt unverändert.

#### Ø je Schuss (Kachel, Verlauf)

- **Kurz:** Der Durchschnitt deiner Wertungsschüsse je Schuss.
- **Was es ist:** Die Summe deiner Wertungsserien geteilt durch die Zahl der Wertungsschüsse. Probe zählt nicht mit.
  Hast du keine Einzelschüsse eingetragen, zählt je Serie die Schusszahl der Disziplin.
- **So liest du es:** Der Ø je Schuss vergleicht Einheiten mit verschiedener Schusszahl fair. In Disziplinen mit
  Zehnteln schaltest du oben zwischen Zehnteln und ganzen Ringen um.
- **Vorsicht:** In ganzen Ringen zählen nur Einheiten mit Einzelschüssen. Aus einer Serie in Zehnteln lassen sich die
  ganzen Ringe nicht ablesen.

#### Zehnerquote (Kachel, Verlauf)

- **Kurz:** Wie viele deiner Wertungsschüsse eine Zehn sind.
- **Was es ist:** Der Anteil der Zehner an deinen Wertungsschüssen. Es zählen nur Einheiten mit Einzelschüssen.
- **So liest du es:** 25 % heißt: jeder vierte Schuss eine Zehn.
- **Vorsicht:** Bei wenigen Schüssen schwankt die Quote stark. Ein Abend mit 20 Schuss sagt wenig.

#### Schwerpunkt-Abstand (Kachel, Verlauf „Lage“)

- **Kurz:** Wie weit die Mitte deiner Treffer von der Mitte der Scheibe liegt.
- **Was es ist:** Die Trefferlage vom Ausdruck, waagrecht und senkrecht in mm, als ein Abstand zur Mitte.
- **So liest du es:** 0,5 mm heißt: Deine Treffer liegen im Mittel einen halben Millimeter neben der Mitte. Kleiner ist
  besser.
- **Was du tun kannst:** Bleibt der Abstand über mehrere Einheiten groß und in derselben Richtung, lohnt ein Blick auf
  die Visierung.
- **Vorsicht:** Es zählen nur Einheiten, bei denen du die Trefferlage eingetragen hast.

#### Verlauf und Form

- **Kurz:** Wie sich eine Zahl von Einheit zu Einheit entwickelt, mit deiner typischen Schwankung.
- **Was es ist:** Jeder Punkt ist eine Einheit. Die Linie ist der Schnitt der letzten fünf Einheiten. Sie ist
  gestrichelt, solange es noch keine fünf sind. Das Formband um die Linie zeigt, wie weit deine Einheiten üblicherweise
  um diesen Schnitt schwanken. Je Monat zeigt die Statistik dazu Boden und Decke: den Wert an einem schwachen Tag, den
  mittleren und den an einem guten Tag.
- **So liest du es:** Liegt eine Einheit im Band, war sie für deine Form normal. Etwa zwei von drei Einheiten liegen
  darin. Wird dein Boden über die Monate besser, werden deine schwachen Tage besser.
- **Vorsicht:** Eine einzelne Einheit außerhalb des Bands ist noch kein Formknick.
- **Mindestzahl:** Ab 1 Einheit. Das Formband ab 10 Einheiten, Boden und Decke ab 5 Einheiten im Monat.

#### Trainingsumfang

- **Kurz:** Wie viel du trainierst: Schüsse, Einheiten und Tage je Woche.
- **Was es ist:** Je Woche die Zahl deiner Wertungsschüsse, deiner Einheiten und der Tage mit Training. Auch Wochen ohne
  Training stehen da.
- **So liest du es:** Der Umfang sagt nichts über die Güte. Leg ihn neben den Verlauf. Liegen deine Einheiten in Wochen
  mit sehr vielen Schüssen öfter unter dem Formband, kann das Ermüdung sein.

#### Zwei Zeiträume im Vergleich

- **Kurz:** Ob sich eine Zahl zwischen zwei Zeiträumen wirklich verändert hat.
- **Was es ist:** Die Statistik vergleicht die Werte deiner Einheiten aus zwei Zeiträumen. Jede Einheit zählt einmal,
  egal wie viele Schüsse sie hat.
- **So liest du es:** Steht „besser“ oder „schwächer“, entstünde so ein Unterschied durch Zufall allein in höchstens 5
  von 100 Vergleichen. Steht „kein klarer Unterschied“, heißt das nicht „gleich geblieben“. Die Einheiten reichen nur
  nicht, es zu zeigen. „Deutlich“ heißt: Der Unterschied ist groß genug, um im Training etwas auszumachen.
- **Vorsicht:** Unter 5 Einheiten je Seite gibt es kein Urteil.

#### Abstand zum Schnitt davor

- **Kurz:** Wie deine Einheit zum Schnitt deiner fünf Einheiten davor passt.
- **Was es ist:** Der Unterschied zwischen dem Ø je Schuss einer Einheit und dem Schnitt deiner bis zu fünf Einheiten
  davor in derselben Disziplin. Die Einheit selbst zählt nicht mit.
- **So liest du es:** +0,12 heißt: 0,12 Ringe je Schuss über dem Schnitt der Einheiten davor.
- **Vorsicht:** Ein Abstand, der in deinem Formband bleibt, ist normal.

#### Rekorde

- **Kurz:** Deine Bestwerte über alle Einheiten, die zählen.
- **Was es ist:** Bestes Ergebnis, beste Serie, meiste Zehner auf einer Einheit und in einer Serie, längste Folge von
  Zehnern, längste Folge ohne Schuss unter 9, dein bester schwächster Schuss, die kleinste Spanne zwischen bester und
  schwächster Serie und deine beste Form über fünf Einheiten in Folge. In Zehnteln dazu die meisten 10,9. Ergebnisse
  gelten je Schusszahl der Einheit, Serien je Serienlänge.
- **So liest du es:** Bei Gleichstand bleibt der frühere Rekord. Rekorde gelten über alle deine Einheiten der
  Disziplin, nicht nur über den Zeitraum.
- **Vorsicht:** Es zählen nur Einheiten mit Einzelschüssen in jeder Wertungsserie.

#### Einflüsse (neu)

- **Kurz:** Ob du an Tagen mit gutem Befinden oder guter Ausführung anders schießt.
- **Was es ist:** Für jedes Merkmal teilt die Statistik deine Einheiten im Zeitraum in zwei Gruppen: über deinem
  mittleren Wert und darunter. Einheiten genau auf dem mittleren Wert zählen zur kleineren Gruppe. Dann vergleicht sie den Ø je
  Schuss der beiden Gruppen, so wie zwei Zeiträume. Bei der Ausführung zählt das Mittel deiner bewerteten
  Wertungsserien.
- **So liest du es:** „Guter Schlaf: deutlich besser“ heißt: Nach gutem Schlaf liegt dein Ø je Schuss klar höher.
  „Kein klarer Unterschied“ heißt nicht, dass es keinen gibt. Die Einheiten reichen nur nicht, es zu zeigen.
- **Was du tun kannst:** Trag das Befinden vor jeder Einheit ein. Erst mit vielen Einheiten zeigt sich ein Muster.
- **Vorsicht:** Ein Zusammenhang ist noch kein Grund. Wer müde ist, trainiert vielleicht auch anders.
- **Mindestzahl:** Ein Urteil ab 5 Einheiten je Gruppe.

#### Selbstbild (neu)

- **Kurz:** Wie du dich vor der Einheit einschätzt und wie es danach war, im Mittel über den Zeitraum.
- **Was es ist:** Je Bereich das Mittel deiner Prognose vor der Einheit und deines Feedbacks danach. Der Abstand ist
  Feedback minus Prognose.
- **So liest du es:** Plus heißt: besser als gedacht. Minus heißt: schlechter als gedacht. Ist ein Bereich oft im
  Minus, schätzt du ihn vorher zu gut ein.
- **Vorsicht:** Beide Werte sind deine eigene Einschätzung. Ein Urteil gibt es nicht, dafür sind es zu wenige Einheiten.
