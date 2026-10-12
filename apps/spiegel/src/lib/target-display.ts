import { cookies } from "next/headers"

import { parseTargetDisplay, type TargetDisplay } from "@vereinsheim/shot-ui/target/display"

import { TARGET_DISPLAY_COOKIE } from "@/lib/target-display-cookie"

/**
 * Die Darstellung der Scheibe, die der Schütze zuletzt gewählt hat (Ebenen, übrige blass/aus); ohne Cookie die
 * Vorgabe. Auf dem Server gelesen, damit die Scheibe schon im ersten Bild richtig steht.
 */
export async function targetDisplay(): Promise<TargetDisplay> {
  // Next gibt den Wert schon entschlüsselt (`encodeURIComponent` beim Schreiben)
  return parseTargetDisplay((await cookies()).get(TARGET_DISPLAY_COOKIE)?.value)
}
