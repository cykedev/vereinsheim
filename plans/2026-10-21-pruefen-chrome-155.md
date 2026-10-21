# Prüfwerkzeug robust gegen Chrome 155

**Status:** vom User beauftragt („Erledige diese Aufgabe hier“). Branch: `feat/pruefen-chrome-155`.

## Context

Seit dem Update auf Chrome 155.0.8059.85 bricht jede Aufnahme und jeder Vergleich des Prüfbestands von Ringwerk mit
„Chrome ist weg“ ab, gleich nach „Build von vor …“. Am 21. Oktober 2026 mit Proben eingegrenzt:

- `Page.captureScreenshot` mit `captureBeyondViewport: true` auf einer sehr hohen Seite (Liste der Wettbewerbe,
  48.442 px) beendet Chrome.
- `Page.getLayoutMetrics` beendet Chrome ebenfalls.
- Hohe Fenster über `Emulation.setDeviceMetricsOverride` und Fotos bis 8.000 px gehen, ebenso Anmelden, Navigieren und
  Tabs.

Damit fehlt der Abgleich vor jedem Merge und Release von Ringwerk ([[ringwerk-pruefbestand]]).

## Approach

In `packages/pruefen/src/browser.ts` fotografieren `Page.screenshot(true)` und `Page.screenshotOf` ohne
`captureBeyondViewport`:

1. Höhe aus dem Dokument (`documentElement.scrollHeight`, `body.scrollHeight`), nicht aus `Page.getLayoutMetrics`.
2. Das emulierte Fenster wächst auf diese Höhe, höchstens auf 16.000 px, dann ein normales Foto (mit `clip` beim
   Element), danach zurück auf die Größe aus `viewport()`.

Kacheln zusammensetzen wäre ohne Abhängigkeit ein eigener PNG-Kodierer. Das lohnt nicht: Die Fotos sieht ein Mensch
durch, streng ist der Text. Seiten über 16.000 px enden im Foto dort, das steht im Code.

Folge für den Ausgangsstand: Ein Fenster in voller Seitenhöhe kann Elemente mit `vh` oder `fixed` anders zeigen als das
alte Foto über das Fenster hinaus. Bilder dürfen sich ändern („Hinweis“), Text und Daten nicht.

## Tasks

- T1 `browser.ts`: privater Helfer `tallShot(height, clip?)`, `screenshot(true)` und `screenshotOf` darüber;
  `packages/pruefen/CLAUDE.md` nennt die Grenze. Commit `fix(pruefen): take full-page shots without captureBeyondViewport`.
- T2 Vault: [[ringwerk-pruefbestand]] Stand. Commit `docs: record the Chrome 155 workaround of the check tool`.

## Verification

- `pnpm check` grün.
- Ringwerk: `pnpm --filter ringwerk build`, dann `pruefen:vergleichen --referenz <Aufnahme von main mit demselben
  Umweg>` auf demselben Aufbau läuft durch, 0 Fehler (Code von Ringwerk wie `main`).
- Spiegel `pnpm --filter spiegel pruefen` nur, wenn es ohne Eingriff in die Dev-Daten läuft; sonst im Bericht als
  „nicht belegt“.
