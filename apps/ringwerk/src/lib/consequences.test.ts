import { forbiddenIn } from "@vereinsheim/lib/wording"
import { describe, expect, it } from "vitest"

import {
  accountActivate,
  accountDeactivate,
  bestOfDuelDelete,
  competitionDelete,
  competitionDeleteBlocked,
  competitionForceDelete,
  competitionStatus,
  CONFIRM_COMPETITION_NAME,
  CONFIRM_LAST_NAME,
  type Decision,
  disciplineDelete,
  eventSeriesDelete,
  FORCE_DELETE_SECTION,
  leaveUnsaved,
  nextRound,
  participantActivate,
  participantDeactivate,
  participantDelete,
  participantDeleteBlocked,
  participantForceDelete,
  playoffDuelDelete,
  playoffsStart,
  RINGWERK_OLD_WORDS,
  scheduleGenerate,
  scheduleRegenerate,
  seasonSeriesDelete,
  unenroll,
  unenrollBlocked,
  withdrawalRevoke,
} from "./consequences"

const texts = (decision: Decision) => [
  decision.title,
  decision.about,
  decision.check ?? "",
  ...decision.happens,
  ...decision.notHappening,
  decision.undo,
  decision.confirmLabel,
]

const duel = {
  nameA: "Anna Birke",
  nameB: "Bert Eiche",
  winsA: 2,
  winsB: 1,
}

/** alle Dialoge in allen Fällen, die ihr Wortlaut kennt */
const ALL: Decision[] = [
  eventSeriesDelete({ name: "Anna Birke", teams: false }),
  eventSeriesDelete({ name: "Anna Birke", teams: true }),
  seasonSeriesDelete({ name: "Anna Birke", date: "12.10.2026", minSeries: null }),
  seasonSeriesDelete({ name: "Anna Birke", date: "12.10.2026", minSeries: 10 }),
  participantDelete({ name: "Anna Birke" }),
  participantForceDelete({ name: "Anna Birke", competitions: 1 }),
  participantForceDelete({ name: "Anna Birke", competitions: 3 }),
  participantDeactivate({ name: "Anna Birke" }),
  participantActivate({ name: "Anna Birke" }),
  withdrawalRevoke({ name: "Anna Birke", since: "12.10.2026" }),
  withdrawalRevoke({ name: "Anna Birke", since: null }),
  unenroll({ name: "Anna Birke", guest: false, results: 0, team: null }),
  unenroll({ name: "Anna Birke", guest: false, results: 0, team: 2 }),
  unenroll({ name: "Anna", guest: true, results: 2, team: null }),
  disciplineDelete({ name: "Luftgewehr Auflage", system: false }),
  disciplineDelete({ name: "Luftgewehr", system: true }),
  ...(["complete", "reopen", "archive", "restore"] as const).flatMap((change) => [
    competitionStatus(change, { name: "Rundenwettkampf 2026", publicSlug: null }),
    competitionStatus(change, { name: "Rundenwettkampf 2026", publicSlug: "rwk-2026" }),
  ]),
  competitionForceDelete({ name: "Rundenwettkampf 2026", isPublic: false }),
  competitionForceDelete({ name: "Rundenwettkampf 2026", isPublic: true }),
  competitionDelete({ name: "Rundenwettkampf 2026" }),
  scheduleGenerate({ leagueFormat: "DOUBLE_ROUND_ROBIN" }),
  scheduleGenerate({ leagueFormat: "BEST_OF_SINGLE" }),
  scheduleRegenerate(),
  playoffsStart({ name: "Rundenwettkampf 2026", round: "Achtelfinale", active: 20 }),
  playoffsStart({ name: "Rundenwettkampf 2026", round: "Viertelfinale", active: 11 }),
  playoffsStart({ name: "Rundenwettkampf 2026", round: "Halbfinale", active: 4 }),
  nextRound({ round: "Viertelfinale", previous: "Achtelfinale" }),
  nextRound({ round: "Halbfinale", previous: "Viertelfinale" }),
  nextRound({ round: "Finale", previous: "Halbfinale" }),
  playoffDuelDelete({
    ...duel,
    duel: 3,
    round: "Halbfinale",
    next: "Finale",
    entered: true,
    decided: true,
  }),
  playoffDuelDelete({
    ...duel,
    duel: 3,
    round: "Viertelfinale",
    next: "Halbfinale",
    entered: false,
    decided: false,
  }),
  playoffDuelDelete({
    ...duel,
    duel: 2,
    round: "Finale",
    next: null,
    entered: true,
    decided: true,
  }),
  bestOfDuelDelete({ ...duel, duel: 3, tiebreak: false }),
  bestOfDuelDelete({ ...duel, duel: 4, tiebreak: true }),
  accountDeactivate({ name: "Erika Muster", email: "erika@example.org" }),
  accountDeactivate({ name: null, email: "erika@example.org" }),
  accountActivate({ name: "Erika Muster", email: "erika@example.org" }),
  leaveUnsaved(),
]

