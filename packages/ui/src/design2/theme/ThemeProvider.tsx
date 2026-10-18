"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react"

import { isTheme, type Theme } from "./theme"

// Die Wahl liegt im Gerät (`localStorage`); ohne Speicher (privates Fenster) gilt sie bis zum Neuladen.
const listeners = new Set<() => void>()
let memory: Theme = "system"

function read(storageKey: string): Theme {
  try {
    const value = window.localStorage.getItem(storageKey)
    return isTheme(value) ? value : memory
  } catch {
    return memory
  }
}

function write(storageKey: string, theme: Theme) {
  memory = theme
  try {
    window.localStorage.setItem(storageKey, theme)
  } catch {
    // nur im Speicher
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

interface ThemeState {
  /** die Wahl: System, Hell oder Dunkel */
  theme: Theme
  /** was gerade gilt, „System“ aufgelöst */
  resolved: "light" | "dark"
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeState>({
  theme: "system",
  resolved: "light",
  setTheme: () => {},
})

/**
 * hält die Darstellung und folgt bei „System“ dem Wechsel des Systems. Server und Hydrierung sehen „System“; die
 * Klasse hat das Skript im <head> schon vorher gesetzt, sie ändert sich hier nur, wenn die Wahl es verlangt.
 */
export function ThemeProvider({
  storageKey,
  children,
}: {
  storageKey: string
  children: React.ReactNode
}) {
  const theme = useSyncExternalStore(
    subscribe,
    () => read(storageKey),
    () => "system" as const
  )
  const [resolved, setResolved] = useState<"light" | "dark">("light")
  const setTheme = useCallback((next: Theme) => write(storageKey, next), [storageKey])

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = () => {
      const isDark = theme === "dark" || (theme === "system" && media.matches)
      document.documentElement.classList.toggle("dark", isDark)
      setResolved(isDark ? "dark" : "light")
    }
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
