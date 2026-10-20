// Charakterisierung der Bestätigungen ohne DOM: Die Dialog-Bausteine werden durch Stellvertreter ersetzt, die ihren
// Bestätigen-Knopf hier ablegen. Ein Test rendert die Komponente, ruft die Bestätigung auf und prüft, welche Action mit
// welchen Werten läuft. Dieselben Stellvertreter gibt es für `AlertDialog` und `DecisionDialog`, damit ein Test einen
// Umbau vom einen zum anderen unverändert übersteht.

import { createElement, Fragment, type ReactNode } from "react"

/** die Bestätigungen der zuletzt gerenderten Komponente, in der Reihenfolge des Markups */
export const confirms: Array<() => void> = []

const pass = ({ children }: { children?: ReactNode }) => createElement(Fragment, null, children)

export function alertDialogStub() {
  return {
    AlertDialog: pass,
    AlertDialogTrigger: pass,
    AlertDialogContent: pass,
    AlertDialogHeader: pass,
    AlertDialogFooter: pass,
    AlertDialogTitle: pass,
    AlertDialogDescription: pass,
    AlertDialogCancel: pass,
    AlertDialogAction: ({ onClick, children }: { onClick?: () => void; children?: ReactNode }) => {
      if (onClick) confirms.push(onClick)
      return createElement("button", { "data-confirm": true }, children)
    },
  }
}

export function decisionDialogStub() {
  return {
    DecisionDialog: ({ onConfirm }: { onConfirm: () => void }) => {
      confirms.push(onConfirm)
      return createElement("button", { "data-confirm": true })
    },
  }
}

/** `useTransition` ohne React-Laufzeit: der Übergang läuft sofort, sein Versprechen liegt in `transitions` */
export const transitions: Array<Promise<void> | void> = []
export const runTransition = (callback: () => Promise<void> | void) => {
  transitions.push(callback())
}

/** wartet, bis alle gestarteten Übergänge durch sind */
export async function settle() {
  await Promise.all(transitions)
}

export function reset() {
  confirms.length = 0
  transitions.length = 0
}
