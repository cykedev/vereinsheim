import type { HeartbeatV1 } from "@vereinsheim/ingest-contract/api"
import { formatDateOnly, formatDateTime } from "@vereinsheim/lib/format"

import { requireAdmin } from "@/lib/auth-helpers"
import { consentStatus, type ConsentDecisions, type ConsentStatus } from "@/lib/consent/status"
import { db } from "@/lib/db"
import { NOT_MINE } from "@/lib/db/purge"
import { COUNTED_CARD } from "@/lib/db/visible"

import { disciplineTaskCounts } from "./disciplines"
import type { AdminHelpId } from "./help"
import { heldBackText } from "./site"

// Übersicht des Admins: oben, was ein Mensch entscheiden muss, darunter der Weg einer Scheibe in vier
// Stationen mit ihrem Stand. Das Modell ist eine reine Funktion; `adminOverview` liest dafür nur Zahlen und Namen.

export interface AdminTask {
  id: string
  title: string
  detail: string
  href: string
  action: string
}

export type StationTone = "ok" | "wait" | "neutral"

export interface Station {
  id: "site" | "bridge" | "consents" | "accounts"
  help: AdminHelpId
  title: string
  /** was die Station tut, ein Satz */
  does: string
  /** Stand in Worten */
  status: string
  tone: StationTone
  /** Zusatz unter dem Satz; leer ohne */
  facts: string[]
}

export interface AdminOverviewModel {
  tasks: AdminTask[]
  stations: Station[]
}

export interface OverviewInput {
  /** `foreignSource`: eine Brücke schickt aus einer Ablage, die Spiegel nicht kennt (kommt nicht vor; Hinweis) */
  site: { name: string; foreignSource: boolean } | null
  bridge: {
    name: string
    lastHeartbeatAt: string | null
    online: boolean
    status: HeartbeatV1["status"] | null
    heldBack: string | null
  } | null
  /** Zustimmungen aktiver Konten: ein deaktiviertes bekommt nichts, dort wartet keine Entscheidung */
  consents: {
    id: number
    userId: string
    who: string
    sportpassId: string
    consentedAt: string
    status: ConsentStatus
  }[]
  accounts: { total: number; deactivated: number; withSportpass: number }
  /** Scheiben der Anlage, als „nicht meine“ gemeldet (Grabsteine): nur als Zahl, ohne Namen */
  notMine: number
  /** aktive Zustimmungen, deren ältere Scheiben Spiegel noch holt: Zustand, keine Aufgabe */
  historyPending: number
  /** Nutzung: sichtbare Scheiben aktiver Konten, davon in den letzten 30 Tagen, Konten mit solchen */
  usage: { cards: number; recentCards: number; recentAccounts: number }
  /** neue Disziplinen mit Scheiben: deren Scheiben warten (ohne Scheibe oder Familie) oder mit Vorschlag */
  disciplines: { waiting: number; suggested: number }
}

