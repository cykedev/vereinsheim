import { Document, Page, View, Text } from "@react-pdf/renderer"
import type { ReactElement } from "react"
import {
  isAlternatingSort,
  isPodiumRank,
  metricAppearance,
  SEASON_SORT_LABELS,
  type ResolvedSeasonSort,
  type SortedSeasonStandingsEntry,
} from "@/lib/scoring/sortSeasonStandings"
import { styles, PDF_COLORS } from "@/lib/pdf/styles"
import { SCORING_MODE_LABELS } from "@/lib/scoring/labels"
import type { ScoringMode } from "@/lib/scoring/types"
import { formatRings, formatDecimal1 } from "@/lib/series/scoring-format"
import { formatDateOnly } from "@vereinsheim/lib/format"

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface SeasonStandingsPdfProps {
  displayTimeZone: string
  competitionName: string
  disciplineName: string | null
  seasonStart: Date | null
  seasonEnd: Date | null
  scoringMode: ScoringMode
  shotsPerSeries: number
  minSeries: number | null
  isMixed: boolean
  entries: SortedSeasonStandingsEntry[]
  /** Aufgelöste Sortierung — dieselbe Quelle wie in der Tabelle (sortSeasonStandings). */
  sort: ResolvedSeasonSort
  generatedAt: Date
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function rankBadgeColor(rank: number): string {
  if (rank === 1) return PDF_COLORS.gold
  if (rank === 2) return PDF_COLORS.silver
  if (rank === 3) return PDF_COLORS.orange
  return "#9ca3af"
}

function MetricCell({
  value,
  rank,
  width,
  muted = false,
}: {
  value: string
  rank: number | null
  width: number
  muted?: boolean
}): ReactElement {
  // Podium-Regel und Hervorhebung kommen aus sortSeasonStandings — dieselbe Quelle wie die Tabelle.
  const showBadge = isPodiumRank(rank) && value !== "–"
  return (
    <View
      style={{
        width,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 4,
        paddingRight: 4,
      }}
    >
      <Text style={{ fontSize: 10, color: muted ? PDF_COLORS.muted : PDF_COLORS.dark }}>
        {value}
      </Text>
      {showBadge ? (
        <View
          style={{
            backgroundColor: rankBadgeColor(rank!),
            borderRadius: 3,
            paddingVertical: 1,
            width: 18,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 8, color: "white" }}>{rank}</Text>
        </View>
      ) : (
        <View style={{ width: 18 }} />
      )}
    </View>
  )
}

// ─── Spaltenbreiten (Portrait A4, 515pt nutzbar) ──────────────────────────────
// Mit Serien-Spalte (minSeries gesetzt):    name=155, series=45, rings=105, teiler=105, ringteiler=105 → 515
// Ohne Serien-Spalte (minSeries null):      name=200,            rings=105, teiler=105, ringteiler=105 → 515

const W_WITH_SERIES = { name: 155, series: 45, rings: 105, teiler: 105, ringteiler: 105 }
const W_NO_SERIES = { name: 200, rings: 105, teiler: 105, ringteiler: 105 }

// ─── Standings-Tabelle ────────────────────────────────────────────────────────

/**
 * Uebersetzt die geteilte Darstellungsregel in das PDF-Mittel (dunkel vs. grau). `classicMuted`
 * ist das bisherige Bild der jeweiligen Spalte, das ausserhalb der alternierenden Modi gilt.
 */
function metricMuted(
  entry: SortedSeasonStandingsEntry,
  metric: "rings" | "teiler" | "ringteiler",
  classicMuted: boolean
): boolean {
  const appearance = metricAppearance(entry, metric)
  return appearance === "default" ? classicMuted : appearance === "muted"
}

function StandingsTable({
  entries,
  minSeries,
  isMixed,
}: {
  entries: SortedSeasonStandingsEntry[]
  minSeries: number | null
  isMixed: boolean
}): ReactElement {
  const hasSeries = minSeries !== null
  const teilerLabel = isMixed ? "Best. Teiler korr." : "Best. Teiler"

  return (
    <View style={styles.table}>
      {/* Header */}
      <View style={styles.tableHeaderRow}>
        {hasSeries ? (
          <>
            <Text style={[styles.tableHeaderCellLeft, { width: W_WITH_SERIES.name }]}>Name</Text>
            <Text style={[styles.tableHeaderCell, { width: W_WITH_SERIES.series }]}>Serien</Text>
            <Text style={[styles.tableHeaderCell, { width: W_WITH_SERIES.rings }]}>
              Beste Ringe
            </Text>
            <Text style={[styles.tableHeaderCell, { width: W_WITH_SERIES.teiler }]}>
              {teilerLabel}
            </Text>
            <Text style={[styles.tableHeaderCell, { width: W_WITH_SERIES.ringteiler }]}>
              Best. Ringteiler
            </Text>
          </>
        ) : (
          <>
            <Text style={[styles.tableHeaderCellLeft, { width: W_NO_SERIES.name }]}>Name</Text>
            <Text style={[styles.tableHeaderCell, { width: W_NO_SERIES.rings }]}>Beste Ringe</Text>
            <Text style={[styles.tableHeaderCell, { width: W_NO_SERIES.teiler }]}>
              {teilerLabel}
            </Text>
            <Text style={[styles.tableHeaderCell, { width: W_NO_SERIES.ringteiler }]}>
              Best. Ringteiler
            </Text>
          </>
        )}
      </View>

      {/* Zeilen */}
      {entries.map((entry, idx) => {
        const isAlt = idx % 2 === 1
        const qualified = entry.meetsMinSeries

        const seriesText =
          hasSeries && minSeries !== null ? `${entry.seriesCount}/${minSeries}` : null
        const seriesColor = qualified ? "#16a34a" : "#dc2626"

        if (hasSeries) {
          return (
            <View
              key={entry.participantId}
              wrap={false}
              style={[styles.tableRow, isAlt ? styles.tableRowAlt : {}]}
            >
              <View
                style={{
                  width: W_WITH_SERIES.name,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingLeft: 4,
                }}
              >
                <View
                  style={{
                    backgroundColor: rankBadgeColor(idx + 1),
                    borderRadius: 3,
                    paddingHorizontal: 4,
                    paddingVertical: 1,
                    minWidth: 18,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 8, color: "white" }}>{idx + 1}</Text>
                </View>
                <Text style={{ fontSize: 10, color: PDF_COLORS.dark, flex: 1 }}>
                  {entry.participantName}
                </Text>
              </View>
              <Text style={[styles.tableCell, { width: W_WITH_SERIES.series, color: seriesColor }]}>
                {seriesText}
              </Text>
              <MetricCell
                value={formatRings(entry.bestRings, entry.bestRingsScoringType ?? "WHOLE")}
                rank={entry.bestRings_rank}
                width={W_WITH_SERIES.rings}
                muted={metricMuted(entry, "rings", false)}
              />
              <MetricCell
                value={formatDecimal1(entry.bestCorrectedTeiler)}
                rank={entry.bestTeiler_rank}
                width={W_WITH_SERIES.teiler}
                muted={metricMuted(entry, "teiler", true)}
              />
              <MetricCell
                value={formatDecimal1(entry.bestRingteiler)}
                rank={entry.bestRingteiler_rank}
                width={W_WITH_SERIES.ringteiler}
                muted={metricMuted(entry, "ringteiler", false)}
              />
            </View>
          )
        }

        return (
          <View
            key={entry.participantId}
            wrap={false}
            style={[styles.tableRow, isAlt ? styles.tableRowAlt : {}]}
          >
            <View
              style={{
                width: W_NO_SERIES.name,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingLeft: 4,
              }}
            >
              <View
                style={{
                  backgroundColor: rankBadgeColor(idx + 1),
                  borderRadius: 3,
                  paddingHorizontal: 4,
                  paddingVertical: 1,
                  minWidth: 18,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 8, color: "white" }}>{idx + 1}</Text>
              </View>
              <Text style={{ fontSize: 10, color: PDF_COLORS.dark, flex: 1 }}>
                {entry.participantName}
              </Text>
            </View>
            <MetricCell
              value={formatRings(entry.bestRings, entry.bestRingsScoringType ?? "WHOLE")}
              rank={entry.bestRings_rank}
              width={W_NO_SERIES.rings}
              muted={metricMuted(entry, "rings", false)}
            />
            <MetricCell
              value={formatDecimal1(entry.bestCorrectedTeiler)}
              rank={entry.bestTeiler_rank}
              width={W_NO_SERIES.teiler}
              muted={metricMuted(entry, "teiler", true)}
            />
            <MetricCell
              value={formatDecimal1(entry.bestRingteiler)}
              rank={entry.bestRingteiler_rank}
              width={W_NO_SERIES.ringteiler}
              muted={metricMuted(entry, "ringteiler", false)}
            />
          </View>
        )
      })}
    </View>
  )
}

// ─── Dokument ─────────────────────────────────────────────────────────────────

export function SeasonStandingsPdf({
  competitionName,
  disciplineName,
  seasonStart,
  seasonEnd,
  scoringMode,
  shotsPerSeries,
  minSeries,
  isMixed,
  entries,
  sort,
  generatedAt,
  displayTimeZone,
}: SeasonStandingsPdfProps): ReactElement {
  const disciplineDisplay = disciplineName ?? "Gemischt"
  const alternating = isAlternatingSort(sort)

  let seasonRange = ""
  if (seasonStart) {
    seasonRange = formatDateOnly(seasonStart, displayTimeZone)
    if (seasonEnd) seasonRange += ` – ${formatDateOnly(seasonEnd, displayTimeZone)}`
  }

  return (
    <Document title={`${competitionName} – Rangliste`} author="Ringwerk" creator="Ringwerk">
      <Page size="A4" style={styles.page}>
        {/* Kopfzeile */}
        <View style={styles.headerBlock}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>{competitionName}</Text>
            <Text style={styles.headerSubtitle}>
              {disciplineDisplay}
              {seasonRange ? ` · ${seasonRange}` : ""} · Rangliste
            </Text>
          </View>
          <Text style={styles.headerDate}>
            Erstellt: {formatDateOnly(generatedAt, displayTimeZone)}
          </Text>
        </View>

        {/* Config-Zeile — bei alternierender Sortierung definiert die Reihenfolge die Wertung,
            der scoringMode trägt dann nur das Eingabeformat und wäre hier irreführend. */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: alternating ? 4 : 12 }}>
          <Text style={{ fontSize: 9, color: PDF_COLORS.muted }}>
            {alternating
              ? SEASON_SORT_LABELS[sort]
              : (SCORING_MODE_LABELS[scoringMode] ?? scoringMode)}
          </Text>
          <Text style={{ fontSize: 9, color: PDF_COLORS.muted }}>{shotsPerSeries} Schuss</Text>
          {minSeries !== null && (
            <Text style={{ fontSize: 9, color: PDF_COLORS.muted }}>
              Mindest: {minSeries} Serien
            </Text>
          )}
        </View>

        {/* Legende zur alternierenden Sortierung */}
        {alternating && (
          <Text style={{ fontSize: 9, color: PDF_COLORS.muted, marginBottom: 12 }}>
            Hervorgehoben ist der Wert, der den Platz ergeben hat.
          </Text>
        )}

        {/* Rangliste */}
        {entries.length === 0 ? (
          <Text style={{ fontSize: 10, color: PDF_COLORS.muted }}>
            Noch keine Ergebnisse erfasst.
          </Text>
        ) : (
          <StandingsTable entries={entries} minSeries={minSeries} isMixed={isMixed} />
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
