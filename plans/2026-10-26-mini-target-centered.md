# Plan: Kleine Scheiben einheitlich ausrichten (Spiegel mittig und gleich groß)

> PIV-Handoff-Artefakt. Branch `feat/mini-target-centered`, im aktuellen Tree (kein Worktree, sofern der User nichts
> anderes festlegt, ADR-024). Keine ADR berührt, kein Schema, keine Migration, keine neue Brücke nötig.

## Context (warum)

Auf Start stehen die Scheiben eines Abends als Kacheln nebeneinander. Der Spiegel sitzt in jeder Kachel woanders und
ist verschieden groß; bei einer engen Gruppe ist die Kachel ganz schwarz. Ursache: Jede kleine Scheibe, die für sich
steht, rechnet ihren Ausschnitt mit `groupView` um die Gruppe ihrer Treffer. Gemessen an den Dev-Daten (26.10.2026):

- Start, Abend 16.10.: zwei Kacheln mit Ausschnitt 53 mm und 98 mm, die Mitte der Scheibe 22 % nach rechts bzw.
  18 % nach unten aus der Kachel verschoben.
- Liste, Luftpistole, 31 Scheiben: Ausschnitt von 53 bis 129 mm (Faktor 2,4), Mitte bis 22 % verschoben.
- Fortschritt, Ablesung: dieselbe Ursache, der Spiegel springt, wenn man eine andere Scheibe wählt.

Betroffen sind genau die vier Stellen, die `MiniTarget` mit `groupView` füttern:

| Ansicht | Stelle |
| --- | --- |
| Start, Kacheln des Abends | `packages/shot-ui/src/start/EveningBlock.tsx:175-180` |
| Scheiben-Liste | `packages/shot-ui/src/list/EveningList.tsx:235-240` |
| Fortschritt, Ablesung einer Scheibe | `packages/shot-ui/src/period/CardReadout.tsx:141` |
| Offen | `apps/spiegel/src/components/open/OpenScreen.tsx:98-103` |

Nicht betroffen und unverändert: die Serien (`SeriesStrip`, `seriesTileView`: schon um die Mitte, ein Ausschnitt für
alle Serien einer Scheibe), die große Scheibe (`TargetView`, anfangs die ganze Scheibe, „Gruppe“ auf Wunsch über
`groupView`), das Trefferbild eines Zeitraums (`PatternTarget`, um die Mitte) und Vergleichen (`ComparePicture`,
öffnet absichtlich auf der Gruppe, ein einzelnes Bild mit Lupe).

Der User hat am 26.10.2026 vier Varianten an echten Dev-Daten verglichen und **Variante C** gewählt („visuell
runder“): Mitte der Scheibe in der Mitte der Kachel, der Spiegel immer gleich groß, nur ein Ausreißer vergrößert den
Ausschnitt.

## Approach

1. **Neuer Ausschnitt `miniView(target, points)`** in `packages/shot-ui/src/geometry.ts`, rein und mit Handwerten
   getestet:
   - um die Mitte: `{ x: -half, y: -half, w: 2 * half }`
   - `half = min(Ring 1 + halbes Kaliber, max(Radius des Spiegels × 1,6, (weitester Treffer in x oder y + halbes Kaliber) × 1,12))`
   - Radius des Spiegels wie in `TargetFace`: `ringRadiiUm[blackFromRing - 1]`.
   - Ergebnis: Luftpistole halbe Breite 47,6 mm (bis Ring 5), Luftgewehr 24,4 mm (fast die ganze Scheibe); der
     Spiegel nimmt in beiden 62,5 % der Kachel ein.
   - Die Reichweite (weitester Treffer in x oder y plus halbes Kaliber) teilen `miniView` und `seriesTileView` über
     eine private Hilfsfunktion `reachMm`, statt sie zweimal zu schreiben.
2. **`MiniTarget` nimmt `miniView` als Vorgabe:** `view` wird optional. Ohne `view` rechnet `MiniTarget` den
   Ausschnitt mit `miniView` über seine eigenen Treffer mit Lage. Nur die Serien geben weiter ihren gemeinsamen
   Ausschnitt mit. So ist die einheitliche Ausrichtung der Normalfall, und eine neue kleine Scheibe kann nicht
   versehentlich wieder auf die Gruppe zoomen.
