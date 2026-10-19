import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { computeChecksum } from "@vereinsheim/ingest-contract/checksum"
import type { SnapshotV1 } from "@vereinsheim/ingest-contract/snapshot"
import { frozenCaseIds, frozenExpected, frozenReadings } from "@vereinsheim/ssmdb2-cases/frozen"

import { createPrismaClient } from "@/lib/db"
import { createTestSite, type TestSite } from "../../../test/fixtures"

import { ingestBatch } from "./ingest"

const db = createPrismaClient()
let site: TestSite
let bridgeId: number
/** der erfundene Sportpass mit Zustimmung in den Fällen (`@vereinsheim/ssmdb2-cases`) */
const MUSTER = BigInt(12345678)

beforeAll(async () => {
  site = await createTestSite(db, "ingest")
  const bridge = await db.bridge.create({
    data: { siteId: site.siteId, name: "Test", tokenHash: `test-${site.siteId}` },
  })
  bridgeId = bridge.id
  await db.sportpassConsent.create({
    data: {
      userId: site.ownerId,
      siteId: site.siteId,
      sportpassId: MUSTER,
      confirmedAt: new Date(),
      // eingespielt: die erste Scheibe ist bestätigt, hier geht es ums Einlesen
      firstCardConfirmedAt: new Date(),
    },
  })
})
afterAll(async () => {
  await site.remove()
  await db.$disconnect()
})

const target = () => ({ bridgeId, siteId: site.siteId, timeZone: "Europe/Berlin" })
/** als käme der Stapel zur Beobachtungszeit an (die Fälle sind teils auf Tage nach heute datiert) */
const ingest = (snapshots: readonly SnapshotV1[]) =>
  ingestBatch(db, target(), snapshots, { nowMs: Date.parse(snapshots.at(-1)!.observedAt) })

/** was die Brücke von einer Scheibe eines Falls schickt: die gesendeten Lesungen */
function sent(caseId: string, scheibenId: number): SnapshotV1[] {
  const card = frozenExpected(caseId).cards.find((c) => c.scheibenId === scheibenId)!
  const readings = frozenReadings(caseId)
  return card.sentReadings.map(
    (n) =>
      readings.find((r) => r.reading === n)!.snapshots.find((s) => s.scheibenId === scheibenId)!
  )
}
/** alle Snapshots eines Falls zu einer Scheibe, auch die nicht gesendeten */
const all = (caseId: string, scheibenId: number) =>
  frozenReadings(caseId).flatMap((r) => r.snapshots.filter((s) => s.scheibenId === scheibenId))

/** derselbe Stand unter einer anderen SportpassID und ScheibenID (eine andere Scheibe eines anderen Schützen) */
function withSportpass(
  snapshot: SnapshotV1,
  sportpass: string,
  scheibenId: number,
  sequence = snapshot.sequence
): SnapshotV1 {
  const data = {
    ...snapshot.data,
    scheiben: {
      ...snapshot.data.scheiben,
      rows: snapshot.data.scheiben.rows.map((row) => ({
        ...row,
        SportpassID: sportpass,
        ScheibenID: String(scheibenId),
      })),
    },
  }
  return { ...snapshot, scheibenId, sequence, data, checksum: computeChecksum(data) }
}

/** die Scheiben einer ScheibenID, je Block eine, nach Block */
const cardsOf = (scheibenId: number, sourceId = site.sourceId) =>
  db.card.findMany({
    where: { sourceId, scheibenId },
    orderBy: [{ cycle: "asc" }, { block: "asc" }],
    include: { currentRevision: { include: { shots: { orderBy: { seq: "asc" } } } } },
  })
/** die jüngste Scheibe einer ScheibenID (höchster Block) */
const cardOf = async (scheibenId: number) => (await cardsOf(scheibenId)).at(-1) ?? null

/** was eine Scheibe zählt wie am Ausdruck: mit Wertung die Wertung, sonst die Probe */
function countedOf(shots: readonly { stellung: number; treffer: number }[]) {
  const match = shots.filter((s) => s.stellung !== 0)
  return match.length
    ? { stellung: 1, numbers: match.map((s) => s.treffer) }
    : { stellung: 0, numbers: shots.map((s) => s.treffer) }
}