const NOTICES = [
  participantDeleteBlocked({ name: "Anna Birke", competitions: 1 }),
  participantDeleteBlocked({ name: "Anna Birke", competitions: 3 }),
  competitionDeleteBlocked({ name: "Rundenwettkampf 2026", participants: 1 }),
  competitionDeleteBlocked({ name: "Rundenwettkampf 2026", participants: 6 }),
  unenrollBlocked({ name: "Anna Birke", results: 1 }),
  unenrollBlocked({ name: "Anna Birke", results: 2 }),
  unenrollBlocked({ name: "Anna Birke", results: 1, withdrawn: true }),
  unenrollBlocked({ name: "Anna Birke", results: 2, withdrawn: true }),
]

const LABELS = [
  CONFIRM_LAST_NAME,
  CONFIRM_COMPETITION_NAME,
  FORCE_DELETE_SECTION.title,
  FORCE_DELETE_SECTION.text,
  FORCE_DELETE_SECTION.button,
]

describe("Schreibregeln", () => {
  it("kein Semikolon, keine drei Punkte, keins der alten Wörter", () => {
    expect(
      forbiddenIn(
        [...ALL.flatMap(texts), ...NOTICES.flatMap((n) => [n.title, n.text]), ...LABELS],
        RINGWERK_OLD_WORDS
      )
    ).toEqual([])
  })

  it("jeder Dialog sagt, worum es geht, was passiert und wie es zurückgeht", () => {
    for (const decision of ALL) {
      expect(decision.title).toMatch(/\?$/)
      expect(decision.about).not.toBe("")
      expect(decision.happens.length).toBeGreaterThan(0)
      expect(decision.undo).not.toBe("")
      expect(texts(decision).join(" ")).not.toMatch(/undefined|null|NaN|\{|\}/)
    }
  })

  it("nur „Konto wieder aktivieren“ hat nichts, was ausdrücklich nicht passiert (Textbuch 15)", () => {
    const without = ALL.filter((d) => d.notHappening.length === 0).map((d) => d.title)
    expect(without).toEqual(["Konto von Erika Muster wieder aktivieren?"])
  })

  it("die alten Texte fallen durch", () => {
    expect(
      forbiddenIn(
        [
          "Diese Aktion kann nicht rückgängig gemacht werden.",
          "Nutzer deaktivieren?",
          "Teilnehmer endgültig löschen?",
          "Gefahrenzone",
          "Force-Delete ist nur für Admins möglich.",
          "Die K.O.-Phase wird basierend auf der aktuellen Tabelle gestartet.",
          "Wettbewerb „x“ wirklich löschen?",
        ],
        RINGWERK_OLD_WORDS
      )
    ).toHaveLength(7)
  })
})

