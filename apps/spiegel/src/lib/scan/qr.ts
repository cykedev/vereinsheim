// QR-Code vom Ausdruck lesen, ohne React. Die Wahl ([[spiegel-assignment]], „Der QR-Weg im Detail“): das native
// `BarcodeDetector` (Chrome auf Android und am Desktop), sonst `jsqr` (Apache-2.0, reines JS, rund 45 KB, nur auf
// „Scheibe holen“ geladen) auf einem Bild aus dem Video oder dem Foto. `zxing-wasm` bräuchte rund 1 MB WASM aus einem
// CDN oder im Build und mit einer CSP `wasm-unsafe-eval`, `qr-scanner` hat seit 2022 kein Release. QR auf Papier ist
// gelöst: `jsqr` steckt nur hinter `decodePixels` und ließe sich mit dem Test austauschen.

/**
 * die längste Adresse, die Spiegel holt (wie `MAX_URL_LENGTH` beim Holen; hier eigen, weil `printouts/fetch` nur auf dem
 * Server läuft, ein Test hält beide gleich)
 */
export const MAX_LINK_LENGTH = 2_048

/** so groß liest Spiegel ein Bild aus dem Video (schnell, alle 200 ms) bzw. ein Foto (genauer, einmal) */
export const VIDEO_MAX_PX = 640
export const PHOTO_MAX_PX = 1600

/** der Inhalt eines QR-Codes als Link auf einen Ausdruck: nur `http:` oder `https:`, nicht zu lang; sonst null */
export function qrLink(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length > MAX_LINK_LENGTH) return null
  try {
    const url = new URL(trimmed)
    return url.protocol === "http:" || url.protocol === "https:" ? trimmed : null
  } catch {
    return null
  }
}

/** Breite und Höhe, so verkleinert, dass die längere Seite höchstens `max` ist; nie vergrößert */
export function fitSize(
  width: number,
  height: number,
  max: number
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height, 1))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

/**
 * Text eines QR-Codes aus RGBA-Pixeln (`ImageData.data`); `both`: auch hell auf dunkel versuchen (Foto), sonst nur
 * dunkel auf hell (Video, schneller). null ohne Code
 */
export async function decodePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  { both }: { both: boolean }
): Promise<string | null> {
  const { default: jsQR } = await import("jsqr")
  return (
    jsQR(data, width, height, { inversionAttempts: both ? "attemptBoth" : "dontInvert" })?.data ??
    null
  )
}

/** was der Leser nimmt: ein Bild aus dem Video oder ein Foto */
export type QrSource = HTMLVideoElement | ImageBitmap

export interface QrReader {
  /** der Text des ersten QR-Codes im Bild; null ohne */
  read(source: QrSource, mode: "video" | "photo"): Promise<string | null>
}

/** das native `BarcodeDetector`, soweit Spiegel es braucht (nicht in jeder Typbibliothek) */
interface NativeDetector {
  detect(source: QrSource): Promise<{ rawValue: string }[]>
}
interface NativeDetectorClass {
  new (options: { formats: string[] }): NativeDetector
  getSupportedFormats(): Promise<string[]>
}

const sizeOf = (source: QrSource) =>
  "videoWidth" in source
    ? { width: source.videoWidth, height: source.videoHeight }
    : { width: source.width, height: source.height }

/** ein Leser für diese Seite: nativ, wenn der Browser QR kann, sonst über ein Canvas und `decodePixels` */
export async function createQrReader(): Promise<QrReader> {
  const Native = (globalThis as { BarcodeDetector?: NativeDetectorClass }).BarcodeDetector
  if (Native) {
    try {
      if ((await Native.getSupportedFormats()).includes("qr_code")) {
        const detector = new Native({ formats: ["qr_code"] })
        return { read: async (source) => (await detector.detect(source))[0]?.rawValue ?? null }
      }
    } catch {
      // ohne QR im nativen Leser über das Canvas
    }
  }
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d", { willReadFrequently: true })
  return {
    read: async (source, mode) => {
      const natural = sizeOf(source)
      if (!context || !natural.width || !natural.height) return null
      const { width, height } = fitSize(
        natural.width,
        natural.height,
        mode === "video" ? VIDEO_MAX_PX : PHOTO_MAX_PX
      )
      canvas.width = width
      canvas.height = height
      context.drawImage(source, 0, 0, width, height)
      const image = context.getImageData(0, 0, width, height)
      return decodePixels(image.data, width, height, { both: mode === "photo" })
    },
  }
}
