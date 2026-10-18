import { describe, expect, it } from "vitest"

import { withoutDisciplineStamp } from "./bestand"
import { changedTables, echtDatabaseUrl } from "./echt"
import { featuresOf, phaseReport, type CompetitionFacts } from "./phases"
import { compareAll, lineDiff, swapTableRows, type Recording } from "./compare"
import { dataTokenizer, normalizePdfText, normalizeStarterNumbers, pageLines } from "./normalize"
import { sorted } from "./store"
import { pdfTargets, withKeys, type CompetitionRow } from "./targets"

const names = {
  people: [
    { firstName: "Olga", lastName: "Esche" },
    { firstName: "Ann", lastName: "Lech" },
    { firstName: "Ann", lastName: "Lechner" },
  ],
  other: ["L-DRR-6 · L2 Hinrunde läuft (Hin/Rück)"],
}

describe("Text einer Seite", () => {
  it("fasst Leerraum zusammen und trennt Tabellenzellen mit „ | “", () => {
    expect(pageLines("Pl.\tName\tRinge\n1\t\nOlga  Esche\n\t98\n\n")).toEqual([
      "Pl. | Name | Ringe",
      "1",
      "Olga Esche",
      "98",
    ])
  })
})

describe("Text eines PDFs", () => {
  it("nimmt Erstelldatum und Server-Adresse heraus, nicht den Rest", () => {
    const text =
      "Liga   Erstellt: 18.10.2026  \nhttp://localhost:3010/api/public/c/liga-2026/pdf\n1  Esche, Olga  98\n\n"
    expect(normalizePdfText(text, "http://localhost:3010")).toEqual([
      "Liga   Erstellt: <Datum>",
      "<Server>/api/public/c/liga-2026/pdf",
      "1  Esche, Olga  98",
    ])
  })

  it("nimmt den Server auch heraus, wenn die URL nach ihm umbricht", () => {
    expect(
      normalizePdfText(
        "Liga    http://localhost:3010\n   /api/public/c/liga/pdf",
        "http://localhost:3010"
      )
    ).toEqual(["Liga    <Server>", "   /api/public/c/liga/pdf"])
  })

  it("lässt andere Daten und jeden anderen Server im Text stehen", () => {
    expect(normalizePdfText("Frist: 18.10.2026", "http://localhost:3010")).toEqual([
      "Frist: 18.10.2026",
    ])
    expect(
      normalizePdfText("https://falsch.example.org/api/public/c/liga/pdf", "http://localhost:3010")
    ).toEqual(["https://falsch.example.org/api/public/c/liga/pdf"])
  })
})

describe("Starterliste", () => {
  const list = (numbers: number[]) => [
    "     Nr. Name                      Disziplin",
    ...numbers.map((n, i) => `   ${n}       Name${i}, Vor             Luftgewehr`),
    "Starterliste — Event                                Seite 1 / 1",
  ]

  it("nimmt die ausgeloste Nummer heraus, die Zeilen bleiben", () => {
    expect(normalizeStarterNumbers(list([2, 1]))).toEqual([
      "     Nr. Name                      Disziplin",
      "<Nr>  Name0, Vor             Luftgewehr",
      "<Nr>  Name1, Vor             Luftgewehr",
      "Starterliste — Event                                Seite 1 / 1",
      "Startnummern: 1 bis 2",
    ])
    expect(normalizeStarterNumbers(list([3, 1, 2]))).toEqual(
      normalizeStarterNumbers(list([1, 2, 3]))
    )
  })

  it("meldet doppelte oder fehlende Nummern", () => {
    expect(normalizeStarterNumbers(list([1, 1])).at(-1)).toBe("Startnummern: 1, 1 statt 1 bis 2")
  })
})