describe("ingestBatch", () => {
  it("SF-03: Lesung für Lesung zwei Scheiben des Schützen mit Zustimmung, die Probe und die Wertung wie am Ausdruck", async () => {
    const expected = frozenExpected("SF-03").cards[0]
    const snapshots = sent("SF-03", expected.scheibenId)
    for (const snapshot of snapshots) {
      const [result] = await ingest([snapshot])
      expect(result.outcome).toBe("stored")
    }
    const cards = await cardsOf(expected.scheibenId)
    expect(cards.map((c) => countedOf(c.currentRevision!.shots))).toEqual(expected.blocks)
    expect(cards.map((c) => c.block)).toEqual([0, 1])
    const card = cards.at(-1)
    expect(card?.ownerId).toBe(site.ownerId)
    expect(card?.sportpassId).toBe(MUSTER)
    expect(card?.origin).toBe("raw")
    const shots = card!.currentRevision!.shots
    const counted = shots.some((s) => s.stellung !== 0)
      ? shots.filter((s) => s.stellung !== 0)
      : shots
    expect(counted.map((s) => s.treffer)).toEqual([...expected.counted.numbers])
    // gedeutet und vermerkt
    const raw = await db.rawSnapshot.findMany({
      where: { sourceId: site.sourceId, scheibenId: expected.scheibenId },
    })
    expect(raw.every((r) => r.adapterVersion === "meyton-ssmdb2@10")).toBe(true)
    expect(raw.map((r) => r.block).sort()).toEqual([0, 1, 1])
    // die Rangliste der SSMDB2 ist angelegt und an der Scheibe, noch ohne Art (die ordnet der Admin zu)
    const ranking = await db.ranking.findFirstOrThrow({
      where: { siteId: site.siteId, cards: { some: { id: card!.id } } },
    })
    expect(ranking.name).toBe(snapshots.at(-1)!.data.scheiben.rows[0].Rangliste)
    expect(ranking.kind).toBeNull()
  })

  it("im Stapel deutet der Adapter jeden Stand, geschrieben wird je Block nur der letzte; jeder Stand wird abgelegt", async () => {
    const expected = frozenExpected("SF-21").cards[0]
    const snapshots = sent("SF-21", expected.scheibenId)
    // umgekehrt geliefert: gespeichert wird nach der Folgenummer
    const results = await ingest([...snapshots].reverse())
    expect(results.map((r) => r.index)).toEqual([0, 1])
    expect(results.map((r) => r.outcome)).toEqual(["stored", "stored"])
    const card = await cardOf(expected.scheibenId)
    const newest = await db.rawSnapshot.findFirstOrThrow({
      where: { sourceId: site.sourceId, scheibenId: expected.scheibenId },
      orderBy: { sequence: "desc" },
    })
    expect(card!.currentRevision!.rawSnapshotId).toBe(newest.id)
    // nur der neueste geschrieben: eine Revision, keine Korrektur
    expect(card!.currentRevision!.number).toBe(1)
    const older = await db.rawSnapshot.findFirstOrThrow({
      where: { sourceId: site.sourceId, scheibenId: expected.scheibenId },
      orderBy: { sequence: "asc" },
    })
    expect(older).toMatchObject({ adapterVersion: "meyton-ssmdb2@10", block: 0 })
  })

  it("SF-21: einzeln geliefert ist die Korrektur eine neue Revision mit Merkmal „korrigiert“", async () => {
    const expected = frozenExpected("SF-22").cards[0]
    for (const snapshot of sent("SF-22", expected.scheibenId)) await ingest([snapshot])
    const card = await cardOf(expected.scheibenId)
    expect(card!.currentRevision!.number).toBe(2)
    expect([...card!.flags].sort()).toEqual([...expected.flags].sort())
  })

  it("erste Scheibe: wartet bis zur Bestätigung; ein späterer Stand ändert das nicht", async () => {
    const other = await db.user.create({
      data: { email: `p-${site.siteId}@example.com`, passwordHash: "-" },
    })
    try {
      const consent = await db.sportpassConsent.create({
        data: {
          userId: other.id,
          siteId: site.siteId,
          sportpassId: BigInt(87654323),
          confirmedAt: new Date(),
        },
      })
      const snapshots = sent("SF-02", frozenExpected("SF-02").cards[0].scheibenId)
      const first = withSportpass(snapshots[0], "87654323", snapshots[0].scheibenId + 3)
      await ingest([first])
      const card = await db.card.findFirstOrThrow({
        where: { sourceId: site.sourceId, scheibenId: first.scheibenId },
      })
      expect(card.ownerId).toBe(other.id)
      expect(card.ownerPending).toBe(true)

      // bestätigt: ein späterer Stand derselben Scheibe lässt sie wartend, eine neue wartet nicht
      await db.sportpassConsent.update({
        where: { id: consent.id },
        data: { firstCardConfirmedAt: new Date() },
      })
      const later = withSportpass(
        snapshots.at(-1)!,
        "87654323",
        first.scheibenId,
        first.sequence + 1
      )
      await ingest([later])
      expect((await db.card.findUniqueOrThrow({ where: { id: card.id } })).ownerPending).toBe(true)
      const next = withSportpass(snapshots[0], "87654323", first.scheibenId + 1)
      await ingest([next])
      expect(
        (
          await db.card.findFirstOrThrow({
            where: { sourceId: site.sourceId, scheibenId: next.scheibenId },
          })
        ).ownerPending
      ).toBe(false)
    } finally {
      await db.card.deleteMany({ where: { ownerId: other.id } })
      await db.user.delete({ where: { id: other.id } })
    }
  })

  it("eine abgelehnte Zustimmung zählt nicht, auch mit altem Bestätigt: nichts gespeichert", async () => {
    const other = await db.user.create({
      data: { email: `r-${site.siteId}@example.com`, passwordHash: "-" },
    })
    try {
      await db.sportpassConsent.create({
        data: {
          userId: other.id,
          siteId: site.siteId,
          sportpassId: BigInt(87654322),
          confirmedAt: new Date(),
          rejectedAt: new Date(),
        },
      })
      const own = sent("SF-03", frozenExpected("SF-03").cards[0].scheibenId)[0]
      const scheibenId = own.scheibenId + 2
      const data = {
        ...own.data,
        scheiben: {
          ...own.data.scheiben,
          rows: own.data.scheiben.rows.map((row) => ({
            ...row,
            SportpassID: "87654322",
            ScheibenID: String(scheibenId),
          })),
        },
      }
      const rejected: SnapshotV1 = { ...own, scheibenId, data, checksum: computeChecksum(data) }
      expect(await ingest([rejected])).toEqual([
        { index: 0, scheibenId, outcome: "discarded", reason: "no-consent" },
      ])
      expect(await db.rawSnapshot.count({ where: { sourceId: site.sourceId, scheibenId } })).toBe(0)
    } finally {
      await db.user.delete({ where: { id: other.id } })
    }
  })

  it("ohne Zustimmung, verdeckt oder gesperrt: verworfen und nichts gespeichert", async () => {
    const qr = frozenExpected("SF-13").cards.find((c) => c.bridge === "nur-qr")!
    const noConsent = all("SF-13", qr.scheibenId)
    expect(
      (await ingest(noConsent)).every((r) => r.outcome === "discarded" && r.reason === "no-consent")
    ).toBe(true)

    // eine fremde SportpassID ohne Zustimmung
    const own = sent("SF-03", frozenExpected("SF-03").cards[0].scheibenId)[0]
    const foreignData = {
      ...own.data,
      scheiben: {
        ...own.data.scheiben,
        rows: own.data.scheiben.rows.map((row) => ({ ...row, SportpassID: "87654321" })),
      },
    }
    const foreign: SnapshotV1 = {
      ...own,
      scheibenId: own.scheibenId + 1,
      data: {
        ...foreignData,
        scheiben: {
          ...foreignData.scheiben,
          rows: foreignData.scheiben.rows.map((row) => ({
            ...row,
            ScheibenID: String(own.scheibenId + 1),
          })),
        },
      },
      checksum: "",
    }
    foreign.checksum = computeChecksum(foreign.data)
    expect(await ingest([foreign])).toEqual([
      { index: 0, scheibenId: foreign.scheibenId, outcome: "discarded", reason: "no-consent" },
    ])
    expect(
      await db.rawSnapshot.count({
        where: { sourceId: site.sourceId, scheibenId: foreign.scheibenId },
      })
    ).toBe(0)

    const held = frozenExpected("SF-19").cards.find((c) => c.sentReadings.length > 0)!
    const later = all("SF-19", held.scheibenId).filter(
      (s) => !sent("SF-19", held.scheibenId).some((x) => x.checksum === s.checksum)
    )
    const hidden = await ingest(later)
    expect(hidden.some((r) => r.reason === "hidden")).toBe(true)

    const blocked = frozenExpected("SF-30").cards[0]
    const [snapshot] = sent("SF-30", blocked.scheibenId)
    await db.tombstone.create({
      data: {
        sourceId: site.sourceId,
        scheibenId: blocked.scheibenId,
        startedAt: new Date(snapshot.observedAt),
        reason: "abgelehnt",
      },
    })
    expect(await ingest([snapshot])).toEqual([
      { index: 0, scheibenId: blocked.scheibenId, outcome: "discarded", reason: "blocked" },
    ])

    const stored = await db.rawSnapshot.count({
      where: { sourceId: site.sourceId, scheibenId: { in: [qr.scheibenId, blocked.scheibenId] } },
    })
    expect(stored).toBe(0)
  })

  it("eine neue Epoche wartet auf den Admin (SF-23): nichts angenommen, die Quelle unbestätigt angelegt", async () => {
    const [snapshot] = sent("SF-03", frozenExpected("SF-03").cards[0].scheibenId)
    const results = await ingest([{ ...snapshot, epoch: 2 }])
    expect(results[0].outcome).toBe("epoch-unconfirmed")
    const source = await db.source.findUniqueOrThrow({
      where: { siteId_epoch: { siteId: site.siteId, epoch: 2 } },
    })
    expect(source.confirmedAt).toBeNull()
  })

  it("unbekanntes Schema: Rohdaten abgelegt und markiert, keine Scheibe (SF-25)", async () => {
    const expected = frozenExpected("SF-07").cards[0]
    const [snapshot] = sent("SF-07", expected.scheibenId)
    const data = {
      ...snapshot.data,
      treffer: {
        ...snapshot.data.treffer,
        columns: { ...snapshot.data.treffer.columns, x: "double" },
      },
    }
    const odd: SnapshotV1 = { ...snapshot, data, checksum: computeChecksum(data) }
    expect((await ingest([odd]))[0].outcome).toBe("quarantined")
    const raw = await db.rawSnapshot.findFirstOrThrow({
      where: { sourceId: site.sourceId, scheibenId: expected.scheibenId },
    })
    expect(raw.quarantine).toBe("treffer.x hat einen anderen Typ")
    expect(raw.adapterVersion).toBeNull()
    expect(await cardOf(expected.scheibenId)).toBeNull()
  })

  it("eine andere SportpassID an derselben Scheibe: nichts geschrieben, in Quarantäne (SF-37)", async () => {
    const other = await db.user.create({
      data: { email: `b-${site.siteId}@example.com`, passwordHash: "-" },
    })
    try {
      await db.sportpassConsent.create({
        data: {
          userId: other.id,
          siteId: site.siteId,
          sportpassId: BigInt(87654321),
          confirmedAt: new Date(),
          // eingespielt: die erste Scheibe ist bestätigt, hier geht es ums Einlesen
          firstCardConfirmedAt: new Date(),
        },
      })
      const expected = frozenExpected("SF-02").cards[0]
      const snapshots = sent("SF-02", expected.scheibenId)
      await ingest(snapshots.slice(0, 1))
      const before = await cardOf(expected.scheibenId)
      expect(before?.ownerId).toBe(site.ownerId)
      const last = snapshots.at(-1)!
      const data = {
        ...last.data,
        scheiben: {
          ...last.data.scheiben,
          rows: last.data.scheiben.rows.map((row) => ({ ...row, SportpassID: "87654321" })),
        },
      }
      const moved: SnapshotV1 = {
        ...last,
        sequence: Math.max(last.sequence, snapshots[0].sequence + 1),
        data,
        checksum: computeChecksum(data),
      }
      expect((await ingest([moved]))[0].outcome).toBe("quarantined")
      const after = await cardOf(expected.scheibenId)
      expect(after?.ownerId).toBe(site.ownerId)
      expect(after?.sportpassId).toBe(MUSTER)
      expect(after?.currentRevision?.shots.length).toBe(before?.currentRevision?.shots.length)
    } finally {
      await db.user.delete({ where: { id: other.id } })
    }
  })

  it("eine Scheibe, die sich nicht schreiben lässt, hält die übrigen des Stapels nicht auf; Ungedeutetes wird nachgeholt", async () => {
    const good = frozenExpected("SF-09").cards[0]
    const [ok] = sent("SF-09", good.scheibenId)
    const badSource = frozenExpected("SF-17").cards[0]
    const [base] = sent("SF-17", badSource.scheibenId)
    // zwei Zeilen mit derselben Stellung und Nummer: der Adapter liest sie, `writeRevision` lehnt sie ab
    const rows = base.data.treffer.rows
    const data = {
      ...base.data,
      treffer: { ...base.data.treffer, rows: [...rows, { ...rows[0], x: "17" }] },
    }
    // gelesen in derselben Runde wie `ok`: Fälle verschiedener Tage in einem Stapel wären sonst `past` (SF-79)
    const bad: SnapshotV1 = {
      ...base,
      observedAt: ok.observedAt,
      sequence: ok.sequence - 1,
      data,
      checksum: computeChecksum(data),
    }
    const results = await ingest([bad, ok].sort((a, b) => a.sequence - b.sequence))
    const byId = new Map(results.map((r) => [r.scheibenId, r.outcome]))
    expect(byId.get(bad.scheibenId)).toBe("quarantined")
    expect(byId.get(ok.scheibenId)).toBe("stored")
    expect(await cardOf(ok.scheibenId)).not.toBeNull()
    // derselbe kaputte Stand noch einmal: endgültig, keine Schleife
    expect((await ingest([{ ...bad, sequence: bad.sequence + 1 }]))[0].outcome).toBe("unchanged")

    // ein gespeicherter, aber nie gedeuteter Stand (etwa nach einem Ausfall der Datenbank) wird beim nächsten Mal gedeutet
    await db.card.deleteMany({ where: { sourceId: site.sourceId, scheibenId: ok.scheibenId } })
    await db.rawSnapshot.updateMany({
      where: { sourceId: site.sourceId, scheibenId: ok.scheibenId },
      data: { adapterVersion: null },
    })
    expect((await ingest([{ ...ok, sequence: ok.sequence + 1 }]))[0].outcome).toBe("unchanged")
    expect(await cardOf(ok.scheibenId)).not.toBeNull()
  })

  it("nur das Lebenszeichen bewegt: vermerkt, die Scheibe wieder offen, kein neuer Stand", async () => {
    const expected = frozenExpected("SF-10").cards[0]
    const snapshots = sent("SF-10", expected.scheibenId)
    const last = snapshots.at(-1)!
    for (const snapshot of snapshots) await ingest([snapshot])
    await db.card.updateMany({
      where: { sourceId: site.sourceId, scheibenId: expected.scheibenId },
      data: { state: "resting" },
    })
    const data = {
      ...last.data,
      scheiben: {
        ...last.data.scheiben,
        rows: last.data.scheiben.rows.map((row) => ({
          ...row,
          Zeitstempel: "2026-12-31 23:59:59",
        })),
      },
    }
    const beat: SnapshotV1 = {
      ...last,
      sequence: last.sequence + 9_000,
      observedAt: new Date(Date.parse(last.observedAt) + 9_000).toISOString(),
      data,
      checksum: computeChecksum(data),
    }
    const before = await db.rawSnapshot.count({
      where: { sourceId: site.sourceId, scheibenId: expected.scheibenId },
    })
    expect((await ingest([beat]))[0].outcome).toBe("lifesign")
    const card = await cardOf(expected.scheibenId)
    expect(card?.state).toBe("open")
    expect(card?.lifesignAt?.toISOString()).toBe(beat.observedAt)
    expect(
      await db.rawSnapshot.count({
        where: { sourceId: site.sourceId, scheibenId: expected.scheibenId },
      })
    ).toBe(before)
  })
})

