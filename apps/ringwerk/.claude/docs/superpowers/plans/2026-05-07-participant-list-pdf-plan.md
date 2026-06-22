# Teilnehmerliste PDF — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aktive Vereinsmitglieder als PDF exportieren — für den Bürodienst bei Events.

**Architecture:** Neues `ParticipantListPdf.tsx` react-pdf-Dokument + neue API-Route `/api/participants/pdf` (analog zu bestehenden PDF-Routes) + `PdfDownloadButton` auf der Teilnehmerseite. Keine Schema-Änderung, keine neue Query nötig.

**Tech Stack:** `@react-pdf/renderer`, Next.js App Router API Routes, bestehende `styles.ts` Styles.

---

## Required Docs

- `.claude/docs/code-conventions.md` — immer
- `.claude/docs/reference-files.md` — immer (Muster finden)
- `.claude/docs/architecture.md` — immer
- `.claude/docs/ui-patterns.md` — beim Bearbeiten von `.tsx`

---

## Dateiübersicht

| Datei                                   | Aktion        | Verantwortung                                             |
| --------------------------------------- | ------------- | --------------------------------------------------------- |
| `src/lib/pdf/ParticipantListPdf.tsx`    | Neu erstellen | react-pdf Dokument: Header, Tabelle, Leerzeilen, Footer   |
| `src/app/api/participants/pdf/route.ts` | Neu erstellen | API-Route: Auth-Check, Daten holen, PDF rendern, Response |
| `src/app/(app)/participants/page.tsx`   | Ändern        | `PdfDownloadButton` in den Header einbauen                |

---

## Task 1: ParticipantListPdf-Komponente erstellen

**Files:**

- Create: `src/lib/pdf/ParticipantListPdf.tsx`

Spaltenbreiten (Summe = 515pt = A4 Portrait mit 40pt Rändern):

| Spalte         | Breite |
| -------------- | ------ |
| Name           | 200pt  |
| Disziplin      | 115pt  |
| Einlage        | 60pt   |
| Teilnahme      | 70pt   |
| Hat geschossen | 70pt   |

- [ ] **Datei erstellen**

```tsx
import { Document, Page, View, Text } from "@react-pdf/renderer"
import type { ReactElement } from "react"
import { styles } from "@/lib/pdf/styles"

const W = { name: 200, disziplin: 115, einlage: 60, teilnahme: 70, geschossen: 70 }
const EMPTY_ROWS = 10

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function Checkbox(): ReactElement {
  return (
    <View
      style={{
        width: 14,
        height: 14,
        borderWidth: 1,
        borderColor: "#aaaaaa",
        borderStyle: "solid",
        borderRadius: 2,
      }}
    />
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
            <Text style={[styles.tableHeaderCellLeft, { width: W.disziplin }]}>Disziplin</Text>
            <Text style={[styles.tableHeaderCell, { width: W.einlage }]}>Einlage</Text>
            <Text style={[styles.tableHeaderCell, { width: W.teilnahme }]}>Teilnahme</Text>
            <Text style={[styles.tableHeaderCell, { width: W.geschossen }]}>Hat geschossen</Text>
          </View>

          {/* Teilnehmer-Zeilen */}
          {participants.map((p, idx) => (
            <View
              key={`${p.lastName}-${p.firstName}-${idx}`}
              wrap={false}
              style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}
            >
              <Text style={[styles.tableCellLeft, { width: W.name }]}>
                {p.lastName}, {p.firstName}
              </Text>
              <Text style={[styles.tableCellLeft, { width: W.disziplin }]}> </Text>
              <Text style={[styles.tableCell, { width: W.einlage }]}> </Text>
              <View style={{ width: W.teilnahme, alignItems: "center" }}>
                <Checkbox />
              </View>
              <View style={{ width: W.geschossen, alignItems: "center" }}>
                <Checkbox />
              </View>
            </View>
          ))}

          {/* Leerzeilen für Spontanstarter */}
          {Array.from({ length: EMPTY_ROWS }).map((_, i) => (
            <View
              key={`empty-${i}`}
              wrap={false}
              style={[styles.tableRow, { backgroundColor: "#fafafa" }]}
            >
              <Text style={[styles.tableCellLeft, { width: W.name }]}> </Text>
              <Text style={[styles.tableCellLeft, { width: W.disziplin }]}> </Text>
              <Text style={[styles.tableCell, { width: W.einlage }]}> </Text>
              <View style={{ width: W.teilnahme, alignItems: "center" }}>
                <Checkbox />
              </View>
              <View style={{ width: W.geschossen, alignItems: "center" }}>
                <Checkbox />
              </View>
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
```

