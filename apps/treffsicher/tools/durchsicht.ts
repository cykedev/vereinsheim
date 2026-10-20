// Durchsicht nach drei Ebenen (spiegel-durchsicht) am Telefon (390 × 844): ein Messkonto mit einer Saison (26 Wochen,
// zwei Einheiten je Woche, alle vier Wochen ein Wettkampf, dazu Ziele und Abläufe) in der Dev-Datenbank anlegen, jede
// Hauptseite messen, das Konto danach wieder entfernen. Nicht im Gate (braucht Chrome, den Dev-Postgres und einen Build).
//
//   pnpm --filter treffsicher build && pnpm --filter treffsicher durchsicht
//
// Ergebnis unter reports/durchsicht/treffsicher/ (lokal): je Seite die Messung und ein Bild des ersten Bildschirms.

import { randomBytes } from "node:crypto"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

import bcrypt from "bcryptjs"

import { Browser, type Page } from "@vereinsheim/pruefen/browser"
import { measurePage, measureTable, type PageMeasure } from "@vereinsheim/pruefen/measure"
import { startServer } from "@vereinsheim/pruefen/server"

import { closeTestDb, testDb } from "./pruefen-account"

const OUT_DIR = resolve(import.meta.dirname, "../../../reports/durchsicht/treffsicher")
const PORT = 3011
const BASE = `http://localhost:${PORT}`
const EMAIL = "durchsicht@treffsicher.test"
/** Fachbegriffe, die Leser ohne Erklärung nicht verstehen */
const JARGON =
  "σ|R50|T²|Median|P10|P90|Korrelation|Hochrechnung|Ringe/Schuss|Ø|\\bKW \\d|Trefferkreis|Hotelling|\\b[Ss]ignifikan"

const out = (text = "") => process.stdout.write(`${text}\n`)
const DAY = 24 * 60 * 60 * 1000

/** Ringwert eines Schusses, fest aus Einheit, Serie und Schuss: leichte Form über die Saison */
function shot(session: number, series: number, index: number, decimal: boolean): string {
  const wave = Math.sin(session * 5.1 + series * 2.3 + index * 1.9)
  const value = Math.min(10.9, Math.max(7, 9.4 + wave * 1.1 + session * 0.008))
  return decimal ? value.toFixed(1) : String(Math.floor(value))
}

/** legt das Messkonto mit einer Saison an und gibt Passwort und die Id der neuesten Einheit zurück */
async function prepareAccount(): Promise<{ password: string; newest: string; goal: string }> {
  const db = testDb()
  await removeAccount()
  const password = randomBytes(18).toString("base64url")
  const user = await db.user.create({
    data: {
      email: EMAIL,
      name: "Messkonto Durchsicht",
      role: "USER",
      passwordHash: await bcrypt.hash(password, 12),
    },
  })
  const disciplines = await db.discipline.findMany({
    where: { isSystem: true, isArchived: false },
    orderBy: { name: "asc" },
  })
  const main = disciplines.find((d) => d.scoringType === "TENTH")
  const second = disciplines.find((d) => d.id !== main?.id)
  if (!main || !second) throw new Error("zu wenige Standarddisziplinen; erst die App starten")

  const start = Date.now() - 26 * 7 * DAY
  const sessions: { id: string; date: Date }[] = []
  for (let s = 0; s < 52; s++) {
    const week = Math.floor(s / 2)
    const competition = s % 8 === 7
    const discipline = s % 9 === 4 ? second : main
    const decimal = discipline.scoringType === "TENTH"
    const date = new Date(
      start + week * 7 * DAY + (s % 2 === 0 ? 1 : 4) * DAY + 19 * 60 * 60 * 1000
    )
    const session = await db.trainingSession.create({
      data: {
        userId: user.id,
        type: competition ? "WETTKAMPF" : "TRAINING",
        date,
        location: competition ? "Bezirksstand" : "Schießstand",
        disciplineId: discipline.id,
        trainingGoal: competition ? null : ["Ruhiger Abzug", "Atmung", "Nachhalten"][s % 3],
        ...(s % 10 !== 3 && {
          hitLocationHorizontalMm: Math.abs(Math.sin(s)) * 1.5,
          hitLocationHorizontalDirection: s % 4 < 2 ? "LEFT" : "RIGHT",
          hitLocationVerticalMm: Math.abs(Math.cos(s)) * 1.2,
          hitLocationVerticalDirection: s % 3 === 0 ? "LOW" : "HIGH",
        }),
        series: {
          create: Array.from({ length: discipline.seriesCount }, (_, i) => {
            const shots = Array.from({ length: discipline.shotsPerSeries }, (_, k) =>
              shot(s, i, k, decimal)
            )
            const total = shots.reduce((sum, value) => sum + Number(value), 0)
            return {
              position: i + 1,
              shots,
              scoreTotal: decimal ? total.toFixed(1) : String(total),
              executionQuality: s % 5 === 2 ? null : 1 + ((s + i) % 5),
            }
          }),
        },
        ...(s % 2 === 0 && {
          wellbeing: {
            create: {
              sleep: 40 + ((s * 13) % 50),
              energy: 50 + ((s * 7) % 40),
              stress: 20 + ((s * 11) % 60),
              motivation: 60 + ((s * 3) % 35),
            },
          },
        }),
        ...(s % 3 === 0 && {
          prognosis: {
            create: {
              fitness: 60,
              nutrition: 55,
              technique: 65 + (s % 10),
              tactics: 50,
              mentalStrength: 60 + (s % 8),
              environment: 60,
              equipment: 75,
              expectedScore: decimal ? "385.0" : "375.0",
            },
          },
          feedback: {
            create: {
              fitness: 58,
              nutrition: 60,
              technique: 60 + (s % 12),
              tactics: 55,
              mentalStrength: 62 + (s % 9),
              environment: 62,
              equipment: 74,
            },
          },
        }),
        ...(s % 4 === 1 && {
          reflection: {
            create: {
              observations: "Anschlag stabil, zum Ende hin unruhiger.",
              insight: "Pausen nach jeder Serie einhalten.",
              routineFollowed: s % 8 === 1,
            },
          },
        }),
      },
    })
    sessions.push({ id: session.id, date })
  }

  const goal = await db.goal.create({
    data: {
      userId: user.id,
      title: "Schnitt über 9,6 halten",
      type: "RESULT",
      dateFrom: new Date(start + 13 * 7 * DAY),
      dateTo: new Date(Date.now() + 8 * 7 * DAY),
      sessions: { create: sessions.slice(26).map((s) => ({ sessionId: s.id })) },
    },
  })
  await db.goal.create({
    data: {
      userId: user.id,
      title: "Ablauf vor jedem Schuss",
      type: "PROCESS",
      dateFrom: new Date(start + 20 * 7 * DAY),
      dateTo: new Date(Date.now() + 12 * 7 * DAY),
    },
  })
  await db.goal.create({
    data: {
      userId: user.id,
      title: "Saisonvorbereitung",
      type: "RESULT",
      dateFrom: new Date(start),
      dateTo: new Date(start + 10 * 7 * DAY),
    },
  })
  for (const name of ["Ablauf Training", "Ablauf Wettkampf"])
    await db.shotRoutine.create({
      data: {
        userId: user.id,
        name,
        disciplineId: main.id,
        steps: ["Atmen", "Anschlag prüfen", "Visier", "Abzug", "Nachhalten"].map((title, i) => ({
          order: i + 1,
          title,
        })),
      },
    })
  return { password, newest: sessions.at(-1)!.id, goal: goal.id }
}

