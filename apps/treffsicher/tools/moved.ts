// Merkmal „nach Spiegel umgezogen“ eines Kontos in der Dev-Datenbank setzen oder aufheben ([[adr-033]], Stufe 3). In
// Produktion setzt es die Übernahme in Spiegels CLI per SQL; dieses Werkzeug ist für Dev und die Skriptprüfung. Nur
// gegen eine Datenbank auf diesem Rechner (`testDb`). Die Ausgabe nennt keine Namen.
//
//   pnpm --filter treffsicher moved <E-Mail>           setzt das Merkmal (jetzt)
//   pnpm --filter treffsicher moved --clear <E-Mail>   hebt es auf

import type { PrismaClient } from "../src/generated/prisma/client"
import { closeTestDb, testDb } from "./pruefen-account"

export type MovedChange = "set" | "cleared" | "unchanged" | "missing"

const WORDS: Record<MovedChange, string> = {
  set: "gesetzt",
  cleared: "aufgehoben",
  unchanged: "unverändert",
  missing: "kein Konto mit dieser E-Mail",
}

/** setzt (`on`) oder hebt das Merkmal eines Kontos auf; E-Mails stehen klein geschrieben in der Datenbank */
export async function setMovedByEmail(
  db: Pick<PrismaClient, "user">,
  email: string,
  on: boolean
): Promise<MovedChange> {
  const user = await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, movedToSpiegelAt: true },
  })
  if (!user) return "missing"
  if ((user.movedToSpiegelAt !== null) === on) return "unchanged"
  await db.user.update({
    where: { id: user.id },
    data: { movedToSpiegelAt: on ? new Date() : null },
  })
  return on ? "set" : "cleared"
}

async function main() {
  const args = process.argv.slice(2)
  const email = args.find((arg) => !arg.startsWith("-"))
  // ein vertippter Schalter setzte sonst das Merkmal, statt es aufzuheben
  const unknown = args.filter((arg) => arg.startsWith("-") && arg !== "--clear")
  if (!email || unknown.length > 0) {
    process.stderr.write("Aufruf: pnpm --filter treffsicher moved [--clear] <E-Mail>\n")
    process.exit(1)
  }
  try {
    const change = await setMovedByEmail(testDb(), email, !args.includes("--clear"))
    process.stdout.write(`${WORDS[change]}\n`)
    if (change === "missing") process.exitCode = 1
  } finally {
    await closeTestDb()
  }
}

if (process.argv[1] === import.meta.filename) void main()