describe("Datenfolge", () => {
  const tokens = dataTokenizer(names)

  it("nimmt Zahlen und Namen in Lesereihenfolge, ohne Beschriftungen", () => {
    expect(
      tokens(["Pl. | Name | Ringe | Teiler", "1 | Esche, Olga | 98 | 7,7", "Satz 5:4 · −3"])
    ).toEqual(["1", "Olga Esche", "98", "7,7", "5:4", "-3"])
  })

  it("zählt beide Schreibweisen eines Namens als dasselbe Zeichen", () => {
    expect(tokens(["Olga Esche"])).toEqual(tokens(["Esche, Olga"]))
  })

  it("findet den längeren Namen statt eines kürzeren darin", () => {
    expect(tokens(["Ann Lechner"])).toEqual(["Ann Lechner"])
  })

  it("nimmt Wörter mit Bedeutung für das Ergebnis, egal ob groß oder klein", () => {
    expect(tokens(["Esche, Olga (Zur.) | Freilos", "VIERTELFINALE", "offen · Lech"])).toEqual([
      "Olga Esche",
      "Zur.",
      "Freilos",
      "Viertelfinale",
      "offen",
    ])
  })

  it("liest „Best-of-3“ nicht als Zahl -3", () => {
    expect(tokens(["Best-of-3 (2 Siege)"])).toEqual(["3", "2"])
  })

  it("nimmt den Namen eines Wettbewerbs als ein Zeichen", () => {
    expect(tokens(["L-DRR-6 · L2 Hinrunde läuft (Hin/Rück)"])).toEqual([
      "L-DRR-6 · L2 Hinrunde läuft (Hin/Rück)",
    ])
  })
})

const recording = (pages: Record<string, string[]>): Recording => ({
  name: "L-DRR-6",
  reach: { "schedule@ADMIN": "/schedule" },
  pages,
  pdfs: { schedule: ["Erstellt: <Datum>", "1  Esche, Olga  98"] },
})

describe("Vergleich", () => {
  const table = ["Tabelle", "1 | Esche, Olga | 98", "2 | Lech, Ann | 93"]

  it("findet nichts, wenn beide Aufnahmen gleich sind", () => {
    const a = new Map([["l", recording({ "schedule@ADMIN@1280": table })]])
    expect(compareAll(a, structuredClone(a), names)).toEqual([])
  })

  it("meldet einen verlorenen Rückzug als Fehler, nicht als andere Beschriftung", () => {
    const a = new Map([
      ["l", recording({ "standings@ADMIN@1280": ["1 | Esche, Olga | Zurückgezogen"] })],
    ])
    const b = new Map([["l", recording({ "standings@ADMIN@1280": ["1 | Esche, Olga |"] })]])
    expect(compareAll(a, b, names).map((f) => f.severity)).toEqual(["fehler"])
  })

  it("meldet eine andere Beschriftung nur als Hinweis", () => {
    const a = new Map([["l", recording({ "schedule@ADMIN@1280": table })]])
    const b = new Map([
      ["l", recording({ "schedule@ADMIN@1280": ["Rangliste", ...table.slice(1)] })],
    ])
    expect(compareAll(a, b, names).map((f) => f.severity)).toEqual(["hinweis"])
  })

  it("meldet einen anderen Wert, eine fehlende Seite und anderen PDF-Text als Fehler", () => {
    const a = new Map([
      ["l", recording({ "schedule@ADMIN@1280": table, "playoffs@USER@390": ["x"] })],
    ])
    const changed = recording({
      "schedule@ADMIN@1280": [table[0], "1 | Esche, Olga | 97", table[2]],
    })
    changed.pdfs.schedule = ["Erstellt: <Datum>", "1  Esche, Olga  97"]
    const findings = compareAll(a, new Map([["l", changed]]), names)
    expect(findings.map((f) => [f.severity, f.what])).toEqual([
      ["fehler", "schedule@ADMIN@1280: Zahlen, Namen oder Reihenfolge anders"],
      ["fehler", "playoffs@USER@390: Seite fehlt nachher"],
      ["fehler", "PDF schedule: Text anders"],
    ])
  })

  it("meldet eine andere Erreichbarkeit und einen fehlenden Wettbewerb", () => {
    const a = new Map([
      ["l", recording({})],
      ["e", recording({})],
    ])
    const moved = recording({})
    moved.reach["schedule@ADMIN"] = "→ /ranking"
    const findings = compareAll(a, new Map([["l", moved]]), names)
    expect(findings.map((f) => f.what)).toEqual([
      "schedule@ADMIN: erreichbar anders",
      "Wettbewerb fehlt nachher",
    ])
  })

  it("Gegenprobe: zwei vertauschte Tabellenzeilen sind ein Fehler", () => {
    const a = new Map([["l", recording({ "schedule@ADMIN@1280": table })]])
    const b = structuredClone(a)
    expect(swapTableRows(b)).toEqual({ key: "l", page: "schedule@ADMIN@1280" })
    const findings = compareAll(a, b, names)
    expect(findings).toHaveLength(1)
    expect(findings[0].severity).toBe("fehler")
  })

  it("meldet ein anderes Bracket als Fehler", () => {
    const a = recording({})
    a.bracket = [{ name: "Finale", pairings: [{ a: "Olga Esche", b: "Ann Lech", stand: "3:1" }] }]
    const b = structuredClone(a)
    b.bracket![0].pairings[0].stand = "3:2"
    const findings = compareAll(new Map([["l", a]]), new Map([["l", b]]), names)
    expect(findings.map((f) => f.what)).toEqual(["Bracket anders"])
  })

  it("Diff zeigt, welche Zeile wegfällt und welche dazukommt", () => {
    expect(lineDiff(["a", "b", "c"], ["a", "x", "c"])).toBe("- b  (Zeile 2)\n+ x  (Zeile 2)")
  })
})

