"use client"

import { useRef } from "react"

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

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  destructive?: boolean
}

// Einheitlicher Bestätigungsdialog (Abbrechen / Bestätigen) im shadcn-Stil.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Bestätigen",
  onConfirm,
  destructive = false,
}: Props) {
  const opener = useRef<HTMLElement | null>(null)
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        // ohne Auslöser von Radix: Den Knopf, der den Dialog öffnete, merkt sich der Dialog selbst und gibt ihm den
        // Fokus beim Schließen zurück (wie `DecisionDialog`)
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
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={
              destructive
                ? // Design 2 kennt kein `destructive-foreground`; `primary-foreground` ist auf `destructive` in
                  // beiden Themes lesbar
                  "bg-destructive text-primary-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
