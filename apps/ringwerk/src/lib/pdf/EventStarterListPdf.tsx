import { Document, Page, View, Text } from "@react-pdf/renderer"
import type { ReactElement, ReactNode } from "react"
import { styles } from "@/lib/pdf/styles"

const W = { nr: 30, name: 185, disziplin: 110, einlage: 60, teilnahme: 65, geschossen: 65 }
const ROW_H = 28
const EMPTY_ROWS = 10

function formatDateDe(date: Date): string {
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function Checkbox(): ReactElement {
  return <View style={styles.checkbox} />
}

function Cell({
  children,
  width,
  borderRight = false,
  paddingLeft = 0,
  align = "flex-start",
}: {
  children: ReactNode
  width: number
  borderRight?: boolean
  paddingLeft?: number
  align?: "flex-start" | "center"
}): ReactElement {
  return (
    <View
      style={{
        width,
        height: ROW_H,
        paddingLeft,
        justifyContent: "center",
        alignItems: align,
        borderRightWidth: borderRight ? 1 : 0,
        borderRightColor: "#dddddd",
        borderRightStyle: "solid",
      }}
    >
      {children}
    </View>
  )
}

interface PdfHeaderProps {
  competitionName: string
  eventDate: Date | null
  generatedAt: Date
}

function PdfHeader({ competitionName, eventDate, generatedAt }: PdfHeaderProps): ReactElement {
  const subtitle = eventDate ? `${competitionName} · ${formatDateDe(eventDate)}` : competitionName
  return (
    <View style={styles.headerBlock}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerTitle}>Starterliste</Text>
        <Text style={styles.headerSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.headerDate}>Erstellt: {formatDateDe(generatedAt)}</Text>
    </View>
  )
}

export interface EventStarterListPdfProps {
  competitionName: string
  eventDate: Date | null
  participants: {
    nr: number
    firstName: string
    lastName: string
    disciplineName: string | null
  }[]
  generatedAt: Date
}

export function EventStarterListPdf({
  competitionName,
  eventDate,
  participants,
  generatedAt,
}: EventStarterListPdfProps): ReactElement {
  return (
    <Document title="Starterliste" author="Ringwerk" creator="Ringwerk">
      <Page size="A4" style={styles.page}>
        <PdfHeader
          competitionName={competitionName}
          eventDate={eventDate}
          generatedAt={generatedAt}
        />

        <View style={styles.table}>
          {/* Kopfzeile */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderCell, { width: W.nr }]}>Nr.</Text>
            <Text style={[styles.tableHeaderCellLeft, { width: W.name }]}>Name</Text>
            <Text style={[styles.tableHeaderCellLeft, { width: W.disziplin, paddingLeft: 5 }]}>
              Disziplin
            </Text>
            <Text style={[styles.tableHeaderCell, { width: W.einlage }]}>Einlage</Text>
            <Text style={[styles.tableHeaderCell, { width: W.teilnahme }]}>Teilnahme</Text>
            <Text style={[styles.tableHeaderCell, { width: W.geschossen }]}>Geschossen</Text>
          </View>

          {/* Teilnehmer-Zeilen */}
          {participants.map((p, idx) => (
            <View
              key={`p-${p.nr}`}
              wrap={false}
              style={[
                {
                  flexDirection: "row",
                  borderBottomWidth: 1,
                  borderBottomColor: "#eeeeee",
                  borderBottomStyle: "solid",
                },
                idx % 2 === 1 ? styles.tableRowAlt : {},
              ]}
            >
              <Cell width={W.nr} borderRight align="center">
                <Text style={styles.tableCellBold}>{p.nr}</Text>
              </Cell>
              <Cell width={W.name} borderRight paddingLeft={8}>
                <Text style={styles.tableCellLeft}>
                  {p.lastName}, {p.firstName}
                </Text>
              </Cell>
              <Cell width={W.disziplin} borderRight paddingLeft={5}>
                <Text style={styles.tableCellLeft}>{p.disciplineName ?? " "}</Text>
              </Cell>
              <Cell width={W.einlage} borderRight align="center">
                <Text style={styles.tableCell}> </Text>
              </Cell>
              <Cell width={W.teilnahme} align="center">
                <Checkbox />
              </Cell>
              <Cell width={W.geschossen} align="center">
                <Checkbox />
              </Cell>
            </View>
          ))}

          {/* Leerzeilen für Spontanstarter */}
          {Array.from({ length: EMPTY_ROWS }).map((_, i) => (
            <View
              key={`empty-${i}`}
              wrap={false}
              style={{
                flexDirection: "row",
                borderBottomWidth: 1,
                borderBottomColor: "#eeeeee",
                borderBottomStyle: "solid",
                backgroundColor: "#fafafa",
              }}
            >
              <Cell width={W.nr} borderRight align="center">
                <Text style={styles.tableCell}> </Text>
              </Cell>
              <Cell width={W.name} borderRight paddingLeft={8}>
                <Text style={styles.tableCellLeft}> </Text>
              </Cell>
              <Cell width={W.disziplin} borderRight paddingLeft={5}>
                <Text style={styles.tableCellLeft}> </Text>
              </Cell>
              <Cell width={W.einlage} borderRight align="center">
                <Text style={styles.tableCell}> </Text>
              </Cell>
              <Cell width={W.teilnahme} align="center">
                <Checkbox />
              </Cell>
              <Cell width={W.geschossen} align="center">
                <Checkbox />
              </Cell>
            </View>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Starterliste — {competitionName}</Text>
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
