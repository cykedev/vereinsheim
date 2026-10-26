# Spiegel: Admin übersichtlich, Listen wie Disziplinen

## Context

Der User (26. Oktober 2026): „ich finde den admin bereich unübersichtlich. ich muss für konten, v.A. mobil, immer
kompliziert navigieren. disziplinen und listen werden komisch unterschiedlich behandelt, sie sollten ähnlich
annavigierbar und bedienbar sein und nicht in anderen punkten ‚versteckt‘ sein.“

Ist-Zustand (Spiegel, `apps/spiegel/src/app/(app)/admin/*`):

- **Weg zu einem Konto am Telefon:** Profil → ganz nach unten scrollen (Sportpass, Aufträge, Dieses Gerät) → Chip
  „Admin“ zwischen Papierkorb, Passwort und Abmelden → Übersicht → Reiter „Konten“ → Konto. Die Seite eines Kontos
  (`/admin/users/[id]`) und „Neues Konto“ haben **keine Reiter** und keine eigene Breite (`PAGE_SINGLE` fehlt); zurück
  geht es nur mit dem Browser oder wieder über Profil.
- **Ringwerk und Treffsicher** zeigen am Telefon oben in Profil „Weitere Bereiche“ (`lg:hidden`); Spiegel hat Admin
  als letzten Chip unten.
- **Disziplinen** sind ein eigener Reiter: Liste in Abschnitten (Neu, je Familie, Ohne Familie, Ignoriert), jede Zeile
  ein Link auf das Blatt der Disziplin (`/admin/disciplines/[id]`, mit Reitern), dort Einstellen, Dialog mit den Folgen,
  zurück zur Liste.
- **Listen** (die `Rangliste` aus Meyton, `Ranking`) stehen als letzter Abschnitt unter „Anlage und Brücke“
  (`/admin/site`), nach Anlage, Brücken und „Brücke verbinden“. Jede Zeile hat einen Umschalter (Nicht festgelegt,
  Training, Wettkampf), der sofort fragt. Kein Reiter, keine eigene Seite.
- Die Köpfe der Admin-Seiten sind verschieden gebaut (Konten: Reiter außerhalb des Kopfs, Knopf daneben; Konto ohne
  Reiter).

## Approach

- **A1 Ein Satz Bereiche.** `ADMIN_SECTIONS` in `src/lib/admin/sections.ts`: Übersicht `/admin`, Konten
  `/admin/users`, Disziplinen `/admin/disciplines`, **Listen `/admin/lists`** (neu), Anlage und Brücke `/admin/site`.
  Reiter und Profil lesen beide daraus.
- **A2 Reiter auf jeder Admin-Seite**, auch auf Konto, Neues Konto, Disziplin und Liste. Auf einer Unterseite ist
  der Reiter ihres Bereichs markiert (`aria-current="true"`) und führt zurück zur Liste; auf der Seite des Bereichs
  selbst `aria-current="page"`. Die Reiter brechen wie bisher um (fünf passen am Telefon nicht in eine Zeile;
  seitlich scrollen hieße, „Anlage und Brücke“ zu verstecken, vgl. `Segmented` `wrap`).
- **A3 Ein Kopf für die Bereiche.** `AdminHeader` (Reiter, Titel mit optionalem „?“, Satz darunter, optionale Aktion
  rechts) auf Übersicht, Konten, Disziplinen, Listen, Anlage und Brücke. Unterseiten: Reiter oben, darunter ihr eigener
  Kopf, alles in `PAGE_SINGLE`.
- **A4 Profil am Telefon:** Ganz oben, unter dem Namen, ein Abschnitt „Admin“ (nur für Admins, `lg:hidden` wie
  „Weitere Bereiche“ in Ringwerk und Treffsicher) mit den fünf Bereichen als Chips. Konten sind damit zwei Tipps
  entfernt (Profil → Konten). Der Chip „Admin“ unten entfällt; ab 1024 px steht Admin in der Seitenleiste.
