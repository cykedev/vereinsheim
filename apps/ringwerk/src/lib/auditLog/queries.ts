import { db } from "@/lib/db"

export async function getAuditLogsByCompetition(competitionId: string) {
  return db.auditLog.findMany({
    where: { competitionId },
    include: {
      user: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function getAuditLogs() {
  return db.auditLog.findMany({
    include: {
      user: { select: { name: true } },
      competition: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export type AuditLogEntry = Awaited<ReturnType<typeof getAuditLogsByCompetition>>[number]
export type AuditLogEntryWithCompetition = Awaited<ReturnType<typeof getAuditLogs>>[number]
