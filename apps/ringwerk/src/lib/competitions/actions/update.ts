"use server"

import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { isConflict, serializable } from "@/lib/serializable"
import type { z } from "zod"
import type { Competition } from "@/generated/prisma/client"
import { getScheduleResultCounts } from "@/lib/matchups/queries"
import { isRulesetLocked, type ScheduleResultCounts } from "@/lib/matchups/regeneration"
import { replaceSchedule } from "@/lib/matchups/replaceSchedule"
import { getAuthSession, canManage } from "@/lib/auth-helpers"
import type { ActionResult } from "@/lib/types"
import type { AuditEventType } from "@/lib/auditLog/types"
import { parseDate, parseDateForUpdate, revalidateCompetitionPaths, BaseSchema } from "./_shared"
import { findActiveSlugConflict } from "../publicSlugQueries"
import { offersEdit } from "../editable"
import { revalidatePublicPdf } from "../publicPdfCache"
import { resolveAccessTokenUpdate } from "../publicAccess"

/** Der neue Spielplan kann nicht entstehen; verlässt die Transaktion, damit Postgres alles verwirft. */
class ScheduleReplaceError extends Error {}

const NO_RESULTS: ScheduleResultCounts = { completed: 0, walkover: 0, series: 0, playoffs: 0 }

const RULESET_LOCKED =
  "Inzwischen ist ein Ergebnis eingetragen. Das Regelset lässt sich nicht mehr ändern. Bitte die Seite neu laden."

type StoredRuleset = Pick<
  Competition,
  | "scoringMode"
  | "leagueFormat"
  | "shotsPerSeries"
  | "groupBestOf"
  | "groupPlayAllDuels"
  | "groupTiebreaker1"
  | "groupTiebreaker2"
>

/**
 * Ob das Formular einen Wert des Liga-Regelsets anders schickt, als er gespeichert ist. Nur abgeschickte Felder zählen:
 * Ein gesperrtes Formular schickt nur den versteckten Wertungsmodus, und der ist unverändert.
 */
function changesRuleset(
  stored: StoredRuleset,
  data: z.infer<typeof BaseSchema>,
  sent: (field: string) => boolean
): boolean {
  if (data.scoringMode !== stored.scoringMode) return true
  if (sent("shotsPerSeries") && data.shotsPerSeries !== stored.shotsPerSeries) return true
  if (!sent("leagueFormat") || !data.leagueFormat) return false
  if (data.leagueFormat !== stored.leagueFormat) return true
  if (data.leagueFormat !== "BEST_OF_SINGLE") return false
  return (
    (sent("groupBestOf") && (data.groupBestOf ?? 3) !== stored.groupBestOf) ||
    (sent("groupPlayAllDuels") && data.groupPlayAllDuels !== stored.groupPlayAllDuels) ||
    (sent("groupTiebreaker1") && (data.groupTiebreaker1 ?? null) !== stored.groupTiebreaker1) ||
    (sent("groupTiebreaker2") && (data.groupTiebreaker2 ?? null) !== stored.groupTiebreaker2)
  )
}

