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

**Status: freigegeben am 19. Oktober 2026** (eigene Erklärungen für Treffsicher statt der von Spiegel)

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

Entschieden vom User: eigene Fassungen für Treffsicher, aus Spiegels Wortlaut gekürzt (Spiegels Texte sprechen von
Scheiben, Kalender, „Trainings nur aus Probe“, Streuung und Ellipse). Spiegel bleibt unverändert. Im Code unter
Spiegels Ids in `apps/treffsicher/src/lib/help/statisticsTopics.ts`.

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

---

## Ringwerk: Folgen vor dem Bestätigen (WC0)

**Status: freigegeben am 20. Oktober 2026 (mit E1–E4)**

Ringwerk trägt den Wettkampfbetrieb. Jeder Dialog unten sagt deshalb genau, was gelöscht wird, was im Protokoll bleibt
und was danach gesperrt ist. Die Folgen sind aus den Actions abgelesen (Stand `feat/design2-all-apps`, a30c7432).
Beispielnamen sind erfunden.

Zum Freigeben gehören diese Entscheidungen:

- **E1 Wettbewerb mit Teilnehmern löschen.** Heute fragt der Dialog, und Ringwerk lehnt danach mit einer Meldung ab.
  Vorschlag: Bei eingeschriebenen Teilnehmern zeigt der Knopf gleich den Hinweis 10b mit „Schließen“, wie beim Löschen
  eines Teilnehmers (3b).
- **E2 Spielplan-Texte.** Die Texte stehen heute in `lib/matchups/regeneration.ts` (`scheduleDialogText`). Sie ziehen
  nach `lib/consequences.ts`. In `regeneration.ts` entfallen dafür die Textfunktion und ihr Test. Die Regel, wann neu
  generiert werden darf, bleibt unberührt.
- **E3 Knöpfe sagen, was man will.** Aus „Bestätigen“, „Löschen“ und „Endgültig löschen“ werden „Abschließen“,
  „Ergebnis löschen“, „Mit allen Daten löschen“ und so weiter. Die Abläufe aus Teil R drücken danach die neuen Knöpfe.
  Was sie in der Datenbank nachprüfen, bleibt gleich.
- **E4 Nicht in diesem Abschnitt:** „Zurückziehen“ (ein Formular mit Grund), Disziplin archivieren und
  wiederherstellen (heute ohne Rückfrage). Sie bleiben, wie sie sind.

### 1. Ergebnis im Event löschen

Ort: Event, Reiter „Serien erfassen“, Papierkorb in der Zeile.

**alt:** „Ergebnis löschen?“ · „Das Ergebnis wird endgültig gelöscht. Diese Aktion kann nicht rückgängig gemacht
werden.“ · Knopf „Löschen“

**neu:**

- **Titel:** Ergebnis von {Anna Birke} löschen?
- **Worum:** Für {Anna Birke} ist in diesem Event ein Ergebnis eingetragen.
- **Was dann passiert:**
  - Das Ergebnis verschwindet aus der Rangliste. Die Plätze werden ohne es neu berechnet.
  - (nur mit Teams) Auch die Teamwertung rechnet ohne dieses Ergebnis.
  - Im Protokoll des Wettbewerbs steht danach, dass das Ergebnis gelöscht wurde, mit Ringen und Teiler.
- **Was nicht passiert:**
  - {Anna Birke} bleibt eingeschrieben und kann ein neues Ergebnis bekommen.
  - Die anderen Ergebnisse bleiben.
- **Rückgängig:** Nicht möglich. Das Ergebnis lässt sich neu eintragen. Ringe und Teiler stehen im Protokoll.
- **Knopf:** Ergebnis löschen

### 2. Serie in der Saison löschen

Ort: Saison, Reiter „Serien erfassen“, Papierkorb an einer Serie.

**alt:** „Serie löschen?“ · „Die Serie wird endgültig gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.“ ·
Knopf „Löschen“

**neu:**

- **Titel:** Serie vom {12.10.2026} löschen?
- **Worum:** {Anna Birke} hat am {12.10.2026} diese Serie geschossen. Sie zählt in der Saison.
- **Was dann passiert:**
  - Die Serie verschwindet. Die Rangliste rechnet ohne sie.
  - (nur mit Mindestzahl) Gelten {10} Serien als Mindestzahl und hat {Anna Birke} danach weniger, steht {Anna Birke}
    ohne Platz in der Rangliste.
  - Im Protokoll des Wettbewerbs steht danach, dass die Serie gelöscht wurde, mit Datum, Ringen und Teiler.
- **Was nicht passiert:**
  - Die anderen Serien von {Anna Birke} bleiben.
- **Rückgängig:** Nicht möglich. Die Serie lässt sich neu eintragen. Datum, Ringe und Teiler stehen im Protokoll.
- **Knopf:** Serie löschen

### 3. Teilnehmer löschen

Ort: Teilnehmer, Papierkorb in der Zeile. Den Knopf gibt es nur bei inaktiven Teilnehmern. Es gibt drei Fälle.

**alt:** „Teilnehmer löschen?“ · „{Birke}, {Anna} wird endgültig gelöscht. Diese Aktion kann nicht rückgängig gemacht
werden.“ · Knopf „Löschen“ — „Löschen nicht möglich“ · „Dieser Teilnehmer hat {3} Wettbewerbe und kann daher nicht
gelöscht werden. Force-Delete ist nur für Admins möglich.“ · Knopf „Schließen“ — „Teilnehmer endgültig löschen?“ ·
„Diese Aktion kann nicht rückgängig gemacht werden. Alle Daten dieses Teilnehmers werden dauerhaft gelöscht — inklusive
{3} Wettbewerbe, alle Serien und Liga-Paarungen (inkl. der Serien des jeweiligen Gegners).“ · Knopf „Endgültig löschen“

**neu, 3a: in keinem Wettbewerb:**

- **Titel:** {Anna Birke} löschen?
- **Worum:** {Anna Birke} ist inaktiv und in keinem Wettbewerb eingetragen.
- **Was dann passiert:**
  - {Anna Birke} verschwindet aus der Teilnehmerliste.
  - Im Protokoll unter „Admin“ steht danach ein Eintrag mit dem Namen.
- **Was nicht passiert:**
  - Kein Wettbewerb ändert sich.
- **Rückgängig:** Nicht möglich. {Anna Birke} lässt sich neu anlegen.
- **Knopf:** Teilnehmer löschen

**neu, 3b: in Wettbewerben, Sportleitung (nur ein Hinweis):**

- **Titel:** {Anna Birke} lässt sich hier nicht löschen
- **Text:** {Anna Birke} ist in {3} Wettbewerben eingetragen. Damit Tabellen und Ergebnisse dort stimmen, löscht nur
  ein Admin so einen Teilnehmer, mit allen Daten. Als inaktiv steht {Anna Birke} bei neuen Wettbewerben schon nicht
  mehr zur Auswahl.
- **Knopf:** Schließen

**neu, 3c: in Wettbewerben, Admin:**

- **Titel:** {Anna Birke} mit allen Daten löschen?
- **Worum:** {Anna Birke} ist inaktiv und in {3} Wettbewerben eingetragen.
- **Vorher prüfen:** Läuft einer dieser Wettbewerbe noch? Dann ändern sich dort Tabelle, Spielplan und Playoffs. Meist
  genügt es, {Anna Birke} inaktiv zu lassen. Dann bleiben die alten Ergebnisse stehen.
- **Was dann passiert:**
  - {Anna Birke} verschwindet aus der Teilnehmerliste und aus allen {3} Wettbewerben.
  - Alle Serien und Ergebnisse von {Anna Birke} werden gelöscht.
  - Liga-Paarungen mit {Anna Birke} werden gelöscht, mit den Serien der Gegner. Die Tabellen rechnen ohne diese
    Paarungen.
  - Playoff-Paarungen mit {Anna Birke} werden mit allen Duellen gelöscht.
  - Im Protokoll unter „Admin“ steht danach, dass {Anna Birke} mit allen Daten gelöscht wurde.
- **Was nicht passiert:**
  - Die Wettbewerbe bleiben. Die anderen Teilnehmer bleiben eingeschrieben.
  - Frühere Einträge im Protokoll bleiben.
