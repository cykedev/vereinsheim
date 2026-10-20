---
id: ringwerk-design2
type: subsystem
title: "Ringwerk in Design 2"
keywords: [Design 2, Darstellung, hell, dunkel, Messing, untere Leiste, Seitenleiste, Profil, Konto, Anmeldung, Reiter, Unternavigation, Wettbewerb, Tabellen, Rang, Bracket, Skriptprüfung, pruefen, AppShell, AppFrame, DecisionDialog, NoticeDialog, Folgen, Bestätigung]
tags: [ui, design]
feature_of: ["[[ringwerk]]"]
governed_by: ["[[adr-032]]"]
relates_to: ["[[conventions]]", "[[ringwerk-pruefbestand]]", "[[treffsicher-design2]]", "[[loading-boundary-hidden-copy]]"]
---

**TL;DR** Seit Teil W (Abschnitt „Basis“) von SP-4.3 läuft Ringwerk in Design 2 wie Spiegel und Treffsicher: hell und
dunkel mit Wahl je Gerät, Akzent Messing, untere Leiste ohne Mitte und Seitenleiste ab 1024 px, Profil statt Konto,
Reiter für die Seiten eines Wettbewerbs, Ergebnisse in Mono-Ziffern. Daten und PDFs sind unverändert (Abgleich aus
[[ringwerk-pruefbestand]]). Dialoge mit Folgen und die Hilfe folgen in den Abschnitten „Dialoge“ und „Hilfe“.

## Rahmen

- `components/app/shell/AppShell.tsx` setzt `AppFrame` mit den Bereichen aus `areas.ts`, je Rolle: Seitenleiste
  Start, Wettbewerbe, Teilnehmer und Disziplinen (Admin und Sportleitung), Trenner, Profil, Admin (nur Admins). Untere
  Leiste ohne Mitte: Start, Wettbewerbe, Teilnehmer, Profil; ein Mitglied sieht drei Felder (Start, Wettbewerbe,
  Profil), `AppFrame` setzt dann drei Spalten. Disziplinen und Admin stehen am Telefon in Profil unter „Weitere
  Bereiche“ (`moreAreas`).
- Start ist `/` (exakt), Admin führt zu `/admin/users` und ist im ganzen Bereich `/admin…` aktiv (`isAdminPath` in
  `components/app/shell/adminPath.ts`; `src/lib` bleibt unberührt).
- `src/proxy.ts`: Ein Konto ohne Admin-Rolle geht auf `/admin…` zum Start, nicht zur Anmeldung.
- Das Layout `(app)/layout.tsx` setzt `Page` mit einer festen Spalte (`grid-cols-1`); breite Tabellen und das Bracket
  scrollen in sich. Ringwerk hat keine `loading.tsx` mehr ([[loading-boundary-hidden-copy]]).

## Darstellung, Profil, Anmeldung

- Root-Layout: Schriften Archivo, Geist, Geist Mono; `ThemeScript`/`ThemeProvider` mit dem Schlüssel
  `ringwerk-theme`; Toasts aus `design2/toaster`; `data-app="ringwerk"` für Messing in beiden Themes. `globals.css` ist
  byte-gleich mit der von Treffsicher.
- `/profile`: Darstellung, Passwort ändern (das Formular ist unverändert), Abmelden, am Telefon die weiteren Bereiche.
  `/account` leitet dauerhaft auf `/profile`.
- Anmeldung im Aufbau von Spiegel (Marke in Archivo, Karte, gleiche Meldung für jeden Fehler), danach zum Start.

## Seiten eines Wettbewerbs

`CompetitionDetailHeader` zeigt oben „Wettbewerbe“ zum Zurück und die Aktionen der Seite (PDF, Spielplan generieren,
Bearbeiten), darunter den Namen in `font-display` und die Reiter (`CompetitionTabs`): eine Zeile in der Form des
Segment-Umschalters, als Links, die in sich seitlich scrollt; die gezeigte Seite ist markiert und rückt ins Bild. Jede
Seite nennt die Seiten, zu denen sie schon vorher führte (`links`); `competitionTabs` ordnet sie fest (Ergebnis,
Playoffs, Serien, Teilnehmer, Protokoll). Damit ist jede Seite in jeder Phase so erreichbar wie vorher.

## Tabellen, Ränge, Bracket

- Ergebnisse in `font-mono tabular-nums`, der Platz (`RankBadge`) in `font-display`, Gold, Silber und Bronze aus
  `rank-*`. Tabellen und Listen in Karten mit `rounded-2xl`. Was am Telefon ausgeblendet ist, bleibt es
  (`HIDE_ON_MOBILE`).
- Bracket: Linien in `line-strong`, Karten mit `rounded-xl`, Sieger je Runde wie bisher aus `rank-*`/`info`. Es
  scrollt in sich, die Seite nie seitlich. Der Aufbau des DOM bleibt, den der Abgleich liest.

## Geteilte Primitives

Dialoge (`ui/dialog`, `ui/alert-dialog`) stehen auf der Kartenfläche mit `rounded-2xl` über `scrim`, Titel in
`font-display`; der Leerzustand nutzt `design2/card`.

## Dialoge mit Folgen

Jede Bestätigung läuft über `DecisionDialog` (`@vereinsheim/ui/design2/decision-dialog`), der Wortlaut steht nur in
`src/lib/consequences.ts` und ist im Textbuch freigegeben (`vault/_attachments/textbuch-ringwerk-treffsicher.md`,
Abschnitt „Ringwerk: Folgen vor dem Bestätigen“). Der Dialog gibt den Fokus dem Knopf zurück, der ihn öffnete, und
schreibt auf Rot in `primary-foreground`. Löschen mit allen Daten (Teilnehmer, Wettbewerb) verlangt den Namen im Feld
unter den Folgen (`children`, `confirmDisabled`). Wo die Action ablehnen würde (Teilnehmer mit Wettbewerben für die
Sportleitung, Wettbewerb mit Einschreibungen), zeigt `NoticeDialog` den Grund. Fehler nach dem Bestätigen kommen als
Toast, weil der Dialog schließt. `src/components/app/confirmations.test.tsx` hält je Dialog fest, welche Action mit
welchen Werten genau einmal läuft (Stellvertreter in `src/test/confirm-capture.ts`, ohne jsdom).

## Skriptprüfung

`pnpm --filter ringwerk pruefen` startet den gebauten Stand auf :3013 gegen die Prüfdatenbank (vorher `pruefdaten`)
und prüft als Admin, Sportleitung und Mitglied: Rahmen und Leisten je Rolle, Profil, Breiten 375 bis 1280 px ohne
seitliches Scrollen, die untere Leiste, die Reiter, das Bracket, keine versteckte Kopie im Hintergrund, Darstellung
ohne Aufblitzen und den Fokus im Dialog „Spielplan neu generieren“ (nur geöffnet und mit Escape geschlossen). Es
schreibt nichts. Dazu vor jedem Merge und Release der Abgleich aus [[ringwerk-pruefbestand]].

## Drift-Gate

`scripts/consistency-check.sh` prüft Ringwerk seit diesem Umzug wie Treffsicher: ohne die Regeln, die nur zu
`theme.css` gehörten (Schrift `text-[13px]` und `text-[15px]` sind Maße von Design 2), mit byte-gleicher
`globals.css` ([[conventions]] §8).