- **A5 Listen wie Disziplinen:**
  - `/admin/lists`: Kopf „Listen ?“ mit dem Satz von bisher, darunter Abschnitte **Nicht festgelegt**, **Wettkampf**,
    **Training** (leere fallen weg). Jede Zeile ist ein Link aufs Blatt: Name, „23 Scheiben · zuletzt im Oktober 2026“.
    Leer: „Die Listen erscheinen hier, sobald die ersten Scheiben da sind.“
  - `/admin/lists/[id]` (Blatt einer Liste): Reiter, Name als Titel, darunter „23 Scheiben · zuletzt im Oktober 2026“;
    eine Karte „Art der Liste ?“ mit dem Satz, was die Art bewirkt, dem Umschalter (Nicht festgelegt, Training,
    Wettkampf) und dem Knopf „Übernehmen“ (aus, solange nichts geändert ist). Übernehmen fragt mit `rankingKind`
    (Wortlaut unverändert) und führt danach zurück zur Liste, wie das Blatt einer Disziplin.
  - Zahlen nur über die ganze Anlage und die letzte Scheibe nur als Monat, wie bei Disziplinen ([[spiegel-privacy]]).
    Keine Aufschlüsselung nach Disziplin oder Konto.
  - „Anlage und Brücke“ verliert den Abschnitt Listen; `siteOverview` liest keine Listen mehr.
- **A6 Nicht in diesem Plan:** Admin-Unterbereiche in der Seitenleiste am Desktop (die Reiter reichen dort), ein
  Zähler „wartet auf dich“ an Profil, eine Aufgabe in der Übersicht für nicht festgelegte Listen (keine Entscheidung,
  die ein Mensch treffen muss: ohne Art gilt Training), Ringwerk und Treffsicher.
- Kein Schema, keine Migration, keine neue Action (`setRankingKind` bleibt). Keine neue Brücke nötig.

## Files

- neu `apps/spiegel/src/lib/admin/sections.ts`, `sections.test.ts`
- `apps/spiegel/src/components/admin/AdminTabs.tsx` (aus `ADMIN_SECTIONS`, `detail`), neu `AdminTabs.test.tsx`
- neu `apps/spiegel/src/components/admin/AdminHeader.tsx`
- neu `apps/spiegel/src/lib/admin/rankings.ts` (`RankingRow`, `rankingOverview`, `rankingDetail`), `rankings.test.ts`
- `apps/spiegel/src/lib/admin/site.ts` (ohne `rankings`, `RankingRow` zieht um)
- neu `apps/spiegel/src/components/admin/RankingList.tsx`, `RankingForm.tsx`, `RankingList.test.tsx`
- `apps/spiegel/src/components/admin/SiteForms.tsx` (ohne `RankingItem`, `RANKING_OPTIONS`), `SiteForms.test.tsx`
- neu `apps/spiegel/src/app/(app)/admin/lists/page.tsx`, `lists/[id]/page.tsx`
- `apps/spiegel/src/app/(app)/admin/{page,users/page,disciplines/page,site/page}.tsx` (Kopf),
  `users/[id]/page.tsx`, `users/new/page.tsx`, `disciplines/[id]/page.tsx` (Reiter, Breite)
- `apps/spiegel/src/components/profile/ProfileScreen.tsx`, neu `ProfileScreen.test.tsx`
- Doku: `vault/spiegel/spiegel-navigation.md` (Tabelle „Bereiche und Adressen“, App-Rahmen, Art der Scheibe),
  `apps/spiegel/CLAUDE.md` (Aufbau, Art der Scheibe, Admin → Anlage und Brücke)

## Required Docs

- `vault/conventions.md` §2 (Kanon), §3 (Raster `PAGE_SINGLE`), §5 (Navigation), §10 (Kein Knopf ohne Folge)
- `vault/spiegel/spiegel-navigation.md` („Bereiche und Adressen“, „App-Rahmen“, „Art der Scheibe“)
- `vault/spiegel/spiegel-privacy.md` (nur Zahlen der Anlage im Admin)
- `apps/spiegel/CLAUDE.md` (Admin-Daten prüfen selbst, Tests gegen die Dev-Datenbank)