/** entfernt das Messkonto samt allem, was daran hängt */
async function removeAccount() {
  const db = testDb()
  const user = await db.user.findUnique({ where: { email: EMAIL } })
  if (!user) return
  await db.trainingSession.deleteMany({ where: { userId: user.id } })
  await db.goal.deleteMany({ where: { userId: user.id } })
  await db.shotRoutine.deleteMany({ where: { userId: user.id } })
  await db.user.delete({ where: { id: user.id } })
}

async function login(page: Page, password: string) {
  await page.viewport(1280, 900)
  await page.goto(`${BASE}/login`, '$("form")')
  const status = await page.ev<number>(`(async () => {
    const { csrfToken } = await (await fetch("/api/auth/csrf")).json()
    const body = new URLSearchParams({ csrfToken, email: ${JSON.stringify(EMAIL)},
      password: ${JSON.stringify(password)}, json: "true", callbackUrl: "/dashboard" })
    const r = await fetch("/api/auth/callback/credentials", { method: "POST", body,
      headers: { "content-type": "application/x-www-form-urlencoded" } })
    return r.status
  })()`)
  if (status !== 200) throw new Error(`Anmeldung des Messkontos gescheitert (${status})`)
}

async function main() {
  rmSync(OUT_DIR, { recursive: true, force: true })
  mkdirSync(OUT_DIR, { recursive: true })
  const { password, newest, goal } = await prepareAccount()
  const server = await startServer({ app: "treffsicher", port: PORT, out })
  const browser = await Browser.launch()
  const rows: ({ page: string } & PageMeasure)[] = []
  try {
    const page = await browser.newPage()
    await login(page, password)
    await page.viewport(390, 844)
    const pages = [
      ["/dashboard", "start"],
      ["/sessions", "tagebuch"],
      [`/sessions/${newest}`, "einheit"],
      ["/statistics", "statistik"],
      ["/goals", "ziele"],
      [`/goals/${goal}`, "ziel"],
      ["/shot-routines", "ablaeufe"],
      ["/disciplines", "disziplinen"],
      ["/profile", "profil"],
      ["/sessions/new", "neue-einheit"],
    ] as const
    for (const [path, name] of pages) {
      await page.goto(`${BASE}${path}`, '$("[data-app-frame]")', { settle: 600 })
      rows.push({
        page: path.replace(/[a-z0-9]{20,}/, "[id]"),
        ...(await measurePage(page, JARGON)),
      })
      writeFileSync(join(OUT_DIR, `${name}.png`), await page.screenshot())
    }
    await page.close()
  } finally {
    await browser.close()
    server.kill()
    await removeAccount()
    await closeTestDb()
  }
  writeFileSync(join(OUT_DIR, "durchsicht.json"), JSON.stringify(rows, null, 2))
  writeFileSync(
    join(OUT_DIR, "durchsicht.md"),
    `# Durchsicht Treffsicher (390 × 844, Saison mit 52 Einheiten)\n\n${measureTable(rows)}\n`
  )
  out(measureTable(rows))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