- **Rückgängig:** Nicht möglich. Auch die Serien der Gegner kommen nicht zurück.
- **Feld:** Zur Bestätigung den Nachnamen eingeben: {Birke}
- **Knopf:** Mit allen Daten löschen

### 4. Teilnehmer deaktivieren und aktivieren

Ort: Teilnehmer, Knopf in der Zeile.

**alt:** „Teilnehmer deaktivieren?“ · „{Birke}, {Anna} wird deaktiviert und kann keinen Ligen mehr hinzugefügt werden.“ ·
Knopf „Deaktivieren“ — „Teilnehmer aktivieren?“ · „{Birke}, {Anna} wird wieder aktiviert.“ · Knopf „Aktivieren“

**neu, deaktivieren:**

- **Titel:** {Anna Birke} deaktivieren?
- **Worum:** {Anna Birke} ist aktiv und steht beim Einschreiben in Wettbewerbe zur Auswahl.
- **Vorher prüfen:** Ist {Anna Birke} in einem laufenden Wettbewerb noch aktiv eingeschrieben? Dann geht das nicht.
  Zuerst dort zurückziehen.
- **Was dann passiert:**
  - Beim Einschreiben steht {Anna Birke} nicht mehr zur Auswahl.
  - In der Teilnehmerliste lässt sich {Anna Birke} danach löschen.
  - Im Protokoll unter „Admin“ steht danach ein Eintrag.
- **Was nicht passiert:**
  - Einschreibungen und Ergebnisse bleiben, auch in abgeschlossenen Wettbewerben.
- **Rückgängig:** Unter „Teilnehmer“ mit „Aktivieren“.
- **Knopf:** Deaktivieren

**neu, aktivieren:**

- **Titel:** {Anna Birke} wieder aktivieren?
- **Worum:** {Anna Birke} ist inaktiv.
- **Was dann passiert:**
  - Beim Einschreiben steht {Anna Birke} wieder zur Auswahl.
  - Im Protokoll unter „Admin“ steht danach ein Eintrag.
- **Was nicht passiert:**
  - In bestehenden Wettbewerben ändert sich nichts.
- **Rückgängig:** Mit „Deaktivieren“.
- **Knopf:** Aktivieren

### 5. Rückzug zurücknehmen

Ort: Wettbewerb, Reiter „Teilnehmer“, Knopf bei einem zurückgezogenen Teilnehmer. Den Knopf gibt es nur, bis die
Playoffs starten.

**alt:** „Rückzug rückgängig machen?“ · „{Birke}, {Anna} wird wieder als aktiv eingeschrieben.“ · Knopf „Rückgängig
machen“

**neu:**

- **Titel:** Rückzug von {Anna Birke} zurücknehmen?
- **Worum:** {Anna Birke} ist seit dem {12.10.2026} aus diesem Wettbewerb zurückgezogen.
- **Was dann passiert:**
  - {Anna Birke} ist im Wettbewerb wieder aktiv.
  - Paarungen und Ergebnisse von {Anna Birke} zählen wieder in Tabelle und Rangliste, auch die schon gespielten.
  - Im Protokoll des Wettbewerbs steht danach ein Eintrag.
- **Was nicht passiert:**
  - Der Spielplan ändert sich nicht.
  - Der Eintrag zum Rückzug bleibt im Protokoll.
- **Rückgängig:** Mit „Zurückziehen“, solange die Playoffs nicht gestartet sind.
- **Knopf:** Rückzug zurücknehmen

### 6. Aus dem Wettbewerb entfernen

Ort: Wettbewerb, Reiter „Teilnehmer“, Papierkorb in der Zeile. Den Knopf gibt es nur, bis die Playoffs starten.

**alt:** „Aus Wettbewerb entfernen?“ · „{Birke}, {Anna} wird dauerhaft aus diesem Wettbewerb entfernt.“ · Knopf
„Entfernen“

**neu:**

- **Titel:** {Anna Birke} aus dem Wettbewerb entfernen?
- **Worum:** {Anna Birke} ist in diesem Wettbewerb eingeschrieben. (nur mit Ergebnissen) Es gibt {2} Ergebnisse.
- **Vorher prüfen:** Steht {Anna Birke} schon im Spielplan, geht das nicht. Dann „Zurückziehen“ nutzen.
- **Was dann passiert:**
  - Die Einschreibung wird gelöscht. {Anna Birke} verschwindet aus den Seiten des Wettbewerbs.
  - (nur Gast) Der Gast und die Ergebnisse werden gelöscht.
  - (nur mit Ergebnissen, kein Gast) Die {2} Ergebnisse erscheinen nicht mehr. Gelöscht werden sie nicht.
  - (nur im Team) Ist Team {2} danach leer, wird es aufgelöst.
- **Was nicht passiert:**
  - (kein Gast) {Anna Birke} bleibt unter „Teilnehmer“ und in anderen Wettbewerben.
  - Das Protokoll bekommt keinen Eintrag.
- **Rückgängig:** (kein Gast) Neu einschreiben. (Gast) Den Gast neu anlegen und die Ergebnisse neu eintragen.
- **Knopf:** Aus dem Wettbewerb entfernen

Beim Gast steht nur der Vorname, wie in der Liste.

### 7. Disziplin löschen

Ort: Disziplinen, Papierkorb in der Zeile.

**alt:** „Disziplin löschen?“ · „Disziplin „{Name}" wirklich löschen?“ · Knopf „Löschen“

**neu:**

- **Titel:** Disziplin „{Luftgewehr Auflage}“ löschen?
- **Worum:** „{Luftgewehr Auflage}“ ist eine eigene Disziplin. (Systemdisziplin) „{Luftgewehr}“ ist eine
  Systemdisziplin von Ringwerk.
- **Vorher prüfen:** Löschen kann nur ein Admin. Wird die Disziplin in einem Wettbewerb verwendet, geht das nicht. Dann
  archiviere sie.
- **Was dann passiert:**
  - Die Disziplin verschwindet unter „Disziplinen“ und aus der Auswahl bei neuen Wettbewerben.
  - (nur Systemdisziplin) Beim nächsten Start legt Ringwerk sie wieder an.
  - Im Protokoll unter „Admin“ steht danach ein Eintrag.
- **Was nicht passiert:**
  - Kein Wettbewerb und kein Ergebnis wird gelöscht.
- **Rückgängig:** Nicht möglich. Die Disziplin lässt sich neu anlegen, mit Wertung und Faktor. Soll sie nur aus der
  Auswahl verschwinden, archiviere sie stattdessen.
- **Knopf:** Disziplin löschen

### 8. Status eines Wettbewerbs

Ort: Wettbewerbe, Knöpfe auf der Karte eines Wettbewerbs.

**alt:** „Wettbewerb {als abgeschlossen markieren | wieder öffnen | archivieren | wiederherstellen (als
abgeschlossen)}?“ · „Wettbewerb „{Name}" wird {…}.“ · Knopf „Bestätigen“

**neu, 8a abschließen:**

- **Titel:** „{Rundenwettkampf 2026}“ abschließen?
- **Worum:** „{Rundenwettkampf 2026}“ läuft.
- **Vorher prüfen:** Sind alle Ergebnisse eingetragen?
- **Was dann passiert:**
  - Der Wettbewerb steht in der Liste als abgeschlossen.
  - Einschreiben geht nicht mehr. Spielplan und Playoffs lassen sich nicht mehr starten.
  - (nur öffentlich) Der öffentliche Link zeigt den Wettbewerb weiter. Startet ein anderer Wettbewerb unter derselben
    Adresse, zeigt der Link diesen.
  - Im Protokoll des Wettbewerbs steht danach ein Eintrag.
- **Was nicht passiert:**
  - Tabellen, Plätze und Ergebnisse bleiben, wie sie sind.
- **Rückgängig:** Mit „Wieder öffnen“.
- **Knopf:** Abschließen

**neu, 8b wieder öffnen:**

- **Titel:** „{Rundenwettkampf 2026}“ wieder öffnen?
- **Worum:** „{Rundenwettkampf 2026}“ ist abgeschlossen.
- **Vorher prüfen:** (nur öffentlich) Läuft schon ein anderer Wettbewerb unter der Adresse „{rwk-2026}“? Dann geht das
  nicht.
