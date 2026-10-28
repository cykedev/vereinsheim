---
id: spiegel-diary
type: subsystem
title: "Spiegel — Tagebuch: Einträge, Faden und Stellen"
aliases: [tagebuch, diary, treffsicher-2-0, trainingstagebuch-in-spiegel]
keywords:
  [
    tagebuch,
    eintrag,
    einträge,
    vorhaben,
    notiz,
    befinden,
    prognose,
    feedback,
    ausführung je serie,
    stufen,
    fünf stufen,
    0 bis 100,
    faden,
    lernfrage,
    wie schaffe ich es,
    ich habe gelernt,
    hat es geklappt,
    was hat gestört,
    vorschlag,
    neuer eintrag,
    ohne scheibe,
    trockentraining,
    mentaltraining,
    dazugekommen,
    lösen,
    dazunehmen,
    vom selben abend,
    papierkorb,
    abschaltbar,
    hinweis,
    nur du siehst,
    zonen,
    grenze,
    nahtstellen,
    parts,
    results-read,
    partline,
    export,
    konto löschen,
    deine daten,
    stufe 2,
    2a,
    treffsicher,
  ]
part_of: ["[[spiegel]]"]
governed_by: ["[[adr-033]]", "[[adr-030]]", "[[adr-029]]"]
relates_to:
  [
    "[[spiegel-navigation]]",
    "[[spiegel-privacy]]",
    "[[spiegel-data-model]]",
    "[[spiegel-db-schema]]",
    "[[spiegel-roadmap]]",
    "[[spiegel-account-transfer]]",
  ]
---

**TL;DR** Das Tagebuch ist der zweite Teil von Spiegel ([[adr-033]]) und Treffsicher 2.0: was in Treffsicher genutzt
wurde, wird besser, was kaum genutzt wurde, wird einfacher oder fällt weg. Ein Eintrag gehört zu einem Abend und einer
Disziplin, mit Vorhaben, Notiz, Vorher, Nachher und dem Faden der eigenen Fragen. Das Tagebuch ist je Konto
abschaltbar, liest Scheiben nur über eine schmale Schnittstelle und erscheint im Ergebnisteil nur an festen Stellen.
Gebaut in Teil 2a (28. Oktober 2026) mit Export und Konto löschen über beide Teile.

# Spiegel — Tagebuch

## Treffsicher 2.0

Grundlage sind die Zählungen in der Prod-Kopie von Treffsicher (265 Einheiten in sechs Konten), nur als Zahlen:

- Die Absicht ist das meistgenutzte Textfeld (51). Sie wird zum **Vorhaben**, der ersten Zeile und dem Titel in der
  Liste.
- Beobachtung, Erkenntnis und Lernfrage werden zusammen genutzt (24, vier Konten) und bauen über Monate aufeinander
  auf. Daraus werden die **Notiz** (immer sichtbar), zwei Satzanfänge unter Nachher („Ich habe gelernt, dass …“, „Wie
  schaffe ich es, …?“) und der **Faden**.
- Befinden (39) füllen fast nur zwei Konten, Prognose (14) und Feedback (21) fast nur bei Wettkämpfen, Ausführung je
  Serie bei 180 von 1037 Serien. Sie bleiben als **Abschnitte**, die leer nur eine Zeile mit „+“ sind.
- Jedes übrige Textfeld kam höchstens 18-mal vor. Es geht in der Notiz auf (Übernahme in Stufe 3).

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

- **`/diary`:** Kopf mit „Neuer Eintrag“, Umschalter „Einträge · Faden“, Einträge neueste oben nach Monat. Eine Karte
  ist ganz der Link; Titel ist das Vorhaben, sonst die Disziplin. Beim ersten Öffnen steht darüber der Hinweis „Nur du
  siehst dein Tagebuch“ bis „Verstanden“.
- **`/diary/thread` (Faden):** je Disziplin die Einträge mit Frage als Zeitstrahl, neueste oben, die Disziplin mit der
  jüngsten Frage vorgewählt; darunter je Punkt „Ich habe gelernt, dass …“.
- **`/diary/new`:** Vorschläge je Abend und Disziplin der letzten 30 Tage mit Scheiben ohne Eintrag, darunter „Ohne
  Scheibe“ (Tag, Art, Disziplin). `?card=<id>` markiert den Vorschlag dieser Scheibe oder leitet in ihren Eintrag.
