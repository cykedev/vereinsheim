// Geteilte Bibliothek für den Doku-Index (ADR-022).
//
// Liefert die EINE kanonische Slug-Funktion + Markdown-Heading-Extraktion, die
// von ALLEN drei Stellen identisch genutzt wird: dem Fragment-Reader (doc.mjs),
// dem Pointer-Validator (build-graph.mjs) und den Pointer-Autoren (/sync-graph,
// Hand). Konsistenz hier = die Index-Pointer können nicht auseinanderlaufen.
//
// Pointer-Form: `→ <relpfad>#<slug>` (Sentinel U+2192 + Leerzeichen).

/**
 * Kanonischer Slug einer Überschrift (GitHub-artig, aber Separatoren kollabiert).
 * lowercase → alles außer \p{L}\p{N} _ - entfernen → Whitespace/_ → "-" →
 * Mehrfach-"-" kollabieren → führende/abschließende "-" trimmen.
 * Lossless bzgl. Unicode-Buchstaben (ü/ä/ö bleiben), damit nichts kollidiert.
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Alle ATX-Überschriften eines Markdown-Strings — Codeblöcke (``` / ~~~) werden
 * übersprungen, damit ein "#" in einem Code-Beispiel keine Überschrift ist.
 * @returns {{level:number, text:string, slug:string, line:number}[]}
 */
export function headingSlugs(markdown) {
  const out = []
  const seen = new Map() // Basis-Slug → Anzahl bisheriger Vorkommen (GitHub-artige Disambiguierung)
  let fence = null // aktuell offener Code-Fence-Marker (``` oder ~~~), sonst null
  const lines = markdown.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
    if (fenceMatch) {
      const marker = fenceMatch[1][0]
      if (fence === null) fence = marker
      else if (fence === marker) fence = null
      continue
    }
    if (fence !== null) continue
    const h = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (h) {
      const text = h[2].trim()
      const base = slugify(text)
      // Duplikat-Überschriften eindeutig machen: erstes Vorkommen = base, dann base-1, base-2 …
      const n = seen.get(base) || 0
      seen.set(base, n + 1)
      const slug = n === 0 ? base : `${base}-${n}`
      out.push({ level: h[1].length, text, slug, line: i })
    }
  }
  return out
}

/**
 * Den Abschnitt unter der Überschrift mit dem gegebenen Slug zurückgeben:
 * von der Überschriftszeile bis (exklusive) zur nächsten Überschrift gleicher
 * oder höherer Ebene. `null`, wenn der Slug nicht existiert.
 */
export function readFragment(markdown, slug) {
  const lines = markdown.split("\n")
  const headings = headingSlugs(markdown)
  const start = headings.find((h) => h.slug === slug)
  if (!start) return null
  const next = headings.find((h) => h.line > start.line && h.level <= start.level)
  const end = next ? next.line : lines.length
  return lines.slice(start.line, end).join("\n").replace(/\s+$/, "") + "\n"
}
