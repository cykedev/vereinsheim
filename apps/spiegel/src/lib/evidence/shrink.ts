// Beleg im Browser vorbereiten ([[adr-033]]): Fotos verkleinert der Browser unter die Grenze, bevor sie über die Leitung
// gehen (5 MiB je Anfrage). Ein Bild wird immer neu als JPEG gezeichnet: Das nimmt die Drehung aus den Metadaten mit und
// lässt die übrigen Metadaten (etwa den Ort der Aufnahme) weg; der Name behält den Stamm des Originals mit der Endung
// `.jpg`. Ein PDF geht, wie es ist, wenn es klein genug ist.

import { EVIDENCE_MAX_BYTES } from "./texts"

/** in dieser Folge, bis das Bild unter der Grenze liegt: lange Kante in px, Qualität des JPEG */
export const SHRINK_STEPS = [
  { edge: 2400, quality: 0.85 },
  { edge: 2400, quality: 0.7 },
  { edge: 1600, quality: 0.7 },
] as const

/** die Maße, verkleinert auf höchstens `edge` an der langen Kante, nie vergrößert */
export function fitWithin(width: number, height: number, edge: number) {
  const scale = Math.min(1, edge / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export const isPdfFile = (file: { type: string; name: string }) =>
  file.type === "application/pdf" || /\.pdf$/i.test(file.name)

/** der Name des neu gezeichneten JPEG: Stamm des Originals, Endung `.jpg`; ohne Stamm `beleg.jpg` */
export function jpegNameOf(name: string): string {
  const dot = name.lastIndexOf(".")
  const stem = (dot < 0 ? name : name.slice(0, dot)).trim()
  return `${stem || "beleg"}.jpg`
}

type Prepared = { ok: true; file: File } | { ok: false; problem: "tooLarge" | "unreadable" }

/** ein Foto als JPEG unter der Grenze, ein PDF unverändert; sonst der Grund */
export async function prepareEvidence(file: File): Promise<Prepared> {
  if (isPdfFile(file))
    return file.size <= EVIDENCE_MAX_BYTES ? { ok: true, file } : { ok: false, problem: "tooLarge" }
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
  } catch {
    return { ok: false, problem: "unreadable" }
  }
  try {
    for (const step of SHRINK_STEPS) {
      const { width, height } = fitWithin(bitmap.width, bitmap.height, step.edge)
      const canvas = document.createElement("canvas")
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext("2d")
      if (!context) return { ok: false, problem: "unreadable" }
      context.drawImage(bitmap, 0, 0, width, height)
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", step.quality)
      )
      if (!blob) return { ok: false, problem: "unreadable" }
      if (blob.size <= EVIDENCE_MAX_BYTES)
        return { ok: true, file: new File([blob], jpegNameOf(file.name), { type: "image/jpeg" }) }
    }
    return { ok: false, problem: "tooLarge" }
  } finally {
    bitmap.close()
  }
}
