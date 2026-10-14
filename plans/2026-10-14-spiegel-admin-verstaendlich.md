# Spiegel: Admin verständlich, kein Knopf ohne Folge (P2c)

## Kontext

Rückmeldung des Users (14. Oktober 2026) nach P1 und P2: „als admin ist mir nicht ganz klar, was sind zustimmungen zu
accounts, scheiben, anlagen usw. das ist einfach nicht gut zu erkennen, auch nicht was die auswirkungen sind“ und „ich
muss immer verstehen was ich bestätige, ablehne usw und was das für folgen hat“. Die Skizze (Übersicht als Kette
Anlage → Brücke → Zustimmungen → Konten, Dialog mit Prüfen, Folgen, Rückgängig) hat er freigegeben: „Richtung passt“.
P2c kommt vor P2b (Löschen mit Papierkorb), damit dessen Dialoge gleich nach dieser Regel entstehen.

Heute: `/admin` leitet auf Konten um. „Anlage und Brücken“ zeigt Anlage, Brücken, Ranglisten und „Epochen“ ohne
Zusammenhang. Zustimmungen stehen am einzelnen Konto. Bestätigen einer Zustimmung, das Umstellen einer Rangliste und das
Speichern eines Kontos mit neuer Rolle, neuem Status oder Passwort laufen ohne jede Rückfrage; die übrigen Dialoge haben
einen Satz ohne Folgen.

Keine Schemaänderung, keine geschützten Pfade: autonom möglich (ADR-023).

## Regel (wird Konvention, T8)

**Kein Knopf ohne Folge.** Jede Aktion, die bestätigt, ablehnt, entfernt, widerruft, umstellt oder ein Konto ändert,
fragt in einem Dialog, der drei Dinge in Alltagsworten sagt:

1. **Worum es geht:** wer, welche Nummer, welches Gerät, wie viele Scheiben.
2. **Vorher prüfen** (wenn es etwas zu prüfen gibt).
3. **Was dann passiert**, als kurze Liste, ausdrücklich auch, was **nicht** passiert, und **wie es rückgängig geht**.

Fachbegriffe stehen nicht in der Oberfläche: aus „Epoche“ wird „Neustart der Anlage“.

## Entscheidungen

- **D1 Folgen als Daten** (`src/lib/admin/consequences.ts`, rein): je Aktion eine Funktion, die einen `Decision`
  liefert: `{ title, about, check?, happens: string[], notHappening: string[], undo, confirmLabel, destructive }`. Eine
  Quelle für Dialog und Tests; die Komponenten erfinden keine Texte.
- **D2 Ein Dialog** (`src/components/shell/DecisionDialog.tsx`, Design 2, auf `@vereinsheim/ui/alert-dialog`): Titel,
  „Worum es geht“, Kasten „Vorher prüfen“, „Was dann passiert“ (Liste), „Was nicht passiert“ (Liste), „Rückgängig“,
  Abbrechen und die Aktion. Er ersetzt `ConfirmDialog` überall im Admin und in den Dialogen des Schützen (Widerrufen,
  Entfernen einer Ablehnung, Nicht meine), damit Schütze und Admin dieselbe Form sehen.
