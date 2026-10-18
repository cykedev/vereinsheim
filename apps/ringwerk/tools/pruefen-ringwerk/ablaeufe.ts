// Abläufe über die Oberfläche: auf frisch gebautem Prüfbestand je ein Wettbewerb jeder Art anlegen und bis zum
// Ende bedienen, einmal am Telefon (390 px) als Sportleitung und einmal am Desktop (1280 px) als Admin. Nach jedem
// Schritt liest das Werkzeug die betroffenen Zeilen aus der Datenbank und vergleicht sie mit den Eingaben: nichts fehlt,
// nichts doppelt, keine verwaisten Serien. Ein Schritt, der scheitert, beendet seinen Ablauf (die folgenden bauen auf
// ihm auf); die übrigen Abläufe laufen weiter.

import { spawnSync } from "node:child_process"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"

import { Browser } from "@vereinsheim/pruefen/browser"
import { pdfText } from "@vereinsheim/pruefen/pdf"

import { PRUEF_ACCOUNTS } from "../pruefdaten/accounts"
import { loadRingwerk, type Ringwerk } from "../pruefdaten/ringwerk"
import { login } from "./capture"
import { Ui } from "./ui"

type Db = Ringwerk["db"]

export interface FlowOptions {
  url: string
  env: Record<string, string | undefined>
  base: string
  withServer: <T>(url: string, run: () => Promise<T>) => Promise<T>
  reports: string
  /** nur Abläufe, deren Name das Wort enthält */
  only?: string
  out: (text?: string) => void
}

interface Pass {
  label: string
  short: string
  width: number
  height: number
  role: "MANAGER" | "ADMIN"
}

const PASSES: Pass[] = [
  { label: "Telefon", short: "T", width: 390, height: 844, role: "MANAGER" },
  { label: "Desktop", short: "D", width: 1280, height: 900, role: "ADMIN" },
]

interface Result {
  pass: string
  flow: string
  step: string
  ok: boolean
  detail: string
  /** scheitert wegen eines bekannten Befunds in Ringwerk (`KNOWN`) */
  known?: string
}

interface KnownFinding {
  step: string
  /** genau die bekannte Abweichung; jede andere Meldung desselben Schritts bleibt ein Fehler */
  matches: (detail: string) => boolean
  finding: string
}

/**
 * Bekannte Befunde in Ringwerk, die dieses Werkzeug nur meldet (es ändert `src` nicht). Scheitert der Schritt mit genau
 * dieser Abweichung, steht das als BEKANNT im Bericht und der Lauf bleibt grün; läuft er grün, meldet der Bericht, dass
 * der Eintrag entfallen kann. Ein Fehler der Datenbank-Prüfung (`OrphanError`) ist nie bekannt.
 */
const KNOWN: KnownFinding[] = [
  {
    step: "Feldfehler lässt die Eingaben stehen",
    matches: (detail) =>
      detail.startsWith("Frist, Disziplin und Format bleiben nach dem Feldfehler: ") &&
      detail.includes('"frist":"2026-11-15"') &&
      detail.includes('"disziplin":"Gemischt (Faktor-Korrektur)"') &&
      detail.includes('"format":"Doppelrunde (Hin/Rück)"'),
    finding:
      "Nach einem Feldfehler beim Anlegen springt die Disziplin auf „Gemischt“ zurück (die Radix-Auswahl mit `name` folgt dem Zurücksetzen des Formulars)",
  },
]

/** die Datenbank enthält Zeilen, die es nach keinem Ablauf geben darf */
class OrphanError extends Error {}

const APP_DIR = path.resolve(__dirname, "../..")

class FlowAbort extends Error {}

/** Lauf eines Ablaufs: Schritte nacheinander, Prüfungen je Schritt, Bildschirmfoto beim Scheitern */
class Run {
  readonly results: Result[] = []
  private flow = ""

  constructor(
    private readonly ui: Ui,
    private readonly db: Db,
    private readonly pass: Pass,
    private readonly shots: string
  ) {}

  async flowOf(name: string, run: () => Promise<void>) {
    this.flow = name
    try {
      await run()
    } catch (error) {
      if (!(error instanceof FlowAbort)) this.fail("Abbruch", error)
    }
  }

  private fail(step: string, error: unknown) {
    const detail = error instanceof Error ? error.message : String(error)
    const known =
      error instanceof OrphanError
        ? undefined
        : KNOWN.find((k) => k.step === step && k.matches(detail))?.finding
    this.results.push({ pass: this.pass.label, flow: this.flow, step, ok: false, detail, known })
  }

  /** ein Schritt: Bedienung, dann Prüfung der Datenbank; scheitert er, endet der Ablauf */
  async step(name: string, run: () => Promise<void>) {
    try {
      await run()
      await this.noOrphans()
      this.results.push({
        pass: this.pass.label,
        flow: this.flow,
        step: name,
        ok: true,
        detail: KNOWN.some((k) => k.step === name)
          ? "bekannter Befund behoben: Eintrag in KNOWN entfernen"
          : "",
      })
    } catch (error) {
      this.fail(name, error)
      const file = path.join(
        this.shots,
        `${this.pass.short}-${this.flow}-${name}`.replace(/[^a-z0-9äöüß-]+/gi, "_") + ".png"
      )
      await this.ui.page
        .screenshot(true)
        .then((png) => writeFileSync(file, png))
        .catch(() => {})
      throw new FlowAbort()
    }
  }

  /** eine Prüfung, deren Scheitern den Ablauf nicht beendet (die folgenden Schritte hängen nicht an ihr) */
  async check(name: string, run: () => Promise<void>) {
    try {
      await this.step(name, run)
    } catch (error) {
      if (!(error instanceof FlowAbort)) throw error
    }
  }

  /** nicht belegbar über die Oberfläche: steht im Bericht, ohne Fehler */
  note(name: string, detail: string) {
    this.results.push({ pass: this.pass.label, flow: this.flow, step: name, ok: true, detail })
  }