## Tasks

1. **Bereiche und Reiter.** `sections.ts`:
   ```ts
   export type AdminSection = "overview" | "users" | "disciplines" | "lists" | "site"
   export const ADMIN_SECTIONS: readonly { key: AdminSection; href: string; label: string }[] = [
     { key: "overview", href: "/admin", label: "Übersicht" },
     { key: "users", href: "/admin/users", label: "Konten" },
     { key: "disciplines", href: "/admin/disciplines", label: "Disziplinen" },
     { key: "lists", href: "/admin/lists", label: "Listen" },
     { key: "site", href: "/admin/site", label: "Anlage und Brücke" },
   ]
   ```
   `AdminTabs({ current, detail })` mappt darüber; `aria-current` = `detail ? "true" : "page"` am Reiter von
   `current`; Klassen `aria-[current=page]:` und `aria-[current=true]:` gleich (gefüllt). Test `sections.test.ts`:
   Schlüssel eindeutig, jede `href` ist ein Admin-Pfad (`isAdminPath`), jede liegt als Seite unter
   `src/app/(app)/admin` (`existsSync`). Test `AdminTabs.test.tsx`: fünf Links in dieser Reihenfolge; Bereichsseite
   `aria-current="page"`, Unterseite `aria-current="true"` am selben Link, sonst keiner.
2. **Kopf.** `AdminHeader({ current, title, help, action, children })`: `AdminTabs`, dann eine Zeile
   `flex flex-wrap items-end justify-between gap-3` mit `h1` (Klassen wie bisher, `help` als `<AdminHelp id>` daneben)
   und Satz (`children`, `text-foreground-2`) links, `action` rechts. Übersicht, Konten, Disziplinen, Anlage und Brücke
   darauf umstellen (Texte unverändert; Konten: „Neues Konto“ als `action`).
3. **Unterseiten.** `users/[id]`, `users/new`: `<section className={cn("grid gap-4", PAGE_SINGLE)}>` mit
   `<AdminTabs current="users" detail />` vor dem `h1`. `disciplines/[id]`: `detail` ergänzen.
4. **Listen lesen.** `rankings.ts` nach dem Muster von `disciplines.ts`: `rows(siteId, timeZone, id?)` mit
   `db.ranking.findMany({ where: { siteId }, orderBy: { name: "asc" }, select: { id, name, kind } })` und
   `db.card.groupBy({ by: ["rankingId"], where: { rankingId: { in: ids }, deletedAt: null }, _count: true,
   _max: { startedAt: true } })`; `RankingRow = { id, name, kind, cards, lastCardMonth }`. `rankingOverview(timeZone)`
   (erste Anlage, ohne Anlage `[]`), `rankingDetail(id, timeZone)` (null, wenn die Liste nicht zur ersten Anlage
   gehört). Beide rufen zuerst `requireAdmin`. `site.ts`: `rankings` aus `SiteOverview` und der Abfrage entfernen.
   Test `rankings.test.ts` (wie `disciplines.test.ts`, `requireAdmin` gemockt und gezählt): zwei Listen der ersten
   Anlage, Scheiben über den Helfer `card` mit `rankingId`, eine davon gelöscht; erwartet Zahl ohne die gelöschte,
   Monat der letzten, Art; `rankingDetail` einer Liste einer anderen Anlage ist null; `requireAdmin` je Aufruf.