const row = (over: Partial<CompetitionRow>): Omit<CompetitionRow, "key"> => ({
  id: "c1",
  name: "Liga",
  type: "LEAGUE",
  status: "ACTIVE",
  isPublic: false,
  publicSlug: null,
  hasPassword: false,
  ...over,
})

describe("Ziele", () => {
  it("vergibt eindeutige Schlüssel auch bei gleichem Namen", () => {
    expect(
      withKeys([row({ name: "Liga Ü 50" }), row({ name: "Liga Ü 50" })]).map((c) => c.key)
    ).toEqual(["liga-ue-50", "liga-ue-50-2"])
  })

  it("nimmt die PDFs je Art und das öffentliche mit und ohne Passwort", () => {
    const [league] = withKeys([row({ isPublic: true, publicSlug: "liga", hasPassword: true })])
    expect(pdfTargets(league, "geheim").map((p) => p.name)).toEqual([
      "schedule",
      "playoffs",
      "oeffentlich",
      "oeffentlich-mit-passwort",
    ])
    const [event] = withKeys([row({ type: "EVENT" })])
    expect(pdfTargets(event, null).map((p) => p.name)).toEqual(["ranking", "starter-list"])
    const [season] = withKeys([
      row({ type: "SEASON", isPublic: true, publicSlug: "s", hasPassword: true }),
    ])
    expect(pdfTargets(season, null).map((p) => p.name)).toEqual(["standings", "oeffentlich"])
  })
})

describe("Bestand", () => {
  it("lässt nur den Zeitstempel weg, den der Start der App an den Standarddisziplinen setzt", () => {
    const line = (updatedAt: string) =>
      JSON.stringify({
        createdAt: "2026-01-05 08:00:00",
        isSystem: true,
        name: "Luftgewehr",
        updatedAt,
      })
    expect(withoutDisciplineStamp(line("2026-01-05 08:00:00"))).toBe(
      withoutDisciplineStamp(line("2026-10-18 09:34:40.202"))
    )
    expect(withoutDisciplineStamp(line("x"))).toContain('"name":"Luftgewehr"')
  })
})

const league = (over: Partial<CompetitionFacts>): CompetitionFacts => ({
  type: "LEAGUE",
  status: "ACTIVE",
  leagueFormat: "DOUBLE_ROUND_ROBIN",
  groupBestOf: null,
  scoringMode: "RINGTEILER",
  targetValueType: null,
  teamSize: null,
  teamScoring: null,
  seasonSortMode: null,
  isPublic: false,
  hasPassword: false,
  participants: 6,
  withdrawn: 0,
  matchups: 30,
  completed: 0,
  byes: 0,
  walkovers: 0,
  secondLeg: 15,
  secondLegCompleted: 0,
  playoffs: {},
  finalSuddenDeath: false,
  series: 0,
  withSeries: 0,
  ...over,
})

