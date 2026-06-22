import { Document, Page, View, Text } from "@react-pdf/renderer"
import type { ReactElement, ReactNode } from "react"
import { styles } from "@/lib/pdf/styles"

const W = { name: 200, disziplin: 115, einlage: 60, teilnahme: 70, geschossen: 70 }
const ROW_H = 28
const EMPTY_ROWS = 10

function formatDate(date: Date): string {
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

function PdfHeader({ generatedAt }: { generatedAt: Date }): ReactElement {
  return (
    <View style={styles.headerBlock}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerTitle}>Teilnehmerliste</Text>
        <Text style={styles.headerSubtitle}>Aktive Vereinsmitglieder</Text>
      </View>
      <Text style={styles.headerDate}>Erstellt: {formatDate(generatedAt)}</Text>
    </View>
  )
}

export interface ParticipantListPdfProps {
  participants: { firstName: string; lastName: string }[]
  generatedAt: Date
}

export function ParticipantListPdf({
  participants,
  generatedAt,
}: ParticipantListPdfProps): ReactElement {
  return (
    <Document title="Teilnehmerliste" author="Ringwerk" creator="Ringwerk">
      <Page size="A4" style={styles.page}>
        <PdfHeader generatedAt={generatedAt} />

        <View style={styles.table}>
          {/* Kopfzeile */}
          <View style={styles.tableHeaderRow}>
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
              key={`${p.lastName}-${p.firstName}-${idx}`}
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
              <Cell width={W.name} borderRight paddingLeft={8}>
                <Text style={styles.tableCellLeft}>
                  {p.lastName}, {p.firstName}
                </Text>
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
          <Text style={styles.footerText}>Teilnehmerliste</Text>
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