export async function updateCompetition(
  id: string,
  _prevState: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await getAuthSession()
  if (!session) return { error: "Nicht angemeldet" }
  if (!canManage(session.user.role)) return { error: "Keine Berechtigung" }

  // Vorab nur, was vor der Transaktion gebraucht wird: ob es den Wettbewerb gibt und sein Status für die Prüfung
  // des Slugs. Alles, wovon die Sperre des Regelsets abhängt, liest die Transaktion selbst.
  const competition = await db.competition.findUnique({
    where: { id },
    select: { id: true, status: true },
  })
  if (!competition) return { error: "Wettbewerb nicht gefunden." }

  const parsed = BaseSchema.safeParse({
    name: formData.get("name"),
    scoringMode: formData.get("scoringMode"),
    shotsPerSeries: formData.get("shotsPerSeries"),
    disciplineId: formData.get("disciplineId"),
    hinrundeDeadline: formData.get("hinrundeDeadline"),
    rueckrundeDeadline: formData.get("rueckrundeDeadline"),
    eventDate: formData.get("eventDate"),
    allowGuests: formData.get("allowGuests"),
    teamSize: formData.get("teamSize"),
    teamScoring: formData.get("teamScoring"),
    targetValue: formData.get("targetValue"),
    targetValueType: formData.get("targetValueType"),
    minSeries: formData.get("minSeries"),
    seasonStart: formData.get("seasonStart"),
    seasonEnd: formData.get("seasonEnd"),
    seasonSortMode: formData.get("seasonSortMode"),
    playoffBestOf: formData.get("playoffBestOf"),
    playoffHasViertelfinale: formData.get("playoffHasViertelfinale"),
    playoffHasAchtelfinale: formData.get("playoffHasAchtelfinale"),
    isPublic: formData.get("isPublic"),
    publicSlug: formData.get("publicSlug"),
    publicPassword: formData.get("publicPassword"),
    removePublicPassword: formData.get("removePublicPassword"),
    publicAccessFields: formData.get("publicAccessFields"),
    publicQrBypass: formData.get("publicQrBypass"),
    rotatePublicAccessToken: formData.get("rotatePublicAccessToken"),
    finalePrimary: formData.get("finalePrimary"),
    finaleTiebreaker1: formData.get("finaleTiebreaker1"),
    finaleTiebreaker2: formData.get("finaleTiebreaker2"),
    leagueFormat: formData.get("leagueFormat"),
    groupBestOf: formData.get("groupBestOf"),
    groupPlayAllDuels: formData.get("groupPlayAllDuels"),
    groupTiebreaker1: formData.get("groupTiebreaker1"),
    groupTiebreaker2: formData.get("groupTiebreaker2"),
  })
  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors }

  const willBePublic = parsed.data.isPublic
  const nextSlug = parsed.data.publicSlug
  const isActive = competition.status === "ACTIVE"

  // Slug conflict check: only block when the updated competition itself will be ACTIVE+isPublic.
  // DRAFT/COMPLETED competitions may share a slug with an active one — only one ACTIVE+isPublic is blocked at a time.
  if (willBePublic && nextSlug && isActive) {
    const conflict = await findActiveSlugConflict(nextSlug, id)
    if (conflict) {
      return {
        error: `Slug ist bereits vom aktiven Wettbewerb '${conflict.name}' belegt. Wählen Sie einen anderen Slug oder schließen Sie den anderen Wettbewerb zuerst ab.`,
      }
    }
  }

  // Three-way password hash semantics:
  // 1. removePublicPassword=true  → clear hash (null)
  // 2. publicPassword provided    → hash with bcrypt
  // 3. neither                    → undefined (Prisma: do not touch the column)
  // Vor der Transaktion: bcrypt ist langsam, und `serializable` wiederholt die Transaktion.
  let publicPasswordHashUpdate: string | null | undefined
  if (parsed.data.removePublicPassword) {
    publicPasswordHashUpdate = null
  } else if (parsed.data.publicPassword != null) {
    publicPasswordHashUpdate = await bcrypt.hash(parsed.data.publicPassword, 12)
  } else {
    publicPasswordHashUpdate = undefined // Prisma: do not touch the column
  }

  // Felder des Regelsets, die das Formular nicht abschickt (gesperrtes fieldset, ausgeblendete Felder), lassen die
  // Spalte unberührt. Das Schema setzt für sie Vorgaben (Format Doppelrunde, 10 Schuss), die sonst still überschreiben
  // würden.
  const sent = (field: string) => formData.get(field) !== null
  const formatSent = sent("leagueFormat") && formData.get("leagueFormat") !== ""
  const replaceConfirmed = formData.get("replaceSchedule") === "true"

  let outcome: { problem: string } | { replaced: boolean }
  try {
    outcome = await serializable(async (tx) => {
      const current = await tx.competition.findUnique({
        where: { id },
        select: {
          type: true,
          status: true,
          scoringMode: true,
          leagueFormat: true,
          shotsPerSeries: true,
          groupBestOf: true,
          groupPlayAllDuels: true,
          groupTiebreaker1: true,
          groupTiebreaker2: true,
          publicAccessToken: true,
        },
      })
      if (!current) return { problem: "Wettbewerb nicht gefunden." }
      // Archiviert heißt gesperrt, wie beim Eintragen von Serien. Der Status kommt aus der Transaktion, damit ein
      // gleichzeitiges Archivieren zählt.
      if (!offersEdit(current.status)) return { problem: "Archivierte Wettbewerbe sind gesperrt." }
      const type = current.type
      // Paarungen und Ergebnisse zählen nur in der Liga. Event und Saison lesen die Tabellen der Ergebnisse nicht, damit
      // ihr Speichern nicht mit dem Eintragen von Ergebnissen kollidiert (`serializable`).
      const [counts, matchupCount] =
        type === "LEAGUE"
          ? await Promise.all([
              getScheduleResultCounts(id, tx),
              tx.matchup.count({ where: { competitionId: id } }),
            ])
          : [NO_RESULTS, 0]

      // Das Regelset ist gesperrt, sobald ein Ergebnis existiert (isRulesetLocked), nicht schon mit dem Spielplan.
      const rulesetLocked = isRulesetLocked(counts)
      // Ein Formular, das vor dem ersten Ergebnis geöffnet wurde, schickt das Regelset noch bearbeitbar. Hat es etwas
      // daran geändert, lehnt das Speichern ab, statt die Änderung still zu verwerfen.
      if (type === "LEAGUE" && rulesetLocked && changesRuleset(current, parsed.data, sent)) {
        return { problem: RULESET_LOCKED }
      }
      // Playoff & finale config only takes effect when the playoffs start — keep it
      // editable until then, even after the group-phase schedule exists.
      const playoffsStarted = counts.playoffs > 0

      const leagueRulesetEditable = type === "LEAGUE" && !rulesetLocked && formatSent
      const leagueFormat = leagueRulesetEditable ? parsed.data.leagueFormat : current.leagueFormat
      const isBestOf = leagueRulesetEditable && leagueFormat === "BEST_OF_SINGLE"
      // Nur das Format ändert die Paarungen selbst. Mit Spielplan erzeugt ein Wechsel ihn neu, und das nur nach der
      // Rückfrage im Formular: Fehlt sie, ist der Spielplan erst nach dem Öffnen des Formulars entstanden.
      const replace =
        leagueRulesetEditable && leagueFormat !== current.leagueFormat && matchupCount > 0
      if (replace && !replaceConfirmed) {
        return {
          problem:
            "Inzwischen gibt es einen Spielplan. Bitte die Seite neu laden und noch einmal speichern.",
        }
      }

      await tx.competition.update({
        where: { id },
        data: {
          name: parsed.data.name,
          isPublic: parsed.data.isPublic ?? false,
          publicSlug: parsed.data.publicSlug,
          publicPasswordHash: publicPasswordHashUpdate,
          // Rotieren/Ausschalten ändert den Inhalt des öffentlichen PDFs nicht → kein Cache-Revalidate.
          publicAccessToken: resolveAccessTokenUpdate({
            fieldsPresent: parsed.data.publicAccessFields,
            bypass: parsed.data.publicQrBypass,
            rotate: parsed.data.rotatePublicAccessToken,
            existing: current.publicAccessToken,
            passwordRemoved: parsed.data.removePublicPassword,
          }),
          scoringMode: rulesetLocked ? undefined : parsed.data.scoringMode,
          shotsPerSeries:
            rulesetLocked || !sent("shotsPerSeries") ? undefined : parsed.data.shotsPerSeries,
          // Nicht abgeschickte Stichtag-Felder (Formular blendet sie bei BEST_OF_SINGLE bzw.
          // für EVENT/SEASON aus) lassen die Spalte unberührt statt sie zu leeren.
          hinrundeDeadline: parseDateForUpdate(parsed.data.hinrundeDeadline),
          rueckrundeDeadline: parseDateForUpdate(parsed.data.rueckrundeDeadline),
          eventDate: type === "EVENT" ? parseDate(parsed.data.eventDate) : undefined,
          allowGuests: type === "EVENT" ? parsed.data.allowGuests : undefined,
          teamSize: type === "EVENT" ? (parsed.data.teamSize ?? null) : undefined,
          teamScoring: type === "EVENT" ? (parsed.data.teamScoring ?? null) : undefined,
          targetValue: type === "EVENT" ? (parsed.data.targetValue ?? null) : undefined,
          targetValueType: type === "EVENT" ? (parsed.data.targetValueType ?? null) : undefined,
          minSeries: type === "SEASON" ? (parsed.data.minSeries ?? null) : undefined,
          seasonStart: type === "SEASON" ? parseDate(parsed.data.seasonStart) : undefined,
          seasonEnd: type === "SEASON" ? parseDate(parsed.data.seasonEnd) : undefined,
          // SEASON hat keine Paarungen → rulesetLocked greift hier nie.
          seasonSortMode: type === "SEASON" ? (parsed.data.seasonSortMode ?? null) : undefined,
          playoffBestOf:
            type === "LEAGUE" && !playoffsStarted ? (parsed.data.playoffBestOf ?? null) : undefined,
          playoffHasViertelfinale:
            type === "LEAGUE" && !playoffsStarted ? parsed.data.playoffHasViertelfinale : undefined,
          playoffHasAchtelfinale:
            type === "LEAGUE" && !playoffsStarted ? parsed.data.playoffHasAchtelfinale : undefined,
          finalePrimary:
            type === "LEAGUE" && !playoffsStarted ? parsed.data.finalePrimary : undefined,
          finaleTiebreaker1:
            type === "LEAGUE" && !playoffsStarted
              ? (parsed.data.finaleTiebreaker1 ?? null)
              : undefined,
          finaleTiebreaker2:
            type === "LEAGUE" && !playoffsStarted
              ? (parsed.data.finaleTiebreaker2 ?? null)
              : undefined,
          // Format und Gruppenphase (BEST_OF_SINGLE): bis zum ersten Ergebnis editierbar.
          // groupPlayAllDuels DB default is false; explicitly persist the form value
          leagueFormat: leagueRulesetEditable ? leagueFormat : undefined,
          groupBestOf: isBestOf ? (parsed.data.groupBestOf ?? 3) : undefined,
          groupPlayAllDuels: isBestOf ? parsed.data.groupPlayAllDuels : undefined,
          groupTiebreaker1: isBestOf ? (parsed.data.groupTiebreaker1 ?? null) : undefined,
          groupTiebreaker2: isBestOf ? (parsed.data.groupTiebreaker2 ?? null) : undefined,
        },
      })

      await tx.auditLog.create({
        data: {
          eventType: "COMPETITION_UPDATED" satisfies AuditEventType,
          entityType: "COMPETITION",
          entityId: id,
          userId: session.user.id,
          competitionId: id,
          details: {
            name: parsed.data.name,
            type,
            scoringMode: rulesetLocked ? current.scoringMode : parsed.data.scoringMode,
            seasonSortMode: type === "SEASON" ? (parsed.data.seasonSortMode ?? null) : null,
            ...(type === "LEAGUE" ? { leagueFormat } : {}),
          },
        },
      })

      if (replace) {
        // Ein Grund wirft: Postgres verwirft dann auch die Einstellungen, der alte Spielplan bleibt.
        const problem = await replaceSchedule(tx, id, session.user.id)
        if (problem) throw new ScheduleReplaceError(problem)
      }
      return { replaced: replace }
    })
  } catch (error) {
    if (error instanceof ScheduleReplaceError) {
      return { error: `Format nicht geändert: ${error.message}` }
    }
    if (isConflict(error)) {
      return {
        error:
          "Der Wettbewerb wurde gleichzeitig geändert. Bitte die Seite neu laden und es noch einmal versuchen.",
      }
    }
    console.error("Speichern des Wettbewerbs fehlgeschlagen:", error)
    return { error: "Wettbewerb konnte nicht gespeichert werden. Bitte erneut versuchen." }
  }
  if ("problem" in outcome) return { error: outcome.problem }

  // The tag hangs on the id, not on the slug, so one call covers a rename, a publish and an
  // unpublish alike. The old two-slug dance was only a workaround for the orphaning bug.
  revalidatePublicPdf(id)

  revalidateCompetitionPaths()
  if (outcome.replaced) {
    revalidatePath(`/competitions/${id}/schedule`)
    revalidatePath(`/competitions/${id}/participants`)
  }
  return { success: true }
}
