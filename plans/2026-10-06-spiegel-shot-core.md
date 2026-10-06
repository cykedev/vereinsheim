# SP-1.1 Fachkern: Scheibenbilder und Wertung (`packages/shot-core`)

**Datum:** 2026-10-06 · **Branch:** `feat/spiegel-shot-core` · **Paket:** `@vereinsheim/shot-core` (neu) ·
**Roadmap:** SP-1.1 in `vault/spiegel/spiegel-roadmap.md`

## 1. Context (warum)

Spiegel rechnet jeden Schuss selbst nach: für die Gegenprobe gegen die amtlichen Werte, für die
Neu-Wertung bei falscher Disziplin und später für alle Kennzahlen. Dafür braucht es einen Fachkern,
der Scheibenbilder als Daten kennt, Meyton-DisziplinIDs auflöst und Meytons Wertung **exakt**
nachrechnet.

Das ist der erste Code für Spiegel, und er hängt an nichts, was die Erkundung vor Ort (Phase 0) noch
klären muss: Die Maße stehen in der Sportordnung, die Formel stimmt an allen sechs Teilern des
Ausdrucks vom 2. Oktober und an drei ShotsApp-Werten, und die Wertung hängt nur vom Abstand zur Mitte
ab (die Achsenrichtung spielt keine Rolle). Die Skalen der Datenbankfelder gehören in den Adapter
(SP-1.6). Noch hängt keine App an dem Paket; Images und Deploy-Vertrag bleiben unberührt.

## 2. Entscheidungen

**E1: Paket nach dem Muster von `packages/lib`.** Just-in-time (TS-Source, kein Build-Schritt),
Subpath-Exports, `vitest`, Skripte `check-types`, `test`, `format:check`, `format`; kein
`lint`-Skript (wie `lib` und `ui`). Keine Laufzeit-Dependencies, isomorph: kein `server-only`, keine
Node-APIs. So können Server (Ingest) und Client (Prototyp-Ansichten) dieselben Funktionen nutzen.

**E2: Längen als ganze Mikrometer.** Scheibenbilder werden in mm notiert (wie in der Sportordnung)
und von `defineTarget` in µm umgerechnet. `defineTarget` lehnt Maße ab, die keine ganzen µm ergeben,
und Ringabstände, deren Zehntel kein ganzes µm ist. Damit liegt jede Zehntelgrenze auf einem ganzen
µm.

**E3: Exakte Wertung statt Gleitkomma.** Die Zehntelgrenze für den Wert k (in Zehnteln, 109 = 10,9)
ist `b(k) = R − (k − 100) · W / 10` mit R = Zehnerradius + halbes Kaliber und W = Ringabstand, also
eine ganze Zahl in µm. Aus Koordinaten vergleicht die Wertung `x² + y²` mit `b(k)²` (ganzzahlig,
exakt); aus einem Abstand rundet sie ihn auf ein 0,01-µm-Raster und vergleicht ganzzahlig. Ein
Gleitkomma-Schätzwert liefert nur den Startpunkt, zwei Schleifen ziehen ihn exakt nach. Grund: Die
naive Formel des Prototyps `floor((11 − d / 8000) · 10)` ergibt für d = 63 200 µm (genau auf der
Grenze zu 3,1) den Wert 3,0. Für LP und LG gibt es je neun solche Grenzen; der Prototyp hat das mit
`+ 1e-9` überdeckt.

**E4: Meyton-Semantik.**

- Zehntel = 10 + (R − d) ÷ W, abgeschnitten, höchstens 10,9.
- Unter 1,0 ist ein Fehlschuss: Ring 0, Zehntel 0.
- Ganzer Ring = abgeschnittener Zehntelwert. Bei gleichen Ringabständen ist das genau die
  Berührungsregel (d ≤ Ringradius + halbes Kaliber).
- Innenzehner: Bei LP berührt der Schuss den 5-mm-Innenzehner (d ≤ 4,75 mm). Bei LG schießt er den
  0,5-mm-Zehnerpunkt ganz weg (d ≤ 2,25 − 0,25 = 2,0 mm, also ab 10,2).

**E5: Disziplin-Auflösung in fester Reihenfolge, nie über die Regelnummer allein.**

1. Admin-Zuordnung (DisziplinID + Name, je Anlage, kommt später aus der Datenbank).
2. Meyton-Katalog über die ganze DisziplinID: Regelnummer **und** Schusscode, nur Entfernung 10 m.
3. Name: ganzes Wort `LG`/`Luftgewehr` bzw. `LP`/`LP5`/`Luftpistole`. Kommt beides oder keines vor,
   bleibt es unbekannt. Kein Namens-Rückfall, wenn die ID eine andere Entfernung als 10 m nennt.
4. Unbekannt. Mit Schüssen kann `suggestTargets` (Task 5) ein Scheibenbild vorschlagen.