3. **Die vier Stellen lassen `view` weg** und importieren `groupView` nicht mehr.
4. **Doku nachziehen:** Vault `spiegel-ui-design` („Zeichnen der Scheibe“), `packages/shot-ui/CLAUDE.md` (Zeilen
   `geometry` und `MiniTarget`), der Kommentar an `MiniTargetProps.view`.

## Files to change

| Datei | Task | Änderung |
| --- | --- | --- |
| `packages/shot-ui/src/geometry.ts` | T1 | `reachMm` (privat), `miniView` (exportiert), `seriesTileView` nutzt `reachMm` |
| `packages/shot-ui/src/geometry.test.ts` | T1 | `describe("Kleine Scheibe für sich")` mit Handwerten |
| `packages/shot-ui/src/target/MiniTarget.tsx` | T2 | `view?: ViewBox`, Vorgabe `miniView` über die Treffer mit Lage |
| `packages/shot-ui/src/target/MiniTarget.test.tsx` | T2 | Test der Vorgabe |
| `packages/shot-ui/src/start/EveningBlock.tsx` | T3 | `view` weg, Import `groupView` weg |
| `packages/shot-ui/src/start/EveningBlock.test.tsx` | T3 | Kacheln stehen um die Mitte, Spiegel gleich groß |
| `packages/shot-ui/src/list/EveningList.tsx` | T3 | `view` weg, Import `groupView` weg |
| `packages/shot-ui/src/list/EveningList.test.tsx` | T3 | kleine Scheiben stehen um die Mitte |
| `packages/shot-ui/src/period/CardReadout.tsx` | T3 | `view` weg, Import `groupView` weg |
| `packages/shot-ui/src/period/CardReadout.test.tsx` | T3 | kleine Scheibe steht um die Mitte |
| `apps/spiegel/src/components/open/OpenScreen.tsx` | T3 | `view` weg, Import `groupView` weg |
| `vault/spiegel/spiegel-ui-design.md` | T4 | Regel „Kleine Scheiben für sich“, Keywords |
| `packages/shot-ui/CLAUDE.md` | T4 | `miniView` in der Zeile `geometry`, Vorgabe in der Zeile `MiniTarget` |

## Required Docs

- `packages/shot-ui/CLAUDE.md` (Regeln, besonders „Reine Funktionen getrennt von React“ und Markup-Tests)
- `vault/spiegel/spiegel-ui-design.md`, Abschnitt „Zeichnen der Scheibe“
- `vault/conventions.md` §9 („Charakterisierungstests müssen die falsche Quelle erkennen können“, „Eigenschaftstests
  per Mutation gegenprüfen“, „`toBeCloseTo` nimmt `null` als 0“)

## Tasks

### T1 — `miniView` in der Geometrie (Test zuerst)

In `packages/shot-ui/src/geometry.test.ts` `miniView` importieren und nach `describe("Serien als kleine Scheiben")`
einfügen (Handwerte: LP Spiegel ab Ring 7, Radius 5,75 + 3 · 8 = 29,75 mm; LG Spiegel ab Ring 4, Radius
0,25 + 6 · 2,5 = 15,25 mm):

```ts
describe("Kleine Scheibe für sich", () => {
  it("um die Mitte, der Spiegel überall gleich groß: halbe Breite = Radius des Spiegels × 1,6", () => {
    // LP: 29,75 · 1,6 = 47,6; ohne Treffer und mit Treffern innerhalb derselbe Ausschnitt
    close(miniView(LP_10M, []), -47.6, -47.6, 95.2)
    // weitester Treffer 40 mm in y: (40 + 2,25) · 1,12 = 47,32 < 47,6
    close(miniView(LP_10M, [{ xUm: 10000, yUm: -40000 }]), -47.6, -47.6, 95.2)
    // LG: 15,25 · 1,6 = 24,4 < Ring 1 plus halbes Kaliber (25)
    close(miniView(LG_10M, [{ xUm: 1000, yUm: 500 }]), -24.4, -24.4, 48.8)
  })

  it("ein Treffer weiter außen vergrößert den Ausschnitt, weiter um die Mitte", () => {
    // LP: Treffer bei x = 50 mm: (50 + 2,25) · 1,12 = 58,52
    close(miniView(LP_10M, [{ xUm: 50000, yUm: 3000 }]), -58.52, -58.52, 117.04)
    // LG: Treffer bei x = 20 mm: (20 + 2,25) · 1,12 = 24,92
    close(miniView(LG_10M, [{ xUm: 20000, yUm: 0 }]), -24.92, -24.92, 49.84)
  })

  it("höchstens Ring 1 plus halbes Kaliber", () => {
    // LP: (75 + 2,25) · 1,12 = 86,52 > 77,75 + 2,25 = 80
    close(miniView(LP_10M, [{ xUm: 0, yUm: -75000 }]), -80, -80, 160)
    // LG: (30 + 2,25) · 1,12 = 36,12 > 25
    close(miniView(LG_10M, [{ xUm: 30000, yUm: 0 }]), -25, -25, 50)
  })
})
```

