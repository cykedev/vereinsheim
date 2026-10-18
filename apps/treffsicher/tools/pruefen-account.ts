// Das Konto der Skriptprüfung (`pruefen`) in der Dev-Datenbank: legt `pruefen@treffsicher.test` an oder setzt sein
// Passwort neu und gibt ihm einen festen Satz erfundener Einheiten (Serien mit Einzelschüssen, Befinden, Prognose und
// Feedback). Nur gegen eine Datenbank auf diesem Rechner. Die Zugangsdaten stehen als PRUEFEN_EMAIL/PRUEFEN_PASSWORD
// in apps/treffsicher/.env; fehlt das Passwort dort, erzeugt das Skript eins und schreibt es dazu.
//
//   pnpm --filter treffsicher pruefen:konto

import { randomBytes } from "node:crypto"
import { appendFileSync, readFileSync } from "node:fs"
import { join } from "node:path"

import bcrypt from "bcryptjs"
import { config } from "dotenv"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

import { PrismaClient } from "../src/generated/prisma/client"

const ENV_FILE = join(import.meta.dirname, "..", ".env")
config({ path: ENV_FILE, quiet: true })

export const PRUEFEN_EMAIL = "pruefen@treffsicher.test"

/** die Datenbank liegt auf diesem Rechner; sonst bricht das Skript ab, bevor es etwas schreibt */
export function isLocalDatabase(url: string | undefined): boolean {
  if (!url) return false
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)
  } catch {
    return false
  }
}

/** Ringwert eines Schusses, fest aus Einheit, Serie und Schuss (gleiche Daten bei jedem Lauf) */
function shot(session: number, series: number, index: number): string {
  const wave = Math.sin(session * 7.3 + series * 3.1 + index * 1.7)
  return (9.6 + wave * 0.9 + session * 0.04).toFixed(1)
}

/** das Passwort aus der .env oder ein neues, das dort dazukommt */
function password(): string {
  const existing = process.env.PRUEFEN_PASSWORD
  if (existing) return existing
  const created = randomBytes(18).toString("base64url")
  const text = readFileSync(ENV_FILE, "utf8")
  appendFileSync(
    ENV_FILE,
    `${text.endsWith("\n") ? "" : "\n"}PRUEFEN_EMAIL=${PRUEFEN_EMAIL}\nPRUEFEN_PASSWORD=${created}\n`
  )
  return created
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!isLocalDatabase(url))
    throw new Error("DATABASE_URL zeigt nicht auf diesen Rechner; das Prüfkonto gibt es nur lokal")
  const db = new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: url })) })
  try {
    const passwordHash = await bcrypt.hash(password(), 12)
    const user = await db.user.upsert({
      where: { email: PRUEFEN_EMAIL },
      create: { email: PRUEFEN_EMAIL, name: "Prüfkonto", passwordHash },
      update: { passwordHash, isActive: true, role: "USER", sessionVersion: { increment: 1 } },
    })
    const discipline = await db.discipline.findFirst({
      where: { isSystem: true, isArchived: false, scoringType: "TENTH" },
      orderBy: { name: "asc" },
    })
    if (!discipline)
      throw new Error("keine Standarddisziplin mit Zehntelwertung; erst die App starten")

    // jedes Mal derselbe Satz: die alten Einheiten des Prüfkontos weg (Serien und Angaben hängen kaskadierend daran)
    await db.trainingSession.deleteMany({ where: { userId: user.id } })
    const day = 24 * 60 * 60 * 1000
    for (let s = 0; s < 8; s++) {
      const withMental = s % 2 === 0
      await db.trainingSession.create({
        data: {
          userId: user.id,
          type: s === 5 ? "WETTKAMPF" : "TRAINING",
          date: new Date(Date.now() - (8 - s) * 4 * day),
          location: "Schießstand",
          disciplineId: discipline.id,
          trainingGoal: s === 5 ? null : "Ruhiger Abzug",
          series: {
            create: Array.from({ length: discipline.seriesCount }, (_, i) => {
              const shots = Array.from({ length: discipline.shotsPerSeries }, (_, k) =>
                shot(s, i, k)
              )
              const total = shots.reduce((sum, value) => sum + Number(value), 0)
              return {
                position: i + 1,
                shots,
                scoreTotal: total.toFixed(1),
                executionQuality: 1 + ((s + i) % 5),
              }
            }),
          },
          wellbeing: {
            create: { sleep: 40 + s * 7, energy: 70 - s * 3, stress: 30 + s * 4, motivation: 80 },
          },
          ...(withMental && {
            prognosis: {
              create: {
                fitness: 60,
                nutrition: 55,
                technique: 70,
                tactics: 50,
                mentalStrength: 65,
                environment: 60,
                equipment: 75,
                expectedScore: "380.0",
              },
            },
            feedback: {
              create: {
                fitness: 55,
                nutrition: 60,
                technique: 62,
                tactics: 58,
                mentalStrength: 70,
                environment: 60,
                equipment: 75,
              },
            },
          }),
        },
      })
    }
    process.stdout.write(`Prüfkonto ${PRUEFEN_EMAIL} mit 8 Einheiten (${discipline.name})\n`)
  } finally {
    await db.$disconnect()
  }
}

if (process.argv[1] === import.meta.filename) void main()
