"use client"

import { useRef, type ReactNode } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog"

/** eine Entscheidung in Alltagsworten; die Texte stehen je App an einer Stelle (`consequences.ts`) */
export interface Decision {
  title: string
  /** worum es geht: wer, welche Nummer, welches Gerät, wie viele Scheiben */
  about: string
  /** was vorher zu prüfen ist; fehlt, wenn es nichts zu prüfen gibt */
  check?: string
  /** was dann passiert */
  happens: string[]
  /** was ausdrücklich nicht passiert */
  notHappening: string[]
  /** wie es zurückgeht (oder dass es nicht geht) */
  undo: string
  confirmLabel: string
  destructive: boolean
}

/**
 * Der Inhalt eines Entscheids: worum es geht, was vorher zu prüfen ist, was passiert, was nicht, und wie es
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
 * aus den Folgen der App (`consequences.ts`). Der Fokus steht zuerst auf „Abbrechen“; der ganze Inhalt ist als Beschreibung
 * mit dem Dialog verknüpft. Beim Schließen kehrt der Fokus zu dem Element zurück, das ihn beim Öffnen hatte: Ohne
 * `AlertDialogTrigger` gäbe Radix ihn an einen leeren Trigger, und er fiele auf <body>.
 *
 * `children` steht unter den Folgen, etwa ein Feld, in das zur Bestätigung ein Name getippt wird; `confirmDisabled`
 * sperrt den Knopf, bis es stimmt. Bestätigt wird nur, solange der Dialog offen ist: Während er ausblendet, ist der Knopf
 * noch zu treffen, und ein zweiter Klick liefe sonst ein zweites Mal.
 */
export function DecisionDialog({
  decision,
  open,
  onOpenChange,
  onConfirm,
  confirmDisabled = false,
  children,
}: {
  decision: Decision
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  confirmDisabled?: boolean
  children?: ReactNode
}) {
  const opener = useRef<HTMLElement | null>(null)
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="max-h-[90dvh] overflow-y-auto"
        // beim Einhängen, bevor der Dialog den Fokus nimmt: Hier hat ihn noch der Knopf, der ihn öffnete
        onOpenAutoFocus={() => {
          opener.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (opener.current?.isConnected) opener.current.focus()
          opener.current = null
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{decision.title}</AlertDialogTitle>
        </AlertDialogHeader>
        {/* der ganze Inhalt beschreibt den Dialog, nicht nur der erste Satz: Screenreader lesen Prüfen und
            Folgen mit */}
        <AlertDialogDescription asChild>
          <div className="grid gap-3">
            <p className="text-sm text-foreground-2">{decision.about}</p>
            <DecisionBody decision={decision} />
          </div>
        </AlertDialogDescription>
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (open) onConfirm()
            }}
            disabled={confirmDisabled}
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

/**
 * Ein Hinweis statt einer Entscheidung: Die Aktion geht hier nicht, und der Text sagt, warum und was stattdessen geht.
 * Nur ein Knopf „Schließen“. Fokus wie bei `DecisionDialog`.
 */
export function NoticeDialog({
  title,
  text,
  open,
  onOpenChange,
}: {
  title: string
  text: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const opener = useRef<HTMLElement | null>(null)
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        onOpenAutoFocus={() => {
          opener.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (opener.current?.isConnected) opener.current.focus()
          opener.current = null
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-sm text-foreground-2">
            {text}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Schließen</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
