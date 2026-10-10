// Darstellung System, Hell, Dunkel (Design 2, ADR-030): eine Einstellung des Geräts in `localStorage`; die Klasse
// `dark` an <html> schaltet die Tokens aus design2.css.

export type Theme = "system" | "light" | "dark"

export const THEME_KEY = "spiegel-theme"

export const isTheme = (value: unknown): value is Theme =>
  value === "system" || value === "light" || value === "dark"

/**
 * Vor dem ersten Zeichnen im <head>: setzt die Klasse, bevor React hydriert, damit die Seite nicht hell aufblitzt.
 * Ohne Speicher (privates Fenster) gilt das System.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_KEY
)});var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`
