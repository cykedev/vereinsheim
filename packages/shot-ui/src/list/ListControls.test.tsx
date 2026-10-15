import { createElement as h, isValidElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { CardFilters } from "../controls/CardFilters"
import { DEFAULT_LIST, DEFAULT_PROGRESS, type ListQuery } from "../nav/routes"
import {
  listFilterSummary,
  ListControls,
  ListControlsView,
  type ListControlsProps,
} from "./ListControls"

const QUERY: ListQuery = {
  ...DEFAULT_LIST,
  family: "lg-freihand",
  kind: "training",
  flag: "nur-pdf",
  range: { type: "named", id: "p9q3x7d5" },
}
const props = (patch: Partial<ListControlsProps> = {}): ListControlsProps => ({
  query: QUERY,
  family: "lg-freihand",
  families: [
    { value: "lg-freihand", label: "Luftgewehr" },
    { value: "lp-freihand", label: "Luftpistole" },
  ],
  flags: ["nur-pdf"],
  lists: [],
  rangeLabel: "Neue Munition",
  onQuery: () => {},
  progress: {
    page: "progress",
    query: { ...DEFAULT_PROGRESS, family: "lg-freihand", choice: { type: "all" } },
    section: null,
  },
  ...patch,
})

/** das erste Element, auf das `match` passt, im Baum der Elemente (ohne zu rendern) */
function find(
  node: ReactNode,
  match: (e: { type: unknown; props: Record<string, unknown> }) => boolean
): { type: unknown; props: Record<string, unknown> } | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = find(child, match)
      if (hit) return hit
    }
    return null
  }
  if (!isValidElement(node)) return null
  const element = { type: node.type, props: node.props as Record<string, unknown> }
  if (match(element)) return element
  return find(element.props.children as ReactNode, match)
}

const view = (patch: Partial<ListControlsProps> = {}) =>
  ListControlsView({ ...props(patch), open: false, onOpen: () => {}, onClose: () => {} })