  /** Zeilen, die es nach keinem Ablauf geben darf */
  private async noOrphans() {
    const problems = await this.db.$queryRaw<{ what: string; n: bigint }[]>`
      SELECT 'Serie einer Paarung doppelt' AS what, count(*) AS n FROM (
        SELECT 1 FROM "Series" WHERE "matchupId" IS NOT NULL
        GROUP BY "matchupId", "participantId", "duelNumber", "isTiebreak" HAVING count(*) > 1) d
      UNION ALL
      SELECT 'Serie einer Paarung von jemand anderem', count(*) FROM "Series" s JOIN "Matchup" m ON m.id = s."matchupId"
        WHERE s."participantId" <> m."homeParticipantId" AND s."participantId" IS DISTINCT FROM m."awayParticipantId"
      UNION ALL
      SELECT 'Serie ohne Einschreibung im Wettbewerb', count(*) FROM "Series" s
        WHERE s."competitionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CompetitionParticipant" cp
          WHERE cp."competitionId" = s."competitionId" AND cp."participantId" = s."participantId")
      UNION ALL
      SELECT 'Serie ohne Paarung und ohne Wettbewerb', count(*) FROM "Series"
        WHERE "matchupId" IS NULL AND "competitionId" IS NULL
      UNION ALL
      SELECT 'Serie an der Einschreibung eines anderen', count(*) FROM "Series" s
        JOIN "CompetitionParticipant" cp ON cp.id = s."competitionParticipantId"
        WHERE cp."participantId" <> s."participantId" OR cp."competitionId" IS DISTINCT FROM s."competitionId"
      UNION ALL
      SELECT 'Paarung mit nicht eingeschriebenem Teilnehmer', count(*) FROM "Matchup" m
        WHERE NOT EXISTS (SELECT 1 FROM "CompetitionParticipant" cp
            WHERE cp."competitionId" = m."competitionId" AND cp."participantId" = m."homeParticipantId")
          OR (m."awayParticipantId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "CompetitionParticipant" cp
            WHERE cp."competitionId" = m."competitionId" AND cp."participantId" = m."awayParticipantId"))
      UNION ALL
      SELECT 'Playoff-Ergebnis von jemand anderem', count(*) FROM "PlayoffDuelResult" r
        JOIN "PlayoffDuel" d ON d.id = r."duelId" JOIN "PlayoffMatch" pm ON pm.id = d."playoffMatchId"
        WHERE r."participantId" NOT IN (pm."participantAId", pm."participantBId")
      UNION ALL
      SELECT 'Einschreibung doppelt', count(*) FROM (
        SELECT 1 FROM "CompetitionParticipant" WHERE "isGuest" = false
        GROUP BY "competitionId", "participantId", "eventTeamId" HAVING count(*) > 1) e`
    const found = problems.filter((p) => Number(p.n) > 0)
    if (found.length > 0)
      throw new OrphanError(`Datenbank: ${found.map((p) => `${p.what} (${p.n})`).join(", ")}`)
  }
}

/**
 * Spielplan erzeugen nie in beiden Durchgängen zugleich: Ringwerk erzeugt ihn in einer serialisierbaren Transaktion, und
 * zwei gleichzeitige brechen sich gegenseitig ab, auch in verschiedenen Wettbewerben (nichts geht verloren, der Knopf
 * muss nur noch einmal gedrückt werden). Die Abläufe prüfen die Bedienung, nicht dieses Zusammentreffen.
 */
let schedule: Promise<unknown> = Promise.resolve()
function alone<T>(work: () => Promise<T>): Promise<T> {
  const result = schedule.then(work, work)
  schedule = result.catch(() => {})
  return result
}

function expect(ok: boolean, what: string, detail: unknown = "") {
  if (!ok)
    throw new Error(
      `${what}${detail === "" ? "" : `: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`}`
    )
}

const num = (value: unknown) => Number(String(value))

/** wie die Listen einen Eingeschriebenen nennen: Gäste mit ihrem Namen (ganz im Vornamen), Mitglieder „Nachname, Vorname“ */
const labelOf = (cp: { isGuest: boolean; participant: { firstName: string; lastName: string } }) =>
  cp.isGuest
    ? `${cp.participant.firstName} ${cp.participant.lastName}`.trim()
    : `${cp.participant.lastName}, ${cp.participant.firstName}`

interface Person {
  id: string
  label: string
  name: string
}

