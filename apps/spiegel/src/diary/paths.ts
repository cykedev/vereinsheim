// Werte der Adressen im Tagebuch, die Server und Browser teilen (ohne Abhängigkeit auf die Datenbank).

/** der Reiter „Abläufe“: dorthin führen die Rückwege von einem Ablauf */
export const ROUTINES_PATH = "/diary/routines"

/** der Reiter „Auswertung“ */
export const ANALYSIS_PATH = "/diary/analysis"

const query = (family: string | null, season: string | null) => {
  const params = new URLSearchParams()
  if (family) params.set("family", family)
  if (season) params.set("season", season)
  const text = params.toString()
  return text ? `?${text}` : ""
}

/** die Auswertung mit Disziplin und Zeitraum (Startjahr der Saison, ohne: „Alles“) */
export const analysisHref = (family: string | null, season: string | null) =>
  `${ANALYSIS_PATH}${query(family, season)}`

/** die Seite eines Merkmals mit derselben Disziplin und demselben Zeitraum */
export const factorHref = (aspect: string, family: string | null, season: string | null) =>
  `${ANALYSIS_PATH}/${aspect}${query(family, season)}`
