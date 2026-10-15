// Echte Schüsse für die Gegenprobe gegen Meyton. Sie liegen nur lokal in `./private/` (gitignored, ADR-029), nie im
// Repo; fehlt eine Datei, ist ihr Wert null und die Tests dazu laufen nicht. Ohne Name, Sportpass, ScheibenID und Zeit.
//
//   private/own-shots.json  OwnShot[]: alle Scheiben eines Schützen über zwei Jahre, in ihrer Folge durchnummeriert
//   private/evening.json    { shots: EveningShot[], printout: EveningPrintout }: 40 Wertungsschüsse eines Abends und
//                           die Werte des Ausdrucks derselben Scheibe

export interface OwnShot {
  /** laufende Nummer der Scheibe, 1 = älteste */
  card: number
  disciplineId: number
  /** 0 = Probe, 1 = Wertung */
  stellung: number
  nr: number
  xUm: number
  yUm: number
  /** Abstand aus `Teiler001` (0,1 µm) */
  distanceUm: number
  /** Meytons Wert in Zehnteln */
  decimalTenths: number
  innerTen: boolean
}

export interface EveningShot {
  nr: number
  series: number
  xUm: number
  yUm: number
  /** Abstand aus `Teiler001` (0,1 µm), also auf 0,1 µm genau */
  distanceUm: number
  /** Meytons Wert in Zehnteln (94 = 9,4) */
  decimalTenths: number
  innerTen: boolean
}

/** Werte des Ausdrucks: Index 0 die ganze Scheibe, dann Serie 1 bis 4; Trefferlage als [x, y] in mm, rechts und hoch positiv */
export interface EveningPrintout {
  /** Ergebnis in Zehnteln */
  total: number
  enclosingMm: readonly number[]
  mpiMm: readonly (readonly [number, number])[]
}

declare global {
  interface ImportMeta {
    glob<T>(pattern: string, options: { eager: true; import: "default" }): Record<string, T>
  }
}

const files = import.meta.glob<unknown>("./private/*.json", { eager: true, import: "default" })

function load<T>(name: string): T | null {
  return (files[`./private/${name}.json`] as T | undefined) ?? null
}

export const OWN_SHOTS = load<readonly OwnShot[]>("own-shots")

export const EVENING = load<{ shots: readonly EveningShot[]; printout: EveningPrintout }>("evening")
