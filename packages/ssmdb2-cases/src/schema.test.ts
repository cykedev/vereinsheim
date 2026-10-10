import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { COLUMNS, PRIMARY_KEYS, SCHEMA_VERSION, TABLES } from "./schema"

/** Spalten je Tabelle aus dem DDL, in ihrer Reihenfolge: Name → Typ wie `information_schema.COLUMNS.COLUMN_TYPE` */
function columnsFromDdl(sql: string): Record<string, [string, string][]> {
  const tables: Record<string, [string, string][]> = {}
  for (const match of sql.matchAll(/CREATE TABLE `(\w+)` \(([\s\S]*?)\n\) ENGINE/g)) {
    tables[match[1]] = [...match[2].matchAll(/^\s+`(\w+)` (\w+(?:\([^)]*\))?)/gm)].map((c) => [
      c[1],
      c[2],
    ])
  }
  return tables
}

const ddl = readFileSync(new URL("../schema/ssmdb2.sql", import.meta.url), "utf8")

describe("Schema der Ablage (Kopie vom 9. Oktober 2026)", () => {
  it("die Spalten jeder Tabelle in der Reihenfolge und mit dem Typ des DDL", () => {
    const fromDdl = columnsFromDdl(ddl)
    expect(Object.keys(fromDdl).sort()).toEqual(["Scheiben", "Serien", "Treffer", "Version"])
    for (const table of TABLES)
      expect(Object.entries(COLUMNS[table]), table).toEqual(fromDdl[table])
    expect(fromDdl.Version).toEqual([["Versionsnummer", "int(11)"]])
    expect(SCHEMA_VERSION).toBe(9)
  })

  it("Primärschlüssel wie im DDL, Treffer und Serien hängen an Scheiben mit Kaskade", () => {
    for (const table of TABLES) {
      const key = ddl.match(
        new RegExp(`CREATE TABLE \`${table}\`[\\s\\S]*?PRIMARY KEY \\(([^)]*)\\)`)
      )
      expect(key?.[1].replaceAll("`", "").split(","), table).toEqual([...PRIMARY_KEYS[table]])
    }
    expect(ddl.match(/ON DELETE CASCADE ON UPDATE CASCADE/g)).toHaveLength(2)
    // alles NOT NULL: eine Zelle ist nie null
    expect(ddl).not.toMatch(/DEFAULT NULL/)
  })
})
