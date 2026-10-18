"use client"

import { useSyncExternalStore } from "react"

import { themeScript } from "./theme"

const subscribe = () => () => {}

/**
 * Das Skript der Darstellung im <head>, nur im HTML vom Server. Beim Hydrieren übernimmt React das Element; rendert es
 * im Client neu (nach einem Hydrierungsfehler die ganze Wurzel samt <head>), liefe ein neues Skript nicht und React
 * warnte „Encountered a script tag“. Dann rendert die Komponente nichts, das Skript aus dem HTML ist längst gelaufen.
 */
export function ThemeScript({ storageKey }: { storageKey: string }) {
  const fromServer = useSyncExternalStore(
    subscribe,
    () => false,
    () => true
  )
  return fromServer ? (
    <script dangerouslySetInnerHTML={{ __html: themeScript(storageKey) }} />
  ) : null
}
