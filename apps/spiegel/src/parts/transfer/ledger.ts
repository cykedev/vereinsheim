// Das Hauptbuch der Übernahme ([[spiegel-account-transfer]]): je Lauf, der gespeichert hat, eine Zeile `TransferRun`,
// je übernommenes Stück eine Zeile `TransferItem` mit dem Stand, den der letzte Lauf hinterließ. Der nächste Lauf
// entscheidet daran, ohne Heuristik: unverändert ist ein Stück, das noch genau so dasteht; in Spiegel gelöscht ist ein
// Stück, das im Hauptbuch steht und fehlt; was nicht im Hauptbuch steht, wurde nie platziert und wird neu versucht.
// Nur `src/parts/transfer` liest und schreibt die Tabellen (`boundary.test.ts`).

import type { Prisma, TransferItemKind } from "@/generated/prisma/client"
import type { Db } from "@/lib/db"

type Tx = Prisma.TransactionClient

/** Version der Regeln der Übernahme, je Lauf im Hauptbuch */
export const TRANSFER_VERSION = 1

/** die Schlüssel aus Treffsicher je Art; mit `kind` eindeutig (Liste am Modell `TransferItem`) */
export const ledgerKey = {
  /** die Scheibe einer Einheit, ihr Eintrag */
  session: (sessionId: string) => `session:${sessionId}`,
  /** Ausdruck oder Beleg eines Anhangs, die Scheibe, die ein Ausdruck anlegte */
  attachment: (attachmentId: string) => `attachment:${attachmentId}`,
  goal: (goalId: string) => `goal:${goalId}`,
  routine: (routineId: string) => `routine:${routineId}`,
  /** eine feste Verknüpfung des Eintrags einer Einheit mit einer Scheibe in Spiegel */
  link: (sessionId: string, cardId: string) => `session:${sessionId}/card:${cardId}`,
}

/** die Einheit, das Ziel oder der Ablauf eines Schlüssels; null bei Anhängen */
export function sourceOfKey(
  sourceKey: string
): { kind: "session" | "goal" | "routine"; id: string } | null {
  const match = /^(session|goal|routine):([^/]+)/.exec(sourceKey)
  return match ? { kind: match[1] as "session" | "goal" | "routine", id: match[2] } : null
}

export interface LedgerItem {
  kind: TransferItemKind
  sourceKey: string
  spiegelId: string
  sha256: string | null
  writtenAt: Date | null
  revisionId: bigint | null
  cardState: string | null
}

export interface Ledger {
  /** gespeicherte Läufe; keiner: der erste Lauf */
  runs: number
  get(kind: TransferItemKind, sourceKey: string): LedgerItem | undefined
  all(kind: TransferItemKind): LedgerItem[]
  /** die verzeichneten Verknüpfungen des Eintrags einer Einheit: Scheibe → Zeit */
  links(sessionId: string): Map<string, number>
}

export async function loadLedger(db: Db | Tx, userId: string | null): Promise<Ledger> {
  const [runs, rows] =
    userId === null
      ? [0, []]
      : [
          await db.transferRun.count({ where: { userId } }),
          await db.transferItem.findMany({
            where: { userId },
            select: {
              kind: true,
              sourceKey: true,
              spiegelId: true,
              sha256: true,
              writtenAt: true,
              revisionId: true,
              cardState: true,
            },
          }),
        ]
  const byKey = new Map(rows.map((row) => [`${row.kind}|${row.sourceKey}`, row]))
  return {
    runs,
    get: (kind, sourceKey) => byKey.get(`${kind}|${sourceKey}`),
    all: (kind) => rows.filter((row) => row.kind === kind),
    links: (sessionId) => {
      const prefix = `${ledgerKey.session(sessionId)}/card:`
      return new Map(
        rows
          .filter((row) => row.kind === "link" && row.sourceKey.startsWith(prefix))
          .map((row) => [row.spiegelId, row.writtenAt?.getTime() ?? -1])
      )
    },
  }
}

/** die Läufe eines Kontos für den Export: Zeit, Version, Zahlen; die Stücke nicht (Buchhaltung ohne Wert für den User) */
export function transferExport(db: Db, userId: string) {
  return db.transferRun.findMany({
    where: { userId },
    orderBy: { at: "asc" },
    select: { at: true, version: true, counts: true },
  })
}

/**
 * Herkunft und was der User an einer Scheibe außerhalb von Revisionen ändern kann; Jobs ändern es nicht. Die Herkunft
 * verzeichnet auch, dass die Übernahme selbst die Werte eines Ausdrucks übernommen hat (`pdf`)
 */
