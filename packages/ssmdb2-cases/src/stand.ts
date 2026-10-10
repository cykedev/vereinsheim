// Der Baukasten: eine erfundene Anlage, die wie Meyton in die Ablage schreibt (beobachtet an der Vereinsanlage, Kopie
// und Abend-Mitschnitt vom 9. Oktober 2026, `vault/meyton/meyton-ssmdb2.md`). Ein Fall bewegt die Uhr, schießt,
// schaltet um und liest nach jedem Schritt (`Sim.read`). Was nicht beobachtet ist (Korrektur, Löschen mit Nachrücken),
// ist als Annahme markiert.

import { parseDisciplineId } from "@vereinsheim/shot-core/discipline"
import type { TargetImage } from "@vereinsheim/shot-core/targets"

import {
  deleteScheibe,
  emptyAblage,
  serienKey,
  serienOf,
  trefferKey,
  trefferOf,
  type Ablage,
} from "./ablage"
import { SCHEMA_VERSION, type ScheibenRow, type SerienRow, type TrefferRow } from "./schema"
import {
  displayText,
  hiddenValues,
  overTargetValues,
  PLACEHOLDER_TEILER,
  shotValues,
  type Display,
  type ShotValues,
} from "./values"

/** Die Fälle laufen in der Sommerzeit 2026: Ortszeit = UTC + 2 h (ein Test prüft die Tage) */
export const SUMMER_OFFSET_MS = 2 * 3_600_000
/** `Startzeit` im Training */
export const ZERO_DATETIME = "0000-00-00 00:00:00"

/** Ortszeit (MESZ) als `datetime` der Ablage, ohne Millisekunden */
export const localDatetime = (ms: number) =>
  new Date(ms + SUMMER_OFFSET_MS).toISOString().slice(0, 19).replace("T", " ")

/**
 * ScheibenID als Millisekundenzähler seit `bootMs`, vorzeichenbehaftet 32 Bit: innerhalb eines Abends steigend, nach
 * 2³² ms (etwa 49,7 Tage) wieder von vorn (SF-77)
 */
export const scheibenIdAt = (bootMs: number, nowMs: number) => (nowMs - bootMs) | 0

/** die Angaben zur Person in der Kopfzeile; erfunden (ADR-029) */
export type Person = Pick<
  ScheibenRow,
  | "Nachname"
  | "Vorname"
  | "Geschlecht"
  | "Land"
  | "SportpassID"
  | "StartNr"
  | "Starterliste"
  | "StarterlistenID"
  | "Klasse"
  | "KlassenID"
  | "Verein"
  | "VereinsID"
  | "Mannschaft"
  | "MannschaftsID"
  | "Rangliste"
  | "RanglistenID"
  | "Gruppe"
  | "GruppenID"
  | "Status"
>

/** ein Training wie an der Vereinsanlage, mit erfundener Person und erfundenem Verein */
export const MUSTER: Person = {
  Nachname: "Muster",
  Vorname: "Max",
  Geschlecht: "male",
  Land: "GER",
  SportpassID: 12345678,
  StartNr: 1000,
  Starterliste: "Direktbelegung",
  StarterlistenID: 6,
  Klasse: "Herren I",
  KlassenID: 10,
  Verein: "SV Musterstadt",
  VereinsID: 999999,
  Mannschaft: "Musterstadt",
  MannschaftsID: 999,
  Rangliste: "Training",
  RanglistenID: 19,
  Gruppe: "",
  GruppenID: 0,
  Status: "",
}

export interface CardSetup {
  scheibenId: number
  disziplinId: number
  disziplin: string
  /** Scheibenbild für die Werte aus der Lage */
  target: TargetImage
  standNr: number
  /** Anzeigeart am Monitor zu Beginn */
  display: Display
  /** Uhr des Stands gegen die Beobachtung (SF-73), Standard 0 */
  clockOffsetMs?: number
  /**
   * verdeckt (Anzeigeart 5) mit Wert: so bei 15 von 25 Königsscheiben der Kopie; ohne diese Angabe Wert 0 wie bei den
   * übrigen 10
   */
  hiddenKeepsValue?: boolean
  person?: Partial<Person>
}