/** derselbe Stand unter einer anderen Disziplin und ScheibenID (eine neue Disziplin der Anlage) */
function withDiscipline(
  snapshot: SnapshotV1,
  discipline: { meytonId: number; name: string },
  scheibenId: number
): SnapshotV1 {
  const data = {
    ...snapshot.data,
    scheiben: {
      ...snapshot.data.scheiben,
      rows: snapshot.data.scheiben.rows.map((row) => ({
        ...row,
        DisziplinID: String(discipline.meytonId),
        Disziplin: discipline.name,
        ScheibenID: String(scheibenId),
      })),
    },
  }
  return { ...snapshot, scheibenId, data, checksum: computeChecksum(data) }
}

describe("ingestBatch mit der Zuordnung des Admins", () => {
  const disciplineOf = (meytonId: number, name: string) =>
    db.discipline.findUnique({
      where: { siteId_meytonId_name: { siteId: site.siteId, meytonId, name } },
    })

  it("die Schusszahl des Admins geht vor, die Scheibe trägt die Version der Disziplin", async () => {
    // SF-07: 10 von 40 Wertungsschüssen, „LG 40 alt“ (`19110040`)
    const expected = frozenExpected("SF-07").cards.find((c) => c.counted.numbers.length === 10)!
    const discipline = { meytonId: 19_110_040, name: "LG 40 Verein" }
    await db.discipline.create({
      data: {
        siteId: site.siteId,
        ...discipline,
        targetId: "lg-10m",
        plannedShots: 10,
        version: 2,
        confirmedAt: new Date(),
      },
    })
    for (const snapshot of sent("SF-07", expected.scheibenId))
      expect((await ingest([withDiscipline(snapshot, discipline, 77_003)]))[0].outcome).toBe(
        "stored"
      )
    const card = await cardOf(77_003)
    expect(card!.flags).not.toContain("unvollstaendig")
    expect(card!.disciplineVersion).toBe(2)
  })

  it("Meytons Spiele kommen ignoriert an, als Vorschlag; die Scheibe ist gespeichert", async () => {
    const [snapshot] = sent("SF-03", frozenExpected("SF-03").cards[0].scheibenId).slice(-1)
    const chess = withDiscipline(snapshot, { meytonId: 18_051_010, name: "LG Schach 6x6" }, 77_001)
    expect((await ingest([chess]))[0].outcome).toBe("stored")
    const discipline = await disciplineOf(18_051_010, "LG Schach 6x6")
    expect(discipline?.ignoredAt).not.toBeNull()
    expect(discipline?.confirmedAt).toBeNull()
    expect(discipline?.targetId).toBeNull()
    const card = await cardOf(77_001)
    expect(card?.disciplineId).toBe(discipline!.id)
    expect(card?.disciplineVersion).toBe(0)
  })

  it("in Meyton umbenannt: die neue Disziplin übernimmt die Zuordnung der alten, eingeordnet ist sie nicht", async () => {
    await db.discipline.create({
      data: {
        siteId: site.siteId,
        meytonId: 10_210_020,
        name: "LP 20 Verein",
        targetId: "lp-10m",
        familyId: site.familyId,
        officialScoring: "rings",
        plannedShots: 7,
        confirmedAt: new Date(),
      },
    })
    const [snapshot] = sent("SF-03", frozenExpected("SF-03").cards[0].scheibenId).slice(-1)
    const renamed = withDiscipline(snapshot, { meytonId: 10_210_020, name: "LP 20 neu" }, 77_002)
    expect((await ingest([renamed]))[0].outcome).toBe("stored")
    const discipline = await disciplineOf(10_210_020, "LP 20 neu")
    expect(discipline).toMatchObject({
      targetId: "lp-10m",
      familyId: site.familyId,
      officialScoring: "rings",
      plannedShots: 7,
      confirmedAt: null,
      ignoredAt: null,
    })
    // gerechnet mit dem Vorschlag des Fachkerns, nicht mit der übernommenen Schusszahl: nachrechnen
    expect((await cardOf(77_002))?.disciplineVersion).toBe(-1)
  })
})

