import { describe, expect, it } from "vitest"

import { DEFAULT_CHOICE, type PeriodChoice } from "../period/calendar"
import {
  cardFromParts,
  cardHash,
  cardToParams,
  decodeChoice,
  decodeCompare,
  DEFAULT_LIST,
  DEFAULT_PROGRESS,
  encodeChoice,
  encodeCompare,
  listQueryFromParams,
  listQueryToParams,
  progressQueryFromParams,
  progressQueryToParams,
  isCardId,
  isNamedPeriodId,
  routeFromHref,
  routeFromUrl,
  urlFromRoute,
  type CardOrigin,
  type ListQuery,
  type ProgressQuery,
  type Route,
} from "./routes"

const query = (pairs: readonly (readonly [string, string])[]) =>
  pairs.map(([k, v]) => `${k}=${v}`).join("&")

describe("Zeitraum und Vergleich als Wert (D4)", () => {
  it("rollend, alles, frei und benannt in beide Richtungen", () => {
    const cases: [PeriodChoice, string][] = [
      [{ type: "rolling", days: 30 }, "30d"],
      [{ type: "rolling", days: 90 }, "90d"],
      [{ type: "rolling", days: 365 }, "12m"],
      [{ type: "all" }, "all"],
      [{ type: "free", from: "2026-05-01", to: "2026-06-30" }, "2026-05-01..2026-06-30"],
      [{ type: "named", id: "neue-munition" }, "neue-munition"],
    ]
    for (const [choice, text] of cases) {
      expect(encodeChoice(choice)).toBe(text)
      expect(decodeChoice(text, DEFAULT_CHOICE)).toEqual(choice)
    }
  })

  it("ein freier Zeitraum nur mit echten Tagen in der richtigen Reihenfolge, auch ein einzelner Tag", () => {
    expect(decodeChoice("2026-02-30..2026-03-01", DEFAULT_CHOICE)).toBe(DEFAULT_CHOICE)
    expect(decodeChoice("2026-06-30..2026-05-01", DEFAULT_CHOICE)).toBe(DEFAULT_CHOICE)
    expect(decodeChoice("2026-6-1..2026-06-30", DEFAULT_CHOICE)).toBe(DEFAULT_CHOICE)
    expect(decodeChoice("2028-02-29..2028-02-29", DEFAULT_CHOICE)).toEqual({
      type: "free",
      from: "2028-02-29",
      to: "2028-02-29",
    })
  })

  it("ein benannter Zeitraum nur als Id; die festen Werte gehen vor", () => {
    expect(decodeChoice("Neue Munition", DEFAULT_CHOICE)).toBe(DEFAULT_CHOICE)
    expect(decodeChoice("-munition", DEFAULT_CHOICE)).toBe(DEFAULT_CHOICE)
    expect(decodeChoice("all", DEFAULT_CHOICE)).toEqual({ type: "all" })
    expect(decodeChoice("12m", DEFAULT_CHOICE)).toEqual({ type: "rolling", days: 365 })
  })

  it("ohne Wert oder mit leerem Wert gilt die Vorgabe, auch null", () => {
    expect(decodeChoice(null, DEFAULT_CHOICE)).toBe(DEFAULT_CHOICE)
    expect(decodeChoice("", DEFAULT_CHOICE)).toBe(DEFAULT_CHOICE)
    expect(decodeChoice(null, null)).toBeNull()
    expect(decodeChoice("7 Tage", null)).toBeNull()
    // „7d“ ist kein fester Wert, aber eine gültige Id eines benannten Zeitraums
    expect(decodeChoice("7d", null)).toEqual({ type: "named", id: "7d" })
  })

  it("Vergleich: ohne, der Zeitraum davor oder ein benannter", () => {
    expect(encodeCompare({ type: "none" })).toBeNull()
    expect(encodeCompare({ type: "previous" })).toBe("previous")
    expect(encodeCompare({ type: "named", id: "saison-2025" })).toBe("saison-2025")
    expect(decodeCompare(null)).toEqual({ type: "none" })
    expect(decodeCompare("previous")).toEqual({ type: "previous" })
    expect(decodeCompare("saison-2025")).toEqual({ type: "named", id: "saison-2025" })
    expect(decodeCompare("Saison 2025")).toEqual({ type: "none" })
  })
})