Laut Meyton-Handbuch „ShootMaster II – Disziplin erstellen“ (Stand 06.12.2017, Abschnitte 19.3,
19.4.5 und 19.5.1) ist die Regelnummer nicht eindeutig. `0610` ist „LP Liga“ (10610040), aber auch
„ISSF AR Men Final“ (10610220). `0100` ist die französische „Pistolet air“ (10100040), obwohl
DSB-Regeln 01.xx Gewehre sind. Ein Rückfall über Regelbereiche wählt dort das falsche Scheibenbild:
neuer Sonderfall **SF-70**.

**E6: Katalog als Regeltabelle mit Ausnahmen, keine Abschrift der Meyton-Liste.** Die Liste im
Handbuch ist urheberrechtlich geschützt; Regelnummern sind Fakten. Belegt und aufgenommen, alle mit
Entfernungsziffer 1:

| Ziel | Regelnummern | Schusscode |
| --- | --- | --- |
| LG | 0610, 0612, 0614, 0616 (ISSF-Finale) | nur 220 |
| LP | 0611, 0613, 0615, 0617 (ISSF-Finale) | nur 220 |
| LG | 0110, 0120, 0193, 0194, 0195, 0510, 0520, 0530, 0531, 0540, 0550, 0710–0713, 1009–1018, 9110 | jeder |
| LG, Auflage | 0111 | jeder |
| LP | 0210, 0216, 0610, 0620, 0630, 0631, 0640, 0650, 0810–0813, 1109–1117, 9210 | jeder |
| LP, Auflage | 0211 | jeder |

Die Reihenfolge der Zeilen zählt: Die ISSF-Finale (0610 mit 220) stehen vor der allgemeinen Zeile
mit 0610 („LP Liga“). Nicht aufgenommen, also über Name oder Admin: Sonderwertungen mit eigener oder
unklarer Geometrie (Blattl 2110/2210, 23xx/24xx, 4001/4002, 71xx/72xx), „AR Adv.“ mit Abzug,
Laufende Scheibe, IPC, Frankreich, Pentathlon, Sport- und Standardpistole 10 m Nachwuchs.

**E7: Die Schusszahl ist nur ein Hinweis (SF-09).** Die letzten drei Ziffern der DisziplinID:
`000` heißt offen; Meytons „LG Training Spiegel“ (19110000) und „LP Training Spiegel“ (19210000)
belegen das. `001` bis `100` sind geplante Wertungsschüsse. Über 100 gibt es keinen Hinweis, denn
Meyton nutzt dort Varianten-Codes (220 Finale, 240 Liga Bayern, 130 „LP5 (S)“). IDs, die nicht
achtstellig sind (vereinseigene Disziplinen), werden nicht zerlegt.

**E8: Die Gegenprobe kennt die Messauflösung.** Die Lage hat in der SSMDB2 1/100 mm, der Teiler
eine bzw. zwei Nachkommastellen von 1/100 mm. Ein abweichender amtlicher Wert gilt als **Grenzfall**,
wenn er innerhalb der Auflösung erreichbar ist: Die Wertung an den Rändern des Intervalls
[d − ε, d + ε] umschließt ihn (ε = halbe Auflösung beim Abstand, Auflösung · √½ bei der Lage). Sonst
ist er eine **Abweichung**. Das Urteil über eine Scheibe:

- keine Abweichung → `ok`
- mindestens drei geprüfte Schüsse und mehr als die Hälfte weicht ab → `target-mismatch`
- sonst → `suspicious-shots`
- nichts prüfbar → `insufficient`

**E9: Familien als Vorschlag** (der Admin bestätigt später): `lg-freihand`, `lg-auflage`,
`lp-freihand`, `lp-auflage`. „Auflage“ kommt aus der Regel (0111/0211) oder aus dem Namen
(„Auflage“, „aufgelegt“).

**E10: Vollständigkeit als reine Funktion.** `leer`, `nur-probe`, `offen`, `unvollstaendig`,
`vollstaendig`, `ueber-soll`. Gegen die Schusszahl zählen nur Wertungsschüsse (SF-02). Der zeitliche
Zustand (offen, ruhend, endgültig) kommt in SP-1.4/SP-1.6.

**E11: Nicht in diesem Feature:** Zeichnen der Scheibe (SP-1.8, `shot-ui`), Kennzahlen (SP-1.2),
Skalen der Datenbankfelder (SP-1.6), Scheibenbild je Stellung (erst mit 25 m), weitere Scheiben wie
KK und Zimmerstutzen (erst bei Bedarf).

## 3. Dateien

