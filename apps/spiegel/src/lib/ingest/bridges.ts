// Brücken (SP-1.6 b, Plan `plans/2026-10-13-spiegel-ingest.md`): Kopplung mit Einmal-Code, Geräte-Token, Heartbeat
// mit den Übergängen der Zustände und der Uhrabweichung, Zustand für eine Brücke ohne eigenen Zustand ([[adr-027]]).
// Codes und Tokens speichert Spiegel nur als SHA-256: Sie sind zufällig und lang genug, dass bcrypt nichts schützt und
// je Anfrage nur CPU kostet (D7).

import { createHash, randomBytes, randomInt } from "node:crypto"

import {
  normalizePairingCode,
  PAIRING_CODE_ALPHABET,
  PAIRING_CODE_LENGTH,
  TOKEN_PATTERN,
  type HeartbeatV1,
  type PairResponseV1,
  type StateResponseV1,
} from "@vereinsheim/ingest-contract/api"
import { sportpassHash } from "@vereinsheim/ingest-contract/sportpass"

import type { Db } from "../db"
import { FINAL_AFTER_MS, INCOMPLETE_FLAGS, RESTING_AFTER_MS } from "./meyton-ssmdb2"

/** so lange gilt ein Kopplungscode */
export const PAIRING_TTL_MS = 15 * 60_000
/** `lastSeenAt` höchstens so oft schreiben (D7: eine Zeile je Anfrage wäre Last ohne Nutzen) */
const SEEN_EVERY_MS = 60_000
/** eine neue Uhrabweichung ab so viel Änderung oder nach so langer Zeit (D8) */
const CLOCK_CHANGE_MS = 30_000
const CLOCK_EVERY_MS = 3_600_000
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
 * Zustände weiterschalten ([[spiegel-bridge]], „Zustand statt Abschluss“): offen → ruhend nach fünf Minuten ohne
 * Lebenszeichen; ruhend oder offen → endgültig nach zwölf Stunden oder wenn ein neuer Lauf der Brücke begann (die Anlage
 * war aus). `complete` folgt endgültig ohne `unvollstaendig` (SF-66). Zwei Anweisungen über den Index (Quelle, Zustand).
 */
export async function advanceCardStates(
  db: Db,
  siteId: number,
  { nowMs = Date.now(), runStartedAt }: { nowMs?: number; runStartedAt?: Date | null } = {}
): Promise<{ resting: number; final: number }> {
  // ein Lauf, der „in der Zukunft“ begann, schöbe die Grenze über jetzt hinaus (Review)
  const runStart = runStartedAt ? Math.min(runStartedAt.getTime(), nowMs) : 0
  const finalBefore = new Date(Math.max(nowMs - FINAL_AFTER_MS, runStart))
  const incomplete = [...INCOMPLETE_FLAGS]
  // ohne lesbares Lebenszeichen zählen Ende oder Beginn, sonst schaltete die Scheibe nie weiter (Review)
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

/** den Heartbeat ablegen (D8): eine Zeile an der Brücke, die Uhr nur bei Änderung, dann die Zustände */
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
  if (heartbeat.sourceClockOffsetMs !== null) {
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
  const [epoch, consents, tombstones, locks, watermark] = await Promise.all([
    db.source.findFirst({
      where: { siteId, confirmedAt: { not: null } },
      orderBy: { epoch: "desc" },
      select: { epoch: true },
    }),
    db.sportpassConsent.findMany({
      where: { siteId, confirmedAt: { not: null }, rejectedAt: null, user: { isActive: true } },
      select: { sportpassId: true },
    }),
    db.tombstone.findMany({
      where: {
        source: { siteId },
        startedAt: { gte: new Date(nowMs - BLOCKED_WINDOW_MS) },
      },
      select: { scheibenId: true, startedAt: true, source: { select: { epoch: true } } },
    }),
    db.deleteLock.findMany({
      where: {
        source: { siteId },
        startedAt: { gte: new Date(nowMs - BLOCKED_WINDOW_MS) },
      },
      select: { scheibenId: true, startedAt: true, source: { select: { epoch: true } } },
    }),
    // über den Index (Quelle, letzte Beobachtung): je Quelle der jüngste Stand, nicht alle Stände (Review)
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
    blocked: [...blocked.values()].map((b) => ({
      scheibenId: b.scheibenId,
      startedAt: b.startedAt.toISOString(),
      epoch: b.source.epoch,
    })),
    watermark: newest ? new Date(newest).toISOString() : null,
  }
}
