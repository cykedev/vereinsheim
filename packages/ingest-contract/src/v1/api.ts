import { z } from "zod"

import { LIMITS } from "../limits"

/**
 * API v1 zwischen Brücke und Spiegel neben dem Snapshot (SP-1.6 b): Kopplung, Heartbeat, Zustand der Brücke
 * und die Antworten. Die Brücke hat keinen eigenen Zustand ([[adr-027]], 8. Oktober 2026): Was sie über den Lauf
 * hinaus wissen muss (Zustimmungen, Grabsteine, Wasserstand), holt sie bei jedem Start über `state`. Pfade relativ zu
 * `/api/ingest/v1`. Alles außer `pair` mit `Authorization: Bearer <token>`.
 */

const shortText = z
  .string()
  .min(1)
  .max(LIMITS.maxShortTextLength)
  .refine((value) => value.isWellFormed())
const instant = z.iso.datetime({ precision: 3 })
const count = z.int().min(0).max(1_000_000)

/**
 * Kopplungscode: zehn Zeichen aus Crockfords Base32 (ohne I, L, O, U), angezeigt als „ABCDE-FGHJK“. Groß- und
 * Kleinschreibung, Bindestrich und Leerzeichen sind beim Eintippen egal (`normalizePairingCode`).
 */
export const PAIRING_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
export const PAIRING_CODE_LENGTH = 10

/** der Code ohne Trenner in Großbuchstaben, oder null, wenn er nicht die Form hat */
export function normalizePairingCode(input: string): string | null {
  const code = input.replace(/[\s-]/g, "").toUpperCase()
  if (code.length !== PAIRING_CODE_LENGTH) return null
  return [...code].every((char) => PAIRING_CODE_ALPHABET.includes(char)) ? code : null
}

/** `POST /pair` */
export const pairRequestV1 = z
  .strictObject({
    contractVersion: z.literal(1),
    code: z.string().min(1).max(32),
    /** Name des Geräts, frei („Pi im Schützenhaus“); sonst vergibt der Admin ihn beim Erzeugen des Codes */
    name: shortText.nullable(),
    bridgeVersion: shortText,
  })
  .meta({ title: "Spiegel-Kopplung v1 (Anfrage)" })

/** Geräte-Token: „spgl_“ und 43 Zeichen Base64url (32 zufällige Bytes); Spiegel speichert nur den SHA-256 */
export const TOKEN_PATTERN = /^spgl_[A-Za-z0-9_-]{43}$/

export const pairResponseV1 = z
  .strictObject({
    bridgeId: z.int().min(1),
    token: z.string().regex(TOKEN_PATTERN),
    site: z.strictObject({ name: z.string(), timeZone: z.string() }),
  })
  .meta({ title: "Spiegel-Kopplung v1 (Antwort)" })

export const BRIDGE_STATUS = [
  "ok",
  "delayed",
  "db-unreachable",
  "db-error",
  "possible-reset",
] as const

/**
 * `POST /heartbeat`, einmal je Minute. Nie Namen oder Sportpassnummern (SF-59); der Fingerabdruck der Quelle
 * besteht nur aus Version, Zeilenzahlen und dem ältesten Zeitstempel (SF-23).
 */
export const heartbeatV1 = z
  .strictObject({
    contractVersion: z.literal(1),
    bridgeVersion: shortText,
    /** Beginn dieses Laufs der Brücke; ein neuer Lauf heißt: die Anlage war aus (Zustand `final`) */
    runStartedAt: instant,
    /** Uhr der Brücke beim Senden (nach NTP) */
    sentAt: instant,
    status: z.enum(BRIDGE_STATUS),
    /** Scheiben, die gelesen, aber noch nicht bestätigt hochgeladen sind */
    backlog: count,
    lastDbContactAt: instant.nullable(),
    /** Dauer der letzten Abfragerunde */
    queryMs: count.nullable(),
    /** `SELECT NOW()` der Anlage minus Uhr der Brücke, in ms (SF-29); null ohne Messung */
    sourceClockOffsetMs: z
      .int()
      .min(-10 * 365 * 86_400_000)
      .max(10 * 365 * 86_400_000)
      .nullable(),
    /** zurückgehaltene Scheiben je Anzeigeart (verdeckt 5, 10, unbekannt 0; SF-19, SF-20) */
    heldBack: z
      .array(z.strictObject({ displayMode: z.int().min(0).max(255), cards: count }))
      .max(32),
    sourceFingerprint: z
      .strictObject({
        version: shortText.nullable(),
        scheiben: count,
        treffer: count,
        oldestStamp: shortText.nullable(),
      })
      .nullable(),
  })
  .meta({ title: "Spiegel-Heartbeat v1" })

export const heartbeatResponseV1 = z
  .strictObject({ serverTime: instant })
  .meta({ title: "Spiegel-Heartbeat v1 (Antwort)" })

