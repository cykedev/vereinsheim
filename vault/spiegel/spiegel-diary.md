---
id: spiegel-diary
type: subsystem
title: "Spiegel — Tagebuch: Einträge, Fragen und Stellen"
aliases: [tagebuch, diary, treffsicher-2-0, trainingstagebuch-in-spiegel]
keywords: [saisonziel, ziele, ziel, messung, scheibe ab, serie ab, schnitt ab, saison, hat es geklappt, schuss-ablauf, abläufe, ablauf, ohne disziplin, disziplin festlegen, tagebuch, eintrag, einträge, vorhaben, notiz, befinden, prognose, feedback, ausführung je serie, stufen, fünf stufen, 0 bis 100, faden, fragen, lernfrage, wie schaffe ich es, ich habe gelernt, hat es geklappt, was hat gestört, vorschlag, neuer eintrag, ohne scheibe, trockentraining, mentaltraining, dazugekommen, lösen, dazunehmen, vom selben abend, papierkorb, abschaltbar, hinweis, nur du siehst, zonen, grenze, nahtstellen, parts, results-read, partline, export, konto löschen, deine daten, stufe 2, 2a, treffsicher]
part_of: ["[[spiegel]]"]
governed_by: ["[[adr-033]]", "[[adr-030]]", "[[adr-029]]"]
relates_to: ["[[spiegel-navigation]]", "[[spiegel-privacy]]", "[[spiegel-data-model]]", "[[spiegel-db-schema]]", "[[spiegel-roadmap]]", "[[spiegel-account-transfer]]"]
---

**TL;DR** Das Tagebuch ist der zweite Teil von Spiegel ([[adr-033]]) und Treffsicher 2.0: was in Treffsicher genutzt
wurde, wird besser, was kaum genutzt wurde, wird einfacher oder fällt weg. Ein Eintrag gehört zu einem Abend und einer
Disziplin, mit Vorhaben, Notiz, Vorher, Nachher und den eigenen Fragen über die Zeit (Reiter „Fragen“). Das Tagebuch ist je Konto
abschaltbar, liest Scheiben nur über eine schmale Schnittstelle und erscheint im Ergebnisteil nur an festen Stellen.
Gebaut in Teil 2a (28. Oktober 2026) mit Export und Konto löschen über beide Teile; in 2b Ziele, die Spiegel misst,
ohne zu urteilen, und Schuss-Abläufe in einem eigenen Reiter.

# Spiegel — Tagebuch

## Treffsicher 2.0

Grundlage sind die Zählungen in der Prod-Kopie von Treffsicher (265 Einheiten in sechs Konten), nur als Zahlen:

- Die Absicht ist das meistgenutzte Textfeld (51). Sie wird zum **Vorhaben**, der ersten Zeile und dem Titel in der
  Liste.
- Beobachtung, Erkenntnis und Lernfrage werden zusammen genutzt (24, vier Konten) und bauen über Monate aufeinander
  auf. Daraus werden die **Notiz** (immer sichtbar), zwei Satzanfänge unter Nachher („Ich habe gelernt, dass …“, „Wie
  schaffe ich es, …?“) und der Reiter **Fragen** (im Code der Faden, `thread`).
- Befinden (39) füllen fast nur zwei Konten, Prognose (14) und Feedback (21) fast nur bei Wettkämpfen, Ausführung je
  Serie bei 180 von 1037 Serien. Sie bleiben als **Abschnitte**, die leer nur eine Zeile mit „+“ sind.
- Jedes übrige Textfeld kam höchstens 18-mal vor. Es geht in der Notiz auf (Übernahme in Stufe 3).
- Ziele (10 in 4 Konten, 8 Ergebnisziele, 7 mit einer Ringzahl im Titel, keines geändert) werden **gemessen**: Spiegel
  zählt, was die alten Titel nur sagten. Einheiten an Ziele anhaken fällt weg.
- Abläufe (4 in 2 Konten, nie geändert) sind Lesetext: Sie stehen im Reiter **Abläufe** unter ihrer Disziplin und
  werden als ein Textfeld bearbeitet. „Fragen“ bleibt eine Zeitleiste.
