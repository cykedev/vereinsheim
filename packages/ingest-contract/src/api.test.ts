import { readdirSync, readFileSync } from "node:fs"

import Ajv2020 from "ajv/dist/2020"
import addFormats from "ajv-formats"
import { describe, expect, it } from "vitest"
import type { ZodType } from "zod"

import { SCHEMA_FILES } from "./jsonSchema"
import { parseApi } from "./parse"
import { sportpassHash } from "./sportpass"
import {
  BRIDGE_CLOCK_TOLERANCE_MS,
  BRIDGE_STATUS,
  heartbeatV1,
  normalizePairingCode,
  pairRequestV1,
  PAIRING_CODE_ALPHABET,
  PAIRING_CODE_LENGTH,
  RETRY_OUTCOMES,
  SNAPSHOT_OUTCOMES,
  snapshotsResponseV1,
  stateResponseV1,
} from "./v1/api"

const load = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"))

/**
 * Beispiel → Schema über den Dateinamen: `heartbeat.json` → `heartbeat-v1.schema.json`; was nach dem ersten Punkt steht,
 * ist eine Spielart desselben Schemas (`heartbeat.clock.json`)
 */
const schemaOf = (file: string) =>
  `${file.split(".")[0].replace(/^error-response-.*$/, "error-response")}-v1.schema.json`

const examples = readdirSync(new URL("../examples/api-v1/", import.meta.url)).map((file) => ({
  file,
  schema: schemaOf(file) as keyof typeof SCHEMA_FILES,
  value: load(`examples/api-v1/${file}`),
}))

describe("eingefrorene Beispiele der API v1 (nur ergänzen, SF-69)", () => {
  const ajv = new Ajv2020({ strict: true, allErrors: true })
  addFormats(ajv)

  it("zu jedem Schema der API mindestens ein Beispiel", () => {
    const api = Object.keys(SCHEMA_FILES).filter((name) => !name.startsWith("snapshot-"))
    for (const name of api) expect(examples.map((e) => e.schema)).toContain(name)
  })

  it.each(examples.map((e) => [e.file, e] as const))(
    "%s gilt in Zod und im JSON-Schema",
    (_f, e) => {
      const zod = SCHEMA_FILES[e.schema] as ZodType
      expect(zod.safeParse(e.value).success).toBe(true)
      const validate = ajv.compile(load(`schema/${e.schema}`) as object)
      expect(validate(e.value), JSON.stringify(validate.errors)).toBe(true)
    }
  )
})

describe("parseApi", () => {
  const heartbeat = load("examples/api-v1/heartbeat.json") as Record<string, unknown>

  it("nimmt das Beispiel an", () => {
    expect(parseApi(heartbeatV1, heartbeat).ok).toBe(true)
  })

  it("lehnt fremde Felder, andere Versionen und __proto__ ab, ohne Inhalt im Fehler", () => {
    const extra = parseApi(heartbeatV1, { ...heartbeat, Nachname: "Mustermann" })
    expect(extra).toEqual({ ok: false, issues: [{ path: "", code: "unrecognized_keys" }] })
    expect(parseApi(heartbeatV1, { ...heartbeat, contractVersion: 2 })).toEqual({
      ok: false,
      issues: [{ path: "contractVersion", code: "unsupported-contract-version" }],
    })
    const proto = JSON.parse(
      `{"contractVersion":1,"sourceFingerprint":{"__proto__":{"x":1}}}`
    ) as unknown
    expect(parseApi(heartbeatV1, proto)).toEqual({
      ok: false,
      issues: [{ path: "sourceFingerprint", code: "forbidden-key" }],
    })
    const wrong = parseApi(pairRequestV1, {
      contractVersion: 1,
      code: "x",
      name: "Mustermann".repeat(10),
      bridgeVersion: "1",
    })
    expect(wrong.ok).toBe(false)
    expect(JSON.stringify(wrong)).not.toContain("Mustermann")
  })
})

describe("Kopplungscode", () => {
  it("zehn Zeichen aus Crockfords Base32, Trenner und Kleinschreibung egal", () => {
    expect(PAIRING_CODE_ALPHABET).toHaveLength(32)
    expect(PAIRING_CODE_ALPHABET).not.toMatch(/[ILOU]/)
    expect(normalizePairingCode("7kq4m-9xb2t")).toBe("7KQ4M9XB2T")
    expect(normalizePairingCode(" 7KQ4M 9XB2T ")).toBe("7KQ4M9XB2T")
    expect(normalizePairingCode("7KQ4M-9XB2")).toBeNull()
    expect(normalizePairingCode("7KQ4M-9XB2I")).toBeNull()
    expect(PAIRING_CODE_LENGTH).toBe(10)
  })
})

