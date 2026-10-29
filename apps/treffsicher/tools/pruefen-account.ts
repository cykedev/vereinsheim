// Die Konten der Skriptprüfung (`pruefen`) in der Dev-Datenbank, jedes Mal im selben Zustand:
// - `pruefen@treffsicher.test` (Mitglied) mit einem festen Satz erfundener Einheiten (Serien mit Einzelschüssen,
//   Befinden, Prognose und Feedback, Trefferlage); die neueste Einheit hat zwei Anhänge (kleine Bilder im Upload-Verzeichnis),
// - `pruefen-admin@treffsicher.test` (Admin) für die Abläufe unter Admin,
// - `pruefen-ziel@treffsicher.test` (Mitglied, aktiv), das die Prüfung deaktiviert und wieder aktiviert.
// Keines ist nach Spiegel umgezogen; den Abschnitt „Nur lesend“ setzt `pruefen-moved.ts` selbst und hebt ihn auf.
// Nur gegen eine Datenbank auf diesem Rechner. Die Zugangsdaten stehen als PRUEFEN_EMAIL/PRUEFEN_PASSWORD und
// PRUEFEN_ADMIN_EMAIL/PRUEFEN_ADMIN_PASSWORD in apps/treffsicher/.env; fehlt ein Passwort dort, erzeugt das Skript eins
// und schreibt es dazu. `pruefen` ruft `prepareTestAccounts` selbst vor jedem Lauf auf.
//
//   pnpm --filter treffsicher pruefen:konto

import { randomBytes } from "node:crypto"
import { appendFileSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import bcrypt from "bcryptjs"
import { config } from "dotenv"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

import { PrismaClient } from "../src/generated/prisma/client"

const ENV_FILE = join(import.meta.dirname, "..", ".env")
config({ path: ENV_FILE, quiet: true })

export const PRUEFEN_EMAIL = "pruefen@treffsicher.test"
export const PRUEFEN_ADMIN_EMAIL = "pruefen-admin@treffsicher.test"
export const PRUEFEN_TARGET_EMAIL = "pruefen-ziel@treffsicher.test"
/** die Anhänge der neuesten Einheit, in dieser Reihenfolge angelegt */
export const PRUEFEN_ATTACHMENTS = ["scheibe-eins.png", "scheibe-zwei.png"] as const

/** ein Bild mit einem Pixel (PNG) */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
)

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

/** das Passwort aus der .env oder ein neues, das dort samt E-Mail dazukommt */
function password(prefix: "PRUEFEN" | "PRUEFEN_ADMIN", email: string): string {
  const existing = process.env[`${prefix}_PASSWORD`]
  if (existing) return existing
  const created = randomBytes(18).toString("base64url")
  const text = readFileSync(ENV_FILE, "utf8")
  appendFileSync(
    ENV_FILE,
    `${text.endsWith("\n") ? "" : "\n"}${prefix}_EMAIL=${email}\n${prefix}_PASSWORD=${created}\n`
  )
  process.env[`${prefix}_EMAIL`] = email
  process.env[`${prefix}_PASSWORD`] = created
  return created
}

let client: PrismaClient | null = null

/** die Dev-Datenbank; verweigert jede andere */
export function testDb(): PrismaClient {
  const url = process.env.DATABASE_URL
  if (!isLocalDatabase(url))
    throw new Error("DATABASE_URL zeigt nicht auf diesen Rechner; die Prüfkonten gibt es nur lokal")
  client ??= new PrismaClient({ adapter: new PrismaPg(new Pool({ connectionString: url })) })
  return client
}

export async function closeTestDb() {
  await client?.$disconnect()
  client = null
}

function uploadDir(): string {
  const dir = process.env.UPLOAD_DIR
  if (!dir)
    throw new Error(
      "UPLOAD_DIR fehlt in apps/treffsicher/.env; die Anhänge brauchen ein Verzeichnis"
    )
  return dir
}

async function account(
  email: string,
  name: string,
  role: "USER" | "ADMIN",
  plain: string
): Promise<string> {
  const passwordHash = await bcrypt.hash(plain, 12)
  const user = await testDb().user.upsert({
    where: { email },
    create: { email, name, role, passwordHash },
    update: {
      name,
      role,
      passwordHash,
      isActive: true,
      sessionVersion: { increment: 1 },
      movedToSpiegelAt: null,
    },
  })
  return user.id
}

