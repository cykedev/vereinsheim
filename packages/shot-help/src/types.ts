// Typen der Hilfe: Erklärungen zu Kennzahlen und Auswertungen, zur Oberfläche, Einstieg, Glossar und
// Fehlschlüsse. Die Texte sind deutsch, in „du“-Form und ohne Formeln vor den Worten.

/** Thema der Oberfläche, nach dem die Erklärungen gruppiert sind */
export type HelpTheme =
  | "result"
  | "precision"
  | "position"
  | "time"
  | "coverage"
  | "period"
  | "compare"

/** Erklärung einer Karte: deckt Katalog-IDs und Registry-Kennzahlen ab */
export interface HelpTopic {
  /** kebab-case, stabil; über sie verweist die Oberfläche auf die Erklärung */
  id: string
  title: string
  theme: HelpTheme
  /** Katalog-IDs aus vault/spiegel/spiegel-statistics.md, etwa ["P5", "P9"] */
  catalog: readonly string[]
  /** Registry-Schlüssel aus `@vereinsheim/shot-core/metrics`, etwa ["group.sigma"] */
  metrics: readonly string[]
  /** ein Satz für Kachel und Tooltip */
  short: string
  /** Was misst es? */
  what: string
  /** So liest du es */
  read?: string
  /** Was du tun kannst */
  act?: string
  /** Vorsicht: wo man sich täuscht */
  caution?: string
  /** ab wann es die Zahl gibt, etwa „ab 10 Schuss.“ */
  minimum?: string
  /** für Profis, aufklappbar, nie vor den Worten */
  formula?: string
}

/** Erklärung eines Elements der Oberfläche, das keine Statistik ist */
export interface ViewHelp {
  id: string
  title: string
  what: string
  read?: string
}

export interface GlossaryEntry {
  term: string
  text: string
}

export interface GuideItem {
  title: string
  text: string
}