- Anhänge (69 an 56 Einheiten, jede mit Ergebnissen) bekommt das Tagebuch nicht: Sie werden Ausdruck oder Beleg der
  Scheibe (Teil 1f, Stufe 3).

## Zahlen und Stufen

Befinden, Prognose, Feedback und Ausführung je Serie liegen auf **0 bis 100** (`DiaryScale`, `DiarySeriesExecution`).
Die Oberfläche zeigt immer fünf Stufen aus Bereichen (0–19 → 1, 20–39 → 2, 40–59 → 3, 60–79 → 4, 80–100 → 5). Ein
Tipp speichert die Mitte der Stufe (10, 30, 50, 70, 90), ein Tipp auf die gezeigte Stufe nimmt den Wert weg, dieselbe
Stufe behält einen genauen Wert. Übernommene Werte bleiben genau. Welche Aspekte zu einem Abschnitt gehören, steht fest
in `SCALE_ASPECTS` (`src/diary/scales.ts`, Test je Abschnitt).

## Drei Zonen im Code

| Zone         | Ordner                                        | darf importieren                                                                                                                                                                             |
| ------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tagebuch     | `src/diary/**`, `src/app/(app)/diary/**`      | Pakete, aus dem Ergebnisteil nur `results-read`, `auth-helpers`, `action-guards`, `db`, `types`, `page-context`, den generierten Client, `components/shell/` und `components/card/ActionRow` |
| Nahtstellen  | `src/parts/**`, `src/instrumentation-node.ts` | beide Teile                                                                                                                                                                                  |
| Ergebnisteil | alles übrige, dazu `packages/shot-*`          | nie das Tagebuch, nur `@/parts/*` als Stelle                                                                                                                                                 |

- Das Gate ist ein Test in `pnpm check` (`src/parts/boundary.test.ts`): Importe nach der Tabelle, kein Zugriff des
  Tagebuchs auf ein Modell des Ergebnisteils über Prisma, kein Import von Nahtstellen oder Tagebuch im Admin.
- `src/lib/results-read.ts` ist die schmale Schnittstelle: Scheiben eines Kontos mit Abend, Familie, Art, Herkunft,
  Ergebnis und Schusszahl (`resultCards`), Serien (`resultCardSeries`), Lagen (`resultMarks`) und Familien.
- Die Tabellen des Tagebuchs haben keinen Fremdschlüssel auf den Ergebnisteil (`cardId`, `familyId` sind Werte). Nur
  `User` trägt Relationen, damit Konto löschen kaskadiert ([[spiegel-db-schema]]).
- **Stellen:** Der Ergebnisteil bekommt aus `src/parts/` allgemeine Zeilen (`PartLine`: Titel, Zustand, Ziel, Aktion)
  oder fertige Kästen und weiß nicht, woher sie kommen. Ist das Tagebuch aus, kommt nichts.

## Seiten

Alle in einer Spalte (`PAGE_SINGLE`), Bereich „Tagebuch“ mit `BookOpen` ([[spiegel-navigation]]).

- **`/diary`:** Kopf mit „Neuer Eintrag“ und den Reitern (unten), Einträge neueste oben nach Monat. Eine Karte
  ist ganz der Link; Titel ist das Vorhaben, sonst die Disziplin. Beim ersten Öffnen steht darüber der Hinweis „Nur du
  siehst dein Tagebuch“ bis „Verstanden“.
- **`/diary/thread` (Fragen):** je Disziplin die Einträge mit Frage als Zeitstrahl, neueste oben, die Disziplin mit der
  jüngsten Frage vorgewählt; darunter je Punkt „Ich habe gelernt, dass …“.
- **`/diary/new`:** oben „Heute“ (Tag vorbelegt und änderbar, Art, Disziplin, ein Knopf „Anlegen“), der Weg für
  Vorhaben und Prognose vor dem Training; die Scheiben des Tages kommen von selbst dazu. Darunter „Abende ohne Eintrag“
  als Karten, die ganz anlegen: jeder Abend, egal wie alt (kein Zeitfenster, dieselbe Regel wie an der Scheibe), neueste
  zuerst, die ersten fünf, die übrigen hinter „Ältere Abende zeigen“ nach Monat. `?card=<id>` hebt den Abend dieser
  Scheibe hervor (liegt er weiter hinten, ist alles offen) oder leitet in ihren Eintrag.
