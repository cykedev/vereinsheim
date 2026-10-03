import type { ReactElement } from "react"
import { Path, Svg, Text, View } from "@react-pdf/renderer"
import { formatDateOnly } from "@vereinsheim/lib/format"
import type { PublicPdfLink } from "@/lib/competitions/publicPdfLink"
import { qrPathData } from "./qrMatrix"
import { PDF_COLORS, styles } from "./styles"

/** ≈ 23 mm — vom Aushang aus bequem scanbar. */
export const QR_SIZE_PT = 64
/**
 * ≈ 17 mm — für Seiten, deren Inhalt die Höhe ausreizt (Playoff-Bracket im Achtelfinal-Modus):
 * der Kopf wächst damit nur um wenige Punkt.
 */
export const QR_SIZE_COMPACT_PT = 48

/** Feste Breite der URL-Spalte — die Zeilen sind über `splitDisplayUrl` darauf zugeschnitten. */
const URL_COLUMN_PT = 170

/** Höchstens so viele Zeichen je URL-Zeile — passt bei 7 pt in die URL-Spalte. */
export const URL_LINE_MAX_CHARS = 40

/**
 * Teilt die gedruckte URL in Zeilen: Origin und Pfad getrennt, jede Zeile höchstens
 * `URL_LINE_MAX_CHARS` lang und bevorzugt nach `/`, `-` oder `.` umbrochen. react-pdf bricht ein
 * Wort ohne Leerzeichen nicht selbst um — ein langer Slug liefe sonst in den QR-Code.
 */
export function splitDisplayUrl(url: string): string[] {
  const i = url.indexOf("/api/")
  const parts = i > 0 ? [url.slice(0, i), url.slice(i)] : [url]
  return parts.flatMap((part) => chunkAtBreaks(part, URL_LINE_MAX_CHARS))
}

function chunkAtBreaks(text: string, max: number): string[] {
  const lines: string[] = []
  let rest = text
  while (rest.length > max) {
    const window = rest.slice(0, max)
    const cut = Math.max(window.lastIndexOf("/"), window.lastIndexOf("-"), window.lastIndexOf("."))
    // Umbruch nach dem Trennzeichen; ohne brauchbares Trennzeichen hart bei `max`.
    const at = cut > 0 ? cut + 1 : max
    lines.push(rest.slice(0, at))
    rest = rest.slice(at)
  }
  lines.push(rest)
  return lines
}

/**
 * Rechte Spalte im Seitenkopf: das Erstelldatum, bei veröffentlichten Wettbewerben links daneben
 * die öffentliche URL und rechts der QR-Code. Nebeneinander statt gestapelt, damit der Kopf kaum
 * höher wird.
 */
export function HeaderMeta({
  generatedAt,
  displayTimeZone,
  publicLink,
  qrSize = QR_SIZE_PT,
}: {
  generatedAt: Date
  displayTimeZone: string
  publicLink?: PublicPdfLink | null
  qrSize?: number
}): ReactElement {
  const created = (
    <Text style={styles.headerDate}>Erstellt: {formatDateOnly(generatedAt, displayTimeZone)}</Text>
  )
  if (!publicLink) return created
  const qr = qrPathData(publicLink.qrUrl)
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", flexShrink: 0 }}>
      <View style={{ width: URL_COLUMN_PT, alignItems: "flex-end", marginRight: 6 }}>
        {splitDisplayUrl(publicLink.displayUrl).map((line, i) => (
          <Text
            key={i}
            style={{ fontSize: 7, color: PDF_COLORS.muted, textAlign: "right" }}
            // Keine Silbentrennung — die Zeilen kommen fertig umbrochen aus splitDisplayUrl.
            hyphenationCallback={(word) => [word]}
          >
            {line}
          </Text>
        ))}
        <View style={{ marginTop: 3 }}>{created}</View>
      </View>
      <Svg width={qrSize} height={qrSize} viewBox={`0 0 ${qr.size} ${qr.size}`}>
        <Path d={qr.d} fill={PDF_COLORS.dark} />
      </Svg>
    </View>
  )
}
