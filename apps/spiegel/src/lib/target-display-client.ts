import {
  parseTargetDisplay,
  serializeTargetDisplay,
  type TargetDisplay,
} from "@vereinsheim/shot-ui/target/display"

import { TARGET_DISPLAY_COOKIE } from "@/lib/target-display-cookie"

/** die Darstellung der Scheibe als Voreinstellung merken (ein Jahr); jede Änderung schreibt sie neu */
export function rememberTargetDisplay(display: TargetDisplay) {
  document.cookie = `${TARGET_DISPLAY_COOKIE}=${encodeURIComponent(serializeTargetDisplay(display))}; path=/; max-age=31536000; samesite=lax`
}

/**
 * die gemerkte Darstellung aus dem Cookie im Browser, als Text in der Form von `serializeTargetDisplay` (ohne Cookie
 * die Vorgabe); ein Text, damit `useSyncExternalStore` ihn vergleichen kann
 */
export function savedTargetDisplay(): string {
  const entry = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${TARGET_DISPLAY_COOKIE}=`))
  let text: string | null = null
  try {
    text = entry ? decodeURIComponent(entry.slice(TARGET_DISPLAY_COOKIE.length + 1)) : null
  } catch {
    // kaputt: die Vorgabe
  }
  return serializeTargetDisplay(parseTargetDisplay(text))
}
