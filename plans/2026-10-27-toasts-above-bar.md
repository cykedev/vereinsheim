# Toasts über der unteren Leiste (alle drei Apps)

Branch `feat/toasts-above-bar`, Kindsession nach ADR-035. Lösung nur in `packages/ui`, keine Fachlogik, keine Datei
einer App.

## Context

Am Telefon verdecken die Toasts (sonner) die untere Leiste von `AppFrame`. Nachgestellt am 27. Oktober 2026 im
Worktree (Dev-Server :3020–:3022, Toast über das sonner-Modul der Seite ausgelöst):

| Fenster                     | heute                                                                  |
| --------------------------- | ---------------------------------------------------------------------- |
| Telefon 375 × 812, hell/dunkel | Toast liegt auf der Leiste (Spiegel, Treffsicher, Ringwerk gleich)     |
| Tablet hoch 768 × 1024      | Toast unten rechts auf „Fortschritt/Profil“ der Leiste                 |
| Telefon quer 812 × 375      | unten rechts, frei (die schmale Leiste steht links)                    |
| Desktop ab 1024 px          | unten rechts, frei                                                     |

Ursache, zwei Teile:

1. `--app-bar` (Platz der unteren Leiste) setzt `AppFrame` als Klasse an seiner Wurzel
   (`[--app-bar:72px] lg:[--app-bar:0px] max-lg:[@media(max-height:499px)]:[--app-bar:0px]`). Der `Toaster` steht in
   jeder App im Root-Layout neben dem Rahmen, nicht darin, und erbt die Variable nicht. `UndoBar` und `ReturnPill`
   stehen im Rahmen und nutzen sie schon (`bottom-[calc(var(--app-bar,0px)+env(safe-area-inset-bottom)+…)]`).
2. sonner kennt nur Abstände zum Fensterrand: `--offset-*` (24 px) über 600 px Breite, `--mobile-offset-*` (16 px)
   bis 600 px. Die Leiste steht aber bis 1023 px, also auch im Bereich 601–1023 px mit dem Desktop-Abstand.

## Approach

**Der Platz des Rahmens wird ein Token der Seite.** `--app-bar` (und neu `--app-rail`, die Breite der schmalen Leiste)
stehen in `design2.css` auf `:root:has([data-app-frame])`, mit denselben Grenzen wie die Klassen des Rahmens. Damit
erbt jedes Element der Seite den Wert, auch der `Toaster` außerhalb des Rahmens; Seiten ohne Rahmen (Anmeldung,
Fehlerseiten ohne Rahmen) haben keinen und bleiben, wie sie sind. `AppFrame` setzt die Variable nicht mehr selbst,
sondern nutzt sie; die 72 px und die Breite der schmalen Leiste stehen danach genau einmal im Code.

**Der Toaster rechnet seinen Abstand aus dem Token und der sicheren Fläche** (`offset`/`mobileOffset` von sonner, nur
die betroffenen Seiten; die übrigen behalten sonners Vorgabe):

- unten, über 600 px: `calc(var(--app-bar, 0px) + env(safe-area-inset-bottom) + 24px)` (24 px = sonners Vorgabe,
  ab Desktop ist `--app-bar` 0 und `env(…)` 0: wie heute),
- unten, bis 600 px: `calc(var(--app-bar, 0px) + env(safe-area-inset-bottom) + 16px)` (16 px = `EDGE_PX`),
- links, bis 600 px: `calc(var(--app-rail, 0px) + 16px)`: Ein Telefon quer unter 600 px Breite (etwa 568 × 320)
  legte den Toast sonst über die schmale Leiste.

Verworfen:

- **Toaster in den Rahmen** (wie `UndoHost`): Änderung in jeder App, und Seiten ohne Rahmen hätten keine Toasts oder
  einen zweiten Toaster (sonner zeigt dann jeden Toast doppelt).
- **72 px im Toaster wiederholen** (eigene Medienabfragen dort): eine Zahl zum zweiten Mal, läuft auseinander.
- **`--app-bar` unbedingt auf `:root`**: hebt die Toasts auch auf Seiten ohne Leiste an.

`:has()` können alle Browser seit Ende 2023 (Safari 15.4, Chrome 105, Firefox 121). Ohne `:has()` fiele `--app-bar`
aus, dann rutschte auch der Abstand der Seite unter die Leiste; deshalb steht die Unterstützung hier, ein Fallback
lohnt nicht.

Dialoge und Blätter: sonner liegt wie heute über allem (eigener `z-index`), daran ändert sich nichts. Ein Toast neben
dem Hinweis „Rückgängig“ (`UndoBar`, 12 px über der Leiste) läge jetzt auf derselben Höhe. Heute löst keine Aktion
beides aus (`useUndo` nur in `DeleteCard` von Spiegel, ohne Toast); als Restrisiko im Bericht.

Ringwerk: dasselbe Paket, nur Lage auf dem Bildschirm, keine Fachlogik. Die Leiste von Ringwerk hat keine Aktion in der
Mitte, `--app-bar` ist dort wie heute trotzdem 72 px (wie der Abstand der Seite): Der Toast steht 16 px höher als
nötig, auf derselben Höhe wie „Rückgängig“.

