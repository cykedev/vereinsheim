---
id: ringwerk-ui-patterns
type: guide
title: "Ringwerk — UI-Patterns – Ringwerk"
aliases: ["UI-Patterns – Ringwerk"]
keywords: [ringwerk, ui-patterns, ringwerk]
part_of: ["[[ringwerk]]"]
---

**TL;DR** Verbindlich für alle neuen und bestehenden UI-Komponenten.

# UI-Patterns – Ringwerk

Verbindlich für alle neuen und bestehenden UI-Komponenten.
Referenzimplementierungen sind die zuerst genannten Dateien.

---

## Listen mit Zeilenaktionen

**Referenz:** `src/components/app/participants/ParticipantRowActions.tsx`

### Aufbau einer Listenzeile

```tsx
<div className="flex items-center justify-between px-4 py-3">
  {/* Linke Seite: Name + Badge + Subtext */}
  <div className="min-w-0 flex-1">
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium">Nachname, Vorname</span>
      <Badge variant="secondary" className="text-xs">Info</Badge>
    </div>
    <p className="text-xs text-muted-foreground">subtext</p>
  </div>
  {/* Rechte Seite: Aktions-Buttons */}
  <XyzRowActions ... />
</div>
```

### Aktions-Buttons: immer Inline, nie Dropdown

```tsx
// RICHTIG — Inline-Icon-Buttons, immer sichtbar
<div className="flex items-center gap-1">
  <Button variant="ghost" size="icon" className="h-10 w-10" title="Bearbeiten">
    <Pencil className="h-4 w-4" />
  </Button>
  <Button variant="ghost" size="icon" className="h-10 w-10" title="Deaktivieren">
    <UserX className="h-4 w-4" />
  </Button>
</div>

// FALSCH — Dropdown versteckt Aktionen
<DropdownMenu>
  <DropdownMenuTrigger>
    <MoreHorizontal />
  </DropdownMenuTrigger>
  ...
</DropdownMenu>
```

Ausnahme: Ligen-Karten (`LeagueActions`) mit vielen status-abhängigen Optionen — dort ist Dropdown akzeptabel.

### Destruktive Aktion: AlertDialog statt `confirm()`

```tsx
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button
      variant="ghost"
      size="icon"
      className="h-10 w-10 text-destructive/70 hover:text-destructive"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Wirklich löschen?</AlertDialogTitle>
      <AlertDialogDescription>...</AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Abbrechen</AlertDialogCancel>
      <AlertDialogAction onClick={handleDelete}>Löschen</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### Bearbeiten-Dialog (inline, kein Seitennavigation)

```tsx
<Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setEditOpen(true)}>
  <Pencil className="h-4 w-4" />
</Button>
<Dialog open={editOpen} onOpenChange={setEditOpen}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader><DialogTitle>... bearbeiten</DialogTitle></DialogHeader>
    <XyzForm ... onSuccess={() => setEditOpen(false)} />
  </DialogContent>
</Dialog>
```

Wenn die Bearbeitung eine eigene Route hat (z.B. Nutzer `/admin/users/[id]/edit`): `router.push(...)` im Button-Click.

---

## Listencontainer

### Standard-Liste (keine Tabelle)

```tsx
// Aktive Einträge
<div className="rounded-lg border bg-card">
  <div className="divide-y">
    {items.map((item) => (
      <div key={item.id} className="flex items-center justify-between px-4 py-3">
        ...
      </div>
    ))}
  </div>
</div>

// Inaktive/zurückgezogene Einträge — immer als eigene Sektion darunter
<div>
  <p className="mb-2 text-sm text-muted-foreground">Inaktiv ({count})</p>
  <div className="rounded-lg border bg-card opacity-60">
    <div className="divide-y">
      {inactive.map((item) => (
        <div key={item.id} className="flex items-center justify-between px-4 py-3">
          <span className="text-sm line-through text-muted-foreground">Name</span>
          ...
        </div>
      ))}
    </div>
  </div>
</div>
```

Opacity-Werte: `opacity-60` (inaktiv/deaktiviert), `opacity-70` (zurückgezogen)

### Tabellen-Container

```tsx
<div className="overflow-hidden rounded-lg border bg-card">
  <table className="w-full text-sm">
    <thead>
      <tr className="border-b bg-muted/40">
        <th className="px-2 py-2 text-left font-medium text-muted-foreground sm:px-4">...</th>
      </tr>
    </thead>
    <tbody className="divide-y">
      <tr className="transition-colors hover:bg-muted/20">
        <td className="px-2 py-3 sm:px-4">...</td>
      </tr>
    </tbody>
  </table>