- **D3 Übersicht** (`/admin`, erste Seite, Reiter „Übersicht · Konten · Anlage und Brücke“):
  - oben **„Wartet auf dich (n)“**: offene Zustimmungen (je eine Zeile mit „Prüfen“, Link aufs Konto), ein
    unbestätigter Neustart der Anlage, eine Brücke mit „Ablage geleert? Bitte prüfen“ oder Fehler, keine Anlage, keine
    Brücke. Ohne Aufgaben der Satz „Nichts wartet auf dich.“;
  - darunter **der Weg einer Scheibe** in vier Stationen, je mit einem Satz, was sie tut, ihrem Stand und einem „?“:
    1. *Meyton-Anlage*: „Dort liegen alle Scheiben. Spiegel liest nur und ändert nie etwas.“ Stand: Name, eingerichtet
       oder „noch nicht eingerichtet“.
    2. *Brücke im Schützenhaus*: „Schickt nur Scheiben von Schützen mit Zustimmung. Verdeckte Wertung nie.“ Stand:
       zuletzt online, Status in Worten, zurückgehaltene Scheiben; „aus“ ist normal.
    3. *Zustimmungen*: „Ein Schütze sagt: Scheiben mit meiner SportpassID gehören mir. Du prüfst die Nummer einmal.“
       Stand: aktiv, wartet auf dich, zurück, abgelehnt.
    4. *Konten*: „Wer Spiegel nutzt. Jeder sieht nur seine eigenen Scheiben, auch du als Admin.“ Stand: Zahl, davon mit
       aktivem Sportpass, deaktiviert.
  - Daten über `adminOverview(timeZone)` (`src/lib/admin/overview.ts`, `requireAdmin`), nur Zahlen und Namen von
    Konten und Brücken, keine Schüsse.
- **D4 Erklärungen „?“** (`src/lib/admin/help.ts`, `AdminHelp`): je Station und je Begriff (Zustimmung, Brücke,
  Kopplungscode, Rangliste, Neustart der Anlage, Zeitzone der Anlage, Rolle, deaktiviert) ein Blatt (`Sheet` aus
  `@vereinsheim/ui/design2`) mit zwei bis vier Sätzen. Texte unten im Katalog.
- **D5 Konten:** je Zeile der Stand des Sportpasses („Sportpass aktiv“, „wartet auf dich“, „zurück beim Admin“,
  „abgelehnt“, „kein Sportpass“) neben Rolle und „deaktiviert“; die offenen Zustimmungen ziehen auf die Übersicht um
  (in „Konten“ bleibt nur ein Link „1 Zustimmung wartet ›“).
- **D6 Konto speichern:** Ändert das Formular Rolle, Status oder Passwort, fragt `DecisionDialog` mit genau diesen
  Änderungen (eine Folge je Änderung); Name und E-Mail allein speichern ohne Rückfrage. Neues Konto: ohne Rückfrage, aber
  der Satz unter dem Knopf sagt, was passiert („Das Konto kann sich mit dem vorläufigen Passwort anmelden und muss es
  zuerst ändern.“).
- **D7 Ranglisten:** Die Art wird nicht mehr beim Antippen gespeichert, sondern nach `DecisionDialog` (wie viele
  Scheiben betroffen sind, was sich an ihnen ändert). „Offen“ heißt in der Oberfläche „nicht zugeordnet (Training)“.
- **D8 Anlage:** Zeitzone ändern fragt nach (sie wirkt nur auf neu eingelesene Stände, siehe Katalog).
- **D9 Nicht in diesem Plan:** die Tabelle der Anmeldesperren (`@vereinsheim/ui/admin`, geteilt mit Ringwerk und
  Treffsicher; ihr „Entsperren“ ist harmlos und bleibt). Mehrere Anlagen (ADR-029: eine je Installation).

## Katalog der Dialoge (Wortlaut zur Freigabe)

Platzhalter in spitzen Klammern; „Schütze“ ist der Name des Kontos, sonst die E-Mail.

**Zustimmung bestätigen** — Titel „Zustimmung von <Schütze> bestätigen?“
- Worum: „<Schütze> möchte, dass Scheiben mit der SportpassID <Nummer> automatisch in sein Konto kommen.“
- Prüfen: „Gehört <Nummer> in der Meyton-Schützenverwaltung zu <Schütze>? Wenn nicht: ablehnen.“
- Passiert: „Ab dem nächsten Trainingsabend schickt die Brücke jede Scheibe mit dieser Nummer.“ · „Die erste zeigt
  Spiegel <Schütze> zur Kontrolle; erst danach sieht er sie in seinen Scheiben.“