/**
 * `GET /state`: was die Brücke im Arbeitsspeicher hält. `sportpass` sind SHA-256 über
 * `spiegel-sportpass-v1:<salt>:<SportpassID dezimal>` (`sportpassHash`); die Brücke rechnet denselben Hash über
 * `Scheiben.SportpassID` und lädt nur passende Scheiben von selbst hoch (SF-38). Grabsteine und Löschsperren nie wieder
 * (SF-28); eine ScheibenID kehrt nach rund 49,7 Tagen wieder (SF-77), deshalb mit Beginn.
 */
export const stateResponseV1 = z
  .strictObject({
    site: z.strictObject({ name: z.string(), timeZone: z.string() }),
    /** die bestätigte Epoche; null, solange noch kein Snapshot kam */
    epoch: z.int().min(1).nullable(),
    sportpass: z.strictObject({
      salt: z.string().regex(/^[0-9a-f]{32}$/),
      hashes: z.array(z.string().regex(/^[0-9a-f]{64}$/)).max(100_000),
    }),
    /** `epoch` seit 13. Oktober 2026 (additiv): Eine Sperre gilt nur in ihrer Epoche; nach einem Reset (SF-23) beginnen die IDs neu */
    blocked: z
      .array(
        z.strictObject({
          scheibenId: z.int32(),
          startedAt: instant,
          epoch: z.int().min(1).optional(),
        })
      )
      .max(100_000),
    /** jüngste Beobachtungszeit, die Spiegel von dieser Anlage hat; Nachholen beim Start ab hier (SF-55) */
    watermark: instant.nullable(),
  })
  .meta({ title: "Spiegel-Zustand der Brücke v1" })

/**
 * Ergebnis je Snapshot eines Stapels:
 * - `stored`: neuer Stand abgelegt; `unchanged`: derselbe Stand wie zuletzt (Prüfsumme);
 * - `lifesign`: nur das Lebenszeichen hat sich bewegt, vermerkt ohne neue Zeilen;
 * - `stale`: älter als der zuletzt gesehene Stand (SF-26); `future`: Folgenummer weit in der Zukunft;
 * - `discarded`: nicht angenommen und nicht gespeichert (`reason`); `quarantined`: abgelegt, aber unbekanntes Schema
 *   (SF-25); `epoch-unconfirmed`: neue Epoche, bis der Admin sie bestätigt (SF-23).
 * Bis auf `future` und `epoch-unconfirmed` ist jedes Ergebnis endgültig: die Brücke schickt denselben Stand nicht
 * noch einmal.
 */
export const SNAPSHOT_OUTCOMES = [
  "stored",
  "unchanged",
  "lifesign",
  "stale",
  "future",
  "discarded",
  "quarantined",
  "epoch-unconfirmed",
] as const

/** warum verworfen: ohne Zustimmung, Grabstein oder Löschsperre, verdeckt oder Modus 0 */
export const DISCARD_REASONS = ["no-consent", "blocked", "hidden"] as const

export const snapshotsResponseV1 = z
  .strictObject({
    results: z.array(
      z.strictObject({
        index: z.int().min(0),
        scheibenId: z.int32(),
        outcome: z.enum(SNAPSHOT_OUTCOMES),
        reason: z.enum(DISCARD_REASONS).optional(),
      })
    ),
  })
  .meta({ title: "Spiegel-Snapshot-Stapel v1 (Antwort)" })

/** feste Fehlercodes; `message` ist ein fester deutscher Satz ohne Inhalte der Anfrage */
export const API_ERROR_CODES = [
  "unauthorized",
  "rate-limited",
  "busy",
  "too-large",
  "unsupported-media-type",
  "invalid",
  "invalid-code",
  "not-found",
  "internal",
] as const

export const errorResponseV1 = z
  .strictObject({
    error: z.strictObject({
      code: z.enum(API_ERROR_CODES),
      message: z.string(),
      /** bei `rate-limited` und `busy` auch als Kopfzeile `Retry-After` */
      retryAfterSeconds: z.int().min(1).optional(),
    }),
    /** bei `invalid`: Pfad und Code, nie Inhalte (SF-59) */
    issues: z.array(z.strictObject({ path: z.string(), code: z.string() })).optional(),
  })
  .meta({ title: "Spiegel-Fehler v1" })

export type PairRequestV1 = z.infer<typeof pairRequestV1>
export type PairResponseV1 = z.infer<typeof pairResponseV1>
export type HeartbeatV1 = z.infer<typeof heartbeatV1>
export type HeartbeatResponseV1 = z.infer<typeof heartbeatResponseV1>
export type StateResponseV1 = z.infer<typeof stateResponseV1>
export type SnapshotOutcome = (typeof SNAPSHOT_OUTCOMES)[number]
export type DiscardReason = (typeof DISCARD_REASONS)[number]
export type SnapshotsResponseV1 = z.infer<typeof snapshotsResponseV1>
export type ApiErrorCode = (typeof API_ERROR_CODES)[number]
export type ErrorResponseV1 = z.infer<typeof errorResponseV1>