Test laufen lassen, rot (Import fehlt): `pnpm --filter @vereinsheim/shot-ui exec vitest run src/geometry.test.ts`.

Dann in `packages/shot-ui/src/geometry.ts` vor `seriesTileView`:

```ts
/** weitester Treffer in x oder y plus halbes Kaliber, in mm; ohne Treffer −∞ */
const reachMm = (target: TargetImage, points: readonly Point[]) =>
  Math.max(-Infinity, ...points.map((p) => Math.max(Math.abs(mm(p.xUm)), Math.abs(mm(p.yUm))))) +
  caliberRadius(target)

/** halbe Breite einer kleinen Scheibe für sich, gemessen am Radius des Spiegels */
const MINI_SPIEGEL = 1.6

/**
 * Ausschnitt einer kleinen Scheibe, die für sich steht (Start, Liste, Ablesung, Offen): um die Mitte, und der Spiegel
 * ist überall gleich groß (halbe Breite = Radius des Spiegels × 1,6). So stehen die Spiegel nebeneinander auf einer
 * Linie, und eine Scheibe sieht überall gleich aus. Nur ein Treffer weiter außen vergrößert den Ausschnitt, weiter um
 * die Mitte: weitester Treffer (in x oder y) plus halbes Kaliber, 12 % Luft, höchstens Ring 1 plus halbes Kaliber.
 */
export function miniView(target: TargetImage, points: readonly Point[]): ViewBox {
  const spiegel = mm(target.ringRadiiUm[target.blackFromRing - 1]) * MINI_SPIEGEL
  const half = Math.min(
    mm(target.ringRadiiUm[0]) + caliberRadius(target),
    Math.max(spiegel, reachMm(target, points) * 1.12)
  )
  return { x: -half, y: -half, w: 2 * half }
}
```

und `seriesTileView` auf `reachMm` umstellen (Verhalten gleich, die bestehenden Tests bleiben grün):

```ts
export function seriesTileView(target: TargetImage, points: readonly Point[]): ViewBox {
  const calR = caliberRadius(target)
  const half = Math.min(
    mm(target.ringRadiiUm[0]) + calR,
    Math.max(reachMm(target, points) * 1.12, calR * 6)
  )
  return { x: -half, y: -half, w: 2 * half }
}
```

Test grün: `pnpm --filter @vereinsheim/shot-ui exec vitest run src/geometry.test.ts`.
Commit: `feat(shot-ui): centred view for a small target on its own`.

### T2 — `MiniTarget` nimmt `miniView` als Vorgabe

Test zuerst, in `packages/shot-ui/src/target/MiniTarget.test.tsx` im `describe("MiniTarget")`:

```ts
it("ohne Ausschnitt um die Mitte, der Spiegel gleich groß (miniView über die Treffer mit Lage)", () => {
  // LG, Treffer bei 0, 0,8 und 1,5 mm: innerhalb, also 15,25 · 1,6 = 24,4
  const html = renderToStaticMarkup(createElement(MiniTarget, { target: LG_10M, shots: SHOTS }))
  expect(html).toContain('viewBox="-24.4 -24.4 48.8 48.8"')
  // ein Treffer bei 20 mm vergrößert ihn: (20 + 2,25) · 1,12 = 24,92
  const wide = renderToStaticMarkup(
    createElement(MiniTarget, { target: LG_10M, shots: [...SHOTS, shot("match", 20000, 30)] })
  )
  expect(wide).toContain('viewBox="-24.92 -24.92 49.84 49.84"')
})
```

