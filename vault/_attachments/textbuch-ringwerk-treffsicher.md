# Textbuch Ringwerk und Treffsicher

Neue Texte stehen hier zuerst, als „alt → neu“. Ein Mensch liest sie und gibt sie frei. Erst danach kommen sie in den
Code. Die Schreibregeln stehen in `vault/conventions.md` §10 („So schreiben wir“).

Zeichen: `{…}` ist ein Wert, den die App einsetzt. „(nur wenn …)“ heißt, die Zeile erscheint nur in diesem Fall.

Jeder Dialog hat dieselben Teile: Titel, Worum es geht, Vorher prüfen (nur wenn es etwas zu prüfen gibt), Was dann
passiert, Was nicht passiert, Rückgängig, Knopf. Daneben steht immer „Abbrechen“.

---

## Treffsicher: Folgen vor dem Bestätigen (TC0)

**Status: Entwurf, wartet auf Freigabe**

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

**Status: Entwurf, wartet auf Freigabe**

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

**Status: Entwurf, wartet auf Freigabe**

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
