import { Document, Page, View, Text, Svg, Line, G } from "@react-pdf/renderer"
import type { ReactElement } from "react"
import type { ScoringType } from "@/generated/prisma/client"
import type { PlayoffBracketData, PlayoffMatchItem, PlayoffDuelItem } from "@/lib/playoffs/types"
import { formatRings, formatDecimal1 } from "@/lib/series/scoring-format"
import { styles, PDF_COLORS } from "@/lib/pdf/styles"

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface PlayoffsPdfProps {
  leagueName: string
  disciplineName: string
  scoringType: ScoringType
  bracket: PlayoffBracketData
  generatedAt: Date
}

// ─── Bracket-Koordinaten (kompakt für A4 Landscape: 769pt Breite, ~446pt Höhe verfügbar) ──
// AF-Modus: 4*SLOT_W + 3*CONN_W = 722pt, 8*SLOT_H + 3*PAIR_GAP = 420pt — passt auf die Seite.

const SLOT_H = 48
const SLOT_W = 164
const CONN_W = 22
const PAIR_GAP = 12

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function roundLabel(round: string): string {
  switch (round) {
    case "EIGHTH_FINAL":
      return "Achtelfinale"
    case "QUARTER_FINAL":
      return "Viertelfinale"
    case "SEMI_FINAL":
      return "Halbfinale"
    case "FINAL":
      return "Finale"
    default:
      return round
  }
}

function roundColor(round: string): string {
  switch (round) {
    case "FINAL":
      return PDF_COLORS.gold
    case "SEMI_FINAL":
      return PDF_COLORS.silver
    case "QUARTER_FINAL":
      return PDF_COLORS.orange
    default:
      // EIGHTH_FINAL
      return "#3b82f6"
  }
}

function winnerOf(match: PlayoffMatchItem): "A" | "B" | null {
  if (match.winsA > match.winsB) return "A"
  if (match.winsB > match.winsA) return "B"
  return null
}

/** Y-Mittelpunkte eines Tops-Arrays */
function mids(tops: number[]): number[] {
  return tops.map((t) => t + SLOT_H / 2)
}

/** Zentrierter Top-Wert zwischen zwei Mittelpunkten */
function centeredTop(mid1: number, mid2: number): number {
  return (mid1 + mid2) / 2 - SLOT_H / 2
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
        <Text style={styles.headerSubtitle}>{disciplineName} · Playoffs</Text>
      </View>
      <Text style={styles.headerDate}>Erstellt: {formatDate(generatedAt)}</Text>
    </View>
  )
}

// ─── Bracket-Karte (react-pdf View, kein SVG) ─────────────────────────────────

