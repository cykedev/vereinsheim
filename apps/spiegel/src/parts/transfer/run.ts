// Die Übernahme eines Kontos aus Treffsicher ([[spiegel-account-transfer]], [[adr-033]] Stufe 3): Vorprüfung, dann
// alles lesen, was dauert (Dateien der Anhänge, Ausdrucke im Kindprozess), dann eine Transaktion je Konto. Nahtstelle,
// weil sie Scheiben und Tagebuch schreibt; die Regeln stehen in den reinen Modulen daneben (`decide.ts`, `check.ts`)
// und in `src/lib/transfer/`, `src/diary/transfer/`. Wiederholbar: Geändertes bleibt, Unverändertes wird ersetzt.

import { createHash } from "node:crypto"

import { plannedShotsOf } from "@vereinsheim/shot-core/discipline"
import { eveningDay } from "@vereinsheim/shot-ui/period/calendar"

import {
  entryFromSession,
  executionsOnCard,
  needsEntry,
  type ImportedEntry,
} from "@/diary/transfer/treffsicher-entry"
import { goalFromTreffsicher, routineFromTreffsicher } from "@/diary/transfer/treffsicher-goal"
import {
  isTouched,
  releaseImportedLinks,
  writtenInLastRun,
  replaceExecutions,
  setImportedLinks,
  upsertImportedEntry,
  upsertImportedGoal,
  upsertImportedRoutine,
} from "@/diary/transfer/write"
import type { Prisma } from "@/generated/prisma/client"
import { requestSiteId } from "@/lib/card-requests/queries"
import type { Db } from "@/lib/db"
import { purgeCards } from "@/lib/db/purge"
import type { DetailsProblem } from "@/lib/entered/details"
import { evidenceTypeOf, writeEvidenceFile, type EvidenceType } from "@/lib/evidence/files"
import { evidenceFileName } from "@/lib/evidence/name"
import { EVIDENCE_MAX_BYTES } from "@/lib/evidence/texts"
import { storePrintout, type StoreRejection, type StoreResult } from "@/lib/printouts/store"
import { cardTotals, resultCards, resultCardSeries, type CardTotals } from "@/lib/results-read"
import {
  disciplineForShots,
  familyForName,
  treffsicherDetails,
} from "@/lib/transfer/treffsicher-card"
import {
  placeAttachment,
  writeTransferCard,
  type PlacedAttachment,
  type PreparedAttachment,
} from "@/lib/transfer/write"

import {
  checkTransfer,
  type CheckResult,
  type CheckUnit,
  type SampleUnit,
  type TableCheck,
} from "./check"
import { decideCard, type CardDecision } from "./decide"
import {
  PREVIEW_CARD_PREFIX,
  PREVIEW_DIARY_PREFIX,
  sourceIdOf,
  TRANSFER_PREFIX,
  transferKey,
} from "./keys"
import type { TreffsicherSource } from "./source"
import {
  treffsicherAccount,
  type TreffsicherAccount,
  type TreffsicherSession,
} from "./treffsicher-export"

type Tx = Prisma.TransactionClient

/** die Dateien der Anhänge (entpacktes Backup von Treffsicher); null: die Datei fehlt */
export interface AttachmentFiles {
  read(filePath: string): Promise<Uint8Array | null>
}

/** eine Zuordnung `--family "<Name>=<Kennung>"` */
export interface FamilyOption {
  name: string
  slug: string
}

/**
 * eine Zuordnung `--discipline "<Disziplin in Treffsicher>=<Disziplin in Spiegel>"`: die Disziplin für Einheiten, für
 * die die Wahl nach Schusszahl keine findet (Gleichstand)
 */
export interface DisciplineOption {
  name: string
  target: string
}

export interface TransferInput {
  source: TreffsicherSource
  /** E-Mail in Treffsicher */
  from: string
  /** E-Mail in Spiegel; fehlt das Konto, legt die Übernahme es an */
  to: string
  dryRun: boolean
  /** null: ohne `--files`, jeder Anhang steht unter „Datei fehlt“ */
  files: AttachmentFiles | null
  families: readonly FamilyOption[]
  disciplines?: readonly DisciplineOption[]
  /** die Anlage der Disziplinen; ohne die erste (`requestSiteId`), Tests geben ihre eigene */
  siteId?: number
  /** Ausdrucke lesen und speichern; ohne `storePrintout` im Kindprozess (Tests geben eine eigene) */
  readPrintout?: (bytes: Uint8Array, fileName: string, timeZone: string) => Promise<StoreResult>
  /** Datei eines Belegs speichern; ohne `writeEvidenceFile` */
  writeEvidence?: (sha256: string, type: EvidenceType, bytes: Uint8Array) => Promise<void>
  /** Zeitgrenze der Transaktion; ohne 300 s (Tests kürzer) */
  timeoutMs?: number
}

/** ein fester Grund, aus dem der Lauf vor dem Schreiben abbricht; ohne E-Mails */
export type TransferAbort =
  | { kind: "noSource" }
  | { kind: "preview"; rows: number }
  | { kind: "foreignInTarget"; rows: number }
  | { kind: "sourceElsewhere"; rows: number }
  | { kind: "badFamilyOption"; unknownSlugs: string[]; duplicateNames: string[] }
  /**
   * `--discipline` nennt eine Disziplin in Spiegel, die es unter den eingeordneten der ersten Anlage nicht genau einmal
   * gibt, eine in einer anderen Familie als die Disziplin aus Treffsicher, oder denselben Namen zweimal
   */
  | {
      kind: "badDisciplineOption"
      unknownTargets: string[]
      outsideFamily: string[]
      duplicateNames: string[]
    }
  | { kind: "unknownFamily"; names: Record<string, number> }
  | {
      kind: "noDiscipline"
      /** `none`: keine Disziplin mit dieser Schusszahl oder mehr; `tie`: mehrere mit `plannedShots`, keine meistgenutzt */
      cases: {
        family: string
        shots: number
        sessions: number
        reason: "none" | "tie"
        plannedShots: number | null
      }[]
    }
  /**
   * nach dem Merkmal in Treffsicher ist der Commit in Spiegel gescheitert, und das alte Merkmal ließ sich nicht
   * zurücksetzen; `previous` ist es (ISO, null ohne)
   */
  | { kind: "markedNotSaved"; previous: string | null }

type Tally<K extends string> = Record<K, number>

