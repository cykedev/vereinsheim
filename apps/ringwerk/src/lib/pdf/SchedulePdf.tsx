import { Document, Page, View, Text } from "@react-pdf/renderer"
import type { ReactElement } from "react"
import type { ScoringType } from "@/generated/prisma/client"
import type { MatchupListItem } from "@/lib/matchups/types"
import type { StandingRow } from "@/lib/standings/calculateStandings"
import { formatRings, formatDecimal1 } from "@/lib/series/scoring-format"
import { styles } from "@/lib/pdf/styles"

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface SchedulePdfProps {
  leagueName: string
  disciplineName: string
  scoringType: ScoringType
  standings: StandingRow[]
  matchups: MatchupListItem[]
  firstLegDeadline: Date | null
  secondLegDeadline: Date | null
  generatedAt: Date
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function rankBadgeColor(rank: number): string {
  if (rank === 1) return "#b8860b"
  if (rank === 2) return "#6b7280"
  if (rank === 3) return "#c2410c"
  return "#9ca3af"
}

// ─── Kopfzeile ────────────────────────────────────────────────────────────────

function PdfHeader({
  leagueName,
  disciplineName,
  generatedAt,
}: {
  leagueName: string
  disciplineName: string
  generatedAt: Date
}): ReactElement {
  return (
    <View style={styles.headerBlock}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerTitle}>{leagueName}</Text>
        <Text style={styles.headerSubtitle}>{disciplineName} · Spielplan &amp; Tabelle</Text>
      </View>
      <Text style={styles.headerDate}>Erstellt: {formatDate(generatedAt)}</Text>
    </View>
  )
}

// ─── Tabellen-Abschnitt ───────────────────────────────────────────────────────

// Spaltenbreiten (in pt, Summe ≤ 515pt bei A4 portrait mit 40pt Rand je Seite)
const W = { rank: 28, name: 165, sp: 28, s: 28, u: 28, n: 28, pkt: 32, rt: 50 }

