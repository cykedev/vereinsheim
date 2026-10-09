# Plan — Labor näher an der App

Branch `feat/spiegel-labor-wie-app`. Auftrag des Users (9. Oktober 2026): Der Labor-Kopf soll raus, damit das Labor
aussieht wie die Anwendung später. „Beispiele erreichen wir genug.“ Hell und Dunkel als Einstellung an der Seite,
„hinzufügen/clear“ bei einer Scheibe vorübergehend woanders. Alles soll weiter funktionieren und gezeigt werden können,
nur näher am Ergebnis, damit wir auf die Usability schauen können.

## Kontext

Jede Ansicht des Labors beginnt mit dem Labor-Kopf (`LaborHeader`):

- Kennzeichen „Spiegel · Labor“, Titel „Die Bausteine im Einsatz“, ein Absatz zur Ansicht;
- der Stand des Codes und „Design 2“;
- „Labor: App | Beispiele“ und „Darstellung: System | Hell | Dunkel“;
- je Ansicht eigene Umschalter (auf der Beispielscheibe: Scheibe, Beispiel, Tippen, Neuer Schuss);
- ein Hinweis zum Beispiel und die Adresse in der App.

Auf dem Telefon nimmt das fast den ganzen ersten Bildschirm ein, bevor die Seite beginnt. So lässt sich nicht
beurteilen, wie die App wirkt.

## Entscheidungen

- **D1 Kein Labor-Kopf auf den Seiten.** Start, Scheiben, Fortschritt und Scheibe beginnen wie in der App.
- **D2 Darstellung „an der Seite“:**
  - am Desktop unten in der Seitenleiste, unter Admin abgesetzt, als kleiner Umschalter „System | Hell | Dunkel“;
  - auf dem Telefon und im Querformat in Profil (dort lebt die Einstellung in der App).
  - `AppFrame` bekommt dafür einen Platz unten in der Seitenleiste (`sidebarFooter`); den Umschalter liefert das
    Labor, denn er ist eine Einstellung der App, keine des Rahmens.
- **D3 Labor-Werkzeuge hinter einem Knopf:**
  - **Knopf:** ein kleiner runder Knopf „Labor“ unten rechts (Symbol `FlaskConical`), über der unteren Leiste und
    neben der Pille. Er öffnet ein Blatt „Labor“.
  - **Im Blatt:**
    - Stand des Codes;
    - die Adresse in der App und der Hinweis zur Ansicht;
    - „Beispielscheiben“: Scheibe und Beispiel; eine Wahl öffnet die Beispielscheibe;
    - „Tippen auf der Scheibe“: Ansehen oder Setzen, dazu Neuer Schuss (Wertung oder Probe) und „Leer“ als Beispiel
      zum Neuanfang;
    - „Zurück zur App“, wenn eine Beispielscheibe offen ist.
  - Der Knopf ist erkennbar Labor und kein Teil der App: neutral, klein, mit Namen „Labor-Werkzeuge“.
- **D4 Beispiele bleiben erreichbar,** aber nicht mehr als zweite Ebene neben der App. „Labor: App | Beispiele“
  entfällt; die Beispielscheiben öffnet das Blatt, zurück geht es über die Navigation oder „Zurück zur App“.
- **D5 Seitentitel:** Scheiben, Fortschritt und Scheibe haben ihren Titel schon (`ListHeader`, `PeriodHeader`,
  `CardHeader`). Start behält den unsichtbaren Titel; sein erster Inhalt ist der letzte Abend.
- **D6 Nicht im Umfang:** die Usability selbst. Ein eigener Durchgang je Seite folgt, phone-first, mit Aufgaben
  wie „Wie war mein letzter Abend?“ und „Werde ich besser?“.

## Dateien

| Datei | Änderung |
|---|---|
| `packages/shot-ui/src/layout/AppFrame.tsx` (+ Test) | `sidebarFooter` unten in der Seitenleiste |
| `tools/labor/src/LaborPanel.tsx` (neu) | Knopf und Blatt „Labor“ mit Stand, Adresse, Hinweis, Beispielscheiben, Tippen |
| `tools/labor/src/ThemeSwitch.tsx` (neu) | „Darstellung: System, Hell, Dunkel“ |
| `tools/labor/src/LaborHeader.tsx` | entfällt (Typen wandern nach `LaborPanel`) |
| `tools/labor/src/App.tsx`, `CardView.tsx`, `ListView.tsx`, `PeriodView.tsx`, `StartView.tsx`, `PlaceholderView.tsx` | Kopf raus, `LaborPanel` rein, Darstellung in Seitenleiste und Profil |
| `tools/labor/pruefung.js` | Helfer für das Blatt und die Darstellung, Umstellen, neue Prüfungen |
| `tools/labor/CLAUDE.md`, `vault/spiegel/spiegel-navigation.md` | Doku |

## Required Docs

- `vault/conventions.md` (§3, §10 Design 2)
- `tools/labor/CLAUDE.md`, `packages/shot-ui/CLAUDE.md` (Rahmen und Links)

## Aufgaben

### Task 1: Platz unten in der Seitenleiste (`AppFrame`)