/** der Bericht eines Laufs; `details` mit Texten nur für die Datei unter `reports/`, nie für die Ausgabe */
export interface TransferReport {
  dryRun: boolean
  accountCreated: boolean
  diaryEnabled: boolean
  sessions: number
  /**
   * neue Scheiben nicht auf einer Disziplin mit ihrer Schusszahl: `larger` mehr Schüsse (unvollständig), `largest` die
   * größte der Familie mit weniger (`ueber-soll`), `option` aus `--discipline`
   */
  disciplines: Tally<"larger" | "largest" | "option">
  decisions: Tally<"existing" | "new" | "uncertain" | "probeEvening" | "noResult" | "notShooting">
  cards: {
    created: number
    revised: number
    unchanged: number
    removed: number
    kept: number
    invalid: Partial<Record<DetailsProblem, number>>
  }
  entries: Tally<"created" | "updated" | "kept" | "removed">
  /**
   * Einheiten nur mit Werten, ohne Eintrag (`needsEntry`); davon mit einem Ziel verknüpft (die Verknüpfung bestimmt
   * weiter die Familie des Ziels) und ohne eigene Scheibe (ohne Ergebnis, Abend nur aus Probe)
   */
  cardOnly: Tally<"units" | "goalLinked" | "noCard">
  links: { linkedElsewhere: number }
  executions: {
    placed: number
    series: number
    skipped: Tally<"severalCards" | "noCard" | "otherSeries" | "keptEntry">
    practiceSkipped: number
  }
  goals: Tally<"created" | "updated" | "kept" | "removed" | "outsideLinks" | "unknownLinks">
  routines: Tally<"created" | "updated" | "kept" | "removed" | "flattened">
  attachments: {
    total: number
    fileMissing: number
    unreadable: number
    tooLarge: number
    printoutRejected: Partial<Record<StoreRejection, number>>
    /**
     * `keepsValues`: an der Scheibe der Einheit, die nicht aus Treffsicher ist (passend vorhanden, schon mit Werten vom
     * Ausdruck, von Hand geändert); ihre Werte bleiben
     */
    printouts: Tally<
      "ownCard" | "adopted" | "withoutValues" | "keepsValues" | "imported" | "notPlaced"
    >
    evidence: Tally<"attached" | "duplicate" | "limit" | "gone" | "noCard">
  }
  /** Gründe für Ausdrucke, die nicht angehängt wurden (`importPrintoutIn`: taken, blocked, trashed, noDiscipline) */
  printoutsNotPlaced: Partial<Record<string, number>>
  /** die unsicheren Fälle: Abend, Familie, Treffsicher gegen die vorhandenen Scheiben */
  uncertain: {
    day: string
    family: string
    shots: number
    total: number | null
    others: { shots: number; total: number | null }[]
  }[]
  /** was stehen blieb, weil es seit dem letzten Lauf geändert wurde oder im Papierkorb liegt */
  kept: { what: "card" | "entry" | "goal" | "routine"; day: string | null; reason: string }[]
  /** `movedToSpiegelAt` in Treffsicher */
  marked: "set" | "dryRun"
  check: CheckResult
}

export type TransferOutcome =
  { kind: "aborted"; abort: TransferAbort } | { kind: "done"; report: TransferReport }

/** wirft `dryRun` am Ende der Transaktion, damit nichts bleibt */
class DryRun extends Error {}

/** so lange darf ein Lauf in einer Transaktion dauern */
const TIMEOUT_MS = 300_000

const normalize = (name: string) => name.trim().toLowerCase()
const add = <K extends string>(tally: Partial<Record<K, number>>, key: K, n = 1) => {
  tally[key] = (tally[key] ?? 0) + n
}

/** die Zeilen des Ziels mit Schlüsseln der Übernahme (ohne Vorschau) */
async function targetRows(db: Db, userId: string) {
  const where = { startsWith: TRANSFER_PREFIX }
  const [cards, entries, goals, routines] = await Promise.all([
    db.card.findMany({
      where: { ownerId: userId, importKey: where },
      select: { id: true, importKey: true, origin: true, deletedAt: true },
    }),
    db.diaryEntry.findMany({
      where: { userId, importKey: where },
      select: {
        id: true,
        importKey: true,
        deletedAt: true,
        updatedAt: true,
        // Verknüpfen und Lösen ändern `updatedAt` des Eintrags nicht, nur das ihrer Zeile
        cards: { select: { updatedAt: true } },
      },
    }),
    db.diaryGoal.findMany({
      where: { userId, importKey: where },
      select: { id: true, importKey: true, deletedAt: true, updatedAt: true },
    }),
    db.diaryRoutine.findMany({
      where: { userId, importKey: where },
      select: { id: true, importKey: true, deletedAt: true, updatedAt: true },
    }),
  ])
  const own = <T extends { importKey: string | null }>(rows: T[]) =>
    rows.filter((row) => sourceIdOf(row.importKey) !== null)
  return { cards: own(cards), entries: own(entries), goals: own(goals), routines: own(routines) }
}

/** Zeilen anderer Konten mit diesen Schlüsseln; ohne Ziel alle */
async function rowsElsewhere(db: Db, keys: string[], targetId: string | null): Promise<number> {
  if (!keys.length) return 0
  const importKey = { in: keys }
  // `NOT` über eine Spalte, die NULL sein kann, ließe Scheiben ohne Besitzer aus (conventions §9)
  const notTarget =
    targetId === null ? {} : { OR: [{ ownerId: null }, { ownerId: { not: targetId } }] }
  const notUser = targetId === null ? {} : { userId: { not: targetId } }
  const counts = await Promise.all([
    db.card.count({ where: { importKey, ...notTarget } }),
    db.diaryEntry.count({ where: { importKey, ...notUser } }),
    db.diaryGoal.count({ where: { importKey, ...notUser } }),
    db.diaryRoutine.count({ where: { importKey, ...notUser } }),
  ])
  return counts.reduce((sum, n) => sum + n, 0)
}

async function previewRows(db: Db, userId: string): Promise<number> {
  const diary = { userId, importKey: { startsWith: PREVIEW_DIARY_PREFIX } }
  const counts = await Promise.all([
    db.card.count({ where: { ownerId: userId, importKey: { startsWith: PREVIEW_CARD_PREFIX } } }),
    db.diaryEntry.count({ where: diary }),
    db.diaryGoal.count({ where: diary }),
    db.diaryRoutine.count({ where: diary }),
  ])
  return counts.reduce((sum, n) => sum + n, 0)
}

/** eine Einheit mit allem, was vor der Transaktion feststeht */
interface Unit {
  session: TreffsicherSession
  key: string
  dateMs: number
  day: string
  familyId: number | null
  scoring: "WHOLE" | "TENTH"
  card: ReturnType<typeof treffsicherDetails>
  decision: CardDecision
  disciplineId: number | null
  /** die Serien der einen vorhandenen Scheibe, auf die die Ausführung geht (passend oder Abend nur aus Probe) */
  executionCard: { id: string; series: { series: number }[] } | null
  attachments: PreparedAttachment[]
}