function StandingsSection({ rows }: { rows: StandingRow[] }): ReactElement {
  return (
    <View>
      <Text style={styles.sectionTitle}>Tabelle</Text>
      <View style={styles.table}>
        {/* Header */}
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCell, { width: W.rank }]}>Pl.</Text>
          <Text style={[styles.tableHeaderCellLeft, { width: W.name }]}>Name</Text>
          <Text style={[styles.tableHeaderCell, { width: W.sp }]}>Sp.</Text>
          <Text style={[styles.tableHeaderCell, { width: W.s }]}>S</Text>
          <Text style={[styles.tableHeaderCell, { width: W.u }]}>U</Text>
          <Text style={[styles.tableHeaderCell, { width: W.n }]}>N</Text>
          <Text style={[styles.tableHeaderCell, { width: W.pkt }]}>Pkt.</Text>
          <Text style={[styles.tableHeaderCell, { width: W.rt }]}>Best. RT</Text>
        </View>

        {/* Zeilen */}
        {rows.map((row, idx) => {
          const isAlt = idx % 2 === 1
          const name = `${row.firstName} ${row.lastName}${row.withdrawn ? " (Zur.)" : ""}`
          return (
            <View
              key={row.participantId}
              style={[
                styles.tableRow,
                isAlt ? styles.tableRowAlt : {},
                row.withdrawn ? styles.tableRowWithdrawn : {},
              ]}
            >
              {/* Rang-Abzeichen */}
              <View style={{ width: W.rank, alignItems: "center" }}>
                {!row.withdrawn && (
                  <View style={[styles.rankBadge, { backgroundColor: rankBadgeColor(row.rank) }]}>
                    <Text style={styles.rankBadgeText}>{row.rank}</Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  row.withdrawn ? styles.tableCellMuted : styles.tableCellLeft,
                  { width: W.name },
                ]}
              >
                {name}
              </Text>
              <Text style={[styles.tableCell, { width: W.sp }]}>{row.played}</Text>
              <Text style={[styles.tableCell, { width: W.s }]}>{row.wins}</Text>
              <Text style={[styles.tableCell, { width: W.u }]}>{row.draws}</Text>
              <Text style={[styles.tableCell, { width: W.n }]}>{row.losses}</Text>
              <Text style={[styles.tableCellBold, { width: W.pkt }]}>{row.points}</Text>
              <Text style={[styles.tableCell, { width: W.rt }]}>
                {formatDecimal1(row.bestRingteiler)}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

// ─── Spielplan-Abschnitt (ein Umlauf) ─────────────────────────────────────────

// Spaltenbreiten Spielplan (kein separater Ergebnis-Block mehr)
const SW = { home: 225, away: 225, status: 65 }

type MatchStatus = "PENDING" | "COMPLETED" | "BYE" | "WALKOVER"

function statusLabel(status: MatchStatus): string {
  switch (status) {
    case "COMPLETED":
      return "Abg."
    case "BYE":
      return "Freilos"
    case "WALKOVER":
      return "Kampfl."
    default:
      return "Offen"
  }
}

function PlayerCell({
  name,
  result,
  isWinner,
  isRowWithdrawn,
  scoringType,
}: {
  name: string
  result: { rings: number; teiler: number; ringteiler: number } | null
  isWinner: boolean
  isRowWithdrawn: boolean
  scoringType: ScoringType
}): ReactElement {
  if (isRowWithdrawn) {
    return (
      <View style={styles.playerCell}>
        <Text style={styles.playerNameWithdrawn}>{name}</Text>
      </View>
    )
  }

  return (
    <View style={[styles.playerCell, isWinner ? styles.playerCellWinner : {}]}>
      <Text style={isWinner ? styles.playerNameWinner : styles.playerName}>{name}</Text>
      {result && (
        <Text style={styles.resultSmall}>
          {`${formatRings(result.rings, scoringType)} R \u00b7 T ${formatDecimal1(result.teiler)} \u00b7 RT `}
          <Text style={isWinner ? styles.resultSmallRT : {}}>
            {formatDecimal1(result.ringteiler)}
          </Text>
        </Text>
      )}
    </View>
  )
}

function MatchupSection({
  title,
  subtitle,
  matchups,
  scoringType,
}: {
  title: string
  subtitle: string
  matchups: MatchupListItem[]
  scoringType: ScoringType
}): ReactElement {
  const byRound = new Map<number, MatchupListItem[]>()
  for (const m of matchups) {
    const existing = byRound.get(m.roundIndex) ?? []
    existing.push(m)
    byRound.set(m.roundIndex, existing)
  }
  const rounds = [...byRound.entries()].sort(([a], [b]) => a - b)

  return (
    <View break>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      <View style={styles.table}>
        {/* Header */}
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCellLeft, { width: SW.home }]}>Schütze 1</Text>
          <Text style={[styles.tableHeaderCellLeft, { width: SW.away }]}>Schütze 2</Text>
          <Text style={[styles.tableHeaderCell, { width: SW.status }]}>Status</Text>
        </View>

        {rounds.map(([roundIndex, items]) => (
          <View key={roundIndex}>
            {items
              .filter((m) => m.status !== "BYE" && m.status !== "WALKOVER")
              .map((m, idx) => {
                const homeRes = m.results.find((r) => r.participantId === m.homeParticipant.id)
                const awayRes = m.awayParticipant
                  ? m.results.find((r) => r.participantId === m.awayParticipant!.id)
                  : null

                const homeWins =
                  homeRes && awayRes ? homeRes.ringteiler < awayRes.ringteiler : false
                const awayWins =
                  homeRes && awayRes ? awayRes.ringteiler < homeRes.ringteiler : false

                const isCompleted = m.status === "COMPLETED"
                const isPending = m.status === "PENDING"

                const homeName = `${m.homeParticipant.firstName} ${m.homeParticipant.lastName}`
                const awayName = m.awayParticipant
                  ? `${m.awayParticipant.firstName} ${m.awayParticipant.lastName}`
                  : "— Freilos —"

                const isRowWithdrawn =
                  m.homeParticipant.withdrawn || (m.awayParticipant?.withdrawn ?? false)
                const isAlt = idx % 2 === 1
                const rowBg = isAlt ? styles.tableRowAlt : {}

                return (
                  <View
                    key={m.id}
                    wrap={false}
                    style={[styles.tableRow, rowBg, { alignItems: "center" }]}
                  >
                    <View style={{ width: SW.home }}>
                      <PlayerCell
                        name={homeName}
                        result={isCompleted && homeRes && !isRowWithdrawn ? homeRes : null}
                        isWinner={!isRowWithdrawn && homeWins}
                        isRowWithdrawn={isRowWithdrawn}
                        scoringType={scoringType}
                      />
                    </View>
                    <View style={{ width: SW.away }}>
                      <PlayerCell
                        name={awayName}
                        result={isCompleted && awayRes && !isRowWithdrawn ? awayRes : null}
                        isWinner={!isRowWithdrawn && awayWins}
                        isRowWithdrawn={isRowWithdrawn}
                        scoringType={scoringType}
                      />
                    </View>
                    <Text
                      style={[
                        isPending ? styles.statusPending : styles.statusDone,
                        { width: SW.status },
                      ]}
                    >
                      {m.homeParticipant.withdrawn || (m.awayParticipant?.withdrawn ?? false)
                        ? "Zur."
                        : statusLabel(m.status)}
                    </Text>
                  </View>
                )
              })}
          </View>
        ))}
      </View>
    </View>
  )
}

// ─── Dokument ─────────────────────────────────────────────────────────────────

export function SchedulePdf({
  leagueName,
  disciplineName,
  scoringType,
  standings,
  matchups,
  firstLegDeadline,
  secondLegDeadline,
  generatedAt,
}: SchedulePdfProps): ReactElement {
  const firstLeg = matchups.filter((m) => m.round === "FIRST_LEG")
  const secondLeg = matchups.filter((m) => m.round === "SECOND_LEG")

  return (
    <Document title={`${leagueName} – Spielplan`} author="Ringwerk" creator="Ringwerk">
      <Page size="A4" style={styles.page}>
        {/* Kopfzeile */}
        <PdfHeader
          leagueName={leagueName}
          disciplineName={disciplineName}
          generatedAt={generatedAt}
        />

        {/* Tabelle */}
        {standings.length > 0 && <StandingsSection rows={standings} />}

        {/* Hinrunde */}
        {firstLeg.length > 0 && (
          <MatchupSection
            title="Hinrunde"
            subtitle={firstLegDeadline ? `Abgabe bis ${formatDate(firstLegDeadline)}` : ""}
            matchups={firstLeg}
            scoringType={scoringType}
          />
        )}

        {/* Rückrunde */}
        {secondLeg.length > 0 && (
          <MatchupSection
            title="Rückrunde"
            subtitle={secondLegDeadline ? `Abgabe bis ${formatDate(secondLegDeadline)}` : ""}
            matchups={secondLeg}
            scoringType={scoringType}
          />
        )}

        {/* Fußzeile */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{leagueName}</Text>
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
