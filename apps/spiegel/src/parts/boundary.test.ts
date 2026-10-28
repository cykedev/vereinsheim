import { readdirSync, readFileSync } from "node:fs"
import { join, relative, sep } from "node:path"

import { describe, expect, it } from "vitest"

import { boundaryViolations, importsOf, zoneOf } from "./boundary"

const APP = process.cwd()

function sources(dir: string): { file: string; source: string }[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === "generated" ? [] : sources(path)
    if (!/\.(tsx?|mjs)$/.test(entry.name)) return []
    return [{ file: relative(APP, path).split(sep).join("/"), source: readFileSync(path, "utf8") }]
  })
}

describe("Grenze zwischen Ergebnisteil und Tagebuch", () => {
  it("hält jede Datei der App ein", () => {
    const files = sources(join(APP, "src"))
    expect(files.length).toBeGreaterThan(100)
    expect(boundaryViolations(files)).toEqual([])
  })
})

// Gegenprobe: je Regel eine Quelle mit einem Verstoß, die die Prüfung finden muss
describe("boundaryViolations", () => {
  it("ordnet Dateien ihren Zonen zu", () => {
    expect(zoneOf("src/diary/actions.ts")).toBe("diary")
    expect(zoneOf("src/app/(app)/diary/[id]/page.tsx")).toBe("diary")
    expect(zoneOf("src/parts/lines.ts")).toBe("parts")
    expect(zoneOf("src/instrumentation-node.ts")).toBe("parts")
    expect(zoneOf("src/lib/admin/overview.ts")).toBe("admin")
    expect(zoneOf("src/app/(app)/admin/page.tsx")).toBe("admin")
    expect(zoneOf("src/components/card/CardActions.tsx")).toBe("results")
  })

  it("löst Importe über @ und relativ auf, mehrzeilig und dynamisch", () => {
    const source = [
      `import { a } from "@/diary/queries"`,
      `import {\n  b,\n  c,\n} from "../lib/db/cards"`,
      `const d = await import("./lines")`,
      `import "@/diary/side-effect"`,
      `import { e } from "@vereinsheim/shot-ui/format"`,
    ].join("\n")
    expect(importsOf("src/parts/x.ts", source)).toEqual([
      "src/diary/queries",
      "src/lib/db/cards",
      "src/parts/lines",
      "src/diary/side-effect",
    ])
  })

  it("findet den Ergebnisteil, der das Tagebuch importiert", () => {
    expect(
      boundaryViolations([
        { file: "src/components/card/X.tsx", source: `import { x } from "@/diary/queries"` },
      ])
    ).toHaveLength(1)
    expect(
      boundaryViolations([
        { file: "src/lib/overview.ts", source: `import { x } from "../diary/cards"` },
      ])
    ).toHaveLength(1)
  })

  it("lässt die Nahtstellen beide Teile importieren", () => {
    expect(
      boundaryViolations([
        {
          file: "src/parts/lines.ts",
          source: `import { a } from "@/diary/queries"\nimport { b } from "@/lib/db/reads"`,
        },
      ])
    ).toEqual([])
  })

  it("findet den Admin, der eine Nahtstelle oder das Tagebuch importiert", () => {
    expect(
      boundaryViolations([
        { file: "src/lib/admin/overview.ts", source: `import { a } from "@/parts/lines"` },
      ])
    ).toHaveLength(1)
    expect(
      boundaryViolations([
        { file: "src/app/(app)/admin/page.tsx", source: `import { a } from "@/diary/queries"` },
      ])
    ).toHaveLength(1)
  })

  it("findet das Tagebuch, das am Ergebnisteil vorbei importiert", () => {
    expect(
      boundaryViolations([
        { file: "src/diary/actions.ts", source: `import { a } from "@/lib/db/cards"` },
      ])
    ).toHaveLength(1)
    expect(
      boundaryViolations([
        {
          file: "src/diary/actions.ts",
          source: [
            `import { a } from "@/lib/results-read"`,
            `import { db } from "@/lib/db"`,
            `import type { Prisma } from "@/generated/prisma/client"`,
            `import { ActionRow } from "@/components/card/ActionRow"`,
            `import { b } from "./cards"`,
          ].join("\n"),
        },
      ])
    ).toEqual([])
  })

  it("findet das Tagebuch, das auf ein Modell des Ergebnisteils zugreift", () => {
    expect(
      boundaryViolations([
        {
          file: "src/diary/actions.ts",
          source: `await db.card.update({ where: { id }, data: {} })`,
        },
      ])
    ).toHaveLength(1)
    expect(
      boundaryViolations([{ file: "src/diary/queries.ts", source: `await tx.shot.findMany()` }])
    ).toHaveLength(1)
    expect(
      boundaryViolations([
        { file: "src/diary/queries.ts", source: `await db.diaryEntry.findMany()` },
      ])
    ).toEqual([])
    expect(
      boundaryViolations([
        {
          file: "src/diary/entries.ts",
          source: 'await tx.$queryRaw`SELECT id FROM "Card" WHERE "ownerId" = ${userId}`',
        },
      ])
    ).toHaveLength(1)
    expect(
      boundaryViolations([
        {
          file: "src/diary/entries.ts",
          source: 'await tx.$queryRaw`SELECT id FROM "DiaryEntry" WHERE id = ${id} FOR UPDATE`',
        },
      ])
    ).toEqual([])
  })

  it("lässt Tests des Tagebuchs Scheiben anlegen", () => {
    expect(
      boundaryViolations([
        {
          file: "src/diary/queries.test.ts",
          source: `import { writeEnteredCard } from "@/lib/db/entered"\nawait db.card.update({})`,
        },
      ])
    ).toEqual([])
  })
})
