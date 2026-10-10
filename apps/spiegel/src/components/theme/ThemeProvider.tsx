"use client"

import { createContext, useContext, useEffect, useSyncExternalStore } from "react"

import { isTheme, THEME_KEY, type Theme } from "./theme"

// Die Wahl liegt im Gerät (`localStorage`); ohne Speicher (privates Fenster) gilt sie bis zum Neuladen.
const listeners = new Set<() => void>()
let memory: Theme = "system"

function read(): Theme {
  try {
    const value = window.localStorage.getItem(THEME_KEY)
    return isTheme(value) ? value : memory
  } catch {
    return memory
  }
}

function write(theme: Theme) {
  memory = theme
  try {
    window.localStorage.setItem(THEME_KEY, theme)
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

const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void }>({
  theme: "system",
  setTheme: write,
})

/**
 * hält die Darstellung und folgt bei „System“ dem Wechsel des Systems. Server und Hydrierung sehen „System“; die
 * Klasse hat das Skript im <head> schon vorher gesetzt, sie ändert sich hier nur, wenn die Wahl es verlangt.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, read, () => "system" as const)

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && media.matches)
      )
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme: write }}>{children}</ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
