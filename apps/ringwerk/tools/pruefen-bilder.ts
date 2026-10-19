// Bilder für die Sichtprüfung durch den User: je Phase eine Seite eines Wettbewerbs, dazu die Seiten über alle
// Wettbewerbe, hell und dunkel, am Telefon und am Desktop. Der erste Bildschirm der Seite, dazu das Bracket und die
// erste Tabelle für sich. Eine Übersicht `index.html` stellt alles nebeneinander. Liest nur.

import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import type { Page } from "@vereinsheim/pruefen/browser"

/** eine Seite für die Bilder: Titel, Adresse ohne Server */
export interface Picture {
  title: string
  path: string
}

const THEMES = ["light", "dark"] as const
const SIZES = [
  [390, 844],
  [1280, 900],
] as const

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: "ae", ö: "oe", ü: "ue", ß: "ss" })[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

const escape = (text: string) =>
  text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)

export async function pictures(page: Page, base: string, dir: string, list: Picture[]) {
  mkdirSync(dir, { recursive: true })
  const rows: string[] = []
  for (const picture of list) {
    const name = slug(picture.title)
    const cells: string[] = []
    for (const theme of THEMES) {
      for (const [width, height] of SIZES) {
        await page.viewport(width, height)
        await page.goto(`${base}/profile`)
        await page.ev(`localStorage.setItem("ringwerk-theme", ${JSON.stringify(theme)})`)
        await page.goto(`${base}${picture.path}`)
        await page.wait(400)
        const files: string[] = []
        const file = `${name}-${width}-${theme}.png`
        writeFileSync(path.join(dir, file), await page.screenshot())
        files.push(file)
        for (const [part, locator] of [
          [
            "bracket",
            `$$("main div").find((el) => getComputedStyle(el).overflowX === "auto" && /Halbfinale/.test(el.textContent))`,
          ],
          ["tabelle", `$("main table")`],
        ] as const) {
          const shot = await page.screenshotOf(locator)
          if (!shot) continue
          const partFile = `${name}-${part}-${width}-${theme}.png`
          writeFileSync(path.join(dir, partFile), shot)
          files.push(partFile)
        }
        cells.push(
          `<figure><figcaption>${width} px · ${theme === "light" ? "hell" : "dunkel"}</figcaption>${files
            .map((f) => `<img src="${f}" loading="lazy" alt="">`)
            .join("")}</figure>`
        )
      }
    }
    rows.push(
      `<section><h2>${escape(picture.title)}</h2><div class="row">${cells.join("")}</div></section>`
    )
  }
  await page.ev(`localStorage.removeItem("ringwerk-theme")`)
  writeFileSync(
    path.join(dir, "index.html"),
    `<!doctype html><meta charset="utf-8"><title>Ringwerk in Design 2</title>
<style>body{font:14px system-ui;margin:16px;background:#f1f3f7}h2{font-size:16px;margin:24px 0 8px}
.row{display:flex;gap:12px;align-items:flex-start;overflow-x:auto}figure{margin:0;display:grid;gap:6px}
figcaption{color:#59667a}img{display:block;max-width:420px;border:1px solid #ccd;background:#fff}</style>
<h1>Ringwerk in Design 2 — Sichtprüfung</h1>${rows.join("\n")}`
  )
}