- Nicht: „Du siehst seine Schüsse nicht.“ · „Scheiben von früheren Abenden kommen nicht von selbst; höchstens die
  des letzten Abends, wenn die Brücke beim nächsten Start nachholt.“
- Rückgängig: „Jederzeit über „Entfernen“. Schon geschickte Scheiben bleiben bei <Schütze>.“
- Knopf: „Bestätigen“

**Zustimmung ablehnen** — „Zustimmung von <Schütze> ablehnen?“
- Worum: „<Schütze> hat für die SportpassID <Nummer> zugestimmt.“
- Passiert: „Die Brücke schickt nichts unter dieser Nummer.“ · „<Schütze> sieht im Profil „abgelehnt“ und kann die
  Ablehnung entfernen und neu zustimmen.“
- Nicht: „Gelöscht wird nichts.“ (bei aktiver Zustimmung zusätzlich: „Schon geschickte Scheiben bleiben bei
  <Schütze>.“)
- Rückgängig: „Stimmt <Schütze> neu zu, kannst du bestätigen.“
- Knopf: „Ablehnen“ (rot)

**Zustimmung entfernen** — „Zustimmung von <Schütze> entfernen?“
- Worum: „Die SportpassID <Nummer> wird von <Schütze>s Konto gelöst.“
- Passiert: „Ab dem nächsten Trainingsabend schickt die Brücke nichts mehr unter dieser Nummer.“ · „Die Nummer ist
  wieder frei; jedes Konto kann für sie zustimmen.“
- Nicht: „Schon geschickte Scheiben bleiben bei <Schütze>; löschen kann nur er selbst.“
- Rückgängig: „<Schütze> stimmt im Profil neu zu, du bestätigst.“
- Knopf: „Entfernen“ (rot)

**Brücke widerrufen** — „Brücke „<Gerät>“ widerrufen?“
- Worum: „Das Gerät „<Gerät>“ darf Scheiben an Spiegel schicken.“
- Passiert: „Ab sofort nimmt Spiegel von diesem Gerät nichts mehr an; es meldet sich ab.“
- Nicht: „Keine Scheibe wird gelöscht.“ · „Andere Brücken laufen weiter.“
- Rückgängig: „Nicht möglich. Um das Gerät wieder zu nutzen, es mit einem neuen Code koppeln.“
- Knopf: „Widerrufen“ (rot)

**Kopplungscode erzeugen** (kein Dialog, Satz am Knopf): „Der Code gilt 15 Minuten und nur einmal. Wer ihn eingibt, darf
Scheiben schicken; behandle ihn wie ein Passwort.“

**Neustart der Anlage bestätigen** (bisher „Epoche bestätigen“) — „Neustart der Anlage bestätigen?“
- Worum: „Die Brücke meldet eine Ablage, die neu aussieht: geleert oder der Meyton-Server neu aufgesetzt. Bis du
  bestätigst, nimmt Spiegel aus ihr nichts an.“
- Prüfen: „Wurde die Ablage am Meyton-Server wirklich geleert oder neu aufgesetzt? Wenn nicht: nicht bestätigen und die
  Brücke prüfen.“
- Passiert: „Spiegel nimmt wieder Scheiben an. Die ScheibenIDs beginnen neu, Spiegel hält sie von den alten getrennt.“
- Nicht: „Alte Scheiben bleiben unverändert.“
- Rückgängig: „Nicht möglich.“
- Knopf: „Bestätigen“

**Rangliste zuordnen** — „„<Rangliste>“ als Wettkampf zählen?“ (bzw. „als Training“, „nicht zuordnen“)
- Worum: „Meyton nennt <n> Scheiben mit der Rangliste „<Rangliste>“.“
- Passiert: „Diese Scheiben zählen als Wettkampf (bzw. Training): in Liste, Fortschritt und bei der Wertung, die
  Spiegel vorschlägt (Wettkampf in der amtlichen).“ · „Neue Scheiben dieser Rangliste ebenso.“