export function cardState(card: {
  origin: string
  disciplineId: number
  kind: string
  kindChoice: string | null
  scoringChoice: string | null
  standDisciplineId: number | null
  place: string | null
}): string {
  return JSON.stringify([
    card.origin,
    card.disciplineId,
    card.kind,
    card.kindChoice,
    card.scoringChoice,
    card.standDisciplineId,
    card.place,
  ])
}

/**
 * Steht die Scheibe noch so da, wie der Lauf sie hinterließ? Dieselbe Herkunft und Wahl (`cardState`), nicht im
 * Papierkorb, nicht geteilt, kein eigener Beleg; bei Herkunft `treffsicher` dazu dieselbe Revision. Jobs (Nachrechnen,
 * Projektion, Zustände) schreiben an Scheiben aus Treffsicher keine Revision und ändern nichts davon; `updatedAt` zählt
 * deshalb nicht. An einer Scheibe, deren Werte die Übernahme vom Ausdruck nahm (`pdf`), schreibt das Neulesen der
 * Ausdrucke Revisionen: Dort zählt die Revision nicht.
 */
export function cardUnchanged(
  item: Pick<LedgerItem, "revisionId" | "cardState">,
  card: Parameters<typeof cardState>[0] & {
    origin: string
    deletedAt: Date | null
    currentRevisionId: bigint | null
    shareId: string | null
  },
  ownEvidence: number
): boolean {
  return (
    (card.origin === "treffsicher" || card.origin === "pdf") &&
    card.deletedAt === null &&
    (card.origin === "pdf" || card.currentRevisionId === item.revisionId) &&
    cardState(card) === item.cardState &&
    card.shareId === null &&
    ownEvidence === 0
  )
}

/** Steht die Zeile des Tagebuchs noch so da, wie der Lauf sie hinterließ (`updatedAt`, nicht im Papierkorb)? */
export function diaryRowUnchanged(
  item: Pick<LedgerItem, "writtenAt">,
  row: { updatedAt: Date; deletedAt: Date | null }
): boolean {
  return (
    row.deletedAt === null &&
    item.writtenAt !== null &&
    row.updatedAt.getTime() === item.writtenAt.getTime()
  )
}

/**
 * Hat der Eintrag noch genau die verzeichneten Verknüpfungen, fest und mit derselben Zeit? Eine gelöste, eine neue oder
 * eine fehlende ist eine Änderung des Users
 */
export function linksUnchanged(
  recorded: Map<string, number>,
  rows: readonly { cardId: string; link: string; updatedAt: Date }[]
): boolean {
  return (
    rows.length === recorded.size &&
    rows.every(
      (row) => row.link === "linked" && recorded.get(row.cardId) === row.updatedAt.getTime()
    )
  )
}

/** ein Stück verzeichnen oder seinen Stand ersetzen */
export function recordItem(
  tx: Tx,
  userId: string,
  item: Omit<LedgerItem, "sha256" | "writtenAt" | "revisionId" | "cardState"> &
    Partial<Pick<LedgerItem, "sha256" | "writtenAt" | "revisionId" | "cardState">>
) {
  const data = {
    spiegelId: item.spiegelId,
    sha256: item.sha256 ?? null,
    writtenAt: item.writtenAt ?? null,
    revisionId: item.revisionId ?? null,
    cardState: item.cardState ?? null,
  }
  return tx.transferItem.upsert({
    where: { userId_kind_sourceKey: { userId, kind: item.kind, sourceKey: item.sourceKey } },
    create: { userId, kind: item.kind, sourceKey: item.sourceKey, ...data },
    update: data,
  })
}

/** Ausdrucke, Belege und Verknüpfungen an einer Scheibe, die der Lauf entfernt hat: Sie waren nie anderswo platziert */
export function forgetOnCard(tx: Tx, userId: string, cardId: string) {
  return tx.transferItem.deleteMany({
    where: { userId, kind: { in: ["printout", "evidence", "link"] }, spiegelId: cardId },
  })
}

export function forgetItem(tx: Tx, userId: string, kind: TransferItemKind, sourceKey: string) {
  return tx.transferItem.deleteMany({ where: { userId, kind, sourceKey } })
}

/** die Verknüpfungen des Eintrags einer Einheit, die nicht mehr fest sind, aus dem Hauptbuch nehmen */
export function forgetLinksExcept(
  tx: Tx,
  userId: string,
  sessionId: string,
  cardIds: readonly string[]
) {
  return tx.transferItem.deleteMany({
    where: {
      userId,
      kind: "link",
      sourceKey: { startsWith: `${ledgerKey.session(sessionId)}/card:` },
      spiegelId: { notIn: [...cardIds] },
    },
  })
}
