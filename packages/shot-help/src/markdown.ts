// Erzeugt den Hauptteil des Vault-Leitfadens (vault/spiegel/spiegel-statistics-help.md) aus den Daten,
// deterministisch und mit Umbruch bei 100 Zeichen wie die übrigen Notizen.

import { GLOSSARY } from "./glossary"
import { FALLACIES, READING_GUIDE, VIEW_HELP } from "./guide"
import { HELP_TOPICS } from "./topics"
import type { HelpTheme, HelpTopic, ViewHelp } from "./types"

const WIDTH = 100

/** Themen in der Reihenfolge der Oberfläche, mit ihren Überschriften */
export const THEME_TITLES: Readonly<Record<HelpTheme, string>> = Object.freeze({
  result: "Ergebnis",
  precision: "Präzision",
  position: "Lage",
  time: "Zeit und Verlauf",
  coverage: "Datenlage",
  period: "Über viele Scheiben",
})
export const THEME_ORDER: readonly HelpTheme[] = [
  "result",
  "precision",
  "position",
  "time",
  "coverage",
  "period",
]

/**
 * Bricht an Leerzeichen um, sodass keine Zeile breiter als `width` ist; Folgezeilen beginnen mit
 * `indent`. Ein Wort, das allein schon breiter ist, steht auf einer eigenen Zeile.
 */
export function wrapText(text: string, width: number, indent: string): string {
  const lines: string[] = []
  let line = ""
  for (const word of text.split(" ")) {
    if (line === "") line = (lines.length ? indent : "") + word
    else if (line.length + 1 + word.length <= width) line += ` ${word}`
    else {
      lines.push(line)
      line = indent + word
    }
  }
  if (line !== "") lines.push(line)
  return lines.join("\n")
}

const FIELDS = [
  ["what", "Was"],
  ["read", "So liest du es"],
  ["act", "Was du tun kannst"],
  ["caution", "Vorsicht"],
  ["minimum", "Mindestzahl"],
] as const

/** Ein Thema als Block: fette Überschrift mit Katalog-IDs, darunter nur die vorhandenen Felder */
export function renderTopic(topic: HelpTopic): string {
  const ids = topic.catalog.length ? ` (${topic.catalog.join(", ")})` : ""
  const lines = [`**${topic.title}${ids}**`]
  for (const [field, label] of FIELDS) {
    const text = topic[field]
    if (text) lines.push(wrapText(`- *${label}:* ${text}`, WIDTH, "  "))
  }
  if (topic.formula) lines.push(wrapText(`- *Formel:* \`${topic.formula}\``, WIDTH, "  "))
  return lines.join("\n")
}

/** Eine Erklärung zur Oberfläche (Trefferbild, Beobachtungen, Probe auf der Scheibe) als Block */
function renderView(view: ViewHelp): string {
  const lines = [`**${view.title}**`, wrapText(`- *Was:* ${view.what}`, WIDTH, "  ")]
  if (view.read) lines.push(wrapText(`- *So liest du es:* ${view.read}`, WIDTH, "  "))
  return lines.join("\n")
}

/** Hauptteil des Leitfadens: Einstieg, Oberfläche, die Themen je Reiter, Glossar, Fehlschlüsse */
export function renderGuideMarkdown(): string {
  const parts = [
    "## So liest du die Zahlen",
    READING_GUIDE.map((item) => wrapText(`- **${item.title}.** ${item.text}`, WIDTH, "  ")).join(
      "\n"
    ),
    "## Auf dem Bildschirm",
    VIEW_HELP.map(renderView).join("\n\n"),
  ]
  for (const theme of THEME_ORDER) {
    const topics = HELP_TOPICS.filter((topic) => topic.theme === theme)
    if (topics.length) parts.push(`## ${THEME_TITLES[theme]}`, topics.map(renderTopic).join("\n\n"))
  }
  parts.push(
    "## Glossar",
    GLOSSARY.map((entry) => wrapText(`- **${entry.term}:** ${entry.text}`, WIDTH, "  ")).join("\n"),
    "## Typische Fehlschlüsse",
    FALLACIES.map((item, i) =>
      wrapText(`${i + 1}. **${item.title}.** ${item.text}`, WIDTH, "   ")
    ).join("\n")
  )
  return parts.join("\n\n")
}

/** der Leitfaden im Vault, relativ zur Wurzel des Repos */
export const GUIDE_FILE = "vault/spiegel/spiegel-statistics-help.md"
export const GUIDE_START =
  "<!-- shot-help:start · erzeugt aus packages/shot-help (pnpm --filter @vereinsheim/shot-help docs), nicht von Hand ändern -->"
export const GUIDE_END = "<!-- shot-help:end -->"

/** Lage des Abschnitts: genau ein Anfangs- und ein Endmarker, in dieser Reihenfolge */
function sectionBounds(note: string): { from: number; to: number } | null {
  const start = note.indexOf(GUIDE_START)
  const end = note.indexOf(GUIDE_END)
  const single = note.lastIndexOf(GUIDE_START) === start && note.lastIndexOf(GUIDE_END) === end
  if (start < 0 || end < start || !single) return null
  return { from: start + GUIDE_START.length, to: end }
}

/** der erzeugte Abschnitt einer Note ohne die Leerzeilen an den Markern; `null` ohne gültige Marker */
export function guideSection(note: string): string | null {
  const bounds = sectionBounds(note)
  return bounds && note.slice(bounds.from, bounds.to).replace(/^\n+|\n+$/g, "")
}

/** die Note mit `section` zwischen den Markern, alles andere unverändert */
export function replaceGuideSection(note: string, section: string): string {
  const bounds = sectionBounds(note)
  if (!bounds) throw new Error(`Marker fehlen oder sind doppelt: ${GUIDE_START} … ${GUIDE_END}`)
  return `${note.slice(0, bounds.from)}\n\n${section}\n\n${note.slice(bounds.to)}`
}