- Nicht: „Hat ein Schütze eine Scheibe selbst umgestellt, bleibt seine Wahl.“ · „Eine Scheibe nur aus Probe bleibt
  Training.“ · „Schüsse und Ergebnisse ändern sich nicht.“
- Rückgängig: „Jederzeit hier umstellen.“
- Knopf: „Als Wettkampf zählen“ (bzw. „Als Training zählen“, „Nicht zuordnen“)

**Zeitzone der Anlage ändern** — „Zeitzone auf <Zone> ändern?“
- Worum: „Meyton speichert Uhrzeiten ohne Zeitzone. Spiegel rechnet sie mit dieser Zone um.“
- Passiert: „Neu eingelesene Scheiben bekommen ihre Uhrzeit in <Zone>.“
- Nicht: „Schon eingelesene Scheiben behalten ihre Uhrzeit.“
- Rückgängig: „Zurückstellen; Scheiben, die dazwischen kamen, behalten die Uhrzeit aus <Zone>.“
- Knopf: „Ändern“

**Konto ändern** (nur bei Rolle, Status oder Passwort) — „Konto von <Schütze> ändern?“, je Änderung eine Folge:
- Admin wird: „<Schütze> verwaltet Konten, Zustimmungen und die Brücke. Seine eigenen Scheiben sieht er weiter, fremde
  Schüsse nie.“
- Schütze wird: „<Schütze> verliert den Zugang zum Admin.“
- Deaktivieren: „<Schütze> kann sich nicht mehr anmelden und wird abgemeldet.“ · „Die Brücke schickt nichts mehr unter
  seinen SportpassIDs.“ Nicht: „Seine Scheiben und Zustimmungen bleiben, gelöscht wird nichts.“ Rückgängig: „wieder
  aktivieren“.
- Aktivieren: „<Schütze> kann sich wieder anmelden; aktive Zustimmungen gelten wieder.“
- Neues Passwort: „<Schütze> wird abgemeldet und muss das neue Passwort bei der nächsten Anmeldung ersetzen. Bis dahin
  sieht er keine Daten.“ Prüfen: „Gib ihm das Passwort persönlich, nicht per Mail.“
- Bei jeder Änderung von Rolle oder Status: „<Schütze> wird abgemeldet.“
- Knopf: „Ändern“

**Schütze: Zustimmung widerrufen** — „Zustimmung für <Nummer> widerrufen?“
- Passiert: „Ab dem nächsten Trainingsabend kommen keine neuen Scheiben mehr.“
- Nicht: „Was schon da ist, bleibt, bis du es löschst.“
- Rückgängig: „Neu zustimmen; ein Admin bestätigt dann wieder.“

**Schütze: Ablehnung entfernen** — „Ablehnung entfernen?“
- Passiert: „Die Zeile verschwindet, du kannst die Nummer neu eintragen.“
- Nicht: „Es kommen keine Scheiben, bis ein Admin eine neue Zustimmung bestätigt.“

**Schütze: Nicht meine** — „Nicht deine Scheibe?“
- Worum: „Die Scheibe vom <Abend> (und <n> weitere) kam unter deiner SportpassID <Nummer>.“
- Passiert: „Diese Scheiben werden entfernt, mit ihren Rohdaten, und kommen nicht wieder.“ · „Deine Zustimmung geht zur
  Prüfung zurück an einen Admin; bis dahin kommen keine Scheiben unter dieser Nummer.“
- Nicht: „Deine anderen Scheiben bleiben.“
- Rückgängig: „Nicht möglich.“
- Knopf: „Nicht meine“ (rot)

## Erklärungen „?“ (Wortlaut zur Freigabe)

- **Meyton-Anlage:** „Die Schießanlage im Schützenhaus. Sie speichert jede Scheibe mit allen Schüssen in ihrer Ablage.
  Spiegel liest diese Ablage über die Brücke, ändert dort aber nie etwas.“