Rot laufen lassen, dann in `packages/shot-ui/src/target/MiniTarget.tsx`:

- Import `miniView` aus `../geometry` dazu.
- Prop:
  ```ts
  /**
   * Ausschnitt in mm; ohne ihn `miniView` über die eigenen Treffer (um die Mitte, der Spiegel überall gleich groß).
   * Die Serien geben ihren gemeinsamen Ausschnitt mit (`seriesTileView`).
   */
  view?: ViewBox
  ```
- In der Funktion: Parameter `view: given` statt `view: computed`, dann
  ```ts
  const drawn = shots.filter(hasPosition)
  const computed =
    given ?? miniView(target, drawn.map((shot) => ({ xUm: shot.xUm as number, yUm: shot.yUm as number })))
  const view = { x: fixed(computed.x), y: fixed(computed.y), w: fixed(computed.w) }
  ```
  und unten `drawn.map(…)` statt `shots.filter(hasPosition).map(…)`.
- Docstring der Komponente: „Kleine Scheibe (Serien, Liste, Start, Ablesung einer Scheibe, Offen) …“ statt „(aus den
  Serien, `SeriesStrip`) … Auch in der Ablesung einer Scheibe auf der Seite eines Zeitraums.“

Test grün: `pnpm --filter @vereinsheim/shot-ui exec vitest run src/target/MiniTarget.test.tsx`.
Commit: `feat(shot-ui): small targets default to the centred view`.

### T3 — die vier Stellen auf die Vorgabe umstellen

Tests zuerst. Ein gemeinsamer Prüfer je Testdatei (lokal, kein neues Modul), der aus dem Markup alle `viewBox` der
kleinen Scheiben liest:

```ts
/** jede kleine Scheibe im Markup: steht sie um die Mitte, und wie breit ist sie */
const miniViews = (html: string) =>
  [...html.matchAll(/<svg viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) [\d.]+"/g)].map((m) => ({
    x: Number(m[1]),
    y: Number(m[2]),
    w: Number(m[3]),
  }))
const centred = (v: { x: number; y: number; w: number }) =>
  Math.abs(v.x + v.w / 2) < 0.001 && Math.abs(v.y + v.w / 2) < 0.001
```

- `packages/shot-ui/src/start/EveningBlock.test.tsx`, im `describe("Block des letzten Abends auf Start")`: das
  Markup aus `render(CARDS)` (Zeile 74) erst ab dem ersten `data-start-card` lesen, damit Symbol und Verlauf davor
  nicht mitzählen. Erwartung: mindestens eine kleine Scheibe, alle um die Mitte, alle mindestens so breit, wie der
  Spiegel der Luftpistole verlangt (`w >= 95.2 - 0.001`):
  ```ts
  it("die kleinen Scheiben stehen um die Mitte, der Spiegel gleich groß", () => {
    const tiles = miniViews(html.slice(html.indexOf("data-start-card")))
    expect(tiles.length).toBeGreaterThan(0)
    expect(tiles.every(centred)).toBe(true)
    expect(tiles.every((v) => v.w >= 95.2 - 0.001)).toBe(true)
  })
  ```
- `packages/shot-ui/src/list/EveningList.test.tsx`, im ersten `describe`: dasselbe für die Liste mit LG aus
  `render()` (Zeile 67), ab dem ersten `<tbody` gelesen, `w >= 48.8 - 0.001`.
- `packages/shot-ui/src/period/CardReadout.test.tsx`, im `describe("Ablesung einer Scheibe")`: die gerenderte
  Ablesung mit `marks` (wie Zeile 71) hat genau eine kleine Scheibe um die Mitte, `w >= 48.8 - 0.001`.

Rot laufen lassen: `pnpm --filter @vereinsheim/shot-ui exec vitest run src/start src/list src/period/CardReadout.test.tsx`.

Dann an den vier Stellen `view={groupView(…)}` streichen und den Import `groupView` entfernen:

- `packages/shot-ui/src/start/EveningBlock.tsx`: `<MiniTarget target={target} shots={placed} className="size-14 shrink-0" />`
- `packages/shot-ui/src/list/EveningList.tsx`: `<MiniTarget target={target} shots={placed} className="size-8" />`
- `packages/shot-ui/src/period/CardReadout.tsx`: `<MiniTarget target={target} shots={marks} />`
- `apps/spiegel/src/components/open/OpenScreen.tsx`: `<MiniTarget target={target} shots={marks} className="size-14 shrink-0" />`

