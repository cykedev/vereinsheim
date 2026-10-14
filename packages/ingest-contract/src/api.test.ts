import { readdirSync, readFileSync } from "node:fs"

import Ajv2020 from "ajv/dist/2020"
import addFormats from "ajv-formats"
import { describe, expect, it } from "vitest"
import type { ZodType } from "zod"

import { SCHEMA_FILES } from "./jsonSchema"
import { parseApi } from "./parse"
import { sportpassHash } from "./sportpass"
import {
  heartbeatV1,
  normalizePairingCode,
  pairRequestV1,
  PAIRING_CODE_ALPHABET,
  PAIRING_CODE_LENGTH,
  stateResponseV1,
} from "./v1/api"

const load = (path: string): unknown =>
  JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), "utf8"))

/** Beispiel → Schema über den Dateinamen: `heartbeat.json` → `heartbeat-v1.schema.json` */
const schemaOf = (file: string) =>
  `${file.replace(/\.json$/, "").replace(/^error-response-.*$/, "error-response")}-v1.schema.json`

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

describe("Nachladen älterer Scheiben (additiv, P2d)", () => {
  const state = load("examples/api-v1/state-response.json") as Record<string, unknown>
  const heartbeat = load("examples/api-v1/heartbeat.json") as Record<string, unknown>
  const hash = "f80f0364b1fe2c184903848cd481e81e69a4b60e5fbb44f51cc78371525f6168"

  it("Zustand mit und ohne Aufträge; je Auftrag Id und Hash, nie eine Nummer", () => {
    expect(stateResponseV1.safeParse(state).success).toBe(true)
    expect(
      stateResponseV1.safeParse({ ...state, history: [{ id: 7, sportpassHash: hash }] }).success
    ).toBe(true)
    for (const history of [
      [{ id: 7, sportpassHash: "12345678" }],
      [{ id: 0, sportpassHash: hash }],
      [{ id: 7, sportpassHash: hash, sportpassId: "12345678" }],
      Array.from({ length: 1_001 }, (_, i) => ({ id: i + 1, sportpassHash: hash })),
    ])
      expect(stateResponseV1.safeParse({ ...state, history }).success).toBe(false)
  })

  it("Heartbeat mit und ohne erledigte Aufträge; nur Ids ab 1, höchstens 100", () => {
    expect(parseApi(heartbeatV1, heartbeat).ok).toBe(true)
    expect(parseApi(heartbeatV1, { ...heartbeat, historyDone: [7, 9] }).ok).toBe(true)
    for (const historyDone of [[0], [1.5], ["7"], Array.from({ length: 101 }, (_, i) => i + 1)])
      expect(parseApi(heartbeatV1, { ...heartbeat, historyDone }).ok).toBe(false)
  })
})