| Datei | Änderung |
| --- | --- |
| `packages/shot-core/package.json`, `tsconfig.json`, `vitest.config.ts` | neu |
| `packages/shot-core/CLAUDE.md` | neu, Scope-Notiz wie bei `packages/lib` |
| `packages/shot-core/src/units.ts` (+ `.test.ts`) | mm → µm mit Ganzzahl-Prüfung |
| `packages/shot-core/src/targets.ts` (+ `.test.ts`) | Scheibenbild-Format, `defineTarget`, LG und LP 10 m |
| `packages/shot-core/src/scoring.ts` (+ `.test.ts`) | Wertung aus Lage oder Abstand, Teiler |
| `packages/shot-core/src/discipline.ts` (+ `.test.ts`) | DisziplinID, Katalog, Auflösung, Familie, Vollständigkeit |
| `packages/shot-core/src/verify.ts` (+ `.test.ts`) | Gegenprobe, Vorschlag, Neu-Wertung |
| `pnpm-lock.yaml` | neuer Importer `packages/shot-core` |
| `vault/sources/src-meyton-disziplin-erstellen.md` | neu, Quellen-Note zum Handbuch |
| `vault/spiegel/spiegel-target-library.md` | Auflösung, Kollisionen, Schusscodes, Umsetzung |
| `vault/spiegel/spiegel-edge-cases.md` | SF-70 neu, SF-09 belegt |
| `vault/meyton/meyton-ssmdb2.md` | Abschnitt DisziplinID ergänzt |
| `vault/architecture/architecture.md` | Repo-Karte um `packages/shot-core` |
| `vault/spiegel/spiegel-roadmap.md` | SP-1.1: SF-70 in der Abnahme, Status erledigt |

## Required Docs

- `vault/spiegel/spiegel-target-library.md` (Maße, Formel, Gegenprobe-Tabelle)
- `vault/spiegel/spiegel-edge-cases.md` → SF-01, SF-02, SF-09, SF-14 bis SF-18
- `vault/spiegel/spiegel-data-model.md` → „Schuss“ (µm, `decimalTenths` mit 94 = 9,4)
- `vault/meyton/meyton-ssmdb2.md` → „DisziplinID“, „Status und Wertungsmodus“
- `vault/meyton/meyton-printout.md` (Ausdruck vom 2. Oktober)
- `packages/lib/CLAUDE.md` (Paketregeln: Just-in-time, kein `"use server"`)
- `vault/conventions.md` §8 (Gates) und §9 (Charakterisierungstests, Mutationsprobe)

## 4. Tasks

Code und Bezeichner auf Englisch, Kommentare und Testtitel auf Deutsch (wie in `packages/lib`).
Prettier aus `@vereinsheim/config/prettier` (ohne Semikolon, doppelte Anführungszeichen, 100
Zeichen). Jede Task endet mit
`pnpm turbo run check-types test format:check --filter=@vereinsheim/shot-core`.

### Task 1: Paket anlegen

`packages/shot-core/package.json`:

```json
{
  "name": "@vereinsheim/shot-core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./units": "./src/units.ts",
    "./targets": "./src/targets.ts",
    "./scoring": "./src/scoring.ts",
    "./discipline": "./src/discipline.ts",
    "./verify": "./src/verify.ts"
  },
  "scripts": {
    "check-types": "tsc --noEmit",
    "test": "vitest run",
    "format:check": "prettier --check .",
    "format": "prettier --write ."
  },
  "prettier": "@vereinsheim/config/prettier",
  "devDependencies": {
    "@vereinsheim/config": "workspace:*",
    "prettier": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

`tsconfig.json`: `extends` `@vereinsheim/config/tsconfig/nextjs.json`, `compilerOptions.types: []`,
`include: ["src"]`, `exclude: ["node_modules"]`. `vitest.config.ts` wie in `packages/lib`
(`environment: "node"`, `passWithNoTests: true`).

`src/units.ts`, damit `tsc` Eingaben hat und E2 eine Stelle bekommt:

```ts
/** mm → ganze µm. Wirft, wenn das Maß kein ganzes µm ist (E2: alle Grenzen ganzzahlig). */
export function mmToUm(mm: number): number {
  const um = Math.round(mm * 1000)
  if (!Number.isFinite(mm) || Math.abs(mm * 1000 - um) > 1e-6) {
    throw new RangeError(`${mm} mm ist kein ganzes µm`)
  }
  return um
}
```

Tests `units.test.ts`: 4,5 → 4500; 0,25 → 250; 155,5 → 155 500; 0,0001 wirft; `NaN` wirft.

Dann `pnpm install`. `git diff pnpm-lock.yaml` darf nur den neuen Importer `packages/shot-core`
enthalten; ändert sich ein anderer Importer, `pnpm install --frozen-lockfile` gegenprüfen
(conventions §9) und den Grund im Ledger festhalten.

Commit: `chore(shot-core): scaffold the shot-core package`.

### Task 2: Scheibenbilder (`targets.ts`)

```ts
export type TargetId = "lg-10m" | "lp-10m"
export type Weapon = "lg" | "lp"

