// Abgleich an der Kopie der echten Daten, ohne Passwort und ohne Schreiben. Das Werkzeug startet den Server mit
// einem eigenen `NEXTAUTH_SECRET` und stellt damit selbst die Sitzung eines vorhandenen Kontos aus (JWT wie nach der
// Anmeldung: Kennung, Rolle, `sessionVersion`). Ringwerk prüft sie wie jede Sitzung gegen die Datenbank. Gewählt wird je
// Rolle das älteste aktive Konto; gibt es keines mit dieser Rolle, fehlt die Rolle in der Aufnahme.
//
// Dass nichts geschrieben wurde, belegt ein Fingerabdruck jeder Tabelle vor und nach der Aufnahme. Ausgenommen ist nur
// `updatedAt` der Disziplinen: Ringwerk gleicht beim Start die Standarddisziplinen ab, wie in Produktion.

import { encode } from "next-auth/jwt"
import { Client } from "pg"

import type { Role } from "./targets"

export interface EchtAccount {
  id: string
  role: Role
  sessionVersion: number
}

/** Name des Cookies, unter dem NextAuth die Sitzung auf `http://` erwartet */
export const SESSION_COOKIE = "next-auth.session-token"

async function readOnly<T>(url: string, work: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    await client.query("BEGIN TRANSACTION READ ONLY")
    const result = await work(client)
    await client.query("ROLLBACK")
    return result
  } finally {
    await client.end()
  }
}

/**
 * Dev-Datenbank aus `.env`: nur auf diesem Rechner, ohne Parameter (`pg` nähme sonst etwa `?host=` statt des Rechners
 * aus der URL), nie die Prüfdatenbank
 */
export function echtDatabaseUrl(env: Record<string, string | undefined>): string {
  const url = env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL fehlt in apps/ringwerk/.env")
  const parsed = new URL(url)
  if (parsed.search !== "") throw new Error("--echt nur mit einer Datenbank-URL ohne Parameter")
  if (!["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname))
    throw new Error(`--echt nur gegen eine Datenbank auf diesem Rechner, nicht ${parsed.hostname}`)
  if (decodeURIComponent(parsed.pathname).endsWith("_pruef"))
    throw new Error("--echt ist für die Dev-Datenbank, nicht die Prüfdatenbank")
  return url
}

/** älteste aktive Konten je Rolle */
export function echtAccounts(url: string): Promise<EchtAccount[]> {
  return readOnly(url, async (client) => {
    const { rows } = await client.query<EchtAccount>(
      `SELECT DISTINCT ON (role) id, role, "sessionVersion"
         FROM "User" WHERE "isActive" AND role IN ('ADMIN', 'USER')
         ORDER BY role, "createdAt", id`
    )
    return rows
  })
}

/** Wert des Sitzungs-Cookies für den Server mit diesem Secret */
export function sessionToken(account: EchtAccount, secret: string): Promise<string> {
  return encode({
    secret,
    token: {
      sub: account.id,
      id: account.id,
      role: account.role,
      sessionVersion: account.sessionVersion,
    },
  })
}

/** Fingerabdruck je Tabelle: Zahl der Zeilen und Prüfsumme über alle Zeilen (Disziplinen ohne `updatedAt`) */
export function tableFingerprint(url: string): Promise<Map<string, string>> {
  return readOnly(url, async (client) => {
    const { rows: tables } = await client.query<{ name: string }>(
      `SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    )
    const prints = new Map<string, string>()
    for (const { name } of tables) {
      const quoted = `"${name.replace(/"/g, '""')}"`
      const row = name === "Discipline" ? `(to_jsonb(t) - 'updatedAt')::text` : `to_jsonb(t)::text`
      const { rows } = await client.query<{ n: string; hash: string | null }>(
        `SELECT count(*)::text AS n, md5(string_agg(${row}, E'\\n' ORDER BY ${row})) AS hash FROM ${quoted} t`
      )
      prints.set(name, `${rows[0].n}:${rows[0].hash ?? "-"}`)
    }
    return prints
  })
}

/** Tabellen, deren Fingerabdruck sich geändert hat */
export function changedTables(before: Map<string, string>, after: Map<string, string>): string[] {
  return [...new Set([...before.keys(), ...after.keys()])].filter(
    (t) => before.get(t) !== after.get(t)
  )
}