describe("Filter der Scheiben-Liste in einer Zeile (U5, D6; wie der Fortschritt)", () => {
  it("ein weiterer Chip in der Zeile nach dem Chip „Filter“ (User, 13. Oktober 2026: „in die selbe zeile wie die filter“)", () => {
    const html = renderToStaticMarkup(
      h(ListControls, props({ actions: h("span", { "data-kreis": true }) }))
    )
    const row = html.slice(0, html.indexOf("<dialog"))
    expect(row).toMatch(
      /^<div data-list-controls="true" class="flex flex-wrap items-center gap-2">/
    )
    expect(row).toMatch(
      /data-list-chip="true"[\s\S]*<\/button><div data-list-actions="true" class="flex items-center gap-1\.5"><span data-kreis/
    )
  })

  it("vorn nur Familie und der Chip mit der Zusammenfassung, alles Übrige im Blatt „Filter“", () => {
    const html = renderToStaticMarkup(h(ListControls, props()))
    const row = html.slice(0, html.indexOf("<dialog"))
    expect(row).toContain('aria-label="Familie"')
    expect(row).not.toContain('aria-label="Art"')
    expect(row).not.toContain('aria-label="Merkmal"')
    expect(row).toMatch(
      /<button[^>]*data-list-chip="true"[^>]*>Training · Nur PDF · Neue Munition<svg/
    )
    // im Blatt: Art, Merkmal, Zeitraum mit „entfernen“, der Weg in den Fortschritt
    const sheet = html.slice(html.indexOf("<dialog"))
    expect(sheet).toContain('aria-label="Art"')
    expect(sheet).toContain('aria-label="Merkmal"')
    expect(sheet).toMatch(/data-range-chip="true"[^>]*>Neue Munition/)
    expect(sheet).toContain('aria-label="Zeitraum entfernen"')
    expect(sheet).toMatch(
      /<a href="\/progress\?range=all&amp;family=lg-freihand" data-to-progress="true"/
    )
  })

  it("die Zusammenfassung: nur, was von der Vorgabe abweicht", () => {
    expect(listFilterSummary({ kind: "all", flag: null, list: null, rangeLabel: null })).toBe(
      "Alle Scheiben"
    )
    expect(
      listFilterSummary({ kind: "competition", flag: null, list: null, rangeLabel: null })
    ).toBe("Wettkampf")
    expect(
      listFilterSummary({ kind: "all", flag: "nur-pdf", list: null, rangeLabel: "Letzte 90 Tage" })
    ).toBe("Nur PDF · Letzte 90 Tage")
    expect(
      listFilterSummary({ kind: "competition", flag: null, list: "RWK_LP", rangeLabel: null })
    ).toBe("Wettkampf · Liste RWK_LP")
  })

  it("die Liste aus Meyton im Blatt nach der Art, am Chip mit Namen (Rückmeldung 2)", () => {
    const lists = [
      { id: 3, name: "RWK_LP" },
      { id: 1, name: "Training-LG" },
    ]
    const html = renderToStaticMarkup(
      h(ListControls, props({ lists, query: { ...QUERY, list: 3 } }))
    )
    expect(html).toMatch(
      /data-list-chip="true"[^>]*>Training · Liste RWK_LP · Nur PDF · Neue Munition<svg/
    )
    const sheet = html.slice(html.indexOf("<dialog"))
    expect(sheet.indexOf('aria-label="Art"')).toBeLessThan(sheet.indexOf('aria-label="Liste"'))
    expect(sheet.indexOf('aria-label="Liste"')).toBeLessThan(sheet.indexOf('aria-label="Merkmal"'))
    expect(sheet).toMatch(
      /aria-label="Liste"[\s\S]*>Alle<[\s\S]*aria-checked="true"[^>]*>RWK_LP<[\s\S]*>Training-LG</
    )
    const onQuery = vi.fn()
    const choice = find(view({ lists, onQuery }), (e) => e.props.label === "Liste")!
    ;(choice.props.onChange as (v: string) => void)("1")
    expect(onQuery).toHaveBeenLastCalledWith({ ...QUERY, list: 1 })
    ;(choice.props.onChange as (v: string) => void)("")
    expect(onQuery).toHaveBeenLastCalledWith({ ...QUERY, list: null })
    expect(renderToStaticMarkup(h(ListControls, props()))).not.toContain('aria-label="Liste"')
  })

  it("ohne Merkmale keine Wahl „Merkmal“, ohne Zeitraum kein Zeitraum im Blatt", () => {
    const html = renderToStaticMarkup(h(ListControls, props({ flags: [], rangeLabel: null })))
    expect(html).not.toContain('aria-label="Merkmal"')
    expect(html).not.toContain("data-range-chip")
  })

  it("„entfernen“ nimmt nur den Zeitraum; Familie, Art und Merkmal ändern nur sich", () => {
    const onQuery = vi.fn()
    const tree = view({ onQuery })
    const remove = find(tree, (e) => e.props["aria-label"] === "Zeitraum entfernen")!
    // der Knopf verschwindet, der Fokus geht auf die gewählte Art im Blatt (Review U5)
    const focus = vi.fn()
    const query = vi.fn(() => ({ focus }))
    const closest = vi.fn(() => ({ querySelector: query }))
    ;(remove.props.onClick as (e: unknown) => void)({ currentTarget: { closest } })
    expect(onQuery).toHaveBeenLastCalledWith({ ...QUERY, range: null })
    expect(closest).toHaveBeenCalledWith("[data-list-filter]")
    expect(query).toHaveBeenCalledWith('[role="radio"][aria-checked="true"]')
    expect(focus).toHaveBeenCalled()
    const filters = find(tree, (e) => e.type === CardFilters)!
    ;(filters.props.onFamily as (f: string) => void)("lp-freihand")
    expect(onQuery).toHaveBeenLastCalledWith({ ...QUERY, family: "lp-freihand" })
    expect(filters.props.onKind).toBeUndefined()
    const kind = find(tree, (e) => e.props.label === "Art")!
    ;(kind.props.onChange as (k: string) => void)("competition")
    expect(onQuery).toHaveBeenLastCalledWith({ ...QUERY, kind: "competition" })
  })
})
