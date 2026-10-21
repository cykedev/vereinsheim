// Die Phasen-Matrix des Prüfbestands als Daten: je Zeile ein eigener Wettbewerb mit sprechendem Namen. `expect` nennt
// die Merkmale, die nach dem Aufbau in der Datenbank nachweisbar sein müssen (`verify.ts` liest sie aus den Zeilen und
// aus Ringwerks Tabellen-Abfragen, unabhängig davon, wie `build.ts` sie erzeugt hat).

import type {
  ScoringMode,
  SeasonSortMode,
  TargetValueType,
  TeamScoring,
} from "@/generated/prisma/client"

import type { FixedCase } from "./results"

export type Fact =
  // Status und Veröffentlichung
  | "status:ACTIVE"
  | "status:COMPLETED"
  | "status:ARCHIVED"
  | "oeffentlich:offen"
  | "oeffentlich:passwort"
  | "oeffentlich:qr"
  // Teilnehmer
  | "teilnehmer:keine"
  | "teilnehmer:da"
  | "teilnehmer:gerade"
  | "teilnehmer:ungerade"
  | "teilnehmer:16"
  | "namen:lang"
  | "teilnehmer:inaktiv"
  | "rueckzug:offene-paarungen"
  | "disziplin:archiviert"
  | "faktor"
  // Liga: Gruppenphase
  | "spielplan:keiner"
  | "spielplan:da"
  | "ergebnis:keines"
  | "paarung:offen"
  | "paarung:fertig"
  | "paarung:freilos"
  | "paarung:kampflos"
  | "fristen"
  | "hinrunde:teilweise"
  | "rueckrunde:teilweise"
  | "gruppe:fertig"
  | "bestof:1-0-offen"
  | "bestof:stechschuss"
  | "direkt:offen"
  | "direkt:ausgeglichen"
  | "platz:geteilt-1-und-3"
  // Liga: Playoffs
  | "playoffs:keine"
  | "playoffs:achtelfinale"
  | "playoffs:viertelfinale"
  | "playoffs:nur-halbfinale"
  | "runde:mitten"
  | "runde:fertig-nicht-weiter"
  | "finale:offen"
  | "finale:hauptwertung"
  | "finale:stichkriterium"
  | "finale:verlaengerung"
  | "finale:stichkriterium-entscheidet"
  // Liga: Wertung (Stichkriterium im Finale, korrigierter Teiler, Spalte bei Wertung nach Ringen)
  | "liga:teiler-roh-anders"
  | "liga:ringe-gegen-ringteiler"
  // Event
  | "serien:keine"
  | "serien:teilweise"
  | "serien:alle"
  | "startnummern"
  | "gaeste"
  | "teams"
  | "plaetze:geteilt"
  | "ziel:getroffen"
  // Saison
  | "saison:mindestserien-erreicht"
  | "saison:mindestserien-verfehlt"
  | "saison:ohne-serie"
  | "saison:ohne-mindestzahl-gewertet"
  | "saison:ohne-mindestzahl-ohne-serie"

export type LeagueFormatKey = "DRR" | "BO3" | "BO5"

export type LeaguePhase =
  | "L0-leer"
  | "L0-teilnehmer"
  | "L1"
  | "L2"
  | "L3"
  | "L4"
  | "L5-mitten"
  | "L5-fertig"
  | "L6-offen"
  | "L6-hauptwertung"
  | "L6-stichkriterium"
  | "L6-verlaengerung"
  | "L7-mit-playoffs"
  | "L7-ohne-playoffs"
  | "L7-archiviert"
  | "gleichstand"

export type Bracket = "AF" | "VF" | "HF"

export type DisciplineKey =
  | "Luftgewehr"
  | "Luftpistole"
  | "Luftgewehr Auflage"
  | "Luftpistole Auflage"
  | "Zimmerstutzen"
  | "Luftgewehr Zehntel"

export type PublicAccess = "offen" | "passwort" | "passwort-qr"

interface ScenarioBase {
  /** Kurzes, eindeutiges Kürzel; Startwert des Zufalls und Teil des öffentlichen Slugs. */
  code: string
  name: string
  expect: Fact[]
  public?: PublicAccess
}