- **`/diary/[id]`:** Rückweg, Tag, „Disziplin · Art“, Scheiben, Vorhaben, Notiz, Vorher (die letzte Frage derselben
  Disziplin mit „Als Vorhaben nehmen“, Befinden, Prognose mit erwartetem Ergebnis), Nachher („Hat es geklappt?“ nur
  mit Vorhaben, die Satzanfänge, „Was hat gestört?“, Feedback mit der Prognose gestrichelt, Ausführung je Serie), am
  Ende „Dieser Eintrag“ (Tag, Art und Disziplin nur ohne Scheiben änderbar, Löschen).
- **Feste Regel der Abschnitte:** leer eine Zeile mit „+“, gefüllt offen mit „Entfernen“ (Rückfrage). Die Seite hängt
  nicht davon ab, was jemand bisher genutzt hat (Konsistenz als Grundsatz, [[adr-035]]).
- Texte sind gesteuerte Felder mit „Speichern“ und „Verwerfen“; wer mit Ungespeichertem geht, wird gefragt.

## Scheiben vom selben Abend

Abgeleitet beim Lesen, nie beim Laden geschrieben (`entryCards` in `src/diary/cards.ts`, reine Funktion). Gibt es an
einem Tag genau einen Eintrag einer Disziplin, der nicht im Papierkorb liegt, gehört jede Scheibe dieses Abends und
dieser Disziplin ohne Zeile in `DiaryEntryCard` dazu („dazugekommen“). Eine Zeile `linked` hält eine Scheibe fest
(Anlegen aus dem Vorschlag, „Dazunehmen“), `released` hält sie aus jedem Eintrag heraus („Lösen“), bis sie von Hand
dazukommt. Bei mehreren Einträgen der Disziplin am Tag wird jede Scheibe ohne Zeile nur unter „Vom selben Abend“
angeboten. Eine gelöschte Scheibe steht als „Scheibe gelöscht“. Das Einlesen bleibt frei vom Tagebuch.

## Stellen im Ergebnisteil

- Seite einer Scheibe, Kasten „Diese Scheibe“, ganz oben die Zeile „Tagebuch“ (`cardLines`). Jede führt dorthin, wo
  sich etwas tun lässt (`cardPlace` in `src/diary/cards.ts`): im Eintrag „Im Eintrag vom Fr 13.03.“ mit „Eintrag
  öffnen“; nur angeboten (gelöst, oder mehrere Einträge des Abends) „Noch in keinem Eintrag. Der Eintrag vom … bietet
  sie an.“ mit „Eintrag öffnen“; fest in einem Eintrag im Papierkorb „Im Eintrag vom …. Er liegt im Papierkorb.“ mit
  „Papierkorb öffnen“; sonst „Noch in keinem Eintrag.“ mit „Eintrag anlegen“ (auch für einen Abend, der älter als 30
  Tage ist). Die geteilte Seite zeigt keine.
- Start, je Block neben „Abend in Scheiben ›“: „Tagebuch · Eintrag öffnen ›“ oder „… anlegen ›“ (`startLines`); stecken
  alle Scheiben des Blocks in Einträgen im Papierkorb, keine Zeile.
- Profil: Kasten „Tagebuch“ mit Ein- und Ausschalten; ist es an, am Telefon „Alle Scheiben“, weil die Liste der
  Scheiben dann nicht in der Leiste steht. Papierkorb: „Einträge im Tagebuch“.

## Abschaltbar, Papierkorb, Datenschutz

- `DiarySettings.enabled`, für neue Konten aus. Aus heißt: kein Bereich, keine Stellen, `/diary` führt ins Profil. Die
  Einträge bleiben.
- Löschen legt einen Eintrag 30 Tage in den Papierkorb („Eintrag gelöscht · Rückgängig“), danach löscht `diaryJobs`
  ihn beim Start und stündlich endgültig. Im Papierkorb steht er nirgends sonst, auch nicht als Frage im Faden.
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

Saisonziele, Schuss-Abläufe und Anhänge in 2b, Einflüsse und Selbstbild in 2c, die Übernahme der Einträge aus
Treffsicher in Stufe 3 (`importKey`, [[spiegel-account-transfer]]).