- **`/diary/[id]`:** Rückweg, Tag, „Disziplin · Art“, die Scheiben wie in der Scheibenliste (kleine Scheibe, Uhrzeit,
  Ringe, die Zeile führt zur Scheibe) mit leisem „Scheiben ändern“, darunter Vorhaben und Notiz in einem Kasten, Vorher
  (die letzte Frage derselben Disziplin mit „Als Vorhaben nehmen“, nur solange das Vorhaben leer ist; Befinden,
  Prognose mit erwartetem Ergebnis), Nachher
  („Hat es geklappt?“ mit Vorhaben oder gespeicherter Antwort, die Satzanfänge, „Was hat gestört?“, Feedback mit der
  Prognose gestrichelt, Ausführung je Serie als Block je Scheibe mit eingerückten Serien), am Ende „Dieser Eintrag“
  (Tag, Art und Disziplin nur ohne Scheiben änderbar, Löschen).
- **Liste:** bis zu fünf kleine Scheiben je Eintrag, darüber „+N“.
- **Feste Regel der Abschnitte:** leer eine Zeile mit „+“, gefüllt offen mit „{Abschnitt} leeren“ (Rückfrage). Die Seite hängt
  nicht davon ab, was jemand bisher genutzt hat (Konsistenz als Grundsatz, [[adr-035]]).
- Texte sind gesteuerte Felder mit „Speichern“ und „Verwerfen“; wer mit Ungespeichertem geht, wird gefragt.

- **Reiter** „Einträge · Fragen · Ziele · Abläufe“ (`DiaryHeader`), am Telefon in einer Zeile bis 360 px; der Knopf oben
  folgt dem Reiter („Neuer Eintrag“, „Neues Ziel“, „Neuer Ablauf“).
- **`/diary/goals` (Ziele):** dritter Reiter, Knopf „Neues Ziel“; Gruppen Laufend, Kommend, Vorbei; je Karte Satz,
  Disziplin und Ende, der Stand in einer Zeile und der Zustand (die Antwort, sonst läuft, beginnt am …, vorbei).
- **`/diary/goals/[id]`:** für jedes Ziel dieselbe Folge: Stand, Notiz, „Hat es geklappt?“, Einträge im Zeitraum,
  „Dieses Ziel“ (Ändern, Löschen). „Stand“ zeigt mit Messung die große Zahl, die letzten zehn, das Beste, den Schnitt,
  den Verlauf mit der Linie des Ziels (Treffer in Gold), die Grundlage (nur wenn etwas nicht zählt) und „Im Fortschritt
  ansehen“ (freier Zeitraum, Disziplin, Art). Ohne Disziplin „Disziplin festlegen“, ein Ergebnisziel ohne Messung
  „Messung festlegen“, ein Prozessziel nur einen Satz. Die Einträge im Zeitraum sind die der Disziplin (ohne Disziplin
  alle), die ersten fünf, dann „Alle n Einträge zeigen“.
- **`/diary/goals/new`, `/diary/goals/[id]/edit` (`GoalForm`):** Satz, Ergebnis- oder Prozessziel, Disziplin (abwählbar),
  Zeitraum (laufende oder nächste Saison vom 1. September bis 31. August, oder frei), beim Ergebnisziel „Spiegel misst
  mit“: Scheibe, Serie oder Schnitt ab einer Ringzahl, Wertung und Schusszahl als eine Zeile mit „Ändern“ (vorbelegt
  aus `resultGoalDefaults`), welche Scheiben; darunter die Vorschau (`previewGoalAction`, 300 ms nach der letzten
  Änderung). Klebende Leiste, Wächter beim Verlassen.