describe("Liste und Fortschritt als Query (D4)", () => {
  it("die Vorgaben ergeben keine Schlüssel, und ohne Schlüssel gelten die Vorgaben", () => {
    expect(listQueryToParams(DEFAULT_LIST)).toEqual([])
    expect(progressQueryToParams(DEFAULT_PROGRESS)).toEqual([])
    expect(listQueryFromParams(new URLSearchParams())).toEqual(DEFAULT_LIST)
    expect(progressQueryFromParams(new URLSearchParams())).toEqual(DEFAULT_PROGRESS)
  })

  it("ein voller Fortschritt in fester Reihenfolge", () => {
    const full: ProgressQuery = {
      choice: { type: "free", from: "2026-05-01", to: "2026-06-30" },
      compare: { type: "previous" },
      family: "lp-10m",
      kind: "training",
      includeProbeOnly: false,
      scoring: "rings",
      metric: "group.sigma",
      view: "months",
      chosen: "c42",
    }
    const text =
      "range=2026-05-01..2026-06-30&compare=previous&family=lp-10m&kind=training&sighters=0&scoring=rings&metric=sigma&view=months&pick=c42"
    expect(query(progressQueryToParams(full))).toBe(text)
    expect(progressQueryFromParams(new URLSearchParams(text))).toEqual(full)
  })

  it("Vorgaben im Link werden gelesen und fallen beim Schreiben weg; Unbekanntes gilt als Vorgabe", () => {
    const read = progressQueryFromParams(
      new URLSearchParams("sighters=1&metric=mean&range=90d&kind=wettkampf&view=jahr&pick=a b")
    )
    expect(read).toEqual(DEFAULT_PROGRESS)
    expect(progressQueryToParams(read)).toEqual([])
    expect(progressQueryFromParams(new URLSearchParams("metric=tens&scoring=zehntel")).metric).toBe(
      "result.tensRate"
    )
    expect(progressQueryFromParams(new URLSearchParams("metric=tempo")).metric).toBe(
      "time.intervalMedian"
    )
  })

  it("die Liste: ohne Zeitraum alle Abende, „all“ ebenso; Familie und Merkmal nur als Id", () => {
    const list = listQueryFromParams(
      new URLSearchParams("range=all&family=lg-10m&kind=competition&flag=nur-pdf")
    )
    expect(list).toEqual({ range: null, family: "lg-10m", kind: "competition", flag: "nur-pdf" })
    expect(query(listQueryToParams(list))).toBe("family=lg-10m&kind=competition&flag=nur-pdf")
    expect(query(listQueryToParams({ ...list, range: { type: "rolling", days: 30 } }))).toBe(
      "range=30d&family=lg-10m&kind=competition&flag=nur-pdf"
    )
    expect(listQueryFromParams(new URLSearchParams("family=LG 10m&flag=")).family).toBeNull()
  })
})