- **Brücke:** „Ein kleines Gerät im Schützenhaus. Es liest die Ablage und schickt Spiegel nur die Scheiben von Schützen,
  die zugestimmt haben. Scheiben mit verdeckter Wertung schickt es nie. Nach dem Training ist es aus; das ist normal.“
- **Kopplungscode:** „Verbindet eine Brücke einmalig mit Spiegel. Danach hat das Gerät einen eigenen Schlüssel; den Code
  braucht es nicht mehr.“
- **Zustimmung:** „Ein Schütze trägt im Profil seine SportpassID ein und stimmt zu, dass seine Scheiben automatisch
  kommen. Du bestätigst einmal, dass die Nummer zu ihm gehört. Seine erste Scheibe prüft er dann selbst.“
- **Rangliste:** „Meyton ordnet jede Scheibe einer Rangliste des Vereins zu, etwa „Training-LP“ oder „RWK_…“. Hier legst
  du fest, welche als Wettkampf zählen.“
- **Neustart der Anlage:** „Wird die Ablage am Meyton-Server geleert oder neu aufgesetzt, beginnen die Nummern der
  Scheiben von vorn. Spiegel hält dann an, bis du bestätigst, damit sich alte und neue Scheiben nicht vermischen.“
- **Zeitzone der Anlage:** „Meyton speichert Uhrzeiten ohne Zone. Spiegel braucht sie, um die Uhrzeit jeder Scheibe
  richtig zu zeigen; in Deutschland Europe/Berlin.“
- **Rolle:** „Ein Schütze sieht seine Scheiben. Ein Admin dazu Konten, Zustimmungen und die Brücke, aber nie fremde
  Schüsse.“
- **Deaktiviert:** „Das Konto kann sich nicht anmelden, und die Brücke schickt nichts für es. Nichts wird gelöscht.“
- **Konten:** „Wer Spiegel nutzt. Konten legt nur ein Admin an. Jeder sieht nur seine eigenen Scheiben, auch du.“

## Required Docs

- `apps/spiegel/CLAUDE.md` (Admin prüft selbst, Formulare gesteuert, Actions werfen nie, `useSavedChoice`)
- `vault/conventions.md` §2, §10; `packages/shot-ui/CLAUDE.md` (Design-2-Bausteine, `Sheet`)
- `vault/spiegel/spiegel-privacy.md` (Rollen), `spiegel-assignment.md`, `spiegel-ingest-pipeline.md` (Neustart, SF-23)

## Dateien

| Datei | Änderung |
| --- | --- |
| `src/lib/admin/consequences.ts` (neu, + Test) | D1, Katalog |
| `src/lib/admin/help.ts` (neu, + Test) | D4 |
| `src/lib/admin/overview.ts` (neu, + Test) | D3 Daten |
| `src/components/shell/DecisionDialog.tsx` (neu, + Markup-Test) | D2 |
| `src/components/admin/AdminHelp.tsx`, `AdminOverview.tsx` (neu, + Markup-Test) | D3, D4 |
| `src/app/(app)/admin/page.tsx`, `AdminTabs.tsx` | Übersicht statt Umleitung, drei Reiter |
| `src/components/admin/SportpassSection.tsx`, `OpenConsents.tsx`, `SiteForms.tsx`, `UserForm.tsx` | Dialoge D2/D6/D7/D8, Begriffe |
| `src/app/(app)/admin/users/page.tsx`, `src/lib/users/queries.ts` | D5 |
| `src/app/(app)/admin/site/page.tsx` | „Neustart der Anlage“, „?“ |
| `src/components/profile/SportpassConsents.tsx`, `src/components/open/OpenScreen.tsx` | Dialoge des Schützen |
| `vault/conventions.md` §10, `vault/spiegel/spiegel-ui-design.md`, `apps/spiegel/CLAUDE.md` | T8 |

## Aufgaben