export interface LeagueScenario extends ScenarioBase {
  kind: "LEAGUE"
  format: LeagueFormatKey
  phase: LeaguePhase
  size: number
  bracket?: Bracket
  discipline?: DisciplineKey
  longNames?: boolean
  /** Wertung der Gruppenphase; ohne Angabe die des Formats. */
  scoringMode?: ScoringMode
  /** Gemischte Disziplinen (Faktor-Korrektur): gerade Plätze der Einschreibung Luftgewehr, ungerade Luftpistole. */
  mixed?: boolean
  /** Wertung des Finales; ohne Angabe Ringe, bei „L6-stichkriterium“ mit dem Teiler als Stichkriterium. */
  finale?: { primary: ScoringMode; tiebreaker1?: ScoringMode }
  /** Feste Serien statt Zufall, damit der Fall sicher vorkommt (`fixedSeries` in `results.ts`). */
  fixed?: FixedCase
}

export type EventPhase = "leer" | "starterliste" | "teilweise" | "fertig" | "archiviert"

export interface EventScenario extends ScenarioBase {
  kind: "EVENT"
  scoringMode: ScoringMode
  target?: { type: TargetValueType; value: number }
  phase: EventPhase
  size: number
  guests?: number
  team?: { size: number; scoring: TeamScoring }
  /** Gemischte Disziplinen (Faktor-Korrektur). */
  mixed?: boolean
  discipline?: DisciplineKey
  /** Zwei Paare mit gleichen Serien: geteilte Plätze. */
  sharedPlaces?: boolean
  /** Disziplin nach dem Abschluss archivieren. */
  archiveDiscipline?: boolean
  /** Die ehemaligen Mitglieder schießen hier mit (und werden am Ende deaktiviert). */
  formerMembers?: boolean
}

export type SeasonPhase = "leer" | "wenige" | "gemischt" | "fertig" | "ausnahme"

export interface SeasonScenario extends ScenarioBase {
  kind: "SEASON"
  scoringMode: ScoringMode
  sortMode?: SeasonSortMode
  phase: SeasonPhase
  mixed?: boolean
  /** Einschreibungen (Index wie die Serien je Teilnehmer) ohne Mindestzahl an Serien, etwa Jugend */
  exempt?: number[]
}

export type Scenario = LeagueScenario | EventScenario | SeasonScenario

// ─── Liga ────────────────────────────────────────────────────────────────────────────────────────

const FORMAT_LABEL: Record<LeagueFormatKey, string> = {
  DRR: "Hin/Rück",
  BO3: "Best-of-3",
  BO5: "Best-of-5",
}

const BRACKET: Record<Bracket, { size: number; label: string; fact: Fact }> = {
  AF: { size: 16, label: "Achtelfinale", fact: "playoffs:achtelfinale" },
  VF: { size: 8, label: "Viertelfinale", fact: "playoffs:viertelfinale" },
  HF: { size: 4, label: "nur Halbfinale", fact: "playoffs:nur-halbfinale" },
}