- **Was dann passiert:**
  - Der Wettbewerb läuft wieder. Einschreiben, Spielplan und Playoffs gehen wieder.
  - Im Protokoll des Wettbewerbs steht danach ein Eintrag.
- **Was nicht passiert:**
  - Ergebnisse ändern sich nicht.
- **Rückgängig:** Mit „Abschließen“.
- **Knopf:** Wieder öffnen

**neu, 8c archivieren:**

- **Titel:** „{Rundenwettkampf 2026}“ archivieren?
- **Worum:** „{Rundenwettkampf 2026}“ ist abgeschlossen.
- **Was dann passiert:**
  - Der Wettbewerb steht in der Liste unter „Archiviert“.
  - Bearbeiten geht nicht mehr.
  - Im Protokoll des Wettbewerbs steht danach ein Eintrag.
- **Was nicht passiert:**
  - Nichts wird gelöscht. Seiten und PDFs bleiben erreichbar.
- **Rückgängig:** Mit „Wiederherstellen“. Der Wettbewerb ist dann wieder abgeschlossen.
- **Knopf:** Archivieren

**neu, 8d wiederherstellen:**

- **Titel:** „{Rundenwettkampf 2026}“ wiederherstellen?
- **Worum:** „{Rundenwettkampf 2026}“ ist archiviert.
- **Was dann passiert:**
  - Der Wettbewerb ist wieder abgeschlossen und lässt sich bearbeiten.
  - Im Protokoll des Wettbewerbs steht danach ein Eintrag.
- **Was nicht passiert:**
  - Er läuft nicht wieder. Dafür danach „Wieder öffnen“.
- **Rückgängig:** Mit „Archivieren“.
- **Knopf:** Wiederherstellen

### 9. Wettbewerb mit allen Daten löschen

Ort: Wettbewerb bearbeiten, unten. Der Kasten heißt heute „Gefahrenzone“.

**alt, Kasten:** „Gefahrenzone“ · „Der Wettbewerb und alle zugehörigen Daten (Teilnehmer-Einschreibungen, Spielplan,
Ergebnisse, Playoffs, Audit-Einträge) werden unwiderruflich gelöscht.“ · Knopf „Wettbewerb endgültig löschen“

**neu, Kasten:**

- **Überschrift:** Wettbewerb löschen
- **Text:** Löscht den Wettbewerb mit allem, was dazu eingetragen ist. Nur ein Admin kann das.
- **Knopf:** Wettbewerb mit allen Daten löschen

**alt, Dialog:** „Wettbewerb endgültig löschen?“ · „Diese Aktion kann nicht rückgängig gemacht werden. Alle Daten
dieses Wettbewerbs werden dauerhaft gelöscht.“ · Feld „Zur Bestätigung den Wettbewerb-Namen eingeben“ · Knopf
„Endgültig löschen“

**neu, Dialog:**

- **Titel:** „{Rundenwettkampf 2026}“ mit allen Daten löschen?
- **Worum:** In „{Rundenwettkampf 2026}“ stehen Einschreibungen, Ergebnisse und das Protokoll.
- **Vorher prüfen:** Wird der Wettbewerb noch gebraucht, auch zum Nachschauen? Archivieren behält alles.
- **Was dann passiert:**
  - Der Wettbewerb verschwindet aus der Liste.
  - Gelöscht werden Einschreibungen, Teams, Spielplan, alle Serien und Ergebnisse, die Playoffs mit allen Duellen.
  - Auch das Protokoll des Wettbewerbs wird gelöscht. Danach lässt sich nicht mehr sehen, wer was eingetragen hat.
  - (nur öffentlich) Der öffentliche Link führt nicht mehr zu diesem Wettbewerb.
- **Was nicht passiert:**
  - Die Teilnehmer bleiben unter „Teilnehmer“ und in anderen Wettbewerben. Die Disziplin bleibt.
- **Rückgängig:** Nicht möglich. Nur eine Sicherung des Servers hat die Daten noch.
- **Feld:** Zur Bestätigung den Namen des Wettbewerbs eingeben: {Rundenwettkampf 2026}
- **Knopf:** Mit allen Daten löschen

### 10. Wettbewerb löschen

Ort: Wettbewerbe, Papierkorb auf der Karte eines Wettbewerbs.

**alt:** „Wettbewerb löschen?“ · „Wettbewerb „{Name}" wirklich löschen?“ · Knopf „Löschen“ (mit Teilnehmern danach die
Meldung „Wettbewerb kann nicht gelöscht werden — es sind bereits Daten verknüpft. Bitte archivieren.“)

**neu, 10a: niemand eingeschrieben:**

- **Titel:** „{Rundenwettkampf 2026}“ löschen?
- **Worum:** In „{Rundenwettkampf 2026}“ ist niemand eingeschrieben.
- **Was dann passiert:**
  - Der Wettbewerb verschwindet aus der Liste.
  - Seine Einträge im Protokoll bleiben unter „Admin“, ohne Verweis auf den Wettbewerb.
- **Was nicht passiert:**
  - Keine Disziplin und kein Teilnehmer wird gelöscht.
- **Rückgängig:** Nicht möglich. Der Wettbewerb lässt sich neu anlegen.
- **Knopf:** Wettbewerb löschen

**neu, 10b: mit Teilnehmern (nur ein Hinweis, E1):**

- **Titel:** „{Rundenwettkampf 2026}“ lässt sich hier nicht löschen
- **Text:** In „{Rundenwettkampf 2026}“ sind {6} Teilnehmer eingeschrieben. So ein Wettbewerb wird archiviert, nicht
  gelöscht. Ein Admin kann ihn unter „Bearbeiten“ mit allen Daten löschen.
- **Knopf:** Schließen

### 11. Playoffs starten

Ort: Liga, Reiter „Playoffs“, Knopf „Playoffs starten“.

**alt:** „Playoffs starten?“ · „Die K.O.-Phase wird basierend auf der aktuellen Tabelle gestartet. Dieser Schritt kann
nicht rückgängig gemacht werden. Rückzüge von Teilnehmern sind danach nicht mehr möglich.“ · Knopf „Playoffs starten“

**neu:**

- **Titel:** Playoffs für „{Rundenwettkampf 2026}“ starten?
- **Worum:** Die Gruppenphase ist fertig. Die besten {8} von {11} aktiven Teilnehmern kommen ins {Viertelfinale}.
- **Vorher prüfen:** Stimmt die Tabelle? Die Setzung folgt genau ihren Plätzen.
- **Was dann passiert:**
  - Ringwerk legt das {Viertelfinale} an. Platz 1 trifft auf Platz {8}, Platz 2 auf Platz {7} und so weiter.
  - Zurückziehen, Rückzug zurücknehmen und Entfernen gehen in diesem Wettbewerb nicht mehr.
  - Unter „Bearbeiten“ sind die Einstellungen für Playoffs und Finale danach gesperrt.
  - Das öffentliche PDF zeigt ab jetzt die Playoffs statt des Spielplans.
  - Im Protokoll des Wettbewerbs steht danach ein Eintrag.
- **Was nicht passiert:**
  - Tabelle und Ergebnisse der Gruppenphase bleiben.
- **Rückgängig:** Nicht möglich.
- **Knopf:** Playoffs starten

### 12. Nächste Runde anlegen

Ort: Liga, Reiter „Playoffs“, Knopf „{Halbfinale} anlegen“, sobald alle Paarungen der Runde entschieden sind.

**alt:** „{Halbfinale anlegen} anlegen?“ · „Die nächste Runde wird basierend auf den aktuellen Ergebnissen angelegt.“ ·
Knopf „{Halbfinale anlegen} anlegen“ (heute steht „anlegen“ doppelt)

**neu:**

- **Titel:** {Halbfinale} anlegen?
- **Worum:** Alle Paarungen im {Viertelfinale} sind entschieden.
- **Was dann passiert:**
  - Ringwerk setzt das {Halbfinale} aus den Siegern. Der beste Platz aus der Gruppenphase trifft auf den schlechtesten.
    (Finale) Im Finale treffen die Sieger der beiden Halbfinale aufeinander.
  - Das öffentliche PDF zeigt die neue Runde.
- **Was nicht passiert:**
  - Die Ergebnisse im {Viertelfinale} bleiben.
  - Das Protokoll bekommt keinen Eintrag.