## Files

| Datei                                                   | Änderung                                                                                  |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `packages/ui/design2.css`                               | Block „Platz des Rahmens“: `--app-bar`, `--app-rail` auf `:root:has([data-app-frame])`    |
| `packages/ui/src/design2/app-frame.tsx`                 | Klassen `[--app-bar:…]` weg, schmale Leiste und Inhalt über `--app-rail`                  |
| `packages/ui/src/design2/toaster.tsx`                   | `offset`, `mobileOffset` aus `--app-bar`, `--app-rail`, `env(safe-area-inset-bottom)`     |
| `packages/ui/src/design2/frame-space.test.ts` (neu)     | Token-Test der CSS-Blöcke                                                                 |
| `packages/ui/src/design2/toaster.test.tsx`              | Abstände des Toasters                                                                     |
| `packages/ui/src/design2/app-frame.test.tsx`            | Rahmen setzt kein `--app-bar` mehr, nutzt `--app-rail`                                    |
| `packages/shot-ui/src/layout/AppFrame.test.tsx`         | Erwartung `[--app-bar:72px]` an der Wurzel ersetzen                                       |
| `packages/ui/CLAUDE.md`, `packages/shot-ui/CLAUDE.md`, `vault/spiegel/spiegel-navigation.md` | wer `--app-bar` setzt; Toaster über der Leiste |

Keine Datei unter `apps/*`. `vault/conventions.md` §10 nur, wenn die Regel „Was unten fest steht, richtet sich nach
`--app-bar`“ dort hingehört: Sie steht heute nirgends als Regel, nur je Baustein; bleibt deshalb in den CLAUDE.md der
Pakete.

## Required Docs

- `packages/ui/CLAUDE.md` (Regeln des Pakets, Tabelle der Bausteine)
- `vault/conventions.md` §8 (Drift-Gate über `packages/ui/src`), §10 (Design 2)
- `packages/shot-ui/CLAUDE.md` Abschnitt Rahmen (`--app-bar`, `ReturnPill`, `useTargetFit`)
- sonner 2.0.8 `dist/styles.css` (Medienabfrage `max-width: 600px`, `--offset-*`, `--mobile-offset-*`) und
  `assignOffset` in `dist/index.mjs` (Objekt: fehlende Seiten bekommen die Vorgabe)

## Tasks

### T1 Token: Platz des Rahmens in `design2.css`

Nach den Blöcken `.dark[data-app=…]`, vor `@layer base`:

```css
/* Platz, den der Rahmen der App (`AppFrame`, `data-app-frame`) am Rand einnimmt; nur auf Seiten mit Rahmen. Auf
   `:root`, damit auch, was neben dem Rahmen steht (Toasts), danach rückt. Grenzen wie die Leisten in `app-frame.tsx`:
   untere Leiste unter 1024 px, schmale Leiste links unter 1024 px und unter 500 px hoch. */
:root:has([data-app-frame]) {
  /* untere Leiste 56 px (`h-14`) und die Aktion, die 16 px darüber ragt (`-mt-4`) */
  --app-bar: 72px;
  --app-rail: 0px;
}

@media (width >= 64rem) {
  :root:has([data-app-frame]) {
    --app-bar: 0px;
  }
}

@media (width < 64rem) and (max-height: 499px) {
  :root:has([data-app-frame]) {
    --app-bar: 0px;
    --app-rail: calc(4rem + env(safe-area-inset-left));
  }
}
```

### T2 `AppFrame` nutzt das Token

In `app-frame.tsx`:

- Wurzel: die Klassen `[--app-bar:72px] lg:[--app-bar:0px]` und `max-lg:[@media(max-height:499px)]:[--app-bar:0px]`
  entfallen; `data-app-frame` bleibt (der Anker des Tokens). Der Doc-Kommentar sagt: Die Wurzel trägt
  `data-app-frame`, `design2.css` setzt daran `--app-bar` und `--app-rail`.
- schmale Leiste: `w-[calc(4rem+env(safe-area-inset-left))]` → `w-(--app-rail)`.
- Inhalt: `max-lg:[@media(max-height:499px)]:pl-[calc(4rem+env(safe-area-inset-left))]` →
  `max-lg:[@media(max-height:499px)]:pl-(--app-rail)`.
- `pb-[calc(var(--app-bar)+env(safe-area-inset-bottom))]` bleibt.

### T3 `Toaster` über der Leiste

In `toaster.tsx`, vor `{...props}` (die App kann weiter überschreiben):

```tsx
offset={{ bottom: "calc(var(--app-bar, 0px) + env(safe-area-inset-bottom) + 24px)" }}
mobileOffset={{
  bottom: `calc(var(--app-bar, 0px) + env(safe-area-inset-bottom) + ${EDGE_PX}px)`,
  left: `calc(var(--app-rail, 0px) + ${EDGE_PX}px)`,
}}
```

