import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

let getDisplayTimeZone: (typeof import("./dateTime"))["getDisplayTimeZone"]
let isValidIanaTimeZone: (typeof import("./dateTime"))["isValidIanaTimeZone"]

const originalDisplayTimeZone = process.env.DISPLAY_TIME_ZONE

beforeAll(async () => {
  ;({ getDisplayTimeZone, isValidIanaTimeZone } = await import("./dateTime"))
})

afterEach(() => {
  if (originalDisplayTimeZone === undefined) {
    delete process.env.DISPLAY_TIME_ZONE
  } else {
    process.env.DISPLAY_TIME_ZONE = originalDisplayTimeZone
  }
})

describe("getDisplayTimeZone", () => {
  it("verwendet den Default wenn keine Variable gesetzt ist", () => {
    delete process.env.DISPLAY_TIME_ZONE

    expect(getDisplayTimeZone()).toBe("Europe/Berlin")
  })

  it("verwendet die konfigurierte gueltige IANA-Zeitzone", () => {
    process.env.DISPLAY_TIME_ZONE = "America/New_York"

    expect(getDisplayTimeZone()).toBe("America/New_York")
  })

  it("faellt bei ungueltiger Zeitzone auf den Default zurueck", () => {
    process.env.DISPLAY_TIME_ZONE = "invalid/time-zone"

    expect(getDisplayTimeZone()).toBe("Europe/Berlin")
  })

  it("faellt bei leerem Wert auf den Default zurueck", () => {
    process.env.DISPLAY_TIME_ZONE = "   "

    expect(getDisplayTimeZone()).toBe("Europe/Berlin")
  })
})

describe("isValidIanaTimeZone", () => {
  it("kennt gueltige IANA-Zeitzonen", () => {
    expect(isValidIanaTimeZone("Europe/Berlin")).toBe(true)
    expect(isValidIanaTimeZone("UTC")).toBe(true)
  })

  it("lehnt unbekannte Zeitzonen ab", () => {
    expect(isValidIanaTimeZone("invalid/time-zone")).toBe(false)
    expect(isValidIanaTimeZone("Berlin")).toBe(false)
  })
})
