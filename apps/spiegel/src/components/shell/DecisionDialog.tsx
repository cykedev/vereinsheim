"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@vereinsheim/ui/alert-dialog"

import type { Decision } from "@/lib/admin/consequences"

/**
 * Der Inhalt eines Entscheids (P2c, D2): worum es geht, was vorher zu prüfen ist, was passiert, was nicht, und wie es
 * zurückgeht. Abschnitte nur mit Inhalt. Getrennt vom Dialog, damit ein Markup-Test ihn sieht (der Dialog rendert in
 * ein Portal).
 */
export function DecisionBody({ decision }: { decision: Decision }) {
  return (
    <div data-decision className="grid gap-3 text-left text-sm">
      {decision.check && (
        <div data-decision-check className="rounded-xl bg-surface-2 p-3">
          <p className="font-semibold text-foreground">Vorher prüfen</p>
          <p className="text-foreground-2">{decision.check}</p>
        </div>
      )}
      <Section title="Was dann passiert" lines={decision.happens} marker="happens" />
      <Section title="Was nicht passiert" lines={decision.notHappening} marker="not" />
      <div data-decision-undo>
        <p className="font-semibold text-foreground">Rückgängig</p>
        <p className="text-foreground-2">{decision.undo}</p>
      </div>
    </div>
  )
}

function Section({ title, lines, marker }: { title: string; lines: string[]; marker: string }) {
  if (!lines.length) return null
  return (
    <div data-decision-section={marker}>
      <p className="font-semibold text-foreground">{title}</p>
      <ul className="list-disc pl-5 text-foreground-2">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Jede Aktion mit Folgen fragt hierüber (Regel „Kein Knopf ohne Folge“, `vault/conventions.md` §10). Die Texte kommen
 * aus `src/lib/admin/consequences.ts`. Der Fokus steht zuerst auf „Abbrechen“; der ganze Inhalt ist als Beschreibung
 * mit dem Dialog verknüpft.
 */
export function DecisionDialog({
  decision,
  open,
  onOpenChange,
  onConfirm,
}: {
  decision: Decision
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>{decision.title}</AlertDialogTitle>
        </AlertDialogHeader>
        {/* der ganze Inhalt beschreibt den Dialog, nicht nur der erste Satz (Review): Screenreader lesen Prüfen und
            Folgen mit */}
        <AlertDialogDescription asChild>
          <div className="grid gap-3">
            <p className="text-sm text-foreground-2">{decision.about}</p>
            <DecisionBody decision={decision} />
          </div>
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={
              decision.destructive
                ? // Design 2 kennt kein `destructive-foreground`; `primary-foreground` ist auf `destructive` in
                  // beiden Themes lesbar
                  "bg-destructive text-primary-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {decision.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
