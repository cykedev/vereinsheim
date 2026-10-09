import { createElement as h, isValidElement, type ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { CardFilters } from "../controls/CardFilters"
import { DEFAULT_LIST, type ListQuery } from "../nav/routes"
import { ListControls, type ListControlsProps } from "./ListControls"

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
  rangeLabel: "Neue Munition",
  onQuery: () => {},
  onProgress: () => {},
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

describe("Filter der Scheiben-Liste (Plan N2, D7, D8)", () => {
  it("Familie, Art, Merkmal mit Namen, Zeitraum-Chip und „Verlauf dieser Filter“", () => {
    const html = renderToStaticMarkup(h(ListControls, props()))
    expect(html).toContain('aria-label="Familie"')
    expect(html).toContain('aria-label="Art"')
    expect(html).toContain('aria-label="Merkmal"')
    expect(html).toContain(">Nur PDF<")
    expect(html).toMatch(/data-range-chip="true"[^>]*>Neue Munition</)
    expect(html).toContain('aria-label="Zeitraum entfernen"')
    expect(html).toContain(">Verlauf dieser Filter<")
  })

  it("ohne Merkmale keine Wahl „Merkmal“, ohne Zeitraum kein Chip", () => {
    const html = renderToStaticMarkup(h(ListControls, props({ flags: [], rangeLabel: null })))
    expect(html).not.toContain('aria-label="Merkmal"')
    expect(html).not.toContain("data-range-chip")
  })

  it("„×“ entfernt nur den Zeitraum; ein Familienwechsel behält Art, Merkmal und Zeitraum", () => {
    const onQuery = vi.fn()
    const tree = ListControls(props({ onQuery }))
    const remove = find(tree, (e) => e.props["aria-label"] === "Zeitraum entfernen")!
    ;(remove.props.onClick as () => void)()
    expect(onQuery).toHaveBeenLastCalledWith({ ...QUERY, range: null })
    const filters = find(tree, (e) => e.type === CardFilters)!
    ;(filters.props.onFamily as (f: string) => void)("lp-freihand")
    expect(onQuery).toHaveBeenLastCalledWith({ ...QUERY, family: "lp-freihand" })
    ;(filters.props.onKind as (k: string) => void)("competition")
    expect(onQuery).toHaveBeenLastCalledWith({ ...QUERY, kind: "competition" })
  })

  it("„Verlauf dieser Filter“ ruft den Querverweis", () => {
    const onProgress = vi.fn()
    const button = find(
      ListControls(props({ onProgress })),
      (e) => e.props["data-to-progress"] === true
    )!
    ;(button.props.onClick as () => void)()
    expect(onProgress).toHaveBeenCalledOnce()
  })
})
