// Treffsicher in der lokalen Dev-Datenbank als Quelle der Übernahme: `psql` im Dev-Container (ADR-002: keine
// Verbindung der App zur fremden Datenbank). Werte gehen nur als `psql`-Variablen (`-v name=wert`, im SQL `:'name'`),
// nie in den Text der Abfrage.

import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"

import type { TreffsicherSource } from "../../src/parts/transfer/source"

const ROOT = join(__dirname, "../../../..")

/** eine Abfrage an Treffsicher über stdin, mit Variablen; die Ausgabe ohne Rand (`-At`) */
function psql(sql: string, vars: Record<string, string>): string {
  return execFileSync(
    "docker",
    [
      "compose",
      "-f",
      join(ROOT, "docker-compose.dev.yml"),
      "exec",
      "-T",
      "db",
      "psql",
      "-U",
      "postgres",
      "-d",
      "treffsicher",
      "-At",
      "-v",
      "ON_ERROR_STOP=1",
      ...Object.entries(vars).flatMap(([name, value]) => ["-v", `${name}=${value}`]),
    ],
    { input: sql, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }
  ).trim()
}

/** die Kennungen als ein Wert `{a,b}`; sie sind cuids (`[A-Za-z0-9_-]`, geprüft vom Schema), brauchen also kein Zitat */
function idArray(ids: readonly string[]): string {
  if (ids.some((id) => !/^[A-Za-z0-9_-]+$/.test(id))) throw new Error("ungültige Kennung")
  return `{${ids.join(",")}}`
}

const OWNERS = `
select id, "userId" from "TrainingSession" where id = any(:'ids'::text[])
union all select id, "userId" from "Goal" where id = any(:'ids'::text[])
union all select id, "userId" from "ShotRoutine" where id = any(:'ids'::text[]);
`

const MARK = `
update "User" set "movedToSpiegelAt" = (:'at'::timestamptz at time zone 'UTC') where id = :'id';
`

export const devTreffsicherSource: TreffsicherSource = {
  async readAccount(email) {
    const out = psql(readFileSync(join(__dirname, "treffsicher-account.sql"), "utf8"), {
      from: email,
    })
    return out ? (JSON.parse(out) as unknown) : null
  },
  async sessionOwners(ids) {
    const owners = new Map<string, string>()
    if (!ids.length) return owners
    const out = psql(OWNERS, { ids: idArray(ids) })
    for (const line of out ? out.split("\n") : []) {
      const [id, userId] = line.split("|")
      owners.set(id, userId)
    }
    return owners
  },
  async markMoved(userId, at) {
    psql(MARK, { id: userId, at: at.toISOString() })
  },
}
