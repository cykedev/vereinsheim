import { db } from "@/lib/db"
import type {
  ParticipantDetail,
  ParticipantListItem,
  ParticipantOption,
} from "@/lib/participants/types"

/** Alle aktiven Teilnehmer — für allgemeine Ansicht. Gast-Datensätze werden ausgeblendet. */
export async function getParticipants(): Promise<ParticipantListItem[]> {
  return db.participant.findMany({
    where: { isActive: true, isGuestRecord: false },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      contact: true,
      isActive: true,
      isGuestRecord: true,
      createdAt: true,
      _count: { select: { competitions: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })
}

/** Alle Teilnehmer (aktiv + inaktiv) — für Admin-Verwaltungsansicht. Gast-Datensätze werden ausgeblendet. */
export async function getParticipantsForManagement(): Promise<ParticipantListItem[]> {
  return db.participant.findMany({
    where: { isGuestRecord: false },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      contact: true,
      isActive: true,
      isGuestRecord: true,
      createdAt: true,
      _count: { select: { competitions: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })
}

/** Einzelner Teilnehmer — für Edit-Seite. */
export async function getParticipantById(id: string): Promise<ParticipantDetail | null> {
  return db.participant.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      contact: true,
      isActive: true,
      isGuestRecord: true,
      createdAt: true,
    },
  })
}

/** Alle aktiven Vereinsmitglieder — für Team-Events, wo Mehrfach-Einschreibung erlaubt ist. */
export async function getAllActiveParticipants(): Promise<ParticipantOption[]> {
  return db.participant.findMany({
    where: { isActive: true, isGuestRecord: false },
    select: { id: true, firstName: true, lastName: true, contact: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })
}

/** Aktive Vereinsmitglieder, die noch nicht in der angegebenen Meisterschaft eingeschrieben sind. */
export async function getParticipantsNotInCompetition(
  competitionId: string
): Promise<ParticipantOption[]> {
  return db.participant.findMany({
    where: {
      isActive: true,
      isGuestRecord: false,
      competitions: { none: { competitionId } },
    },
    select: { id: true, firstName: true, lastName: true, contact: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  })
}