- **`/diary/routines` (Abläufe):** vierter Reiter, Knopf „Neuer Ablauf“; je Disziplin eine Gruppe nach Name,
  „Ohne Disziplin“ zuletzt (auch eine Disziplin, die es für das Konto nicht mehr gibt, `routineGroups`); je Karte Name
  und Zahl der Schritte. Die Rückwege von einem Ablauf führen hierher (`ROUTINES_PATH` in `src/diary/paths.ts`). Der
  Reiter „Fragen“ zeigt keine Abläufe. In der Oberfläche heißt der Faden „Fragen“; Adresse und Namen im Code bleiben
  `thread`.
- **`/diary/routines/[id]`:** Leseseite mit nummerierten Schritten in weichen Kreisen, „Dieser Ablauf“ (Bearbeiten,
  Disziplin ändern oder festlegen an Ort und Stelle, Löschen). **`/diary/routines/new`, `…/[id]/edit`:** Name, bei neu die
  Disziplin, die Schritte als ein Textfeld (Absatz = Schritt, erste Zeile = Titel, `textToSteps`/`stepsToText`), der
  Hinweis zählt die Schritte.

## Ziele: messen, nicht urteilen

- Modell `DiaryGoal`: Satz, Notiz, Art (`result`, `process`), `familyId` (null ohne Disziplin), Zeitraum (`from`, `to`,
  Tage), die Messung ganz oder gar nicht (`measure`, `threshold`, `scoring`, `shots`; dazu `cards`), Antwort, Papierkorb.
- Die Messung ist rein (`measureGoal` in `src/diary/goals/measure.ts`): Eine Scheibe zählt im Zeitraum (Abend) und in
  der Art, nicht nur Probe; bei Scheibe und Schnitt mit genau der Schusszahl und einem Wert in der Wertung, bei Serie
  jede Serie mit der Schusszahl. Was nicht zählt, nennt die Grundlage (ohne Ergebnis, andere Schusszahl, ohne Serien;
  `series` null vor Projektion 7 gilt als ohne Serien). Ein Wert in Zehnteln wird vor dem Vergleich auf eine Stelle
  gerundet. Spiegel urteilt nicht, die Zahlen stehen neben „Hat es geklappt?“.
- Gelesen über `resultGoalCards` und `resultGoalDefaults` (`src/lib/results-read.ts`), Serien aus der Projektion.
- Start: je Block nach der Zeile des Eintrags die des zuletzt angelegten laufenden Ziels mit Messung
  (`startLines` gibt je Block eine Liste, `StartScreen` zeigt Titel, Zustand, Aktion): „Ziel ab 350 · 6 von 20
  Scheiben ›“, „Ziel ab 91 · 31 von 56 Serien ›“, beim Schnitt „Ziel Schnitt 350 · bisher 347,2 ›“.

## Scheiben vom selben Abend

Abgeleitet beim Lesen, nie beim Laden geschrieben (`entryCards` in `src/diary/cards.ts`, reine Funktion), nach dem
Schusstag der Scheibe, nicht nach ihrem Eingang. Gibt es an einem Tag genau einen Eintrag einer Disziplin, der nicht im
Papierkorb liegt, gehört jede Scheibe dieses Abends und dieser Disziplin ohne Zeile in `DiaryEntryCard` dazu. Eine
Zeile `linked` hält eine Scheibe fest (Anlegen aus einem Abend, Anhaken), `released` hält sie aus jedem Eintrag heraus
(Abhaken), bis sie von Hand dazukommt. Bei mehreren Einträgen der Disziplin am Tag wird jede Scheibe ohne Zeile nur
angeboten. Eine gelöschte Scheibe steht als „Scheibe gelöscht“. Das Einlesen bleibt frei vom Tagebuch.

- **Scheiben ändern:** ein Blatt mit allen Scheiben dieses Tages und dieser Disziplin zum An- und Abhaken; eine, die in
  einem anderen Eintrag steckt, mit dessen Titel und ohne Haken. Wer bewertete Serien abhakt, wird erst gefragt („Scheibe aus dem Eintrag nehmen?“). In der Oberfläche heißt Lösen
  „herausnehmen“, Verknüpfen „anhaken“.