Danach darf `groupView` nur noch in `geometry.ts`, `geometry.test.ts` und `target/TargetView.tsx` vorkommen:
`grep -rn "groupView" packages/shot-ui/src apps/spiegel/src` prüfen.

Tests grün (Befehl wie oben, dazu `pnpm --filter spiegel exec vitest run src/components/open`).
Commit: `fix(spiegel): align the mirror in every small target`.

### T4 — Doku

- `vault/spiegel/spiegel-ui-design.md`, Abschnitt „Zeichnen der Scheibe“, direkt nach dem Punkt „Serien als kleine
  Scheiben“ einfügen:
  > - **Kleine Scheiben für sich** (Start, Liste, Ablesung im Fortschritt, Offen): Die Mitte der Scheibe steht in der
  >   Mitte der Kachel, und der Spiegel ist überall gleich groß: Die halbe Breite ist der Radius des Spiegels mal 1,6,
  >   bei der Luftpistole bis Ring 5, beim Luftgewehr fast die ganze Scheibe. Nur ein Treffer weiter außen vergrößert
  >   den Ausschnitt, weiter um die Mitte (weitester Treffer in x oder y plus halbes Kaliber, 12 % Luft, höchstens
  >   Ring 1 plus halbes Kaliber). So stehen die Spiegel nebeneinander auf einer Linie, und eine Scheibe sieht auf
  >   Start, in der Liste und im Fortschritt gleich aus. Ein Ausschnitt um die Gruppe je Kachel ließe den Spiegel von
  >   Kachel zu Kachel springen und eine enge Gruppe ganz schwarz erscheinen. `MiniTarget` rechnet ihn ohne `view`
  >   selbst (`miniView`); nur die Serien geben ihren gemeinsamen Ausschnitt mit.
  In der `keywords:`-Zeile der Note `kleine scheibe ausschnitt mitte spiegel gleich groß kachel` ergänzen.
- `packages/shot-ui/CLAUDE.md`: Zeile `geometry` → „Ausschnitte (`targetView`, `groupView`, `seriesTileView`,
  `miniView`: kleine Scheibe für sich, um die Mitte, Spiegel gleich groß)“; Zeile `MiniTarget` → „… Ausschnitt auf
  1 µm, ohne `view` `miniView` über die eigenen Treffer; …“.
- `pnpm --filter @vereinsheim/shot-ui exec prettier --write CLAUDE.md` (Prettier richtet die Tabelle aus;
  `format:check` prüft die Datei).
- `node .claude/vault-lint.mjs` grün.

Commit: `docs: small targets centred with the mirror always the same size`.

## Verification

1. `pnpm check` grün (alle fünf Gates).
2. **Gegenprobe per Mutation** (conventions §9; Dateien vorher mit `cp` sichern, nicht `git checkout`):
   - in `miniView` `MINI_SPIEGEL` auf `0` setzen → „Kleine Scheibe für sich“ und der Test der Vorgabe in
     `MiniTarget.test.tsx` werden rot;
   - in `EveningBlock.tsx` wieder `view={groupView(target, placed)}` setzen → der neue Test in
     `EveningBlock.test.tsx` wird rot. Danach aus der Sicherung zurückspielen.
3. **Im Browser an den Dev-Daten** (Dev-Server `spiegel`, User ist angemeldet): auf `/`, `/cards` (Luftpistole und
   Luftgewehr) und `/progress` per JavaScript alle `svg[aria-hidden][viewBox]` mit Treffern lesen: jede steht um die
   Mitte (`x = y = −w/2`), Luftpistole meist `w = 95,2`, Luftgewehr meist `48,8`; nur Scheiben mit einem Treffer
   außerhalb breiter. Screenshot von Start und Liste als Beleg.
4. `pnpm --filter spiegel pruefen` gegen den laufenden Dev-Server: keine neuen FAILs (die kleinen Scheiben sind
   Links; die Prüfung klickt sie).
5. Offen hat in den Dev-Daten keine wartende Scheibe: im Bericht als „nicht belegt“ führen, abgedeckt durch den
   Test der Vorgabe in `MiniTarget.test.tsx` und die gleiche Zeile wie auf Start.
