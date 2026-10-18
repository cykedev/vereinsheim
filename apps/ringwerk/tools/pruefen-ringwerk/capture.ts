// Aufnahme im Browser: je Rolle ein eigenes Chrome (eigene Cookies), darin mehrere Tabs nebeneinander. Je Wettbewerb
// jede Unterseite bei 1280 px laden; wohin sie führt, ist die Erreichbarkeit. Bleibt sie auf ihrer Adresse, werden Text
// und Bildschirmfoto bei 1280 und 390 px aufgenommen. PDFs holt Node mit den Cookies der Anmeldung, das öffentliche PDF
// ohne Anmeldung (mit und ohne Passwort).

import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import { Browser, type Page } from "@vereinsheim/pruefen/browser"
import { pdfPages, pdfText } from "@vereinsheim/pruefen/pdf"

import type { BracketRound, Recording } from "./compare"
import { SESSION_COOKIE } from "./echt"
import { normalizePdfText, normalizeStarterNumbers, pageLines } from "./normalize"
import {
  COMPETITION_PAGES,
  GLOBAL_PAGES,
  HEIGHT,
  pdfTargets,
  ROLES,
  WIDTHS,
  type Inventory,
  type Role,
  type Width,
} from "./targets"

/** Schlüssel der Seiten über alle Wettbewerbe in der Ablage */
export const GLOBAL_KEY = "_alle"

export interface Credentials {
  email: string
  password: string
}

/** Anmeldung je Rolle: Konto mit Passwort (Prüfbestand) oder eine fertige Sitzung (echte Daten, `echt.ts`) */
export type SignIn = Credentials | { token: string }

export interface CaptureOptions {
  base: string
  inventory: Inventory
  sessions: Partial<Record<Role, SignIn>>
  publicPassword: string | null
  /** Ordner für Bilder (lokal, nicht im Repository) */
  imageDir: string
  /** nur Wettbewerbe, deren Schlüssel dieses Wort enthält */
  only?: string
  /** Tabs je Rolle */
  tabs?: number
  out: (text: string) => void
}

const READY = '$("main") ?? $("form")'

/** Anmelden wie das Formular (CSRF-Token, Credentials-Callback); danach steht die Sitzung im Cookie */
export async function login(page: Page, base: string, { email, password }: Credentials) {
  await page.viewport(1280, 900)
  await page.goto(`${base}/login`, '$("form")')
  const status = await page.ev<number>(`(async () => {
    const { csrfToken } = await (await fetch("/api/auth/csrf")).json()
    const body = new URLSearchParams({ csrfToken, email: ${JSON.stringify(email)},
      password: ${JSON.stringify(password)}, json: "true", callbackUrl: "/" })
    const r = await fetch("/api/auth/callback/credentials", { method: "POST", body,
      headers: { "content-type": "application/x-www-form-urlencoded" } })
    return r.status
  })()`)
  await page.goto(`${base}/`, READY)
  if (status !== 200 || (await page.ev<string>("location.pathname")) !== "/")
    throw new Error(`Anmeldung als ${email} gescheitert (${status})`)
}