/** LP: Der Schuss berührt den Innenzehner. LG: Er schießt den Zehnerpunkt ganz weg. */
export type InnerTenRule =
  | { kind: "touch"; diameterMm: number }
  | { kind: "shotOut"; diameterMm: number }

export interface TargetSpec {
  id: TargetId
  version: number
  label: string
  weapon: Weapon
  tenDiameterMm: number
  ringWidthMm: number
  /** Spiegel (schwarz) */
  blackDiameterMm: number
  caliberMm: number
  innerTen: InnerTenRule
  labelRings: readonly number[]
}

export interface TargetImage extends TargetSpec {
  /** Außenradius je Ring, Index 0 = Ring 1 … Index 9 = Ring 10, in µm */
  ringRadiiUm: readonly number[]
  ringWidthUm: number
  caliberUm: number
  /** R = Zehnerradius + halbes Kaliber: bis zu diesem Abstand zählt ein Schuss 10,0 */
  scoringRadiusUm: number
  innerTenMaxDistanceUm: number
  /** Ring, an dem der Spiegel endet (LG 4, LP 7) */
  blackFromRing: number
}

export const MAX_DECIMAL_TENTHS = 109
export function defineTarget(spec: TargetSpec): TargetImage
export const LG_10M: TargetImage
export const LP_10M: TargetImage
export const TARGETS: Readonly<Record<TargetId, TargetImage>>
```

`defineTarget`:

- `tenRadiusUm = mmToUm(tenDiameterMm) / 2`, `ringWidthUm = mmToUm(ringWidthMm)`,
  `caliberUm = mmToUm(caliberMm)`.
- Wirft (`RangeError`), wenn `tenRadiusUm` oder `caliberUm / 2` keine ganze Zahl ist,
  `ringWidthUm % 10 !== 0`, oder ein Maß ≤ 0 ist.
- `ringRadiiUm[i] = tenRadiusUm + (9 − i) · ringWidthUm`.
- `scoringRadiusUm = tenRadiusUm + caliberUm / 2`.
- `innerTenMaxDistanceUm`: `touch` → Innenzehner-Radius + halbes Kaliber; `shotOut` → halbes
  Kaliber − Punktradius. Muss ganzzahlig und > 0 sein.
- `blackFromRing`: der Ring n, dessen Außendurchmesser gleich `blackDiameterMm` ist. Gibt es keinen,
  wirft `defineTarget`.
- Ergebnis mit `Object.freeze` (auch `ringRadiiUm`).

Daten (DSB-Sportordnung 2026, Anhang 0.20, gleich ISSF 2026):

- `LG_10M`: Zehner 0,5 · Ringabstand 2,5 · Spiegel 30,5 · Kaliber 4,5 · Innenzehner
  `shotOut` 0,5 · Beschriftung 1–8 · `label` „Luftgewehr 10 m“ · `version` 1.
- `LP_10M`: Zehner 11,5 · Ringabstand 8,0 · Spiegel 59,5 · Kaliber 4,5 · Innenzehner `touch` 5,0 ·
  Beschriftung 1–8 · `label` „Luftpistole 10 m“ · `version` 1.

Tests `targets.test.ts`:

- Außendurchmesser Ring 1 und Ring 9: LG 45,5 und 5,5 mm; LP 155,5 und 27,5 mm.
- `scoringRadiusUm === ringWidthUm` für beide; daraus folgt die Kurzform „11 − d ÷ W“.
- `innerTenMaxDistanceUm`: LP 4750, LG 2000.
- `blackFromRing`: LG 4, LP 7.
- `defineTarget` wirft bei Ringabstand 2,555 mm (Zehntel kein ganzes µm), bei Zehner 0,0005 mm und
  bei Spiegel 31 mm (kein Ringdurchmesser).
- `TARGETS` enthält genau `lg-10m` und `lp-10m`, eingefroren.

Commit: `feat(shot-core): describe the 10 m air rifle and air pistol targets as data`.

### Task 3: Wertung (`scoring.ts`)

```ts
export interface Score {
  /** amtliche Form: 94 = 9,4; 0 bei Fehlschuss */
  decimalTenths: number
  ring: number
  innerTen: boolean
  miss: boolean
}

export function distanceUm(xUm: number, yUm: number): number // Math.hypot
/** Teiler in 1/100 mm: 3318 µm → 331,8 */
export function teilerFromDistanceUm(distanceUm: number): number // distanceUm / 10
export function scoreFromCoordinates(target: TargetImage, xUm: number, yUm: number): Score
export function scoreFromDistance(target: TargetImage, distanceUm: number): Score
```

Kern (E3), gemeinsam für beide Eingänge:

```ts
function boundaryUm(target: TargetImage, tenths: number): number {
  return target.scoringRadiusUm - ((tenths - 100) * target.ringWidthUm) / 10
}

