// Baut das Labor zu einer einzigen HTML-Datei (dist/labor.html), so wie ein Artifact sie braucht: React
// und die Bausteine als ein Skript (esbuild), Tailwind mit den Design-2-Tokens als ein Stylesheet
// (PostCSS), Schriften von Google Fonts. Aufruf: pnpm --filter @vereinsheim/labor build

import { execSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import tailwind from "@tailwindcss/postcss"
import { build } from "esbuild"
import postcss from "postcss"

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
export const DIST = join(ROOT, "dist")

const FONTS =
  "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..800&family=Geist:wght@400..700&family=Geist+Mono:wght@400..600&display=swap"

function commit(): string {
  try {
    // „-dirty“ zeigt, dass die Seite aus nicht committetem Stand gebaut wurde
    return execSync("git describe --always --dirty", { cwd: ROOT }).toString().trim()
  } catch {
    return "unbekannt"
  }
}

/** die Seite ohne Gerüst; das Artifact legt `<!doctype html>…<body>` darum */
export async function buildPage(): Promise<string> {
  const bundle = await build({
    entryPoints: [join(ROOT, "src/main.tsx")],
    bundle: true,
    format: "iife",
    minify: true,
    write: false,
    jsx: "automatic",
    charset: "utf8",
    target: "es2020",
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "error",
  })
  // ein „</script“ im Code beendete den Skript-Block vorzeitig
  const js = bundle.outputFiles[0].text.replace(/<\/script/gi, "<\\/script")
  const cssPath = join(ROOT, "src/labor.css")
  const css = await postcss([tailwind({ optimize: { minify: true } })]).process(
    readFileSync(cssPath, "utf8"),
    { from: cssPath }
  )
  return [
    "<title>Spiegel-Labor</title>",
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    `<link rel="stylesheet" href="${FONTS}">`,
    `<style>${css.css}</style>`,
    `<div id="root" data-commit="${commit()}"></div>`,
    `<script>${js}</script>`,
    "",
  ].join("\n")
}

/**
 * Die Grundformatierung, die das Artifact um die Seite legt (laut Artifact-Vertrag): außerhalb jeder
 * CSS-Ebene, also stärker als `@layer base`. Vorschau und Skriptprüfung tragen sie mit, damit sie
 * zeigen, was das Artifact zeigt (ohne sie blieb ein Fehler im dunklen Thema unbemerkt).
 */
const ARTIFACT_RESET =
  "<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);" +
  "padding-bottom:env(safe-area-inset-bottom,0px)}" +
  "body{margin:0;font:14px/1.4 system-ui,-apple-system,sans-serif;background:#f7f7f5}" +
  "img{max-width:100%}[hidden]{display:none!important}</style>"

/** die Seite im Gerüst, wie das Artifact sie zeigt: für den Browser und die Skriptprüfung */
export const withSkeleton = (page: string, extraHead = "", extraEnd = "") =>
  '<!doctype html><html lang="de"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">' +
  `${ARTIFACT_RESET}${extraHead}</head><body>${page}${extraEnd}</body></html>`

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const page = await buildPage()
  mkdirSync(DIST, { recursive: true })
  writeFileSync(join(DIST, "labor.html"), page)
  writeFileSync(join(DIST, "preview.html"), withSkeleton(page))
  console.log(`dist/labor.html: ${(page.length / 1024).toFixed(0)} KB, dist/preview.html`)
}
