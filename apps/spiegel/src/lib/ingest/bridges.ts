// Brücken: Kopplung mit Einmal-Code, Geräte-Token, Heartbeat
// mit den Übergängen der Zustände und der Uhrabweichung, Zustand für eine Brücke ohne eigenen Zustand ([[adr-027]]).
// Codes und Tokens speichert Spiegel nur als SHA-256: Sie sind zufällig und lang genug, dass bcrypt nichts schützt und
// je Anfrage nur CPU kostet.

import { createHash, randomBytes, randomInt } from "node:crypto"

import {
  BRIDGE_CLOCK_TOLERANCE_MS,
  normalizePairingCode,
  PAIRING_CODE_ALPHABET,
  PAIRING_CODE_LENGTH,
  TOKEN_PATTERN,
  type HeartbeatV1,
  type PairResponseV1,
  type StateResponseV1,
} from "@vereinsheim/ingest-contract/api"
import { sportpassHash } from "@vereinsheim/ingest-contract/sportpass"

import { openRequestsOf, recordRequestOutcomes } from "../card-requests/queries"
import { ACTIVE_CONSENT } from "../consent/status"
import type { Db } from "../db"
import { FINAL_AFTER_MS, INCOMPLETE_FLAGS, RESTING_AFTER_MS } from "./meyton-ssmdb2"

/** so lange gilt ein Kopplungscode */
export const PAIRING_TTL_MS = 15 * 60_000
/** `lastSeenAt` höchstens so oft schreiben (eine Zeile je Anfrage wäre Last ohne Nutzen) */
const SEEN_EVERY_MS = 60_000
/** eine neue Uhrabweichung ab so viel Änderung oder nach so langer Zeit */
const CLOCK_CHANGE_MS = 30_000
const CLOCK_EVERY_MS = 3_600_000
/**
 * Liegt `sentAt` weiter als das neben der Empfangszeit, geht die Uhr der Brücke falsch (SF-79): Ihre Messung der Anlage
 * gilt nicht, sonst verschöbe sie jede neue Scheibe. `BRIDGE_CLOCK_TOLERANCE_MS` der Brücke plus der Weg
 */
export const HEARTBEAT_CLOCK_MAX_MS = BRIDGE_CLOCK_TOLERANCE_MS + 30_000
/** Grabsteine und Löschsperren, die die Brücke kennen muss: Scheiben dieser Zeitspanne (SF-28) */
const BLOCKED_WINDOW_MS = 60 * 86_400_000

const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex")

/** ein neuer Code, angezeigt als „ABCDE-FGHJK“ */
function newPairingCode(): string {
  const chars = Array.from(
    { length: PAIRING_CODE_LENGTH },
    () => PAIRING_CODE_ALPHABET[randomInt(PAIRING_CODE_ALPHABET.length)]
  )
  return `${chars.slice(0, 5).join("")}-${chars.slice(5).join("")}`
}

export interface PairingCode {
  id: number
  code: string
  expiresAt: Date
}

/** Admin → Anlage → „Brücke koppeln“: ein Code für ein Gerät; gespeichert wird nur sein Hash */
export async function createPairing(
  db: Db,
  input: { siteId: number; name: string; createdById: string | null; nowMs?: number }
): Promise<PairingCode> {
  const code = newPairingCode()
  const expiresAt = new Date((input.nowMs ?? Date.now()) + PAIRING_TTL_MS)
  const { id } = await db.bridgePairing.create({
    data: {
      siteId: input.siteId,
      name: input.name,
      codeHash: sha256(normalizePairingCode(code)!),
      expiresAt,
      createdById: input.createdById,
    },
    select: { id: true },
  })
  return { id, code, expiresAt }
}

/**
 * Einen Code einlösen: einmal, nur innerhalb der Frist. Das Einlösen ist eine bedingte Änderung (`usedAt` noch leer),
 * damit zwei gleichzeitige Versuche nicht zwei Geräte koppeln. null: Code unbekannt, abgelaufen oder schon eingelöst.
 */