- **Rückgängig:** Nicht direkt. Ändert eine Korrektur im {Viertelfinale} einen Sieger, entfernt Ringwerk das
  {Halbfinale} wieder. Das geht nur, solange dort kein Duell angelegt ist.
- **Knopf:** {Halbfinale} anlegen

### 13. Duell in den Playoffs löschen

Ort: Liga, Reiter „Playoffs“, Papierkorb am letzten Duell einer Paarung.

**alt:** „Duell löschen?“ · „Dieses Duell wirklich löschen?“ · Knopf „Löschen“

**neu:**

- **Titel:** Duell {3} im {Halbfinale} löschen?
- **Worum:** {Anna Birke} gegen {Bert Eiche} steht {2 : 1}. Duell {3} ist das letzte dieser Paarung. (eingetragen) Sein
  Ergebnis ist eingetragen. (offen) Es ist noch offen.
- **Vorher prüfen:** (nicht im Finale) Hat das {Finale} schon ein Duell, geht das nicht. Dann zuerst dort die Duelle
  löschen.
- **Was dann passiert:**
  - Das Duell wird mit seinen Ergebnissen gelöscht. Der Stand wird aus den übrigen Duellen neu gezählt.
  - (nur wenn die Paarung entschieden ist) Die Paarung ist danach wieder offen.
  - (nur wenn entschieden, nicht im Finale) Ist das {Finale} schon angelegt, entfernt Ringwerk es. Es entsteht neu mit
    „{Finale} anlegen“.
  - Im Protokoll des Wettbewerbs steht danach, dass das Duell gelöscht wurde, mit Ringen und Teiler.
- **Was nicht passiert:**
  - Die anderen Duelle und Paarungen bleiben.
- **Rückgängig:** Nicht möglich. Das Duell lässt sich neu anlegen und eintragen. Die Werte stehen im Protokoll.
- **Knopf:** Duell löschen

### 14. Letztes Duell zurücknehmen (Best-of)

Ort: Best-of-Liga, Fenster „Duelle eintragen“, Knopf „Letztes Duell/Stechschuss zurücknehmen“.

**alt:** „Letztes Ergebnis zurücknehmen?“ · „Das zuletzt eingetragene Duell (oder der letzte Stechschuss) wird gelöscht.
Diese Aktion kann nicht rückgängig gemacht werden.“ · Knopf „Zurücknehmen“

**neu:**

- **Titel:** Duell {3} zurücknehmen? (Stechschuss) Stechschuss zurücknehmen?
- **Worum:** {Anna Birke} gegen {Bert Eiche} steht {2 : 1}. Zuletzt eingetragen ist Duell {3}. (Stechschuss) Zuletzt
  eingetragen ist der Stechschuss.
- **Vorher prüfen:** Die Ringe dieses Duells stehen danach nirgends mehr, auch nicht im Protokoll. Bei Bedarf vorher
  notieren.
- **Was dann passiert:**
  - Die beiden Serien des Duells werden gelöscht.
  - Die Paarung ist danach offen, auch wenn sie schon entschieden war. Die Tabelle rechnet ohne das Duell.
  - Im Protokoll des Wettbewerbs steht danach, dass das Duell zurückgenommen wurde.
- **Was nicht passiert:**
  - Die früheren Duelle bleiben.
- **Rückgängig:** Nicht möglich. Das Duell lässt sich neu eintragen.
- **Knopf:** Duell zurücknehmen (Stechschuss) Stechschuss zurücknehmen

### 15. Konto deaktivieren und aktivieren (Admin)

Ort: Admin, Liste der Konten, Knopf in der Zeile.

**alt:** „Nutzer deaktivieren?“ · „{Name} wird deaktiviert und kann sich nicht mehr einloggen.“ · Knopf „Deaktivieren“ —
„Nutzer aktivieren?“ · „{Name} wird wieder aktiviert.“ · Knopf „Aktivieren“

**neu, deaktivieren:**

- **Titel:** Konto von {Erika Muster} deaktivieren?
- **Worum:** {Erika Muster} meldet sich mit {erika@example.org} an.
- **Vorher prüfen:** Das eigene Konto und das letzte aktive Admin-Konto lassen sich nicht deaktivieren.
- **Was dann passiert:**
  - {Erika Muster} kann sich nicht mehr anmelden.
  - Ist {Erika Muster} gerade angemeldet, endet das beim nächsten Klick.
  - Im Protokoll unter „Admin“ steht danach ein Eintrag.
- **Was nicht passiert:**
  - Es wird nichts gelöscht. Was {Erika Muster} eingetragen hat, bleibt, auch im Protokoll.
- **Rückgängig:** Unter „Admin“ mit „Aktivieren“. Danach gilt das bisherige Passwort wieder.
- **Knopf:** Deaktivieren

**neu, aktivieren:**

- **Titel:** Konto von {Erika Muster} wieder aktivieren?
- **Worum:** Das Konto von {Erika Muster} ist deaktiviert.
- **Was dann passiert:**
  - {Erika Muster} kann sich wieder anmelden, mit dem bisherigen Passwort und der bisherigen Rolle.
  - Im Protokoll unter „Admin“ steht danach ein Eintrag.
- **Rückgängig:** Mit „Deaktivieren“.
- **Knopf:** Aktivieren

Ohne Namen steht die E-Mail-Adresse an der Stelle des Namens.

### 16. Spielplan generieren und neu generieren

Ort: Liga, Reiter „Spielplan & Tabelle“, Knopf „Spielplan generieren“ bzw. „Spielplan neu generieren“. Den Knopf gibt
es nur, solange kein Ergebnis eingetragen ist.

**alt, generieren:** „Spielplan generieren?“ · „Es wird ein Doppelrunden-Spielplan (Hin- und Rückrunde) für alle aktiven
Teilnehmer generiert.“ (Best-of: „Es wird ein Spielplan „Jeder gegen jeden“ (eine Runde) für alle aktiven Teilnehmer
generiert.“) · Knopf „Generieren“

**neu, generieren:**

- **Titel:** Spielplan generieren?
- **Worum:** Die Liga hat noch keinen Spielplan.
- **Vorher prüfen:** Sind alle eingeschrieben? Wer später dazukommt, braucht einen neuen Spielplan. Das geht nur,
  solange kein Ergebnis eingetragen ist.
- **Was dann passiert:**
  - Ringwerk erstellt Hin- und Rückrunde, jeder gegen jeden. (Best-of) Ringwerk erstellt eine Runde, jeder gegen jeden.
  - Bei ungerader Zahl hat in jeder Runde jemand ein Freilos.
  - Die Abgabefristen aus den Einstellungen stehen an den Paarungen.
  - Das öffentliche PDF zeigt den Spielplan.
- **Was nicht passiert:**
  - Zurückgezogene bekommen keine Paarungen.
  - Das Protokoll bekommt keinen Eintrag.
- **Rückgängig:** Solange kein Ergebnis eingetragen ist, mit „Spielplan neu generieren“.
- **Knopf:** Spielplan generieren

**alt, neu generieren:** „Spielplan neu generieren?“ · „Der bestehende Spielplan wird gelöscht und für alle aktiven
Teilnehmer neu erstellt. Spieltage und Gegner ändern sich dabei. Bereits verteilte oder ausgedruckte Spielpläne sind
danach veraltet.“ · Knopf „Neu generieren“

**neu, neu generieren:**

- **Titel:** Spielplan neu generieren?
- **Worum:** Die Liga hat einen Spielplan. Noch ist kein Ergebnis eingetragen.
- **Vorher prüfen:** Ist der Spielplan schon verteilt oder ausgedruckt? Dann ist er danach veraltet.
- **Was dann passiert:**
  - Der bisherige Spielplan wird gelöscht.
  - Ringwerk erstellt ihn neu für alle aktiven Teilnehmer. Spieltage und Gegner können sich dabei ändern.
- **Was nicht passiert:**
  - Einschreibungen bleiben.
  - Das Protokoll bekommt keinen Eintrag.
- **Rückgängig:** Nicht möglich. Der alte Spielplan kommt nicht zurück.
- **Knopf:** Spielplan neu generieren

### 17. Ohne Speichern verlassen