describe("die Scheibe: Herkunft, Auswahl, Schuss, Anker (D4–D6)", () => {
  it("aus dem Fortschritt mit Serie, Schuss und Reiter, und zurückgeschrieben dieselbe Zeichenkette", () => {
    const card = cardFromParts(
      "c42",
      new URLSearchParams("from=progress&family=lg-10m&series=2&shot=23"),
      "#position"
    )
    expect(card).toEqual({
      page: "card",
      id: "c42",
      origin: {
        from: "progress",
        query: {
          choice: { type: "rolling", days: 90 },
          compare: { type: "none" },
          family: "lg-10m",
          kind: "all",
          includeProbeOnly: true,
          metric: "result.decimalMean",
          view: null,
        },
      },
      selection: 2,
      shot: "23",
      scoring: "decimal",
      anchor: { section: "analysis", tab: "position" },
    })
    expect(query(cardToParams(card))).toBe("from=progress&family=lg-10m&series=2&shot=23")
    expect(cardHash(card)).toBe("#position")
  })

  it("die Herkunft trägt ihre Schlüssel, aber nicht `pick`; die Wertung ist die der Scheibe", () => {
    const card = cardFromParts(
      "c42",
      new URLSearchParams("from=progress&range=12m&compare=previous&pick=c42&scoring=rings"),
      ""
    )
    expect(card.scoring).toBe("rings")
    expect(card.origin).toMatchObject({
      from: "progress",
      query: { compare: { type: "previous" } },
    })
    expect(card.origin && "query" in card.origin && "chosen" in card.origin.query).toBe(false)
    expect(query(cardToParams(card))).toBe("from=progress&range=12m&compare=previous&scoring=rings")
  })

  it("aus der Liste, von Start und als direkter Link", () => {
    const list = cardFromParts(
      "c7",
      new URLSearchParams("from=list&family=lp-10m&flag=nur-pdf"),
      ""
    )
    expect(list.origin).toEqual({
      from: "list",
      query: { family: "lp-10m", kind: "all", flag: "nur-pdf", range: null },
    })
    expect(query(cardToParams(list))).toBe("from=list&family=lp-10m&flag=nur-pdf")
    expect(cardFromParts("c7", new URLSearchParams("from=start"), "").origin).toEqual({
      from: "start",
    })
    const direct = cardFromParts("c7", new URLSearchParams("from=liste&family=lp-10m"), "")
    expect(direct.origin).toBeNull()
    expect(cardToParams(direct)).toEqual([])
  })

  it("Auswahl: ganze Scheibe oder eine Serie; Schuss als Nummer wie shotLabels", () => {
    const read = (search: string) => cardFromParts("c1", new URLSearchParams(search), "")
    // die ganze Scheibe ist die Vorgabe und fällt weg: eine Schreibweise (Review U4)
    expect(read("series=all").selection).toBeNull()
    expect(read("series=3&shot=23").selection).toBe(3)
    expect(read("series=3&shot=23").shot).toBe("23")
    // „ohne Probe“ und die Probe gibt es seit U4 nicht mehr: alte Adressen gelten als Vorgabe, ohne Fehler
    for (const bad of [
      "series=0",
      "series=-1",
      "series=02",
      "series=zwei",
      "series=match",
      "series=sighters",
    ])
      expect(read(bad).selection).toBeNull()
    for (const bad of ["shot=0", "shot=P", "shot=p3", "shot=3a", "shot=P3"])
      expect(read(bad).shot).toBeNull()
  })

  it("ein Anker ohne Bedeutung zählt nicht; ein Abschnitt ohne Reiter bleibt ein Abschnitt", () => {
    expect(cardFromParts("c1", new URLSearchParams(), "#irgendwo").anchor).toBeNull()
    // „Zahlen“ entfiel auf der Scheibe (U1): ein alter Link mit #numbers beginnt oben, ohne Fehler
    expect(cardFromParts("c1", new URLSearchParams(), "#numbers").anchor).toBeNull()
    const card = cardFromParts("c1", new URLSearchParams(), "#shots")
    expect(card.anchor).toEqual({ section: "shots" })
    expect(cardHash(card)).toBe("#shots")
    expect(cardHash({ ...card, anchor: null })).toBe("")
  })
})

/** eine Adresse in ihre Teile, wie `location` sie liefert */
function parts(url: string): [string, string, string] {
  const hashAt = url.indexOf("#")
  const hash = hashAt < 0 ? "" : url.slice(hashAt)
  const rest = hashAt < 0 ? url : url.slice(0, hashAt)
  const searchAt = rest.indexOf("?")
  return searchAt < 0 ? [rest, "", hash] : [rest.slice(0, searchAt), rest.slice(searchAt), hash]
}
const route = (url: string) => routeFromUrl(...parts(url))