/** eine Lesung: was die Brücke zu dieser Zeit in der Ablage sähe */
export interface Reading {
  /** Beobachtungszeit (UTC) */
  observedAtMs: number
  note: string
  /**
   * flüchtig: nur eine Abfrage lang zu sehen (zerrissene Lesung, SF-71). Jede andere Lesung steht für einen Stand,
   * den die Brücke mindestens zweimal hintereinander gleich liest
   */
  transient: boolean
  ablage: Ablage
}

/** die Anlage eines Falls: Ablage, Beobachtungszeit, Lesungen */
export class Sim {
  readonly ablage: Ablage
  now: number
  readonly readings: Reading[] = []

  constructor(startMs: number, version = SCHEMA_VERSION) {
    this.ablage = emptyAblage(version)
    this.now = startMs
  }

  advance(ms: number) {
    this.now += ms
  }

  card(setup: CardSetup): Card {
    return new Card(this, setup)
  }

  /** lesen wie die Brücke: der ganze Stand der Ablage zu dieser Zeit */
  read(note: string, options: { transient?: boolean } = {}) {
    const last = this.readings.at(-1)
    if (last && last.observedAtMs >= this.now)
      throw new Error("Lesungen brauchen eine streng steigende Beobachtungszeit (Folgenummer)")
    this.readings.push({
      observedAtMs: this.now,
      note,
      transient: options.transient ?? false,
      ablage: structuredClone(this.ablage),
    })
  }

  /** die Ablage leeren (Server neu aufgesetzt, SF-23) */
  clear() {
    for (const id of [...this.ablage.scheiben.keys()]) deleteScheibe(this.ablage, id)
  }
}

const HIDDEN: ReadonlySet<Display> = new Set([5])

/** eine Scheibe an einem Stand */
export class Card {
  private display: Display
  private clockOffsetMs: number
  private restartPending = false
  private torn: { serien: SerienRow[]; treffer: TrefferRow[] } | null = null

  constructor(
    private readonly sim: Sim,
    readonly setup: CardSetup
  ) {
    this.display = setup.display
    this.clockOffsetMs = setup.clockOffsetMs ?? 0
    const person = { ...MUSTER, ...setup.person }
    const row: ScheibenRow = {
      ScheibenID: setup.scheibenId,
      Starterliste: person.Starterliste,
      StarterlistenID: person.StarterlistenID,
      Startzeit: ZERO_DATETIME,
      StartNr: person.StartNr,
      Nachname: person.Nachname,
      Vorname: person.Vorname,
      Geschlecht: person.Geschlecht,
      Land: person.Land,
      SportpassID: person.SportpassID,
      StandNr: setup.standNr,
      StandNrText: String(setup.standNr),
      Disziplin: setup.disziplin,
      DisziplinID: setup.disziplinId,
      Klasse: person.Klasse,
      KlassenID: person.KlassenID,
      Verein: person.Verein,
      VereinsID: person.VereinsID,
      Mannschaft: person.Mannschaft,
      MannschaftsID: person.MannschaftsID,
      Rangliste: person.Rangliste,
      RanglistenID: person.RanglistenID,
      Gruppe: person.Gruppe,
      GruppenID: person.GruppenID,
      Status: person.Status,
      Trefferzahl: 0,
      TotalRing: 0,
      TotalRing01: 0,
      BesterTeiler01: PLACEHOLDER_TEILER,
      BesterTeiler001: PLACEHOLDER_TEILER,
      Zeitstempel: localDatetime(this.standMs()),
    }
    sim.ablage.scheiben.set(setup.scheibenId, row)
  }

  get id() {
    return this.setup.scheibenId
  }

  private get row(): ScheibenRow {
    const row = this.sim.ablage.scheiben.get(this.id)
    if (!row) throw new Error(`Scheibe ${this.id} ist nicht in der Ablage`)
    return row
  }

  /** Uhr des Stands: Beobachtungszeit plus Versatz, oder eine feste Zeit (Uhrsprung, SF-30) */
  private standMs(clock?: number) {
    return clock ?? this.sim.now + this.clockOffsetMs
  }

  /** die Uhr des Stands stellen: Versatz gegen die Beobachtung (Uhrsprung, SF-30) */
  setClockOffset(ms: number) {
    this.clockOffsetMs = ms
  }

  /** Lebenszeichen: `Scheiben.Zeitstempel` läuft, solange der Stand belegt ist, auch ohne Schuss */
  heartbeat() {
    this.row.Zeitstempel = localDatetime(this.standMs())
  }