function leagueScenarios(format: LeagueFormatKey): LeagueScenario[] {
  const f = FORMAT_LABEL[format]
  const isBestOf = format !== "DRR"
  const league = (
    code: string,
    phase: LeaguePhase,
    size: number,
    label: string,
    expect: Fact[],
    extra: Partial<LeagueScenario> = {}
  ): LeagueScenario => ({
    kind: "LEAGUE",
    code: `L-${format}-${code}`,
    name: `L-${format}-${size} · ${label} (${f})`,
    format,
    phase,
    size,
    expect,
    ...extra,
  })

  const list: LeagueScenario[] = [
    league("L0a", "L0-leer", 0, "L0 Entwurf ohne Teilnehmer", [
      "status:ACTIVE",
      "teilnehmer:keine",
      "spielplan:keiner",
    ]),
    league("L0b", "L0-teilnehmer", 6, "L0 Teilnehmer ohne Spielplan", [
      "teilnehmer:da",
      "spielplan:keiner",
    ]),
    league(
      "L1a",
      "L1",
      6,
      "L1 Spielplan, kein Ergebnis",
      ["teilnehmer:gerade", "spielplan:da", "ergebnis:keines", "paarung:offen"],
      { public: "passwort" }
    ),
    league("L1b", "L1", 5, "L1 Spielplan mit Freilos, kein Ergebnis", [
      "teilnehmer:ungerade",
      "spielplan:da",
      "ergebnis:keines",
      "paarung:freilos",
    ]),
    league(
      "L2",
      "L2",
      7,
      "L2 Hinrunde läuft",
      [
        "hinrunde:teilweise",
        "paarung:fertig",
        "paarung:offen",
        "paarung:freilos",
        "paarung:kampflos",
        "rueckzug:offene-paarungen",
        ...(isBestOf
          ? (["bestof:1-0-offen", "bestof:stechschuss", "direkt:offen"] as Fact[])
          : (["fristen"] as Fact[])),
      ],
      { public: "passwort-qr" }
    ),
  ]
  if (!isBestOf) {
    list.push(
      league("L3", "L3", 6, "L3 Rückrunde läuft", ["rueckrunde:teilweise", "paarung:offen"], {
        discipline: "Luftgewehr Zehntel",
      })
    )
  }
  list.push(
    league(
      "L4",
      "L4",
      isBestOf ? 4 : 6,
      "L4 Gruppenphase fertig",
      ["gruppe:fertig", "playoffs:keine", ...(isBestOf ? (["direkt:ausgeglichen"] as Fact[]) : [])],
      { bracket: "HF" }
    )
  )
  for (const bracket of ["AF", "VF", "HF"] as const) {
    const b = BRACKET[bracket]
    list.push(
      league(
        `L5-${bracket}-mitten`,
        "L5-mitten",
        b.size,
        `L5 ${b.label} mitten in der Runde`,
        ["gruppe:fertig", b.fact, "runde:mitten"],
        { bracket, public: "offen" }
      ),
      league(
        `L5-${bracket}-fertig`,
        "L5-fertig",
        b.size,
        `L5 ${b.label} fertig, nicht weitergeschaltet`,
        [b.fact, "runde:fertig-nicht-weiter"],
        { bracket }
      )
    )
  }
  list.push(
    league("L6a", "L6-offen", 4, "L6 Finale läuft", ["finale:offen"], { bracket: "HF" }),
    league(
      "L6b",
      "L6-hauptwertung",
      4,
      "L6 Finale über die Hauptwertung",
      ["finale:hauptwertung"],
      {
        bracket: "HF",
      }
    ),
    league(
      "L6c",
      "L6-stichkriterium",
      4,
      "L6 Finale über ein Stichkriterium",
      ["finale:stichkriterium"],
      { bracket: "HF" }
    ),
    league(
      "L6d",
      "L6-verlaengerung",
      4,
      "L6 Finale in der Verlängerung",
      ["finale:verlaengerung"],
      { bracket: "HF" }
    ),
    league(
      "L7a",
      "L7-mit-playoffs",
      4,
      "L7 abgeschlossen mit Playoffs",
      ["status:COMPLETED", "finale:hauptwertung"],
      { bracket: "HF" }
    ),
    league("L7b", "L7-ohne-playoffs", 5, "L7 abgeschlossen ohne Playoffs", [
      "status:COMPLETED",
      "gruppe:fertig",
      "playoffs:keine",
    ]),
    league("L7c", "L7-archiviert", 4, "L7 archiviert", ["status:ARCHIVED", "finale:hauptwertung"], {
      bracket: "HF",
    })
  )
  return list
}

// ─── Event ───────────────────────────────────────────────────────────────────────────────────────

const EVENT_MODES: { mode: ScoringMode; label: string; extra?: Partial<EventScenario> }[] = [
  { mode: "RINGTEILER", label: "Ringteiler", extra: { guests: 2 } },
  { mode: "RINGS", label: "Ringe", extra: { sharedPlaces: true } },
  { mode: "RINGS_DECIMAL", label: "Zehntelringe", extra: { discipline: "Luftgewehr Auflage" } },
  { mode: "TEILER", label: "Teiler, gemischte Disziplinen", extra: { mixed: true } },
  { mode: "DECIMAL_REST", label: "Nachkommastellen", extra: { discipline: "Luftgewehr Auflage" } },
]

const TARGET_MODES: { mode: ScoringMode; label: string }[] = [
  { mode: "TARGET_ABSOLUTE", label: "genau" },
  { mode: "TARGET_UNDER", label: "unter" },
  { mode: "TARGET_OVER", label: "über" },
]

const TARGET_TYPES: { type: TargetValueType; label: string; value: number }[] = [
  { type: "TEILER", label: "Teiler", value: 50 },
  { type: "RINGS", label: "Ringe", value: 90 },
  { type: "RINGS_DECIMAL", label: "Zehntelringe", value: 98.5 },
]

