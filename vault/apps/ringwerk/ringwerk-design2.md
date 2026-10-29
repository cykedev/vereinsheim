---
id: ringwerk-design2
type: subsystem
title: "Ringwerk in Design 2"
keywords: [Design 2, Darstellung, hell, dunkel, Messing, untere Leiste, Seitenleiste, Profil, Konto, Anmeldung, Reiter, Unternavigation, Wettbewerb, Tabellen, Rang, Bracket, Skriptprüfung, pruefen, AppShell, AppFrame, DecisionDialog, NoticeDialog, Folgen, Bestätigung, Hilfe, Erklärung, Fragezeichen, Blatt, HelpMark, Teiler, Ringteiler, Turnierbaum, Strich mit Grund, Missing]
tags: [ui, design]
feature_of: ["[[ringwerk]]"]
governed_by: ["[[adr-032]]"]
relates_to: ["[[conventions]]", "[[ringwerk-pruefbestand]]", "[[treffsicher-design2]]", "[[loading-boundary-hidden-copy]]"]
---

**TL;DR** Seit Teil W (Abschnitt „Basis“) von SP-4.3 läuft Ringwerk in Design 2 wie Spiegel und Treffsicher: hell und
dunkel mit Wahl je Gerät, Akzent Messing, untere Leiste ohne Mitte und Seitenleiste ab 1024 px, Profil statt Konto,
Reiter für die Seiten eines Wettbewerbs, Ergebnisse in Mono-Ziffern, Dialoge mit Folgen, Hilfe als Blatt an den
schwierigen Zahlen und „–“ mit Grund. Daten und PDFs sind unverändert (Abgleich aus [[ringwerk-pruefbestand]]).

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
Bearbeiten), darunter den Namen in `font-display` und die Reiter (`CompetitionTabs` über `TabBar` aus
`@vereinsheim/ui/design2/tab-bar`): eine Zeile als Links, die in sich seitlich scrollt; die gezeigte Seite ist markiert
und rückt ins Bild. Jede
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

## Hilfe und „–“ mit Grund

Die Erklärungen stehen in `src/lib/help/topics.ts`, freigegeben im Textbuch (Abschnitt „Ringwerk: Hilfe (WD0)“); ein
Test hält den Wortlaut gleich mit dem Textbuch. `AppShell` hängt das Blatt einmal ein (`HelpProvider`, `HelpSheet`),
`HelpMark` setzt das „?“:

| Thema                | Ort                                                                          |
| -------------------- | ---------------------------------------------------------------------------- |
| `teiler`             | Spaltenkopf Teiler der Saison und des Events                                 |
| `corrected-teiler`   | derselbe Kopf in gemischten Wettbewerben („korr.“)                           |
| `ringteiler`         | „Best. Ringteiler“ (Saison), „Ringteiler“ (Event), „Best. RT“ (Liga)         |
| `season-order`       | Zeile „Sortierung: …“ über der klassischen Rangliste einer Saison           |
| `season-alternating` | Satz über der abwechselnden Rangliste                                        |
| `league-table`       | Überschrift „Tabelle“ einer Liga mit Hin- und Rückrunde                      |
| `best-of-table`      | Überschrift „Tabelle“ einer Liga im Best-of                                  |
| `playoffs`           | Zeile „Turnierbaum“ über dem Baum (die Zeile der Rundennamen bleibt)        |
| `finale`             | Überschrift „Finale“ unter dem Baum                                          |

`Missing` zeigt „–“ mit dem Grund aus `src/lib/help/missing.ts`: Saison ohne Serie (einmal sichtbar je Zeile, sonst
Tooltip), „Best. RT“ ohne Duell, Platz eines Zurückgezogenen (Tooltip), Direktvergleich nicht nötig, Gegner bei
Freilos, Paarung mit Zurückgezogenem nicht gewertet, Uhr einer offenen Paarung (Tooltip), Liga ohne Stichtag
(Tooltip). Der Strich in den leeren Feldern der Bracket-Vorschau bleibt und nennt den Grund nur als Tooltip. Gründe
ohne Zahl und ohne Wort aus `DATA_WORDS`, damit der Abgleich die Datenfolge jeder Seite gleich liest. Die PDFs
bleiben, wie sie sind. Zurückgezogene zeigen beim Ringteiler und beim Direktvergleich den Strich wie im PDF. Die
Vorschauen auf Start und in der Liste der Wettbewerbe (`CompetitionPreview`, `help={false}`) zeigen kein „?“ und
klassisch keine Zeile „Sortierung“.

## Skriptprüfung

`pnpm --filter ringwerk pruefen` startet den gebauten Stand auf :3013 gegen die Prüfdatenbank (vorher `pruefdaten`)
und prüft als Admin, Sportleitung und Mitglied: Rahmen und Leisten je Rolle, Profil, Breiten 375 bis 1280 px ohne
seitliches Scrollen, die untere Leiste, die Reiter, das Bracket, keine versteckte Kopie im Hintergrund, Darstellung
ohne Aufblitzen, den Fokus in acht Dialogen mit Folgen (nur geöffnet und mit Escape geschlossen) und die Hilfe:
Jedes sichtbare „?“ öffnet sein Thema, am Telefon und am Desktop, ohne die Tabelle umzuordnen. Jedes Thema hat ein
„?“, jedes „–“ nennt seinen Grund. Mit `--bilder` dazu die Blätter der Hilfe. Es schreibt nichts. Dazu vor jedem Merge und Release der Abgleich aus [[ringwerk-pruefbestand]].

## Drift-Gate

`scripts/consistency-check.sh` prüft Ringwerk mit denselben Regeln von Design 2 wie Treffsicher und Spiegel, mit
byte-gleicher `globals.css` und gleichen Fehlerseiten in allen drei Apps ([[conventions]] §8). Schrift `text-[13px]`
und `text-[15px]` sind Maße von Design 2.
