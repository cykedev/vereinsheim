// Skriptprüfung des Labors in Headless-Chrome: baut die Seite, legt die Testseite mit Fehlersammler und
// pruefung.js an, öffnet sie mit #pruefen und liest den Bericht. Chrome wird beendet, sobald der Bericht
// da ist (sonst nach 150 s). Nicht im Gate (braucht Chrome). Aufruf:
// pnpm --filter @vereinsheim/labor pruefen   (Chrome über CHROME_PATH, sonst der macOS-Standardpfad)

import { spawn } from "node:child_process"
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

import { buildPage, DIST, ROOT, withSkeleton } from "./build"

const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const LIMIT_MS = 150_000

const COLLECTOR =
  '<script>window.__errors = []; addEventListener("error", (e) => window.__errors.push(String(e.message)))</script>'

const unescape = (text: string) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")

function dumpDom(url: string): Promise<string> {
  // eigenes Profil je Lauf außerhalb von dist/, damit es nicht im Build-Cache landet
  const profile = mkdtempSync(join(tmpdir(), "labor-chrome-"))
  return new Promise((resolve, reject) => {
    const chrome = spawn(CHROME, [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--allow-file-access-from-files",
      `--user-data-dir=${profile}`,
      // die Prüfung braucht rund 90 s virtuelle Zeit (12. Oktober 2026: 89 s); mit 90 s Budget riss sie es bei
      // kleinen Schwankungen und endete selten ohne Bericht. Echte Laufzeit bleibt bei wenigen Sekunden
      "--virtual-time-budget=150000",
      "--window-size=1280,2200",
      "--dump-dom",
      url,
    ])
    let out = ""
    const stop = () => chrome.kill("SIGKILL")
    const timer = setTimeout(stop, LIMIT_MS)
    chrome.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString()
      if (out.includes("</html>")) stop()
    })
    chrome.on("error", reject)
    chrome.on("close", () => {
      clearTimeout(timer)
      rmSync(profile, { recursive: true, force: true })
      resolve(out)
    })
  })
}

const page = await buildPage()
mkdirSync(DIST, { recursive: true })
const harness = readFileSync(join(ROOT, "pruefung.js"), "utf8")
const testPath = join(DIST, "test.html")
writeFileSync(testPath, withSkeleton(page, COLLECTOR, `<script>${harness}</script>`))

const started = Date.now()
const dom = await dumpDom(`${pathToFileURL(testPath).href}#pruefen`)
// das letzte Vorkommen: Kommentare in pruefung.js nennen das Element auch
const start = dom.lastIndexOf('<pre id="dbg">')
const report = start < 0 ? null : /<pre id="dbg">([\s\S]*?)<\/pre>/.exec(dom.slice(start))
if (!report) {
  console.error(
    `Kein Bericht (${((Date.now() - started) / 1000).toFixed(0)} s, ${dom.length} Zeichen DOM)`
  )
  process.exit(1)
}
const lines = unescape(report[1]).split("\n")
const fails = lines.filter((line) => line.startsWith("FAIL"))
for (const line of process.argv.includes("--alle") ? lines : fails) console.log(line)
console.log(
  `${fails.length} FAIL von ${lines.length} (${((Date.now() - started) / 1000).toFixed(0)} s)`
)
process.exit(fails.length ? 1 : 0)