function eventScenarios(): EventScenario[] {
  const event = (
    code: string,
    label: string,
    scoringMode: ScoringMode,
    phase: EventPhase,
    expect: Fact[],
    extra: Partial<EventScenario> = {}
  ): EventScenario => ({
    kind: "EVENT",
    code: `E-${code}`,
    name: `E · ${label}`,
    scoringMode,
    phase,
    size: 8,
    expect,
    ...extra,
  })

  const list: EventScenario[] = [
    event("ST", "Entwurf mit Starterliste (Ringteiler)", "RINGTEILER", "starterliste", [
      "status:ACTIVE",
      "startnummern",
      "serien:keine",
    ]),
    event(
      "TW",
      "teilweise gewertet (Ringteiler)",
      "RINGTEILER",
      "teilweise",
      ["serien:teilweise", "gaeste"],
      { guests: 1, public: "offen" }
    ),
  ]
  for (const { mode, label, extra } of EVENT_MODES) {
    const expect: Fact[] = ["status:COMPLETED", "serien:alle"]
    if (extra?.guests) expect.push("gaeste")
    if (extra?.sharedPlaces) expect.push("plaetze:geteilt")
    if (extra?.mixed) expect.push("faktor")
    list.push(event(`${mode}`, `${label}, fertig`, mode, "fertig", expect, extra))
  }
  for (const target of TARGET_MODES) {
    for (const type of TARGET_TYPES) {
      list.push(
        event(
          `${target.mode}-${type.type}`,
          `Zielwert ${target.label} ${type.label} (${String(type.value).replace(".", ",")}), fertig`,
          target.mode,
          "fertig",
          ["status:COMPLETED", "serien:alle", "ziel:getroffen"],
          { target: { type: type.type, value: type.value } }
        )
      )
    }
  }
  for (const scoring of ["SUM", "BEST"] as const) {
    for (const size of [2, 3]) {
      list.push(
        event(
          `T-${scoring}-${size}`,
          `Teams ${scoring === "SUM" ? "Summe" : "Bestes"}, Teamgröße ${size}, fertig`,
          "RINGTEILER",
          "fertig",
          ["status:COMPLETED", "teams", "serien:alle"],
          { team: { size, scoring }, size: size * 4 }
        )
      )
    }
  }
  return list
}

// ─── Saison ──────────────────────────────────────────────────────────────────────────────────────

function seasonScenarios(): SeasonScenario[] {
  const season = (
    code: string,
    label: string,
    scoringMode: ScoringMode,
    phase: SeasonPhase,
    expect: Fact[],
    extra: Partial<SeasonScenario> = {}
  ): SeasonScenario => ({
    kind: "SEASON",
    code: `S-${code}`,
    name: `S · ${label}`,
    scoringMode,
    phase,
    expect,
    ...extra,
  })
  const mixedMinimum: Fact[] = [
    "saison:mindestserien-erreicht",
    "saison:mindestserien-verfehlt",
    "saison:ohne-serie",
  ]
  return [
    season("RINGS", "klassisch nach Ringen, gemischt", "RINGS", "gemischt", mixedMinimum),
    season("TEILER", "klassisch nach Teiler, gemischt", "TEILER", "gemischt", mixedMinimum),
    season("RT", "klassisch nach Ringteiler, gemischt", "RINGTEILER", "gemischt", mixedMinimum, {
      public: "offen",
    }),
    season("ALT-R", "Ringe/Teiler alternierend", "RINGTEILER", "gemischt", mixedMinimum, {
      sortMode: "ALT_RINGS_FIRST",
    }),
    season("ALT-T", "Teiler/Ringe alternierend", "RINGTEILER", "gemischt", mixedMinimum, {
      sortMode: "ALT_TEILER_FIRST",
    }),
    season(
      "FAKTOR",
      "Faktor-Korrektur, gemischte Disziplinen",
      "RINGTEILER",
      "gemischt",
      ["faktor", ...mixedMinimum],
      { mixed: true }
    ),
    season("WENIG", "wenige Serien", "RINGTEILER", "wenige", ["saison:mindestserien-verfehlt"]),
    season("FERTIG", "fertig", "RINGTEILER", "fertig", [
      "status:COMPLETED",
      "saison:mindestserien-erreicht",
    ]),
  ]
}

/**
 * Saison mit Einschreibungen ohne Mindestzahl (etwa Jugend). Steht am Ende von `SCENARIOS`: Die Uhr jedes Szenarios
 * folgt aus seiner Stelle, ein Szenario weiter vorn verschöbe die Daten aller späteren.
 */