describe("die ganze Adresse (D3)", () => {
  it("zwölf Adressen mit Handwerten, je Seite mindestens eine, in beide Richtungen", () => {
    const table: [string, Route][] = [
      ["/", { page: "start" }],
      ["/cards", { page: "cards", query: DEFAULT_LIST, evening: null }],
      [
        "/cards?family=lg-10m&kind=training#2026-09-25",
        {
          page: "cards",
          query: { ...DEFAULT_LIST, family: "lg-10m", kind: "training" },
          evening: "2026-09-25",
        },
      ],
      [
        "/cards/c42?from=start&series=2#position",
        {
          page: "card",
          id: "c42",
          origin: { from: "start" },
          selection: 2,
          shot: null,
          scoring: "decimal",
          anchor: { section: "analysis", tab: "position" },
        },
      ],
      [
        "/cards/c42",
        {
          page: "card",
          id: "c42",
          origin: null,
          selection: null,
          shot: null,
          scoring: "decimal",
          anchor: null,
        },
      ],
      ["/progress", { page: "progress", query: DEFAULT_PROGRESS, section: null }],
      [
        "/progress?range=neue-munition&compare=previous&family=lg-10m&pick=c9#history",
        {
          page: "progress",
          query: {
            ...DEFAULT_PROGRESS,
            choice: { type: "named", id: "neue-munition" },
            compare: { type: "previous" },
            family: "lg-10m",
            chosen: "c9",
          },
          section: "history",
        },
      ],
      [
        "/compare?from=list&family=lg-10m&a=c1&b=c2",
        {
          page: "compare",
          origin: { from: "list", query: { ...DEFAULT_LIST, family: "lg-10m" } },
          a: "c1",
          b: "c2",
        },
      ],
      ["/scan", { page: "scan" }],
      ["/open", { page: "open" }],
      ["/profile/trash", { page: "trash" }],
      ["/admin/bridges", { page: "admin", section: "bridges" }],
    ]
    expect(table).toHaveLength(12)
    for (const [url, expected] of table) {
      expect(route(url), url).toEqual(expected)
      expect(urlFromRoute(expected), url).toBe(url)
    }
    expect(urlFromRoute({ page: "profile" })).toBe("/profile")
    expect(urlFromRoute({ page: "admin", section: null })).toBe("/admin")
  })

  it("kanonisch: vertauschte Schlüssel, Vorgaben und ein Schrägstrich am Ende ergeben dieselbe Route", () => {
    const canonical = "/progress?family=lg-10m&kind=training&pick=c1#cards"
    const messy = route("/progress/?pick=c1&range=90d&kind=training&sighters=1&family=lg-10m#cards")
    expect(messy).toEqual(route(canonical))
    expect(urlFromRoute(messy)).toBe(canonical)
    expect(route("/cards/")).toEqual(route("/cards"))
  })

  it("Unbekanntes und Ungültiges: eine eigene Route, nie ein Fehler", () => {
    expect(route("/settings")).toEqual({ page: "unknown", path: "/settings" })
    expect(route("/cards/a%20b").page).toBe("unknown")
    expect(route("/cards/%E0%A4%A").page).toBe("unknown")
    expect(route("/cards/c1/extra").page).toBe("unknown")
    expect(route("/compare?a=c1").page).toBe("unknown")
    expect(route("/admin/Bridges").page).toBe("unknown")
    expect(route("/cards#2026-02-30")).toEqual({
      page: "cards",
      query: DEFAULT_LIST,
      evening: null,
    })
    expect(urlFromRoute({ page: "unknown", path: "/settings" })).toBe("/settings")
  })

  it("Rundreise über alle Kombinationen: jede Route übersteht Schreiben und Lesen unverändert", () => {
    const lists: ListQuery[] = []
    for (const family of [null, "lg-10m"])
      for (const kind of ["all", "training"] as const)
        for (const flag of [null, "nur-pdf"])
          for (const range of [
            null,
            { type: "rolling", days: 30 } as const,
            { type: "rolling", days: 365 } as const,
            { type: "free", from: "2026-05-01", to: "2026-06-30" } as const,
            { type: "named", id: "clx8k2abc" } as const,
          ])
            lists.push({ family, kind, flag, range })
    const progresses: ProgressQuery[] = []
    for (const choice of [
      DEFAULT_CHOICE,
      { type: "all" } as const,
      { type: "rolling", days: 30 } as const,
      { type: "rolling", days: 365 } as const,
      { type: "free", from: "2026-05-01", to: "2026-06-30" } as const,
      { type: "named", id: "neue-munition" } as const,
    ])
      for (const compare of [
        { type: "none" } as const,
        { type: "previous" } as const,
        { type: "named", id: "saison-2025" } as const,
      ])
        for (const family of [null, "lp-10m"])
          for (const kind of ["all", "training", "competition"] as const)
            for (const includeProbeOnly of [true, false])
              for (const scoring of ["decimal", "rings"] as const)
                for (const metric of [
                  "result.decimalMean",
                  "group.sigma",
                  "result.tensRate",
                  "time.intervalMedian",
                ] as const)
                  for (const view of [null, "cards", "months"] as const)
                    for (const chosen of [null, "c9"])
                      progresses.push({
                        choice,
                        compare,
                        family,
                        kind,
                        includeProbeOnly,
                        scoring,
                        metric,
                        view,
                        chosen,
                      })
    const origins: CardOrigin[] = [
      null,
      { from: "start" },
      ...lists.slice(0, 8).map((query) => ({ from: "list" as const, query })),
      ...progresses
        .filter((_, i) => i % 97 === 0)
        .map(({ chosen: _c, scoring: _s, ...query }) => ({ from: "progress" as const, query })),
    ]
    const routes: Route[] = [
      ...lists.flatMap((query) =>
        [null, "2026-09-25"].map((evening) => ({ page: "cards" as const, query, evening }))
      ),
      ...progresses.flatMap((query) =>
        [null, "history" as const].map((section) => ({ page: "progress" as const, query, section }))
      ),
    ]
    for (const origin of origins)
      for (const selection of [null, 2] as const)
        for (const shot of [null, "23", "7"])
          for (const scoring of ["decimal", "rings"] as const)
            for (const anchor of [
              null,
              { section: "shots" } as const,
              { section: "analysis", tab: "position" } as const,
            ])
              routes.push({ page: "card", id: "c42", origin, selection, shot, scoring, anchor })
    expect(routes.length).toBeGreaterThan(20000)
    for (const r of routes) expect(route(urlFromRoute(r))).toEqual(r)
  })
})

