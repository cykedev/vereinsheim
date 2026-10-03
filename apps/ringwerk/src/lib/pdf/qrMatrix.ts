import QRCode from "qrcode"

/** Ruhezone um den Code in Modulen (Spec: mind. 4). */
export const QR_QUIET_ZONE = 4

/**
 * Wandelt Text in die Pfaddaten eines QR-Codes: ein Rechteck je waagerechtem Lauf dunkler Module,
 * verschoben um die Ruhezone. Läufe statt Einzelquadrate, weil manche PDF-Viewer zwischen
 * aneinanderstoßenden Quadraten feine Haarlinien zeigen. `size` ist die Kantenlänge inklusive
 * Ruhezone, für die viewBox.
 */
export function qrPathData(text: string): { size: number; d: string } {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" })
  const parts: string[] = []
  for (let row = 0; row < modules.size; row++) {
    let col = 0
    while (col < modules.size) {
      if (!modules.get(row, col)) {
        col++
        continue
      }
      const start = col
      while (col < modules.size && modules.get(row, col)) col++
      const run = col - start
      parts.push(`M${start + QR_QUIET_ZONE} ${row + QR_QUIET_ZONE}h${run}v1h-${run}z`)
    }
  }
  return { size: modules.size + 2 * QR_QUIET_ZONE, d: parts.join("") }
}
