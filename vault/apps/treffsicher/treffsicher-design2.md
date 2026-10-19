---
id: treffsicher-design2
type: subsystem
title: "Treffsicher in Design 2"
keywords: [Design 2, Darstellung, hell, dunkel, untere Leiste, Seitenleiste, Neue Einheit, Profil, Konto, Anmeldung, Trefferfarben, Ringwert-Farben, DecisionDialog, Folgen, Hilfe, Erklärungen, Strich mit Grund, Skriptprüfung, pruefen, Prüfkonto, AppShell, AppFrame]
tags: [ui, design]
feature_of: ["[[treffsicher]]"]
governed_by: ["[[adr-032]]"]
relates_to: ["[[conventions]]", "[[dark-mode-only]]", "[[spiegel-dialog-texts-not-understood]]"]
---

**TL;DR** Seit Teil T von SP-4.3 läuft Treffsicher in Design 2 wie Spiegel: hell und dunkel mit Wahl je Gerät, untere
Leiste mit „Neue Einheit“ in der Mitte und Seitenleiste ab 1024 px, Profil statt Konto, Karten in den Maßen von
Spiegel, Trefferfarben von Spiegel auch im PDF, Folgen vor jedem Bestätigen, Hilfe an Prognose/Feedback und Befinden,
„–“ mit Grund. Die Statistik folgt in Teil G.

## Rahmen

- `components/app/shell/AppShell.tsx` setzt `AppFrame` aus `@vereinsheim/ui/design2/app-frame` mit den Bereichen aus
  `areas.ts`: Seitenleiste Start, Tagebuch, Statistik, Ziele, Ablauf, Disziplinen, Pille „Neue Einheit“, Trenner,
  Profil, Admin (nur Admins). Untere Leiste am Telefon: Start, Tagebuch, **Neue Einheit** (Mitte), Statistik, Profil.
  Ziele, Ablauf, Disziplinen und Admin stehen am Telefon in Profil unter „Weitere Bereiche“; ist einer davon offen,
  ist in der Leiste Profil aktiv (`barAreaOf`).
- Start ist `/dashboard` (exakt), alles andere über Präfix (`areaOf`). Die Seiten haben keinen eigenen Knopf „Neue
  Einheit“ mehr, den gibt es nur im Rahmen.
- Das Layout `(app)/layout.tsx` setzt `Page` mit einer festen Spalte (`grid-cols-1`): Breite Tabellen scrollen in
  sich, nicht die Seite.
- `src/proxy.ts`: ein Konto ohne Admin-Rolle geht auf `/admin…` zum Start (`isAdminPath`).

## Darstellung, Profil, Anmeldung

- Root-Layout: Schriften Archivo, Geist, Geist Mono; `ThemeScript`/`ThemeProvider` mit dem Schlüssel
  `treffsicher-theme`; Toasts aus `design2/toaster`; `data-app="treffsicher"` für den Akzent (Teal) in beiden Themes.
- `/profile` (Profil): Darstellung, Passwort ändern, Abmelden, am Telefon die weiteren Bereiche. `/account` leitet
  dauerhaft auf `/profile`.
- Anmeldung im Aufbau von Spiegel (Marke in Archivo, Karte, gleiche Meldung für jeden Fehler).

## Karten, Zahlen, Farben

- Karten und Seitenköpfe kommen aus `@vereinsheim/ui/design2/card` und `design2/page-header` (Maße wie Spiegel). Die
  geteilten `ui/card` und `shell/PageHeader` bleiben für Ringwerk unverändert bis Teil W.
- Große Ergebnisse in `font-display` mit `tabular-nums`, Tabellen in `font-mono`.
- Treffer und Ringwerte in den Farben von Spiegel (`score-*`: 10 rot, 9 gold, 8 türkis, ≤ 7 violett, dunkler Rand):
  Ringverteilung der Einheit, Farbpunkt vor jedem Schusswert (`ShotValues`, Wert in Schriftfarbe), Statistik und das
  PDF der Einheit (`SCORE_HEX`). Die Meyton-Skala ist weg.
- Statistik bis Teil G: Reiter und Filter als `design2/segmented`, Achsen und Gitter aus Tokens.

## Folgen vor dem Bestätigen

Jede Aktion, die löscht, archiviert, aktiviert, deaktiviert oder Änderungen verwirft, fragt über `DecisionDialog`. Der
Wortlaut steht in `src/lib/consequences.ts` (freigegeben im Textbuch `vault/_attachments/textbuch-ringwerk-treffsicher.md`),
die Seite berechnet ihn auf dem Server und gibt ihn dem Knopf mit. `consequences.test.ts` hält Wortlaut und
Schreibregeln (`TREFFSICHER_OLD_WORDS`). Welche Action mit welchen Werten läuft, halten `confirmations.test.tsx`
(Stellvertreter der Dialoge in `src/test/confirm-capture.ts`, ohne DOM) und für Anhang und Konto die reinen Funktionen
`attachmentToDelete` und `requestActiveChange`/`confirmedDeactivation` fest. Ein Rückgängig gibt es noch nicht (dafür
fehlt ein Papierkorb, eigener Plan).

## Hilfe und „–“ mit Grund

- `src/lib/help/topics.ts`: Erklärungen „Prognose und Feedback“ und „Befinden“ (`HelpText`). Auf der Seite einer
  Einheit „?“ an beiden Karten (Blatt aus `design2/help-sheet`) und der Schalter „Erklärungen“, der die Kurzsätze
  zeigt (`components/app/help/Explain.tsx`).
- `src/lib/missing.ts` und `Missing`: „–“ mit Grund statt 0 oder leer (Ergebnis, Serie, Einzelschüsse, Ausführung,
  Name, letzte Änderung an einer Einheit). Eine Serie ohne Bewertung zeigt keine leeren Punkte mehr.

## Skriptprüfung

`pnpm --filter treffsicher pruefen` (mit `--start` gegen den eigenen Build auf :3011) prüft im Browser Rahmen, Breiten
375 bis 1280 px ohne seitliches Scrollen, Umschalter im eigenen Feld, die untere Leiste, Darstellung ohne Aufblitzen,
Fokus im Dialog, Admin ohne Rolle, Hilfe, „Anhang löschen“ und „Konto deaktivieren“ (Seite und Datenbank). Vor jedem
Lauf setzt `tools/pruefen-account.ts` drei Prüfkonten in der lokalen Dev-Datenbank zurück (`pruefen@`,
`pruefen-admin@`, `pruefen-ziel@treffsicher.test`, Zugangsdaten in `apps/treffsicher/.env`).