function scoreWith(
  target: TargetImage,
  approxDistanceUm: number,
  within: (limitUm: number) => boolean
): Score {
  let k = Math.min(
    MAX_DECIMAL_TENTHS,
    100 + Math.floor(((target.scoringRadiusUm - approxDistanceUm) * 10) / target.ringWidthUm)
  )
  // Der Gleitkomma-Startwert darf um eins danebenliegen; exakt nachziehen.
  while (k < MAX_DECIMAL_TENTHS && within(boundaryUm(target, k + 1))) k++
  while (k >= 10 && !within(boundaryUm(target, k))) k--
  if (k < 10) return { decimalTenths: 0, ring: 0, innerTen: false, miss: true }
  return {
    decimalTenths: k,
    ring: Math.floor(k / 10),
    innerTen: within(target.innerTenMaxDistanceUm),
    miss: false,
  }
}
```

- `scoreFromCoordinates`: wirft `RangeError` bei nicht ganzzahligen Koordinaten.
  `d2 = x² + y²`; `within = (b) => b >= 0 && d2 <= b * b`.
- `scoreFromDistance`: wirft `RangeError` bei negativem oder nicht endlichem Abstand.
  `d = Math.round(distanceUm * 100)`; `within = (b) => b >= 0 && d <= b * 100`.

Tests `scoring.test.ts` (Abstände in µm, Erwartung in Zehnteln):

| Fall | Ziel | Abstand | Erwartung |
| --- | --- | --- | --- |
| Ausdruck 2. Oktober, Schuss 8 | LP | 3318 | 105, Innenzehner |
| Schuss 2 | LP | 3964 | 105, Innenzehner |
| Schuss 15 | LP | 5474 | 103, kein Innenzehner |
| Schuss 23 | LP | 26 560 | 76 |
| Schuss 5 | LP | 33 690 | 67 |
| Schuss 27 | LP | 38 310 | 62 |
| ShotsApp Serie 1 | LP | 12 643 · 11 823 · 18 561 | 94 · 95 · 86 |
| Grenze, naive Formel ergäbe 3,0 | LP | 63 200 | 31 |
| Grenze, naive Formel ergäbe 3,0 | LG | 19 750 | 31 |
| Deckel 10,9 | LP / LG | 0 · 800 / 0 · 250 | 109 |
| knapp darüber | LP / LG | 801 / 251 | 108 |
| Innenzehner-Grenze | LP | 4750 / 4751 | 104 ja / 104 nein |
| Punkt weg | LG | 2000 / 2001 | 102 ja / 101 nein |
| Fehlschuss-Grenze | LP | 80 000 / 80 001 | 10, Ring 1 / Fehlschuss |
| Fehlschuss-Grenze | LG | 25 000 / 25 001 | 10, Ring 1 / Fehlschuss |
| Berührungsregel | LP | 8000 · 8001 · 16 000 · 16 001 | Ring 10 · 9 · 9 · 8 |

Weitere Tests:

- Koordinaten: (960, 1280) liegt genau auf 1600 µm → 108 wie `scoreFromDistance(1600)`; (0, 1601)
  → 107. Vorzeichen und Tausch ändern nichts: (x, y), (−x, y), (y, x).
- Eigenschaft: Für LP und LG über 0 bis 90 000 µm in Schritten von 7 µm ist der Wert nie steigend,
  `ring === Math.floor(decimalTenths / 10)` und `miss` genau jenseits der Fehlschuss-Grenze.
- Ungültig: `scoreFromCoordinates(LP, 0.5, 0)` und `scoreFromDistance(LP, -1)` werfen `RangeError`.
- `teilerFromDistanceUm(3318)` ist 331,8.

Commit: `feat(shot-core): score shots exactly like Meyton`.

### Task 4: Disziplinen (`discipline.ts`)

```ts
export interface ParsedDisciplineId {
  raw: number
  /** 1 = 10 m … 7 = sonstige; null bei vereinseigenen IDs */
  distanceCode: number | null
  /** Ziffern 2–5, etwa "0210" */
  rule: string | null
  /** Ziffern 6–8 roh, etwa 40, 0 oder 220 */
  shotCode: number | null
  /** geplante Wertungsschüsse; null bei 000, über 100 oder vereinseigen */
  plannedShots: number | null
  openEnded: boolean
}

export interface AdminMapping {
  disciplineId: number
  name: string
  targetId: TargetId
}
export type ResolutionSource = "admin" | "catalog" | "name" | "unknown"
export type Anschlag = "freihand" | "auflage"
export type FamilyId = "lg-freihand" | "lg-auflage" | "lp-freihand" | "lp-auflage"
export type Completeness =
  | "leer"
  | "nur-probe"
  | "offen"
  | "unvollstaendig"
  | "vollstaendig"
  | "ueber-soll"