  /**
   * ein Schuss in die Ablage. Der erste Wertungsschuss löscht die Probe (SF-03); nach einem Neustart der Probe löscht
   * ihr erster Schuss die alte (SF-72). Über der Schusszahl der Disziplin Wert 0 und Platzhalter-Teiler (SF-08), in
   * ihrer eigenen Serie (Annahme); verdeckt (Anzeigeart 5) Wert 0, außer mit `hiddenKeepsValue` (SF-19).
   * Annahme, nicht beobachtet (SF-04): Probe nach einem Wechsel zurück von Wertung beginnt wieder bei 1 und verschwindet
   * mit dem nächsten Wertungsschuss.
   */
  shot(stellung: 0 | 1, x: number, y: number, options: { clock?: number } = {}): TrefferRow {
    return this.insert(stellung, options.clock, (over) => ({ x, y, ...this.valuesAt(x, y, over) }))
  }

  /** Handeintrag oder Platzhalter (SF-15): Wert gesetzt, Lage 0/0, Teiler 0, `Text` „Hand“ (der Text ist eine Annahme) */
  handEntry(stellung: 0 | 1, ring01: number): TrefferRow {
    return this.insert(stellung, undefined, () => ({
      x: 0,
      y: 0,
      Ring: Math.floor(ring01 / 10) * 10,
      Ring01: ring01,
      Innenzehner: 0,
      Teiler01: 0,
      Teiler001: 0,
      Wertung: this.display,
      Text: "Hand",
    }))
  }

  private insert(
    stellung: 0 | 1,
    clock: number | undefined,
    content: (
      over: boolean
    ) => Omit<
      TrefferRow,
      "ScheibenID" | "Stellung" | "Treffer" | "Serie" | "Zeitstempel" | "Millisekunden"
    >
  ): TrefferRow {
    const ablage = this.sim.ablage
    if (stellung === 1 && trefferOf(ablage, this.id, 0).length) this.deleteStellung(0)
    if (stellung === 0 && this.restartPending) {
      this.deleteStellung(0)
      this.restartPending = false
    }
    const existing = trefferOf(ablage, this.id, stellung)
    const nr = existing.length ? Math.max(...existing.map((t) => t.Treffer)) + 1 : 1
    const planned = parseDisciplineId(this.setup.disziplinId).plannedShots
    const over = stellung === 1 && planned !== null && existing.length >= planned
    const ms = this.standMs(clock)
    const row: TrefferRow = {
      ScheibenID: this.id,
      Stellung: stellung,
      Treffer: nr,
      Serie: Math.ceil(nr / 10),
      ...content(over),
      Zeitstempel: localDatetime(ms),
      Millisekunden: ((ms % 1000) + 1000) % 1000,
    }
    ablage.treffer.set(trefferKey(row), row)
    this.refresh()
    this.row.Zeitstempel = row.Zeitstempel
    return row
  }

  /** Neustart der Probe: Der nächste Probeschuss löscht die alte Probe, die Nummern beginnen wieder bei 1 (SF-72) */
  restartProbe() {
    this.restartPending = true
  }

  /**
   * Anzeigeart am Monitor umschalten: `Wertung` und `Text` der Wertung (oder einer Serie) neu, die Werte nicht (SF-74).
   * Dass die Probe dabei bleibt, wie sie ist, ist eine Annahme
   */
  setDisplay(display: Display, serie?: number) {
    this.display = display
    for (const row of trefferOf(this.sim.ablage, this.id, 1)) {
      if (serie !== undefined && row.Serie !== serie) continue
      row.Wertung = display
      row.Text = displayText(display, row as ShotValues, row.Teiler01 === PLACEHOLDER_TEILER)
    }
  }

  /**
   * Korrektur durch die Standaufsicht: Lage und Werte eines Schusses neu, Zeit bleibt (SF-21; Annahme). Auch das
   * Lebenszeichen bleibt (Annahme): Eine Brücke, die nur bei neuem `Scheiben.Zeitstempel` liest, sieht die Korrektur
   * erst beim Abgleich der letzten Tage
   */
  correct(stellung: 0 | 1, nr: number, x: number, y: number) {
    const row = this.sim.ablage.treffer.get(
      trefferKey({ ScheibenID: this.id, Stellung: stellung, Treffer: nr })
    )
    if (!row) throw new Error(`Schuss ${nr} fehlt`)
    Object.assign(row, { x, y, ...this.valuesAt(x, y, false) })
    this.refresh()
  }

