// Messung einer Seite für die Durchsicht nach drei Ebenen (spiegel-durchsicht): Länge in Bildschirmen, Bedienelemente
// und Zahlen gesamt und im ersten Bildschirm, mehrfach gezeigte Werte, Fachbegriffe. Nicht im Gate; die Zahlen sind
// Hinweise für einen Menschen, kein Urteil.

import type { Page } from "./browser"

export interface PageMeasure {
  /** Länge der Seite in Bildschirmen (Höhe über der unteren Leiste) */
  screens: number
  /** sichtbare Bedienelemente im Inhalt (ohne den Rahmen der App) */
  controls: number
  controlsFirst: number
  /** Zahlen im sichtbaren Text des Inhalts (ein Datum wie 08.09.26 zählt einmal) */
  numbers: number
  numbersFirst: number
  /** Werte mit Komma, die mehr als einmal auf der Seite stehen, als „9,6×3“ */
  duplicates: string[]
  /** Fachbegriffe im sichtbaren Text */
  jargon: string[]
}

/**
 * misst die geladene Seite von oben. `jargon` ist ein regulärer Ausdruck als Quelltext (ohne Schrägstriche), etwa
 * „σ|R50|Median“. Der Bildschirm ist das Fenster ohne die untere Leiste (`[data-app-bar]`).
 */
export async function measurePage(page: Page, jargon: string): Promise<PageMeasure> {
  return page.ev<PageMeasure>(`(() => {
    const FRAME = "[data-app-bar], [data-app-rail], [data-app-sidebar]"
    const bar = document.querySelector("[data-app-bar]")
    const barHeight = bar && bar.getBoundingClientRect().height > 0 ? bar.getBoundingClientRect().height : 0
    const H = innerHeight - barHeight
    scrollTo(0, 0)
    const root = document.querySelector("[data-app-content]") ?? document.querySelector("main") ?? document.body
    const visible = (el) => {
      if (el.closest(FRAME) || el.closest('[aria-hidden="true"]') || el.closest("dialog:not([open])")) return false
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return false
      const s = getComputedStyle(el)
      return s.visibility !== "hidden" && s.display !== "none"
    }
    const top = (el) => el.getBoundingClientRect().top + scrollY
    const controls = [...root.querySelectorAll(
      'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="tab"], [role="switch"], [role="radio"]'
    )].filter(visible).filter((el) => !el.parentElement?.closest('button, a[href], [role="radio"], [role="tab"]'))
    const numbers = []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      const parent = node.parentElement
      if (!parent || parent.closest("script, style") || !visible(parent)) continue
      for (const m of node.textContent.matchAll(/\\d+(?:[.,:]\\d+)*/g)) numbers.push({ value: m[0], top: top(parent) })
    }
    const counts = new Map()
    for (const n of numbers) if (n.value.includes(",")) counts.set(n.value, (counts.get(n.value) ?? 0) + 1)
    const text = root.innerText
    const found = text.match(new RegExp(${JSON.stringify(jargon)}, "g")) ?? []
    const height = document.documentElement.scrollHeight - barHeight
    return {
      screens: Math.round((height / H) * 10) / 10,
      controls: controls.length,
      controlsFirst: controls.filter((el) => top(el) < H).length,
      numbers: numbers.length,
      numbersFirst: numbers.filter((n) => n.top < H).length,
      duplicates: [...counts].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]).map(([v, c]) => v + "×" + c),
      jargon: [...new Set(found)],
    }
  })()`)
}

/** eine Zeile je Seite als Markdown-Tabelle */
export function measureTable(rows: readonly ({ page: string } & PageMeasure)[]): string {
  const head =
    "| Seite | Länge | Bedienelemente (1. Bildschirm) | Zahlen (1. Bildschirm) | mehrfach | Fachbegriffe |\n" +
    "|---|---|---|---|---|---|"
  const line = (r: { page: string } & PageMeasure) =>
    `| ${r.page} | ${String(r.screens).replace(".", ",")} | ${r.controls} (${r.controlsFirst}) | ${r.numbers} (${r.numbersFirst}) | ${
      r.duplicates.slice(0, 4).join(", ") || "–"
    } | ${r.jargon.join(", ") || "–"} |`
  return [head, ...rows.map(line)].join("\n")
}