</div>
```

**Pflicht: `bg-card` auf dem äusseren Container** — ohne `bg-card` erscheinen Listen/Tabellen im Dark Mode tiefschwarz und sind vom Seitenhintergrund nicht unterscheidbar.

---

## Aktiv/Inaktiv-Trennung

**Immer** zwei Sektionen wenn ein Status existiert — nie nur einen Badge in der gleichen Liste:

| Sektion             | Klassen                                | Textdarstellung                      |
| ------------------- | -------------------------------------- | ------------------------------------ |
| Aktiv               | `rounded-lg border bg-card`            | normal                               |
| Inaktiv/Deaktiviert | `rounded-lg border bg-card opacity-60` | `line-through text-muted-foreground` |
| Zurückgezogen       | `rounded-lg border bg-card opacity-70` | `line-through text-muted-foreground` |

**Referenz:** `src/app/(app)/participants/page.tsx` (Teilnehmer), `src/app/(app)/admin/users/page.tsx` (Nutzer)

---

## Spielplan: Void-Matches (Rückzug)

Wenn eine Paarung mindestens einen zurückgezogenen Teilnehmer hat (`isVoid`):

- Zeile: `opacity-50`, kein `hover:bg-muted/20`
- **Beide** Namen: `line-through text-muted-foreground`
- Kein Ergebnis anzeigen (auch wenn es in der DB steht)
- Keine Gewinner-Hervorhebung (`bg-emerald-500/10` nur bei `!isVoid`)

```tsx
const isVoid = m.homeParticipant.withdrawn || m.awayParticipant?.withdrawn === true

// Zelle:
className={`px-2 py-3 sm:px-4 ${homeOutcome === "WIN" && !isVoid ? "bg-emerald-500/10" : ""}`}

// ParticipantResult mit isVoid-Prop:
<ParticipantResult participant={m.homeParticipant} result={homeResult} isVoid={isVoid} />
```

**Referenz:** `src/components/app/matchups/ScheduleView.tsx`

---

## Farbpalette (Bedeutungsträger)

| Farbe       | Token / Klasse                               | Bedeutung                   |
| ----------- | -------------------------------------------- | --------------------------- |
| Grün        | `bg-emerald-500/10`, `text-emerald-400`      | Sieg, abgeschlossen         |
| Gelb        | `ring-yellow-400`, `bg-yellow-400/15`        | Platz 1                     |
| Grau/Silber | `ring-slate-400`, `bg-slate-400/15`          | Platz 2                     |
| Orange      | `ring-orange-500`, `bg-orange-500/15`        | Platz 3                     |
| Amber       | `text-amber-400`                             | Unentschieden               |
| Destructive | `text-destructive/70 hover:text-destructive` | Löschen, gefährliche Aktion |
| Muted       | `bg-muted/40` (thead), `bg-muted/20` (hover) | Neutrale Hintergründe       |

---

## Touch-Target-Mindestgrösse

Icon-Buttons in Listen: **mindestens `h-10 w-10`** (40 × 40 px).
`h-8 w-8` nur in dichten Desktop-Tabellen, nie in mobilrelevanten Listen.

---

## Seitenbreite und Layout

Alle Verwaltungsseiten: `mx-auto max-w-3xl space-y-6 px-4 py-8`

Page-Header-Pattern:

```tsx
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
  <div>
    <h1 className="text-2xl font-semibold">Seitentitel</h1>
    <p className="mt-1 text-sm text-muted-foreground">Beschreibung</p>
  </div>
  <Button asChild size="sm" className="self-start">
    <Link href="/...">
      <Plus className="mr-1 h-4 w-4" />
      Neu
    </Link>
  </Button>