Ort: Wettbewerb anlegen und bearbeiten, wenn mit Änderungen „Abbrechen“ getippt oder die Seite verlassen wird.

**alt:** „Ungespeicherte Änderungen verwerfen?“ · „Es gibt nicht gespeicherte Änderungen. Beim Verlassen gehen sie
verloren.“ · Knopf „Verwerfen“

**neu:** wie Treffsicher (9):

- **Titel:** Ohne Speichern verlassen?
- **Worum:** Du hast hier etwas geändert und noch nicht gespeichert.
- **Was dann passiert:**
  - Deine Änderungen gehen verloren.
- **Was nicht passiert:**
  - Was vorher gespeichert war, bleibt.
- **Rückgängig:** Nicht möglich. Mit „Abbrechen“ bleibst du hier und kannst speichern.
- **Knopf:** Verwerfen

### Alte Wörter (Ringwerk)

Diese Wörter dürfen in den Dialogen nicht mehr stehen (Test): „Nutzer“, „Account“, „einloggen“, „endgültig“,
„dauerhaft“, „unwiderruflich“, „Force-Delete“, „Gefahrenzone“, „Audit“, „K.O.-Phase“, „wirklich löschen“, „Diese Aktion
kann nicht rückgängig gemacht werden“. Dazu die Grundregel: kein Semikolon, keine drei Punkte.

### Befunde beim Ablesen (nicht Teil dieses Abschnitts)

Die ersten vier sind erledigt, siehe den Abschnitt „Ringwerk: Befunde (B0)“ unten. Die gelöschte Systemdisziplin, die
beim Start wiederkommt, ist so gewollt und steht im Dialog.

- Der Kasten „Gefahrenzone“ steht auch für die Sportleitung da. Löschen darf nur ein Admin, sonst kommt „Keine
  Berechtigung“.
- Eine Disziplin, die nur in gemischten Wettbewerben Serien hat, lässt sich nicht löschen. Statt einer Meldung kommt ein
  Fehler (die Serien halten die Disziplin fest).
- Entfernen eines eingeschriebenen Teilnehmers (kein Gast) mit Ergebnissen lässt die Serien ohne Einschreibung in der
  Datenbank.
- „Nächste Runde anlegen“, „Spielplan generieren“ und „Entfernen“ schreiben keinen Eintrag ins Protokoll.
- Eine gelöschte Systemdisziplin legt Ringwerk beim nächsten Start wieder an.

---

## Ringwerk: Befunde (B0)

**Status: freigegeben am 20. Oktober 2026**

Neue und geänderte Texte zu den Befunden oben. Die Dialoge oben ändern sich nur an den genannten Zeilen, alles andere
bleibt freigegeben, wie es steht.

### Dialog 6 „Aus dem Wettbewerb entfernen“, neu

Ringwerk sperrt das Entfernen jetzt, sobald ein Mitglied (kein Gast) in diesem Wettbewerb Ergebnisse hat. Dann kommt
der Hinweis 6b. Der Dialog erscheint nur noch für Mitglieder ohne Ergebnisse und für Gäste.

- **Worum:** {Anna Birke} ist in diesem Wettbewerb eingeschrieben. (nur Gast mit Ergebnissen) Es gibt {2} Ergebnisse.
- **Vorher prüfen:** bleibt: „Steht {Anna Birke} schon im Spielplan, geht das nicht. Dann „Zurückziehen“ nutzen.“
- **Was dann passiert:**
  - bleibt: „Die Einschreibung wird gelöscht. {Anna Birke} verschwindet aus den Seiten des Wettbewerbs.“
  - bleibt: „(nur Gast) Der Gast und die Ergebnisse werden gelöscht.“
  - **entfällt:** „(nur mit Ergebnissen, kein Gast) Die {2} Ergebnisse erscheinen nicht mehr. Gelöscht werden sie
    nicht.“
  - bleibt: „(nur im Team) Ist Team {2} danach leer, wird es aufgelöst.“
  - **neu:** Im Protokoll des Wettbewerbs steht danach ein Eintrag.
- **Was nicht passiert:**
  - bleibt: „(kein Gast) {Anna Birke} bleibt unter „Teilnehmer“ und in anderen Wettbewerben.“
  - **entfällt:** „Das Protokoll bekommt keinen Eintrag.“
  - **neu (Gast):** Andere Teilnehmer und ihre Ergebnisse bleiben.

Die neue Zeile beim Gast steht da, weil „Was nicht passiert“ sonst leer wäre.

### 6b. Mitglied mit Ergebnissen entfernen (nur ein Hinweis)

- **Titel:** {Anna Birke} lässt sich nicht entfernen
- **Text:** {Anna Birke} hat in diesem Wettbewerb schon {2} Ergebnisse. Damit sie nicht verloren gehen, lässt sich
  {Anna Birke} nur zurückziehen. Dann zählen die Ergebnisse nicht mehr, bleiben aber gespeichert.
- **Knopf:** Schließen

Bei einem Ergebnis: „schon 1 Ergebnis. Damit es nicht verloren geht, …“.

**Meldung der Action** im selben Fall (falls die Liste veraltet ist): „Teilnehmer hat schon Ergebnisse und kann nicht
entfernt werden. Bitte zurückziehen.“

### Dialog 7 „Disziplin löschen“, Vorher prüfen

**alt:** „Löschen kann nur ein Admin. Wird die Disziplin in einem Wettbewerb verwendet, geht das nicht. Dann archiviere
sie.“

**neu:** Löschen kann nur ein Admin. Wird die Disziplin in einem Wettbewerb verwendet, auch nur für einzelne
Teilnehmer, geht das nicht. Dann archiviere sie.

### Dialog 12 „Nächste Runde anlegen“

- **Was dann passiert, neu:** Im Protokoll des Wettbewerbs steht danach ein Eintrag.
- **Was nicht passiert, entfällt:** „Das Protokoll bekommt keinen Eintrag.“ (Es bleibt: „Die Ergebnisse im
  {Viertelfinale} bleiben.“)

### Dialog 16 „Spielplan generieren“ und „Spielplan neu generieren“

In beiden Varianten:

- **Was dann passiert, neu:** Im Protokoll des Wettbewerbs steht danach ein Eintrag.
- **Was nicht passiert, entfällt:** „Das Protokoll bekommt keinen Eintrag.“ (Es bleibt: „Zurückgezogene bekommen keine
  Paarungen.“ bzw. „Einschreibungen bleiben.“)

### Protokoll: neue Einträge

| Ereignis | Bezeichnung | Darunter |
| --- | --- | --- |
| Spielplan erstmals erzeugt | Spielplan generiert | {30} Paarungen |
| Spielplan ersetzt | Spielplan neu generiert | {30} Paarungen |
| Runde der Playoffs angelegt | Playoff-Runde angelegt | Runde: {Halbfinale} |
| Teilnehmer entfernt | Teilnehmer aus Wettbewerb entfernt | {Anna Birke} · (nur Gast) Gast |

### Erfolgsmeldungen (unten, nach dem Bestätigen)

- Ergebnis im Event gelöscht: **Ergebnis gelöscht.**
- Serie in der Saison gelöscht: **Serie gelöscht.**
- Wettbewerb mit allen Daten gelöscht: **Wettbewerb gelöscht.** (wie schon beim Löschen aus der Liste)

### Teilnehmer mit allen Daten löschen: Meldung bei falschem Nachnamen

Ringwerk prüft den getippten Nachnamen jetzt auch auf dem Server. Stimmt er nicht (etwa weil der Name sich inzwischen
geändert hat):

**Der eingegebene Nachname stimmt nicht mit dem Teilnehmer überein.**

### Wettbewerb bearbeiten: Kasten „Wettbewerb löschen“

Den Kasten sieht nur noch ein Admin. Sein Text bleibt: „Löscht den Wettbewerb mit allem, was dazu eingetragen ist. Nur
ein Admin kann das.“

### Nachtrag aus dem Review: Meldungen bei gleichzeitiger Änderung

Ändert jemand zur selben Zeit dieselben Daten und Ringwerk kann es auch nach drei Versuchen nicht sauber zu Ende
bringen, ändert sich nichts. Statt eines Fehlers kommt beim Entfernen aus dem Wettbewerb und beim Löschen einer Disziplin
die Meldung, wie schon bei Spielplan und Playoffs:

**Die Daten wurden gleichzeitig geändert. Bitte die Seite neu laden und es noch einmal versuchen.**

Bei einem anderen Fehler: **Teilnehmer konnte nicht entfernt werden. Bitte erneut versuchen.** bzw. **Disziplin konnte
nicht gelöscht werden. Bitte erneut versuchen.**

Der Eintrag „Spielplan generiert“ zählt die Paarungen ohne Freilose.

---

## Ringwerk: Erfolgsmeldungen und Hinweis für Zurückgezogene (B9)

**Status: freigegeben am 20. Oktober 2026**

### Erfolgsmeldungen (unten, nach dem Bestätigen)

Nach jeder Aktion sagt eine kurze Meldung, dass sie geklappt hat (conventions §2). Bisher fehlt sie hinter diesen
Dialogen und Formularen:

| Aktion | Meldung |
| --- | --- |
| Teilnehmer zurückziehen (Formular mit Grund) | **Teilnehmer zurückgezogen.** |
| Rückzug zurücknehmen | **Rückzug zurückgenommen.** |
| Aus dem Wettbewerb entfernen | **Aus dem Wettbewerb entfernt.** |
| Disziplin eines Teilnehmers ändern (gemischter Wettbewerb) | **Disziplin geändert.** |
| Teilnehmer deaktivieren / aktivieren | **Teilnehmer deaktiviert.** / **Teilnehmer aktiviert.** |
| Teilnehmer löschen (auch mit allen Daten) | **Teilnehmer gelöscht.** |
| Disziplin archivieren / wiederherstellen | **Disziplin archiviert.** / **Disziplin wiederhergestellt.** |
| Disziplin löschen | **Disziplin gelöscht.** |
| Konto deaktivieren / aktivieren (Admin) | **Konto deaktiviert.** / **Konto aktiviert.** |
| Playoffs starten | **Playoffs gestartet.** |
| Nächste Runde anlegen | **{Halbfinale} angelegt.** |
| Duell in den Playoffs löschen | **Duell gelöscht.** |
| Letztes Duell zurücknehmen (Best-of) | **Duell zurückgenommen.** / **Stechschuss zurückgenommen.** |

Schon da und unverändert: „Status geändert.“, „Spielplan generiert.“ / „Spielplan neu generiert.“, „Wettbewerb
gelöscht.“, „Ergebnis gelöscht.“, „Serie gelöscht.“

### 6c. Zurückgezogenes Mitglied mit Ergebnissen entfernen (nur ein Hinweis)

Heute sieht auch ein schon zurückgezogenes Mitglied den Hinweis 6b, es lasse sich „nur zurückziehen“. Neu für diesen
Fall:

- **Titel:** {Anna Birke} lässt sich nicht entfernen
- **Text:** {Anna Birke} ist aus diesem Wettbewerb zurückgezogen und hat schon {2} Ergebnisse. Die Ergebnisse zählen
  nicht mehr, bleiben aber gespeichert. Damit sie nicht verloren gehen, bleibt {Anna Birke} als zurückgezogen
  eingetragen.
- **Knopf:** Schließen

Bei einem Ergebnis: „… und hat schon 1 Ergebnis. Das Ergebnis zählt nicht mehr, bleibt aber gespeichert. Damit es
nicht verloren geht, …“

---

## Ringwerk: Hilfe (WD0)

**Status: freigegeben am 20. Oktober 2026 (mit H1–H6)**

Die Erklärung öffnet sich über „?“ als Blatt, wie in Treffsicher und Spiegel. Felder: Titel, Kurz, Was es ist, So
liest du es, Vorsicht, dazu bei Bedarf „Formel für Profis“ (zugeklappt). Jede fachliche Aussage ist am Code geprüft
(`lib/scoring`, `lib/standings`, `lib/playoffs`, `lib/results/calculateResult.ts`, Stand `feat/design2-all-apps`,
abc9a3f2). Die Hilfe gibt es nur auf dem Bildschirm. Die PDFs bleiben, wie sie sind.

Zum Freigeben gehören diese Entscheidungen:

- **H1 Satz zur Reihenfolge auch klassisch.** Heute steht ein Satz über der Rangliste einer Saison nur bei
  abwechselnder Reihenfolge. Vorschlag: auch klassisch eine Zeile „Sortierung: {Bester Ringteiler}.“ mit „?“. Sie nennt
  die Spalte, nach der die Tabelle gerade ordnet. Sonst hat das Thema 4 keinen Platz.
- **H2 Tabelle der Liga auch klassisch.** Der Plan nennt nur die Tabelle im Best-of. Vorschlag: auch die Tabelle einer
  Liga mit Hin- und Rückrunde bekommt ihr „?“ an der Überschrift „Tabelle“ (Thema 7).
- **H3 Eigenes Thema „Finale“.** Das „?“ am Turnierbaum erklärt Setzung und Runden (Thema 8). Das Finale bekommt ein
  eigenes „?“ an seiner Überschrift unter dem Turnierbaum (Thema 9).
- **H4 Platz für das „?“ am Turnierbaum.** Über dem Turnierbaum steht neu eine Zeile „Turnierbaum“ mit „?“ rechts. Die
  Zeile mit den Rundennamen bleibt unverändert, der Abgleich aus Teil R erkennt den Turnierbaum an ihr.
- **H5 In gemischten Wettbewerben** öffnet das „?“ am Teiler das Thema 3 „Korrigierter Teiler“ statt Thema 1.
- **H6 Kein Schalter „Erklärungen“.** Anders als in Treffsicher gibt es keinen Schalter, der die Kurzsätze unter die
  Titel schreibt. Die Tabellen haben dafür keinen Platz. Der Kurzsatz dient nur dem Blatt und dem Test.

### 1. Teiler

Ort: Spaltenkopf „Best. Teiler“ in der Rangliste einer Saison und „Teiler“ in der Rangliste eines Events.

- **Titel:** Teiler
- **Kurz:** Wie nah der beste Schuss einer Serie an der Mitte liegt. Kleiner ist besser.
- **Was es ist:** Der Teiler misst den Abstand des besten Schusses einer Serie zur Mitte der Scheibe. Er steht auf dem
  Ausdruck der Serie und wird zusammen mit den Ringen eingetragen.
- **So liest du es:** Kleiner ist besser. In der Rangliste einer Saison steht der kleinste Teiler aus allen Serien. Er
  kann aus einer anderen Serie stammen als die besten Ringe.
- **Vorsicht:** Der Teiler sagt nichts über die übrigen Schüsse der Serie. Ein einziger sehr guter Schuss genügt.

### 2. Ringteiler

Ort: Spaltenkopf „Best. Ringteiler“ in der Rangliste einer Saison, „Ringteiler“ in der Rangliste eines Events (wenn
nach Ringteiler gewertet wird) und „Best. RT“ in der Tabelle einer Liga.

- **Titel:** Ringteiler
- **Kurz:** Ringe und Teiler einer Serie in einer Zahl. Kleiner ist besser.
- **Was es ist:** Der Ringteiler zählt die Ringe, die bis zur höchsten Ringzahl fehlen, und legt den Teiler dazu. Bei
  zehn Schuss ist die höchste Ringzahl 100, in Zehnteln 109.
- **So liest du es:** Kleiner ist besser. Beispiel: 96 Ringe und Teiler 35,0 ergeben 100 − 96 + 35,0 = 39,0. Ein Ring
  weniger wiegt so viel wie ein Teiler, der um 1,0 größer ist.
- **Vorsicht:** In einem gemischten Wettbewerb geht der korrigierte Teiler ein, nicht der Teiler vom Ausdruck.
- **Formel für Profis:** Ringteiler = höchste Ringzahl − Ringe + Teiler × Faktor, auf eine Stelle gerundet. Höchste
  Ringzahl bei zehn Schuss: 100, in Zehnteln 109. Faktor: der Faktor der Disziplin in gemischten Wettbewerben, sonst 1.

### 3. Korrigierter Teiler

Ort: Spaltenkopf „Best. Teiler korr.“ (Saison) und „Teiler korr.“ (Event) in gemischten Wettbewerben.