  /** einen Schuss löschen; die späteren rücken nach, das Lebenszeichen bleibt (SF-22; beides Annahme) */
  remove(stellung: 0 | 1, nr: number) {
    const ablage = this.sim.ablage
    const rows = trefferOf(ablage, this.id, stellung)
    for (const row of rows) ablage.treffer.delete(trefferKey(row))
    for (const row of rows.filter((r) => r.Treffer !== nr)) {
      const moved = row.Treffer > nr ? { ...row, Treffer: row.Treffer - 1 } : row
      moved.Serie = Math.ceil(moved.Treffer / 10)
      ablage.treffer.set(trefferKey(moved), moved)
    }
    this.refresh()
  }

  /**
   * zerrissene Lesung (SF-71): Meyton schreibt die Scheibe neu, für einen Augenblick fehlen die Serien und alle Treffer
   * bis auf die ersten `keep` (beobachtet: alle, oder 36 → 3). Dass die Serien dabei ganz fehlen, ist eine Annahme
   */
  tear(keep = 0) {
    const ablage = this.sim.ablage
    const treffer = trefferOf(ablage, this.id)
    this.torn = { serien: serienOf(ablage, this.id), treffer: treffer.slice(keep) }
    for (const row of this.torn.serien) ablage.serien.delete(serienKey(row))
    for (const row of this.torn.treffer) ablage.treffer.delete(trefferKey(row))
  }

  /** nach `tear`: alles wieder da */
  mend() {
    if (!this.torn) return
    for (const row of this.torn.serien) this.sim.ablage.serien.set(serienKey(row), row)
    for (const row of this.torn.treffer) this.sim.ablage.treffer.set(trefferKey(row), row)
    this.torn = null
  }

  private valuesAt(
    x: number,
    y: number,
    over: boolean
  ): ShotValues & Pick<TrefferRow, "Wertung" | "Text"> {
    const base = over ? overTargetValues() : shotValues(this.setup.target, x, y)
    const values =
      HIDDEN.has(this.display) && !this.setup.hiddenKeepsValue ? hiddenValues(base) : base
    return { ...values, Wertung: this.display, Text: displayText(this.display, values, over) }
  }

  private deleteStellung(stellung: 0 | 1) {
    const ablage = this.sim.ablage
    for (const row of trefferOf(ablage, this.id, stellung)) ablage.treffer.delete(trefferKey(row))
    for (const row of serienOf(ablage, this.id, stellung)) ablage.serien.delete(serienKey(row))
  }

  /** `Serien` und die Summen der Kopfzeile aus den Treffern: Summen, Zahl und bester Teiler nur aus der Wertung */
  private refresh() {
    const ablage = this.sim.ablage
    for (const row of serienOf(ablage, this.id)) ablage.serien.delete(serienKey(row))
    for (const stellung of [0, 1]) {
      const bySerie = new Map<number, TrefferRow[]>()
      for (const t of trefferOf(ablage, this.id, stellung))
        bySerie.set(t.Serie, [...(bySerie.get(t.Serie) ?? []), t])
      for (const [serie, shots] of bySerie) {
        const row: SerienRow = {
          ScheibenID: this.id,
          Stellung: stellung,
          Serie: serie,
          Ring: shots.reduce((sum, t) => sum + t.Ring, 0) / 10,
          Ring01: shots.reduce((sum, t) => sum + t.Ring01, 0),
        }
        ablage.serien.set(serienKey(row), row)
      }
    }
    const match = trefferOf(ablage, this.id, 1)
    // der Platzhalter über der Soll-Zahl ist der größte Wert und nie der beste
    const best = [...match].sort((a, b) => a.Teiler001 - b.Teiler001)[0]
    Object.assign(this.row, {
      Trefferzahl: match.length,
      TotalRing: match.reduce((sum, t) => sum + t.Ring, 0),
      TotalRing01: match.reduce((sum, t) => sum + t.Ring01, 0),
      BesterTeiler01: best?.Teiler01 ?? PLACEHOLDER_TEILER,
      BesterTeiler001: best?.Teiler001 ?? PLACEHOLDER_TEILER,
    })
  }
}