5. **Listen zeigen.** `RankingList({ rows })`: Abschnitte in der Reihenfolge Nicht festgelegt (`kind === null`),
   Wettkampf, Training, je `<section>` mit `h2` wie `DisciplineList`, Zeilen als `Link` auf `/admin/lists/<id>` mit
   `data-ranking`. `RankingForm({ row })`: Kopf (Name, „n Scheiben · zuletzt im …“), Karte mit `h2` „Art der Liste“ +
   `<AdminHelp id="ranking" />`, Satz „Hier legst du fest, ob die Scheiben dieser Liste als Wettkampf oder Training
   zählen. Ohne Festlegung zählen sie so, wie Meyton sie vermerkt. Meist ist das Training.“, `Segmented`
   (`RANKING_OPTIONS` zieht aus `SiteForms.tsx` hierher, `label` „Art der Liste“), Knopf „Übernehmen“
   (`disabled` ohne Änderung oder während gespeichert wird), `DecisionDialog` mit `rankingKind`, nach Erfolg
   `router.push("/admin/lists")`, Fehler als `role="alert"`. `RankingItem` und `RANKING_OPTIONS` aus `SiteForms.tsx`
   entfernen. Test `RankingList.test.tsx`: Reihenfolge der Abschnitte, leere fallen weg, Links auf `/admin/lists/<id>`,
   kein Umschalter in der Liste; Blatt: drei Möglichkeiten, „Übernehmen“ aus ohne Änderung, Zahl der Scheiben; Text der
   Seite `lists/page.tsx` ohne „Rangliste“ (aus `SiteForms.test.tsx` hierher), dort den Fall `RankingItem` und den
   Seitentext-Fall entfernen.
6. **Seiten der Listen.** `lists/page.tsx` (`AdminHeader current="lists" title="Listen" help="ranking"`, Satz „In
   Meyton gehört jede Scheibe zu einer Liste. Leg hier fest, welche Listen als Wettkampf zählen. Alle anderen zählen so,
   wie Meyton sie vermerkt. Meist ist das Training.“, dann `RankingList` oder der Leertext). `lists/[id]/page.tsx` wie
   `disciplines/[id]/page.tsx` (`/^\d{1,9}$/`, sonst `notFound`). `site/page.tsx`: Abschnitt Listen und den Kommentar
   dazu entfernen.
7. **Profil.** In `ProfileScreen` unter dem Kopf, nur für Admins:
   `<nav aria-label="Admin" data-admin-sections className="grid gap-3 lg:hidden">` mit `h2` „Admin“ und je Bereich ein
   `Link` (Klassen der Chips wie „Papierkorb“). Den `RouteLink` „Admin“ unten entfernen; den Kommentar der Komponente
   anpassen. Test `ProfileScreen.test.tsx` (`next/navigation`, `next-auth/react` gemockt): Admin sieht die fünf `href`
   in Reihenfolge, Schütze keinen Abschnitt „Admin“.
8. **Doku.** `spiegel-navigation.md`: Zeile Admin „in Profil oben (Abschnitt „Admin“ mit allen Bereichen), nur für
   Admins“, `/admin/…` mit `lists`; unter „App-Rahmen“ den Satz zu Admin ergänzen (Reiter auf jeder Admin-Seite);
   „Art der Scheibe“: „Admin → Listen“. `apps/spiegel/CLAUDE.md`: Admin-Pfade (`/admin/lists{/[id]}`), „Art der
   Scheibe“ (`setRankingKind`, „Listen“), Abschnitt „Admin → Anlage und Brücke“ ohne Listen.
9. **Gate.** `pnpm check` grün.

## Test Steps

- `pnpm --filter spiegel test -- sections AdminTabs RankingList ProfileScreen rankings SiteForms`
- `pnpm check` (lint, format, test, tsc, next build über alle Apps)

## Verification

Im Browser (Dev-Server dieses Checkouts, mit dem Konto des Users, der sich selbst anmeldet), Telefon 375 × 812 und
Desktop:

- Profil zeigt oben „Admin“ mit fünf Chips; „Konten“ führt direkt zur Liste der Konten.
- Konto öffnen: Reiter oben, „Konten“ markiert, ein Tipp zurück zur Liste; ebenso Neues Konto, Disziplin, Liste.
- Reiter brechen am Telefon um, nichts ist abgeschnitten, kein seitliches Scrollen der Seite.
- Listen: Abschnitte, Blatt öffnen, Art ändern → Dialog mit den Folgen → zurück, die Liste steht im neuen Abschnitt;
  Art zurückstellen.
- „Anlage und Brücke“ ohne Listen.
- Desktop: Profil ohne Abschnitt „Admin“, Seitenleiste „Admin“ unverändert.
