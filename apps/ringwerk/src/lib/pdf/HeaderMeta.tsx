import type { ReactElement } from "react"
import { Path, Svg, Text, View } from "@react-pdf/renderer"
import { formatDateOnly } from "@vereinsheim/lib/format"
import type { PublicPdfLink } from "@/lib/competitions/publicPdfLink"
import { qrPathData } from "./qrMatrix"
import { PDF_COLORS, styles } from "./styles"

// ≈ 25 mm — vom Aushang aus noch bequem scanbar
const QR_SIZE_PT = 72

/** Rechte Spalte im Seitenkopf: optional QR-Code + öffentliche URL, darunter das Erstelldatum. */
export function HeaderMeta({
  generatedAt,
  displayTimeZone,
  publicLink,
}: {
  generatedAt: Date
  displayTimeZone: string
  publicLink?: PublicPdfLink | null
}): ReactElement {
  const created = (
    <Text style={styles.headerDate}>Erstellt: {formatDateOnly(generatedAt, displayTimeZone)}</Text>
  )
  if (!publicLink) return created
  const qr = qrPathData(publicLink.qrUrl)
  return (
    <View style={{ alignItems: "flex-end" }}>
      <Svg width={QR_SIZE_PT} height={QR_SIZE_PT} viewBox={`0 0 ${qr.size} ${qr.size}`}>
        <Path d={qr.d} fill={PDF_COLORS.dark} />
      </Svg>
      <Text style={{ fontSize: 7, color: PDF_COLORS.muted, marginTop: 2, marginBottom: 2 }}>
        {publicLink.displayUrl}
      </Text>
      {created}
    </View>
  )
}
