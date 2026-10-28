// Klassen, die mehrere Seiten des Tagebuchs teilen.

/** ein Kasten auf der Seite */
export const BOX = "rounded-2xl border border-border bg-card p-4"

/** Überschrift eines Felds im Formular */
export const LABEL = "text-[12px] font-semibold tracking-wide text-muted-foreground uppercase"

/** ein Eingabefeld im Formular */
export const FIELD =
  "rounded-xl border border-border bg-background px-3 py-2 text-[15px] outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 aria-invalid:border-destructive"

/** ein Chip zur Wahl (Disziplin), gewählt mit `aria-pressed` */
export const CHIP =
  "inline-flex h-8 cursor-pointer items-center rounded-full border border-line-strong px-3 text-[13px] font-semibold text-foreground-2 focus-visible:outline-2 focus-visible:outline-ring aria-pressed:border-primary aria-pressed:bg-accent-wash aria-pressed:text-foreground"

/** der Knopf rechts in einer Zeile von „Dieser Eintrag“, „Dieses Ziel“, „Dieser Ablauf“ („Ändern“, „Bearbeiten“) */
export const ROW_BUTTON =
  "inline-flex h-10 cursor-pointer items-center rounded-full border border-line-strong px-3.5 text-[13px] font-semibold text-primary hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