export function parseDisciplineId(raw: number): ParsedDisciplineId
export function resolveTarget(input: {
  disciplineId: number
  name: string
  adminMappings?: readonly AdminMapping[]
}): { targetId: TargetId | null; source: ResolutionSource }
export function suggestFamily(input: {
  targetId: TargetId
  disciplineId: number
  name: string
}): FamilyId
export function classifyCompleteness(input: {
  sighterShots: number
  matchShots: number
  plannedShots: number | null
}): Completeness
```

Umsetzung:

- `parseDisciplineId`: nur ganze Zahlen von 10 000 000 bis 99 999 999 werden zerlegt, sonst sind
  alle Felder `null` und `openEnded` ist `false`. `plannedShots`: 1–100 → Zahl, sonst `null`;
  `openEnded = shotCode === 0`.
- Katalog als geordnete Liste
  `{ rules: readonly string[]; shotCode?: number; target: TargetId; anschlag?: "auflage" }`
  mit den Zeilen aus E6, Reihenfolge wie dort. Kopfkommentar mit der Quelle (Handbuch, Abschnitte,
  Stand) und dem Hinweis auf SF-70.
- `resolveTarget`: Admin (gleiche ID und gleicher Name nach `trim`, zusammengezogenen Leerzeichen,
  Kleinschreibung) → Katalog (nur `distanceCode === 1`, erste passende Zeile) → Name (nur wenn
  `distanceCode` `null` oder 1 ist) → unbekannt.
- Name: Wortgrenzen ohne `\b`, damit Umlaute nicht stören:
  `/(^|[^a-z0-9äöüß])(lg|luftgewehr)(?=$|[^a-z0-9äöüß])/` und dasselbe mit
  `(lp|lp5|luftpistole)` auf dem kleingeschriebenen Namen. Genau einer der beiden trifft → Ziel,
  sonst unbekannt.
- `suggestFamily`: Waffe aus `TARGETS[targetId].weapon`; Auflage, wenn die Katalogzeile `anschlag`
  trägt oder der Name `/(^|[^a-zäöüß])(auflage|aufgelegt)/i` trifft.
- `classifyCompleteness`: `matchShots === 0` → `leer` oder `nur-probe`; `plannedShots === null` →
  `offen`; sonst kleiner, gleich, größer → `unvollstaendig`, `vollstaendig`, `ueber-soll`.

Tests `discipline.test.ts`:

- `parseDisciplineId`: 10210040 → 1, "0210", 40, geplant 40; 40180060 → 4, "0180", 60; 19110000
  → offen, geplant `null`; 10530240 → Schusscode 240, geplant `null`; 11010100 → geplant 100; 7,
  −5, 1,5 und 123 456 789 → alle Felder `null`.
- Katalog: 10110040 → LG; 10210040 → LP; 19210040 („LP 40 alt“) → LP; 10111030 → LG;
  10211015 → LP; 11110010 („LP P+10W“) → LP; 19110000 → LG; Quelle jeweils `catalog`.
- Kollisionen (SF-70): 10610040 („LP Liga“) → LP; 10610220 („ISSF AR Men Final“) → LG;
  10611220 → LP; 10612040 mit Name „Training“ → unbekannt; 10100040 „Pistolet air 40“ →
  unbekannt (kein Rückfall über 01.xx).
- Name: ID 7 „LP 40 alt“ → LP über `name`; 18311030 „BdHDS LG Auflage“ → LG über `name`;
  „Luftpistole Vereinsmeister“ → LP; „LG/LP Mix“ → unbekannt; 40180060 „KK 60 liegend“ →
  unbekannt; ID 7 „Schach 10“ → unbekannt.
- Admin schlägt Katalog: Zuordnung {10210040, „  lp   40 “, `lg-10m`} für Name „LP 40“ →
  LG über `admin`.
- Familie: 10111030 „LG Auflage 30“ → `lg-auflage` (Regel); ID 7 „LG aufgelegt“ → `lg-auflage`
  (Name); 10210040 „LP 40“ → `lp-freihand`; 19210040 „LP 40 alt“ → `lp-freihand`; 10211030
  „LP Auflage 30“ → `lp-auflage`.
- Vollständigkeit: (0, 0, 40) `leer`; (60, 0, 40) `nur-probe` (SF-01/SF-02); (60, 40, 40)
  `vollstaendig`, die Probe zählt nicht; (5, 23, 40) `unvollstaendig`; (5, 45, 40) `ueber-soll`;
  (0, 12, `null`) `offen`.

Commit: `feat(shot-core): resolve Meyton discipline IDs to target images`.

### Task 5: Gegenprobe (`verify.ts`)

```ts
export interface ShotEvidence {
  /** Lage in µm; aus der SSMDB2 mit Auflösung 10 µm */
  position?: { xUm: number; yUm: number; resolutionUm: number } | null
  /** Abstand in µm, etwa aus dem Teiler (Teiler01: Auflösung 1 µm) */
  distance?: { um: number; resolutionUm: number } | null
  officialDecimalTenths: number | null
  officialInnerTen?: boolean | null
}
export type ShotCheck = "match" | "boundary" | "mismatch" | "unchecked"
export type Verdict = "ok" | "target-mismatch" | "suspicious-shots" | "insufficient"
export interface CardCheck {
  verdict: Verdict
  checks: ShotCheck[]
  checked: number
  mismatches: number
}