const blankReport = (dryRun: boolean): Omit<TransferReport, "check"> => ({
  dryRun,
  accountCreated: false,
  diaryEnabled: false,
  sessions: 0,
  disciplines: { larger: 0, largest: 0, option: 0 },
  decisions: { existing: 0, new: 0, uncertain: 0, probeEvening: 0, noResult: 0, notShooting: 0 },
  cards: { created: 0, revised: 0, unchanged: 0, removed: 0, kept: 0, invalid: {} },
  entries: { created: 0, updated: 0, kept: 0, removed: 0 },
  cardOnly: { units: 0, goalLinked: 0, noCard: 0 },
  links: { linkedElsewhere: 0 },
  executions: {
    placed: 0,
    series: 0,
    skipped: { severalCards: 0, noCard: 0, otherSeries: 0, keptEntry: 0 },
    practiceSkipped: 0,
  },
  goals: { created: 0, updated: 0, kept: 0, removed: 0, outsideLinks: 0, unknownLinks: 0 },
  routines: { created: 0, updated: 0, kept: 0, removed: 0, flattened: 0 },
  attachments: {
    total: 0,
    fileMissing: 0,
    unreadable: 0,
    tooLarge: 0,
    printoutRejected: {},
    printouts: {
      ownCard: 0,
      adopted: 0,
      withoutValues: 0,
      keepsValues: 0,
      imported: 0,
      notPlaced: 0,
    },
    evidence: { attached: 0, duplicate: 0, limit: 0, gone: 0, noCard: 0 },
  },
  printoutsNotPlaced: {},
  uncertain: [],
  kept: [],
  marked: dryRun ? "dryRun" : "set",
})

/**
 * Ein Konto aus Treffsicher übernehmen. Bricht vor dem Schreiben mit festem Grund ab (`TransferAbort`); sonst eine
 * Transaktion, die `dryRun` am Ende zurückrollt. Nach einem echten Lauf ist das Konto in Treffsicher umgezogen
 * (`markMoved` als letzter Schritt in der Transaktion: scheitert es, bleibt nichts halb). Das Merkmal trägt die Zeit,
 * mit der der Lauf seine Zeilen schreibt; daran erkennt der nächste, was seitdem geändert ist (`isTouched`). Scheitert
 * der Commit nach dem Merkmal, setzt der Lauf das alte zurück; geht auch das nicht, meldet er `markedNotSaved`.
 */