describe("ingestBatch: jeder Block eine Scheibe (SF-03, SF-72)", () => {
  let own: TestSite
  beforeAll(async () => {
    own = await createTestSite(db, "ingest-blocks")
    await db.sportpassConsent.create({
      data: {
        userId: own.ownerId,
        siteId: own.siteId,
        sportpassId: MUSTER,
        confirmedAt: new Date(),
        firstCardConfirmedAt: new Date(),
      },
    })
  })
  afterAll(async () => {
    await own.remove()
  })
  const ingestOwn = async (snapshots: readonly SnapshotV1[]) => {
    const bridge = await db.bridge.findFirst({ where: { siteId: own.siteId } })
    const id =
      bridge?.id ??
      (
        await db.bridge.create({
          data: { siteId: own.siteId, name: "Test", tokenHash: `test-${own.siteId}` },
        })
      ).id
    return ingestBatch(
      db,
      { bridgeId: id, siteId: own.siteId, timeZone: "Europe/Berlin" },
      snapshots,
      { nowMs: Date.parse(snapshots.at(-1)!.observedAt) }
    )
  }

  it("alle Fälle Lesung für Lesung: je ScheibenID so viele Scheiben wie Blöcke, mit den Schüssen wie erwartet", async () => {
    for (const caseId of frozenCaseIds()) {
      for (const expected of frozenExpected(caseId).cards) {
        if (expected.bridge !== "senden") continue
        for (const snapshot of sent(caseId, expected.scheibenId)) await ingestOwn([snapshot])
        const cards = await cardsOf(expected.scheibenId, own.sourceId)
        expect(
          cards.map((c) => countedOf(c.currentRevision!.shots)),
          `${caseId} ${expected.scheibenId}`
        ).toEqual(expected.blocks ?? [expected.counted])
      }
    }
    // jede der gut 50 Lesungen aller Fälle ist ein eigener Stapel mit Transaktion: allein etwa 1,5 s, im Gate neben den
    // Builds aller Apps mehr als das Zeitlimit von 5 s
  }, 20_000)

  it("SF-72: der alte Block geht nicht verloren, wenn sein letzter Stand und der erste neue im selben Stapel kommen", async () => {
    const expected = frozenExpected("SF-72").cards[0]
    const snapshots = sent("SF-72", expected.scheibenId).map((s) =>
      withSportpass(s, "12345678", s.scheibenId + 1)
    )
    await ingestOwn(snapshots)
    const cards = await cardsOf(expected.scheibenId + 1, own.sourceId)
    expect(cards.map((c) => countedOf(c.currentRevision!.shots))).toEqual(expected.blocks)
    // derselbe Stapel noch einmal: nichts Neues
    await ingestOwn(snapshots)
    expect(await cardsOf(expected.scheibenId + 1, own.sourceId)).toHaveLength(2)
    // ein reines Lebenszeichen trifft die Scheibe des jüngsten Blocks
    const last = snapshots.at(-1)!
    const data = {
      ...last.data,
      scheiben: {
        ...last.data.scheiben,
        rows: last.data.scheiben.rows.map((row) => ({
          ...row,
          Zeitstempel: "2026-12-31 23:59:59",
        })),
      },
    }
    const beat: SnapshotV1 = {
      ...last,
      sequence: last.sequence + 9_000,
      observedAt: new Date(Date.parse(last.observedAt) + 9_000).toISOString(),
      data,
      checksum: computeChecksum(data),
    }
    expect((await ingestOwn([beat]))[0].outcome).toBe("lifesign")
    const [first, second] = await cardsOf(expected.scheibenId + 1, own.sourceId)
    expect(second.lifesignAt?.toISOString()).toBe(beat.observedAt)
    expect(first.lifesignAt?.toISOString()).not.toBe(beat.observedAt)
  })

  it("SF-22: eine Korrektur bleibt eine Scheibe mit Merkmal „korrigiert“", async () => {
    const expected = frozenExpected("SF-22").cards[0]
    const snapshots = sent("SF-22", expected.scheibenId).map((s) =>
      withSportpass(s, "12345678", s.scheibenId + 3)
    )
    for (const snapshot of snapshots) await ingestOwn([snapshot])
    const cards = await cardsOf(expected.scheibenId + 3, own.sourceId)
    expect(cards).toHaveLength(1)
    expect(cards[0].flags).toContain("korrigiert")
  })
})
