// Bericht eines Vergleichs: Befunde als Markdown und die Bilder vorher und nachher nebeneinander in einer HTML-Datei für
// die Sichtprüfung. Ein Bild, das sich nicht geändert hat (gleiche Bytes), steht zugeklappt am Ende.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import type { Finding } from "./compare"

const html = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

export function findingsMarkdown(findings: readonly Finding[]): string {
  const lines = ["# Vergleich mit dem Ausgangsstand", ""]
  const errors = findings.filter((f) => f.severity === "fehler")
  lines.push(`Fehler: ${errors.length} · Hinweise: ${findings.length - errors.length}`, "")
  for (const f of findings) {
    lines.push(`## ${f.severity === "fehler" ? "FEHLER" : "Hinweis"} · ${f.where}`, "", f.what, "")
    if (f.detail) lines.push("```diff", f.detail, "```", "")
  }
  return `${lines.join("\n")}\n`
}

/** Bilder beider Ordner nach Namen gepaart; Pfade relativ zur HTML-Datei */
export function writeSideBySide(
  file: string,
  beforeDir: string,
  afterDir: string,
  findings: readonly Finding[],
  /** nur ein Teil aufgenommen (`--nur`): Bilder, die nur vorher da sind, gehören nicht dazu */
  partial = false
) {
  const names = new Set<string>()
  for (const dir of partial ? [afterDir] : [beforeDir, afterDir])
    if (existsSync(dir)) for (const f of readdirSync(dir)) if (f.endsWith(".png")) names.add(f)
  const rel = (dir: string, name: string) => path.relative(path.dirname(file), path.join(dir, name))
  const changed: string[] = []
  // PDF-Seiten unterscheiden sich mindestens im Erstelldatum; streng ist ihr Text, die Bilder sieht ein Mensch durch
  const changedPdf: string[] = []
  const same: string[] = []
  for (const name of [...names].sort()) {
    const a = path.join(beforeDir, name)
    const b = path.join(afterDir, name)
    const equal = existsSync(a) && existsSync(b) && readFileSync(a).equals(readFileSync(b))
    const row = `<figure><figcaption>${html(name)}${existsSync(a) ? "" : " · neu"}${existsSync(b) ? "" : " · fehlt nachher"}</figcaption>
      <div class="pair"><img loading="lazy" src="${html(rel(beforeDir, name))}" alt="vorher"><img loading="lazy" src="${html(rel(afterDir, name))}" alt="nachher"></div></figure>`
    ;(equal ? same : name.includes("-pdf-") ? changedPdf : changed).push(row)
  }
  const errors = findings.filter((f) => f.severity === "fehler")
  writeFileSync(
    file,
    `<!doctype html><meta charset="utf-8"><title>Ringwerk vorher und nachher</title>
<style>body{font:14px system-ui;margin:16px;background:#fff;color:#111}figure{margin:0 0 24px}
figcaption{font-weight:600;margin-bottom:4px}.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px;align-items:start}
img{max-width:100%;border:1px solid #ccc}pre{background:#f4f4f4;padding:8px;overflow:auto}</style>
<h1>Ringwerk vorher und nachher</h1>
<p>Fehler: ${errors.length} · Hinweise: ${findings.length - errors.length} · Bilder geändert: ${changed.length} Seiten, ${changedPdf.length} PDF-Seiten · gleich: ${same.length}</p>
${findings
  .slice(0, 200)
  .map(
    (f) =>
      `<details${f.severity === "fehler" ? " open" : ""}><summary>${f.severity === "fehler" ? "FEHLER" : "Hinweis"} · ${html(f.where)} · ${html(f.what)}</summary>${f.detail ? `<pre>${html(f.detail)}</pre>` : ""}</details>`
  )
  .join("\n")}
<h2>Geänderte Seiten und Brackets (links vorher, rechts nachher)</h2>
${changed.join("\n")}
<h2>PDF-Seiten mit anderem Bild (Text ist oben geprüft; mindestens das Erstelldatum ist anders)</h2>
${changedPdf.join("\n")}
<details><summary>Unveränderte Bilder (${same.length})</summary>${same.join("\n")}</details>
`
  )
  return { changed: changed.length, changedPdf: changedPdf.length, same: same.length }
}