</div>
```

---

## Aus Lernlog übernommen

<!-- Zuletzt konsolidiert: 2026-06-23 -->

### Layout & Grid

- **CSS-Grid + `max-w-*` nicht kombinieren bei single-item-Grids**: `sm:grid-cols-2` und `max-w-*` nie gleichzeitig auf demselben Container. Item bekommt nur halbe max-width. Bei single-item: `max-w-* mx-auto` ohne Grid.
- **shadcn Card Padding auf Mobile überschreiben**: `CardHeader`/`CardContent` haben `px-6` als Default — für Mobile explizit `px-4 sm:px-6` setzen.
- **Responsive Button (Icon + Label)**: `px-1.5 sm:px-2` + `<Icon className="h-3 w-3 sm:mr-1" />` + `<span className="hidden sm:inline">Label</span>` für Buttons die auf Mobile Icon-only zeigen.
- **Tabellenspalten auf Mobile ausblenden**: `hidden sm:table-cell` statt horizontales Scrollen. Padding: `px-2 sm:px-4` für enge Viewports.

### Interaktion

- **Kein `prompt()`/`confirm()`/`alert()` in async-Callbacks**: Wird auf iOS Safari geblockt. Immer shadcn `Dialog` (Formulare) oder `AlertDialog` (Bestätigung) verwenden.
- **SVG-Icon als einziger Zelleninhalt**: In `<span className="inline-flex items-center justify-center">` wrappen für zuverlässige Zentrierung in `<td>`.
- **Spacing-Verhältnis für gestapelte Karten**: `cardHeight × 0.5 = gap` als Faustregel. Bei 80px Kartenhöhe mindestens 40–48px Gap für optisches Gleichgewicht.
- **Adaptive AlertDialogs mit mehreren Varianten**: Mehrere `AlertDialogContent`-Blöcke in einem `AlertDialog` funktionieren korrekt, wenn ihre Bedingungen sich gegenseitig ausschliessen (z.B. `!hasData`, `hasData && !isAdmin`, `hasData && isAdmin`). Kein separater Dialog-State pro Variante nötig — Bedingung direkt auf den Content-Block anwenden.

### PDF-Rendering (react-pdf)

- **`wrap={false}` für Zeilen**: `<View wrap={false}>` erzwingt Seitenumbruch statt Element zu splitten — verhindert dass Name auf einer Seite, Ergebnis auf der nächsten landet.
- **PDF: eigene Spacing-Konstanten**: A4-Querformat (769pt × 546pt) hat deutlich tightere Constraints als Bildschirm. PDF-Module mit separaten kompakten Konstanten versehen — nie Web-Konstanten teilen.
- **react-pdf Union-Types: kein Narrowing per `"in"`-Guard**: react-pdf `<Text>` benötigt konkrete Typ-Constraints zur Compile-Zeit. Statt `if ("disc" in W)` direkt auf die spezifische Konstante zugreifen (`W_MIXED.disc` statt `W.disc`).
- **react-pdf: keine durchgehenden Spaltenlinien via Flex-Stretch**: `borderRightWidth` auf `<Text>` oder Stretch-Separator-Views liefern in react-pdf keine durchgehenden vertikalen Linien. Stattdessen explizite `height` auf den `<View>`-Zellen setzen, die den Border tragen.

### Forms & State

- **React 19 Forms: Inputs immer controlled mit `useActionState`**: `<form action={fn}>` setzt uncontrolled Inputs (`defaultValue`) nach jedem Submit zurück — auch bei Validation Errors verlieren User ihre Eingaben. Bei Forms mit `useActionState` Inputs IMMER controlled führen (`value` + `onChange` + lokaler State via `useState`), nie `defaultValue`. Initialwerte beim Mount aus Props in den State kopieren.

### Tabellen & Ranking

- **Ranking-Kriterien als sichtbare Spalten, Spaltenreihenfolge = Bewertungsreihenfolge**: Sortierkriterien einer Tabelle so wählen, dass jedes als eigene Spalte sichtbar ist; die Spaltenreihenfolge muss der Bewertungsreihenfolge entsprechen. Ein nicht abbildbares Kriterium (z.B. direkter Vergleich/Head-to-Head) macht die Platzierung für den Leser unüberprüfbar → weglassen oder ans Ende. Sichtbar-begründetes "komisch" schlägt unsichtbar-begründetes.
  - **Update 2026-06-24:** Ein relationales Kriterium (Head-to-Head) KANN doch sichtbar gemacht werden, wenn es fachlich gefordert ist (Sportleiter-Wunsch): ans Ende stellen UND in der letzten Spalte das konkrete Ergebnis zeigen — im 2er-Gleichstand Match + Gegner, im N-Gleichstand die Direktbilanz, bei Nicht-Entscheidbarkeit ein „offen"/„ausgeglichen"-Hinweis. Siehe Best-of-Tabelle (`directComparison` + `formatDirectComparison`). Dem Weglassen vorzuziehen, sobald das Kriterium verpflichtend ist — die Annotation hält die Platzierung nachvollziehbar.