export function checkShot(target: TargetImage, shot: ShotEvidence): ShotCheck
export function verifyCard(target: TargetImage, shots: readonly ShotEvidence[]): CardCheck
export function suggestTargets(
  shots: readonly ShotEvidence[],
  candidates?: readonly TargetImage[]
): TargetId[]
/** Neu-Wertung mit einem anderen Scheibenbild; das Ergebnis ist nicht amtlich (SF-16). */
export function rescore(target: TargetImage, shot: ShotEvidence): Score | null
```

Umsetzung:

- `checkShot`: ohne amtlichen Wert → `unchecked`. Gemessen wird bevorzugt über `distance`
  (genauer), sonst über `position`, sonst `unchecked`. `computed` aus `scoreFromDistance` bzw.
  `scoreFromCoordinates`.
- Gleicher Wert und, falls angegeben, gleicher Innenzehner → `match`.
- Sonst die Intervallränder `near = scoreFromDistance(target, max(0, d − ε))` und
  `far = scoreFromDistance(target, d + ε)` mit ε = `resolutionUm / 2` (Abstand) bzw.
  `resolutionUm * Math.SQRT1_2` (Lage). `boundary`, wenn
  `far.decimalTenths ≤ amtlich ≤ near.decimalTenths` und der amtliche Innenzehner an einem der
  Ränder vorkommt; sonst `mismatch`.
- `verifyCard` nach E8. `suggestTargets`: Kandidaten (Standard `Object.values(TARGETS)`) mit Urteil
  `ok`, in Kandidaten-Reihenfolge. `rescore`: Lage vor Abstand; ohne beides `null`.

Tests `verify.test.ts`. Die Fixtures unterscheiden LG und LP (conventions §9: Eine falsche Quelle
muss auffallen):

- **Ausdruck vom 2. Oktober** als Abstands-Evidenz (Auflösung 1 µm) mit amtlichen Werten und
  Sternen aus Task 3: mit LP `ok`, 6 geprüft, 0 Abweichungen; mit LG `target-mismatch` (LG ergäbe
  9,6 · 9,4 · 8,8 und dreimal Fehlschuss).
- **Vorschlag (SF-17):** `suggestTargets(Ausdruck)` → `["lp-10m"]`. Eine LG-Fixture mit von Hand
  gerechneten Werten (1000 → 106, 3000 → 98, 5600 → 87, 7400 → 80 µm) → `["lg-10m"]`. Mit LP
  ergäben dieselben Abstände 108 · 106 · 103 · 100.
- **Platzhalter (SF-15):** Ausdruck plus Lage (0, 0) mit amtlich 87 → `suspicious-shots`, eine
  Abweichung, letzter Check `mismatch`.
- **Grenzfall (E8):** Lage (0, 3200), Auflösung 10 µm, amtlich 105 → `boundary` (wahrer Abstand
  bis 3207 µm möglich). Gleiche Lage mit amtlich 103 → `mismatch`. Abstand 4750 µm, Auflösung 1
  µm, amtlich 104 ohne Innenzehner → `boundary`; Abstand 4000 µm, amtlich 105 ohne Innenzehner →
  `mismatch`.
- **Falsche Disziplin (SF-16):** Lage (0, 3000) auf LP amtlich 106 → mit LP `ok`; `rescore(LG)`
  ergibt 98. Die Gegenprobe allein findet diesen Fall nicht, erst „Disziplin korrigieren“.
- **Nicht prüfbar:** Schüsse ohne amtlichen Wert → `unchecked`, Urteil `insufficient`; ein
  einzelner abweichender Schuss bei nur zwei geprüften → `suspicious-shots`.

Commit: `feat(shot-core): check official scores against the target image`.

### Task 6: Dokumentation

- `packages/shot-core/CLAUDE.md`:
  - Exporttabelle (`units`, `targets`, `scoring`, `discipline`, `verify`).
  - Regeln: ganze µm, exakte Wertung ohne Epsilon, keine Dependencies, isomorph, kein
    `"use server"`.
  - Katalog über die ganze DisziplinID, kein Rückfall über die Regel allein (SF-70); neue
    Scheibenbilder nur über `defineTarget` mit Quelle.
  - Was nicht hier liegt: Zeichnen, Kennzahlen, Adapter.
  - Mit Prettier formatieren, `format:check` prüft auch diese Datei.
- `vault/sources/src-meyton-disziplin-erstellen.md` (`type: source`):
  - URL `https://software.meyton.info/wp-content/uploads/Upload/Manuals/DE/ShootMaster/ShootMasterII_-_Disziplin_erstellen.pdf`,
    `retrieved: 2026-10-05`, Stand 06.12.2017.
  - Inhalt: Aufbau der DisziplinID, Standardlisten 19.3 ff., Kollisionen 0610 und 0100, Schusscodes
    über 100 als Varianten, 000 bei „Training Spiegel“.
  - Provenienz wie bei `src-meyton-ssmdb2-handbuch`: Original nicht im Repo, nur Auszug.
