// Charakterisierung der Bestätigungen ohne DOM (kein jsdom): Die Bausteine der Dialoge, Knöpfe und Felder werden durch
// Stellvertreter ersetzt, die hier ablegen, was man anklicken oder eintippen kann. Ein kleiner Speicher für `useState`
// hält den Zustand zwischen zwei Renderläufen, so wie React es täte, solange die Hooks in derselben Reihenfolge laufen.
//
// Ein Test rendert die Komponente, drückt einen Knopf („Löschen“), tippt einen Namen, rendert neu, bestätigt und prüft,
// welche Action mit welchen Werten genau einmal läuft. Dieselben Stellvertreter gibt es für den Baustein `AlertDialog`
// und für `DecisionDialog` und `NoticeDialog`, damit ein Test einen Umbau von einem zum anderen unverändert übersteht.

import {
  createContext,
  createElement,
  Fragment,
  isValidElement,
  useContext,
  type ReactElement,
  type ReactNode,
} from "react"
import { renderToStaticMarkup } from "react-dom/server"

/** eine Bestätigung im zuletzt gerenderten Markup: der Knopf, der die Aktion auslöst */
export interface Confirm {
  run: () => void
  disabled: boolean
}

/** ein Knopf außerhalb der Bestätigung (Auslöser, Werkzeugleiste), gefunden über `aria-label`, `title` oder Text */
export interface Pressable {
  name: string
  run: () => void
  disabled: boolean
}

export const confirms: Confirm[] = []
export const buttons: Pressable[] = []
/** Titel der Hinweise ohne Bestätigung (`NoticeDialog`) */
export const notices: string[] = []
const inputs = new Map<string, (value: string) => void>()

// ---------------------------------------------------------------------------------------------------------------------
// Zustand zwischen Renderläufen

const store: unknown[] = []
let cursor = 0

/** `useState` mit Zustand über Renderläufe hinweg; die Hooks einer Komponente laufen je Lauf in derselben Reihenfolge */
export function useStateStub<T>(initial: T | (() => T)): [T, (next: T | ((prev: T) => T)) => void] {
  const index = cursor++
  if (index >= store.length) {
    store[index] = typeof initial === "function" ? (initial as () => T)() : initial
  }
  const set = (next: T | ((prev: T) => T)) => {
    store[index] = typeof next === "function" ? (next as (prev: T) => T)(store[index] as T) : next
  }
  return [store[index] as T, set]
}

/** `useTransition` ohne React-Laufzeit: der Übergang läuft sofort, sein Versprechen liegt in `transitions` */
export const transitions: Array<Promise<void> | void> = []
export const runTransition = (callback: () => Promise<void> | void) => {
  transitions.push(callback())
}

/** rendert neu; was vorher anklickbar war, wird durch den neuen Stand ersetzt */
export function render(element: ReactElement): string {
  cursor = 0
  confirms.length = 0
  buttons.length = 0
  notices.length = 0
  inputs.clear()
  return renderToStaticMarkup(element)
}

/** wartet, bis alle gestarteten Übergänge durch sind */
export async function settle() {
  await Promise.all(transitions)
}

export function reset() {
  store.length = 0
  cursor = 0
  confirms.length = 0
  buttons.length = 0
  notices.length = 0
  inputs.clear()
  transitions.length = 0
}

/** drückt den Knopf mit diesem Namen (genau einer muss passen) */
export function press(name: string) {
  const found = buttons.filter((b) => b.name === name)
  if (found.length !== 1) {
    throw new Error(
      `Knopf „${name}“ ${found.length}-mal da: ${buttons.map((b) => b.name).join(", ")}`
    )
  }
  found[0].run()
}

/** tippt in das Feld mit dieser `id` */
export function type(id: string, value: string) {
  const onChange = inputs.get(id)
  if (!onChange) throw new Error(`Feld #${id} fehlt: ${[...inputs.keys()].join(", ")}`)
  onChange(value)
}

// ---------------------------------------------------------------------------------------------------------------------
// Stellvertreter

const InFooter = createContext(false)

const pass = ({ children }: { children?: ReactNode }) => createElement(Fragment, null, children)

const textOf = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(textOf).join("")
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ""
}

type ButtonProps = {
  onClick?: () => void
  disabled?: boolean
  title?: string
  "aria-label"?: string
  children?: ReactNode
}

function StubButton(props: ButtonProps) {
  const inFooter = useContext(InFooter)
  const run = props.onClick ?? (() => {})
  const disabled = props.disabled ?? false
  if (inFooter && props.onClick) confirms.push({ run, disabled })
  else
    buttons.push({
      name: props["aria-label"] ?? props.title ?? textOf(props.children).trim(),
      run,
      disabled,
    })
  return createElement("button", null, props.children)
}

export function buttonStub() {
  return { Button: StubButton }
}

export function inputStub() {
  return {
    Input: ({
      id,
      value,
      onChange,
    }: {
      id?: string
      value?: string
      onChange?: (event: { target: { value: string } }) => void
    }) => {
      if (id && onChange) inputs.set(id, (v) => onChange({ target: { value: v } }))
      return createElement("input", { id, defaultValue: value })
    },
  }
}

export function alertDialogStub() {
  return {
    AlertDialog: pass,
    AlertDialogTrigger: pass,
    AlertDialogContent: pass,
    AlertDialogHeader: pass,
    AlertDialogFooter: ({ children }: { children?: ReactNode }) =>
      createElement(InFooter.Provider, { value: true }, children),
    AlertDialogTitle: pass,
    AlertDialogDescription: pass,
    AlertDialogCancel: () => createElement("button", null, "Abbrechen"),
    AlertDialogAction: ({ onClick, disabled, children }: ButtonProps) => {
      if (onClick) confirms.push({ run: onClick, disabled: disabled ?? false })
      return createElement("button", { "data-confirm": true }, children)
    },
  }
}

export function decisionDialogStub() {
  return {
    DecisionDialog: ({
      onConfirm,
      confirmDisabled,
      children,
    }: {
      onConfirm: () => void
      confirmDisabled?: boolean
      children?: ReactNode
    }) => {
      confirms.push({ run: onConfirm, disabled: confirmDisabled ?? false })
      return createElement(
        Fragment,
        null,
        children,
        createElement("button", { "data-confirm": true })
      )
    },
    NoticeDialog: ({ title }: { title: string }) => {
      notices.push(title)
      return null
    },
  }
}