async function people(db: Db, count: number, skip = 0): Promise<Person[]> {
  const rows = await db.participant.findMany({
    where: { isActive: true, isGuestRecord: false, NOT: { firstName: { contains: "-" } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
    skip,
    take: count,
  })
  return rows.map((p) => ({
    id: p.id,
    label: `${p.lastName}, ${p.firstName}`,
    name: `${p.firstName} ${p.lastName}`,
  }))
}

async function competitionNamed(db: Db, name: string) {
  const rows = await db.competition.findMany({ where: { name } })
  expect(rows.length === 1, `genau ein Wettbewerb „${name}“`, rows.length)
  return rows[0]
}

async function enroll(
  ui: Ui,
  db: Db,
  competitionId: string,
  list: Person[],
  team?: "neu" | "erstes"
) {
  for (const person of list) {
    if (team === "neu") await ui.check("newTeam", true)
    if (team === "erstes") await ui.choose("teamId", /^Team \d+ \(1\//)
    await ui.choose("participantId", person.label)
    await ui.press("Einschreiben")
    await ui.until(
      `shown(${JSON.stringify(person.label)})`,
      `${person.label} erscheint nicht in der Liste`
    )
    const rows = await db.competitionParticipant.count({
      where: { competitionId, participantId: person.id, status: "ACTIVE" },
    })
    expect(rows === 1, `${person.label} genau einmal eingeschrieben`, rows)
  }
}

/** auf der Seite eines Wettbewerbs über die Liste: der Knopf auf seiner Karte */
async function pressOnCard(ui: Ui, name: string, label: string) {
  await ui.open("/competitions")
  const card = `(() => { let el = $$("a").find((a) => txt(a) === ${JSON.stringify(name)})
    while (el && !btn(${JSON.stringify("Löschen")}, el)) el = el.parentElement; return el })()`
  await ui.press(label, card)
}

async function fetchPdf(ui: Ui, url: string): Promise<string> {
  const cookie = await ui.page.cookieHeader()
  const response = await fetch(url, { headers: { cookie } })
  expect(response.status === 200, `PDF ${url}`, response.status)
  expect(
    response.headers.get("content-type")?.includes("application/pdf") ?? false,
    "PDF ist ein PDF"
  )
  return pdfText(new Uint8Array(await response.arrayBuffer()))
}

// ─── Abläufe ─────────────────────────────────────────────────────────────────────────────────────

async function leagueClassic(run: Run, ui: Ui, db: Db, pass: Pass) {
  const name = `Ablauf ${pass.short} · Liga Hin/Rück`
  const players = await people(db, 6)
  let id = ""

  await run.check("Feldfehler lässt die Eingaben stehen", async () => {
    // nur die eigenen: der andere Durchgang legt zur selben Zeit Wettbewerbe an
    const mine = { name: { startsWith: `Ablauf ${pass.short} ` } }
    const before = await db.competition.count({ where: mine })
    await ui.open("/competitions/new")
    await ui.choose("type", "Liga")
    await ui.choose("disciplineId", "Luftgewehr")
    await ui.choose("leagueFormat", "Doppelrunde (Hin/Rück)")
    await ui.fill("hinrundeDeadline", "2026-11-15")
    await ui.fill("rueckrundeDeadline", "2026-12-20")
    await ui.fill("name", "")
    await ui.press("Speichern")
    await ui.until(`txt($("#name-error")) !== ""`, "kein Feldfehler am Namen")
    expect(
      (await db.competition.count({ where: mine })) === before &&
        (await db.competition.count({ where: { name: "" } })) === 0,
      "nichts angelegt"
    )
    const kept = {
      frist: await ui.value("hinrundeDeadline"),
      disziplin: await ui.chosen("disciplineId"),
      format: await ui.chosen("leagueFormat"),
    }
    expect(
      kept.frist === "2026-11-15" &&
        kept.disziplin === "Luftgewehr" &&
        kept.format === "Doppelrunde (Hin/Rück)",
      "Frist, Disziplin und Format bleiben nach dem Feldfehler",
      kept
    )
  })

  await run.step("anlegen", async () => {
    await ui.open("/competitions/new")
    await ui.choose("type", "Liga")
    await ui.choose("disciplineId", "Luftgewehr")
    await ui.choose("leagueFormat", "Doppelrunde (Hin/Rück)")
    await ui.fill("hinrundeDeadline", "2026-11-15")
    await ui.fill("rueckrundeDeadline", "2026-12-20")
    await ui.fill("name", name)
    await ui.press("Speichern")
    const at = await ui.waitPath(
      /^\/competitions\/[^/]+\/participants$/,
      "keine Weiterleitung zu Teilnehmern"
    )
    const c = await competitionNamed(db, name)
    id = c.id
    expect(at === `/competitions/${id}/participants`, "Weiterleitung zum neuen Wettbewerb")
    expect(
      c.type === "LEAGUE" && c.leagueFormat === "DOUBLE_ROUND_ROBIN" && c.status === "ACTIVE",
      "Art, Format, Status",
      c
    )
    expect(
      c.hinrundeDeadline?.toISOString().slice(0, 10) === "2026-11-15",
      "Frist gespeichert",
      c.hinrundeDeadline
    )
  })

  await run.step("ungespeicherte Änderungen: fragt beim Verlassen", async () => {
    await ui.open(`/competitions/${id}/edit`)
    await ui.fill("name", `${name} geändert`)
    await ui.press("Abbrechen", "$('form')")
    await ui.until(
      `txt(dlg()).includes("Ungespeicherte Änderungen")`,
      "keine Frage nach ungespeicherten Änderungen"
    )
    await ui.pressInDialog("Abbrechen")
    await ui.dialogClosed("Frage schließt nicht")
    expect((await ui.value("name")) === `${name} geändert`, "Eingabe bleibt nach „Abbrechen“")
    await ui.press("Abbrechen", "$('form')")
    await ui.pressInDialog("Verwerfen")
    await ui.until(`!location.pathname.endsWith("/edit")`, "„Verwerfen“ verlässt die Seite nicht")
    expect((await competitionNamed(db, name)).name === name, "Name in der Datenbank unverändert")
    // Neuladen mit ungespeicherter Eingabe: der Browser fragt (`beforeunload`)
    await ui.open(`/competitions/${id}/edit`)
    await ui.fill("name", `${name} geändert`)
    const asked = ui.page.dialogs.length
    await ui.open(`/competitions/${id}/edit`)
    expect(
      ui.page.dialogs.slice(asked).some((d) => d.startsWith("beforeunload")),
      "Neuladen fragt nach",
      ui.page.dialogs
    )
  })

  await run.step("Teilnehmer einschreiben", async () => {
    await ui.open(`/competitions/${id}/participants`)
    await enroll(ui, db, id, players)
  })

  await run.step("Spielplan erzeugen und neu erzeugen", () =>
    alone(async () => {
      await ui.open(`/competitions/${id}/schedule`)
      await ui.press("Spielplan generieren")
      await ui.pressInDialog("Generieren")
      await ui.dialogClosed("Dialog schließt nicht")
      await ui.until(`$$("main tr").length > 10`, "kein Spielplan")
      const first = await db.matchup.findMany({
        where: { competitionId: id },
        select: { id: true },
      })
      expect(first.length === 30, "6 Teilnehmer Hin und Rück: 30 Paarungen", first.length)
      await ui.open(`/competitions/${id}/schedule`)
      await ui.press("Spielplan neu generieren")
      await ui.pressInDialog("Neu generieren")
      await ui.dialogClosed("Dialog schließt nicht")
      await ui.page.wait(500)
      const second = await db.matchup.findMany({
        where: { competitionId: id },
        select: { id: true, homeParticipantId: true, awayParticipantId: true },
      })
      expect(second.length === 30, "neu erzeugt: wieder 30 Paarungen", second.length)
      const old = new Set(first.map((m) => m.id))
      expect(
        second.every((m) => !old.has(m.id)),
        "keine alte Paarung bleibt"
      )
      const pairs = new Set(second.map((m) => `${m.homeParticipantId}>${m.awayParticipantId}`))
      expect(pairs.size === 30, "jede Paarung je Richtung einmal", pairs.size)
    })
  )

  await run.step("Regelwerk gesperrt, Frist änderbar", async () => {
    await ui.open(`/competitions/${id}/edit`)
    expect((await ui.text()).includes("Gruppenphase & Format gesperrt"), "Hinweis auf die Sperre")
    expect(await ui.ev<boolean>(`$("#leagueFormat").matches(":disabled")`), "Format gesperrt")
    await ui.fill("hinrundeDeadline", "2026-11-22")
    await ui.press("Speichern")
    await ui.until(`!location.pathname.endsWith("/edit")`, "Speichern führt nicht weiter")
    const c = await competitionNamed(db, name)
    expect(
      c.hinrundeDeadline?.toISOString().slice(0, 10) === "2026-11-22",
      "neue Frist",
      c.hinrundeDeadline
    )
    expect(c.leagueFormat === "DOUBLE_ROUND_ROBIN", "Format unverändert")
  })

  let matchupId = ""
  await run.step("Ergebnis eintragen und korrigieren", async () => {
    await ui.open(`/competitions/${id}/schedule`)
    const row = `$$("main tr").find((tr) => visible(tr) && btn("Ergebnis eintragen", tr))`
    const names = await ui.ev<string[]>(`$$("td", ${row}).map(txt).filter(Boolean).slice(0, 2)`)
    await ui.press("Ergebnis eintragen", row)
    await ui.fill("home-rings", "95")
    await ui.fill("home-teiler", "12,3")
    await ui.fill("away-rings", "93")
    await ui.fill("away-teiler", "20,1")
    await ui.pressInDialog("Speichern")
    await ui.dialogClosed("Dialog schließt nicht")
    const done = await db.matchup.findMany({
      where: { competitionId: id, status: "COMPLETED" },
      include: { series: true, homeParticipant: true },
    })
    expect(done.length === 1, "genau eine Paarung fertig", done.length)
    matchupId = done[0].id
    expect(names[0]?.startsWith(done[0].homeParticipant.lastName), "die geklickte Zeile", names)
    const home = done[0].series.find((s) => s.participantId === done[0].homeParticipantId)
    const away = done[0].series.find((s) => s.participantId === done[0].awayParticipantId)
    expect(done[0].series.length === 2, "zwei Serien", done[0].series.length)
    expect(num(home?.rings) === 95 && num(home?.teiler) === 12.3, "Heim 95 / 12,3", home)
    expect(num(away?.rings) === 93 && num(away?.teiler) === 20.1, "Gast 93 / 20,1", away)

    await ui.press("Ergebnis korrigieren")
    expect((await ui.value("home-rings")) === "95", "Dialog zeigt das gespeicherte Ergebnis")
    await ui.fill("home-rings", "96")
    await ui.pressInDialog("Speichern")
    await ui.dialogClosed("Dialog schließt nicht")
    const series = await db.series.findMany({ where: { matchupId } })
    expect(series.length === 2, "nach der Korrektur weiter zwei Serien", series.length)
    const home2 = series.find((s) => s.participantId === done[0].homeParticipantId)
    const away2 = series.find((s) => s.participantId === done[0].awayParticipantId)
    expect(num(home2?.rings) === 96 && num(home2?.teiler) === 12.3, "Heim jetzt 96 / 12,3", home2)
    expect(
      num(away2?.rings) === 93 && num(away2?.teiler) === 20.1,
      "Gast unverändert 93 / 20,1",
      away2
    )
  })

  await run.step("Teilnehmer zurückziehen", async () => {
    const m = await db.matchup.findUniqueOrThrow({ where: { id: matchupId } })
    const free = players.find((p) => p.id !== m.homeParticipantId && p.id !== m.awayParticipantId)!
    await ui.open(`/competitions/${id}/participants`)
    await ui.pressIn([free.label], "Zurückziehen")
    await ui.fill("withdraw-reason", "Umzug")
    await ui.pressInDialog("Zurückziehen")
    await ui.dialogClosed("Dialog schließt nicht")
    const cp = await db.competitionParticipant.findFirstOrThrow({
      where: { competitionId: id, participantId: free.id },
    })
    expect(cp.status === "WITHDRAWN" && cp.withdrawnAt !== null, "zurückgezogen mit Zeitpunkt", cp)
    expect((await db.series.count({ where: { matchupId } })) === 2, "Serien unverändert")
    expect(
      (await db.matchup.count({ where: { competitionId: id } })) === 30,
      "Paarungen unverändert"
    )
  })

  run.note(
    "Kampflos",
    "nicht belegt: Ringwerk hat dafür weder Action noch Oberfläche (nur Anzeige)"
  )

  await run.step(
    pass.role === "ADMIN" ? "erzwungen löschen" : "erzwungen löschen verweigert (Sportleitung)",
    async () => {
      await ui.open(`/competitions/${id}/edit`)
      await ui.press("Wettbewerb endgültig löschen")
      await ui.fill("confirm-competition-name", name)
      await ui.pressInDialog("Endgültig löschen")
      if (pass.role === "ADMIN") {
        await ui.waitPath(/^\/competitions$/, "keine Rückkehr zur Liste")
        expect((await db.competition.count({ where: { name } })) === 0, "Wettbewerb weg")
        const left = await Promise.all([
          db.competitionParticipant.count({ where: { competitionId: id } }),
          db.matchup.count({ where: { competitionId: id } }),
          db.series.count({ where: { OR: [{ competitionId: id }, { matchupId }] } }),
        ])
        expect(
          left.every((n) => n === 0),
          "keine Einschreibung, Paarung, Serie bleibt",
          left
        )
      } else {
        await ui.until(
          `txt(dlg()).includes("Keine Berechtigung")`,
          "keine Meldung „Keine Berechtigung“ im Dialog"
        )
        await ui.pressInDialog("Abbrechen")
        expect((await db.competition.count({ where: { name } })) === 1, "Wettbewerb bleibt")
        expect((await db.series.count({ where: { matchupId } })) === 2, "Serien bleiben")
      }
    }
  )
}

/** Werte eines Duells: Heim gewinnt, Gast gewinnt oder genau gleich (RINGTEILER) */
const DUEL = {
  heim: { hr: "98", ht: "5,0", ar: "90", at: "30,0" },
  gast: { hr: "90", ht: "30,0", ar: "98", at: "5,0" },
  gleich: { hr: "94", ht: "15,0", ar: "94", at: "15,0" },
} as const

async function leagueBestOf(run: Run, ui: Ui, db: Db, pass: Pass, base: string) {
  const name = `Ablauf ${pass.short} · Best-of mit Playoffs`
  const players = await people(db, 4, 6)
  let id = ""

  await run.step("anlegen", async () => {
    await ui.open("/competitions/new")
    await ui.choose("type", "Liga")
    await ui.fill("name", name)
    await ui.choose("disciplineId", "Luftpistole")
    await ui.choose("leagueFormat", "Best-of-Begegnung (einfache Runde)")
    await ui.choose("groupBestOf", "Best-of-3 (2 Siege)")
    await ui.check("playoffHasViertelfinale", false)
    await ui.choose("playoffBestOf", "Best-of-3 (2 Siege)")
    await ui.press("Speichern")
    await ui.waitPath(/^\/competitions\/[^/]+\/participants$/, "keine Weiterleitung")
    const c = await competitionNamed(db, name)
    id = c.id
    expect(
      c.leagueFormat === "BEST_OF_SINGLE" &&
        c.groupBestOf === 3 &&
        c.playoffBestOf === 3 &&
        c.playoffHasViertelfinale === false,
      "Regelwerk wie eingegeben",
      c
    )
  })

  await run.step("einschreiben, Spielplan", async () => {
    await enroll(ui, db, id, players)
    await alone(async () => {
      await ui.open(`/competitions/${id}/schedule`)
      await ui.press("Spielplan generieren")
      await ui.pressInDialog("Generieren")
      await ui.dialogClosed("Dialog schließt nicht")
      expect(
        (await db.matchup.count({ where: { competitionId: id } })) === 6,
        "4 Teilnehmer: 6 Paarungen"
      )
    })
  })

  await run.step("Duelle der Gruppenphase, eine Paarung mit Stechschuss", async () => {
    const matchups = await db.matchup.findMany({
      where: { competitionId: id },
      orderBy: [{ roundIndex: "asc" }, { createdAt: "asc" }],
      include: { homeParticipant: true, awayParticipant: true },
    })
    for (const [i, m] of matchups.entries()) {
      await ui.open(`/competitions/${id}/schedule`)
      const pair = [m.homeParticipant, m.awayParticipant!].map(
        (p) => `${p.lastName}, ${p.firstName}`
      )
      await ui.pressIn(pair, "Duelle eintragen")
      const plan = i === 0 ? [DUEL.heim, DUEL.gast, DUEL.gleich] : [DUEL.heim, DUEL.gast, DUEL.heim]
      for (const [n, d] of plan.entries()) {
        const k = n + 1
        await ui.fill(`home-d${k}-rings`, d.hr)
        await ui.fill(`home-d${k}-teiler`, d.ht)
        await ui.fill(`away-d${k}-rings`, d.ar)
        await ui.fill(`away-d${k}-teiler`, d.at)
        await ui.pressInDialog("Duell speichern")
        await ui.until(
          k < 3 ? `!!$("#home-d${k + 1}-rings")` : `!$("#home-d3-rings")`,
          `Duell ${k} wird nicht gespeichert`
        )
      }
      if (i === 0) {
        await ui.fill("dialog-home-shot", "10,4")
        await ui.fill("dialog-away-shot", "9,8")
        await ui.pressInDialog("Stechschuss speichern")
        await ui.until(`!$("#dialog-home-shot")`, "Stechschuss wird nicht gespeichert")
      }
      await ui.pressInDialog("Schließen")
      await ui.dialogClosed("Dialog schließt nicht")
      const done = await db.matchup.findUniqueOrThrow({
        where: { id: m.id },
        include: { series: true },
      })
      const shots = done.series.filter((s) => s.isTiebreak).length
      expect(done.status === "COMPLETED", `Paarung ${i + 1} fertig`, done.status)
      expect(
        done.series.length === (i === 0 ? 8 : 6) && shots === (i === 0 ? 2 : 0),
        `Paarung ${i + 1}: Serien je Duell und Seite${i === 0 ? " plus Stechschuss" : ""}`,
        { serien: done.series.length, stechschuss: shots }
      )
    }
  })

  await run.step("Playoffs starten", async () => {
    await ui.open(`/competitions/${id}/playoffs`)
    await ui.press("Playoffs starten")
    await ui.pressInDialog("Playoffs starten")
    await ui.dialogClosed("Dialog schließt nicht")
    const semis = await db.playoffMatch.findMany({ where: { competitionId: id } })
    expect(
      semis.length === 2 && semis.every((s) => s.round === "SEMI_FINAL"),
      "zwei Halbfinals",
      semis
    )
    const ids = new Set(semis.flatMap((s) => [s.participantAId, s.participantBId]))
    expect(ids.size === 4 && players.every((p) => ids.has(p.id)), "alle vier im Halbfinale")
  })

  await run.step("Halbfinale mit einem Unentschieden", async () => {
    await ui.open(`/competitions/${id}/playoffs`)
    let tie = true
    for (let guard = 0; guard < 20; guard++) {
      const open = await ui.ev<boolean>(`!!btn("Eintragen")`)
      if (open) {
        await ui.press("Eintragen")
        const d = tie ? DUEL.gleich : DUEL.heim
        await ui.fill("a-rings", d.hr)
        await ui.fill("b-rings", d.ar)
        await ui.fill("a-teiler", d.ht)
        await ui.fill("b-teiler", d.at)
        await ui.pressInDialog("Speichern")
        await ui.dialogClosed("Dialog schließt nicht")
        await ui.text()
        tie = false
        continue
      }
      if (await ui.ev<boolean>(`!!btnRe("^(Erstes|Nächstes) Duell anlegen$")`)) {
        await ui.press(/^(Erstes|Nächstes) Duell anlegen$/)
        await ui.until(`!!btn("Eintragen")`, "Duell wird nicht angelegt")
        continue
      }
      break
    }
    const semis = await db.playoffMatch.findMany({
      where: { competitionId: id },
      include: { duels: { include: { results: true } } },
    })
    expect(
      semis.every((s) => s.status === "COMPLETED" && s.winsA === 2),
      "beide Halbfinals 2:x für A",
      semis.map((s) => [s.winsA, s.winsB, s.status])
    )
    const duels = semis.flatMap((s) => s.duels)
    expect(
      duels.every((d) => d.results.length === 2),
      "jedes Duell mit zwei Ergebnissen"
    )
    expect(duels.length === 5, "ein Duell mehr wegen des Unentschiedens", duels.length)
  })

  await run.step("Finale anlegen", async () => {
    await ui.press("Finale anlegen")
    await ui.pressInDialog(/^Finale anlegen/)
    await ui.dialogClosed("Dialog schließt nicht")
    const semis = await db.playoffMatch.findMany({
      where: { competitionId: id, round: "SEMI_FINAL" },
    })
    const final = await db.playoffMatch.findMany({ where: { competitionId: id, round: "FINAL" } })
    expect(final.length === 1, "ein Finale", final.length)
    const winners = new Set(semis.map((s) => s.participantAId))
    expect(
      winners.has(final[0].participantAId) && winners.has(final[0].participantBId),
      "Finale mit den Siegern"
    )
  })

  await run.step("Halbfinale korrigieren: das Finale fällt weg und entsteht neu", async () => {
    const [semi] = await db.playoffMatch.findMany({
      where: { competitionId: id, round: "SEMI_FINAL" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: { participantA: true, participantB: true },
    })
    const names = [semi.participantA, semi.participantB].map((p) => `${p.firstName} ${p.lastName}`)
    // die Karte des Halbfinales: kleinster Bereich mit beiden Namen und Knöpfen zur Korrektur (Stift)
    const card = `$$("main div").filter((el) => visible(el) && ${JSON.stringify(names)}.every((n) => txt(el).includes(n)) && el.querySelector("button svg.lucide-pencil")).sort((a, b) => txt(a).length - txt(b).length)[0]`
    await ui.open(`/competitions/${id}/playoffs`)
    await ui.click(
      `[...${card}.querySelectorAll("button")].filter((b) => b.querySelector("svg.lucide-pencil")).at(-1)`,
      "Korrektur des letzten Duells im Halbfinale"
    )
    // aus dem Sieg im letzten Duell wird ein Unentschieden: das Halbfinale ist wieder offen
    await ui.fill("a-rings", DUEL.gleich.hr)
    await ui.fill("b-rings", DUEL.gleich.ar)
    await ui.fill("a-teiler", DUEL.gleich.ht)
    await ui.fill("b-teiler", DUEL.gleich.at)
    await ui.pressInDialog("Speichern")
    await ui.dialogClosed("Dialog schließt nicht")
    const reopened = await db.playoffMatch.findUniqueOrThrow({ where: { id: semi.id } })
    expect(reopened.status === "PENDING", "Halbfinale wieder offen", reopened)
    expect(
      (await db.playoffMatch.count({ where: { competitionId: id, round: "FINAL" } })) === 0,
      "das Finale ist weg"
    )
    // neu entscheiden und das Finale wieder anlegen
    await ui.open(`/competitions/${id}/playoffs`)
    await ui.press(/^Nächstes Duell anlegen$/)
    await ui.until(`!!btn("Eintragen")`, "Duell wird nicht angelegt")
    await ui.press("Eintragen")
    await ui.fill("a-rings", DUEL.heim.hr)
    await ui.fill("b-rings", DUEL.heim.ar)
    await ui.fill("a-teiler", DUEL.heim.ht)
    await ui.fill("b-teiler", DUEL.heim.at)
    await ui.pressInDialog("Speichern")
    await ui.dialogClosed("Dialog schließt nicht")
    await ui.text()
    await ui.press("Finale anlegen")
    await ui.pressInDialog(/^Finale anlegen/)
    await ui.dialogClosed("Dialog schließt nicht")
    const semis = await db.playoffMatch.findMany({
      where: { competitionId: id, round: "SEMI_FINAL" },
    })
    const finals = await db.playoffMatch.findMany({ where: { competitionId: id, round: "FINAL" } })
    expect(
      semis.every((m) => m.status === "COMPLETED"),
      "beide Halbfinals fertig"
    )
    const winners = new Set(
      semis.map((m) => (m.winsA > m.winsB ? m.participantAId : m.participantBId))
    )
    expect(
      finals.length === 1 &&
        winners.has(finals[0].participantAId) &&
        winners.has(finals[0].participantBId),
      "genau ein Finale mit den Siegern",
      finals
    )
  })

  await run.step("Finale mit Verlängerung", async () => {
    await ui.open(`/competitions/${id}/playoffs`)
    await ui.press(/Schüsse anlegen$/)
    await ui.press("Eintragen")
    await ui.fill("a-rings", "98")
    await ui.fill("b-rings", "98")
    await ui.pressInDialog("Speichern")
    await ui.dialogClosed("Dialog schließt nicht")
    await ui.text()
    await ui.press("Eintragen")
    await ui.until(`txt(dlg()).includes("Verlängerung")`, "keine Verlängerung nach Gleichstand")
    await ui.fill("a-rings", "10")
    await ui.fill("b-rings", "9")
    await ui.pressInDialog("Speichern")
    await ui.dialogClosed("Dialog schließt nicht")
    const final = await db.playoffMatch.findFirstOrThrow({
      where: { competitionId: id, round: "FINAL" },
      include: { duels: { include: { results: true }, orderBy: { duelNumber: "asc" } } },
    })
    expect(
      final.status === "COMPLETED" && final.winsA === 1 && final.winsB === 0,
      "Finale für A",
      final
    )
    expect(
      final.duels.length === 2 && final.duels[1].isSuddenDeath,
      "zweites Duell ist die Verlängerung"
    )
  })

  await run.step("PDF der Playoffs herunterladen", async () => {
    await ui.open(`/competitions/${id}/playoffs`)
    const url = await ui.openedBy("PDF exportieren")
    const text = await fetchPdf(ui, new URL(url, base).toString())
    const final = await db.playoffMatch.findFirstOrThrow({
      where: { competitionId: id, round: "FINAL" },
      include: { participantA: true },
    })
    expect(text.includes(name.slice(0, 20)), "PDF trägt den Namen")
    expect(text.includes(final.participantA.lastName), "PDF nennt den Sieger")
  })

  await run.step("abschließen und archivieren", async () => {
    await pressOnCard(ui, name, "Als abgeschlossen markieren")
    await ui.pressInDialog("Bestätigen")
    await ui.dialogClosed("Dialog schließt nicht")
    expect((await competitionNamed(db, name)).status === "COMPLETED", "abgeschlossen")
    await pressOnCard(ui, name, "Archivieren")
    await ui.pressInDialog("Bestätigen")
    await ui.dialogClosed("Dialog schließt nicht")
    expect((await competitionNamed(db, name)).status === "ARCHIVED", "archiviert")
  })

  await run.step(
    pass.role === "ADMIN" ? "Protokoll ansehen" : "Protokoll nur für Admin",
    async () => {
      await ui.open(`/competitions/${id}/audit-log`)
      if (pass.role === "ADMIN") {
        const shown = await ui.ev<number>(`$$("main details").length`)
        const stored = await db.auditLog.count({ where: { competitionId: id } })
        expect(shown === stored && stored > 0, "jeder Eintrag des Protokolls steht auf der Seite", {
          shown,
          stored,
        })
      } else {
        expect(
          (await ui.path()).endsWith("/schedule"),
          "Sportleitung landet auf dem Spielplan",
          await ui.path()
        )
      }
    }
  )
}

async function eventFlow(run: Run, ui: Ui, db: Db, pass: Pass, base: string) {
  const name = `Ablauf ${pass.short} · Event mit Gast`
  const players = await people(db, 2, 10)
  let id = ""

  await run.step("anlegen", async () => {
    await ui.open("/competitions/new")
    await ui.choose("type", "Event (Kranzlschiessen)")
    await ui.fill("name", name)
    await ui.choose("disciplineId", "Luftgewehr")
    await ui.fill("eventDate", "2026-11-07")
    await ui.check("allowGuests", true)
    await ui.press("Speichern")
    await ui.waitPath(/^\/competitions\/[^/]+\/participants$/, "keine Weiterleitung")
    const c = await competitionNamed(db, name)
    id = c.id
    expect(
      c.type === "EVENT" && c.allowGuests === true && c.scoringMode === "RINGTEILER",
      "Event wie eingegeben",
      c
    )
  })

  await run.step("Mitglieder und ein Gast einschreiben", async () => {
    await enroll(ui, db, id, players)
    await ui.check("isGuest", true)
    await ui.fill("guestName", "Gast Ahornberg")
    await ui.press("Einschreiben")
    await ui.until(`txt($("main")).includes("Ahornberg")`, "Gast erscheint nicht")
    const guests = await db.competitionParticipant.count({
      where: { competitionId: id, isGuest: true },
    })
    expect(guests === 1, "ein Gast", guests)
  })

  await run.step("Serien eintragen, eine löschen", async () => {
    const enrolled = await db.competitionParticipant.findMany({
      where: { competitionId: id },
      include: { participant: true },
      orderBy: { createdAt: "asc" },
    })
    for (const [i, cp] of enrolled.entries()) {
      await ui.open(`/competitions/${id}/series`)
      await ui.pressIn([labelOf(cp)], "Ergebnis eintragen")
      await ui.fill("rings", String(90 + i))
      await ui.fill("teiler", `${10 + i},5`)
      await ui.pressInDialog("Speichern")
      await ui.dialogClosed("Dialog schließt nicht")
      const s = await db.series.findMany({ where: { competitionParticipantId: cp.id } })
      expect(
        s.length === 1 && num(s[0].rings) === 90 + i && num(s[0].teiler) === 10.5 + i,
        `Serie ${i + 1}`,
        s
      )
    }
    await ui.open(`/competitions/${id}/series`)
    await ui.pressIn([labelOf(enrolled[0])], "Ergebnis löschen")
    await ui.pressInDialog("Löschen")
    await ui.dialogClosed("Dialog schließt nicht")
    expect(
      (await db.series.count({ where: { competitionId: id } })) === enrolled.length - 1,
      "eine Serie weniger"
    )
  })

  await run.step("Starterliste drucken", async () => {
    await ui.open(`/competitions/${id}/participants`)
    const url = await ui.openedBy("Starterliste drucken")
    const text = await fetchPdf(ui, new URL(url, base).toString())
    expect(
      text.includes("Ahornberg") && players.every((p) => text.includes(p.label)),
      "alle auf der Starterliste"
    )
  })
}

async function teamEvent(run: Run, ui: Ui, db: Db, pass: Pass) {
  const name = `Ablauf ${pass.short} · Team-Event`
  const players = await people(db, 4, 12)
  let id = ""

  await run.step("anlegen mit Teams zu zweit", async () => {
    await ui.open("/competitions/new")
    await ui.choose("type", "Event (Kranzlschiessen)")
    await ui.fill("name", name)
    await ui.choose("disciplineId", "Luftgewehr")
    await ui.fill("eventDate", "2026-11-08")
    await ui.fill("teamSize", "2")
    await ui.choose("teamScoring", /^Summe/)
    await ui.press("Speichern")
    await ui.waitPath(/^\/competitions\/[^/]+\/participants$/, "keine Weiterleitung")
    const c = await competitionNamed(db, name)
    id = c.id
    expect(c.teamSize === 2 && c.teamScoring === "SUM", "Team-Regeln", c)
  })

  await run.step("zwei Teams bilden", async () => {
    await enroll(ui, db, id, [players[0]], "neu")
    await enroll(ui, db, id, [players[1]], "erstes")
    await enroll(ui, db, id, [players[2]], "neu")
    await enroll(ui, db, id, [players[3]], "erstes")
    const teams = await db.eventTeam.findMany({
      where: { competitionId: id },
      include: { members: true },
    })
    expect(
      teams.length === 2 && teams.every((t) => t.members.length === 2),
      "zwei volle Teams",
      teams.map((t) => t.members.length)
    )
  })

  await run.step("Serien je Mitglied, Rangliste der Teams", async () => {
    for (const [i, p] of players.entries()) {
      await ui.open(`/competitions/${id}/series`)
      await ui.pressIn([p.label], "Ergebnis eintragen")
      await ui.fill("rings", String(88 + i))
      await ui.fill("teiler", "20,0")
      await ui.pressInDialog("Speichern")
      await ui.dialogClosed("Dialog schließt nicht")
    }
    for (const [i, p] of players.entries()) {
      const s = await db.series.findMany({ where: { competitionId: id, participantId: p.id } })
      expect(
        s.length === 1 && num(s[0].rings) === 88 + i && num(s[0].teiler) === 20,
        `Serie von ${p.label}`,
        s
      )
    }
    // Wertung Ringteiler (100 − Ringe + Teiler, kleiner ist besser), Summe je Team: Team 1 hat 32 + 31 = 63,
    // Team 2 hat 30 + 29 = 59 und steht vorn
    await ui.open(`/competitions/${id}/ranking`)
    const rows = (await ui.text()).split("\n").filter((line) => /^\d+\tTeam \d+\t/.test(line))
    expect(
      rows.length === 2 &&
        /^1\tTeam 2\t.*\b59\b/.test(rows[0]) &&
        /^2\tTeam 1\t.*\b63\b/.test(rows[1]),
      "Team 2 (59) vor Team 1 (63)",
      rows
    )
  })
}

async function seasonFlow(run: Run, ui: Ui, db: Db, pass: Pass) {
  const name = `Ablauf ${pass.short} · Saison`
  const players = await people(db, 2, 16)
  let id = ""

  await run.step("anlegen", async () => {
    await ui.open("/competitions/new")
    await ui.choose("type", "Saison (Jahrespreisschiessen)")
    await ui.fill("name", name)
    await ui.choose("disciplineId", "Luftgewehr")
    await ui.fill("minSeries", "2")
    await ui.fill("seasonStart", "2026-01-01")
    await ui.fill("seasonEnd", "2026-12-31")
    await ui.press("Speichern")
    await ui.waitPath(/^\/competitions\/[^/]+\/participants$/, "keine Weiterleitung")
    const c = await competitionNamed(db, name)
    id = c.id
    expect(c.type === "SEASON" && c.minSeries === 2, "Saison wie eingegeben", c)
  })

  await run.step("einschreiben, Serie eintragen und bearbeiten", async () => {
    await enroll(ui, db, id, players)
    const p = players[0]
    await ui.open(`/competitions/${id}/series`)
    await ui.pressIn([p.label], "Serie hinzufügen")
    await ui.fill("sessionDate", "2026-10-03")
    await ui.fill("rings", "97")
    await ui.fill("teiler", "8,4")
    await ui.pressInDialog("Speichern")
    await ui.dialogClosed("Dialog schließt nicht")
    let s = await db.series.findMany({ where: { competitionId: id, participantId: p.id } })
    expect(
      s.length === 1 &&
        num(s[0].rings) === 97 &&
        s[0].sessionDate.toISOString().startsWith("2026-10-03"),
      "Serie gespeichert",
      s
    )
    await ui.open(`/competitions/${id}/series`)
    await ui.click(
      `$$("main button").find((b) => visible(b) && txt(b).includes(${JSON.stringify(p.label)}))`,
      "Zeile aufklappen"
    )
    await ui.press("Serie bearbeiten")
    await ui.fill("rings", "98")
    await ui.pressInDialog("Speichern")
    await ui.dialogClosed("Dialog schließt nicht")
    s = await db.series.findMany({ where: { competitionId: id, participantId: p.id } })
    expect(s.length === 1 && num(s[0].rings) === 98, "bearbeitet, weiter eine Serie", s)
  })
}

async function deleteFlow(run: Run, ui: Ui, db: Db, pass: Pass) {
  const name = `Ablauf ${pass.short} · zum Löschen`
  await run.step("anlegen und löschen", async () => {
    await ui.open("/competitions/new")
    await ui.choose("type", "Event (Kranzlschiessen)")
    await ui.fill("name", name)
    await ui.choose("disciplineId", "Luftgewehr")
    await ui.press("Speichern")
    await ui.waitPath(/^\/competitions\/[^/]+\/participants$/, "keine Weiterleitung")
    await competitionNamed(db, name)
    await pressOnCard(ui, name, "Löschen")
    await ui.pressInDialog("Löschen")
    await ui.dialogClosed("Dialog schließt nicht")
    expect((await db.competition.count({ where: { name } })) === 0, "gelöscht")
  })
}

const FLOWS = [
  { name: "Liga Hin/Rück", run: leagueClassic },
  { name: "Best-of mit Playoffs", run: leagueBestOf },
  { name: "Event mit Gast", run: eventFlow },
  { name: "Team-Event", run: (r: Run, u: Ui, d: Db, p: Pass) => teamEvent(r, u, d, p) },
  { name: "Saison", run: (r: Run, u: Ui, d: Db, p: Pass) => seasonFlow(r, u, d, p) },
  { name: "Löschen", run: (r: Run, u: Ui, d: Db, p: Pass) => deleteFlow(r, u, d, p) },
]

export async function runFlows(options: FlowOptions): Promise<boolean> {
  const { out } = options
  out("Prüfbestand frisch aufbauen …")
  const build = spawnSync("pnpm", ["pruefdaten"], { cwd: APP_DIR, encoding: "utf8" })
  if (build.status !== 0) throw new Error(`pruefdaten scheitert:\n${build.stdout}\n${build.stderr}`)

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const dir = path.join(options.reports, "ringwerk-ablaeufe", stamp)
  mkdirSync(dir, { recursive: true })
  const rw = await loadRingwerk(options.url)
  const results: Result[] = []
  try {
    await options.withServer(options.url, async () => {
      // Telefon und Desktop zugleich: Jeder Durchgang legt eigene Wettbewerbe an (`Ablauf T …`, `Ablauf D …`)
      const perPass = await Promise.all(
        PASSES.map(async (pass) => {
          const browser = await Browser.launch()
          try {
            const page = await browser.newPage()
            const account = PRUEF_ACCOUNTS.find((a) => a.role === pass.role)!
            await login(page, options.base, {
              email: account.email,
              password: options.env[account.env] ?? "",
            })
            await page.viewport(pass.width, pass.height)
            const ui = new Ui(page, options.base)
            const run = new Run(ui, rw.db, pass, dir)
            for (const flow of FLOWS) {
              if (options.only && !flow.name.toLowerCase().includes(options.only.toLowerCase()))
                continue
              out(`  ${pass.label} · ${flow.name}`)
              await run.flowOf(flow.name, () => flow.run(run, ui, rw.db, pass, options.base))
            }
            if (page.errors.length > 0)
              run.results.push({
                pass: pass.label,
                flow: "Skriptfehler",
                step: "keine Fehler im Fenster",
                ok: false,
                detail: [...new Set(page.errors)].slice(0, 5).join(" | "),
              })
            // nur das erwartete `beforeunload` beim Verlassen ungespeicherter Eingaben; `alert` und `confirm` sind verboten
            const native = page.dialogs.filter((d) => !d.startsWith("beforeunload"))
            if (native.length > 0)
              run.results.push({
                pass: pass.label,
                flow: "Browser-Dialoge",
                step: "kein alert, confirm oder prompt",
                ok: false,
                detail: native.slice(0, 5).join(" | "),
              })
            return run.results
          } finally {
            await browser.close()
          }
        })
      )
      results.push(...perPass.flat())
    })
  } finally {
    await rw.db.$disconnect()
  }

  const failed = results.filter((r) => !r.ok && !r.known)
  const known = results.filter((r) => !r.ok && r.known)
  const verdict = (r: Result) =>
    r.ok
      ? r.detail
        ? `Hinweis: ${r.detail}`
        : "grün"
      : r.known
        ? `BEKANNT: ${r.known}`
        : `**FEHLER** ${r.detail.replace(/\|/g, "/")}`
  const lines = [
    "# Abläufe über die Oberfläche",
    "",
    `${results.length - failed.length - known.length} von ${results.length} Schritten grün, ${known.length} mit bekanntem Befund, ${failed.length} Fehler.`,
    "",
    "| Gerät | Ablauf | Schritt | Ergebnis |",
    "| --- | --- | --- | --- |",
    ...results.map((r) => `| ${r.pass} | ${r.flow} | ${r.step} | ${verdict(r)} |`),
  ]
  writeFileSync(path.join(dir, "ablaeufe.md"), `${lines.join("\n")}\n`)
  out()
  for (const r of results)
    out(
      `  ${r.ok ? "ok     " : r.known ? "BEKANNT" : "FEHLER "}  ${r.pass} · ${r.flow} · ${r.step}${r.ok ? (r.detail ? `: ${r.detail}` : "") : `: ${r.known ?? r.detail}`}`
    )
  out()
  out(
    `${results.length - failed.length - known.length} von ${results.length} Schritten grün, ${known.length} bekannt, ${failed.length} Fehler`
  )
  out(`Bericht: ${path.relative(process.cwd(), dir)}/ablaeufe.md`)
  out(
    "Die Prüfdatenbank trägt jetzt die Abläufe: vor --vergleichen erst pnpm --filter ringwerk pruefdaten"
  )
  return failed.length === 0
}
