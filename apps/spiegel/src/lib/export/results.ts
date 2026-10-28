// Export des Ergebnisteils ([[spiegel-privacy]] „Export und Löschen auf Knopfdruck“): alle eigenen Scheiben samt
// Papierkorb mit ihrer aktuellen Revision, Angaben der Ausdrucke und Belege (ohne Dateien), Zustimmungen per Sportpass,
// benannte Zeiträume und Wertungen der Familien. Als Folge von JSON-Stücken, damit auch ein großes Konto nicht auf
// einmal im Speicher liegt.

import type { Db } from "@/lib/db"

/** so viele Scheiben je Abfrage */
export const EXPORT_BATCH = 200

/** Zahlen aus `BigInt` als Text, Zeiten als ISO-Text */
export function toJson(value: unknown): string {
  return JSON.stringify(value, (_, v: unknown) => (typeof v === "bigint" ? v.toString() : v))
}

const CARD_SELECT = {
  id: true,
  startedAt: true,
  endedAt: true,
  timeUnknown: true,
  kind: true,
  kindChoice: true,
  scoringChoice: true,
  origin: true,
  place: true,
  stand: true,
  flags: true,
  complete: true,
  state: true,
  sportpassId: true,
  deletedAt: true,
  sharedAt: true,
  importKey: true,
  discipline: { select: { name: true, meytonId: true } },
  family: { select: { slug: true, name: true } },
  currentRevision: {
    select: {
      number: true,
      reason: true,
      totalRings: true,
      totalDecimalTenths: true,
      totalShots: true,
      centerXUm: true,
      centerYUm: true,
      centerShots: true,
      seriesSums: {
        orderBy: { series: "asc" },
        select: { series: true, shots: true, rings: true, decimalTenths: true },
      },
      shots: {
        orderBy: { seq: "asc" },
        select: {
          seq: true,
          stellung: true,
          treffer: true,
          series: true,
          xUm: true,
          yUm: true,
          ring: true,
          decimalTenths: true,
          distanceTenthsUm: true,
          innerTen: true,
          displayMode: true,
          firedAt: true,
          flags: true,
        },
      },
    },
  },
  printouts: {
    select: { footerId: true, printedAt: true, fileName: true, size: true, storedAt: true },
  },
  evidence: { select: { contentType: true, size: true, storedAt: true } },
} as const

/**
 * Der Teil „results“ als JSON-Stücke: `{"cards":[…],"consents":[…],"periods":[…],"familyScorings":[…]}`. Nur Scheiben
 * des Kontos, die nicht auf die Bestätigung der ersten Scheibe warten (die könnten einem anderen gehören).
 */
export async function* resultsExport(
  db: Db,
  userId: string,
  batch = EXPORT_BATCH
): AsyncGenerator<string> {
  yield '{"cards":['
  let cursor: string | undefined
  let first = true
  for (;;) {
    const cards = await db.card.findMany({
      where: { ownerId: userId, ownerPending: false },
      orderBy: { id: "asc" },
      take: batch,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: CARD_SELECT,
    })
    for (const card of cards) {
      yield `${first ? "" : ","}${toJson(card)}`
      first = false
    }
    if (cards.length < batch) break
    cursor = cards[cards.length - 1].id
  }
  const [consents, periods, familyScorings] = await Promise.all([
    db.sportpassConsent.findMany({
      where: { userId },
      select: {
        sportpassId: true,
        consentedAt: true,
        consentVersion: true,
        confirmedAt: true,
        rejectedAt: true,
        returnedAt: true,
        site: { select: { name: true } },
      },
    }),
    db.namedPeriod.findMany({
      where: { ownerId: userId },
      select: { name: true, from: true, to: true, createdAt: true },
    }),
    db.familyScoring.findMany({
      where: { userId },
      select: { scoring: true, family: { select: { slug: true, name: true } } },
    }),
  ])
  yield `],"consents":${toJson(consents)},"periods":${toJson(periods)},"familyScorings":${toJson(familyScorings)}}`
}
