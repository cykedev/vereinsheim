// Folgen jeder Aktion in Alltagsworten: „Kein Knopf ohne Folge“. Eine Quelle für Dialoge und Tests; die Komponenten
// erfinden keine Texte. Ohne Pronomen für die Personen, um die es geht; nur „Ohne Speichern verlassen“ spricht wie in
// Treffsicher den Bediener an. Reine Funktionen.
//
// Der Wortlaut ist im Textbuch freigegeben (vault/_attachments/textbuch-ringwerk-treffsicher.md, Abschnitt „Ringwerk:
// Folgen vor dem Bestätigen“) und folgt den Schreibregeln ([[conventions]] §10). Die Folgen sind aus den Actions
// abgelesen: was kaskadierend gelöscht wird, was im Protokoll bleibt, was danach gesperrt ist. Ein Test hält die alten
// Wörter fern (`consequences.test.ts`).

import { forbiddenWords } from "@vereinsheim/lib/wording"
import type { Decision } from "@vereinsheim/ui/design2/decision-dialog"
import type { LeagueFormat } from "@/generated/prisma/client"

export type { Decision }

/** ein Hinweis statt einer Entscheidung, wenn die Aktion hier nicht geht (`NoticeDialog`) */
export interface Notice {
  title: string
  text: string
}

/** was in keinem Dialog mehr stehen darf: die Grundregel und die alten Wörter der Dialoge */
export const RINGWERK_OLD_WORDS = forbiddenWords(
  /\bNutzer|\bAccount|einloggen|endgültig|dauerhaft|unwiderruflich|Force-Delete|Gefahrenzone|Audit|K\.O\.-Phase|wirklich löschen|kann nicht rückgängig gemacht werden/
)

