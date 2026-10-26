import { describe, expect, it } from "vitest"

import {
  formatMappingCsv,
  matchAccounts,
  normalizeEmail,
  normalizeName,
  parseCsv,
  parseMappingCsv,
  proposeMapping,
  spiegelAccountsFromCsv,
  treffsicherAccountsFromCsv,
  type MappingRow,
  type SpiegelAccount,
  type TreffsicherAccount,
} from "./accountMatch"

// Erfundene Konten, keine echten Namen oder Adressen (ADR-029).
function tis(
  id: string,
  name: string | null,
  email: string,
  extra: Partial<TreffsicherAccount> = {}
) {
  return {
    id,
    name,
    email,
    role: "USER",
    isActive: true,
    createdAt: "2025-01-01T00:00:00.000Z",
    sessions: 0,
    sessionsWithResult: 0,
    lastSession: null,
    favourites: 0,
    ownDisciplines: 0,
    goals: 0,
    routines: 0,
    ...extra,
  } satisfies TreffsicherAccount
}

function sp(id: string, name: string | null, email: string, extra: Partial<SpiegelAccount> = {}) {
  return {
    id,
    name,
    email,
    role: "USER",
    isActive: true,
    mustChangePassword: false,
    createdAt: "2025-01-01T00:00:00.000Z",
    cards: 0,
    lastCard: null,
    consent: null,
    ...extra,
  } satisfies SpiegelAccount
}

describe("normalizeEmail", () => {
  it("trimmt und schreibt klein", () => {
    expect(normalizeEmail("  Erika.Muster@Example.ORG ")).toBe("erika.muster@example.org")
  })
})

describe("normalizeName", () => {
  it("Umlaute, ß, Leerzeichen und Reihenfolge der Wörter", () => {
    expect(normalizeName("  Jürgen   Groß ")).toBe("gross juergen")
    expect(normalizeName("Gross Juergen")).toBe("gross juergen")
    expect(normalizeName("ÖZ Äne")).toBe("aene oez")
  })
  it("leer oder fehlend bleibt leer", () => {
    expect(normalizeName(null)).toBe("")
    expect(normalizeName("   ")).toBe("")
  })
})