describe("Grammatik der Ids und Grenzfälle (Review)", () => {
  it("Ids von Scheiben und benannten Zeiträumen sind erzeugte Ids, nie Namen; feste Wörter sind keine", () => {
    // in der App: Ids aus der Datenbank (cuid, UUID); ein Name wie „All“ oder „12m“ wird nie zur Id
    expect(isCardId("clx8k2abc0001")).toBe(true)
    expect(isCardId("0b9f6c1e-5d2a-4c3b-9e8f-1a2b3c4d5e6f")).toBe(true)
    expect(isCardId("a b")).toBe(false)
    expect(isNamedPeriodId("clx8k2abc")).toBe(true)
    for (const reserved of ["30d", "90d", "12m", "all", "previous"]) {
      expect(isNamedPeriodId(reserved), reserved).toBe(false)
    }
    expect(isNamedPeriodId("Neue Munition")).toBe(false)
    // so entschieden (D4): die festen Wörter gehen vor
    expect(decodeCompare("previous")).toEqual({ type: "previous" })
  })

  it("eine Serie über drei Stellen ist keine Serie (kein 1e+23 in der Adresse)", () => {
    const read = (search: string) => route(`/cards/c1?${search}`)
    expect(read("series=999")).toMatchObject({ selection: 999 })
    expect(read("series=99999999999999999999999")).toMatchObject({ selection: null })
  })

  it("eine Herkunft aus dem Fortschritt schreibt nie `pick` oder ihre Wertung, auch wenn sie sie trägt", () => {
    const full = {
      ...DEFAULT_PROGRESS,
      family: "lg-freihand",
      scoring: "rings" as const,
      chosen: "c9",
    }
    const url = urlFromRoute({
      page: "card",
      id: "c1",
      origin: { from: "progress", query: full },
      selection: null,
      shot: null,
      scoring: "decimal",
      anchor: null,
    })
    expect(url).toBe("/cards/c1?from=progress&family=lg-freihand")
  })

  it("eine ganze Adresse als eine Zeichenkette, wie ein Link sie hat", () => {
    expect(routeFromHref("/progress?family=lg-freihand&pick=c9#history")).toEqual(
      route("/progress?family=lg-freihand&pick=c9#history")
    )
    expect(routeFromHref("/cards/c1#analysis")).toEqual(routeFromUrl("/cards/c1", "", "#analysis"))
    expect(routeFromHref("/cards?kind=training")).toEqual(
      routeFromUrl("/cards", "?kind=training", "")
    )
  })
})