/** Sitzung als Cookie setzen und prüfen, dass sie gilt */
async function applySessionToken(browser: Browser, page: Page, base: string, token: string) {
  await browser.send("Storage.setCookies", {
    cookies: [
      {
        name: SESSION_COOKIE,
        value: token,
        domain: new URL(base).hostname,
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ],
  })
  await page.viewport(1280, 900)
  await page.goto(`${base}/`, READY)
  if ((await page.ev<string>("location.pathname")) !== "/") throw new Error("Sitzung gilt nicht")
}

/** wohin eine Adresse führt: „ok“ oder „→ <Pfad>“ mit `:id` statt der Kennung des Wettbewerbs */
function reached(requested: string, pathname: string, id?: string): string {
  if (pathname === requested) return "ok"
  return `→ ${id ? pathname.split(id).join(":id") : pathname}`
}

/**
 * Bracket aus der Seite: die Zeile mit den Rundennamen, darunter je Runde eine Spalte mit Plätzen. Ein Platz mit
 * Paarung zeigt Name und Siege je Seite, ein Platz ohne Paarung die Vorschau oder „Ausstehend“. Das Bracket bekommt
 * `data-pruefen-bracket` für sein Bildschirmfoto.
 */
const BRACKET = `(() => {
  const LABELS = ["achtelfinale", "viertelfinale", "halbfinale", "finale"]
  const header = $$("main div").find((el) => {
    const texts = [...el.children].map((c) => txt(c).toLowerCase()).filter(Boolean)
    return texts.length >= 2 && texts.every((t) => LABELS.includes(t)) && texts.at(-1) === "finale"
  })
  if (!header) return null
  header.parentElement.setAttribute("data-pruefen-bracket", "")
  const names = [...header.children].map((c) => txt(c)).filter(Boolean)
  const columns = [...(header.nextElementSibling?.children ?? [])].filter((c) => c.tagName === "DIV")
  const leaves = (el) => [...el.querySelectorAll("*")].filter((e) => e.children.length === 0 && txt(e))
  return columns.map((col, i) => ({
    name: names[i] ?? "?",
    pairings: [...col.children].map((slot) => {
      const t = leaves(slot).map(txt)
      if (t.length === 4 && /^\\d+$/.test(t[1]) && /^\\d+$/.test(t[3])) return { a: t[0], b: t[2], stand: t[1] + ":" + t[3] }
      return { a: t[0] ?? "", b: t[1] ?? "", stand: "" }
    }),
  }))
})()`

/**
 * Text unter `main`, sobald die Seite fertig ist: Seiten mit Ladezustand (`loading.tsx`) zeigen erst Platzhalter
 * (`animate-pulse`) und streamen den Inhalt nach. Fertig ist die Seite ohne Platzhalter und mit gleichem Text über drei
 * Lesungen im Abstand von 150 ms.
 */
export async function stableText(page: Page): Promise<string> {
  const read = () =>
    page.ev<{ text: string; loading: boolean }>(
      `({ text: $("main")?.innerText ?? "", loading: !!$("main .animate-pulse") })`
    )
  let last = await read()
  let same = 0
  for (let i = 0; i < 100 && same < 2; i++) {
    await page.wait(150)
    const now = await read()
    same = !now.loading && now.text === last.text ? same + 1 : 0
    last = now
  }
  if (same < 2) throw new Error("Seite wird nicht fertig")
  return last.text
}

interface PageJob {
  base: string
  rec: Recording
  role: Role
  /** Adresse ohne Server */
  path: string
  /** Name der Seite in der Ablage */
  label: string
  id?: string
  imageBase: string
}

async function runJobs(page: Page, jobs: PageJob[], counter: { done: number }) {
  for (let job = jobs.shift(); job; job = jobs.shift()) {
    await page.viewport(1280, HEIGHT[1280])
    await page.goto(`${job.base}${job.path}`, READY)
    // eine Umleitung aus einer Seite mit Ladezustand kommt erst mit dem gestreamten Inhalt
    let text = await stableText(page)
    const { pathname, notFound } = await page.ev<{ pathname: string; notFound: boolean }>(
      `({ pathname: location.pathname, notFound: !!$('meta[name="robots"][content*="noindex"]') })`
    )
    // `notFound()` erkennt Next an seinem eigenen Meta-Tag, nicht am Text der Seite
    job.rec.reach[`${job.label}@${job.role}`] = notFound
      ? "nicht gefunden"
      : reached(job.path, pathname, job.id)
    if (pathname === job.path && !notFound) {
      // erst 1280 px: die Seite ist schon in dieser Breite geladen
      for (const width of [...WIDTHS].reverse() as Width[]) {
        if (width !== 1280) {
          await page.viewport(width, HEIGHT[width])
          await page.goto(`${job.base}${job.path}`, READY)
          text = await stableText(page)
        }
        job.rec.pages[`${job.label}@${job.role}@${width}`] = pageLines(text)
        writeFileSync(
          `${job.imageBase}-${job.label || "start"}-${job.role}-${width}.png`,
          await page.screenshot(true)
        )
        if (width === 1280 && job.role === "ADMIN" && job.label === "playoffs") {
          const bracket = await page.ev<BracketRound[] | null>(BRACKET)
          if (bracket) {
            job.rec.bracket = bracket
            const shot = await page.screenshotOf('$("[data-pruefen-bracket]")')
            if (shot) writeFileSync(`${job.imageBase}-bracket.png`, shot)
          }
        }
      }
    }
    counter.done++
  }
}

async function fetchPdf(
  base: string,
  target: { path: string; anonymous?: boolean; password?: string },
  cookie: string
): Promise<{ status: number; pdf?: Uint8Array }> {
  const headers: Record<string, string> = {}
  if (!target.anonymous) headers.cookie = cookie
  if (target.password)
    headers.authorization = `Basic ${Buffer.from(`:${target.password}`).toString("base64")}`
  const response = await fetch(`${base}${target.path}`, { headers, redirect: "manual" })
  if (response.status !== 200) return { status: response.status }
  return { status: 200, pdf: new Uint8Array(await response.arrayBuffer()) }
}

function savePdf(rec: Recording, name: string, pdf: Uint8Array, imageBase: string, origin: string) {
  const lines = normalizePdfText(pdfText(pdf), origin)
  rec.pdfs[name] = name === "starter-list" ? normalizeStarterNumbers(lines) : lines
  const dir = path.dirname(imageBase)
  pdfPages(pdf, dir, `${path.basename(imageBase)}-pdf-${name}`)
}

/** nimmt alles auf; liefert die Aufnahmen nach Schlüssel (`_alle` für die Seiten über alle Wettbewerbe) */
export async function captureAll(options: CaptureOptions): Promise<Map<string, Recording>> {
  const { base, inventory, out } = options
  mkdirSync(options.imageDir, { recursive: true })
  const competitions = inventory.competitions.filter(
    (c) => !options.only || c.key.includes(options.only.toLowerCase())
  )
  const recordings = new Map<string, Recording>()
  const global: Recording = { name: "Seiten über alle Wettbewerbe", reach: {}, pages: {}, pdfs: {} }
  recordings.set(GLOBAL_KEY, global)
  for (const c of competitions)
    recordings.set(c.key, { name: c.name, reach: {}, pages: {}, pdfs: {} })

  const browsers: Browser[] = []
  try {
    const cookies: Partial<Record<Role, string>> = {}
    const counter = { done: 0 }
    const work: Promise<void>[] = []
    let total = 0
    const roles = ROLES.filter((role) => options.sessions[role])
    for (const role of roles) {
      const browser = await Browser.launch()
      browsers.push(browser)
      const first = await browser.newPage()
      const signIn = options.sessions[role]!
      if ("token" in signIn) await applySessionToken(browser, first, base, signIn.token)
      else await login(first, base, signIn)
      cookies[role] = await first.cookieHeader()

      const jobs: PageJob[] = GLOBAL_PAGES.map((p) => ({
        base,
        rec: global,
        role,
        path: p,
        label: p === "/" ? "dashboard" : p.slice(1),
        imageBase: path.join(options.imageDir, GLOBAL_KEY),
      }))
      for (const c of competitions)
        for (const sub of COMPETITION_PAGES)
          jobs.push({
            base,
            rec: recordings.get(c.key)!,
            role,
            path: `/competitions/${c.id}${sub ? `/${sub}` : ""}`,
            label: sub || "start",
            id: c.id,
            imageBase: path.join(options.imageDir, c.key),
          })
      total += jobs.length
      const pages = [first]
      for (let i = 1; i < (options.tabs ?? 3); i++) pages.push(await browser.newPage())
      for (const page of pages) work.push(runJobs(page, jobs, counter))
    }
    const progress = setInterval(() => out(`  Seiten ${counter.done}/${total}`), 15_000)
    try {
      await Promise.all(work)
    } finally {
      clearInterval(progress)
    }
    out(`  Seiten ${counter.done}/${total}`)

    // PDFs: als ADMIN mit Inhalt, als USER nur, ob es kommt
    let pdfCount = 0
    if (!cookies.ADMIN) throw new Error("ohne Admin keine PDFs")
    const participants = await fetchPdf(base, { path: "/api/participants/pdf" }, cookies.ADMIN)
    global.reach["pdf/participants@ADMIN"] = String(participants.status)
    if (participants.pdf)
      savePdf(
        global,
        "participants",
        participants.pdf,
        path.join(options.imageDir, GLOBAL_KEY),
        base
      )
    if (cookies.USER)
      global.reach["pdf/participants@USER"] = String(
        (await fetchPdf(base, { path: "/api/participants/pdf" }, cookies.USER)).status
      )
    for (const c of competitions) {
      const rec = recordings.get(c.key)!
      const imageBase = path.join(options.imageDir, c.key)
      for (const target of pdfTargets(c, options.publicPassword)) {
        const admin = await fetchPdf(base, target, cookies.ADMIN!)
        rec.reach[`pdf/${target.name}${target.anonymous ? "" : "@ADMIN"}`] = String(admin.status)
        if (admin.pdf) {
          savePdf(rec, target.name, admin.pdf, imageBase, base)
          pdfCount++
        }
        if (!target.anonymous && cookies.USER)
          rec.reach[`pdf/${target.name}@USER`] = String(
            (await fetchPdf(base, target, cookies.USER)).status
          )
      }
    }
    out(`  PDFs ${pdfCount}`)
    return recordings
  } finally {
    for (const browser of browsers) await browser.close()
  }
}
