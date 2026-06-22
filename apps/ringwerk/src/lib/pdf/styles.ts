import { StyleSheet } from "@react-pdf/renderer"

// ─── Farb-Konstanten ──────────────────────────────────────────────────────────

export const PDF_COLORS = {
  dark: "#1a1a1a",
  muted: "#555555",
  border: "#dddddd",
  altRow: "#f5f5f5",
  winRow: "#f0faf4",
  headerBg: "#1a1a1a",
  gold: "#b8860b",
  silver: "#6b7280",
  orange: "#c2410c",
  accent: "#2563eb",
} as const

// ─── Gemeinsames StyleSheet ────────────────────────────────────────────────────

export const styles = StyleSheet.create({
  // ── Seite ──────────────────────────────────────────────────────────────────
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a1a",
    paddingTop: 36,
    paddingBottom: 48,
    paddingLeft: 40,
    paddingRight: 40,
    backgroundColor: "#ffffff",
  },
  pageLandscape: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a1a",
    paddingTop: 30,
    paddingBottom: 44,
    paddingLeft: 36,
    paddingRight: 36,
    backgroundColor: "#ffffff",
  },

  // ── Kopfzeile ──────────────────────────────────────────────────────────────
  headerBlock: {
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a1a",
    borderBottomStyle: "solid",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerLeft: {
    flexDirection: "column",
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 10,
    color: "#555555",
  },
  headerDate: {
    fontSize: 9,
    color: "#555555",
    textAlign: "right",
  },

  // ── Fußzeile ───────────────────────────────────────────────────────────────
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#dddddd",
    borderTopStyle: "solid",
    paddingTop: 6,
  },
  footerText: {
    fontSize: 8,
    color: "#888888",
  },

  // ── Abschnitts-Überschrift ────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    marginBottom: 6,
    marginTop: 14,
  },
  sectionSubtitle: {
    fontSize: 9,
    color: "#555555",
    marginBottom: 6,
    marginTop: -4,
  },

  // ── Tabellen-Grundstruktur ────────────────────────────────────────────────
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#dddddd",
    borderStyle: "solid",
    borderRadius: 4,
    overflow: "hidden",
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    textAlign: "center",
  },
  tableHeaderCellLeft: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    textAlign: "left",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
    borderBottomStyle: "solid",
    minHeight: 22,
    alignItems: "center",
  },
  tableRowAlt: {
    backgroundColor: "#f5f5f5",
  },
  tableRowWin: {
    backgroundColor: "#f0faf4",
  },
  tableRowWithdrawn: {
    opacity: 0.5,
  },
  tableCell: {
    fontSize: 10,
    color: "#1a1a1a",
    textAlign: "center",
  },
  tableCellLeft: {
    fontSize: 10,
    color: "#1a1a1a",
    textAlign: "left",
  },
  tableCellBold: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    textAlign: "center",
  },
  tableCellBoldLeft: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    textAlign: "left",
  },
  tableCellWinner: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#166534",
    textAlign: "left",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  tableCellMuted: {
    fontSize: 10,
    color: "#777777",
    textAlign: "left",
  },

  // ── Spielplan spezifisch ──────────────────────────────────────────────────
  tableRowPending: {
    backgroundColor: "#fafafa",
  },
  resultCell: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "stretch",
    paddingHorizontal: 6,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  resultArrowLeft: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#888888",
    width: 16,
    textAlign: "left",
  },
  resultArrowRight: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#888888",
    width: 16,
    textAlign: "right",
  },
  resultArrowSpacer: {
    width: 16,
  },
  resultLine: {
    fontSize: 9,
    color: "#1a1a1a",
    textAlign: "left",
  },
  resultLineSub: {
    fontSize: 9,
    color: "#888888",
    textAlign: "left",
  },
  resultEmpty: {
    fontSize: 9,
    color: "#bbbbbb",
    textAlign: "center",
  },
  statusPending: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#888888",
    textAlign: "center",
  },
  statusDone: {
    fontSize: 9,
    color: "#1a1a1a",
    textAlign: "center",
  },
  statusBye: {
    fontSize: 9,
    color: "#555555",
    textAlign: "center",
  },

  // ── Spieler-Zelle (Spielplan) ────────────────────────────────────────────────
  playerCell: {
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  playerCellWinner: {
    backgroundColor: "#dcfce7",
  },
  playerName: {
    fontSize: 10,
    color: "#1a1a1a",
  },
  playerNameWinner: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#166534",
  },
  playerNameWithdrawn: {
    fontSize: 10,
    color: "#bbbbbb",
    textDecoration: "line-through",
  },
  resultSmall: {
    fontSize: 8,
    color: "#999999",
    marginTop: 1,
  },
  resultSmallRT: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#555555",
  },

  // ── Rang-Abzeichen ─────────────────────────────────────────────────────────
  rankBadge: {
    width: 18,
    borderRadius: 3,
    paddingVertical: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadgeText: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },

  // ── Kästchen ───────────────────────────────────────────────────────────────
  checkbox: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: "#aaaaaa",
    borderStyle: "solid",
    borderRadius: 2,
  },
})
