// Was aufgenommen wird: je Wettbewerb seine Seiten und PDFs, dazu die Seiten über alle Wettbewerbe. Die Wettbewerbe und
// die Namen für die Datenfolge kommen aus der Datenbank, in einer Transaktion, die nur lesen darf (`READ ONLY`): Auch
// gegen die Kopie der echten Daten schreibt das Werkzeug nichts.

import { Client } from "pg"

import type { KnownNames } from "./normalize"

export type CompetitionType = "LEAGUE" | "EVENT" | "SEASON"
export type Role = "ADMIN" | "USER"
export const ROLES: readonly Role[] = ["ADMIN", "USER"]
export const WIDTHS = [390, 1280] as const
export type Width = (typeof WIDTHS)[number]
export const HEIGHT: Record<Width, number> = { 390: 844, 1280: 900 }

/** Unterseiten eines Wettbewerbs; erreichbar ist je nach Art und Rolle nur ein Teil, der Rest leitet um */
export const COMPETITION_PAGES = [
  "",
  "schedule",
  "standings",
  "ranking",
  "playoffs",
  "participants",
  "series",
  "audit-log",
] as const
export type CompetitionPage = (typeof COMPETITION_PAGES)[number]

export const GLOBAL_PAGES = ["/", "/competitions", "/participants", "/disciplines"] as const

export interface CompetitionRow {
  id: string
  name: string
  type: CompetitionType
  status: string
  isPublic: boolean
  publicSlug: string | null
  hasPassword: boolean
  /** Schlüssel der Ablage: aus dem Namen, bei gleichem Namen mit Nummer nach Anlage */
  key: string
}

export interface PdfTarget {
  /** Name in der Ablage, etwa `schedule` oder `oeffentlich-mit-passwort` */
  name: string
  path: string
  /** Passwort für den öffentlichen Abruf (Basic-Auth) */
  password?: string
  /** ohne Anmeldung abrufen (öffentliche Route) */
  anonymous?: boolean
}

/** PDF-Routen, die die Oberfläche für diese Art anbietet, und das öffentliche PDF eines veröffentlichten Wettbewerbs */
export function pdfTargets(c: CompetitionRow, publicPassword: string | null): PdfTarget[] {
  const api = `/api/competitions/${c.id}`
  const list: PdfTarget[] =
    c.type === "LEAGUE"
      ? [
          { name: "schedule", path: `${api}/pdf/schedule` },
          { name: "playoffs", path: `${api}/pdf/playoffs` },
        ]
      : c.type === "EVENT"
        ? [
            { name: "ranking", path: `${api}/pdf/ranking` },
            { name: "starter-list", path: `${api}/starter-list/pdf` },
          ]
        : [{ name: "standings", path: `${api}/pdf/standings` }]
  if (c.isPublic && c.publicSlug) {
    const path = `/api/public/c/${c.publicSlug}/pdf`
    list.push({ name: "oeffentlich", path, anonymous: true })
    if (c.hasPassword && publicPassword)
      list.push({
        name: "oeffentlich-mit-passwort",
        path,
        anonymous: true,
        password: publicPassword,
      })
  }
  return list
}

export const slugKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90)

/** Eindeutige Schlüssel in der Reihenfolge der Anlage */
export function withKeys(rows: Omit<CompetitionRow, "key">[]): CompetitionRow[] {
  const seen = new Map<string, number>()
  return rows.map((row) => {
    const base = slugKey(row.name) || "wettbewerb"
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return { ...row, key: n === 1 ? base : `${base}-${n}` }
  })
}

export interface Inventory {
  database: string
  competitions: CompetitionRow[]
  names: KnownNames
}

/** Liest Wettbewerbe und Namen in einer Transaktion, die nur lesen darf */
export async function readInventory(url: string): Promise<Inventory> {
  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    await client.query("BEGIN TRANSACTION READ ONLY")
    const [
      { rows: db },
      { rows: comps },
      { rows: people },
      { rows: users },
      { rows: disciplines },
    ] = await Promise.all([
      client.query<{ name: string }>("SELECT current_database() AS name"),
      client.query<Omit<CompetitionRow, "key">>(
        `SELECT id, name, type, status, "isPublic", "publicSlug",
                  ("publicPasswordHash" IS NOT NULL) AS "hasPassword"
             FROM "Competition" ORDER BY "createdAt", id`
      ),
      client.query<{ firstName: string; lastName: string }>(
        `SELECT "firstName", "lastName" FROM "Participant"`
      ),
      client.query<{ name: string | null }>(`SELECT name FROM "User"`),
      client.query<{ name: string }>(`SELECT name FROM "Discipline"`),
    ])
    await client.query("ROLLBACK")
    return {
      database: db[0].name,
      competitions: withKeys(comps),
      names: {
        people,
        other: [
          ...comps.map((c) => c.name),
          ...users.flatMap((u) => (u.name ? [u.name] : [])),
          ...disciplines.map((d) => d.name),
        ],
      },
    }
  } finally {
    await client.end()
  }
}
