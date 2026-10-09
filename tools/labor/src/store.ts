// Gemerkte Wahl im Labor (localStorage), ohne Speicher nur bis zum Neuladen.

export const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(`labor.${key}`)
    } catch {
      return null
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(`labor.${key}`, value)
    } catch {
      // ohne Speicher gilt die Wahl nur bis zum Neuladen
    }
  },
}
