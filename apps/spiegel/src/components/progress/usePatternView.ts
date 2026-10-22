"use client"

import { useSyncExternalStore } from "react"

import type { PatternView } from "@vereinsheim/shot-ui/period/PatternTarget"

/** Schlüssel der gewählten Zeichnung des Trefferbilds: wie gezeichnet, nicht was man sieht, deshalb nicht in der Adresse */
export const PATTERN_VIEW_KEY = "spiegel-pattern-view"

// Die Wahl liegt im Gerät (`localStorage`); ohne Speicher (privates Fenster, voll) gilt sie bis zum Neuladen.
const listeners = new Set<() => void>()
let memory: PatternView = "density"
/** schlug das Schreiben fehl, gilt die Wahl im Speicher, nicht ein älterer Wert im Gerät */
let unsaved = false

const isView = (value: string | null): value is PatternView =>
  value === "density" || value === "outlines"

function read(): PatternView {
  if (unsaved) return memory
  try {
    const value = window.localStorage.getItem(PATTERN_VIEW_KEY)
    return isView(value) ? value : memory
  } catch {
    return memory
  }
}

function write(view: PatternView) {
  memory = view
  try {
    window.localStorage.setItem(PATTERN_VIEW_KEY, view)
    unsaved = false
  } catch {
    unsaved = true
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

/** die Zeichnung des Trefferbilds, die dieses Gerät zuletzt gewählt hat; der Server zeichnet die Vorgabe */
export function usePatternView(): [PatternView, (view: PatternView) => void] {
  const view = useSyncExternalStore(subscribe, read, () => "density" as const)
  return [view, write]
}
