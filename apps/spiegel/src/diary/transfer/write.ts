// Einträge, Ziele und Abläufe aus einer Übernahme schreiben: anlegen oder über den Schlüssel ersetzen, Scheiben
// verknüpfen, Ausführung setzen. Läuft in der Transaktion der Übernahme.

import type { Prisma } from "@/generated/prisma/client"

import type { ImportedEntry } from "./treffsicher-entry"
import type { ImportedGoal, ImportedRoutine } from "./treffsicher-goal"
import { dateOfDay } from "../validation"

type Tx = Prisma.TransactionClient

/**
 * Einen übernommenen Eintrag über seinen Schlüssel anlegen oder seine Felder setzen und seine Werte ersetzen; die
 * Kennung bleibt, `updatedAt` ist `at`, die Zeit des Laufs (`isTouched`). Ein Schlüssel eines anderen Kontos ist ein
 * Fehler.
 */
export async function upsertImportedEntry(
  tx: Tx,
  userId: string,
  entry: ImportedEntry,
  at: Date
): Promise<{ id: string; created: boolean }> {
  const fields = {
    updatedAt: at,
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
 * Hat der letzte Lauf die Zeile geschrieben? Jeder Lauf setzt `updatedAt` jeder Zeile, die er schreibt, auf die Zeit
 * seines Merkmals (`movedToSpiegelAt` in Treffsicher), und er schreibt jede, die er nicht stehen lässt.
 */
export const writtenInLastRun = (updatedAt: Date, lastRunAt: Date): boolean =>
  updatedAt.getTime() === lastRunAt.getTime()

/**
 * Geändert, bleibt: im Papierkorb, oder nicht vom letzten Lauf geschrieben (`writtenInLastRun`). Danach geändert, oder
 * schon ein früherer Lauf ließ die Zeile stehen; so bleibt eine Änderung in jedem weiteren Lauf. Beim ersten Lauf
 * (`lastRunAt` null) gilt nur der Papierkorb.
 */
export const isTouched = (
  row: { deletedAt: Date | null; updatedAt: Date },
  lastRunAt: Date | null
): boolean =>
  row.deletedAt !== null || (lastRunAt !== null && !writtenInLastRun(row.updatedAt, lastRunAt))

const foreign = () => new Error("Schlüssel der Übernahme gehört zu einem anderen Konto")

/** ein übernommenes Ziel über seinen Schlüssel anlegen oder seine Felder setzen; Messung und Antwort bleiben */
export async function upsertImportedGoal(
  tx: Tx,
  userId: string,
  goal: ImportedGoal,
  at: Date
): Promise<{ id: string; created: boolean }> {
  const fields = {
    updatedAt: at,
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
  routine: ImportedRoutine,
  at: Date
): Promise<{ id: string; created: boolean }> {
  const fields = {
    updatedAt: at,
    familyId: routine.familyId,
    name: routine.name,
    steps: routine.steps,
  }
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

/**
 * Scheiben fest mit dem Eintrag verknüpfen (`linked`); eine Zeile einer Scheibe hängt danach an diesem Eintrag. `at` ist
 * die Zeit des Laufs wie bei Einträgen (`isTouched`)
 */
export async function setImportedLinks(
  tx: Tx,
  entryId: string,
  cardIds: readonly string[],
  at: Date
): Promise<void> {
  for (const cardId of cardIds)
    await tx.diaryEntryCard.upsert({
      where: { cardId },
      create: { cardId, entryId, link: "linked", updatedAt: at },
      update: { entryId, link: "linked", updatedAt: at },
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