function seasonExemptionScenarios(): SeasonScenario[] {
  return [
    {
      kind: "SEASON",
      code: "S-OHNE-MINDEST",
      name: "S · ohne Mindestzahl, etwa Jugend",
      scoringMode: "RINGTEILER",
      phase: "ausnahme",
      exempt: [0, 1],
      expect: [
        "saison:ohne-mindestzahl-gewertet",
        "saison:ohne-mindestzahl-ohne-serie",
        "saison:mindestserien-erreicht",
        "saison:mindestserien-verfehlt",
      ],
    },
  ]
}

// ─── Ränder ──────────────────────────────────────────────────────────────────────────────────────

function edgeScenarios(): Scenario[] {
  return [
    {
      kind: "LEAGUE",
      code: "R-LANG",
      name: "R · 16 Teilnehmer mit langen Namen",
      format: "DRR",
      phase: "L1",
      size: 16,
      longNames: true,
      expect: ["teilnehmer:16", "namen:lang", "spielplan:da"],
    },
    {
      kind: "LEAGUE",
      code: "R-GLEICH",
      name: "R · Gleichstand auf Platz 1 und 3 (Hin/Rück)",
      format: "DRR",
      phase: "gleichstand",
      size: 4,
      expect: ["gruppe:fertig", "platz:geteilt-1-und-3"],
    },
    {
      kind: "EVENT",
      code: "R-LEER-E",
      name: "R · leerer Wettbewerb (Event)",
      scoringMode: "RINGTEILER",
      phase: "leer",
      size: 0,
      expect: ["teilnehmer:keine"],
    },
    {
      kind: "SEASON",
      code: "R-LEER-S",
      name: "R · leerer Wettbewerb (Saison)",
      scoringMode: "RINGTEILER",
      phase: "leer",
      expect: ["teilnehmer:keine"],
    },
    {
      kind: "EVENT",
      code: "R-DISZ",
      name: "R · Disziplin archiviert (Zimmerstutzen)",
      scoringMode: "RINGS",
      phase: "fertig",
      size: 6,
      discipline: "Zimmerstutzen",
      archiveDiscipline: true,
      expect: ["disziplin:archiviert", "serien:alle"],
    },
    {
      kind: "EVENT",
      code: "R-ARCHIV",
      name: "R · Wettbewerb archiviert (Event)",
      scoringMode: "RINGTEILER",
      phase: "archiviert",
      size: 6,
      formerMembers: true,
      expect: ["status:ARCHIVED", "serien:alle", "teilnehmer:inaktiv"],
    },
  ]
}

// ─── Wertung: Fälle, in denen Anzeige und Wertung übereinstimmen müssen ──────────────────────────

function scoringScenarios(): LeagueScenario[] {
  return [
    {
      kind: "LEAGUE",
      code: "L-FIN-TB",
      name: "L7 Finale per Stichkriterium (Hin/Rück)",
      format: "DRR",
      phase: "L7-mit-playoffs",
      size: 4,
      bracket: "HF",
      finale: { primary: "RINGS", tiebreaker1: "RINGTEILER" },
      expect: ["status:COMPLETED", "finale:stichkriterium-entscheidet"],
    },
    {
      kind: "LEAGUE",
      code: "L-MIX-T",
      name: "L4 gemischt nach Teiler (Hin/Rück)",
      format: "DRR",
      phase: "L4",
      size: 6,
      bracket: "HF",
      scoringMode: "TEILER",
      mixed: true,
      fixed: "teiler-roh-anders",
      expect: ["gruppe:fertig", "faktor", "liga:teiler-roh-anders"],
    },
    {
      kind: "LEAGUE",
      code: "L-RINGE",
      name: "L4 nach Ringen, Punktgleich (Hin/Rück)",
      format: "DRR",
      phase: "L4",
      size: 6,
      bracket: "HF",
      scoringMode: "RINGS",
      fixed: "ringe-gegen-ringteiler",
      expect: ["gruppe:fertig", "liga:ringe-gegen-ringteiler"],
    },
  ]
}

export const SCENARIOS: Scenario[] = [
  ...leagueScenarios("DRR"),
  ...leagueScenarios("BO3"),
  ...leagueScenarios("BO5"),
  ...eventScenarios(),
  ...seasonScenarios(),
  ...edgeScenarios(),
  ...scoringScenarios(),
  ...seasonExemptionScenarios(),
]
