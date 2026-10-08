import { cn } from "@vereinsheim/lib/utils"

/**
 * Hinweis neben der leeren Scheibe (`CardPage` mit `empty`): statt leerer Kästen und Kacheln voller Striche ein
 * Satz, was hier erscheint (User, 8. Oktober 2026).
 */
export function NoShots({ className }: { className?: string }) {
  return (
    <div
      data-no-shots
      className={cn(
        "grid content-start gap-1.5 rounded-2xl border border-border bg-card p-5",
        className
      )}
    >
      <p className="font-display text-lg font-bold tracking-tight">Noch kein Schuss</p>
      <p className="text-[13px] text-muted-foreground">
        Sobald Schüsse da sind, stehen hier Ergebnis, Serien und Schüsse, darunter Zahlen und
        Analyse.
      </p>
    </div>
  )
}
