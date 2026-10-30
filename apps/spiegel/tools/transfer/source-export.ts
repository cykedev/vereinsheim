// Treffsicher als Quelle im Container des Betriebs (`tools/transfer-ops.ts`): Den Export des Kontos
// (`treffsicher-account.sql`) und die Besitzer aller Einheiten, Ziele und Abläufe (`treffsicher-owners.sql`) liest
// `vereinsheim transfer` auf dem Host über `psql` und gibt sie dem Container, das Konto per Pipe, die Besitzer als Datei
// mit Kennungen. Der Prozess von Spiegel verbindet sich nie mit der Datenbank von Treffsicher (ADR-002). Ohne
// `markMoved`: Das Merkmal setzt `vereinsheim transfer` nach dem Commit.

import type { TreffsicherSource } from "../../src/parts/transfer/source"
import { normalizeEmail } from "../../src/lib/transfer/accountMatch"

const ID = /^[A-Za-z0-9_-]{1,40}$/

/** Zeilen `id|userId` (Einheit, Ziel oder Ablauf und ihr Konto); leere Zeilen zählen nicht, eine andere wirft */
export function parseOwners(text: string): Map<string, string> {
  const owners = new Map<string, string>()
  text.split("\n").forEach((line, index) => {
    if (!line.trim()) return
    const parts = line.trim().split("|")
    if (parts.length !== 2 || !parts.every((part) => ID.test(part)))
      throw new Error(`owners.txt Zeile ${index + 1}: keine Kennungen`)
    owners.set(parts[0], parts[1])
  })
  return owners
}

/** der Export eines Kontos (leer: kein Konto) und die Besitzer als Quelle der Übernahme */
export function exportTreffsicherSource(input: {
  account: string
  owners: string
}): TreffsicherSource {
  const owners = parseOwners(input.owners)
  return {
    async readAccount(email) {
      if (!input.account.trim()) return null
      const raw = JSON.parse(input.account) as { user?: { email?: unknown } }
      const exported = raw.user?.email
      if (typeof exported !== "string" || normalizeEmail(exported) !== normalizeEmail(email))
        throw new Error("Export passt nicht zur E-Mail")
      return raw
    },
    async sessionOwners(ids) {
      const found = new Map<string, string>()
      for (const id of ids) {
        const owner = owners.get(id)
        if (owner !== undefined) found.set(id, owner)
      }
      return found
    },
  }
}