- **Papierkorb:** Ein Eintrag im Papierkorb hält keine Scheibe fest (`activeLinks`), auch keine von Hand verknüpfte.
  Seine Zeilen bleiben gespeichert, bis eine andere Zuordnung sie ersetzt (Primärschlüssel `cardId`). Beim
  Wiederherstellen (`restoreEntry`) bekommt, was ein anderer Eintrag des Abends inzwischen von selbst trägt, eine feste
  Zeile dort; zurück kommen nur die Scheiben, die in keinem anderen Eintrag stecken.

## Stellen im Ergebnisteil

- Seite einer Scheibe, Kasten „Diese Scheibe“, ganz oben die Zeile „Tagebuch“ (`cardLines`, Ort aus `cardPlace`): im
  Eintrag „Im Eintrag vom Fr 13.03.“ mit „Eintrag öffnen“; nur angeboten „Noch in keinem Eintrag. Im Eintrag vom …
  unter „Scheiben ändern“ anhaken.“ mit „Eintrag öffnen“; sonst „Noch in keinem Eintrag.“ mit „Eintrag anlegen“, das den Eintrag direkt
  anlegt und öffnet (`PartLine.run`, eine Server Action; `PartLineAction` zeigt dann einen Knopf). Die geteilte Seite
  zeigt keine.
- Start, je Block neben „Abend in Scheiben ›“: „Tagebuch · Eintrag öffnen ›“ oder „… anlegen ›“ (`startLines`, anlegen
  ebenso direkt).
- Profil: Kasten „Tagebuch“ mit Ein- und Ausschalten; ist es an, am Telefon „Alle Scheiben“, weil die Liste der
  Scheiben dann nicht in der Leiste steht. Papierkorb: „Einträge im Tagebuch“.

## Abschaltbar, Papierkorb, Datenschutz

- `DiarySettings.enabled`, für neue Konten aus. Aus heißt: kein Bereich, keine Stellen, `/diary` führt ins Profil. Die
  Einträge bleiben.
- Ziele und Abläufe liegen gelöscht ebenso 30 Tage im Papierkorb (Abschnitt „Im Tagebuch“), `purgeExpiredDiaryTrash`
  löscht alle drei.
- Löschen legt einen Eintrag 30 Tage in den Papierkorb („Eintrag gelöscht · Rückgängig“), danach löscht `diaryJobs`
  ihn beim Start und stündlich endgültig. Im Papierkorb steht er nirgends sonst, auch nicht unter „Fragen“, und
  seine Scheiben sind frei (oben „Papierkorb“).
- Nur der Schütze sieht sein Tagebuch, auch kein Admin ([[spiegel-privacy]]).

## Deine Daten

Kasten „Deine Daten“ im Profil, über beide Teile (`src/parts/account.ts`):

- **Herunterladen:** `GET /api/account/export`, eine JSON-Datei als Strom (je 200 Scheiben eine Abfrage) mit `account`,
  `results` (alle eigenen Scheiben samt Papierkorb mit aktueller Revision, Summen und Schüssen, Angaben zu Ausdrucken
  und Belegen ohne Dateien, Zustimmungen, Zeiträume, Wertungen) und `diary` (Einstellung, alle Einträge mit allen
  Werten). Nur mit eigener Sitzung, `private, no-store`.
- **Konto löschen:** mit dem Passwort (`deleteOwnAccount`). Das einzige aktive Admin-Konto bekommt einen Hinweis statt
  einer Rückfrage. In einer Transaktion: Zustimmungen weg, alle eigenen Scheiben über `purgeCards`, dann die
  Kontozeile; die Kaskade nimmt Tagebuch, Zeiträume, Wertungen, Aufträge und Sperren mit. Meldungen „nicht meine“
  bleiben ohne Konto. Danach räumt `sweepUploadsSoon` die Dateien auf.

## Was folgt

Einflüsse und Selbstbild in 2c, mehrere Belege je Scheibe in 1f, die Übernahme von Einträgen, Zielen und Abläufen aus
Treffsicher in Stufe 3 (`importKey`, [[spiegel-account-transfer]]).
