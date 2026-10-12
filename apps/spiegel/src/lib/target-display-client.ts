import { serializeTargetDisplay, type TargetDisplay } from "@vereinsheim/shot-ui/target/display"

import { TARGET_DISPLAY_COOKIE } from "@/lib/target-display-cookie"

/** die Darstellung der Scheibe als Voreinstellung merken (ein Jahr); jede Änderung schreibt sie neu */
export function rememberTargetDisplay(display: TargetDisplay) {
  document.cookie = `${TARGET_DISPLAY_COOKIE}=${encodeURIComponent(serializeTargetDisplay(display))}; path=/; max-age=31536000; samesite=lax`
}