- Prop `sidebarFooter?: ReactNode`. Steht in der Seitenleiste nach Admin, mit `mt-auto`, abgesetzt durch eine
  Linie (`border-t border-border pt-3`).
- **Test (Markup):** der Inhalt steht in `data-app-sidebar` nach dem letzten Eintrag; ohne Prop kein Platz; nicht in
  der unteren und nicht in der schmalen Leiste.

### Task 2: Darstellung als Umschalter (`ThemeSwitch.tsx`)

- `ThemeSwitch({ theme, onTheme, className })`: `Segmented` mit Namen „Darstellung“ und System, Hell, Dunkel, dazu
  `data-theme-switch`.
- `App`:
  - übergibt ihn als `sidebarFooter`;
  - `PlaceholderView` zeigt ihn in Profil unter „Darstellung“ (über `theme`/`onTheme`).

### Task 3: Labor-Werkzeuge (`LaborPanel.tsx`)

- **Props:** `{ commit, mode, view, onView, hint, address?, children? }`. `children` sind die Umschalter der Ansicht
  (Beispielscheiben, Tippen).
- **Knopf:**
  - `fixed right-4 z-40` über der Leiste: `bottom: calc(var(--app-bar, 0px) + 1rem + env(safe-area-inset-bottom))`;
  - rund `size-10`, `border border-line-strong bg-card text-muted-foreground shadow-lg`;
  - Symbol `FlaskConical`, Name „Labor-Werkzeuge“, `data-labor-button`.
- **Blatt** (`Sheet` aus `@vereinsheim/ui/design2/sheet`, Titel „Labor“, `data-labor-panel`):
  - Stand `{commit}` und „Design 2“ als Kennzeichen;
  - der Absatz zur Ansicht (wie bisher im Kopf) und der Hinweis (`id="sample-hint"`);
  - „Adresse in der App: …“ (`data-address`);
  - die Umschalter der Ansicht (`children`);
  - „Beispielscheiben öffnen“ (`onView("samples")`) oder in den Beispielen „Zurück zur App“ (`onView("app")`).
- `LaborHeader.tsx` entfällt. `LaborMode`, `LaborView` und `Theme` wandern nach `LaborPanel.tsx`.

### Task 4: Ansichten ohne Kopf

- `CardView`, `ListView`, `PeriodView`, `StartView`, `PlaceholderView` rendern statt `<LaborHeader …>` ein
  `<LaborPanel …>` mit denselben Angaben, ohne Darstellung.
- Die Umschalter der Beispielscheibe (Scheibe, Beispiel, Tippen, Neuer Schuss) wandern als `children` ins Blatt.
- Der Abstand oben der Seiten bleibt (`pt-7`).

### Task 5: Skriptprüfung

- **Helfer:**
  - `laborControls()` ist `$("[data-labor-panel]")`;
  - `inLabor(label)` findet einen Knopf im Blatt;
  - `openLabor()` und `closeLabor()` (Knopf, `requestClose()`).
- **Umstellen:**
  - `button("Beispiele")` → `inLabor("Beispielscheiben öffnen")`;
  - die Knöpfe Scheibe, Beispiel, Ansehen, Setzen, Neuer Schuss → `inLabor(…)`;
  - „Hell“, „Dunkel“, „System“ → im `data-theme-switch` der Seitenleiste;
  - die Adresse (`data-address`) liest weiter aus dem Blatt.
- **Neu:**
  - Keine Ansicht zeigt einen Labor-Kopf (kein „Die Bausteine im Einsatz“ sichtbar).
  - Telefon 375 px: Die Seite einer Scheibe beginnt mit ihrem Titel oben (`CardHeader` innerhalb der ersten
    120 px).
  - Der Knopf „Labor-Werkzeuge“ öffnet das Blatt mit Stand, Adresse und Beispielscheiben.
  - Auf dem Telefon steht der Knopf über der unteren Leiste (Unterkante ≤ Fensterhöhe − 72).
  - Die Darstellung wechselt über die Seitenleiste (Klasse `dark` am `html`) und ist in Profil vorhanden.
  - Über das Blatt öffnet „Beispielscheiben öffnen“ die Beispiele, „Zurück zur App“ kehrt in den letzten Bereich
    zurück.

### Task 6: Doku

- `tools/labor/CLAUDE.md`: kein Kopf, Labor-Knopf und Blatt, Darstellung in Seitenleiste und Profil, Helfer der
  Prüfung.
- `vault/spiegel/spiegel-navigation.md`: Darstellung als Einstellung in Profil (App) und unten in der Seitenleiste
  (Desktop).

## Teststeps

1. `pnpm --filter @vereinsheim/shot-ui test` (AppFrame).
2. Labor direkt bauen, `pnpm --filter @vereinsheim/labor pruefen` → 0 FAIL.
3. `pnpm check` grün vor jedem Commit.

## Verification

- `pnpm check` grün, `vault-lint` gültig, Labor direkt gebaut, `pruefen` 0 FAIL.
- **Screenshots** (Desktop 1280 hell und dunkel, Telefon 390 im Rahmen) von Start, Scheiben, Fortschritt, Scheibe
  und dem offenen Blatt „Labor“; unbeschnitten angesehen.
- Artifact neu veröffentlichen.
