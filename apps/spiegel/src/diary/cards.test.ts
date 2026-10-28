import { describe, expect, it } from "vitest"

import {
  cardPlace,
  entryCards,
  entryOfCard,
  type CardLinkRow,
  type CardRef,
  type EntryRef,
} from "./cards"

const DAY = "2026-10-20"
const entry = (id: string, over: Partial<EntryRef> = {}): EntryRef => ({
  id,
  day: DAY,
  familyId: 1,
  deleted: false,
  ...over,
})
const card = (id: string, over: Partial<CardRef> = {}): CardRef => ({
  id,
  day: DAY,
  familyId: 1,
  ...over,
})
const set = (map: ReturnType<typeof entryCards>, id: string) => map.get(id)!

describe("entryCards", () => {
  it("genau ein Eintrag: eine Scheibe ohne Zeile ist dazugekommen", () => {
    const map = entryCards([entry("e")], [], [card("c")])
    expect(set(map, "e")).toEqual({ linked: [], added: ["c"], offered: [] })
  })

  it("zwei Einträge am selben Abend und in derselben Disziplin: die Scheibe wird in beiden nur angeboten", () => {
    const map = entryCards([entry("e1"), entry("e2")], [], [card("c")])
    expect(set(map, "e1")).toEqual({ linked: [], added: [], offered: ["c"] })
    expect(set(map, "e2")).toEqual({ linked: [], added: [], offered: ["c"] })
  })

  it("eine verknüpfte Scheibe bleibt in ihrem Eintrag, auch bei zwei Einträgen", () => {
    const links: CardLinkRow[] = [{ cardId: "c", entryId: "e2", link: "linked" }]
    const map = entryCards([entry("e1"), entry("e2")], links, [card("c"), card("d")])
    expect(set(map, "e2").linked).toEqual(["c"])
    expect(set(map, "e1").offered).toEqual(["d"])
    expect(set(map, "e1").linked).toEqual([])
  })

  it("eine gelöste Scheibe kommt nicht von selbst wieder, sie wird angeboten", () => {
    const links: CardLinkRow[] = [{ cardId: "c", entryId: "e", link: "released" }]
    const map = entryCards([entry("e")], links, [card("c")])
    expect(set(map, "e")).toEqual({ linked: [], added: [], offered: ["c"] })
  })

  it("ein Eintrag im Papierkorb zählt nicht mit und hält seine verknüpften Scheiben", () => {
    const links: CardLinkRow[] = [{ cardId: "c", entryId: "old", link: "linked" }]
    const map = entryCards([entry("old", { deleted: true }), entry("e")], links, [
      card("c"),
      card("d"),
    ])
    expect(set(map, "old")).toEqual({ linked: ["c"], added: [], offered: [] })
    expect(set(map, "e")).toEqual({ linked: [], added: ["d"], offered: [] })
  })

  it("verknüpft nie über Abend oder Disziplin hinweg, und nie ohne Disziplin", () => {
    const map = entryCards(
      [entry("e"), entry("free", { familyId: null })],
      [],
      [
        card("other-day", { day: "2026-10-21" }),
        card("other-family", { familyId: 2 }),
        card("none", { familyId: null }),
      ]
    )
    expect(set(map, "e")).toEqual({ linked: [], added: [], offered: [] })
    expect(set(map, "free")).toEqual({ linked: [], added: [], offered: [] })
  })

  it("nennt verknüpfte Scheiben, die es nicht mehr gibt", () => {
    const map = entryCards([entry("e")], [{ cardId: "gone", entryId: "e", link: "linked" }], [])
    expect(set(map, "e").linked).toEqual(["gone"])
  })
})

describe("entryOfCard", () => {
  it("findet den verknüpften oder den abgeleiteten Eintrag, nicht einen im Papierkorb", () => {
    expect(entryOfCard(card("c"), [entry("e")], [])).toBe("e")
    expect(entryOfCard(card("c"), [entry("e1"), entry("e2")], [])).toBeNull()
    expect(
      entryOfCard(
        card("c"),
        [entry("e1"), entry("e2")],
        [{ cardId: "c", entryId: "e2", link: "linked" }]
      )
    ).toBe("e2")
    expect(
      entryOfCard(
        card("c"),
        [entry("e", { deleted: true })],
        [{ cardId: "c", entryId: "e", link: "linked" }]
      )
    ).toBeNull()
    expect(
      entryOfCard(card("c"), [entry("e")], [{ cardId: "c", entryId: "e", link: "released" }])
    ).toBeNull()
  })
})

describe("cardPlace", () => {
  it("fest oder dazugekommen: im Eintrag", () => {
    expect(cardPlace(card("c"), [entry("e")], [])).toEqual({ kind: "entry", entryId: "e" })
    expect(
      cardPlace(
        card("c"),
        [entry("e1"), entry("e2")],
        [{ cardId: "c", entryId: "e2", link: "linked" }]
      )
    ).toEqual({ kind: "entry", entryId: "e2" })
  })

  it("gelöst oder bei mehreren Einträgen: angeboten im ersten offenen Eintrag", () => {
    expect(
      cardPlace(card("c"), [entry("e")], [{ cardId: "c", entryId: "e", link: "released" }])
    ).toEqual({ kind: "offered", entryId: "e" })
    expect(
      cardPlace(card("c"), [entry("e1", { deleted: true }), entry("e2"), entry("e3")], [])
    ).toEqual({ kind: "offered", entryId: "e2" })
  })

  it("fest in einem Eintrag im Papierkorb: dort, ohne Angebot anderswo", () => {
    expect(
      cardPlace(
        card("c"),
        [entry("e1", { deleted: true }), entry("e2")],
        [{ cardId: "c", entryId: "e1", link: "linked" }]
      )
    ).toEqual({ kind: "trash", entryId: "e1" })
  })

  it("ohne Eintrag des Abends: nirgends", () => {
    expect(cardPlace(card("c"), [entry("e", { day: "2026-10-21" })], [])).toEqual({ kind: "none" })
    expect(cardPlace(card("c", { familyId: null }), [entry("e")], [])).toEqual({ kind: "none" })
  })
})