/** was die Brücke meldet, in Worten; nur Information, keine Aufgabe */
const BRIDGE_NOTE: Partial<Record<HeartbeatV1["status"], string>> = {
  delayed: "schickt gerade langsamer als sonst",
  "db-unreachable": "erreicht die Meyton-Anlage nicht",
  "db-error": "bekommt Fehler von der Meyton-Anlage",
  "possible-reset":
    "Die Meyton-Anlage wirkt wie neu aufgesetzt. Spiegel trennt alte und neue Scheiben selbst. Du musst nichts tun.",
  // SF-79: ein Zustand, keine Aufgabe; meist stellt sich die Uhr selbst (Textbuch „Uhr der Brücke“)
  clock:
    "Die Uhr am Gerät der Brücke geht falsch. Bis sie stimmt, schickt die Brücke keine Scheiben. Meist stellt sich die Uhr nach ein paar Minuten von selbst. Bleibt der Hinweis länger, muss jemand vor Ort die Uhrzeit am Gerät prüfen. Danach kommen alle Scheiben nach.",
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function overviewModel(input: OverviewInput): AdminOverviewModel {
  const tasks: AdminTask[] = []
  if (!input.site)
    tasks.push({
      id: "site",
      title: "Meyton-Anlage einrichten",
      detail: "Einmal Name und Zeitzone eintragen.",
      href: "/admin/site",
      action: "Einrichten",
    })
  for (const consent of input.consents.filter(
    (c) => c.status === "requested" || c.status === "returned"
  ))
    tasks.push({
      id: `consent-${consent.id}`,
      title:
        consent.status === "returned"
          ? `${consent.who} hat eine Scheibe als „nicht meine“ zurückgewiesen`
          : `${consent.who} möchte die eigenen Scheiben automatisch bekommen`,
      detail:
        consent.status === "returned"
          ? `Prüf die Sportpassnummer ${consent.sportpassId} noch einmal.`
          : `Sportpassnummer ${consent.sportpassId}, eingetragen am ${consent.consentedAt}`,
      href: `/admin/users/${consent.userId}`,
      action: "Nummer prüfen",
    })
  const { waiting: waitingDisciplines, suggested } = input.disciplines
  if (waitingDisciplines || suggested)
    tasks.push(
      waitingDisciplines
        ? {
            id: "disciplines",
            title:
              waitingDisciplines === 1
                ? "Eine neue Disziplin: Scheiben warten"
                : `${waitingDisciplines} neue Disziplinen: Scheiben warten`,
            detail: "Spiegel zeigt diese Scheiben erst, wenn du die Disziplin einordnest.",
            href: "/admin/disciplines",
            action: "Einordnen",
          }
        : {
            id: "disciplines",
            title:
              suggested === 1
                ? "Eine neue Disziplin prüfen"
                : `${suggested} neue Disziplinen prüfen`,
            detail: "Spiegel hat sie selbst eingeordnet. Ein kurzer Blick reicht.",
            href: "/admin/disciplines",
            action: "Prüfen",
          }
    )
  if (input.site && !input.bridge)
    tasks.push({
      id: "bridge",
      title: "Brücke verbinden",
      detail: "Ohne Brücke kommen keine Scheiben aus dem Schützenhaus.",
      href: "/admin/site",
      action: "Verbinden",
    })

  const by = (status: ConsentStatus) => input.consents.filter((c) => c.status === status).length
  const waiting = by("requested") + by("returned")
  const bridge = input.bridge
  const bridgeFacts = bridge
    ? [
        bridge.lastHeartbeatAt ? `zuletzt online ${bridge.lastHeartbeatAt}` : "noch kein Kontakt",
        bridge.status ? BRIDGE_NOTE[bridge.status] : undefined,
        bridge.heldBack ?? undefined,
      ].filter((fact): fact is string => !!fact)
    : []

  return {
    tasks,
    stations: [
      {
        id: "site",
        help: "site",
        title: "Meyton-Anlage",
        does: "Hier entstehen alle Scheiben. Spiegel liest sie nur und ändert an der Anlage nie etwas.",
        status: input.site ? "eingerichtet" : "noch nicht eingerichtet",
        tone: input.site && !input.site.foreignSource ? "ok" : "wait",
        facts: input.site
          ? [
              input.site.name,
              ...(input.site.foreignSource
                ? [
                    "Eine Brücke schickt Scheiben von einer Meyton-Anlage, die Spiegel nicht kennt. Spiegel nimmt sie nicht an. Das sollte nie passieren. Bitte melde es.",
                  ]
                : []),
            ]
          : [],
      },
      {
        id: "bridge",
        help: "bridge",
        title: "Brücke im Schützenhaus",
        does: "Ein kleines Gerät an der Meyton-Anlage. Es schickt nur Scheiben von Schützen, die zugestimmt haben. Scheiben mit verdeckter Wertung nie.",
        status: !bridge
          ? "nicht verbunden"
          : !bridge.lastHeartbeatAt
            ? "noch kein Kontakt"
            : bridge.online
              ? "läuft"
              : "aus (nach dem Training normal)",
        tone: !bridge || !bridge.lastHeartbeatAt ? "wait" : bridge.online ? "ok" : "neutral",
        facts: bridge ? [bridge.name, ...bridgeFacts] : [],
      },
      {
        id: "consents",
        help: "consent",
        title: "Zustimmungen",
        does: "Ein Schütze trägt im Profil die eigene Sportpassnummer ein und stimmt zu. Du prüfst einmal, ob die Nummer stimmt.",
        status: waiting
          ? `${waiting} ${waiting === 1 ? "wartet" : "warten"} auf dich`
          : count(by("active"), "aktiv", "aktiv"),
        tone: waiting ? "wait" : "neutral",
        facts: [
          `${by("active")} aktiv · ${waiting} ${waiting === 1 ? "wartet" : "warten"} auf dich · ${by("rejected")} abgelehnt`,
          ...(input.historyPending
            ? [
                `Für ${count(input.historyPending, "Schützen", "Schützen")} holt Spiegel noch ältere Scheiben. Das passiert, wenn im Schützenhaus niemand schießt.`,
              ]
            : []),
          ...(input.notMine
            ? [
                input.notMine === 1
                  ? "1 Scheibe wurde als „nicht meine“ zurückgewiesen. Sie kommt nicht wieder. Am Konto kannst du sie wieder zulassen, solange die Nummer dort steht."
                  : `${input.notMine} Scheiben wurden als „nicht meine“ zurückgewiesen. Sie kommen nicht wieder. Am Konto kannst du sie wieder zulassen, solange die Nummer dort steht.`,
              ]
            : []),
        ],
      },
      {
        id: "accounts",
        help: "accounts",
        title: "Konten",
        does: "Wer Spiegel nutzt. Alle sehen nur die eigenen Scheiben, auch du als Admin.",
        status: String(input.accounts.total),
        tone: "neutral",
        facts: [
          [
            count(input.accounts.total, "Konto", "Konten"),
            `${input.accounts.withSportpass} mit Sportpass`,
            input.accounts.deactivated ? `${input.accounts.deactivated} deaktiviert` : null,
          ]
            .filter(Boolean)
            .join(" · "),
          usageText(input.usage),
        ],
      },
    ],
  }
}

/** die Zeile zur Nutzung */
function usageText({ cards, recentCards, recentAccounts }: OverviewInput["usage"]): string {
  if (!cards) return "Noch keine Scheibe in Spiegel."
  // ohne frische Scheiben kein „0 davon … 0 Konten haben“
  if (!recentCards)
    return `${count(cards, "Scheibe", "Scheiben")}, keine davon in den letzten 30 Tagen.`
  return `${count(cards, "Scheibe", "Scheiben")}, ${recentCards} davon in den letzten 30 Tagen. ${
    recentAccounts === 1 ? "1 Konto hat" : `${recentAccounts} Konten haben`
  } in den letzten 30 Tagen geschossen.`
}

/** „Für N Schützen holt Spiegel noch ältere Scheiben“: Konten, nicht Nummern */
export function accountsLoadingHistory(
  consents: readonly (ConsentDecisions & { userId: string; historyLoadedAt: Date | null })[]
): number {
  return new Set(
    consents
      .filter((c) => consentStatus(c) === "active" && c.historyLoadedAt === null)
      .map((c) => c.userId)
  ).size
}

const RECENT_MS = 30 * 86_400_000

/**
 * Nutzung über aktive Konten, nur sichtbare Scheiben, nach ihrem Beginn; Zahlen, keine Inhalte. `ownerIds`
 * grenzt auf diese Konten ein (Tests).
 */
export async function usageOf(nowMs: number, ownerIds?: string[]): Promise<OverviewInput["usage"]> {
  const visible = {
    ...COUNTED_CARD,
    owner: { isActive: true },
    ...(ownerIds ? { ownerId: { in: ownerIds } } : {}),
  }
  const recent = { ...visible, startedAt: { gte: new Date(nowMs - RECENT_MS) } }
  const [cards, recentCards, recentOwners] = await Promise.all([
    db.card.count({ where: visible }),
    db.card.count({ where: recent }),
    db.card.groupBy({ by: ["ownerId"], where: recent }),
  ])
  return { cards, recentCards, recentAccounts: recentOwners.length }
}

/** eine Brücke gilt als online, wenn ihr letzter Heartbeat so jung ist (sie schickt jede Minute einen) */
const ONLINE_MS = 5 * 60_000

/** die Übersicht für den Admin; prüft selbst (`requireAdmin`) */
export async function adminOverview(
  timeZone: string,
  nowMs = Date.now()
): Promise<AdminOverviewModel> {
  await requireAdmin()
  const site = await db.site.findFirst({ orderBy: { id: "asc" }, select: { id: true, name: true } })
  const [bridge, consents, users, notMine, usage, disciplines] = await Promise.all([
    site
      ? db.bridge.findFirst({
          where: { siteId: site.id, revokedAt: null },
          orderBy: [{ lastHeartbeatAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
          select: { name: true, lastHeartbeatAt: true, heartbeat: true },
        })
      : null,
    db.sportpassConsent.findMany({
      orderBy: [{ consentedAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        userId: true,
        sportpassId: true,
        consentedAt: true,
        confirmedAt: true,
        rejectedAt: true,
        returnedAt: true,
        historyLoadedAt: true,
        user: { select: { name: true, email: true } },
      },
      // deaktivierte Konten bekommen nichts; dort wartet keine Entscheidung, und sie zählen nicht als „mit Sportpass“
      where: { user: { isActive: true } },
    }),
    db.user.findMany({ select: { id: true, isActive: true } }),
    site ? db.tombstone.count({ where: { source: { siteId: site.id }, reason: NOT_MINE } }) : 0,
    usageOf(nowMs),
    disciplineTaskCounts(),
  ])
  const rows = consents.map((c) => ({
    id: c.id,
    userId: c.userId,
    who: c.user.name ?? c.user.email,
    sportpassId: c.sportpassId.toString(),
    consentedAt: formatDateOnly(c.consentedAt, timeZone),
    status: consentStatus(c),
  }))
  const withSportpass = new Set(rows.filter((r) => r.status === "active").map((r) => r.userId))
  const heartbeat = bridge?.heartbeat as HeartbeatV1 | null | undefined
  return overviewModel({
    site: site
      ? {
          name: site.name,
          foreignSource:
            (await db.source.count({ where: { siteId: site.id, confirmedAt: null } })) > 0,
        }
      : null,
    bridge: bridge
      ? {
          name: bridge.name,
          lastHeartbeatAt: bridge.lastHeartbeatAt
            ? formatDateTime(bridge.lastHeartbeatAt, timeZone)
            : null,
          online: !!bridge.lastHeartbeatAt && nowMs - bridge.lastHeartbeatAt.getTime() < ONLINE_MS,
          status: heartbeat?.status ?? null,
          heldBack: heldBackText(heartbeat?.heldBack ?? []),
        }
      : null,
    consents: rows,
    accounts: {
      total: users.length,
      deactivated: users.filter((u) => !u.isActive).length,
      withSportpass: withSportpass.size,
    },
    notMine,
    historyPending: accountsLoadingHistory(consents),
    usage,
    disciplines,
  })
}