- **Titel:** Korrigierter Teiler
- **Kurz:** Der Teiler mal dem Faktor der Disziplin. So lassen sich verschiedene Disziplinen vergleichen.
- **Was es ist:** In einem gemischten Wettbewerb schießen die Teilnehmer verschiedene Disziplinen. Ihre Teiler sind
  nicht direkt vergleichbar. Ringwerk nimmt deshalb jeden Teiler mal den Faktor seiner Disziplin. Luftgewehr hat den
  Faktor 1,0. Luftpistole hat als Standard 0,333. Ein Teiler von 90 mit der Luftpistole zählt dann wie 30,0.
- **So liest du es:** Kleiner ist besser, wie beim Teiler. Die Spalte zeigt den Teiler nach der Korrektur. Der
  Ringteiler rechnet mit demselben Wert.
- **Vorsicht:** Die Korrektur gilt nur in gemischten Wettbewerben. Hat ein Wettbewerb eine feste Disziplin, zählt der
  Teiler vom Ausdruck. Den Faktor jeder Disziplin legt die Sportleitung in der App unter „Disziplinen“ fest.
- **Formel für Profis:** korrigierter Teiler = Teiler × Faktor der Disziplin.

### 4. Reihenfolge der Rangliste (klassisch)

Ort: Rangliste einer Saison, neue Zeile über der Tabelle „Sortierung: {Bester Ringteiler}.“ (H1). Der Wert in
geschweiften Klammern ist die Spalte, nach der gerade geordnet ist: Beste Ringe, Bester Teiler oder Bester Ringteiler.

- **Titel:** Reihenfolge der Rangliste
- **Kurz:** Die Rangliste ordnet nach einem Bestwert. Bei Gleichstand entscheidet der Ringteiler.
- **Was es ist:** Jeder Teilnehmer hat drei Bestwerte, jeder aus einer einzelnen Serie: die meisten Ringe, den
  kleinsten Teiler und den kleinsten Ringteiler. Die Rangliste ordnet nach einem davon. Welcher es ist, legt der
  Wettbewerb fest. Ein Tipp auf einen anderen Spaltenkopf ordnet nach dieser Spalte.
- **So liest du es:** Oben stehen alle, die genug Serien haben. Darunter stehen grau alle, denen noch Serien fehlen.
  Wie viele Serien es braucht, steht oben bei „Mindest“. Ganz unten stehen alle ohne Serie. Bei gleichem Wert
  entscheidet der kleinere Ringteiler. Ist auch der gleich, teilen sich beide den Platz. Die kleinen Plätze an den
  Werten zeigen die Plätze 1 bis 3 jeder Spalte unter denen mit genug Serien.
- **Vorsicht:** Das PDF ordnet immer nach der Spalte, die der Wettbewerb festlegt. Ein Tipp auf einen Spaltenkopf
  ändert nur die Ansicht auf dem Bildschirm.

### 5. Abwechselnde Reihenfolge

Ort: Satz über der Rangliste einer Saison „Sortierung: Ringe/Teiler alternierend — hervorgehoben ist der Wert, der den
Platz ergeben hat.“, mit „?“ am Ende. Der Satz selbst bleibt.

- **Titel:** Abwechselnde Reihenfolge
- **Kurz:** Die Plätze gehen abwechselnd nach den besten Ringen und nach dem besten Teiler.
- **Was es ist:** Platz 1 bekommt, wer die meisten Ringe hat. Platz 2 bekommt, wer unter den übrigen den kleinsten
  Teiler hat. Platz 3 geht wieder nach Ringen, Platz 4 nach dem Teiler, und so weiter. Bei „Teiler/Ringe“ beginnt der
  Teiler. Jeder Teilnehmer steht nur einmal in der Liste.
- **So liest du es:** Hervorgehoben ist der Wert, der den Platz gebracht hat. Der andere ist zurückgenommen. Der
  Ringteiler steht nur zur Information da. Erst kommen alle mit genug Serien, dann die übrigen, beide Gruppen
  abwechselnd. Ganz unten stehen alle ohne Serie. Bei gleichem Wert entscheidet der Name.
- **Vorsicht:** Die Spaltenköpfe ordnen hier nicht um. Die Reihenfolge ist die Wertung.

### 6. Tabelle im Best-of

Ort: Überschrift „Tabelle“ über der Tabelle einer Liga im Format Best-of, „?“ rechts.

- **Titel:** Tabelle im Best-of
- **Kurz:** Siege zählen zuerst. Bei Gleichstand entscheiden die Sätze, dann der direkte Vergleich.
- **Was es ist:** Jede Begegnung besteht aus mehreren Duellen, den Sätzen. Einen Satz gewinnt, wer in der Wertung des
  Wettbewerbs besser ist, zum Beispiel mit dem kleineren Ringteiler. Ist ein Satz auch nach den Stichkriterien gleich,
  zählt er für keinen. Wer mehr Sätze gewinnt, gewinnt die Begegnung. Steht es nach allen Sätzen gleich, entscheidet
  ein Stechschuss: ein Schuss in Zehnteln, der höhere Wert gewinnt. Die gleichen Sätze zählen dann für den Sieger.
- **So liest du es:** Die Tabelle ordnet nach Siegen, dann nach der Satzdifferenz, dann nach den gewonnenen Sätzen.
  Stehen danach zwei oder mehr gleich, entscheidet der direkte Vergleich: ihre Begegnungen untereinander. Die letzte
  Spalte zeigt ihn. Bei zweien steht dort das Ergebnis ihrer Begegnung und der Gegner. Bei dreien oder mehr steht ihre
  Bilanz untereinander. „offen“ heißt: Eine Begegnung untereinander fehlt noch. „ausgeglichen“ heißt: Alle haben
  untereinander dieselbe Bilanz, etwa weil jeder einmal gewonnen hat. In beiden Fällen ordnet der Name. Wer nur noch
  am Namen hängt, teilt sich den Platz.
- **Vorsicht:** Begegnungen mit einem zurückgezogenen Teilnehmer zählen für niemanden. Zurückgezogene stehen
  durchgestrichen am Ende.

### 7. Tabelle der Liga (H2)

Ort: Überschrift „Tabelle“ über der Tabelle einer Liga mit Hin- und Rückrunde, „?“ rechts.

- **Titel:** Tabelle der Liga
- **Kurz:** Punkte zählen zuerst. Bei Gleichstand entscheiden der direkte Vergleich und dann der beste Ringteiler.
- **Was es ist:** Jede Paarung ist ein Duell über eine Serie. Ein Sieg bringt 2 Punkte, ein Unentschieden 1 Punkt, eine
  Niederlage keinen. Ein Freilos zählt wie ein Sieg. Wer das Duell gewinnt, hängt von der Wertung ab. Beim Ringteiler
  gewinnt der kleinere, bei Gleichstand gewinnen mehr Ringe, dann der kleinere Teiler. Bei Ringen gewinnen mehr Ringe,
  dann der kleinere Teiler. Beim Teiler gewinnt der kleinere Teiler, dann mehr Ringe.
- **So liest du es:** „Sp.“ sind gespielte Duelle. „S“, „U“ und „N“ sind Siege, Unentschieden und Niederlagen. Bei
  gleichen Punkten zählen zuerst die Punkte aus den Duellen dieser Teilnehmer untereinander. Dann zählt der beste
  Ringteiler aus allen Duellen, bei Wertung nach Ringen die meisten Ringe. Ist auch das gleich, teilen sich beide den
  Platz.
- **Vorsicht:** Paarungen mit einem zurückgezogenen Teilnehmer zählen nicht. Zurückgezogene stehen durchgestrichen am
  Ende.

### 8. Playoffs (Setzung und Runden)

Ort: neue Zeile „Turnierbaum“ über dem Turnierbaum auf der Seite „Playoffs“, „?“ rechts (H4).

- **Titel:** Playoffs
- **Kurz:** Die Besten der Gruppenphase spielen gegeneinander. Wer ein Match verliert, scheidet aus.
- **Was es ist:** Die Playoffs beginnen, wenn alle Paarungen der Gruppenphase gespielt sind. Je nach Wettbewerb kommen
  die besten 16 ins Achtelfinale, die besten 8 ins Viertelfinale oder die besten 4 ins Halbfinale. Zurückgezogene
  zählen nicht mit. Gesetzt wird nach der Tabelle der Gruppenphase. Der Erste trifft auf den Letzten der
  Qualifizierten, der Zweite auf den Vorletzten, und so weiter. Teilen sich zwei einen Platz, zählt die Reihenfolge,
  in der die Tabelle sie zeigt.
