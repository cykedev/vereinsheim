// Prüft nur den Kopf einer PDF-Datei, ohne pdf.js. So kann ein Server Bytes abweisen, bevor er sie liest
// oder einem Kindprozess gibt.

const PDF_HEADER = new TextEncoder().encode("%PDF-")

/** So weit vorne muss der Kopf stehen; pdf.js duldet davor bis zu 1024 Bytes. */
export const PDF_HEADER_WINDOW = 1024

export function hasPdfHeader(bytes: Uint8Array): boolean {
  const last = Math.min(bytes.length, PDF_HEADER_WINDOW) - PDF_HEADER.length
  for (let start = 0; start <= last; start++) {
    if (PDF_HEADER.every((byte, i) => bytes[start + i] === byte)) return true
  }
  return false
}
