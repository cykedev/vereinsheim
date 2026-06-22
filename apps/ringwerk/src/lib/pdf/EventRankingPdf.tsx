import { Document, Page, View, Text } from "@react-pdf/renderer"
import type { ReactElement } from "react"
import type { EventRankedEntry, EventTeamRankedEntry } from "@/lib/scoring/rankEventParticipants"
import { styles, PDF_COLORS } from "@/lib/pdf/styles"
import { SCORING_MODE_LABELS, SCORING_MODE_COLUMN_LABELS } from "@/lib/scoring/labels"
import type { ScoringMode } from "@/lib/scoring/types"
import type { TargetValueType } from "@/generated/prisma/client"
import { formatRings, formatDecimal1, getEffectiveScoringType } from "@/lib/series/scoring-format"

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface EventRankingPdfProps {
  competitionName: string
  disciplineName: string | null
  eventDate: Date | null
  scoringMode: ScoringMode
  targetValueType: TargetValueType | null
  shotsPerSeries: number
  targetValue: number | null
  isMixed: boolean
  entries: EventRankedEntry[]
  teamEntries?: EventTeamRankedEntry[]
  teamScoring?: "SUM" | "BEST" | null
  generatedAt: Date
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function rankBadgeColor(rank: number): string {
  if (rank === 1) return PDF_COLORS.gold
  if (rank === 2) return PDF_COLORS.silver
  if (rank === 3) return PDF_COLORS.orange
  return "#9ca3af"
}

function formatScore(score: number, mode: ScoringMode): string {
  if (mode === "TARGET_UNDER" && score >= 1e9) {
    return `+${(score - 1e9).toFixed(1).replace(".", ",")}`
  }
  if (mode === "TARGET_OVER" && score >= 1e9) {
    return `-${(score - 1e9).toFixed(1).replace(".", ",")}`
  }
  if (mode === "RINGS" || mode === "DECIMAL_REST") {
    return score.toFixed(0)
  }
  return score.toFixed(1).replace(".", ",")
}

// ─── Spaltenbreiten (Portrait A4, 515pt nutzbar) ──────────────────────────────
// Mit Disziplin-Spalte (isMixed): rank=28, name=130, disc=90, rings=55, teiler=65, score=65 → 433
// Ohne Disziplin-Spalte:          rank=28, name=200,           rings=65, teiler=75, score=75 → 443

const W_MIXED = { rank: 28, name: 130, disc: 90, rings: 55, teiler: 65, score: 65 }
const W_SINGLE = { rank: 28, name: 200, rings: 65, teiler: 90, score: 90 }

// ─── Team-Ranglisten-Tabelle ──────────────────────────────────────────────────

const W_TEAM = { rank: 28, team: 60, members: 220, score: 80 }
const TEAM_SCORING_LABELS: Record<string, string> = { SUM: "Summe", BEST: "Bestes" }

function TeamRankingTable({
  entries,
  scoringMode,
  teamScoring,
}: {
  entries: EventTeamRankedEntry[]
  scoringMode: ScoringMode
  teamScoring: "SUM" | "BEST"
}): ReactElement {
  const scoreLabel = SCORING_MODE_COLUMN_LABELS[scoringMode] ?? "Score"

  return (
    <View style={styles.table}>
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderCell, { width: W_TEAM.rank }]}>Pl.</Text>
        <Text style={[styles.tableHeaderCellLeft, { width: W_TEAM.team }]}>Team</Text>
        <Text style={[styles.tableHeaderCellLeft, { width: W_TEAM.members }]}>Mitglieder</Text>
        <Text style={[styles.tableHeaderCell, { width: W_TEAM.score }]}>{scoreLabel}</Text>
      </View>
      {entries.map((entry, idx) => {
        const isAlt = idx % 2 === 1
        const memberNames = entry.members.map((m) => m.participantName).join(", ")
        return (
          <View
            key={entry.teamNumber}
            wrap={false}
            style={[styles.tableRow, isAlt ? styles.tableRowAlt : {}]}
          >
            <View style={{ width: W_TEAM.rank, alignItems: "center" }}>
              <View style={[styles.rankBadge, { backgroundColor: rankBadgeColor(entry.rank) }]}>
                <Text style={styles.rankBadgeText}>{entry.rank}</Text>
              </View>
            </View>
            <Text style={[styles.tableCellLeft, { width: W_TEAM.team }]}>
              Team {entry.teamNumber}
            </Text>
            <Text
              style={[styles.tableCellLeft, { width: W_TEAM.members, color: PDF_COLORS.muted }]}
            >
              {memberNames}
            </Text>
            <Text style={[styles.tableCellBold, { width: W_TEAM.score }]}>
              {formatScore(entry.teamScore, scoringMode)}
            </Text>
          </View>
        )
      })}
      <View style={{ marginTop: 4 }}>
        <Text style={{ fontSize: 8, color: PDF_COLORS.muted }}>
          Wertung: {TEAM_SCORING_LABELS[teamScoring] ?? teamScoring}
        </Text>
      </View>
    </View>
  )
}

// ─── Ranglisten-Tabelle ───────────────────────────────────────────────────────

