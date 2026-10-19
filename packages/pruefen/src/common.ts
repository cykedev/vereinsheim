// Prüfungen, die jede App mit Design 2 braucht: kein seitliches Scrollen, die untere Leiste verdeckt nichts, die
// Darstellung blitzt nicht auf, der Fokus in Dialogen, keine versteckte Kopie des Inhalts, der Text einer Tabelle oder
// Liste als Zeilen. Jede Prüfung liefert Ergebnisse; die App schreibt sie in ihren Bericht.

import type { Browser, Locator, Page } from "./browser"

export interface Check {
  name: string
  ok: boolean
  detail: string
}

/** jede Seite bei jeder Breite ohne seitliches Scrollen; das Detail nennt die drei Elemente, die am weitesten ragen */
export async function noSideScroll(
  page: Page,
  {
    base,
    paths,
    widths,
    height = 844,
  }: { base: string; paths: string[]; widths: number[]; height?: number }
): Promise<Check[]> {
  const checks: Check[] = []
  for (const width of widths) {
    await page.viewport(width, height)
    for (const path of paths) {
      await page.goto(`${base}${path}`)
      const s = await page.ev<{ sw: number; widest: string[] }>(
        `({ sw: document.documentElement.scrollWidth, widest: widest(${width}) })`
      )
      checks.push({
        name: `Telefon ${width} px: ${path} ohne seitliches Scrollen`,
        ok: s.sw <= width,
        detail: `${s.sw} ${s.widest.join(" | ")}`,
      })
    }
  }
  return checks
}

/**
 * Am Telefon, ganz nach unten gescrollt: Der Inhalt (`data-app-content` ohne seinen Platz für die Leiste) endet über der
 * unteren Leiste. Gemessen am Rahmen, nicht am untersten Element: Elemente in Reitern, die in sich scrollen, lägen
 * sonst scheinbar unter der Leiste. Erwartet die gezeigte Seite in Telefonbreite.
 */
export async function barDoesNotCover(page: Page, label: string): Promise<Check> {
  const s = await page.ev<{ bar: number; end: number; bottom: number } | null>(`(async () => {
    const bar = $("[data-app-bar]")
    const content = $("[data-app-content]")
    if (!visible(bar) || !content) return null
    scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" })
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const box = content.getBoundingClientRect()
    return { bar: bar.getBoundingClientRect().top, bottom: box.bottom,
      end: box.bottom - parseFloat(getComputedStyle(content).paddingBottom) }
  })()`)
  return {
    name: `${label}: die untere Leiste verdeckt nichts`,
    ok: !!s && s.end <= s.bar + 0.5 && s.bottom >= s.bar,
    detail: s
      ? `Inhalt endet ${Math.round(s.end)}, Rahmen ${Math.round(s.bottom)}, Leiste ab ${Math.round(s.bar)}`
      : "keine Leiste",
  }
}

/**
 * Hell und dunkel gewählt: Die Klasse steht schon, wenn <body> erscheint (Skript im <head>), und nicht erst nach dem
 * Hydrieren. Stellt die Wahl danach wieder her.
 */
export async function themeNoFlash(
  page: Page,
  { url, storageKey }: { url: string; storageKey: string }
): Promise<Check[]> {
  const key = JSON.stringify(storageKey)
  await page.goto(url)
  const before = await page.ev<string | null>(`localStorage.getItem(${key})`)
  const checks: Check[] = []
  try {
    for (const theme of ["dark", "light"] as const) {
      await page.ev(`localStorage.setItem(${key}, ${JSON.stringify(theme)})`)
      await page.goto(url)
      const s = await page.ev<{ atBody: string | null; now: string }>(
        `({ atBody: window.__themeAtBody,
            now: document.documentElement.classList.contains("dark") ? "dark" : "light" })`
      )
      checks.push({
        name: `Darstellung „${theme === "dark" ? "Dunkel" : "Hell"}“ steht vor dem ersten Zeichnen`,
        ok: s.atBody === theme && s.now === theme,
        detail: JSON.stringify(s),
      })
    }
  } finally {
    await page.ev(
      before === null
        ? `localStorage.removeItem(${key})`
        : `localStorage.setItem(${key}, ${JSON.stringify(before)})`
    )
  }
  return checks
}

/**
 * Ein Dialog oder Blatt, das der Knopf öffnet: Der Fokus steht darin, Escape schließt, und der Fokus kehrt zum Knopf
 * zurück. Der Knopf als Ausdruck im Fenster, etwa `button("Scheibe löschen")`.
 */