const count = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`)

// ---------------------------------------------------------------------------------------------------------------------
// Ergebnisse

export function eventSeriesDelete({ name, teams }: { name: string; teams: boolean }): Decision {
  return {
    title: `Ergebnis von ${name} löschen?`,
    about: `Für ${name} ist in diesem Event ein Ergebnis eingetragen.`,
    happens: [
      "Das Ergebnis verschwindet aus der Rangliste. Die Plätze werden ohne es neu berechnet.",
      ...(teams ? ["Auch die Teamwertung rechnet ohne dieses Ergebnis."] : []),
      "Im Protokoll des Wettbewerbs steht danach, dass das Ergebnis gelöscht wurde, mit Ringen und Teiler.",
    ],
    notHappening: [
      `${name} bleibt eingeschrieben und kann ein neues Ergebnis bekommen.`,
      "Die anderen Ergebnisse bleiben.",
    ],
    undo: "Nicht möglich. Das Ergebnis lässt sich neu eintragen. Ringe und Teiler stehen im Protokoll.",
    confirmLabel: "Ergebnis löschen",
    destructive: true,
  }
}

export function seasonSeriesDelete({
  name,
  date,
  minSeries,
}: {
  name: string
  /** Tag der Serie, wie in der Liste („12.10.2026“) */
  date: string
  /** Mindestzahl an Serien für einen Platz, `null` ohne */
  minSeries: number | null
}): Decision {
  return {
    title: `Serie vom ${date} löschen?`,
    about: `${name} hat am ${date} diese Serie geschossen. Sie zählt in der Saison.`,
    happens: [
      "Die Serie verschwindet. Die Rangliste rechnet ohne sie.",
      ...(minSeries !== null
        ? [
            `Gelten ${minSeries} Serien als Mindestzahl und hat ${name} danach weniger, steht ${name} ohne Platz in der Rangliste.`,
          ]
        : []),
      "Im Protokoll des Wettbewerbs steht danach, dass die Serie gelöscht wurde, mit Datum, Ringen und Teiler.",
    ],
    notHappening: [`Die anderen Serien von ${name} bleiben.`],
    undo: "Nicht möglich. Die Serie lässt sich neu eintragen. Datum, Ringe und Teiler stehen im Protokoll.",
    confirmLabel: "Serie löschen",
    destructive: true,
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Teilnehmer

/** Teilnehmer ohne Wettbewerb löschen (3a) */
export function participantDelete({ name }: { name: string }): Decision {
  return {
    title: `${name} löschen?`,
    about: `${name} ist inaktiv und in keinem Wettbewerb eingetragen.`,
    happens: [
      `${name} verschwindet aus der Teilnehmerliste.`,
      "Im Protokoll unter „Admin“ steht danach ein Eintrag mit dem Namen.",
    ],
    notHappening: ["Kein Wettbewerb ändert sich."],
    undo: `Nicht möglich. ${name} lässt sich neu anlegen.`,
    confirmLabel: "Teilnehmer löschen",
    destructive: true,
  }
}

/** Teilnehmer mit Wettbewerben, Sportleitung: nur ein Hinweis (3b) */
export function participantDeleteBlocked({
  name,
  competitions,
}: {
  name: string
  competitions: number
}): Notice {
  return {
    title: `${name} lässt sich hier nicht löschen`,
    text:
      `${name} ist in ${count(competitions, "Wettbewerb", "Wettbewerben")} eingetragen. Damit Tabellen und ` +
      "Ergebnisse dort stimmen, löscht nur ein Admin so einen Teilnehmer, mit allen Daten. Als inaktiv steht " +
      `${name} bei neuen Wettbewerben schon nicht mehr zur Auswahl.`,
  }
}

/** Teilnehmer mit Wettbewerben, Admin: mit allen Daten löschen (3c) */
export function participantForceDelete({
  name,
  competitions,
}: {
  name: string
  competitions: number
}): Decision {
  const where = count(competitions, "Wettbewerb", "Wettbewerben")
  return {
    title: `${name} mit allen Daten löschen?`,
    about: `${name} ist inaktiv und in ${where} eingetragen.`,
    check:
      "Läuft einer dieser Wettbewerbe noch? Dann ändern sich dort Tabelle, Spielplan und Playoffs. Meist genügt es, " +
      `${name} inaktiv zu lassen. Dann bleiben die alten Ergebnisse stehen.`,
    happens: [
      competitions === 1
        ? `${name} verschwindet aus der Teilnehmerliste und aus dem Wettbewerb.`
        : `${name} verschwindet aus der Teilnehmerliste und aus allen ${competitions} Wettbewerben.`,
      `Alle Serien und Ergebnisse von ${name} werden gelöscht.`,
      `Liga-Paarungen mit ${name} werden gelöscht, mit den Serien der Gegner. Die Tabellen rechnen ohne diese Paarungen.`,
      `Playoff-Paarungen mit ${name} werden mit allen Duellen gelöscht.`,
      `Im Protokoll unter „Admin“ steht danach, dass ${name} mit allen Daten gelöscht wurde.`,
    ],
    notHappening: [
      "Die Wettbewerbe bleiben. Die anderen Teilnehmer bleiben eingeschrieben.",
      "Frühere Einträge im Protokoll bleiben.",
    ],
    undo: "Nicht möglich. Auch die Serien der Gegner kommen nicht zurück.",
    confirmLabel: "Mit allen Daten löschen",
    destructive: true,
  }
}

/** Beschriftung des Feldes, in das zur Bestätigung der Nachname getippt wird */
export const CONFIRM_LAST_NAME = "Zur Bestätigung den Nachnamen eingeben:"

export function participantDeactivate({ name }: { name: string }): Decision {
  return {
    title: `${name} deaktivieren?`,
    about: `${name} ist aktiv und steht beim Einschreiben in Wettbewerbe zur Auswahl.`,
    check: `Ist ${name} in einem laufenden Wettbewerb noch aktiv eingeschrieben? Dann geht das nicht. Zuerst dort zurückziehen.`,
    happens: [
      `Beim Einschreiben steht ${name} nicht mehr zur Auswahl.`,
      `In der Teilnehmerliste lässt sich ${name} danach löschen.`,
      "Im Protokoll unter „Admin“ steht danach ein Eintrag.",
    ],
    notHappening: ["Einschreibungen und Ergebnisse bleiben, auch in abgeschlossenen Wettbewerben."],
    undo: "Unter „Teilnehmer“ mit „Aktivieren“.",
    confirmLabel: "Deaktivieren",
    destructive: true,
  }
}

export function participantActivate({ name }: { name: string }): Decision {
  return {
    title: `${name} wieder aktivieren?`,
    about: `${name} ist inaktiv.`,
    happens: [
      `Beim Einschreiben steht ${name} wieder zur Auswahl.`,
      "Im Protokoll unter „Admin“ steht danach ein Eintrag.",
    ],
    notHappening: ["In bestehenden Wettbewerben ändert sich nichts."],
    undo: "Mit „Deaktivieren“.",
    confirmLabel: "Aktivieren",
    destructive: false,
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Einschreibung in einen Wettbewerb

export function withdrawalRevoke({
  name,
  since,
}: {
  name: string
  /** Tag des Rückzugs („12.10.2026“), `null`, wenn unbekannt */
  since: string | null
}): Decision {
  return {
    title: `Rückzug von ${name} zurücknehmen?`,
    about: since
      ? `${name} ist seit dem ${since} aus diesem Wettbewerb zurückgezogen.`
      : `${name} ist aus diesem Wettbewerb zurückgezogen.`,
    happens: [
      `${name} ist im Wettbewerb wieder aktiv.`,
      `Paarungen und Ergebnisse von ${name} zählen wieder in Tabelle und Rangliste, auch die schon gespielten.`,
      "Im Protokoll des Wettbewerbs steht danach ein Eintrag.",
    ],
    notHappening: [
      "Der Spielplan ändert sich nicht.",
      "Der Eintrag zum Rückzug bleibt im Protokoll.",
    ],
    undo: "Mit „Zurückziehen“, solange die Playoffs nicht gestartet sind.",
    confirmLabel: "Rückzug zurücknehmen",
    destructive: false,
  }
}

/** Entfernen aus dem Wettbewerb: für Mitglieder ohne Ergebnisse und für Gäste (Mitglieder mit Ergebnissen: `unenrollBlocked`) */
export function unenroll({
  name,
  guest,
  results,
  team,
}: {
  /** bei Gästen nur der Vorname, wie in der Liste */
  name: string
  guest: boolean
  /** Zahl der Ergebnisse in diesem Wettbewerb */
  results: number
  /** Nummer des Teams, `null` ohne Team */
  team: number | null
}): Decision {
  return {
    title: `${name} aus dem Wettbewerb entfernen?`,
    about:
      guest && results > 0
        ? `${name} ist in diesem Wettbewerb eingeschrieben. Es gibt ${count(results, "Ergebnis", "Ergebnisse")}.`
        : `${name} ist in diesem Wettbewerb eingeschrieben.`,
    check: `Steht ${name} schon im Spielplan, geht das nicht. Dann „Zurückziehen“ nutzen.`,
    happens: [
      `Die Einschreibung wird gelöscht. ${name} verschwindet aus den Seiten des Wettbewerbs.`,
      ...(guest ? ["Der Gast und die Ergebnisse werden gelöscht."] : []),
      ...(team !== null ? [`Ist Team ${team} danach leer, wird es aufgelöst.`] : []),
      "Im Protokoll des Wettbewerbs steht danach ein Eintrag.",
    ],
    notHappening: [
      guest
        ? "Andere Teilnehmer und ihre Ergebnisse bleiben."
        : `${name} bleibt unter „Teilnehmer“ und in anderen Wettbewerben.`,
    ],
    undo: guest ? "Den Gast neu anlegen und die Ergebnisse neu eintragen." : "Neu einschreiben.",
    confirmLabel: "Aus dem Wettbewerb entfernen",
    destructive: true,
  }
}

/** Mitglied mit Ergebnissen: nur ein Hinweis, die Action lehnt ab (6b; schon zurückgezogen: 6c) */
export function unenrollBlocked({
  name,
  results,
  withdrawn = false,
}: {
  name: string
  results: number
  /** schon aus dem Wettbewerb zurückgezogen */
  withdrawn?: boolean
}): Notice {
  const one = results === 1
  const title = `${name} lässt sich nicht entfernen`
  if (withdrawn)
    return {
      title,
      text: one
        ? `${name} ist aus diesem Wettbewerb zurückgezogen und hat schon 1 Ergebnis. Das Ergebnis zählt nicht mehr, bleibt aber gespeichert. Damit es nicht verloren geht, bleibt ${name} als zurückgezogen eingetragen.`
        : `${name} ist aus diesem Wettbewerb zurückgezogen und hat schon ${results} Ergebnisse. Die Ergebnisse zählen nicht mehr, bleiben aber gespeichert. Damit sie nicht verloren gehen, bleibt ${name} als zurückgezogen eingetragen.`,
    }
  return {
    title,
    text: one
      ? `${name} hat in diesem Wettbewerb schon 1 Ergebnis. Damit es nicht verloren geht, lässt sich ${name} nur zurückziehen. Dann zählt das Ergebnis nicht mehr, bleibt aber gespeichert.`
      : `${name} hat in diesem Wettbewerb schon ${results} Ergebnisse. Damit sie nicht verloren gehen, lässt sich ${name} nur zurückziehen. Dann zählen die Ergebnisse nicht mehr, bleiben aber gespeichert.`,
  }
}

/** Saison mit Mindestzahl: eine Einschreibung ab der ersten Serie werten (Textbuch „Saison ohne Mindestzahl“ 3) */
export function minSeriesExemptionSet({
  name,
  minSeries,
  seriesCount,
}: {
  name: string
  /** Mindestzahl der Saison */
  minSeries: number
  /** Serien, die schon erfasst sind */
  seriesCount: number
}): Decision {
  return {
    title: `${name} ohne Mindestzahl werten?`,
    about: `${name} ist in dieser Saison eingeschrieben. Für einen Platz braucht es ${minSeries} Serien.`,
    check: `Gilt für ${name} eine Ausnahme? Etwa, weil ${name} zur Jugend gehört.`,
    happens: [
      `${name} steht ab der ersten Serie mit Platz in der Rangliste.`,
      `In der Spalte „Serien“ steht dann ${seriesCount}/1 statt ${seriesCount}/${minSeries}, in der App und im PDF.`,
      "Im Protokoll des Wettbewerbs steht die Änderung.",
    ],
    notHappening: [
      `Die Serien von ${name} bleiben, wie sie sind.`,
      "Für alle anderen gilt die Mindestzahl weiter.",
      "Andere Saisons ändern sich nicht.",
    ],
    undo: "Jederzeit über denselben Knopf in der Teilnehmerverwaltung.",
    confirmLabel: "Ohne Mindestzahl werten",
    destructive: false,
  }
}

/** Saison mit Mindestzahl: die Ausnahme zurücknehmen (Textbuch „Saison ohne Mindestzahl“ 4) */
export function minSeriesExemptionUnset({
  name,
  minSeries,
  seriesCount,
}: {
  name: string
  /** Mindestzahl der Saison */
  minSeries: number
  /** Serien, die schon erfasst sind */
  seriesCount: number
}): Decision {
  return {
    title: `Für ${name} wieder ${minSeries} Serien verlangen?`,
    about: `${name} wird in dieser Saison ohne Mindestzahl gewertet. Bisher zählt jede Serie ab der ersten.`,
    happens: [
      `Für einen Platz braucht ${name} dann ${minSeries} Serien wie alle anderen.`,
      ...(seriesCount < minSeries
        ? [
            `${name} hat ${count(seriesCount, "Serie", "Serien")} und steht danach ohne Platz in der Rangliste.`,
          ]
        : []),
      "Im Protokoll des Wettbewerbs steht die Änderung.",
    ],
    notHappening: [`Die Serien von ${name} bleiben, wie sie sind.`],
    undo: "Jederzeit über denselben Knopf in der Teilnehmerverwaltung.",
    confirmLabel: "Mindestzahl verlangen",
    destructive: false,
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Disziplinen

export function disciplineDelete({ name, system }: { name: string; system: boolean }): Decision {
  return {
    title: `Disziplin „${name}“ löschen?`,
    about: system
      ? `„${name}“ ist eine Systemdisziplin von Ringwerk.`
      : `„${name}“ ist eine eigene Disziplin.`,
    check:
      "Löschen kann nur ein Admin. Wird die Disziplin in einem Wettbewerb verwendet, auch nur für einzelne Teilnehmer, geht das nicht. Dann archiviere sie.",
    happens: [
      "Die Disziplin verschwindet unter „Disziplinen“ und aus der Auswahl bei neuen Wettbewerben.",
      ...(system ? ["Beim nächsten Start legt Ringwerk sie wieder an."] : []),
      "Im Protokoll unter „Admin“ steht danach ein Eintrag.",
    ],
    notHappening: ["Kein Wettbewerb und kein Ergebnis wird gelöscht."],
    undo: "Nicht möglich. Die Disziplin lässt sich neu anlegen, mit Wertung und Faktor. Soll sie nur aus der Auswahl verschwinden, archiviere sie stattdessen.",
    confirmLabel: "Disziplin löschen",
    destructive: true,
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Wettbewerbe

export type StatusChange = "complete" | "reopen" | "archive" | "restore"

export function competitionStatus(
  change: StatusChange,
  {
    name,
    publicSlug,
  }: {
    name: string
    /** Adresse des öffentlichen Links, `null`, wenn der Wettbewerb nicht öffentlich ist */
    publicSlug: string | null
  }
): Decision {
  const entry = "Im Protokoll des Wettbewerbs steht danach ein Eintrag."
  switch (change) {
    case "complete":
      return {
        title: `„${name}“ abschließen?`,
        about: `„${name}“ läuft.`,
        check: "Sind alle Ergebnisse eingetragen?",
        happens: [
          "Der Wettbewerb steht in der Liste als abgeschlossen.",
          "Einschreiben geht nicht mehr. Spielplan und Playoffs lassen sich nicht mehr starten.",
          ...(publicSlug
            ? [
                "Der öffentliche Link zeigt den Wettbewerb weiter. Startet ein anderer Wettbewerb unter derselben Adresse, zeigt der Link diesen.",
              ]
            : []),
          entry,
        ],
        notHappening: ["Tabellen, Plätze und Ergebnisse bleiben, wie sie sind."],
        undo: "Mit „Wieder öffnen“.",
        confirmLabel: "Abschließen",
        destructive: false,
      }
    case "reopen":
      return {
        title: `„${name}“ wieder öffnen?`,
        about: `„${name}“ ist abgeschlossen.`,
        ...(publicSlug
          ? {
              check: `Läuft schon ein anderer Wettbewerb unter der Adresse „${publicSlug}“? Dann geht das nicht.`,
            }
          : {}),
        happens: [
          "Der Wettbewerb läuft wieder. Einschreiben, Spielplan und Playoffs gehen wieder.",
          entry,
        ],
        notHappening: ["Ergebnisse ändern sich nicht."],
        undo: "Mit „Abschließen“.",
        confirmLabel: "Wieder öffnen",
        destructive: false,
      }
    case "archive":
      return {
        title: `„${name}“ archivieren?`,
        about: `„${name}“ ist abgeschlossen.`,
        happens: [
          "Der Wettbewerb steht in der Liste unter „Archiviert“.",
          "Bearbeiten geht nicht mehr.",
          entry,
        ],
        notHappening: ["Nichts wird gelöscht. Seiten und PDFs bleiben erreichbar."],
        undo: "Mit „Wiederherstellen“. Der Wettbewerb ist dann wieder abgeschlossen.",
        confirmLabel: "Archivieren",
        destructive: false,
      }
    case "restore":
      return {
        title: `„${name}“ wiederherstellen?`,
        about: `„${name}“ ist archiviert.`,
        happens: ["Der Wettbewerb ist wieder abgeschlossen und lässt sich bearbeiten.", entry],
        notHappening: ["Er läuft nicht wieder. Dafür danach „Wieder öffnen“."],
        undo: "Mit „Archivieren“.",
        confirmLabel: "Wiederherstellen",
        destructive: false,
      }
  }
}

/** Kasten unten in „Wettbewerb bearbeiten“ */
export const FORCE_DELETE_SECTION = {
  title: "Wettbewerb löschen",
  text: "Löscht den Wettbewerb mit allem, was dazu eingetragen ist. Nur ein Admin kann das.",
  button: "Wettbewerb mit allen Daten löschen",
} as const

/** Beschriftung des Feldes, in das zur Bestätigung der Name des Wettbewerbs getippt wird */
export const CONFIRM_COMPETITION_NAME = "Zur Bestätigung den Namen des Wettbewerbs eingeben:"

export function competitionForceDelete({
  name,
  isPublic,
}: {
  name: string
  isPublic: boolean
}): Decision {
  return {
    title: `„${name}“ mit allen Daten löschen?`,
    about: `In „${name}“ stehen Einschreibungen, Ergebnisse und das Protokoll.`,
    check: "Wird der Wettbewerb noch gebraucht, auch zum Nachschauen? Archivieren behält alles.",
    happens: [
      "Der Wettbewerb verschwindet aus der Liste.",
      "Gelöscht werden Einschreibungen, Teams, Spielplan, alle Serien und Ergebnisse, die Playoffs mit allen Duellen.",
      "Auch das Protokoll des Wettbewerbs wird gelöscht. Danach lässt sich nicht mehr sehen, wer was eingetragen hat.",
      ...(isPublic ? ["Der öffentliche Link führt nicht mehr zu diesem Wettbewerb."] : []),
    ],
    notHappening: [
      "Die Teilnehmer bleiben unter „Teilnehmer“ und in anderen Wettbewerben. Die Disziplin bleibt.",
    ],
    undo: "Nicht möglich. Nur eine Sicherung des Servers hat die Daten noch.",
    confirmLabel: "Mit allen Daten löschen",
    destructive: true,
  }
}

/** Wettbewerb ohne Einschreibung löschen (10a) */
export function competitionDelete({ name }: { name: string }): Decision {
  return {
    title: `„${name}“ löschen?`,
    about: `In „${name}“ ist niemand eingeschrieben.`,
    happens: [
      "Der Wettbewerb verschwindet aus der Liste.",
      "Seine Einträge im Protokoll bleiben unter „Admin“, ohne Verweis auf den Wettbewerb.",
    ],
    notHappening: ["Keine Disziplin und kein Teilnehmer wird gelöscht."],
    undo: "Nicht möglich. Der Wettbewerb lässt sich neu anlegen.",
    confirmLabel: "Wettbewerb löschen",
    destructive: true,
  }
}

/** Wettbewerb mit Einschreibungen: nur ein Hinweis (10b) */
export function competitionDeleteBlocked({
  name,
  participants,
}: {
  name: string
  participants: number
}): Notice {
  return {
    title: `„${name}“ lässt sich hier nicht löschen`,
    text:
      `In „${name}“ ${participants === 1 ? "ist 1 Teilnehmer" : `sind ${participants} Teilnehmer`} eingeschrieben. ` +
      "So ein Wettbewerb wird archiviert, nicht gelöscht. Ein Admin kann ihn unter „Bearbeiten“ mit allen Daten löschen.",
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Spielplan

export function scheduleGenerate({ leagueFormat }: { leagueFormat: LeagueFormat }): Decision {
  return {
    title: "Spielplan generieren?",
    about: "Die Liga hat noch keinen Spielplan.",
    check:
      "Sind alle eingeschrieben? Wer später dazukommt, braucht einen neuen Spielplan. Das geht nur, solange kein Ergebnis eingetragen ist.",
    happens: [
      leagueFormat === "BEST_OF_SINGLE"
        ? "Ringwerk erstellt eine Runde, jeder gegen jeden."
        : "Ringwerk erstellt Hin- und Rückrunde, jeder gegen jeden.",
      "Bei ungerader Zahl hat in jeder Runde jemand ein Freilos.",
      "Die Abgabefristen aus den Einstellungen stehen an den Paarungen.",
      "Das öffentliche PDF zeigt den Spielplan.",
      "Im Protokoll des Wettbewerbs steht danach ein Eintrag.",
    ],
    notHappening: ["Zurückgezogene bekommen keine Paarungen."],
    undo: "Solange kein Ergebnis eingetragen ist, mit „Spielplan neu generieren“.",
    confirmLabel: "Spielplan generieren",
    destructive: false,
  }
}

export function scheduleRegenerate(): Decision {
  return {
    title: "Spielplan neu generieren?",
    about: "Die Liga hat einen Spielplan. Noch ist kein Ergebnis eingetragen.",
    check: "Ist der Spielplan schon verteilt oder ausgedruckt? Dann ist er danach veraltet.",
    happens: [
      "Der bisherige Spielplan wird gelöscht.",
      "Ringwerk erstellt ihn neu für alle aktiven Teilnehmer. Spieltage und Gegner können sich dabei ändern.",
      "Im Protokoll des Wettbewerbs steht danach ein Eintrag.",
    ],
    notHappening: ["Einschreibungen bleiben."],
    undo: "Nicht möglich. Der alte Spielplan kommt nicht zurück.",
    confirmLabel: "Spielplan neu generieren",
    destructive: true,
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Playoffs und Best-of

/** Runden der Playoffs, wie die Oberfläche sie nennt; alle sächlich („das“, „im“, „ins“) */
export type RoundName = "Achtelfinale" | "Viertelfinale" | "Halbfinale" | "Finale"

export function playoffsStart({
  name,
  round,
  active,
}: {
  name: string
  /** erste Runde */
  round: Exclude<RoundName, "Finale">
  /** aktive Teilnehmer in der Tabelle */
  active: number
}): Decision {
  const qualified = round === "Achtelfinale" ? 16 : round === "Viertelfinale" ? 8 : 4
  return {
    title: `Playoffs für „${name}“ starten?`,
    about: `Die Gruppenphase ist fertig. Die besten ${qualified} von ${active} aktiven Teilnehmern kommen ins ${round}.`,
    check: "Stimmt die Tabelle? Die Setzung folgt genau ihren Plätzen.",
    happens: [
      qualified === 4
        ? `Ringwerk legt das ${round} an. Platz 1 trifft auf Platz 4, Platz 2 auf Platz 3.`
        : `Ringwerk legt das ${round} an. Platz 1 trifft auf Platz ${qualified}, Platz 2 auf Platz ${qualified - 1} und so weiter.`,
      "Zurückziehen, Rückzug zurücknehmen und Entfernen gehen in diesem Wettbewerb nicht mehr.",
      "Unter „Bearbeiten“ sind die Einstellungen für Playoffs und Finale danach gesperrt.",
      "Das öffentliche PDF zeigt ab jetzt die Playoffs statt des Spielplans.",
      "Im Protokoll des Wettbewerbs steht danach ein Eintrag.",
    ],
    notHappening: ["Tabelle und Ergebnisse der Gruppenphase bleiben."],
    undo: "Nicht möglich.",
    confirmLabel: "Playoffs starten",
    destructive: false,
  }
}

export function nextRound({
  round,
  previous,
}: {
  /** die Runde, die angelegt wird */
  round: Exclude<RoundName, "Achtelfinale">
  /** die Runde, deren Paarungen entschieden sind */
  previous: Exclude<RoundName, "Finale">
}): Decision {
  return {
    title: `${round} anlegen?`,
    about: `Alle Paarungen im ${previous} sind entschieden.`,
    happens: [
      round === "Finale"
        ? "Im Finale treffen die Sieger der beiden Halbfinale aufeinander."
        : `Ringwerk setzt das ${round} aus den Siegern. Der beste Platz aus der Gruppenphase trifft auf den schlechtesten.`,
      "Das öffentliche PDF zeigt die neue Runde.",
      "Im Protokoll des Wettbewerbs steht danach ein Eintrag.",
    ],
    notHappening: [`Die Ergebnisse im ${previous} bleiben.`],
    undo: `Nicht direkt. Ändert eine Korrektur im ${previous} einen Sieger, entfernt Ringwerk das ${round} wieder. Das geht nur, solange dort kein Duell angelegt ist.`,
    confirmLabel: `${round} anlegen`,
    destructive: false,
  }
}

export function playoffDuelDelete({
  duel,
  round,
  next,
  nameA,
  nameB,
  winsA,
  winsB,
  entered,
  decided,
}: {
  /** Nummer des Duells in der Paarung */
  duel: number
  round: RoundName
  /** die Runde danach, `null` im Finale */
  next: Exclude<RoundName, "Achtelfinale"> | null
  nameA: string
  nameB: string
  winsA: number
  winsB: number
  /** das Ergebnis des Duells ist eingetragen */
  entered: boolean
  /** die Paarung ist entschieden */
  decided: boolean
}): Decision {
  return {
    title: `Duell ${duel} im ${round} löschen?`,
    about:
      `${nameA} gegen ${nameB} steht ${winsA} : ${winsB}. Duell ${duel} ist das letzte dieser Paarung. ` +
      (entered ? "Sein Ergebnis ist eingetragen." : "Es ist noch offen."),
    ...(next
      ? {
          check: `Hat das ${next} schon ein Duell, geht das nicht. Dann zuerst dort die Duelle löschen.`,
        }
      : {}),
    happens: [
      "Das Duell wird mit seinen Ergebnissen gelöscht. Der Stand wird aus den übrigen Duellen neu gezählt.",
      ...(decided ? ["Die Paarung ist danach wieder offen."] : []),
      ...(decided && next
        ? [
            `Ist das ${next} schon angelegt, entfernt Ringwerk es. Es entsteht neu mit „${next} anlegen“.`,
          ]
        : []),
      "Im Protokoll des Wettbewerbs steht danach, dass das Duell gelöscht wurde, mit Ringen und Teiler.",
    ],
    notHappening: ["Die anderen Duelle und Paarungen bleiben."],
    undo: "Nicht möglich. Das Duell lässt sich neu anlegen und eintragen. Die Werte stehen im Protokoll.",
    confirmLabel: "Duell löschen",
    destructive: true,
  }
}

export function bestOfDuelDelete({
  duel,
  tiebreak,
  nameA,
  nameB,
  winsA,
  winsB,
}: {
  /** Nummer des zuletzt eingetragenen Duells */
  duel: number
  /** das zuletzt eingetragene ist ein Stechschuss */
  tiebreak: boolean
  nameA: string
  nameB: string
  winsA: number
  winsB: number
}): Decision {
  return {
    title: tiebreak ? "Stechschuss zurücknehmen?" : `Duell ${duel} zurücknehmen?`,
    about:
      `${nameA} gegen ${nameB} steht ${winsA} : ${winsB}. ` +
      (tiebreak
        ? "Zuletzt eingetragen ist der Stechschuss."
        : `Zuletzt eingetragen ist Duell ${duel}.`),
    check:
      "Die Ringe dieses Duells stehen danach nirgends mehr, auch nicht im Protokoll. Bei Bedarf vorher notieren.",
    happens: [
      "Die beiden Serien des Duells werden gelöscht.",
      "Die Paarung ist danach offen, auch wenn sie schon entschieden war. Die Tabelle rechnet ohne das Duell.",
      "Im Protokoll des Wettbewerbs steht danach, dass das Duell zurückgenommen wurde.",
    ],
    notHappening: ["Die früheren Duelle bleiben."],
    undo: "Nicht möglich. Das Duell lässt sich neu eintragen.",
    confirmLabel: tiebreak ? "Stechschuss zurücknehmen" : "Duell zurücknehmen",
    destructive: true,
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Konten (Admin)

export function accountDeactivate({
  name,
  email,
}: {
  name: string | null
  email: string
}): Decision {
  const who = name ?? email
  return {
    title: `Konto von ${who} deaktivieren?`,
    about: `${who} meldet sich mit ${email} an.`,
    check: "Das eigene Konto und das letzte aktive Admin-Konto lassen sich nicht deaktivieren.",
    happens: [
      `${who} kann sich nicht mehr anmelden.`,
      `Ist ${who} gerade angemeldet, endet das beim nächsten Klick.`,
      "Im Protokoll unter „Admin“ steht danach ein Eintrag.",
    ],
    notHappening: [
      `Es wird nichts gelöscht. Was ${who} eingetragen hat, bleibt, auch im Protokoll.`,
    ],
    undo: "Unter „Admin“ mit „Aktivieren“. Danach gilt das bisherige Passwort wieder.",
    confirmLabel: "Deaktivieren",
    destructive: true,
  }
}

export function accountActivate({ name, email }: { name: string | null; email: string }): Decision {
  const who = name ?? email
  return {
    title: `Konto von ${who} wieder aktivieren?`,
    about: `Das Konto von ${who} ist deaktiviert.`,
    happens: [
      `${who} kann sich wieder anmelden, mit dem bisherigen Passwort und der bisherigen Rolle.`,
      "Im Protokoll unter „Admin“ steht danach ein Eintrag.",
    ],
    notHappening: [],
    undo: "Mit „Deaktivieren“.",
    confirmLabel: "Aktivieren",
    destructive: false,
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Formulare

export function leaveUnsaved(): Decision {
  return {
    title: "Ohne Speichern verlassen?",
    about: "Du hast hier etwas geändert und noch nicht gespeichert.",
    happens: ["Deine Änderungen gehen verloren."],
    notHappening: ["Was vorher gespeichert war, bleibt."],
    undo: "Nicht möglich. Mit „Abbrechen“ bleibst du hier und kannst speichern.",
    confirmLabel: "Verwerfen",
    destructive: true,
  }
}