function RankingTable({
  entries,
  scoringMode,
  targetValueType,
  isMixed,
}: {
  entries: EventRankedEntry[]
  scoringMode: ScoringMode
  targetValueType: TargetValueType | null
  isMixed: boolean
}): ReactElement {
  const scoreLabel = SCORING_MODE_COLUMN_LABELS[scoringMode] ?? "Score"
  const teilerLabel = isMixed ? "Teiler korr." : "Teiler"
  const W = isMixed ? W_MIXED : W_SINGLE

  return (
    <View style={styles.table}>
      {/* Header */}
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderCell, { width: W.rank }]}>Pl.</Text>
        <Text style={[styles.tableHeaderCellLeft, { width: W.name }]}>Name</Text>
        {isMixed && (
          <Text style={[styles.tableHeaderCellLeft, { width: W_MIXED.disc }]}>Disziplin</Text>
        )}
        <Text style={[styles.tableHeaderCell, { width: W.rings }]}>Ringe</Text>
        <Text style={[styles.tableHeaderCell, { width: W.teiler }]}>{teilerLabel}</Text>
        <Text style={[styles.tableHeaderCell, { width: W.score }]}>{scoreLabel}</Text>
      </View>

      {/* Zeilen */}
      {entries.map((entry, idx) => {
        const isAlt = idx % 2 === 1
        const nameText = entry.isGuest ? `${entry.participantName} (Gast)` : entry.participantName
        const teilerValue = formatDecimal1(isMixed ? entry.correctedTeiler : entry.teiler)

        return (
          <View
            key={entry.seriesId}
            wrap={false}
            style={[styles.tableRow, isAlt ? styles.tableRowAlt : {}]}
          >
            {/* Rang-Abzeichen */}
            <View style={{ width: W.rank, alignItems: "center" }}>
              <View style={[styles.rankBadge, { backgroundColor: rankBadgeColor(entry.rank) }]}>
                <Text style={styles.rankBadgeText}>{entry.rank}</Text>
              </View>
            </View>

            <Text style={[styles.tableCellLeft, { width: W.name }]}>{nameText}</Text>

            {isMixed && (
              <Text
                style={[styles.tableCellLeft, { width: W_MIXED.disc, color: PDF_COLORS.muted }]}
              >
                {entry.disciplineName}
              </Text>
            )}

            <Text style={[styles.tableCell, { width: W.rings }]}>
              {formatRings(
                entry.rings,
                getEffectiveScoringType(
                  scoringMode,
                  { scoringType: entry.disciplineScoringType },
                  targetValueType
                )
              )}
            </Text>
            <Text style={[styles.tableCell, { width: W.teiler, color: PDF_COLORS.muted }]}>
              {teilerValue}
            </Text>
            <Text style={[styles.tableCellBold, { width: W.score }]}>
              {formatScore(entry.score, scoringMode)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

// ─── Dokument ─────────────────────────────────────────────────────────────────

export function EventRankingPdf({
  competitionName,
  disciplineName,
  eventDate,
  scoringMode,
  targetValueType,
  shotsPerSeries,
  targetValue,
  isMixed,
  entries,
  teamEntries,
  teamScoring,
  generatedAt,
}: EventRankingPdfProps): ReactElement {
  const disciplineDisplay = disciplineName ?? "Gemischt"

  return (
    <Document title={`${competitionName} – Rangliste`} author="Ringwerk" creator="Ringwerk">
      <Page size="A4" style={styles.page}>
        {/* Kopfzeile */}
        <View style={styles.headerBlock}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>{competitionName}</Text>
            <Text style={styles.headerSubtitle}>
              {disciplineDisplay}
              {eventDate ? ` · ${formatDate(eventDate)}` : ""} · Rangliste
            </Text>
          </View>
          <Text style={styles.headerDate}>Erstellt: {formatDate(generatedAt)}</Text>
        </View>

        {/* Config-Zeile */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}>
          <Text style={{ fontSize: 9, color: PDF_COLORS.muted }}>
            {SCORING_MODE_LABELS[scoringMode] ?? scoringMode}
          </Text>
          <Text style={{ fontSize: 9, color: PDF_COLORS.muted }}>{shotsPerSeries} Schuss</Text>
          {targetValue != null && (
            <Text style={{ fontSize: 9, color: PDF_COLORS.muted }}>Zielwert: {targetValue}</Text>
          )}
        </View>

        {/* Team-Rangliste (wenn Team-Event) */}
        {teamEntries && teamEntries.length > 0 && teamScoring && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 10, fontWeight: "bold", marginBottom: 6 }}>
              Team-Rangliste
            </Text>
            <TeamRankingTable
              entries={teamEntries}
              scoringMode={scoringMode}
              teamScoring={teamScoring}
            />
          </View>
        )}

        {/* Einzel-Rangliste */}
        {teamEntries && teamEntries.length > 0 && (
          <Text style={{ fontSize: 10, fontWeight: "bold", marginBottom: 6 }}>Einzelrangliste</Text>
        )}
        {entries.length === 0 ? (
          <Text style={{ fontSize: 10, color: PDF_COLORS.muted }}>
            Noch keine Ergebnisse erfasst.
          </Text>
        ) : (
          <RankingTable
            entries={entries}
            scoringMode={scoringMode}
            targetValueType={targetValueType}
            isMixed={isMixed}
          />
        )}

        {/* Fußzeile */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{competitionName}</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
              `Seite ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}