export async function dialogFocus(page: Page, opener: Locator, label: string): Promise<Check[]> {
  await page.ev(`(${opener}).setAttribute("data-pruefen-opener", "")`)
  await page.click(opener, { settle: 400 })
  const open = await page.ev<{ open: boolean; inside: boolean }>(`(() => {
    const dialog = $$('dialog[open], [role="alertdialog"], [role="dialog"]').find(visible)
    return { open: !!dialog, inside: !!dialog && dialog.contains(document.activeElement) }
  })()`)
  await page.key("Escape")
  await page.wait(300)
  const after = await page.ev<{ closed: boolean; back: boolean }>(`(() => {
    const opener = $("[data-pruefen-opener]")
    opener?.removeAttribute("data-pruefen-opener")
    return { closed: !$$('dialog[open], [role="alertdialog"], [role="dialog"]').some(visible),
      back: document.activeElement === opener }
  })()`)
  return [
    {
      name: `${label}: der Fokus steht im Dialog`,
      ok: open.open && open.inside,
      detail: JSON.stringify(open),
    },
    {
      name: `${label}: Escape schließt, der Fokus kehrt zum Knopf zurück`,
      ok: after.closed && after.back,
      detail: JSON.stringify(after),
    },
  ]
}

/**
 * Keine versteckte zweite Kopie des Seiteninhalts. Streamt eine Seite in eine Suspense-Grenze (etwa aus `loading.tsx`),
 * schickt React den Inhalt erst in einem `<div hidden>` am Ende von `body` und verschiebt ihn im nächsten
 * Animationsframe an seinen Platz. In einem Tab im Hintergrund kommt dieser Frame nicht: Der Client rendert die Seite
 * trotzdem, und die Kopie bleibt mit doppelten Ids liegen, bis der Tab sichtbar wird. Geprüft wird deshalb mit der Seite
 * im Hintergrund: kein `h1` unter einem `[hidden]`-Vorfahren und keine Id doppelt. Danach steht die Seite wieder vorn.
 */
export async function noHiddenCopy(
  browser: Browser,
  page: Page,
  { base, paths }: { base: string; paths: string[] }
): Promise<Check[]> {
  const front = await browser.newPage()
  await browser.send("Target.activateTarget", { targetId: front.targetId })
  const checks: Check[] = []
  try {
    for (const path of paths) {
      await page.goto(`${base}${path}`)
      await page.wait(1_000)
      const s = await page.ev<{ background: boolean; hidden: string[]; twice: string[] }>(`(() => {
        const ids = new Map()
        for (const el of $$("[id]")) ids.set(el.id, (ids.get(el.id) ?? 0) + 1)
        return { background: document.visibilityState === "hidden",
          hidden: $$("h1").filter((h) => h.closest("[hidden]")).map((h) => txt(h)),
          twice: [...ids].filter(([, n]) => n > 1).map(([id]) => id) }
      })()`)
      checks.push({
        name: `Im Hintergrund: ${path} ohne versteckte Kopie des Inhalts`,
        ok: s.background && s.hidden.length === 0 && s.twice.length === 0,
        detail: s.background
          ? `${s.hidden.length ? `versteckt: ${s.hidden.join(", ")} ` : ""}${s.twice.length ? `doppelt: #${s.twice.slice(0, 5).join(", #")}` : ""}`
          : "die Seite steht nicht im Hintergrund",
      })
    }
  } finally {
    await browser.send("Target.activateTarget", { targetId: page.targetId })
    await front.close()
  }
  return checks
}

/**
 * Der Text einer Tabelle oder Liste als Zeilen, zum Vergleich vorher und nachher: je Tabellenzeile die Zellen mit
 * „ | “ getrennt, je Listenpunkt sein Text, sonst die Zeilen des sichtbaren Texts. Leerraum ist zusammengefasst.
 */
export async function pageText(page: Page, selector: string): Promise<string[]> {
  return page.ev<string[]>(`(() => {
    const clean = (text) => text.replace(/\\s+/g, " ").trim()
    return $$(${JSON.stringify(selector)}).flatMap((el) => {
      if (el.matches("table")) return $$("tr", el).map((tr) => $$("th, td", tr).map((c) => clean(c.innerText)).join(" | "))
      if (el.matches("ul, ol")) return $$(":scope > li", el).map((li) => clean(li.innerText))
      return el.innerText.split("\\n").map(clean)
    }).filter((line) => line.length > 0)
  })()`)
}
