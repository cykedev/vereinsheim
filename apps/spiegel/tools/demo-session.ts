// Das Demo-Konto im Browser: anmelden wie das Formular und eine volle Scheibe aus seiner Liste wählen. Geteilt von der
// Skriptprüfung (`pruefen.ts`) und den Bildern für die README (`readme-bilder.ts`); vorher `seed:own --demo`.

import type { Page } from "@vereinsheim/pruefen/browser"

import { DEMO_EMAIL, DEMO_PASSWORD } from "./demo-account"

/** die gewählte Scheibe: ihre Adresse aus der Liste, ihre Kennung und die der Scheibe davor */
export interface Card {
  href: string
  id: string
  previousId: string
}

/** Anmelden wie das Formular (CSRF-Token, Credentials-Callback); danach steht die Sitzung im Cookie */
export async function login(page: Page, base: string) {
  await page.viewport(1280, 900)
  await page.goto(`${base}/login`, '$("form")')
  const status = await page.ev<number>(`(async () => {
    const { csrfToken } = await (await fetch("/api/auth/csrf")).json()
    const body = new URLSearchParams({ csrfToken, email: ${JSON.stringify(DEMO_EMAIL)},
      password: ${JSON.stringify(DEMO_PASSWORD)}, json: "true", callbackUrl: "/" })
    const r = await fetch("/api/auth/callback/credentials", { method: "POST", body,
      headers: { "content-type": "application/x-www-form-urlencoded" } })
    return r.status
  })()`)
  await page.goto(`${base}/`)
  const signedIn = await page.ev<boolean>(`location.pathname === "/"`)
  if (status !== 200 || !signedIn)
    throw new Error(
      `Anmeldung mit dem Demo-Konto gescheitert (${status}); vorher pnpm --filter spiegel seed:own --demo`
    )
}

/**
 * eine Scheibe aus der Liste mit mindestens 40 Wertungsschüssen, die vorige und nächste hat (Blättern, Vergleich), den
 * Reiter „Lage“ und keine Probe im Kopf; nur gemessene, damit Blättern und Reiter auf Scheiben mit Schüssen bleiben
 */
export async function pickCard(page: Page, base: string): Promise<Card> {
  await page.goto(`${base}/cards?provenance=measured`)
  const hrefs = await page.ev<string[]>(
    `[...new Set($$('a[href^="/cards/c"]').map((a) => a.getAttribute("href")))].slice(0, 12)`
  )
  const idOf = (path: string) => /^\/cards\/([^/?#]+)/.exec(path)?.[1] ?? null
  for (const href of hrefs.slice(1)) {
    await page.goto(`${base}${href}`)
    const fit = await page.ev<boolean>(`$$("#shot-table tr[data-row]").length >= 40 &&
      !!link("Vorige Scheibe") && !!link("Nächste Scheibe") && !!tab("Lage") &&
      !$$("[data-card-header] *").some((el) => txt(el) === "Probe")`)
    if (!fit) continue
    const previous = await page.ev<string | null>(
      `link("Vorige Scheibe")?.getAttribute("href") ?? null`
    )
    const id = idOf(href)
    const previousId = previous ? idOf(previous) : null
    if (id && previousId) return { href, id, previousId }
  }
  throw new Error("keine passende Scheibe mit 40 Schuss in der Liste des Demo-Kontos")
}
