import QRCode from "qrcode"

/** Ruhezone um den Code in Modulen (Spec: mind. 4). */
export const QR_QUIET_ZONE = 4

/**
 * Wandelt Text in die Pfaddaten eines QR-Codes: ein Quadrat je dunklem Modul, verschoben um die
 * Ruhezone. `size` ist die Kantenlänge inklusive Ruhezone, für die viewBox.
 */
export function qrPathData(text: string): { size: number; d: string } {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" })
  const parts: string[] = []
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (modules.get(row, col)) {
        parts.push(`M${col + QR_QUIET_ZONE} ${row + QR_QUIET_ZONE}h1v1h-1z`)
      }
    }
  }
  return { size: modules.size + 2 * QR_QUIET_ZONE, d: parts.join("") }
}