- `vault/spiegel/spiegel-target-library.md`:
  - Abschnitt „Von der DisziplinID zum Scheibenbild“ auf die Reihenfolge aus E5 und die Tabelle aus
    E6 umstellen, Schusscodes nach E7.
  - `documented_in` um `[[src-meyton-disziplin-erstellen]]` ergänzen.
  - Neuer Absatz „Umsetzung“: `packages/shot-core` (SP-1.1), exakte Ganzzahl-Wertung, Grund aus E3.
- `vault/spiegel/spiegel-edge-cases.md`:
  - Neue Zeile SF-70 am Ende der Gruppe „Werte und Treffer“ (laut „Pflege“ bekommt ein neuer Fall
    die nächste freie Nummer): „Regelnummer nicht eindeutig: 0610 ist LP Liga (10610040) und
    ISSF-Luftgewehr-Finale (10610220), 0100 die französische Luftpistole“ · „Ein Rückfall über die
    Regel wählt das falsche Scheibenbild“ · „Katalog über die ganze DisziplinID, Regelbereiche nie
    allein“ · „Test (SP-1.1)“.
  - SF-09, Spalte „Prüfen“: „SQL-Checkliste; belegt durch Meytons „LG/LP Training Spiegel“
    (19110000, 19210000)“.
- `vault/meyton/meyton-ssmdb2.md`, Abschnitt „DisziplinID“: Standardlisten im Handbuch, Kollisionen,
  Schusscodes über 100, 000; Verweis auf `[[src-meyton-disziplin-erstellen]]` und
  `documented_in` ergänzen.
- `vault/architecture/architecture.md`, Repo-Karte: Zeile
  `packages/shot-core/  @vereinsheim/shot-core — Spiegel-Fachkern: Scheibenbilder, Wertung,
  Disziplinen, Gegenprobe (SP-1.1, Oktober 2026)`.
- `vault/spiegel/spiegel-roadmap.md`, SP-1.1: Abnahme um SF-70 ergänzen, Status „erledigt“ (gilt
  mit dem Merge).
- `node .claude/vault-lint.mjs` grün.

Commit: `docs(spiegel): document the shot-core package and the discipline catalog`.

## 5. Verification

1. `pnpm check` grün. Das Paket läuft über `check-types`, `test` und `format:check` mit.
2. `pnpm --filter @vereinsheim/shot-core test`: alle grün; die Zahl der Tests kommt in den Bericht.
3. **Mutationsprobe (conventions §9).** Jede Änderung testweise einspielen, Tests laufen lassen, rot
   beobachten, zurücknehmen; das Ergebnis je Zeile in den Validierungsbericht:
   - `within` mit `<` statt `<=` → Grenztests (Berührungsregel, Innenzehner, Fehlschuss) rot.
   - Deckel `MAX_DECIMAL_TENTHS` aus Start und Schleife entfernt → „Deckel 10,9“ rot.
   - `scoreWith` durch die naive Formel `floor((11 − d / W) · 10)` ersetzt → Grenzen 63 200 / 19 750
     rot.
   - LP-Innenzehner auf `shotOut` gestellt → Innenzehner-Tests und Ausdruck (Sterne) rot.
   - Katalogzeilen der ISSF-Finale entfernt → 10610220 rot.
   - Katalog über Regelbereiche (01xx → LG, 02xx → LP) statt Liste → „Pistolet air“ rot.
   - In `verifyCard` jede Abweichung als `target-mismatch` → Platzhalter-Test rot.
   - `suggestTargets` liefert alle Kandidaten → Vorschlags-Tests rot.
4. `git diff main --stat`: nichts unter `apps/`, kein `compose.yml`, kein `Dockerfile`.
   `git diff main -- pnpm-lock.yaml` enthält nur den Importer `packages/shot-core`.
5. `node .claude/vault-lint.mjs` grün.
