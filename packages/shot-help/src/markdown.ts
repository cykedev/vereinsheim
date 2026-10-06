// Erzeugt den Hauptteil des Vault-Leitfadens (vault/spiegel/spiegel-statistics-help.md) aus den Daten,
// deterministisch und mit Umbruch bei 100 Zeichen wie die übrigen Notizen.

import { GLOSSARY } from "./glossary"
import { FALLACIES, READING_GUIDE } from "./guide"
import { HELP_TOPICS } from "./topics"
import type { HelpTheme, HelpTopic } from "./types"

const WIDTH = 100

/** Themen in der Reihenfolge der Oberfläche, mit ihren Überschriften */
export const THEME_TITLES: Readonly<Record<HelpTheme, string>> = Object.freeze({
  result: "Ergebnis",
  precision: "Präzision",
  position: "Lage",
  time: "Zeit und Verlauf",
  sighters: "Probe",
  coverage: "Datenlage",
})
const THEME_ORDER: readonly HelpTheme[] = [
  "result",
  "precision",
  "position",
  "time",
  "sighters",
  "coverage",
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

/** Hauptteil des Leitfadens: Einstieg, die Themen je Reiter, Glossar, Fehlschlüsse */
export function renderGuideMarkdown(): string {
  const parts = [
    "## So liest du die Zahlen",
    READING_GUIDE.map((item) => wrapText(`- **${item.title}.** ${item.text}`, WIDTH, "  ")).join(
      "\n"
    ),
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