**T1 Folgen als Daten** (`consequences.ts` + Test): je Aktion des Katalogs eine Funktion (`consentConfirm`,
`consentReject`, `consentRemove`, `bridgeRevoke`, `restartConfirm`, `rankingKind`, `siteTimeZone`, `accountChange`,
`ownConsentRevoke`, `ownRejectionRemove`, `notMine`). Tests: jeder Entscheid hat Titel, mindestens eine Folge, eine
Zeile „Rückgängig“; `accountChange` liefert nur die Folgen der geänderten Felder (Rolle allein, Status allein,
Passwort allein, alles zusammen; „wird abgemeldet“ genau einmal); Platzhalter gefüllt (kein „<“ im Text); die
Wortlaute des Katalogs wörtlich (ein Test je Aktion).

**T2 Dialog** (`DecisionDialog.tsx` + Markup-Test): Abschnitte nur, wenn sie Inhalt haben; „Was nicht passiert“ und
„Rückgängig“ immer sichtbar, wenn gesetzt; destruktiv rot; Fokus auf „Abbrechen“; `aria-describedby` auf den Inhalt.

**T3 Erklärungen** (`help.ts`, `AdminHelp.tsx`): Kreis „?“ (32 px, weicher Kreis wie `RoundToggle`), öffnet ein Blatt.
Test: jede Station und jeder Begriff aus D4 hat einen Text.

**T4 Übersicht** (`overview.ts` + Test gegen die Dev-Datenbank, `AdminOverview.tsx` + Markup-Test, Seite, Reiter):
Aufgaben in fester Reihenfolge (keine Anlage, unbestätigter Neustart, Brücke mit Fehler oder Verdacht auf geleerte
Ablage, offene Zustimmungen, keine Brücke); Stationen mit Stand. Tests: jede Aufgabenart erscheint mit ihrem Link; ohne
Aufgaben der Satz; Zählungen (aktiv, wartet, zurück, abgelehnt; Konten, mit Sportpass, deaktiviert).

**T5 Zustimmungen und Konten** (D2, D5, D6): Bestätigen, Ablehnen, Entfernen über `DecisionDialog`; Konten mit Stand je
Zeile; Konto speichern mit Dialog bei Rolle, Status oder Passwort (das Formular sammelt die Änderungen vor dem Absenden,
der Dialog sendet dann ab). Tests: Markup je Zustand; der Dialog bei „Deaktivieren“ nennt Abmeldung und Brücke.

**T6 Anlage und Brücke** (D7, D8, Begriffe): Widerrufen, Neustart, Rangliste, Zeitzone über `DecisionDialog`; Rangliste
speichert erst nach dem Dialog; „Epoche“ verschwindet aus der Oberfläche; „?“ an Anlage, Brücke, Code, Rangliste,
Neustart, Zeitzone. Test: kein „Epoche“ im Markup der Seite.

**T7 Dialoge des Schützen**: Widerrufen, Ablehnung entfernen, Nicht meine über `DecisionDialog` mit dem Katalog; die
bestehenden Markup-Tests anpassen.

**T8 Doku und Prüfung**
- `vault/conventions.md` §10: Regel „Kein Knopf ohne Folge“ (drei Teile, Folgen aus `consequences.ts`, keine
  Fachbegriffe); `spiegel-ui-design`: Admin-Übersicht; `apps/spiegel/CLAUDE.md`: Regel und Ort der Texte.
- Browser (Dev-Server :3002, als Admin, Test-Konto dazu): Übersicht mit einer offenen Zustimmung, jeder Dialog einmal
  geöffnet und mit Abbrechen geschlossen, Bestätigen und Rangliste einmal ausgeführt, Konto deaktivieren (Dialog nennt
  die Folgen), am Telefon und am Desktop, keine Konsolenfehler; Testdaten danach weg. `pruefen --start` grün.

## Verifikation

- `pnpm check` grün; Spiegel ohne Cache grün.
- Tests aus T1–T7.
- Browser wie T8; was die Daten nicht hergeben, steht im Bericht als „nicht belegt“.