`EDGE_PX` aus `./bar`. Der Doc-Kommentar nennt den Grund: sonner wechselt erst unter 600 px auf den Abstand fürs
Telefon, die Leiste steht bis 1024 px, deshalb beide Abstände.

### T4 Tests

- `frame-space.test.ts` (neu, wie `tokens.test.ts` über den Text von `design2.css`): Block
  `:root:has([data-app-frame])` mit `--app-bar: 72px` und `--app-rail: 0px`; in `@media (width >= 64rem)` `--app-bar:
  0px`; in `@media (width < 64rem) and (max-height: 499px)` `--app-bar: 0px` und `--app-rail: calc(4rem +
  env(safe-area-inset-left))`; der Selektor kommt nur in diesen drei Blöcken vor. Dazu: Die Grenzen sind dieselben wie
  die Klassen in `app-frame.tsx` (`lg:` und `max-lg:[@media(max-height:499px)]:` kommen dort vor, `[--app-bar:` nicht
  mehr).
- `toaster.test.tsx`: `offset.bottom` und `mobileOffset.bottom` enthalten `var(--app-bar, 0px)` und
  `env(safe-area-inset-bottom)`; `mobileOffset.left` enthält `var(--app-rail, 0px)`; `top`/`right` fehlen (sonners
  Vorgabe); die App kann `offset` überschreiben.
- `app-frame.test.tsx`: Wurzel ohne `--app-bar:`, mit `data-app-frame`; schmale Leiste `w-(--app-rail)`; Inhalt
  `pl-(--app-rail)` im Querformat und `pb-[calc(var(--app-bar)+env(safe-area-inset-bottom))]`.
- `shot-ui/src/layout/AppFrame.test.tsx`: Erwartung „Platz für die Leiste als --app-bar“ auf die neue Form (Wurzel mit
  `data-app-frame` ohne Klasse `[--app-bar`, `main` unverändert), Rail-Erwartung (Zeile 80–82) auf `--app-rail`.
- **Mutationsprobe** (Sicherung per `cp`, nicht `git checkout`): (a) in `toaster.tsx` `var(--app-bar, 0px) + ` aus
  `mobileOffset.bottom` entfernen → `toaster.test.tsx` rot; (b) in `design2.css` `--app-bar: 72px` → `0px` →
  `frame-space.test.ts` rot; (c) den Block für `width >= 64rem` löschen → rot. Ergebnisse in den Bericht.

### T5 Doku

- `packages/ui/CLAUDE.md`: Zeile `design2/toaster` „über der unteren Leiste (`--app-bar`) und neben der schmalen
  (`--app-rail`)“; Zeile `design2/app-frame`: „`design2.css` setzt `--app-bar`/`--app-rail` an `:root`, solange ein
  Rahmen da ist“; unter Regeln ein Satz: Was unten fest steht (Toaster, `UndoBar`, `ReturnPill`), rückt über
  `--app-bar` und `env(safe-area-inset-bottom)`, nie mit eigener Zahl.
- `packages/shot-ui/CLAUDE.md` Zeile 269 und `vault/spiegel/spiegel-navigation.md` Zeile 130: „Die Wurzel setzt
  `--app-bar`“ → „`design2.css` setzt `--app-bar` an `:root`, solange der Rahmen da ist; die Toasts stehen darüber“.

### T6 Prüfung im Browser (je App, vor dem Gate)

Dev-Server aus dem Worktree (Spiegel :3022 Demo-Konto, Treffsicher :3021 Prüfkonto, Ringwerk :3020 gegen
`ringwerk_pruef`), Toast über das sonner-Modul der Seite, Screenshots nach dem Muster der Vorher-Bilder:

- Telefon 375 × 812 hell und dunkel: Toast über der Leiste, Leiste und Aktion frei (alle drei Apps).
- Tablet 768 × 1024: Toast unten rechts über der Leiste.
- Telefon quer 812 × 375 und 568 × 320: nicht über der schmalen Leiste.
- Desktop 1280 × 800: `getComputedStyle` des Toasters `bottom` = 24 px wie vorher.
- Anmeldung (ohne Rahmen): `--app-bar` leer, Toast 16 px über dem Rand wie vorher.
- `HelpSheet` offen und Toast: Lage wie heute (sonner darüber).
- `main` behält seinen Abstand unten (`padding-bottom` 72 px am Telefon), die Pille „Zurück zu …“ (Spiegel) steht
  wie vorher.

## Verification

- `pnpm check` im Worktree grün (der Stop-Hook prüft den Haupt-Checkout).
- `node .claude/vault-lint.mjs` grün.
- `bash scripts/consistency-check.sh` grün (Regeln von Design 2 in `packages/ui/src`).
- Mutationsprobe wie in T4, alle drei rot, danach wiederhergestellt und grün.
- Screenshots vorher/nachher je App im Bericht `reports/2026-10-27-toasts-above-bar-validate.md`.
- Nicht belegt bleiben: echtes iPhone mit Home-Indikator (`env(safe-area-inset-bottom)` > 0) – im Browser 0.