describe("Wortlaut wie im Textbuch", () => {
  it("1 Ergebnis im Event löschen, mit Teams", () => {
    expect(eventSeriesDelete({ name: "Anna Birke", teams: true })).toEqual({
      title: "Ergebnis von Anna Birke löschen?",
      about: "Für Anna Birke ist in diesem Event ein Ergebnis eingetragen.",
      happens: [
        "Das Ergebnis verschwindet aus der Rangliste. Die Plätze werden ohne es neu berechnet.",
        "Auch die Teamwertung rechnet ohne dieses Ergebnis.",
        "Im Protokoll des Wettbewerbs steht danach, dass das Ergebnis gelöscht wurde, mit Ringen und Teiler.",
      ],
      notHappening: [
        "Anna Birke bleibt eingeschrieben und kann ein neues Ergebnis bekommen.",
        "Die anderen Ergebnisse bleiben.",
      ],
      undo: "Nicht möglich. Das Ergebnis lässt sich neu eintragen. Ringe und Teiler stehen im Protokoll.",
      confirmLabel: "Ergebnis löschen",
      destructive: true,
    })
    expect(eventSeriesDelete({ name: "x", teams: false }).happens).toHaveLength(2)
  })

  it("2 Serie in der Saison löschen, Mindestzahl nur, wenn sie gilt", () => {
    const decision = seasonSeriesDelete({ name: "Anna Birke", date: "12.10.2026", minSeries: 10 })
    expect(decision.title).toBe("Serie vom 12.10.2026 löschen?")
    expect(decision.about).toBe(
      "Anna Birke hat am 12.10.2026 diese Serie geschossen. Sie zählt in der Saison."
    )
    expect(decision.happens[1]).toBe(
      "Gelten 10 Serien als Mindestzahl und hat Anna Birke danach weniger, steht Anna Birke ohne Platz in der Rangliste."
    )
    expect(seasonSeriesDelete({ name: "x", date: "y", minSeries: null }).happens).toHaveLength(2)
  })

  it("3 Teilnehmer löschen: ohne Wettbewerb, Hinweis für die Sportleitung, mit allen Daten", () => {
    expect(participantDelete({ name: "Anna Birke" })).toMatchObject({
      title: "Anna Birke löschen?",
      about: "Anna Birke ist inaktiv und in keinem Wettbewerb eingetragen.",
      confirmLabel: "Teilnehmer löschen",
    })
    expect(participantDeleteBlocked({ name: "Anna Birke", competitions: 3 })).toEqual({
      title: "Anna Birke lässt sich hier nicht löschen",
      text: "Anna Birke ist in 3 Wettbewerben eingetragen. Damit Tabellen und Ergebnisse dort stimmen, löscht nur ein Admin so einen Teilnehmer, mit allen Daten. Als inaktiv steht Anna Birke bei neuen Wettbewerben schon nicht mehr zur Auswahl.",
    })
    expect(participantForceDelete({ name: "Anna Birke", competitions: 3 })).toEqual({
      title: "Anna Birke mit allen Daten löschen?",
      about: "Anna Birke ist inaktiv und in 3 Wettbewerben eingetragen.",
      check:
        "Läuft einer dieser Wettbewerbe noch? Dann ändern sich dort Tabelle, Spielplan und Playoffs. Meist genügt es, Anna Birke inaktiv zu lassen. Dann bleiben die alten Ergebnisse stehen.",
      happens: [
        "Anna Birke verschwindet aus der Teilnehmerliste und aus allen 3 Wettbewerben.",
        "Alle Serien und Ergebnisse von Anna Birke werden gelöscht.",
        "Liga-Paarungen mit Anna Birke werden gelöscht, mit den Serien der Gegner. Die Tabellen rechnen ohne diese Paarungen.",
        "Playoff-Paarungen mit Anna Birke werden mit allen Duellen gelöscht.",
        "Im Protokoll unter „Admin“ steht danach, dass Anna Birke mit allen Daten gelöscht wurde.",
      ],
      notHappening: [
        "Die Wettbewerbe bleiben. Die anderen Teilnehmer bleiben eingeschrieben.",
        "Frühere Einträge im Protokoll bleiben.",
      ],
      undo: "Nicht möglich. Auch die Serien der Gegner kommen nicht zurück.",
      confirmLabel: "Mit allen Daten löschen",
      destructive: true,
    })
    expect(CONFIRM_LAST_NAME).toBe("Zur Bestätigung den Nachnamen eingeben:")
  })

  it("4 Teilnehmer deaktivieren warnt, aktivieren nicht", () => {
    expect(participantDeactivate({ name: "Anna Birke" })).toMatchObject({
      check:
        "Ist Anna Birke in einem laufenden Wettbewerb noch aktiv eingeschrieben? Dann geht das nicht. Zuerst dort zurückziehen.",
      destructive: true,
    })
    expect(participantActivate({ name: "Anna Birke" }).destructive).toBe(false)
  })

  it("5 Rückzug zurücknehmen nennt den Tag, wenn er bekannt ist", () => {
    expect(withdrawalRevoke({ name: "Anna Birke", since: "12.10.2026" }).about).toBe(
      "Anna Birke ist seit dem 12.10.2026 aus diesem Wettbewerb zurückgezogen."
    )
    expect(withdrawalRevoke({ name: "Anna Birke", since: null }).about).toBe(
      "Anna Birke ist aus diesem Wettbewerb zurückgezogen."
    )
  })

  it("6 Entfernen: Gast mit Ergebnissen, Mitglied im Team ohne Ergebnis", () => {
    expect(unenroll({ name: "Anna", guest: true, results: 2, team: null })).toMatchObject({
      about: "Anna ist in diesem Wettbewerb eingeschrieben. Es gibt 2 Ergebnisse.",
      happens: [
        "Die Einschreibung wird gelöscht. Anna verschwindet aus den Seiten des Wettbewerbs.",
        "Der Gast und die Ergebnisse werden gelöscht.",
        "Im Protokoll des Wettbewerbs steht danach ein Eintrag.",
      ],
      notHappening: ["Andere Teilnehmer und ihre Ergebnisse bleiben."],
      undo: "Den Gast neu anlegen und die Ergebnisse neu eintragen.",
    })
    expect(unenroll({ name: "Anna Birke", guest: false, results: 0, team: 2 })).toMatchObject({
      about: "Anna Birke ist in diesem Wettbewerb eingeschrieben.",
      happens: [
        "Die Einschreibung wird gelöscht. Anna Birke verschwindet aus den Seiten des Wettbewerbs.",
        "Ist Team 2 danach leer, wird es aufgelöst.",
        "Im Protokoll des Wettbewerbs steht danach ein Eintrag.",
      ],
      notHappening: ["Anna Birke bleibt unter „Teilnehmer“ und in anderen Wettbewerben."],
      undo: "Neu einschreiben.",
      confirmLabel: "Aus dem Wettbewerb entfernen",
    })
  })

  it("6b Mitglied mit Ergebnissen: nur ein Hinweis, Einzahl und Mehrzahl", () => {
    expect(unenrollBlocked({ name: "Anna Birke", results: 2 })).toEqual({
      title: "Anna Birke lässt sich nicht entfernen",
      text: "Anna Birke hat in diesem Wettbewerb schon 2 Ergebnisse. Damit sie nicht verloren gehen, lässt sich Anna Birke nur zurückziehen. Dann zählen die Ergebnisse nicht mehr, bleiben aber gespeichert.",
    })
    expect(unenrollBlocked({ name: "Anna Birke", results: 1 }).text).toBe(
      "Anna Birke hat in diesem Wettbewerb schon 1 Ergebnis. Damit es nicht verloren geht, lässt sich Anna Birke nur zurückziehen. Dann zählt das Ergebnis nicht mehr, bleibt aber gespeichert."
    )
  })

  it("6c schon zurückgezogen: kein „nur zurückziehen“", () => {
    expect(unenrollBlocked({ name: "Anna Birke", results: 2, withdrawn: true })).toEqual({
      title: "Anna Birke lässt sich nicht entfernen",
      text: "Anna Birke ist aus diesem Wettbewerb zurückgezogen und hat schon 2 Ergebnisse. Die Ergebnisse zählen nicht mehr, bleiben aber gespeichert. Damit sie nicht verloren gehen, bleibt Anna Birke als zurückgezogen eingetragen.",
    })
    expect(unenrollBlocked({ name: "Anna Birke", results: 1, withdrawn: true }).text).toBe(
      "Anna Birke ist aus diesem Wettbewerb zurückgezogen und hat schon 1 Ergebnis. Das Ergebnis zählt nicht mehr, bleibt aber gespeichert. Damit es nicht verloren geht, bleibt Anna Birke als zurückgezogen eingetragen."
    )
  })

  it("7 Disziplin löschen: auch einzelne Teilnehmer sperren", () => {
    expect(disciplineDelete({ name: "Luftgewehr Auflage", system: false }).check).toBe(
      "Löschen kann nur ein Admin. Wird die Disziplin in einem Wettbewerb verwendet, auch nur für einzelne Teilnehmer, geht das nicht. Dann archiviere sie."
    )
  })

  it("7 Systemdisziplin kommt beim nächsten Start wieder", () => {
    expect(disciplineDelete({ name: "Luftgewehr", system: true }).happens).toEqual([
      "Die Disziplin verschwindet unter „Disziplinen“ und aus der Auswahl bei neuen Wettbewerben.",
      "Beim nächsten Start legt Ringwerk sie wieder an.",
      "Im Protokoll unter „Admin“ steht danach ein Eintrag.",
    ])
  })

  it("8 Status: Knöpfe sagen, was passiert, öffentliche Adresse nur, wenn öffentlich", () => {
    const labels = (["complete", "reopen", "archive", "restore"] as const).map(
      (c) => competitionStatus(c, { name: "x", publicSlug: null }).confirmLabel
    )
    expect(labels).toEqual(["Abschließen", "Wieder öffnen", "Archivieren", "Wiederherstellen"])
    expect(competitionStatus("reopen", { name: "x", publicSlug: "rwk-2026" }).check).toBe(
      "Läuft schon ein anderer Wettbewerb unter der Adresse „rwk-2026“? Dann geht das nicht."
    )
    expect(competitionStatus("reopen", { name: "x", publicSlug: null }).check).toBeUndefined()
    expect(competitionStatus("complete", { name: "x", publicSlug: null }).happens).toHaveLength(3)
  })

  it("9 Wettbewerb mit allen Daten löschen nennt das Protokoll", () => {
    expect(competitionForceDelete({ name: "Rundenwettkampf 2026", isPublic: true })).toEqual({
      title: "„Rundenwettkampf 2026“ mit allen Daten löschen?",
      about: "In „Rundenwettkampf 2026“ stehen Einschreibungen, Ergebnisse und das Protokoll.",
      check: "Wird der Wettbewerb noch gebraucht, auch zum Nachschauen? Archivieren behält alles.",
      happens: [
        "Der Wettbewerb verschwindet aus der Liste.",
        "Gelöscht werden Einschreibungen, Teams, Spielplan, alle Serien und Ergebnisse, die Playoffs mit allen Duellen.",
        "Auch das Protokoll des Wettbewerbs wird gelöscht. Danach lässt sich nicht mehr sehen, wer was eingetragen hat.",
        "Der öffentliche Link führt nicht mehr zu diesem Wettbewerb.",
      ],
      notHappening: [
        "Die Teilnehmer bleiben unter „Teilnehmer“ und in anderen Wettbewerben. Die Disziplin bleibt.",
      ],
      undo: "Nicht möglich. Nur eine Sicherung des Servers hat die Daten noch.",
      confirmLabel: "Mit allen Daten löschen",
      destructive: true,
    })
    expect(FORCE_DELETE_SECTION.button).toBe("Wettbewerb mit allen Daten löschen")
  })

  it("10 Wettbewerb löschen: leer, sonst nur ein Hinweis", () => {
    expect(competitionDelete({ name: "Rundenwettkampf 2026" }).about).toBe(
      "In „Rundenwettkampf 2026“ ist niemand eingeschrieben."
    )
    expect(competitionDeleteBlocked({ name: "Rundenwettkampf 2026", participants: 6 }).text).toBe(
      "In „Rundenwettkampf 2026“ sind 6 Teilnehmer eingeschrieben. So ein Wettbewerb wird archiviert, nicht gelöscht. Ein Admin kann ihn unter „Bearbeiten“ mit allen Daten löschen."
    )
  })

  it("11 Playoffs starten: Setzung je erster Runde", () => {
    const vf = playoffsStart({ name: "Rundenwettkampf 2026", round: "Viertelfinale", active: 11 })
    expect(vf.about).toBe(
      "Die Gruppenphase ist fertig. Die besten 8 von 11 aktiven Teilnehmern kommen ins Viertelfinale."
    )
    expect(vf.happens[0]).toBe(
      "Ringwerk legt das Viertelfinale an. Platz 1 trifft auf Platz 8, Platz 2 auf Platz 7 und so weiter."
    )
    expect(playoffsStart({ name: "x", round: "Halbfinale", active: 4 }).happens[0]).toBe(
      "Ringwerk legt das Halbfinale an. Platz 1 trifft auf Platz 4, Platz 2 auf Platz 3."
    )
    expect(vf.undo).toBe("Nicht möglich.")
  })

  it("6, 12, 16: das Protokoll bekommt einen Eintrag", () => {
    const decisions = [
      unenroll({ name: "x", guest: false, results: 0, team: null }),
      nextRound({ round: "Halbfinale", previous: "Viertelfinale" }),
      scheduleGenerate({ leagueFormat: "DOUBLE_ROUND_ROBIN" }),
      scheduleRegenerate(),
    ]
    for (const decision of decisions) {
      expect(decision.happens).toContain("Im Protokoll des Wettbewerbs steht danach ein Eintrag.")
      expect(texts(decision).join(" ")).not.toContain("Das Protokoll bekommt keinen Eintrag")
    }
  })

  it("12 nächste Runde: „anlegen“ steht einmal", () => {
    const hf = nextRound({ round: "Halbfinale", previous: "Viertelfinale" })
    expect(hf.title).toBe("Halbfinale anlegen?")
    expect(hf.confirmLabel).toBe("Halbfinale anlegen")
    expect(nextRound({ round: "Finale", previous: "Halbfinale" }).happens[0]).toBe(
      "Im Finale treffen die Sieger der beiden Halbfinale aufeinander."
    )
  })

  it("13 Duell in den Playoffs löschen: Folgerunde nur außerhalb des Finales", () => {
    const sf = playoffDuelDelete({
      ...duel,
      duel: 3,
      round: "Halbfinale",
      next: "Finale",
      entered: true,
      decided: true,
    })
    expect(sf.title).toBe("Duell 3 im Halbfinale löschen?")
    expect(sf.about).toBe(
      "Anna Birke gegen Bert Eiche steht 2 : 1. Duell 3 ist das letzte dieser Paarung. Sein Ergebnis ist eingetragen."
    )
    expect(sf.check).toBe(
      "Hat das Finale schon ein Duell, geht das nicht. Dann zuerst dort die Duelle löschen."
    )
    expect(sf.happens).toContain(
      "Ist das Finale schon angelegt, entfernt Ringwerk es. Es entsteht neu mit „Finale anlegen“."
    )
    const final = playoffDuelDelete({
      ...duel,
      duel: 2,
      round: "Finale",
      next: null,
      entered: true,
      decided: true,
    })
    expect(final.check).toBeUndefined()
    expect(final.happens).toHaveLength(3)
  })

  it("14 Best-of: Duell oder Stechschuss zurücknehmen", () => {
    expect(bestOfDuelDelete({ ...duel, duel: 4, tiebreak: true })).toMatchObject({
      title: "Stechschuss zurücknehmen?",
      about: "Anna Birke gegen Bert Eiche steht 2 : 1. Zuletzt eingetragen ist der Stechschuss.",
      confirmLabel: "Stechschuss zurücknehmen",
    })
    expect(bestOfDuelDelete({ ...duel, duel: 3, tiebreak: false }).confirmLabel).toBe(
      "Duell zurücknehmen"
    )
  })

  it("15 Konto ohne Namen mit der E-Mail-Adresse", () => {
    expect(accountDeactivate({ name: null, email: "erika@example.org" }).title).toBe(
      "Konto von erika@example.org deaktivieren?"
    )
  })

  it("16 Spielplan je Format, neu generieren warnt", () => {
    expect(scheduleGenerate({ leagueFormat: "BEST_OF_SINGLE" }).happens[0]).toBe(
      "Ringwerk erstellt eine Runde, jeder gegen jeden."
    )
    expect(scheduleGenerate({ leagueFormat: "DOUBLE_ROUND_ROBIN" }).happens[0]).toBe(
      "Ringwerk erstellt Hin- und Rückrunde, jeder gegen jeden."
    )
    expect(scheduleGenerate({ leagueFormat: "DOUBLE_ROUND_ROBIN" }).destructive).toBe(false)
    expect(scheduleRegenerate()).toMatchObject({
      confirmLabel: "Spielplan neu generieren",
      destructive: true,
    })
  })

  it("17 Ohne Speichern verlassen wie in Treffsicher", () => {
    expect(leaveUnsaved()).toMatchObject({
      title: "Ohne Speichern verlassen?",
      confirmLabel: "Verwerfen",
    })
  })
})