- **So liest du es:** Ein Match gewinnt, wer zuerst genug Duelle gewinnt. Bei Best-of-5 sind das 3. Die Zahlen auf der
  Karte sind die gewonnenen Duelle. Ein Duell gewinnt der kleinere Ringteiler. Bei Gleichstand gewinnen mehr Ringe,
  dann der kleinere Teiler. Ist auch das gleich, zählt das Duell für keinen, und ein weiteres folgt. Für jede neue
  Runde setzt Ringwerk neu: Der Beste der Verbliebenen nach der Tabelle der Gruppenphase trifft auf den Schwächsten.
- **Vorsicht:** Die Paarungen einer Runde stehen erst fest, wenn die Runde davor fertig ist. Die Namen, die der
  Turnierbaum vorher in den leeren Feldern zeigt, sind nur eine Vorschau. Die neue Setzung kann anders ausfallen.

### 9. Finale (H3)

Ort: Überschrift „Finale“ unter dem Turnierbaum, „?“ rechts.

- **Titel:** Finale
- **Kurz:** Ein Duell entscheidet. Bei Gleichstand zählen die Stichkriterien, dann folgt die Verlängerung.
- **Was es ist:** Im Finale schießen beide eine Serie. Es zählt zuerst das Hauptkriterium des Wettbewerbs, als Standard
  die Ringe. Ist es gleich, entscheidet das erste Stichkriterium, dann das zweite. Beides legt der Wettbewerb fest. Die
  Karte des Finales nennt sie: „Primär“ ist das Hauptkriterium, „TB“ ein Stichkriterium.
- **So liest du es:** Steht es nach allen Kriterien gleich, folgt die Verlängerung: ein weiteres Duell nach denselben
  Regeln. Das geht so weiter, bis ein Duell entscheidet. Wer es gewinnt, hat das Finale gewonnen.
- **Vorsicht:** Die Verlängerung gibt es, wenn der Wettbewerb sie vorsieht. Das ist der Standard.

---

## Ringwerk: „–“ mit Grund (WD3)

**Status: freigegeben am 20. Oktober 2026 (mit H1–H6)**

Wo heute ein Strich ohne Erklärung steht, steht künftig „–“ und daneben leise der Grund, wie in Treffsicher. Wo eine
Zelle dafür zu schmal ist, steht der Grund als Tooltip und für Screenreader. Nur auf dem Bildschirm. Die PDFs zeigen
weiter, was sie heute zeigen. Die Gründe enthalten keine Zahlen und keine Wörter, die der Abgleich aus Teil R als Daten
liest (etwa „offen“, „Freilos“, „Zurückgezogen“, „Finale“). So bleibt die Datenfolge jeder Seite gleich.

| Ort                                                                        | alt            | neu: Grund                                   |
| -------------------------------------------------------------------------- | -------------- | -------------------------------------------- |
| Rangliste einer Saison, Teilnehmer ohne Serie, Spalte „Beste Ringe“        | „–“            | noch keine Serie                             |
| dieselbe Zeile, Spalten Teiler und Ringteiler                              | „–“            | „–“, Grund als Tooltip (E-W1)                |
| Tabelle der Liga, „Best. RT“ ohne gespieltes Duell                          | „–“            | noch kein Duell                              |
| Tabelle der Liga und im Best-of, Platz eines Zurückgezogenen               | „—“            | „–“, Grund „ohne Platz“ als Tooltip (E-W2)   |
| Tabelle im Best-of, Direktvergleich, wenn ihn niemand braucht              | „—“            | nicht nötig                                  |
| Spielplan mit Hin- und Rückrunde, Gegner bei einem Freilos                 | „—“            | kein Gegner                                  |
| Spielplan mit Hin- und Rückrunde, Paarung mit einem Zurückgezogenen        | „—“            | nicht gewertet                               |
| Spielplan im Best-of, Gegner bei einem Freilos                             | „—“            | kein Gegner                                  |
| Spielplan, Paarung ohne Ergebnis (Uhr)                                     | Uhr ohne Text  | Uhr, Grund „noch kein Ergebnis“ als Tooltip  |
| Liste der Wettbewerbe, Liga ohne Stichtag für Hin- oder Rückrunde          | „—“            | „–“, Grund „kein Stichtag“ als Tooltip       |

- **E-W1 Ein Grund je Zeile.** In der Rangliste einer Saison fehlen bei einem Teilnehmer ohne Serie alle drei Werte. Der
  Grund steht sichtbar nur einmal, bei den Ringen. Am Telefon passen sonst die zwei Zahlenspalten nicht.
- **E-W2 Zurückgezogene.** Der Name trägt schon „(Zurückgezogen)“. Der Platz zeigt deshalb nur „–“ mit dem Grund als
  Tooltip.
- **E-W3 Was bleibt:** Der Strich in den leeren Feldern des Turnierbaums („—“ in der Vorschau) bleibt. Der Abgleich prüft
  den Aufbau des Turnierbaums Zeichen für Zeichen. Er bekommt nur den Grund „steht noch nicht fest“ als Tooltip. Die
  Ringteiler im Spielplan (`RT`), im Duell und im Event haben immer einen Wert, dort ändert sich nichts.

---

## Ringwerk: Befunde beim Ablesen für WD0 (nicht Teil dieses Abschnitts)

Beim Prüfen am Code aufgefallen. Keiner davon ändert sich mit der Hilfe. Die Texte oben beschreiben, was Ringwerk heute
rechnet, und meiden die Fälle, in denen es anders zeigt als rechnet.

- **Finale: angezeigter Sieger eines Duells.** Die Karte des Finales markiert den Sieger eines Duells nur nach Ringen
  (`lib/playoffs/queries.ts`, `determineFinaleRoundWinner` ohne Hauptkriterium und Stichkriterien). Gewertet wird nach
  Hauptkriterium und Stichkriterien. Bei gleichen Ringen und Entscheid über ein Stichkriterium zeigt die Zeile
  „Unentschieden“, das Match zählt aber einen Sieger. Ebenso bei einem Hauptkriterium außer Ringen.
- **Finale ohne Verlängerung.** Die Karte sagt immer „bei Gleichstand Verlängerung“, auch wenn der Wettbewerb sie
  ausschaltet. Steht es dann gleich, bleibt das Finale offen, und die Oberfläche bietet kein weiteres Duell an.
- **Teiler in gemischten Ligen und Playoffs.** Liga-Duelle mit Hin- und Rückrunde, Playoff-Duelle und das Finale
  vergleichen beim Teiler den Teiler vom Ausdruck, nicht den korrigierten (`determineOutcome`,
  `determinePlayoffDuelWinner`, Kriterium „Teiler“ im Finale). Im Best-of und in der Saison zählt der korrigierte. Das
  betrifft gemischte Wettbewerbe mit Wertung nach Teiler und den Teiler als Stichkriterium.
- **Höchste Ringzahl in Duellen.** Liga, Best-of und Playoffs rechnen den Ringteiler immer mit 100 oder 109
  (`MAX_RINGS`), Saison und Event mit 10 oder 10,9 je Schuss. Bei zehn Schuss ist das gleich. Bei einer anderen
  Schusszahl in einem gemischten Wettbewerb mit ganzen Ringen und Zehnteln verschiebt es den Vergleich.
- **Faktor nachträglich geändert.** Der Faktor einer Disziplin lässt sich jederzeit ändern. Eingetragene Ringteiler
  behalten den alten Faktor, der korrigierte Teiler der Saison rechnet mit dem neuen.
- **„Gleichstand per Stechschuss“ im Best-of.** Das Häkchen wird gespeichert, wirkt aber nicht. Ein Gleichstand geht
  immer in den Stechschuss, ein Wiederholungsduell gibt es nicht.
- **„Best. RT“ bei Wertung nach Ringen.** Die Tabelle der Liga zeigt immer den besten Ringteiler. Bei Wertung nach
  Ringen entscheiden aber die meisten Ringe den Gleichstand, und die zeigt sie nicht.