describe("matchAccounts", () => {
  it("gleiche E-Mail in anderer Schreibweise und mit Leerzeichen ist ein Paar", () => {
    const result = matchAccounts(
      [tis("t1", "Erika Muster", " Erika.Muster@Example.org")],
      [sp("s1", "Erika Muster", "erika.muster@example.org ")]
    )
    expect(result.both).toHaveLength(1)
    expect(result.both[0].treffsicher.id).toBe("t1")
    expect(result.both[0].spiegel.id).toBe("s1")
    expect(result.both[0].differences).toEqual([])
    expect(result.suspected).toEqual([])
    expect(result.onlyTreffsicher).toEqual([])
    expect(result.onlySpiegel).toEqual([])
  })

  it("ein Paar nennt abweichende Rolle und Aktiv-Status", () => {
    const result = matchAccounts(
      [tis("t1", "A", "a@example.org", { role: "ADMIN", isActive: false })],
      [sp("s1", "A", "a@example.org")]
    )
    expect(result.both[0].differences).toEqual(["role", "active"])
  })

  it("vertauschter Vor- und Nachname ist ein Verdacht über den Namen", () => {
    const result = matchAccounts(
      [tis("t1", "Erika Muster", "erika@example.org")],
      [sp("s1", "Muster Erika", "e.muster@example.net")]
    )
    expect(result.suspected).toHaveLength(1)
    expect(result.suspected[0].candidates).toEqual([
      { spiegel: expect.objectContaining({ id: "s1" }), reasons: ["name"] },
    ])
    expect(result.onlyTreffsicher).toEqual([])
    expect(result.onlySpiegel).toEqual([])
  })

  it("Umlaut gegen „ae“ ist derselbe Name", () => {
    const result = matchAccounts(
      [tis("t1", "Bärbel Kühn", "bk@example.org")],
      [sp("s1", "Baerbel Kuehn", "baerbel@example.net")]
    )
    expect(result.suspected[0].candidates[0].reasons).toEqual(["name"])
  })

  it("Tippfehler im Namen ab sechs Zeichen ist ein ähnlicher Name", () => {
    const result = matchAccounts(
      [tis("t1", "Hannelore Beispiel", "hb@example.org")],
      [sp("s1", "Hannelore Beispeil", "hannelore@example.net")]
    )
    expect(result.suspected[0].candidates[0].reasons).toEqual(["name-similar"])
  })

  it("kurzer Name unter sechs Zeichen gibt keinen Treffer über den Abstand", () => {
    const result = matchAccounts(
      [tis("t1", "Al Bo", "albo@example.org")],
      [sp("s1", "Al Bu", "albu@example.net")]
    )
    expect(result.suspected).toEqual([])
    expect(result.onlyTreffsicher.map((a) => a.id)).toEqual(["t1"])
    expect(result.onlySpiegel.map((a) => a.id)).toEqual(["s1"])
  })

  it("Tippfehler in der Domain bei gleichem Teil vor dem @", () => {
    const result = matchAccounts(
      [tis("t1", null, "max.probe@exmaple.com")],
      [sp("s1", null, "max.probe@example.com")]
    )
    expect(result.suspected[0].candidates[0].reasons).toEqual(["domain-typo"])
  })

  it("gleicher Teil vor dem @ bei anderer Domain", () => {
    const result = matchAccounts(
      [tis("t1", null, "max.probe@example.org")],
      [sp("s1", null, "Max.Probe@verein.example")]
    )
    expect(result.suspected[0].candidates[0].reasons).toEqual(["local-part"])
  })

  it("mehrere Merkmale und mehrere Kandidaten stehen alle da", () => {
    const result = matchAccounts(
      [tis("t1", "Erika Muster", "erika.muster@example.org")],
      [
        sp("s1", "Erika Muster", "erika.muster@verein.example"),
        sp("s2", "Muster Erika", "em@example.net"),
      ]
    )
    expect(result.suspected[0].candidates).toEqual([
      { spiegel: expect.objectContaining({ id: "s1" }), reasons: ["name", "local-part"] },
      { spiegel: expect.objectContaining({ id: "s2" }), reasons: ["name"] },
    ])
  })

  it("ein über die E-Mail vergebenes Spiegel-Konto ist kein zusätzlicher Verdacht", () => {
    const result = matchAccounts(
      [
        tis("t1", "Erika Muster", "erika@example.org"),
        tis("t2", "Erika Muster", "erika.zwei@example.net"),
      ],
      [sp("s1", "Erika Muster", "erika@example.org")]
    )
    expect(result.both.map((p) => p.treffsicher.id)).toEqual(["t1"])
    expect(result.suspected).toEqual([])
    expect(result.onlyTreffsicher.map((a) => a.id)).toEqual(["t2"])
    expect(result.onlySpiegel).toEqual([])
  })

  it("jedes Treffsicher-Konto steht in genau einer Gruppe", () => {
    const treffsicher = [
      tis("t1", "A Eins", "a@example.org"),
      tis("t2", "Bertram Zwei", "b@example.org"),
      tis("t3", "C Drei", "c@example.org"),
    ]
    const result = matchAccounts(treffsicher, [
      sp("s1", "A Eins", "A@example.org"),
      sp("s2", "Zwei Bertram", "bz@example.net"),
      sp("s3", "D Vier", "d@example.org"),
    ])
    const seen = [
      ...result.both.map((p) => p.treffsicher.id),
      ...result.suspected.map((s) => s.treffsicher.id),
      ...result.onlyTreffsicher.map((a) => a.id),
    ].sort()
    expect(seen).toEqual(["t1", "t2", "t3"])
    expect(result.onlySpiegel.map((a) => a.id)).toEqual(["s3"])
  })
})

describe("parseCsv", () => {
  it("liest Kopfzeile, Anführungszeichen, Kommas und CRLF", () => {
    const text = '﻿a,b,c\r\n1,"x, ""y""",\r\n2,,"z"\r\n'
    expect(parseCsv(text)).toEqual([
      { a: "1", b: 'x, "y"', c: "" },
      { a: "2", b: "", c: "z" },
    ])
  })
  it("Zeilenumbruch im Feld", () => {
    expect(parseCsv('a,b\n"eins\nzwei",3\n')).toEqual([{ a: "eins\nzwei", b: "3" }])
  })
  it("falsche Zahl an Feldern ist ein Fehler mit Zeile", () => {
    expect(() => parseCsv("a,b\n1,2,3\n")).toThrow(/Zeile 2/)
  })
})

