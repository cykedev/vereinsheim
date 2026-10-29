// Einträge, Ziele und Abläufe aus einer Übernahme schreiben: anlegen oder über den Schlüssel ersetzen, Scheiben
// verknüpfen, Ausführung setzen, Vorschau-Zeilen löschen. Läuft in der Transaktion des Aufrufers (Übernahme,
// Vorschau-Werkzeug).

import type { Prisma } from "@/generated/prisma/client"

import type { ImportedEntry } from "./treffsicher-entry"
import type { ImportedGoal, ImportedRoutine } from "./treffsicher-goal"
import { dateOfDay } from "../validation"

type Tx = Prisma.TransactionClient

/** Schlüssel der Vorschau im Tagebuch (`preview:<Einheit>`) */
export const PREVIEW_PREFIX = "preview:"

/**
 * Einen übernommenen Eintrag über seinen Schlüssel anlegen oder seine Felder setzen und seine Werte ersetzen; die
 * Kennung bleibt. Ein Schlüssel eines anderen Kontos ist ein Fehler.
 */
export async function upsertImportedEntry(
  tx: Tx,
  userId: string,
  entry: ImportedEntry
): Promise<{ id: string; created: boolean }> {
  const fields = {
    day: dateOfDay(entry.day),
    kind: entry.kind,
    familyId: entry.familyId,
    intention: entry.intention,
    outcome: entry.outcome,
    learned: entry.learned,
    question: entry.question,
    note: entry.note,
    expectedScore: entry.expectedScore,
  }
  const existing = await tx.diaryEntry.findUnique({
    where: { importKey: entry.importKey },
    select: { id: true, userId: true },
  })
  if (existing && existing.userId !== userId) throw foreign()
  const id = existing
    ? (
        await tx.diaryEntry.update({
          where: { id: existing.id },
          data: fields,
          select: { id: true },
        })
      ).id
    : (
        await tx.diaryEntry.create({
          data: { ...fields, userId, importKey: entry.importKey },
          select: { id: true },
        })
      ).id
  await tx.diaryScale.deleteMany({ where: { entryId: id } })
  if (entry.scales.length)
    await tx.diaryScale.createMany({
      data: entry.scales.map((scale) => ({ entryId: id, ...scale })),
    })
  return { id, created: !existing }
}

/**
 * Geändert seit dem letzten Lauf: im Papierkorb, oder `updatedAt` nach `lastRunAt` (`movedToSpiegelAt` in Treffsicher).
 * Beim ersten Lauf (`lastRunAt` null) gilt nur der Papierkorb. Ein zweiter Lauf lässt solche Zeilen stehen.
 */
export const isTouched = (
  row: { deletedAt: Date | null; updatedAt: Date },
  lastRunAt: Date | null
): boolean => row.deletedAt !== null || (lastRunAt !== null && row.updatedAt > lastRunAt)

const foreign = () => new Error("Schlüssel der Übernahme gehört zu einem anderen Konto")

/** ein übernommenes Ziel über seinen Schlüssel anlegen oder seine Felder setzen; Messung und Antwort bleiben */
export async function upsertImportedGoal(
  tx: Tx,
  userId: string,
  goal: ImportedGoal
): Promise<{ id: string; created: boolean }> {
  const fields = {
    familyId: goal.familyId,
    title: goal.title,
    note: goal.note,
    kind: goal.kind,
    from: dateOfDay(goal.from),
    to: dateOfDay(goal.to),
  }
  const existing = await tx.diaryGoal.findUnique({
    where: { importKey: goal.importKey },
    select: { id: true, userId: true },
  })
  if (existing && existing.userId !== userId) throw foreign()
  if (existing) {
    await tx.diaryGoal.update({ where: { id: existing.id }, data: fields })
    return { id: existing.id, created: false }
  }
  const created = await tx.diaryGoal.create({
    data: { ...fields, userId, importKey: goal.importKey },
    select: { id: true },
  })
  return { id: created.id, created: true }
}

/** einen übernommenen Ablauf über seinen Schlüssel anlegen oder Name, Familie und Schritte setzen */
export async function upsertImportedRoutine(
  tx: Tx,
  userId: string,
  routine: ImportedRoutine
): Promise<{ id: string; created: boolean }> {
  const fields = { familyId: routine.familyId, name: routine.name, steps: routine.steps }
  const existing = await tx.diaryRoutine.findUnique({
    where: { importKey: routine.importKey },
    select: { id: true, userId: true },
  })
  if (existing && existing.userId !== userId) throw foreign()
  if (existing) {
    await tx.diaryRoutine.update({ where: { id: existing.id }, data: fields })
    return { id: existing.id, created: false }
  }
  const created = await tx.diaryRoutine.create({
    data: { ...fields, userId, importKey: routine.importKey },
    select: { id: true },
  })
  return { id: created.id, created: true }
}

/** Scheiben fest mit dem Eintrag verknüpfen (`linked`); eine Zeile einer Scheibe hängt danach an diesem Eintrag */
export async function setImportedLinks(
  tx: Tx,
  entryId: string,
  cardIds: readonly string[]
): Promise<void> {
  for (const cardId of cardIds)
    await tx.diaryEntryCard.upsert({
      where: { cardId },
      create: { cardId, entryId, link: "linked" },
      update: { entryId, link: "linked" },
    })
}

/**
 * Die Zeilen entfernter Scheiben lösen: Die Tabellen des Tagebuchs haben keinen Fremdschlüssel auf Scheiben, ohne das
 * stünde im Eintrag „Scheibe gelöscht“
 */
export async function releaseImportedLinks(tx: Tx, cardIds: readonly string[]): Promise<void> {
  if (cardIds.length)
    await tx.diaryEntryCard.deleteMany({ where: { cardId: { in: [...cardIds] } } })
}

/** die Ausführung eines Eintrags durch diese Zeilen ersetzen */
export async function replaceExecutions(
  tx: Tx,
  entryId: string,
  rows: readonly { cardId: string; series: number; value: number }[]
): Promise<void> {
  await tx.diarySeriesExecution.deleteMany({ where: { entryId } })
  if (rows.length)
    await tx.diarySeriesExecution.createMany({ data: rows.map((row) => ({ entryId, ...row })) })
}

/**
 * Alle Zeilen der Vorschau eines Kontos löschen: Einträge, Ziele und Abläufe mit Schlüssel `preview:`; die Kaskade nimmt
 * Werte, Zeilen der Scheiben und Ausführung mit
 */
export async function deletePreviewDiary(
  tx: Tx,
  userId: string
): Promise<{ entries: number; goals: number; routines: number }> {
  const where = { userId, importKey: { startsWith: PREVIEW_PREFIX } }
  const entries = await tx.diaryEntry.deleteMany({ where })
  const goals = await tx.diaryGoal.deleteMany({ where })
  const routines = await tx.diaryRoutine.deleteMany({ where })
  return { entries: entries.count, goals: goals.count, routines: routines.count }
}