export async function runTransfer(db: Db, input: TransferInput): Promise<TransferOutcome> {
  const raw = await input.source.readAccount(input.from)
  if (raw === null) return { kind: "aborted", abort: { kind: "noSource" } }
  const account = treffsicherAccount.parse(raw)
  const toEmail = input.to.trim().toLowerCase()
  const target = await db.user.findUnique({ where: { email: toEmail }, select: { id: true } })
  const targetId = target?.id ?? null

  // 2. Vorschau
  if (targetId !== null) {
    const rows = await previewRows(db, targetId)
    if (rows) return { kind: "aborted", abort: { kind: "preview", rows } }
  }
  // 3. Übernommenes eines anderen Treffsicher-Kontos im Ziel
  const existing = targetId === null ? null : await targetRows(db, targetId)
  const targetIds = existing
    ? [
        ...new Set(
          [...existing.cards, ...existing.entries, ...existing.goals, ...existing.routines].map(
            (row) => sourceIdOf(row.importKey)!
          )
        ),
      ]
    : []
  const owners = await input.source.sessionOwners(targetIds)
  const foreign = targetIds.filter((id) => {
    const owner = owners.get(id)
    return owner !== undefined && owner !== account.user.id
  })
  if (foreign.length)
    return { kind: "aborted", abort: { kind: "foreignInTarget", rows: foreign.length } }
  // 4. Übernommenes dieses Kontos an einem anderen Spiegel-Konto
  const ownIds = [
    ...account.sessions.map((s) => s.id),
    ...account.goals.map((g) => g.id),
    ...account.routines.map((r) => r.id),
  ]
  const elsewhere = await rowsElsewhere(db, ownIds.map(transferKey), targetId)
  if (elsewhere) return { kind: "aborted", abort: { kind: "sourceElsewhere", rows: elsewhere } }

  // 5./6. Familien
  const families = await db.family.findMany({ select: { id: true, name: true, slug: true } })
  const bySlug = new Map(families.map((f) => [f.slug, f.id]))
  const unknownSlugs = input.families.filter((o) => !bySlug.has(o.slug)).map((o) => o.slug)
  const seen = new Set<string>()
  const duplicateNames = input.families
    .map((o) => normalize(o.name))
    .filter((name) => (seen.has(name) ? true : (seen.add(name), false)))
  if (unknownSlugs.length || duplicateNames.length)
    return { kind: "aborted", abort: { kind: "badFamilyOption", unknownSlugs, duplicateNames } }
  const overrides = new Map(input.families.map((o) => [normalize(o.name), bySlug.get(o.slug)!]))
  const familyOf = (name: string) => overrides.get(normalize(name)) ?? familyForName(name, families)
  const unknownNames: Record<string, number> = {}
  for (const s of account.sessions)
    if (s.discipline && familyOf(s.discipline.name) === null) add(unknownNames, s.discipline.name)
  for (const r of account.routines)
    if (r.discipline && familyOf(r.discipline.name) === null) add(unknownNames, r.discipline.name)
  if (Object.keys(unknownNames).length)
    return { kind: "aborted", abort: { kind: "unknownFamily", names: unknownNames } }

  // die Scheiben des Ziels, ohne die eigenen übernommenen; Disziplinen der Anlage
  const siteId = input.siteId ?? (await requestSiteId(db))
  const site =
    siteId === null
      ? null
      : await db.site.findUnique({ where: { id: siteId }, select: { timeZone: true } })
  const timeZone = site?.timeZone ?? "Europe/Berlin"
  const [disciplines, used, visible] = await Promise.all([
    siteId === null
      ? []
      : db.discipline.findMany({
          where: {
            siteId,
            confirmedAt: { not: null },
            ignoredAt: null,
            targetId: { not: null },
            familyId: { not: null },
          },
          select: { id: true, name: true, familyId: true, meytonId: true, plannedShots: true },
        }),
    targetId === null
      ? []
      : db.card.groupBy({
          by: ["disciplineId"],
          where: { ownerId: targetId, deletedAt: null },
          _count: { _all: true },
        }),
    targetId === null ? [] : resultCards(db, { ownerId: targetId, timeZone }),
  ])
  const ownCards = new Map(used.map((row) => [row.disciplineId, row._count._all]))
  const candidates = (familyId: number) =>
    disciplines
      .filter((d) => d.familyId === familyId)
      .map((d) => ({
        id: d.id,
        plannedShots: plannedShotsOf(d.meytonId, d.plannedShots),
        ownCards: ownCards.get(d.id) ?? 0,
      }))
  // 7. `--discipline`: die genannte genau einmal unter den eingeordneten, in der Familie der Disziplin aus Treffsicher
  const disciplineOptions = input.disciplines ?? []
  const seenOptions = new Set<string>()
  const optionDuplicates = disciplineOptions
    .map((o) => normalize(o.name))
    .filter((name) => (seenOptions.has(name) ? true : (seenOptions.add(name), false)))
  const unknownTargets: string[] = []
  const outsideFamily: string[] = []
  const chosen = new Map<string, number>()
  for (const option of disciplineOptions) {
    const named = disciplines.filter((d) => normalize(d.name) === normalize(option.target))
    if (named.length !== 1) unknownTargets.push(option.target)
    else if (named[0].familyId !== familyOf(option.name))
      outsideFamily.push(`${option.name}=${option.target}`)
    else chosen.set(normalize(option.name), named[0].id)
  }
  if (optionDuplicates.length || unknownTargets.length || outsideFamily.length)
    return {
      kind: "aborted",
      abort: {
        kind: "badDisciplineOption",
        unknownTargets,
        outsideFamily,
        duplicateNames: optionDuplicates,
      },
    }

  const byEvening = new Map<string, typeof visible>()
  for (const card of visible)
    if (card.family && sourceIdOf(card.importKey) === null) {
      const key = `${card.day}|${card.family.id}`
      byEvening.set(key, [...(byEvening.get(key) ?? []), card])
    }

  // je Einheit entscheiden; 8. Disziplin für jede neue Scheibe
  const units: Unit[] = []
  const missing = new Map<
    string,
    Extract<TransferAbort, { kind: "noDiscipline" }>["cases"][number]
  >()
  const steps = { larger: 0, largest: 0, option: 0 }
  const familyName = new Map(families.map((f) => [f.id, f.name]))
  for (const session of [...account.sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    const dateMs = Date.parse(session.date)
    const familyId = session.discipline ? familyOf(session.discipline.name) : null
    const card = treffsicherDetails({ ...session, dateMs })
    const day = eveningDay(dateMs, timeZone)
    const evening = familyId === null ? [] : (byEvening.get(`${day}|${familyId}`) ?? [])
    const scoring = session.discipline?.scoringType ?? "WHOLE"
    const decision = decideCard(
      { type: session.type, scoring },
      card ? { shots: card.shots, total: card.details.total ?? null } : null,
      evening.map((c) => ({ id: c.id, probeOnly: c.probeOnly, shots: c.shots, totals: c.totals }))
    )
    let disciplineId: number | null = null
    if ((decision.kind === "new" || decision.kind === "uncertain") && card && familyId !== null) {
      // `--discipline` entscheidet nur, wo die Wahl nach Schusszahl keine findet: Eine Disziplin aus Treffsicher hat
      // Einheiten verschiedener Schusszahl, die übrigen behalten ihre
      const automatic = disciplineForShots(candidates(familyId), card.shots)
      const option =
        automatic.kind === "found" ? undefined : chosen.get(normalize(session.discipline!.name))
      const choice: ReturnType<typeof disciplineForShots> =
        option === undefined ? automatic : { kind: "found", id: option, step: "exact" }
      if (option !== undefined) steps.option += 1
      if (choice.kind === "found") {
        disciplineId = choice.id
        if (option === undefined && choice.step !== "exact") steps[choice.step] += 1
      } else {
        const k = `${familyId}|${card.shots}`
        const row = missing.get(k) ?? {
          family: familyName.get(familyId) ?? String(familyId),
          shots: card.shots,
          sessions: 0,
          reason: choice.kind,
          plannedShots: choice.kind === "tie" ? choice.plannedShots : null,
        }
        row.sessions += 1
        missing.set(k, row)
      }
    }
    // die eine Scheibe für die Ausführung, wenn sie nicht die neu geschriebene ist: die passende, die eine des Abends
    // nur aus Probe, oder die Scheibe dieser Einheit aus einem früheren Lauf, die geändert ist und bleibt (Werte vom
    // Ausdruck, von Hand): Ihre Serien bleiben, die Ausführung gehört weiter auf sie
    const kept = existing?.cards.find(
      (c) => c.importKey === transferKey(session.id) && c.origin !== "treffsicher" && !c.deletedAt
    )
    const one =
      decision.kind === "existing" && decision.cardIds.length === 1
        ? decision.cardIds[0]
        : decision.kind === "probeEvening" && decision.cardIds.length === 1
          ? decision.cardIds[0]
          : (decision.kind === "new" || decision.kind === "uncertain") && kept
            ? kept.id
            : null
    units.push({
      session,
      key: transferKey(session.id),
      dateMs,
      day,
      familyId,
      scoring,
      card,
      decision,
      disciplineId,
      executionCard: null,
      attachments: [],
    })
    if (one && session.series.some((x) => !x.isPractice && x.executionQuality !== null))
      units[units.length - 1].executionCard = {
        id: one,
        series:
          (await resultCardSeries(db, { ownerId: targetId!, cardId: one }))?.map((s) => ({
            series: s.series,
          })) ?? [],
      }
  }
  if (missing.size)
    return { kind: "aborted", abort: { kind: "noDiscipline", cases: [...missing.values()] } }

  // die Anhänge lesen, außerhalb der Transaktion (Kindprozess, Dateien)
  const report = blankReport(input.dryRun)
  report.disciplines = steps
  const readPrintout =
    input.readPrintout ??
    ((bytes: Uint8Array, fileName: string, zone: string) =>
      storePrintout({ bytes, timeZone: zone, fileName }, { write: !input.dryRun }))
  const writeEvidence = input.writeEvidence ?? writeEvidenceFile
  for (const unit of units)
    for (const attachment of unit.session.attachments) {
      report.attachments.total += 1
      const bytes = input.files ? await input.files.read(attachment.filePath) : null
      if (!bytes) {
        report.attachments.fileMissing += 1
        continue
      }
      const type = evidenceTypeOf(bytes)
      if (type === "application/pdf") {
        const read = await readPrintout(bytes, attachment.originalName, timeZone)
        if (read.kind === "stored") {
          unit.attachments.push({ kind: "printout", file: read.file })
          continue
        }
        if (read.reason !== "noId") add(report.attachments.printoutRejected, read.reason)
      }
      if (!type) {
        report.attachments.unreadable += 1
        continue
      }
      if (bytes.length > EVIDENCE_MAX_BYTES) {
        report.attachments.tooLarge += 1
        continue
      }
      const sha256 = createHash("sha256").update(bytes).digest("hex")
      if (!input.dryRun) await writeEvidence(sha256, type, bytes)
      unit.attachments.push({
        kind: "evidence",
        sha256,
        type,
        size: bytes.length,
        fileName: evidenceFileName(attachment.originalName),
      })
    }

  const lastRunAt = account.user.movedToSpiegelAt ? new Date(account.user.movedToSpiegelAt) : null
  // die Zeit dieses Laufs: `updatedAt` jeder Zeile, die er schreibt, und das Merkmal in Treffsicher (`isTouched`)
  const runAt = new Date()
  const done: { check?: CheckResult; marked?: true } = {}
  try {
    await db.$transaction(
      async (tx) => {
        done.check = await write(tx, {
          account,
          toEmail,
          targetId,
          existing,
          owners,
          units,
          familyOf,
          siteId: siteId ?? 0,
          timeZone,
          lastRunAt,
          runAt,
          report,
        })
        if (input.dryRun) throw new DryRun()
        await input.source.markMoved(account.user.id, runAt)
        done.marked = true
      },
      { timeout: input.timeoutMs ?? TIMEOUT_MS, maxWait: 10_000 }
    )
  } catch (error) {
    // das Merkmal steht in Treffsicher, aber Spiegel hat nichts gespeichert: das alte zurück, sonst trüge keine Zeile
    // die Zeit des Merkmals und der nächste Lauf ließe alles stehen; geht auch das nicht, laut melden
    if (done.marked) {
      const restored = await input.source.markMoved(account.user.id, lastRunAt).then(
        () => true,
        () => false
      )
      if (!restored)
        return {
          kind: "aborted",
          abort: { kind: "markedNotSaved", previous: lastRunAt?.toISOString() ?? null },
        }
    }
    if (!(error instanceof DryRun)) throw error
  }
  return { kind: "done", report: { ...report, check: done.check! } }
}

/** der schreibende Teil des Laufs, in der Transaktion */
async function write(
  tx: Tx,
  ctx: {
    account: TreffsicherAccount
    toEmail: string
    targetId: string | null
    existing: Awaited<ReturnType<typeof targetRows>> | null
    owners: Map<string, string>
    units: Unit[]
    familyOf: (name: string) => number | null
    siteId: number
    timeZone: string
    lastRunAt: Date | null
    runAt: Date
    report: Omit<TransferReport, "check">
  }
): Promise<CheckResult> {
  const { account, units, report, lastRunAt, runAt, timeZone } = ctx
  report.sessions = units.length

  // 1. Konto
  let ownerId = ctx.targetId
  if (ownerId === null) {
    const user = account.user
    ownerId = (
      await tx.user.create({
        data: {
          email: ctx.toEmail,
          name: user.name,
          passwordHash: user.passwordHash,
          isActive: user.isActive,
          role: "USER",
          mustChangePassword: false,
        },
        select: { id: true },
      })
    ).id
    report.accountCreated = true
  }
  const firstRun = !(ctx.existing?.entries.length ?? 0)
  if (firstRun)
    await tx.diarySettings.upsert({
      where: { userId: ownerId },
      create: { userId: ownerId, enabled: true },
      update: { enabled: true },
    })
  report.diaryEnabled =
    (await tx.diarySettings.findUnique({ where: { userId: ownerId } }))?.enabled ?? false

  const cardsByKey = new Map((ctx.existing?.cards ?? []).map((c) => [c.importKey!, c]))
  const entriesByKey = new Map((ctx.existing?.entries ?? []).map((e) => [e.importKey!, e]))
  const goalSessions = new Set(account.goals.flatMap((goal) => goal.sessionIds))
  /** ein Eintrag gilt auch als geändert, wenn eine Zeile seiner Scheiben nicht vom letzten Lauf stammt (verknüpft, gelöst) */
  const entryTouched = (row: NonNullable<typeof ctx.existing>["entries"][number]) =>
    isTouched(row, lastRunAt) ||
    (lastRunAt !== null && row.cards.some((link) => !writtenInLastRun(link.updatedAt, lastRunAt)))
  const keptReason = (row: { deletedAt: Date | null; origin?: string }) =>
    row.deletedAt
      ? "Papierkorb"
      : row.origin === "pdf"
        ? "Werte vom Ausdruck"
        : row.origin === "manual"
          ? "von Hand geändert"
          : "geändert"

  /** eine früher übernommene Scheibe dieser Einheit entfernen, wenn sie unverändert ist */
  const removeOldCard = async (key: string, day: string) => {
    const old = cardsByKey.get(key)
    if (!old) return
    if (old.origin === "treffsicher" && !old.deletedAt) {
      await releaseImportedLinks(tx, [old.id])
      await purgeCards(tx, [old.id], { lock: true })
      report.cards.removed += 1
    } else {
      report.cards.kept += 1
      report.kept.push({ what: "card", day, reason: keptReason(old) })
    }
  }

  const checkUnits: CheckUnit[] = []
  const expectedEntries: { key: string; entry: ImportedEntry; kept: boolean }[] = []
  const executionsExpected = { rated: 0, placed: 0, skipped: 0, practice: 0, kept: 0 }
  for (const unit of units) {
    const { session, decision, key } = unit
    add(report.decisions, decision.kind === "none" ? decision.reason : decision.kind)
    if (decision.kind === "uncertain" && unit.card)
      report.uncertain.push({
        day: unit.day,
        family: session.discipline?.name ?? "",
        shots: unit.card.shots,
        total:
          (unit.scoring === "WHOLE"
            ? unit.card.details.total?.rings
            : unit.card.details.total?.decimalTenths) ?? null,
        others: decision.others.map((o) => ({ shots: o.shots, total: o.total })),
      })

    // die Scheibe der Einheit
    let unitCard: string | null = null
    let cardKept = false
    if (decision.kind === "new" || decision.kind === "uncertain") {
      const card = unit.card!
      const kind = session.type === "WETTKAMPF" ? "competition" : "training"
      const written = await writeTransferCard(tx, {
        ownerId,
        disciplineId: unit.disciplineId!,
        startedAtMs: unit.dateMs,
        kind,
        place: session.location,
        importKey: key,
        details: card.details,
      })
      if (written.kind === "saved") {
        unitCard = written.cardId
        report.cards[written.change] += 1
      } else if (written.kind === "notEditable" || written.kind === "missing") {
        const old = cardsByKey.get(key)
        cardKept = true
        unitCard = written.kind === "notEditable" && old ? old.id : null
        report.cards.kept += 1
        report.kept.push({
          what: "card",
          day: unit.day,
          reason: old ? keptReason(old) : "Papierkorb",
        })
      } else if (written.kind === "invalid") add(report.cards.invalid, written.problem)
      else throw new Error(`Scheibe aus Treffsicher: ${written.kind}`)
    } else await removeOldCard(key, unit.day)

    // die Scheiben, die der Eintrag hält
    const linkIds =
      decision.kind === "existing" ? decision.cardIds : unitCard !== null ? [unitCard] : []
    const withCard = linkIds.length > 0 || decision.kind === "probeEvening"
    const entry = entryFromSession(
      { ...session, dateMs: unit.dateMs },
      { importKey: key, familyId: unit.familyId, withCard, timeZone }
    )
    const old = entriesByKey.get(key)
    // nur Werte: kein Eintrag, die Scheibe trägt alles; ein Eintrag aus einem früheren Lauf bleibt (nichts wird gelöscht)
    const cardOnly = old === undefined && !needsEntry(session)
    const entryKept = old !== undefined && entryTouched(old)
    if (!cardOnly) expectedEntries.push({ key, entry, kept: entryKept })
    const rated = session.series.filter((x) => !x.isPractice && x.executionQuality !== null)
    executionsExpected.rated += rated.length
    const practice = session.series.filter((x) => x.isPractice && x.executionQuality !== null)
    executionsExpected.practice += practice.length
    report.executions.practiceSkipped += practice.length
    let entryId: string | null = null
    if (cardOnly) {
      report.cardOnly.units += 1
      if (goalSessions.has(session.id)) report.cardOnly.goalLinked += 1
      if (decision.kind === "none" || decision.kind === "probeEvening") report.cardOnly.noCard += 1
    } else if (entryKept) {
      report.entries.kept += 1
      report.kept.push({
        what: "entry",
        day: unit.day,
        reason: keptReason(old),
      })
      if (rated.length) report.executions.skipped.keptEntry += 1
      executionsExpected.kept += rated.length
    } else {
      const upserted = await upsertImportedEntry(tx, ownerId, entry, runAt)
      entryId = upserted.id
      report.entries[upserted.created ? "created" : "updated"] += 1
      // feste Zeilen: die neue Scheibe bzw. die passenden; eine Scheibe, die ein anderer Eintrag hält, bleibt dort
      const held = await tx.diaryEntryCard.findMany({
        where: { cardId: { in: linkIds } },
        select: { cardId: true, entryId: true },
      })
      const free = linkIds.filter((id) => {
        const row = held.find((h) => h.cardId === id)
        return !row || row.entryId === upserted.id
      })
      report.links.linkedElsewhere += linkIds.length - free.length
      await tx.diaryEntryCard.deleteMany({
        where: { entryId: upserted.id, link: "linked", cardId: { notIn: free } },
      })
      await setImportedLinks(tx, upserted.id, free, runAt)

      // die Ausführung auf die eine Scheibe des Eintrags
      let rows: { cardId: string; series: number; value: number }[] = []
      if (rated.length) {
        const target =
          unitCard !== null && !cardKept && unit.card
            ? {
                id: unitCard,
                series: (unit.card.details.series ?? []).map((s) => ({ series: s.series })),
              }
            : unit.executionCard
        if (!target) {
          const several =
            (decision.kind === "existing" || decision.kind === "probeEvening") &&
            decision.cardIds.length > 1
          report.executions.skipped[several ? "severalCards" : "noCard"] += 1
          executionsExpected.skipped += rated.length
        } else {
          const placed = executionsOnCard(session, target.series)
          if (placed === null) {
            report.executions.skipped.otherSeries += 1
            executionsExpected.skipped += rated.length
          } else {
            rows = placed.map((row) => ({ cardId: target.id, ...row }))
            report.executions.placed += 1
            report.executions.series += rows.length
            executionsExpected.placed += rows.length
          }
        }
      }
      await replaceExecutions(tx, upserted.id, rows)
    }

    // Anhänge
    const firstCard = decision.kind === "existing" ? decision.cardIds[0] : unitCard
    const evidenceCard =
      firstCard ??
      (decision.kind === "probeEvening" && decision.cardIds.length === 1
        ? decision.cardIds[0]
        : null)
    for (const attachment of unit.attachments) {
      const placed = await placeAttachment(tx, {
        ownerId,
        siteId: ctx.siteId,
        timeZone,
        card: (() => {
          const id = attachment.kind === "printout" ? firstCard : evidenceCard
          return id === null ? null : { id }
        })(),
        unit: unit.card
          ? {
              day: unit.day,
              scoring: unit.scoring,
              shots: unit.card.shots,
              total: unit.card.details.total ?? null,
            }
          : null,
        attachment,
      })
      countPlaced(report, placed)
      // eine Scheibe, die erst der Ausdruck einer Einheit ohne eigene Scheibe anlegt, hält ihr Eintrag
      if (
        entryId !== null &&
        placed.kind === "printoutImported" &&
        placed.result.kind === "created"
      )
        await setImportedLinks(tx, entryId, [placed.result.cardId], runAt)
    }

    checkUnits.push({
      sessionId: session.id,
      day: unit.day,
      decision: decision.kind === "none" ? decision.reason : decision.kind,
      scoring: unit.scoring,
      before: unit.card
        ? {
            shots: unit.card.shots,
            total:
              (unit.scoring === "WHOLE"
                ? unit.card.details.total?.rings
                : unit.card.details.total?.decimalTenths) ?? null,
          }
        : null,
      cardId: decision.kind === "existing" ? decision.cardIds[0] : unitCard,
      kept: cardKept,
      after: null,
    })
  }

  // Ziele und Abläufe
  const sessionOf = new Map(units.map((u) => [u.session.id, { familyId: u.familyId, day: u.day }]))
  const goalsByKey = new Map((ctx.existing?.goals ?? []).map((g) => [g.importKey!, g]))
  const goalLinks = { inside: 0, outside: 0, unknown: 0 }
  for (const goal of account.goals) {
    const key = transferKey(goal.id)
    const mapped = goalFromTreffsicher(goal, {
      importKey: key,
      sessionOf: (id) => sessionOf.get(id),
      timeZone,
    })
    report.goals.outsideLinks += mapped.outside
    report.goals.unknownLinks += mapped.unknown
    goalLinks.outside += mapped.outside
    goalLinks.unknown += mapped.unknown
    goalLinks.inside += goal.sessionIds.length - mapped.outside - mapped.unknown
    const old = goalsByKey.get(key)
    if (old && isTouched(old, lastRunAt)) {
      report.goals.kept += 1
      report.kept.push({
        what: "goal",
        day: null,
        reason: old.deletedAt ? "Papierkorb" : "geändert",
      })
      continue
    }
    const { created } = await upsertImportedGoal(tx, ownerId, mapped.goal, runAt)
    report.goals[created ? "created" : "updated"] += 1
  }
  const routinesByKey = new Map((ctx.existing?.routines ?? []).map((r) => [r.importKey!, r]))
  for (const routine of account.routines) {
    const key = transferKey(routine.id)
    const mapped = routineFromTreffsicher(routine, { importKey: key, familyOf: ctx.familyOf })
    if (mapped.flattened) report.routines.flattened += 1
    const old = routinesByKey.get(key)
    if (old && isTouched(old, lastRunAt)) {
      report.routines.kept += 1
      report.kept.push({
        what: "routine",
        day: null,
        reason: old.deletedAt ? "Papierkorb" : "geändert",
      })
      continue
    }
    const { created } = await upsertImportedRoutine(tx, ownerId, mapped.routine, runAt)
    report.routines[created ? "created" : "updated"] += 1
  }

  // verschwundene: in Treffsicher gelöscht, keinem anderen Konto zugeordnet
  const present = new Set([
    ...units.map((u) => u.session.id),
    ...account.goals.map((g) => g.id),
    ...account.routines.map((r) => r.id),
  ])
  const gone = (key: string | null) => {
    const id = sourceIdOf(key)
    return id !== null && !present.has(id) && !ctx.owners.has(id)
  }
  for (const card of ctx.existing?.cards ?? [])
    if (gone(card.importKey)) await removeOldCard(card.importKey!, "")
  for (const row of ctx.existing?.entries ?? [])
    if (gone(row.importKey)) {
      if (entryTouched(row)) {
        report.entries.kept += 1
        report.kept.push({ what: "entry", day: null, reason: "in Treffsicher gelöscht, geändert" })
      } else {
        await tx.diaryEntry.delete({ where: { id: row.id } })
        report.entries.removed += 1
      }
    }
  for (const row of ctx.existing?.goals ?? [])
    if (gone(row.importKey)) {
      if (isTouched(row, lastRunAt)) report.goals.kept += 1
      else {
        await tx.diaryGoal.delete({ where: { id: row.id } })
        report.goals.removed += 1
      }
    }
  for (const row of ctx.existing?.routines ?? [])
    if (gone(row.importKey)) {
      if (isTouched(row, lastRunAt)) report.routines.kept += 1
      else {
        await tx.diaryRoutine.delete({ where: { id: row.id } })
        report.routines.removed += 1
      }
    }

  return checkTransfer(
    await checkInput(tx, {
      ownerId,
      account,
      units: checkUnits,
      entries: expectedEntries,
      executions: executionsExpected,
      goalLinks,
      report,
    })
  )
}

function countPlaced(report: Omit<TransferReport, "check">, placed: PlacedAttachment) {
  const { printouts, evidence } = report.attachments
  switch (placed.kind) {
    case "evidence":
      if (
        placed.result === "attached" ||
        placed.result === "duplicate" ||
        placed.result === "limit"
      )
        evidence[placed.result] += 1
      else evidence.gone += 1
      return
    case "evidenceNoCard":
      evidence.noCard += 1
      return
    case "printoutOwnCard":
      if (placed.result.kind === "attached") printouts.ownCard += 1
      else {
        printouts.notPlaced += 1
        add(report.printoutsNotPlaced, placed.result.kind)
      }
      return
    case "printoutUnitCard":
      printouts[
        placed.adopted === "adopted"
          ? "adopted"
          : placed.adopted === "notTreffsicher"
            ? "keepsValues"
            : "withoutValues"
      ] += 1
      return
    case "printoutImported":
      if (placed.result.kind === "created" || placed.result.kind === "attached")
        printouts.imported += 1
      else {
        printouts.notPlaced += 1
        add(report.printoutsNotPlaced, placed.result.kind)
      }
  }
}

/** was der Prüfbestand nach dem Schreiben liest, noch in der Transaktion (auch der Probelauf prüft) */
async function checkInput(
  tx: Tx,
  input: {
    ownerId: string
    account: TreffsicherAccount
    units: CheckUnit[]
    entries: { key: string; entry: ImportedEntry; kept: boolean }[]
    executions: { rated: number; placed: number; skipped: number; practice: number; kept: number }
    goalLinks: { inside: number; outside: number; unknown: number }
    report: Omit<TransferReport, "check">
  }
): Promise<Parameters<typeof checkTransfer>[0]> {
  const { ownerId, account, report } = input
  const cardIds = input.units.flatMap((u) => (u.cardId ? [u.cardId] : []))
  const cards = await tx.card.findMany({
    where: { id: { in: cardIds }, ownerId },
    select: {
      id: true,
      origin: true,
      deletedAt: true,
      projection: { select: { values: true, printedShots: true } },
    },
  })
  const cardOf = new Map(cards.map((c) => [c.id, c]))
  const units = input.units.map((unit) => {
    const card = unit.cardId ? cardOf.get(unit.cardId) : undefined
    const totals: CardTotals | null = card?.projection
      ? cardTotals({
          values: card.projection.values as Record<string, { value: number; n: number }>,
        })
      : null
    return {
      ...unit,
      adopted: card?.origin === "pdf" && unit.decision !== "existing",
      after:
        card && card.projection && totals
          ? {
              shots: card.projection.printedShots,
              total: unit.scoring === "WHOLE" ? totals.rings : totals.decimalTenths,
            }
          : null,
    }
  })
  const keys = input.entries.map((e) => e.key)
  const stored = await tx.diaryEntry.findMany({
    where: { userId: ownerId, importKey: { in: keys } },
    include: { scales: true },
  })
  const storedOf = new Map(stored.map((row) => [row.importKey!, row]))
  const written = input.entries.filter((e) => !e.kept).map((e) => e.key)
  const executions = await tx.diarySeriesExecution.count({
    where: { entry: { userId: ownerId, importKey: { in: written } } },
  })
  const goals = await tx.diaryGoal.count({
    where: { userId: ownerId, importKey: { in: account.goals.map((g) => transferKey(g.id)) } },
  })
  const routines = await tx.diaryRoutine.count({
    where: { userId: ownerId, importKey: { in: account.routines.map((r) => transferKey(r.id)) } },
  })

  // je Feld eines Eintrags: erwartet aus Treffsicher (`entryFromSession`), gespeichert gleich
  const fieldNames = [
    "intention",
    "outcome",
    "learned",
    "question",
    "note",
    "expectedScore",
  ] as const
  const tables: TableCheck[] = [
    {
      name: "Einheiten → Einträge",
      before: input.entries.length + input.report.cardOnly.units,
      after: stored.length,
      explained: input.report.cardOnly.units
        ? { "nur Werte, kein Eintrag": input.report.cardOnly.units }
        : {},
    },
  ]
  for (const field of fieldNames) {
    let before = 0
    let after = 0
    let kept = 0
    for (const { key, entry, kept: isKept } of input.entries) {
      if (entry[field] === null) continue
      before += 1
      if (isKept) {
        kept += 1
        continue
      }
      const row = storedOf.get(key)
      const value = row?.[field]
      const same =
        field === "expectedScore"
          ? value !== null && value !== undefined && Number(value) === entry.expectedScore
          : value === entry[field]
      if (same) after += 1
    }
    tables.push({
      name: `Feld ${field}`,
      before,
      after,
      explained: kept ? { "geändert, bleibt": kept } : {},
    })
  }
  for (const part of ["wellbeing", "prognosis", "feedback"] as const) {
    let before = 0
    let after = 0
    let kept = 0
    for (const { key, entry, kept: isKept } of input.entries) {
      const wanted = entry.scales.filter((s) => s.part === part)
      before += wanted.length
      if (isKept) {
        kept += wanted.length
        continue
      }
      const row = storedOf.get(key)
      after += wanted.filter((s) =>
        row?.scales.some((r) => r.part === part && r.aspect === s.aspect && r.value === s.value)
      ).length
    }
    tables.push({
      name: `Werte ${part}`,
      before,
      after,
      explained: kept ? { "geändert, bleibt": kept } : {},
    })
  }
  const ex = input.executions
  tables.push({
    name: "Serien mit Ausführung",
    before: ex.rated,
    after: ex.placed,
    explained: {
      ...(ex.skipped ? { "ausgelassen (keine eine Scheibe oder andere Serien)": ex.skipped } : {}),
      ...(ex.kept ? { "geändert, bleibt": ex.kept } : {}),
    },
  })
  tables.push({
    name: "Ausführung gespeichert",
    before: ex.placed,
    after: executions,
    explained: {},
  })
  const a = report.attachments
  const placedPrintouts =
    a.printouts.ownCard +
    a.printouts.adopted +
    a.printouts.withoutValues +
    a.printouts.keepsValues +
    a.printouts.imported
  const placedEvidence = a.evidence.attached + a.evidence.duplicate
  const rejected = Object.values(a.printoutRejected).reduce((s, n) => s + (n ?? 0), 0)
  tables.push({
    name: "Anhänge",
    before: a.total,
    after: placedPrintouts + placedEvidence,
    explained: Object.fromEntries(
      Object.entries({
        "Datei fehlt": a.fileMissing,
        unlesbar: a.unreadable,
        "zu groß": a.tooLarge,
        "Ausdruck nicht angehängt": a.printouts.notPlaced,
        "Beleg ohne Scheibe": a.evidence.noCard,
        "Grenze der Belege": a.evidence.limit,
        "Scheibe nicht sichtbar": a.evidence.gone,
      }).filter(([, n]) => n > 0)
    ),
    note: rejected ? `${rejected} PDF ohne lesbaren Ausdruck als Beleg` : undefined,
  })
  tables.push({
    name: "Ziele",
    before: account.goals.length,
    after: goals,
    explained: {},
  })
  tables.push({
    name: "Abläufe",
    before: account.routines.length,
    after: routines,
    explained: {},
  })
  const links = input.goalLinks
  tables.push({
    name: "Verknüpfungen von Zielen",
    before: links.inside + links.outside + links.unknown,
    after: links.inside,
    explained: Object.fromEntries(
      Object.entries({
        "außerhalb des Zeitraums": links.outside,
        "Einheit unbekannt": links.unknown,
      }).filter(([, n]) => n > 0)
    ),
  })
  return { units, tables, sample: sampleOf(account, input.entries, storedOf) }
}

/** die fünf Einheiten mit den meisten Texten, je Feld vorher und nachher */
function sampleOf(
  account: TreffsicherAccount,
  entries: { key: string; entry: ImportedEntry; kept: boolean }[],
  storedOf: Map<
    string,
    {
      intention: string | null
      learned: string | null
      question: string | null
      note: string | null
    }
  >
): SampleUnit[] {
  const texts = (s: TreffsicherSession) =>
    [
      s.trainingGoal,
      s.prognosis?.performanceGoal,
      s.reflection?.observations,
      s.reflection?.insight,
      s.reflection?.learningQuestion,
      s.reflection?.routineDeviation,
      s.feedback?.explanation,
      s.feedback?.goalAchievedNote,
      s.feedback?.progress,
      s.feedback?.fiveBestShots,
      s.feedback?.wentWell,
      s.feedback?.insights,
    ].reduce((sum, t) => sum + (t?.length ?? 0), 0)
  const top = [...account.sessions].sort((a, b) => texts(b) - texts(a)).slice(0, 5)
  return top.map((s) => {
    const key = transferKey(s.id)
    const row = storedOf.get(key)
    const kept = entries.find((e) => e.key === key)?.kept ?? false
    return {
      date: s.date,
      kept,
      fields: [
        { field: "Trainingsziel", before: s.trainingGoal, after: row?.intention ?? null },
        {
          field: "Leistungsziel",
          before: s.prognosis?.performanceGoal ?? null,
          after: row?.intention ?? null,
        },
        { field: "Erkenntnis", before: s.reflection?.insight ?? null, after: row?.learned ?? null },
        {
          field: "Lernfrage",
          before: s.reflection?.learningQuestion ?? null,
          after: row?.question ?? null,
        },
        {
          field: "Beobachtungen und übrige Texte",
          before:
            [
              s.reflection?.observations,
              s.reflection?.routineDeviation,
              s.feedback?.explanation,
              s.feedback?.goalAchievedNote,
              s.feedback?.progress,
              s.feedback?.fiveBestShots,
              s.feedback?.wentWell,
              s.feedback?.insights,
            ]
              .filter((t) => t?.trim())
              .join("\n\n") || null,
          after: row?.note ?? null,
        },
      ],
    }
  })
}
