import { cookies } from "next/headers"

import { parseTargetDisplay, type TargetDisplay } from "@vereinsheim/shot-ui/target/display"

import { TARGET_DISPLAY_COOKIE } from "@/lib/target-display-cookie"

/**
 * Die Darstellung der Scheibe, die der Schütze zuletzt gewählt hat (Ebenen, übrige blass/aus); ohne Cookie die
 * Vorgabe. Auf dem Server gelesen, damit die Scheibe schon im ersten Bild richtig steht.
 */
export async function targetDisplay(): Promise<TargetDisplay> {
  const value = (await cookies()).get(TARGET_DISPLAY_COOKIE)?.value
  let text = value ?? null
  try {
    text = value ? decodeURIComponent(value) : null
  } catch {
    // schon entschlüsselt oder kaputt: `parseTargetDisplay` fällt auf die Vorgabe
  }
  return parseTargetDisplay(text)
}