describe("sportpassHash (Testvektoren aus Python)", () => {
  const vectors = load("test-vectors/sportpass-v1.json") as {
    salt: string
    vectors: { input: string; decimal: string; hash: string }[]
  }

  it.each(vectors.vectors.map((v) => [v.input, v] as const))("%s", (_i, v) => {
    expect(sportpassHash(vectors.salt, v.input)).toBe(v.hash)
    expect(sportpassHash(vectors.salt, BigInt(v.decimal))).toBe(v.hash)
  })

  it("keine Null und keine negativen Nummern", () => {
    expect(() => sportpassHash(vectors.salt, BigInt(0))).toThrow(RangeError)
    expect(() => sportpassHash(vectors.salt, -5)).toThrow(RangeError)
  })
})

describe("Nachladen älterer Scheiben (additiv)", () => {
  const state = load("examples/api-v1/state-response.json") as Record<string, unknown>
  const heartbeat = load("examples/api-v1/heartbeat.json") as Record<string, unknown>
  const hash = "f80f0364b1fe2c184903848cd481e81e69a4b60e5fbb44f51cc78371525f6168"
  const since = "2026-10-14T09:00:00.000Z"

  it("Zustand mit und ohne Aufträge; je Auftrag Id und Hash, nie eine Nummer", () => {
    expect(stateResponseV1.safeParse(state).success).toBe(true)
    expect(
      stateResponseV1.safeParse({ ...state, history: [{ id: 7, since, sportpassHash: hash }] })
        .success
    ).toBe(true)
    for (const history of [
      [{ id: 7, since, sportpassHash: "12345678" }],
      [{ id: 0, since, sportpassHash: hash }],
      [{ id: 7, sportpassHash: hash }],
      [{ id: 7, since: "gestern", sportpassHash: hash }],
      [{ id: 7, since, sportpassHash: hash, sportpassId: "12345678" }],
      Array.from({ length: 1_001 }, (_, i) => ({ id: i + 1, since, sportpassHash: hash })),
    ])
      expect(stateResponseV1.safeParse({ ...state, history }).success).toBe(false)
  })

  it("Heartbeat mit und ohne erledigte Aufträge; je Id und `since`, höchstens 100", () => {
    expect(parseApi(heartbeatV1, heartbeat).ok).toBe(true)
    expect(
      parseApi(heartbeatV1, {
        ...heartbeat,
        historyDone: [
          { id: 7, since },
          { id: 9, since },
        ],
      }).ok
    ).toBe(true)
    for (const historyDone of [
      [7],
      [{ id: 0, since }],
      [{ id: 7 }],
      [{ id: 7, since, extra: 1 }],
      Array.from({ length: 101 }, (_, i) => ({ id: i + 1, since })),
    ])
      expect(parseApi(heartbeatV1, { ...heartbeat, historyDone }).ok).toBe(false)
  })
})

describe("Uhr der Brücke (additiv, SF-79)", () => {
  /** von Hand aus der Spezifikation; die Brücke (Go) prüft sich an derselben Datei */
  const vector = load("test-vectors/api-v1.json") as {
    snapshotOutcomes: Record<string, "final" | "retry">
    bridgeStatus: string[]
    bridgeClockToleranceMs: number
  }
  const heartbeat = load("examples/api-v1/heartbeat.json") as Record<string, unknown>

  it("Ergebnisse, Status und Schwelle wie im Vektor", () => {
    expect([...SNAPSHOT_OUTCOMES].sort()).toEqual(Object.keys(vector.snapshotOutcomes).sort())
    expect([...RETRY_OUTCOMES].sort()).toEqual(
      Object.entries(vector.snapshotOutcomes)
        .filter(([, kind]) => kind === "retry")
        .map(([outcome]) => outcome)
        .sort()
    )
    expect([...BRIDGE_STATUS].sort()).toEqual([...vector.bridgeStatus].sort())
    expect(BRIDGE_CLOCK_TOLERANCE_MS).toBe(vector.bridgeClockToleranceMs)
  })

  it("Heartbeat mit `clock`, Antwort mit `past`; ein unbekannter Status fällt weiter", () => {
    expect(parseApi(heartbeatV1, { ...heartbeat, status: "clock" }).ok).toBe(true)
    expect(parseApi(heartbeatV1, { ...heartbeat, status: "uhr" }).ok).toBe(false)
    expect(
      snapshotsResponseV1.safeParse({ results: [{ index: 0, scheibenId: 1, outcome: "past" }] })
        .success
    ).toBe(true)
  })
})