/** legt die Prüfkonten an oder setzt sie zurück; liefert die Id der neuesten Einheit des Mitglieds */
export async function prepareTestAccounts(): Promise<{ newestSessionId: string }> {
  const db = testDb()
  const userId = await account(
    PRUEFEN_EMAIL,
    "Prüfkonto",
    "USER",
    password("PRUEFEN", PRUEFEN_EMAIL)
  )
  await account(
    PRUEFEN_ADMIN_EMAIL,
    "Prüfkonto Admin",
    "ADMIN",
    password("PRUEFEN_ADMIN", PRUEFEN_ADMIN_EMAIL)
  )
  await account(
    PRUEFEN_TARGET_EMAIL,
    "Prüfkonto Ziel",
    "USER",
    randomBytes(18).toString("base64url")
  )

  const discipline = await db.discipline.findFirst({
    where: { isSystem: true, isArchived: false, scoringType: "TENTH" },
    orderBy: { name: "asc" },
  })
  if (!discipline)
    throw new Error("keine Standarddisziplin mit Zehntelwertung; erst die App starten")

  // jedes Mal derselbe Satz: die alten Einheiten weg (Serien, Angaben und Anhänge hängen kaskadierend daran), ihre
  // Dateien im Upload-Verzeichnis ebenso
  const old = await db.attachment.findMany({ where: { session: { userId } } })
  for (const attachment of old) {
    try {
      unlinkSync(join(uploadDir(), attachment.filePath))
    } catch {
      // schon weg
    }
  }
  await db.trainingSession.deleteMany({ where: { userId } })

  const day = 24 * 60 * 60 * 1000
  let newestSessionId = ""
  for (let s = 0; s < 8; s++) {
    // jede zweite Einheit mit Prognose und Feedback, darunter die neueste
    const withMental = s % 2 === 1
    const session = await db.trainingSession.create({
      data: {
        userId,
        type: s === 5 ? "WETTKAMPF" : "TRAINING",
        date: new Date(Date.now() - (8 - s) * 4 * day),
        location: "Schießstand",
        disciplineId: discipline.id,
        trainingGoal: s === 5 ? null : "Ruhiger Abzug",
        // Trefferlage vom Ausdruck, bis auf die erste Einheit: wandert von links tief nach rechts hoch
        ...(s > 0 && {
          hitLocationHorizontalMm: Math.abs(s - 4) * 0.3,
          hitLocationHorizontalDirection: s < 4 ? "LEFT" : "RIGHT",
          hitLocationVerticalMm: Math.abs(s - 3) * 0.2,
          hitLocationVerticalDirection: s < 3 ? "LOW" : "HIGH",
        }),
        series: {
          create: Array.from({ length: discipline.seriesCount }, (_, i) => {
            const shots = Array.from({ length: discipline.shotsPerSeries }, (_, k) => shot(s, i, k))
            const total = shots.reduce((sum, value) => sum + Number(value), 0)
            return {
              position: i + 1,
              shots,
              scoreTotal: total.toFixed(1),
              // die letzte Serie der neuesten Einheit ohne Bewertung: zeigt „–“ mit Grund
              executionQuality:
                s === 7 && i === discipline.seriesCount - 1 ? null : 1 + ((s + i) % 5),
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
    newestSessionId = session.id
  }

  mkdirSync(uploadDir(), { recursive: true })
  for (const name of PRUEFEN_ATTACHMENTS) {
    const filePath = `pruefen-${randomBytes(8).toString("hex")}.png`
    writeFileSync(join(uploadDir(), filePath), PIXEL)
    await db.attachment.create({
      data: { sessionId: newestSessionId, filePath, fileType: "IMAGE", originalName: name },
    })
  }
  return { newestSessionId }
}

/** die Namen der Anhänge einer Einheit, in der Reihenfolge des Anlegens */
export async function attachmentNames(sessionId: string): Promise<string[]> {
  const rows = await testDb().attachment.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
    select: { originalName: true },
  })
  return rows.map((row) => row.originalName)
}

/** ob die Konten aktiv sind, je E-Mail */
export async function activeByEmail(emails: string[]): Promise<Record<string, boolean>> {
  const rows = await testDb().user.findMany({
    where: { email: { in: emails } },
    select: { email: true, isActive: true },
  })
  return Object.fromEntries(rows.map((row) => [row.email, row.isActive]))
}

async function main() {
  try {
    await prepareTestAccounts()
    process.stdout.write(
      `Prüfkonten ${PRUEFEN_EMAIL}, ${PRUEFEN_ADMIN_EMAIL}, ${PRUEFEN_TARGET_EMAIL} mit 8 Einheiten\n`
    )
  } finally {
    await closeTestDb()
  }
}

if (process.argv[1] === import.meta.filename) void main()