describe("Konten aus der CSV der Abfragen", () => {
  it("Treffsicher: Wahrheitswerte, Zahlen und leere Felder", () => {
    const csv =
      "id,name,email,role,is_active,created_at,sessions,sessions_with_result,last_session,favourites,own_disciplines,goals,routines\n" +
      "t1,,a@example.org,USER,f,2025-01-01,12,10,2026-10-01,3,1,2,0\n"
    expect(treffsicherAccountsFromCsv(csv)).toEqual([
      tis("t1", null, "a@example.org", {
        isActive: false,
        createdAt: "2025-01-01",
        sessions: 12,
        sessionsWithResult: 10,
        lastSession: "2026-10-01",
        favourites: 3,
        ownDisciplines: 1,
        goals: 2,
      }),
    ])
  })
  it("Spiegel: Zustimmung und letzte Scheibe", () => {
    const csv =
      "id,name,email,role,is_active,must_change_password,created_at,cards,last_card,consent\n" +
      "s1,A B,a@example.org,ADMIN,t,t,2025-01-01,40,2026-10-20,confirmed\n"
    expect(spiegelAccountsFromCsv(csv)).toEqual([
      sp("s1", "A B", "a@example.org", {
        role: "ADMIN",
        mustChangePassword: true,
        createdAt: "2025-01-01",
        cards: 40,
        lastCard: "2026-10-20",
        consent: "confirmed",
      }),
    ])
  })
})

describe("Vorschlag der Zuordnung", () => {
  it("eine Zeile je Treffsicher-Konto, je Kandidat eine bei Verdacht", () => {
    const result = matchAccounts(
      [
        tis("t1", "A Eins", "a@example.org"),
        tis("t2", "Erika Muster", "erika.muster@example.org"),
        tis("t3", "C Drei", "c@example.org"),
      ],
      [
        sp("s1", "A Eins", "A@Example.org"),
        sp("s2", "Erika Muster", "erika.muster@verein.example"),
        sp("s3", "Muster Erika", "em@example.net"),
      ]
    )
    expect(proposeMapping(result)).toEqual([
      { from: "a@example.org", to: "A@Example.org", status: "ok", reason: "" },
      { from: "c@example.org", to: "c@example.org", status: "new", reason: "" },
      {
        from: "erika.muster@example.org",
        to: "erika.muster@verein.example",
        status: "check",
        reason: "gleicher Name, gleicher Teil vor dem @",
      },
      {
        from: "erika.muster@example.org",
        to: "em@example.net",
        status: "check",
        reason: "gleicher Name",
      },
    ])
  })

  it("Hin- und Rückweg, auch mit Kommas und Anführungszeichen in reason", () => {
    const rows: MappingRow[] = [
      { from: "a@example.org", to: "a@example.org", status: "ok", reason: "" },
      {
        from: "b@example.org",
        to: "bb@example.net",
        status: "check",
        reason: 'gleicher Name, "so ähnlich"',
      },
      { from: "c@example.org", to: "c@example.org", status: "new", reason: "Zeile\nzwei" },
    ]
    const text = formatMappingCsv(rows)
    expect(text.split("\n")[0]).toBe("from,to,status,reason")
    expect(text).toContain('"gleicher Name, ""so ähnlich"""')
    expect(parseMappingCsv(text)).toEqual(rows)
  })

  it("liest eine von Hand bearbeitete Datei mit CRLF und Leerzeilen", () => {
    const text = "from,to,status,reason\r\na@example.org, b@example.org ,ok,\r\n\r\n"
    expect(parseMappingCsv(text)).toEqual([
      { from: "a@example.org", to: "b@example.org", status: "ok", reason: "" },
    ])
  })

  it("lehnt falsche Kopfzeile, unbekannten Status und leeres Ziel ab", () => {
    expect(() => parseMappingCsv("von,nach,status,grund\n")).toThrow(/Kopfzeile/)
    expect(() =>
      parseMappingCsv("from,to,status,reason\na@example.org,b@example.org,vielleicht,\n")
    ).toThrow(/Zeile 2.*Status/)
    expect(() => parseMappingCsv("from,to,status,reason\na@example.org,,ok,\n")).toThrow(/Zeile 2/)
  })
})
