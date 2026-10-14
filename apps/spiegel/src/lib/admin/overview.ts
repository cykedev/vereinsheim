import type { HeartbeatV1 } from "@vereinsheim/ingest-contract/api"
import { formatDateTime } from "@vereinsheim/lib/format"

import { requireAdmin } from "@/lib/auth-helpers"
import { consentStatus, type ConsentStatus } from "@/lib/consent/status"
import { db } from "@/lib/db"
import { NOT_MINE } from "@/lib/db/purge"

import type { AdminHelpId } from "./help"
import { heldBackText } from "./site"

// Übersicht des Admins (P2c, D3): oben, was ein Mensch entscheiden muss (D0), darunter der Weg einer Scheibe in vier
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
  /** `foreignSource`: eine Brücke schickt aus einer Ablage, die Spiegel nicht kennt (kommt nicht vor; Hinweis, D0) */
  site: { name: string; foreignSource: boolean } | null
  bridge: {
    name: string
    lastHeartbeatAt: string | null
    online: boolean
    status: HeartbeatV1["status"] | null
    heldBack: string | null
  } | null
  /** Zustimmungen aktiver Konten: ein deaktiviertes bekommt nichts, dort wartet keine Entscheidung (Review) */
  consents: {
    id: number
    userId: string
    who: string
    sportpassId: string
    consentedAt: string
    status: ConsentStatus
  }[]
  accounts: { total: number; deactivated: number; withSportpass: number }
  /** Scheiben der Anlage, als „nicht meine“ gemeldet (Grabsteine): nur als Zahl, ohne Namen (P2b, D9) */
  notMine: number
}

/** was die Brücke meldet, in Worten; nur Information (D0), keine Aufgabe */
const BRIDGE_NOTE: Partial<Record<HeartbeatV1["status"], string>> = {
  delayed: "meldet: schickt verzögert",
  "db-unreachable": "meldet: Anlage nicht erreichbar",
  "db-error": "meldet: Anlage meldet Fehler",
  "possible-reset":
    "meldet: Ablage der Anlage sieht neu aus; Spiegel trennt alte und neue Scheiben selbst",
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function overviewModel(input: OverviewInput): AdminOverviewModel {
  const tasks: AdminTask[] = []
  if (!input.site)
    tasks.push({
      id: "site",
      title: "Anlage einrichten",
      detail: "Name und Zeitzone der Meyton-Anlage, einmal.",
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
          ? `${consent.who}: erste Scheibe war „nicht meine“`
          : `${consent.who} möchte die eigenen Scheiben automatisch`,
      detail: `SportpassID ${consent.sportpassId} · zugestimmt ${consent.consentedAt}`,
      href: `/admin/users/${consent.userId}`,
      action: "Prüfen",
    })
  if (input.site && !input.bridge)
    tasks.push({
      id: "bridge",
      title: "Brücke koppeln",
      detail: "Ohne Brücke kommen keine Scheiben aus dem Schützenhaus.",
      href: "/admin/site",
      action: "Koppeln",
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
        does: "Dort liegen alle Scheiben. Spiegel liest nur und ändert nie etwas.",
        status: input.site ? "eingerichtet" : "noch nicht eingerichtet",
        tone: input.site && !input.site.foreignSource ? "ok" : "wait",
        facts: input.site
          ? [
              input.site.name,
              ...(input.site.foreignSource
                ? [
                    "Eine Brücke schickt Scheiben aus einer Ablage, die Spiegel nicht kennt; Spiegel nimmt sie nicht an. Das sollte nicht vorkommen, bitte melden.",
                  ]
                : []),
            ]
          : [],
      },
      {
        id: "bridge",
        help: "bridge",
        title: "Brücke im Schützenhaus",
        does: "Schickt nur Scheiben von Schützen mit Zustimmung. Verdeckte Wertung nie.",
        status: !bridge
          ? "keine Brücke"
          : !bridge.lastHeartbeatAt
            ? "noch kein Kontakt"
            : bridge.online
              ? "läuft"
              : "aus, normal",
        tone: !bridge || !bridge.lastHeartbeatAt ? "wait" : bridge.online ? "ok" : "neutral",
        facts: bridge ? [bridge.name, ...bridgeFacts] : [],
      },
      {
        id: "consents",
        help: "consent",
        title: "Zustimmungen",
        does: "Ein Schütze sagt: Scheiben mit meiner SportpassID gehören mir. Du prüfst die Nummer einmal.",
        status: waiting ? `${waiting} offen` : count(by("active"), "aktiv", "aktiv"),
        tone: waiting ? "wait" : "neutral",
        facts: [
          `${by("active")} aktiv · ${waiting} ${waiting === 1 ? "wartet" : "warten"} auf dich · ${by("rejected")} abgelehnt`,
          ...(input.notMine
            ? [
                input.notMine === 1
                  ? "1 Scheibe als „nicht meine“ gemeldet; sie kommt nicht wieder."
                  : `${input.notMine} Scheiben als „nicht meine“ gemeldet; sie kommen nicht wieder.`,
              ]
            : []),
        ],
      },
      {
        id: "accounts",
        help: "accounts",
        title: "Konten",
        does: "Wer Spiegel nutzt. Jeder sieht nur seine eigenen Scheiben, auch du als Admin.",
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
        ],
      },
    ],
  }
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
  const [bridge, consents, users, notMine] = await Promise.all([
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
        user: { select: { name: true, email: true } },
      },
      // deaktivierte Konten bekommen nichts; dort wartet keine Entscheidung, und sie zählen nicht als „mit Sportpass“
      where: { user: { isActive: true } },
    }),
    db.user.findMany({ select: { id: true, isActive: true } }),
    site ? db.tombstone.count({ where: { source: { siteId: site.id }, reason: NOT_MINE } }) : 0,
  ])
  const rows = consents.map((c) => ({
    id: c.id,
    userId: c.userId,
    who: c.user.name ?? c.user.email,
    sportpassId: c.sportpassId.toString(),
    consentedAt: formatDateTime(c.consentedAt, timeZone),
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
  })
}