describe("Phasen", () => {
  const phase = (over: Partial<CompetitionFacts>) => featuresOf(league(over)).at(-1)

  it("ordnet die Gruppenphase ein", () => {
    expect(phase({ matchups: 0, participants: 0 })).toBe("Liga Hin/Rück · L0 ohne Teilnehmer")
    expect(phase({})).toBe("Liga Hin/Rück · L1 Spielplan, kein Ergebnis")
    expect(phase({ completed: 3 })).toBe("Liga Hin/Rück · L2 Hinrunde läuft")
    expect(phase({ completed: 17, secondLegCompleted: 2 })).toBe(
      "Liga Hin/Rück · L3 Rückrunde läuft"
    )
    expect(phase({ completed: 28, walkovers: 2 })).toBe("Liga Hin/Rück · L4 Gruppenphase fertig")
  })

  it("ordnet die Playoffs nach Größe und jüngster Runde ein", () => {
    expect(phase({ completed: 30, playoffs: { QUARTER_FINAL: [4, 2] } })).toBe(
      "Liga Hin/Rück · L5 Viertelfinale mitten"
    )
    expect(phase({ completed: 30, playoffs: { QUARTER_FINAL: [4, 4], SEMI_FINAL: [2, 2] } })).toBe(
      "Liga Hin/Rück · L5 Viertelfinale, jetzt Halbfinale fertig, nicht weitergeschaltet"
    )
    expect(phase({ playoffs: { SEMI_FINAL: [2, 2], FINAL: [1, 1] }, finalSuddenDeath: true })).toBe(
      "Liga Hin/Rück · L6 Finale in der Verlängerung"
    )
    expect(phase({ status: "ARCHIVED", playoffs: { FINAL: [1, 1] } })).toBe(
      "Liga Hin/Rück · L7 Ende mit Playoffs"
    )
  })

  it("nennt Freilos, Kampflos, Rückzug und Veröffentlichung", () => {
    const f = featuresOf(
      league({ byes: 3, walkovers: 1, withdrawn: 1, isPublic: true, hasPassword: true })
    )
    expect(f).toEqual(
      expect.arrayContaining([
        "Liga: Freilos",
        "Liga: Kampflos",
        "Rückzug",
        "öffentlich mit Passwort",
      ])
    )
  })

  it("Bericht nennt, was nur die echten Daten haben", () => {
    const report = phaseReport(
      new Map([
        ["a", 1],
        ["b", 2],
      ]),
      new Map([
        ["a", 3],
        ["c", 1],
      ])
    )
    expect(report).toContain(
      "## Nur in den echten Daten (deckt der Prüfbestand nicht ab)\n\n| Merkmal"
    )
    expect(report).toContain("| b | 2 | 0 |")
    expect(report).toContain("| c | 0 | 1 |")
  })
})

describe("echte Daten nur lesend", () => {
  it("meldet jede Tabelle mit anderem Fingerabdruck", () => {
    expect(
      changedTables(
        new Map([
          ["A", "1:x"],
          ["B", "2:y"],
        ]),
        new Map([
          ["A", "1:x"],
          ["B", "3:z"],
          ["C", "0:-"],
        ])
      )
    ).toEqual(["B", "C"])
  })
})

describe("Dev-Datenbank für --echt", () => {
  const url = (u: string) => () => echtDatabaseUrl({ DATABASE_URL: u })

  it("nimmt nur eine Datenbank auf diesem Rechner ohne Parameter, nie die Prüfdatenbank", () => {
    expect(url("postgresql://r:r@localhost:5432/ringwerk")()).toContain("/ringwerk")
    expect(url("postgresql://r:r@[::1]:5432/ringwerk")()).toContain("/ringwerk")
    expect(url("postgresql://r:r@db.example.org:5432/ringwerk")).toThrow("diesem Rechner")
    expect(url("postgresql://r:r@localhost:5432/ringwerk?host=db.example.org")).toThrow(
      "ohne Parameter"
    )
    expect(url("postgresql://r:r@localhost:5432/ringwerk_pruef")).toThrow("Prüfdatenbank")
  })
})

describe("Ablage", () => {
  it("sortiert die Schlüssel, unabhängig davon, welcher Tab zuerst fertig war", () => {
    const rec: Recording = {
      name: "x",
      reach: { "b@USER": "ok", "a@ADMIN": "ok" },
      pages: { "z@ADMIN@390": [], "a@ADMIN@1280": [] },
      pdfs: { schedule: [], playoffs: [] },
    }
    const s = sorted(rec)
    expect(Object.keys(s.reach)).toEqual(["a@ADMIN", "b@USER"])
    expect(Object.keys(s.pages)).toEqual(["a@ADMIN@1280", "z@ADMIN@390"])
    expect(Object.keys(s.pdfs)).toEqual(["playoffs", "schedule"])
  })
})
