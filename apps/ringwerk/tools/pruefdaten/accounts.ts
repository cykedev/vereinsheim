// Konten und Passwörter des Prüfbestands: je ein Konto ADMIN, MANAGER und USER, dazu das Passwort für öffentliche
// PDFs mit Passwortschutz. Die Passwörter stehen nur in `apps/ringwerk/.env` (`PRUEF_*`); fehlt eines, erzeugt das
// Werkzeug es zufällig und hängt es dort an. Sie erscheinen nie in der Ausgabe und nie im Repository.

import { randomBytes } from "node:crypto"
import { appendFileSync, existsSync, readFileSync } from "node:fs"

export const PRUEF_ACCOUNTS = [
  {
    role: "ADMIN",
    email: "pruef-admin@example.test",
    name: "Prüfung Admin",
    env: "PRUEF_ADMIN_PASSWORD",
  },
  {
    role: "MANAGER",
    email: "pruef-manager@example.test",
    name: "Prüfung Sportleitung",
    env: "PRUEF_MANAGER_PASSWORD",
  },
  {
    role: "USER",
    email: "pruef-user@example.test",
    name: "Prüfung Mitglied",
    env: "PRUEF_USER_PASSWORD",
  },
] as const

export const PRUEF_PUBLIC_PASSWORD_ENV = "PRUEF_PUBLIC_PASSWORD"

type PasswordKey = (typeof PRUEF_ACCOUNTS)[number]["env"] | typeof PRUEF_PUBLIC_PASSWORD_ENV

export type PruefPasswords = Record<PasswordKey, string>

/** Liest die Passwörter aus `env`; fehlende werden erzeugt und an `envFile` angehängt. */
export function ensurePasswords(
  envFile: string,
  env: Record<string, string | undefined>
): PruefPasswords {
  const keys: PasswordKey[] = [...PRUEF_ACCOUNTS.map((a) => a.env), PRUEF_PUBLIC_PASSWORD_ENV]
  const passwords = {} as PruefPasswords
  const missing: PasswordKey[] = []
  for (const key of keys) {
    const value = env[key]
    if (value) {
      passwords[key] = value
    } else {
      passwords[key] = randomBytes(18).toString("base64url")
      missing.push(key)
    }
  }
  if (missing.length > 0) {
    // Ohne `.env` fehlt auch der Rest der App-Umgebung (etwa ein neuer Worktree ohne Link auf die Hauptcheckout).
    if (!existsSync(envFile))
      throw new Error(`${envFile} fehlt: erst die .env der App anlegen oder verlinken`)
    const current = readFileSync(envFile, "utf8")
    const lines = missing.map((key) => `${key}=${passwords[key]}`)
    const prefix = current.length === 0 || current.endsWith("\n") ? "" : "\n"
    appendFileSync(
      envFile,
      `${prefix}\n# Prüfbestand (pnpm --filter ringwerk pruefdaten), nur lokal\n${lines.join("\n")}\n`
    )
  }
  return passwords
}