export async function redeemPairing(
  db: Db,
  input: { code: string; name: string | null; bridgeVersion: string; nowMs?: number }
): Promise<PairResponseV1 | null> {
  const normalized = normalizePairingCode(input.code)
  if (!normalized) return null
  const now = new Date(input.nowMs ?? Date.now())
  const codeHash = sha256(normalized)
  return db.$transaction(async (tx) => {
    const claimed = await tx.bridgePairing.updateMany({
      where: { codeHash, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    })
    if (claimed.count !== 1) return null
    const pairing = await tx.bridgePairing.findUniqueOrThrow({
      where: { codeHash },
      select: { id: true, name: true, site: { select: { id: true, name: true, timeZone: true } } },
    })
    const token = `spgl_${randomBytes(32).toString("base64url")}`
    const bridge = await tx.bridge.create({
      data: {
        siteId: pairing.site.id,
        name: input.name ?? pairing.name,
        tokenHash: sha256(token),
        version: input.bridgeVersion,
        lastSeenAt: now,
      },
      select: { id: true },
    })
    await tx.bridgePairing.update({ where: { id: pairing.id }, data: { bridgeId: bridge.id } })
    return {
      bridgeId: bridge.id,
      token,
      site: { name: pairing.site.name, timeZone: pairing.site.timeZone },
    }
  })
}

export interface AuthenticatedBridge {
  bridgeId: number
  siteId: number
  timeZone: string
  runStartedAt: Date | null
}

/** der Token einer gekoppelten, nicht widerrufenen Brücke; null sonst */
export async function authenticateBridge(
  db: Db,
  token: string | null,
  nowMs = Date.now()
): Promise<AuthenticatedBridge | null> {
  if (!token || !TOKEN_PATTERN.test(token)) return null
  const bridge = await db.bridge.findUnique({
    where: { tokenHash: sha256(token) },
    select: {
      id: true,
      revokedAt: true,
      lastSeenAt: true,
      runStartedAt: true,
      site: { select: { id: true, timeZone: true } },
    },
  })
  if (!bridge || bridge.revokedAt) return null
  if (!bridge.lastSeenAt || nowMs - bridge.lastSeenAt.getTime() >= SEEN_EVERY_MS)
    await db.bridge.update({ where: { id: bridge.id }, data: { lastSeenAt: new Date(nowMs) } })
  return {
    bridgeId: bridge.id,
    siteId: bridge.site.id,
    timeZone: bridge.site.timeZone,
    runStartedAt: bridge.runStartedAt,
  }
}

/** eine Brücke widerrufen: ihr Token gilt sofort nicht mehr */
export async function revokeBridge(db: Db, bridgeId: number, nowMs = Date.now()): Promise<void> {
  await db.bridge.updateMany({
    where: { id: bridgeId, revokedAt: null },
    data: { revokedAt: new Date(nowMs) },
  })
}

/**
 * eine getrennte Brücke entfernen; die
 * Bedingung steht im Löschbefehl selbst, eine laufende bleibt. Rohdaten und Codes verweisen mit `ON DELETE SET NULL`
 * auf sie: Sie bleiben, nur ohne Gerät. true, wenn eine entfernt wurde
 */
export async function removeBridge(db: Db, bridgeId: number): Promise<boolean> {
  const { count } = await db.bridge.deleteMany({
    where: { id: bridgeId, revokedAt: { not: null } },
  })
  return count > 0
}

/**
 * Zustände weiterschalten ([[spiegel-bridge]], „Zustand statt Abschluss“): offen → ruhend nach fünf Minuten ohne
 * Lebenszeichen; ruhend oder offen → endgültig nach zwölf Stunden oder wenn ein neuer Lauf der Brücke begann (die Anlage
 * war aus). `complete` folgt endgültig ohne `unvollstaendig` (SF-66). Zwei Anweisungen über den Index (Quelle, Zustand).
 */
export async function advanceCardStates(
  db: Db,
  siteId: number,
  { nowMs = Date.now(), runStartedAt }: { nowMs?: number; runStartedAt?: Date | null } = {}
): Promise<{ resting: number; final: number }> {
  // ein Lauf, der „in der Zukunft“ begann, schöbe die Grenze über jetzt hinaus
  const runStart = runStartedAt ? Math.min(runStartedAt.getTime(), nowMs) : 0
  const finalBefore = new Date(Math.max(nowMs - FINAL_AFTER_MS, runStart))
  const incomplete = [...INCOMPLETE_FLAGS]
  // ohne lesbares Lebenszeichen zählen Ende oder Beginn, sonst schaltete die Scheibe nie weiter
  const final = await db.$executeRaw`
    UPDATE "Card" SET "state" = 'final', "complete" = NOT ("flags" && ${incomplete}::text[]), "updatedAt" = now()
    WHERE "sourceId" IN (SELECT "id" FROM "Source" WHERE "siteId" = ${siteId})
      AND "state" IN ('open', 'resting')
      AND COALESCE("lifesignAt", "endedAt", "startedAt") < ${finalBefore}`
  const resting = await db.$executeRaw`
    UPDATE "Card" SET "state" = 'resting', "updatedAt" = now()
    WHERE "sourceId" IN (SELECT "id" FROM "Source" WHERE "siteId" = ${siteId})
      AND "state" = 'open'
      AND COALESCE("lifesignAt", "endedAt", "startedAt") < ${new Date(nowMs - RESTING_AFTER_MS)}`
  return { resting, final }
}

/** den Heartbeat ablegen: eine Zeile an der Brücke, die Uhr nur bei Änderung, dann die Zustände */
export async function recordHeartbeat(
  db: Db,
  bridge: AuthenticatedBridge,
  heartbeat: HeartbeatV1,
  nowMs = Date.now()
): Promise<void> {
  const runStartedAt = new Date(heartbeat.runStartedAt)
  const newRun =
    bridge.runStartedAt !== null && bridge.runStartedAt.getTime() !== runStartedAt.getTime()
  await db.bridge.update({
    where: { id: bridge.bridgeId },
    data: {
      version: heartbeat.bridgeVersion,
      heartbeat,
      lastHeartbeatAt: new Date(nowMs),
      lastSeenAt: new Date(nowMs),
      runStartedAt,
    },
  })
  const bridgeClockOk = Math.abs(Date.parse(heartbeat.sentAt) - nowMs) <= HEARTBEAT_CLOCK_MAX_MS
  if (heartbeat.sourceClockOffsetMs !== null && bridgeClockOk) {
    const last = await db.clockReading.findFirst({
      where: { siteId: bridge.siteId },
      orderBy: { measuredAt: "desc" },
      select: { measuredAt: true, offsetMs: true },
    })
    if (
      !last ||
      Math.abs(last.offsetMs - heartbeat.sourceClockOffsetMs) >= CLOCK_CHANGE_MS ||
      nowMs - last.measuredAt.getTime() >= CLOCK_EVERY_MS
    )
      await db.clockReading.create({
        data: {
          siteId: bridge.siteId,
          measuredAt: new Date(heartbeat.sentAt),
          offsetMs: heartbeat.sourceClockOffsetMs,
        },
      })
  }
  // erledigte Aufträge zum Nachladen: nur aktive, noch offene Zustimmungen dieser Anlage mit aktivem Konto (ein
  // deaktiviertes bekommt nichts), und nur der Auftrag mit diesem `since` (ein altes „erledigt“ überschriebe sonst einen
  // gerade neu eröffneten); eine fremde oder unbekannte Id ändert nichts
  if (heartbeat.historyDone?.length)
    await db.sportpassConsent.updateMany({
      where: {
        siteId: bridge.siteId,
        historyLoadedAt: null,
        ...ACTIVE_CONSENT,
        user: { isActive: true },
        OR: heartbeat.historyDone.flatMap((done) => [
          { id: done.id, historyRequestedAt: new Date(done.since) },
          { id: done.id, historyRequestedAt: null, confirmedAt: new Date(done.since) },
        ]),
      },
      data: { historyLoadedAt: new Date(nowMs) },
    })
  // Aufträge per ID, die die Brücke nicht holen kann (nicht in der Ablage, verdeckt oder gesperrt); nur offene der Anlage
  if (heartbeat.requestsDone?.length)
    await recordRequestOutcomes(db, bridge.siteId, heartbeat.requestsDone, nowMs)
  await advanceCardStates(db, bridge.siteId, {
    nowMs,
    runStartedAt: newRun ? runStartedAt : null,
  })
}

/** das Salz der Anlage für die gehashten SportpassIDs; entsteht beim ersten Abruf */
async function consentSaltOf(db: Db, siteId: number): Promise<string> {
  const site = await db.site.findUniqueOrThrow({
    where: { id: siteId },
    select: { consentSalt: true },
  })
  if (site.consentSalt) return site.consentSalt
  const salt = randomBytes(16).toString("hex")
  await db.site.updateMany({
    where: { id: siteId, consentSalt: null },
    data: { consentSalt: salt },
  })
  return (await db.site.findUniqueOrThrow({ where: { id: siteId }, select: { consentSalt: true } }))
    .consentSalt!
}

/** die Grenzen des Vertrags (`stateResponseV1`) */
const MAX_HISTORY_REQUESTS = 1_000
const MAX_CARD_REQUESTS = 1_000
const MAX_BLOCKED = 100_000

/** was die Brücke beim Start und danach alle paar Minuten holt (`GET /state`) */
export async function bridgeState(
  db: Db,
  siteId: number,
  nowMs = Date.now()
): Promise<StateResponseV1> {
  const site = await db.site.findUniqueOrThrow({
    where: { id: siteId },
    select: { name: true, timeZone: true },
  })
  const salt = await consentSaltOf(db, siteId)
  const [epoch, consents, watermark] = await Promise.all([
    db.source.findFirst({
      where: { siteId, confirmedAt: { not: null } },
      orderBy: { epoch: "desc" },
      select: { epoch: true },
    }),
    db.sportpassConsent.findMany({
      where: { siteId, ...ACTIVE_CONSENT, user: { isActive: true } },
      orderBy: { id: "asc" },
      select: {
        id: true,
        sportpassId: true,
        confirmedAt: true,
        historyLoadedAt: true,
        historyRequestedAt: true,
      },
    }),
    // über den Index (Quelle, letzte Beobachtung): je Quelle der jüngste Stand, nicht alle Stände
    db.source.findMany({ where: { siteId }, select: { id: true } }).then((sources) =>
      Promise.all(
        sources.map((source) =>
          db.rawSnapshot.findFirst({
            where: { sourceId: source.id },
            orderBy: { lastObservedAt: "desc" },
            select: { lastObservedAt: true },
          })
        )
      )
    ),
  ])
  // offene Aufträge zum Nachladen: aktive Zustimmungen, deren ältere Scheiben noch nicht geholt sind
  // `since`: wann der Auftrag eröffnet wurde (alte Zeilen: die Bestätigung); höchstens so viele, wie der Vertrag nimmt
  const history = consents
    .filter((c) => c.historyLoadedAt === null)
    .slice(0, MAX_HISTORY_REQUESTS)
    .map((c) => ({
      id: c.id,
      since: (c.historyRequestedAt ?? c.confirmedAt!).toISOString(),
      sportpassHash: sportpassHash(salt, c.sportpassId),
    }))
  // Aufträge per ID: genau diese Scheiben, auch ohne Zustimmung
  const requests = await openRequestsOf(db, siteId, { nowMs, limit: MAX_CARD_REQUESTS })
  // mit offenem Auftrag liest die Brücke die ganze Ablage oder eine alte Scheibe: dann alle Sperren, damit eine alte,
  // gesperrte Scheibe das Gerät gar nicht erst verlässt
  const blockedWhere = {
    source: { siteId },
    ...(history.length || requests.length
      ? {}
      : { startedAt: { gte: new Date(nowMs - BLOCKED_WINDOW_MS) } }),
  }
  const blockedSelect = {
    scheibenId: true,
    startedAt: true,
    source: { select: { epoch: true } },
  } as const
  const [tombstones, locks] = await Promise.all([
    db.tombstone.findMany({ where: blockedWhere, select: blockedSelect }),
    db.deleteLock.findMany({ where: blockedWhere, select: blockedSelect }),
  ])
  const blocked = new Map(
    [...tombstones, ...locks].map((b) => [
      `${b.source.epoch}:${b.scheibenId}:${b.startedAt.getTime()}`,
      b,
    ])
  )
  const newest = Math.max(0, ...watermark.map((w) => w?.lastObservedAt.getTime() ?? 0))
  return {
    site,
    epoch: epoch?.epoch ?? null,
    sportpass: {
      salt,
      hashes: consents.map((c) => sportpassHash(salt, c.sportpassId)).sort(),
    },
    // die Grenze des Vertrags; bei einem Verein weit weg, Spiegel prüft jeden Stand ohnehin selbst (`isKeyBlocked`)
    blocked: [...blocked.values()].slice(0, MAX_BLOCKED).map((b) => ({
      scheibenId: b.scheibenId,
      startedAt: b.startedAt.toISOString(),
      epoch: b.source.epoch,
    })),
    watermark: newest ? new Date(newest).toISOString() : null,
    history,
    requests,
  }
}
