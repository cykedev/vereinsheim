// Darstellung System, Hell, Dunkel (Design 2, ADR-030): eine Einstellung des Geräts in `localStorage`; die Klasse
// `dark` an <html> schaltet die Tokens aus design2.css. Jede App hat ihren eigenen Schlüssel.

export type Theme = "system" | "light" | "dark"

export const isTheme = (value: unknown): value is Theme =>
  value === "system" || value === "light" || value === "dark"

/**
 * Vor dem ersten Zeichnen im <head>: setzt die Klasse, bevor React hydriert, damit die Seite nicht hell aufblitzt.
 * Ohne Speicher (privates Fenster) gilt das System.
 */
export const themeScript = (storageKey: string) =>
  `(function(){try{var t=localStorage.getItem(${JSON.stringify(
    storageKey
  )});var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`
