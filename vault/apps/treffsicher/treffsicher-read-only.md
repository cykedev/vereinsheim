---
id: treffsicher-read-only
type: subsystem
title: "Treffsicher lesend je Konto"
keywords: [umgezogen, nur lesend, lesend je konto, zu spiegel, übernahme, moved, movedToSpiegelAt, SPIEGEL_URL, hinweis, admin bleibt]
tags: [domain-rule, migration]
part_of: ["[[treffsicher]]"]
governed_by: ["[[adr-033]]"]
relates_to: ["[[treffsicher-design2]]", "[[treffsicher-access-model]]"]
---

**TL;DR** Ein Konto, das nach Spiegel umgezogen ist (`User.movedToSpiegelAt` gesetzt), liest in Treffsicher alles und
ändert nichts mehr: Hinweis oben auf jeder Seite mit „Zu Spiegel“, keine Knöpfe zum Ändern, die Seite „Das geht jetzt
in Spiegel.“ statt der Formulare, und der Server lehnt jede Änderung an eigenen Daten ab. Admin bleibt für Admins
bedienbar. Gesetzt wird das Merkmal von der Übernahme in Spiegels CLI (Stufe 3 von [[adr-033]]), nie von der App.

# Treffsicher lesend je Konto

Die Übernahme nimmt ein Konto auf einmal von Treffsicher nach Spiegel mit. Entstünde danach in Treffsicher noch etwas,
ginge es verloren. Deshalb merkt sich Treffsicher je Konto, dass es umgezogen ist. Anmelden geht weiter; eine
Weiterleitung für alle kommt erst in Stufe 4, wenn alle Konten umgezogen sind.

## Merkmal und Vertrag mit der Übernahme

- Spalte `User.movedToSpiegelAt` (`TIMESTAMP(3)`, NULL heißt nicht umgezogen), Migration
  `20261029160000_user_moved_to_spiegel`, nur `ADD COLUMN`.
- Die Übernahme setzt am Ende eines Laufs in der Datenbank von Treffsicher
  `UPDATE "User" SET "movedToSpiegelAt" = now() WHERE id = $1`, der Befehl zum Aufheben setzt `NULL`. Die App schreibt
  die Spalte nie.
- `getAuthSession` liest die Spalte im selben `select` wie Rolle und `sessionVersion` und setzt
  `session.user.movedToSpiegel`. Seiten und Actions fragen nur dieses Feld.
- Dev und Tests: `pnpm --filter treffsicher moved <E-Mail>` setzt, `… moved --clear <E-Mail>` hebt auf (`tools/moved.ts`,
  nur gegen die lokale Datenbank, Ausgabe ohne Namen).

## Grenze: eigene Daten gegen Admin

Eigene Daten sind alles, was am eigenen Konto hängt: Einheiten mit allem darunter, Anhänge, Ziele, Abläufe, eigene
Disziplinen, Favorit und ausgeblendete Disziplinen, Passwort. Admin ist, was ein Admin für alle tut: Konten anderer
und des eigenen im Admin-Bereich, Sperren der Anmeldung, Disziplinen der Anlage (`isSystem`). Ein umgezogener Admin
legt deshalb nur noch Disziplinen der Anlage an und ändert nur diese (`disciplineWritable` in `src/lib/moved/rules.ts`,
ein Prädikat für Server und Seiten).

## Schreibwege

- Die Prüfung steht als erste Zeile in jeder Fassade mit `"use server"`, die eigene Daten ändert: `refuseIfMoved()`
  (22 Actions) bzw. `refuseDisciplineIfMoved()` (5 Actions an Disziplinen), aus `src/lib/moved/guard.ts`. Die Ablehnung
  sagt „Dein Tagebuch ist jetzt in Spiegel. Hier kannst du nichts mehr ändern.“
- `previewMeytonImport` schreibt nichts, wird aber abgelehnt, weil es nur zum Anlegen dient.
  `createGoalAndRedirect` leitet bei Ablehnung auf `/goals/new`. Das Aufräumen eines verwaisten Favoriten beim Lesen
  unterbleibt.
- Admin-Actions, lesende Actions, Anmelden und Abmelden, Anhänge ansehen und das PDF einer Einheit bleiben.
- `src/lib/moved/coverage-table.ts` nennt jede exportierte Funktion der sechs Fassaden mit ihrer Entscheidung
  (`own`, `discipline`, `admin`, `read`); `coverage.test.ts` hält die Tabelle gegen die Fassaden und ruft jede Action
  als umgezogenes und nicht umgezogenes Konto. Eine neue Action ohne Eintrag macht den Test rot.

## Seiten

- Hinweis `MovedBanner` im Layout als erstes Kind der Seite: voll auf Start (Titel, Satz, „Zu Spiegel“, „Anmelden mit
  deinem Konto von Spiegel“), auf allen anderen Seiten eine Zeile mit dem Knopf.
- Im Rahmen wird die Aktion „Neue Einheit“ zu „Zu Spiegel“ (`ArrowUpRight`, unter dem Symbol „Spiegel“), ein gewöhnlicher
  Link im selben Tab. `/sessions/new` gehört dann zum Tagebuch (`currentArea`).
- Knöpfe zum Ändern fehlen über Props `readOnly` (Einheit, Anhänge, Befinden, Prognose, Feedback, Reflexion, Ziel) und
  `moved` (Profil ohne Formular für das Passwort). Leere Listen sagen „Neues legst du jetzt in Spiegel an.“
- Die alten Adressen zum Anlegen oder Bearbeiten zeigen `MovedPage` („Das geht jetzt in Spiegel.“) ohne eigenen Knopf,
  der Hinweis darüber trägt „Zu Spiegel“.
- Adresse: `SPIEGEL_URL` (in `compose.yml` `https://${SPIEGEL_HOST}`), davon die Wurzel. Fehlt sie, gilt in Dev
  `http://localhost:3002`; in Produktion zeigt Treffsicher den Hinweis ohne Knopf statt eines toten Links.
- Texte in `src/lib/moved/texts.ts`, Wortlaut im Textbuch („Treffsicher: Nur noch lesend (3e)“).

## Rückweg auf ein älteres Image

Prisma nennt in jedem `SELECT` und `INSERT` nur die Spalten seines Schemas; ein älteres Image ignoriert die Spalte und
legt Konten mit NULL an (am 29. Oktober 2026 mit dem alten Client geprüft). Vor dem ersten Umzug ist ein Rückweg
folgenlos. Danach macht er umgezogene Konten wieder beschreibbar; dann nur mit erneutem Lauf der Übernahme für diese
Konten. Vor dem Rückweg nichts löschen.