function BracketCard({ match }: { match: PlayoffMatchItem | undefined }): ReactElement {
  const halfH = SLOT_H / 2

  if (!match) {
    return (
      <View
        style={{
          width: SLOT_W,
          height: SLOT_H,
          borderWidth: 1,
          borderColor: "#cccccc",
          borderStyle: "dashed",
          borderRadius: 4,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ fontSize: 8, color: "#aaaaaa" }}>Ausstehend</Text>
      </View>
    )
  }

  const winner = winnerOf(match)
  const color = roundColor(match.round)

  const participants = [
    { p: match.participantA, wins: match.winsA, side: "A" as const },
    { p: match.participantB, wins: match.winsB, side: "B" as const },
  ]

  return (
    <View
      style={{
        width: SLOT_W,
        height: SLOT_H,
        borderWidth: 1,
        borderColor: "#cccccc",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      {participants.map(({ p, wins, side }, i) => {
        const isWinner = winner === side
        return (
          <View
            key={side}
            style={{
              height: halfH,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 6,
              backgroundColor: isWinner ? "#f0faf4" : "#ffffff",
              borderTopWidth: i === 1 ? 1 : 0,
              borderTopColor: "#eeeeee",
              borderTopStyle: "solid",
            }}
          >
            <Text
              style={{
                flex: 1,
                fontSize: 8,
                fontFamily: isWinner ? "Helvetica-Bold" : "Helvetica",
                color: isWinner ? color : "#444444",
              }}
            >
              {p.firstName} {p.lastName}
            </Text>
            <Text
              style={{
                fontSize: 11,
                fontFamily: "Helvetica-Bold",
                color: isWinner ? color : "#888888",
                width: 18,
                textAlign: "right",
              }}
            >
              {wins}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

// ─── SVG-Connector-Linien ─────────────────────────────────────────────────────

interface ConnectorPdf {
  in1: number
  in2: number
  out: number
  xLeft: number // linke Kante des Connectors
}

function ConnectorLineGroup({ conn }: { conn: ConnectorPdf }): ReactElement {
  const midX = conn.xLeft + CONN_W / 2
  const rightX = conn.xLeft + CONN_W
  return (
    <G>
      <Line x1={conn.xLeft} y1={conn.in1} x2={midX} y2={conn.in1} />
      <Line x1={conn.xLeft} y1={conn.in2} x2={midX} y2={conn.in2} />
      <Line x1={midX} y1={conn.in1} x2={midX} y2={conn.in2} />
      <Line x1={midX} y1={conn.out} x2={rightX} y2={conn.out} />
    </G>
  )
}

// ─── Bracket-Layout ───────────────────────────────────────────────────────────

function BracketLayout({ bracket }: { bracket: PlayoffBracketData }): ReactElement {
  const { eighthFinals: af, quarterFinals: qf, semiFinals: hf, final: fin } = bracket
  const isAF = af.length > 0
  const isVF = !isAF && qf.length > 0

  const half = SLOT_H / 2

  let totalH: number
  let afTops: number[]
  let qfTops: number[]
  let hfTops: number[]
  let finalTop: number

  // X-Positionen
  let xAF: number
  let xConnAF: number
  let xQF: number
  let xConnQF: number
  let xHF: number
  let xConnHF: number
  let xFinal: number
  let totalW: number

  interface PairSpec {
    in1: number
    in2: number
    out: number
    xLeft: number
  }
  const connectorPairs: PairSpec[] = []

  if (isAF) {
    afTops = [
      0,
      SLOT_H,
      2 * SLOT_H + PAIR_GAP,
      3 * SLOT_H + PAIR_GAP,
      4 * SLOT_H + 2 * PAIR_GAP,
      5 * SLOT_H + 2 * PAIR_GAP,
      6 * SLOT_H + 3 * PAIR_GAP,
      7 * SLOT_H + 3 * PAIR_GAP,
    ]
    totalH = 8 * SLOT_H + 3 * PAIR_GAP

    const afM = mids(afTops)
    qfTops = [
      centeredTop(afM[0], afM[1]),
      centeredTop(afM[2], afM[3]),
      centeredTop(afM[4], afM[5]),
      centeredTop(afM[6], afM[7]),
    ]
    const qfM = mids(qfTops)
    hfTops = [centeredTop(qfM[0], qfM[1]), centeredTop(qfM[2], qfM[3])]
    const hfM = mids(hfTops)
    finalTop = centeredTop(hfM[0], hfM[1])
    const finM = finalTop + half

    xAF = 0
    xConnAF = SLOT_W
    xQF = xConnAF + CONN_W
    xConnQF = xQF + SLOT_W
    xHF = xConnQF + CONN_W
    xConnHF = xHF + SLOT_W
    xFinal = xConnHF + CONN_W
    totalW = 4 * SLOT_W + 3 * CONN_W

    // AF → QF
    for (let i = 0; i < 4; i++) {
      connectorPairs.push({ in1: afM[i * 2], in2: afM[i * 2 + 1], out: qfM[i], xLeft: xConnAF })
    }
    // QF → HF
    connectorPairs.push({ in1: qfM[0], in2: qfM[1], out: hfM[0], xLeft: xConnQF })
    connectorPairs.push({ in1: qfM[2], in2: qfM[3], out: hfM[1], xLeft: xConnQF })
    // HF → Final
    connectorPairs.push({ in1: hfM[0], in2: hfM[1], out: finM, xLeft: xConnHF })
  } else if (isVF) {
    afTops = []
    qfTops = [0, SLOT_H, 2 * SLOT_H + PAIR_GAP, 3 * SLOT_H + PAIR_GAP]
    totalH = 4 * SLOT_H + PAIR_GAP
    hfTops = [half, 2.5 * SLOT_H + PAIR_GAP]
    finalTop = 1.5 * SLOT_H + PAIR_GAP / 2

    xAF = 0
    xConnAF = 0
    xQF = 0
    xConnQF = SLOT_W
    xHF = xConnQF + CONN_W
    xConnHF = xHF + SLOT_W
    xFinal = xConnHF + CONN_W
    totalW = 3 * SLOT_W + 2 * CONN_W

    const qfM = mids(qfTops)
    const hfM = mids(hfTops)
    const finM = finalTop + half

    connectorPairs.push({ in1: qfM[0], in2: qfM[1], out: hfM[0], xLeft: xConnQF })
    connectorPairs.push({ in1: qfM[2], in2: qfM[3], out: hfM[1], xLeft: xConnQF })
    connectorPairs.push({ in1: hfM[0], in2: hfM[1], out: finM, xLeft: xConnHF })
  } else {
    // HF-only
    afTops = []
    qfTops = []
    totalH = 2 * SLOT_H + PAIR_GAP
    hfTops = [0, SLOT_H + PAIR_GAP]
    finalTop = half + PAIR_GAP / 2

    xAF = 0
    xConnAF = 0
    xQF = 0
    xConnQF = 0
    xHF = 0
    xConnHF = SLOT_W
    xFinal = xConnHF + CONN_W
    totalW = 2 * SLOT_W + CONN_W

    const hfM = mids(hfTops)
    const finM = finalTop + half
    connectorPairs.push({ in1: hfM[0], in2: hfM[1], out: finM, xLeft: xConnHF })
  }

  const labelStyle = {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#888888",
    textAlign: "center" as const,
  }

  return (
    <View>
      {/* Spalten-Beschriftungen */}
      <View style={{ flexDirection: "row", marginBottom: 8 }}>
        {isAF && (
          <>
            <Text style={[labelStyle, { width: SLOT_W }]}>ACHTELFINALE</Text>
            <View style={{ width: CONN_W }} />
          </>
        )}
        {(isAF || isVF) && (
          <>
            <Text style={[labelStyle, { width: SLOT_W }]}>VIERTELFINALE</Text>
            <View style={{ width: CONN_W }} />
          </>
        )}
        <Text style={[labelStyle, { width: SLOT_W }]}>HALBFINALE</Text>
        <View style={{ width: CONN_W }} />
        <Text style={[labelStyle, { width: SLOT_W }]}>FINALE</Text>
      </View>

      {/* Bracket-Körper: absolute positionierte Cards + SVG-Linien-Overlay */}
      <View style={{ position: "relative", width: totalW, height: totalH }}>
        {/* SVG-Connector-Overlay */}
        <Svg style={{ position: "absolute", top: 0, left: 0 }} width={totalW} height={totalH}>
          <G stroke="#cccccc" strokeWidth={1.5} fill="none">
            {connectorPairs.map((p, i) => (
              <ConnectorLineGroup key={i} conn={p} />
            ))}
          </G>
        </Svg>

        {/* AF-Karten */}
        {isAF &&
          afTops.map((top, i) => (
            <View key={i} style={{ position: "absolute", top, left: xAF }}>
              <BracketCard match={af[i]} />
            </View>
          ))}

        {/* QF-Karten */}
        {(isAF || isVF) &&
          qfTops.map((top, i) => (
            <View key={i} style={{ position: "absolute", top, left: xQF }}>
              <BracketCard match={qf[i]} />
            </View>
          ))}

        {/* HF-Karten */}
        {hfTops.map((top, i) => (
          <View key={i} style={{ position: "absolute", top, left: xHF }}>
            <BracketCard match={hf[i]} />
          </View>
        ))}

        {/* Finale */}
        <View style={{ position: "absolute", top: finalTop, left: xFinal }}>
          <BracketCard match={fin ?? undefined} />
        </View>
      </View>
    </View>
  )
}

// ─── Duel-Detail-Tabellen ─────────────────────────────────────────────────────

function duelWinnerLabel(duel: PlayoffDuelItem, match: PlayoffMatchItem): string {
  if (!duel.winnerId) return "Unentschieden"
  if (duel.winnerId === match.participantA.id) {
    return `${match.participantA.firstName} ${match.participantA.lastName}`
  }
  return `${match.participantB.firstName} ${match.participantB.lastName}`
}

function duelResultText(duel: PlayoffDuelItem, isFinal: boolean, scoringType: ScoringType): string {
  if (!duel.isCompleted) return "Ausstehend"
  if (!duel.resultA || !duel.resultB) return "—"

  if (isFinal) {
    return `${formatRings(duel.resultA.totalRings, scoringType)} R  vs  ${formatRings(duel.resultB.totalRings, scoringType)} R`
  }
  const rtA = formatDecimal1(duel.resultA.ringteiler ?? null)
  const rtB = formatDecimal1(duel.resultB.ringteiler ?? null)
  return `RT ${rtA}  vs  RT ${rtB}`
}

function MatchDetail({
  match,
  index,
  total,
  scoringType,
}: {
  match: PlayoffMatchItem
  index: number
  total: number
  scoringType: ScoringType
}): ReactElement {
  const isFinal = match.round === "FINAL"
  const winner = winnerOf(match)
  const winnerName =
    winner === "A"
      ? `${match.participantA.firstName} ${match.participantA.lastName}`
      : winner === "B"
        ? `${match.participantB.firstName} ${match.participantB.lastName}`
        : null

  // Immer Nummer anzeigen, wenn mehr als ein Match in der Runde
  const suffix = total > 1 ? ` ${index + 1}` : ""
  const title = `${roundLabel(match.round)}${suffix}`
  const score = `${match.winsA} : ${match.winsB}`
  const color = roundColor(match.round)

  return (
    <View style={{ marginBottom: 10 }} wrap={false}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 4,
        }}
      >
        <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1a1a1a" }}>
          {title}: {match.participantA.firstName} {match.participantA.lastName} vs.{" "}
          {match.participantB.firstName} {match.participantB.lastName} — {score}
        </Text>
        {winnerName && (
          <Text style={{ fontSize: 9, color, fontFamily: "Helvetica-Bold" }}>
            Sieger: {winnerName}
          </Text>
        )}
      </View>

      <View style={styles.table}>
        <View style={styles.tableHeaderRow}>
          <Text style={[styles.tableHeaderCell, { width: 50 }]}>Duell</Text>
          <Text style={[styles.tableHeaderCell, { width: 160 }]}>Ergebnis</Text>
          <Text style={[styles.tableHeaderCellLeft, { flex: 1 }]}>Entscheidung</Text>
        </View>

        {match.duels.map((duel, idx) => (
          <View key={duel.id} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
            <Text style={[styles.tableCell, { width: 50, fontSize: 9 }]}>
              {duel.isSuddenDeath ? "Verl." : `Duell ${duel.duelNumber}`}
            </Text>
            <Text style={[styles.tableCell, { width: 160, fontSize: 9 }]}>
              {duelResultText(duel, isFinal, scoringType)}
            </Text>
            <Text style={[styles.tableCellLeft, { flex: 1, fontSize: 9 }]}>
              {duel.isCompleted ? duelWinnerLabel(duel, match) : "—"}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function DetailSection({
  bracket,
  scoringType,
}: {
  bracket: PlayoffBracketData
  scoringType: ScoringType
}): ReactElement {
  const { eighthFinals: af, quarterFinals: qf, semiFinals: hf, final: fin } = bracket

  return (
    <View>
      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Ergebnisse im Detail</Text>

      {af.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text
            style={[
              styles.sectionSubtitle,
              { marginBottom: 6, fontFamily: "Helvetica-Bold", color: "#3b82f6" },
            ]}
          >
            Achtelfinale
          </Text>
          {af.map((m, i) => (
            <MatchDetail
              key={m.id}
              match={m}
              index={i}
              total={af.length}
              scoringType={scoringType}
            />
          ))}
        </View>
      )}

      {qf.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text
            style={[
              styles.sectionSubtitle,
              { marginBottom: 6, fontFamily: "Helvetica-Bold", color: PDF_COLORS.orange },
            ]}
          >
            Viertelfinale
          </Text>
          {qf.map((m, i) => (
            <MatchDetail
              key={m.id}
              match={m}
              index={i}
              total={qf.length}
              scoringType={scoringType}
            />
          ))}
        </View>
      )}

      {hf.length > 0 && (
        <View style={{ marginBottom: 8 }}>
          <Text
            style={[
              styles.sectionSubtitle,
              { marginBottom: 6, fontFamily: "Helvetica-Bold", color: PDF_COLORS.silver },
            ]}
          >
            Halbfinale
          </Text>
          {hf.map((m, i) => (
            <MatchDetail
              key={m.id}
              match={m}
              index={i}
              total={hf.length}
              scoringType={scoringType}
            />
          ))}
        </View>
      )}

      {fin && (
        <View>
          <Text
            style={[
              styles.sectionSubtitle,
              { marginBottom: 6, fontFamily: "Helvetica-Bold", color: PDF_COLORS.gold },
            ]}
          >
            Finale
          </Text>
          <MatchDetail match={fin} index={0} total={1} scoringType={scoringType} />
        </View>
      )}
    </View>
  )
}

// ─── Dokument ─────────────────────────────────────────────────────────────────

export function PlayoffsPdf({
  leagueName,
  disciplineName,
  scoringType,
  bracket,
  generatedAt,
}: PlayoffsPdfProps): ReactElement {
  return (
    <Document title={`${leagueName} – Playoffs`} author="Ringwerk" creator="Ringwerk">
      {/* Seite 1: Bracket (Querformat) */}
      <Page size="A4" orientation="landscape" style={styles.pageLandscape}>
        <PdfHeader
          leagueName={leagueName}
          disciplineName={disciplineName}
          generatedAt={generatedAt}
        />
        <BracketLayout bracket={bracket} />
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{leagueName} · Playoffs</Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
              `Seite ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>

      {/* Seite 2+: Ergebnisse im Detail (Hochformat) */}
      <Page size="A4" style={styles.page}>
        <PdfHeader
          leagueName={leagueName}
          disciplineName={disciplineName}
          generatedAt={generatedAt}
        />
        <DetailSection bracket={bracket} scoringType={scoringType} />
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{leagueName} · Playoffs</Text>
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