- [ ] **Commit**

```
feat: add ParticipantListPdf component
```

---

## Task 2: API-Route erstellen

**Files:**

- Create: `src/app/api/participants/pdf/route.ts`

Referenz-Implementierung für das Muster: `src/app/api/competitions/[id]/pdf/schedule/route.ts`

- [ ] **Verzeichnis anlegen und Datei erstellen**

```ts
import { type NextRequest, NextResponse } from "next/server"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { createElement, type ReactElement } from "react"
import { getAuthSession } from "@/lib/auth-helpers"
import { getParticipants } from "@/lib/participants/queries"
import { ParticipantListPdf } from "@/lib/pdf/ParticipantListPdf"

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await getAuthSession()
  if (!session) {
    return new NextResponse("Nicht angemeldet", { status: 401 })
  }

  const participants = await getParticipants()

  const element = createElement(ParticipantListPdf, {
    participants,
    generatedAt: new Date(),
  }) as ReactElement<DocumentProps>

  const buffer = await renderToBuffer(element)

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="teilnehmerliste.pdf"',
      "Cache-Control": "no-store",
    },
  })
}
```

- [ ] **Commit**

```
feat: add GET /api/participants/pdf route
```

---

## Task 3: Download-Button auf Teilnehmerseite

**Files:**

- Modify: `src/app/(app)/participants/page.tsx`

Referenz für das Button-Pattern: `src/app/(app)/competitions/[id]/schedule/page.tsx` (dort ist `PdfDownloadButton` bereits verwendet).

- [ ] **Import hinzufügen** (nach den bestehenden Imports in `page.tsx`)

```tsx
import { PdfDownloadButton } from "@/components/app/shared/PdfDownloadButton"
```

- [ ] **Header-Bereich anpassen**

Bestehender Code (Zeile ~24–30):

```tsx
<Button asChild size="sm">
  <Link href="/participants/new">
    <Plus className="mr-1 h-4 w-4" />
    Neuer Teilnehmer
  </Link>
</Button>
```

Ersetzen durch:

```tsx
<div className="flex items-center gap-2">
  <PdfDownloadButton href="/api/participants/pdf" label="Teilnehmerliste drucken" />
  <Button asChild size="sm">
    <Link href="/participants/new">
      <Plus className="mr-1 h-4 w-4" />
      Neuer Teilnehmer
    </Link>
  </Button>
</div>
```

- [ ] **Commit**

```
feat: add participant list PDF download button
```

---

## Task 4: Qualitätsprüfung

- [ ] **Alle Quality-Gates ausführen**

```bash
/check
```

Erwartet: alle Gates grün (lint, format, tests, tsc).

- [ ] **Manuelle Prüfung:** Dev-Server starten, `/participants` aufrufen, PDF-Button klicken, PDF öffnen und prüfen:
  - Kopfzeile korrekt
  - Alle aktiven Teilnehmer aufgelistet (Nachname, Vorname)
  - Leere Zellen in Disziplin/Einlage
  - Kästchen in Teilnahme/Hat-geschossen-Spalten
  - 10 Leerzeilen am Ende (leicht grauer Hintergrund)
  - Footer mit Seitenzahl
  - Keine abgeschnittenen Zeilen an Seitenrändern
