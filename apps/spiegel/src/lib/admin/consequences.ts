// Folgen jeder Aktion in Alltagsworten: „Kein Knopf ohne Folge“. Eine Quelle für Dialoge und Tests; die Komponenten
// erfinden keine Texte. Ohne Pronomen für Personen: Spiegel kennt Namen, kein Geschlecht. Reine Funktionen.
//
// Der Wortlaut folgt den Schreibregeln ([[conventions]] §10): erst sagen, was vorher war, ein Gedanke pro Satz, keine
// Semikolons, die Wörter des Users statt der des Codes (Sportpassnummer, zurückweisen, wieder zulassen, Spiegel holt).
// Ein Test hält die alten Wörter fern (`consequences.test.ts`, „Schreibregeln“).

import { forbiddenWords } from "@vereinsheim/lib/wording"
import type { Decision } from "@vereinsheim/ui/design2/decision-dialog"

/**
 * Was in keinem sichtbaren Text stehen darf: die Grundregel (`@vereinsheim/lib/wording`: Semikolon, drei Punkte) und
 * die alten Wörter des Codes, auch „Rangliste“ (in der Oberfläche „Liste“). Die Tests der Dialoge, Erklärungen,
 * Zustände und der Übersicht prüfen dagegen.
 */
export const OLD_WORDS = forbiddenWords(
  /SportpassI[Dd]|Sportpass-ID|\bMeldung|\bAblage|[Kk]oppe?l|Rückstau|[Nn]achlad|[Nn]achgelad|Grabstein|[Ss]perre|[Rr]angliste/
)

export type { Decision }

const scheiben = (n: number) => (n === 1 ? "1 Scheibe" : `${n} Scheiben`)

/** Tag und Uhrzeit wie in Listen („Di 13.10.2026 · 19:12“) im Satz: „Di 13.10.2026 um 19:12“ */
const spoken = (evening: string) => evening.replace(" · ", " um ")

export function consentConfirm({
  who,
  sportpassId,
  returned = false,
  accountActive = true,
  historyOpen = true,
  notMine = 0,
}: {
  who: string
  sportpassId: string
  /** nach „Nicht meine“ bei der jüngsten Scheibe zurück beim Admin */
  returned?: boolean
  /** ein deaktiviertes Konto bekommt nichts, auch bestätigt */
  accountActive?: boolean
  /** die älteren Scheiben sind noch nicht geholt: Nach dem Bestätigen holt Spiegel sie */
  historyOpen?: boolean
  /** Scheiben unter der Nummer, als „nicht meine“ zurückgewiesen */
  notMine?: number
}): Decision {
  return {
    title: `Sportpassnummer von ${who} bestätigen?`,
    about: returned
      ? `${who} hat die jüngste Scheibe unter der Sportpassnummer ${sportpassId} als „nicht meine“ zurückgewiesen. Spiegel hat die wartenden Scheiben gelöscht und die Nummer wieder dir zur Prüfung gegeben.`
      : `${who} hat die Sportpassnummer ${sportpassId} eingetragen und möchte die eigenen Scheiben automatisch in Spiegel bekommen.`,
    check: returned
      ? `Gehört ${sportpassId} wirklich zu ${who}? Vielleicht hat jemand am Stand einen fremden Namen gewählt. Wenn die Nummer nicht passt: ablehnen.`
      : `Gehört ${sportpassId} in der Meyton-Schützenverwaltung zu ${who}? Wenn nicht: ablehnen.`,
    happens: [
      // bei deaktiviertem Konto zuerst das, sonst widerspräche der erste Satz dem letzten
      ...(accountActive
        ? [
            "Spiegel holt ab jetzt jede Scheibe, die unter dieser Nummer geschossen wird. Läuft die Brücke gerade, dauert das wenige Minuten.",
          ]
        : [
            `Das Konto von ${who} ist deaktiviert. Solange das so bleibt, holt Spiegel nichts. Danach holt Spiegel jede Scheibe, die unter dieser Nummer geschossen wird.`,
          ]),
      // das Holen älterer Scheiben: nur, solange es noch offen ist (nach „nicht meine“ oft schon erledigt, nach dem
      // Wiederzulassen wieder offen)
      ...(historyOpen
        ? [
            "Auch ältere Scheiben unter dieser Nummer holt Spiegel, soweit die Meyton-Anlage sie noch hat. Das passiert, wenn dort niemand schießt.",
          ]
        : []),
      `${who} bestätigt die jüngste Scheibe einmal in der App unter „Offen“. Erst danach erscheinen alle im Konto.`,
    ],
    notHappening: [
      `Du siehst die Schüsse von ${who} nicht.`,
      "Scheiben mit verdeckter Wertung (etwa beim Königsschießen) holt Spiegel nie.",
      `Was ${who} gelöscht hat, kommt nicht wieder.`,
      ...(notMine
        ? [
            `${notMine === 1 ? "Die 1 zurückgewiesene Scheibe („nicht meine“) kommt" : `Die ${notMine} zurückgewiesenen Scheiben („nicht meine“) kommen`} nicht wieder, außer du lässt sie wieder zu.`,
          ]
        : []),
    ],
    undo: `Jederzeit mit „Entfernen“. Scheiben, die schon da sind, bleiben bei ${who}.`,
    confirmLabel: "Nummer bestätigen",
    destructive: false,
  }
}

/** ablehnen gibt es nur für offene Zustimmungen: Es wurde noch nichts geholt */
export function consentReject({
  who,
  sportpassId,
}: {
  who: string
  sportpassId: string
}): Decision {
  return {
    title: `Sportpassnummer von ${who} ablehnen?`,
    about: `${who} hat die Sportpassnummer ${sportpassId} eingetragen.`,
    happens: [
      "Spiegel holt unter dieser Nummer keine Scheiben.",
      `${who} sieht im Profil „abgelehnt“. Danach kann ${who} die Zeile entfernen und die Nummer neu eintragen.`,
    ],
    notHappening: ["Es wird nichts gelöscht."],
    undo: `Trägt ${who} die Nummer neu ein, kannst du sie bestätigen.`,
    confirmLabel: "Ablehnen",
    destructive: true,
  }
}

export function consentRemove({
  who,
  sportpassId,
}: {
  who: string
  sportpassId: string
}): Decision {
  return {
    title: `Sportpassnummer von ${who} entfernen?`,
    about: `Die Sportpassnummer ${sportpassId} wird vom Konto von ${who} getrennt.`,
    happens: [
      "Ab sofort holt Spiegel unter dieser Nummer nichts mehr.",
      "Die Nummer ist wieder frei. Jedes Konto kann sie neu eintragen.",
    ],
    notHappening: [
      `Scheiben, die schon da sind, bleiben bei ${who}. Löschen kann sie nur ${who} selbst.`,
    ],
    undo: `${who} trägt die Nummer im Profil neu ein, und du bestätigst sie.`,
    confirmLabel: "Entfernen",
    destructive: true,
  }
}

export function bridgeRevoke({ device }: { device: string }): Decision {
  return {
    title: `Brücke „${device}“ trennen?`,
    about: `Das Gerät „${device}“ schickt Scheiben an Spiegel.`,
    happens: ["Ab sofort nimmt Spiegel von diesem Gerät nichts mehr an."],
    notHappening: ["Es wird keine Scheibe gelöscht.", "Andere Brücken laufen weiter."],
    undo: "Nicht möglich. Um das Gerät wieder zu nutzen, verbinde es mit einem neuen Code.",
    confirmLabel: "Trennen",
    destructive: true,
  }
}

/** eine getrennte Brücke entfernen */
export function bridgeRemove({ device }: { device: string }): Decision {
  return {
    title: `Getrennte Brücke „${device}“ entfernen?`,
    about: `Das Gerät „${device}“ ist getrennt und schickt nichts mehr.`,
    // nicht „aus dieser Liste“: Auf der Seite heißen auch die Listen aus Meyton so
    happens: ["Es steht dann nicht mehr unter „Brücke im Schützenhaus“."],
    notHappening: [
      "Es wird keine Scheibe gelöscht.",
      "Was das Gerät geschickt hat, bleibt in Spiegel.",
    ],
    undo: "Nicht möglich. Das Gerät lässt sich mit einem neuen Code wieder verbinden.",
    confirmLabel: "Entfernen",
    destructive: true,
  }
}

export type RankingChoice = "training" | "competition" | "open"

const RANKING_WORDS: Record<RankingChoice, { title: string; label: string }> = {
  competition: { title: "als Wettkampf zählen", label: "Als Wettkampf zählen" },
  training: { title: "als Training zählen", label: "Als Training zählen" },
  open: { title: "nicht festlegen", label: "Nicht festlegen" },
}

/**
 * was mit den Scheiben der Liste geschieht, als Ende des Satzes „Diese Scheiben … “. Die Wertung hängt nicht an der Art
 * (sie kommt von der Disziplin), deshalb sagt der Dialog dazu nichts.
 */
const RANKING_HAPPENS: Record<RankingChoice, string> = {
  competition: "zählen als Wettkampf, in den Scheiben und im Fortschritt.",
  training: "zählen als Training, in den Scheiben und im Fortschritt.",
  open: "zählen dann so, wie Meyton sie vermerkt. Meist ist das Training.",
}

export function rankingKind({
  ranking,
  cards,
  kind,
}: {
  ranking: string
  /** Scheiben in Spiegel in dieser Liste (nicht gelöscht) */
  cards: number
  kind: RankingChoice
}): Decision {
  const counts = RANKING_HAPPENS[kind]
  return {
    title: `„${ranking}“ ${RANKING_WORDS[kind].title}?`,
    about: cards
      ? `In Spiegel ${cards === 1 ? "gehört" : "gehören"} ${scheiben(cards)} zur Liste „${ranking}“.`
      : `Noch keine Scheibe in Spiegel gehört zur Liste „${ranking}“.`,
    happens: [
      `${cards ? (cards === 1 ? "Diese Scheibe" : `Diese ${cards} Scheiben`) : "Ihre Scheiben"} und alle neuen dieser Liste ${counts}`,
    ],
    notHappening: [
      "Hat ein Schütze eine Scheibe selbst umgestellt, bleibt es dabei.",
      "Eine Scheibe nur mit Probeschüssen bleibt Training.",
      "An den Schüssen ändert sich nichts.",
    ],
    undo: "Jederzeit hier wieder umstellen.",
    confirmLabel: RANKING_WORDS[kind].label,
    destructive: false,
  }
}

/** was am Konto geändert wird; nur diese Felder haben Folgen, Name und E-Mail nicht */
export interface AccountChanges {
  role?: "ADMIN" | "USER"
  active?: boolean
  password?: boolean
}

/** was ein Formular gegenüber dem gespeicherten Konto ändert; nur Rolle, Status und Passwort zählen */
export function accountChangesOf(
  saved: { role: "ADMIN" | "USER"; isActive: boolean },
  form: { role: "ADMIN" | "USER"; active: boolean; password: string }
): AccountChanges {
  return {
    ...(form.role !== saved.role ? { role: form.role } : {}),
    ...(form.active !== saved.isActive ? { active: form.active } : {}),
    ...(form.password !== "" ? { password: true } : {}),
  }
}

/** Konto ändern: nur bei Rolle, Status oder Passwort ein Entscheid, sonst null */
export function accountChange({
  who,
  changes,
}: {
  who: string
  changes: AccountChanges
}): Decision | null {
  const { role, active, password } = changes
  if (role === undefined && active === undefined && !password) return null
  const happens: string[] = []
  const notHappening: string[] = []
  if (role === "ADMIN")
    happens.push(
      `${who} kann dann Konten, Sportpassnummern und die Brücke verwalten. Fremde Schüsse sieht auch ein Admin nie.`
    )
  if (role === "USER") happens.push(`${who} kommt nicht mehr in den Admin-Bereich.`)
  if (active === false) {
    happens.push(
      `${who} kann sich nicht mehr anmelden.`,
      `Spiegel holt keine Scheiben mehr für ${who}.`
    )
    notHappening.push("Scheiben und Sportpassnummern bleiben. Es wird nichts gelöscht.")
  }
  if (active === true)
    happens.push(`${who} kann sich wieder anmelden. Bestätigte Sportpassnummern gelten wieder.`)
  if (password)
    happens.push(
      `${who} wird abgemeldet. Bei der nächsten Anmeldung muss ${who} das neue Passwort durch ein eigenes ersetzen. Vorher ist nichts zu sehen.`
    )
  // Rolle und Deaktivieren beenden die Sitzungen (ein deaktiviertes Konto hat keine); das neue Passwort sagt es selbst
  else if (role !== undefined || active === false) happens.push(`${who} wird abgemeldet.`)
  return {
    title: `Konto von ${who} ändern?`,
    about: `Du änderst bei ${who}: ${[
      role !== undefined ? "Rolle" : null,
      active !== undefined ? "Status" : null,
      password ? "Passwort" : null,
    ]
      .filter(Boolean)
      .join(", ")}.`,
    ...(password ? { check: "Gib das neue Passwort persönlich weiter, nicht per Mail." } : {}),
    happens,
    notHappening,
    undo: [
      active === false ? "Das Konto wieder aktivieren." : null,
      active === true ? "Das Konto wieder deaktivieren." : null,
      role !== undefined ? "Die Rolle hier zurückstellen." : null,
      password
        ? "Das alte Passwort lässt sich nicht zurückholen. Du kannst jederzeit ein neues setzen."
        : null,
    ]
      .filter(Boolean)
      .join(" "),
    confirmLabel: "Speichern",
    destructive: active === false,
  }
}

export function ownConsentRevoke({
  sportpassId,
  status = "active",
}: {
  sportpassId: string
  /** nur eine aktive hat schon Scheiben gebracht */
  status?: "requested" | "active" | "returned"
}): Decision {
  return {
    title: `Zustimmung für ${sportpassId} widerrufen?`,
    about:
      status === "active"
        ? `Scheiben mit der Sportpassnummer ${sportpassId} kommen bisher von selbst in dein Konto.`
        : status === "requested"
          ? `Du hast für die Sportpassnummer ${sportpassId} zugestimmt. Ein Admin hat die Nummer noch nicht geprüft.`
          : `Ein Admin prüft die Sportpassnummer ${sportpassId} gerade noch einmal.`,
    happens: ["Ab sofort kommen keine neuen Scheiben mehr unter dieser Nummer."],
    notHappening: ["Scheiben, die schon da sind, bleiben, bis du sie löschst."],
    undo: "Neu zustimmen. Ein Admin prüft die Nummer dann noch einmal.",
    confirmLabel: "Widerrufen",
    destructive: true,
  }
}

export function ownRejectionRemove(): Decision {
  return {
    title: "Abgelehnte Nummer entfernen?",
    about: "Ein Admin hat diese Sportpassnummer abgelehnt.",
    happens: ["Die Zeile verschwindet. Danach kannst du die Nummer neu eintragen."],
    notHappening: ["Scheiben kommen erst, wenn ein Admin die neu eingetragene Nummer bestätigt."],
    undo: "Nicht nötig.",
    confirmLabel: "Entfernen",
    destructive: false,
  }
}

export function notMine({
  evening,
  more,
  sportpassId,
}: {
  evening: string
  more: number
  /** null: die Scheibe trug keine Sportpassnummer; dann geht keine Zustimmung zurück */
  sportpassId: string | null
}): Decision {
  const several = more > 0
  const under = sportpassId ? `unter deiner Sportpassnummer ${sportpassId}` : "ohne Sportpassnummer"
  return {
    title: "Nicht deine Scheibe?",
    about: `Die Scheibe vom ${spoken(evening)} kam ${under}.${several ? ` Mit ihr ${more === 1 ? "wartet 1 weitere" : `warten ${more} weitere`}.` : ""}`,
    happens: [
      several
        ? `Spiegel löscht diese Scheibe und ${more === 1 ? "die weitere" : `die ${more} weiteren`}. Sie kommen nicht von selbst wieder.`
        : "Spiegel löscht diese Scheibe. Sie kommt nicht von selbst wieder.",
      ...(sportpassId
        ? [
            "Ein Admin prüft deine Sportpassnummer noch einmal. Bis dahin kommen keine Scheiben unter dieser Nummer.",
          ]
        : []),
    ],
    notHappening: ["Deine anderen Scheiben bleiben."],
    // ohne Nummer gibt es nichts, was ein Admin wieder zulassen könnte
    undo: sportpassId
      ? "Ein Admin kann sie wieder zulassen, solange die Nummer in deinem Profil steht. Sag dem Admin dann Bescheid."
      : "Nicht möglich.",
    confirmLabel: "Nicht meine",
    destructive: true,
  }
}

/** eine eigene Scheibe in den Papierkorb */
export function cardDelete({ evening }: { evening: string }): Decision {
  return {
    title: "Scheibe löschen?",
    about: `Du löschst die Scheibe vom ${spoken(evening)}.`,
    happens: [
      "Sie liegt 30 Tage im Papierkorb (im Profil). So lange zählt sie nirgends mit, auch nicht in Rekorden und Verläufen.",
      "Danach löscht Spiegel sie endgültig, mit allen Schüssen. Sie kommt nicht von selbst wieder.",
    ],
    notHappening: ["Deine anderen Scheiben bleiben.", "An der Meyton-Anlage ändert sich nichts."],
    undo: "30 Tage lang im Papierkorb wiederherstellen.",
    confirmLabel: "Löschen",
    destructive: true,
  }
}

/** eine Scheibe im Papierkorb sofort endgültig löschen; Spiegel merkt sich nur, dass es sie gab */
export function cardPurgeNow({ evening }: { evening: string }): Decision {
  return {
    title: "Endgültig löschen?",
    about: `Die Scheibe vom ${spoken(evening)} liegt im Papierkorb.`,
    happens: [
      "Spiegel löscht sie sofort, mit allen Schüssen.",
      "Spiegel merkt sich nur, dass es sie gab. So holt Spiegel sie nicht von selbst wieder.",
    ],
    notHappening: ["An der Meyton-Anlage ändert sich nichts."],
    undo: "Nicht möglich.",
    confirmLabel: "Endgültig löschen",
    destructive: true,
  }
}

/**
 * Zurückgewiesene Scheiben („nicht meine“) einer Sportpassnummer wieder zulassen: Die Scheiben dürfen
 * wiederkommen und warten in „Offen“. `consentActive`: Die Nummer ist bestätigt; sonst kommen sie erst, wenn sie es
 * wieder ist. Neutral formuliert: Zurückgewiesen haben kann auch ein früheres Konto mit dieser Nummer.
 */
export function notMineLift({
  who,
  sportpassId,
  cards,
  consentActive,
}: {
  who: string
  sportpassId: string
  cards: number
  consentActive: boolean
}): Decision {
  return {
    title: "Zurückgewiesene Scheiben wieder zulassen?",
    about: `Unter der Sportpassnummer ${sportpassId} ${cards === 1 ? "wurde" : "wurden"} ${scheiben(cards)} als „nicht meine“ zurückgewiesen. Spiegel hat sie deshalb gelöscht und nimmt sie nicht mehr an.`,
    check: `Mach das nur, wenn ${who} dir sagt: Das waren doch meine Scheiben.`,
    happens: [
      ...(consentActive
        ? [
            `Spiegel holt ${cards === 1 ? "die Scheibe" : `die ${cards} Scheiben`} noch einmal aus der Meyton-Anlage. Das passiert, sobald dort niemand schießt.`,
            `Hat die Anlage sie inzwischen gelöscht, ${cards === 1 ? "kommt sie" : "kommen sie"} nicht mehr.`,
          ]
        : [
            `${cards === 1 ? "Die Scheibe kommt" : "Die Scheiben kommen"} erst, wenn du die Sportpassnummer wieder bestätigt hast.`,
          ]),
      `${who} muss sie in der App unter „Offen“ bestätigen. Bis dahin landen auch neue Scheiben von ${who} zuerst dort.`,
    ],
    notHappening: [`Du siehst die Schüsse von ${who} nicht.`],
    undo: `${who} kann sie unter „Offen“ wieder als „nicht meine“ zurückweisen.`,
    confirmLabel: "Wieder zulassen",
    destructive: false,
  }
}

/** die Zuordnung einer Disziplin, wie der Admin sie speichert */
export interface DisciplineMapping {
  targetId: string | null
  familyId: number | null
  officialScoring: "decimal" | "rings" | null
  /** null: aus der DisziplinID, 0: keine feste Zahl, sonst die Zahl */
  plannedShots: number | null
  confirmed: boolean
}

/** ändern Scheibenbild oder Schusszahl die Merkmale der vorhandenen Scheiben: dann rechnet Spiegel sie nach */
export const disciplineRecalculates = (before: DisciplineMapping, after: DisciplineMapping) =>
  before.targetId !== after.targetId || before.plannedShots !== after.plannedShots

const disciplineCards = (cards: number) =>
  cards === 0
    ? "In Spiegel gibt es noch keine Scheibe dieser Disziplin."
    : cards === 1
      ? "In Spiegel gibt es eine Scheibe dieser Disziplin."
      : `In Spiegel gibt es ${cards} Scheiben dieser Disziplin.`

const visibleWith = (m: DisciplineMapping) => m.targetId !== null && m.familyId !== null

export function disciplineChange({
  name,
  cards,
  before,
  after,
  targetLabel,
  familyName,
  plannedShotsFromId,
}: {
  name: string
  /** Scheiben in Spiegel in dieser Disziplin (nicht gelöscht) */
  cards: number
  before: DisciplineMapping
  after: DisciplineMapping
  /** Name des gewählten Scheibenbilds; null bei eigener Scheibe */
  targetLabel: string | null
  /** Name der gewählten Familie; null ohne */
  familyName: string | null
  /** Schusszahl aus der DisziplinID; null, wenn sie keine nennt */
  plannedShotsFromId: number | null
}): Decision {
  const happens: string[] = []
  const targetChanged = before.targetId !== after.targetId
  const familyChanged = before.familyId !== after.familyId
  if ((targetChanged || familyChanged) && !visibleWith(after))
    happens.push(
      visibleWith(before)
        ? "Spiegel zeigt die Scheiben dieser Disziplin nicht mehr in Start, Scheiben und Fortschritt."
        : `Spiegel zeigt die Scheiben dieser Disziplin noch nicht in Start, Scheiben und Fortschritt. Dazu braucht sie ${
            after.targetId === null && after.familyId === null
              ? "eine Scheibe und eine Familie"
              : after.targetId === null
                ? "eine Scheibe"
                : "eine Familie"
          }.`
    )
  else {
    if (targetChanged)
      happens.push(
        `Spiegel zeichnet die Scheiben als ${targetLabel} und prüft den Wert jedes Schusses nach.`
      )
    if (familyChanged) happens.push(`Die Scheiben stehen dann in der Familie „${familyName}“.`)
  }
  if (before.officialScoring !== after.officialScoring)
    happens.push(
      after.officialScoring
        ? `Die Scheiben dieser Disziplin zählen dann in ${after.officialScoring === "rings" ? "ganzen Ringen" : "Zehnteln"}.`
        : "Die Scheiben dieser Disziplin zählen dann so, wie am Stand angezeigt."
    )
  if (before.plannedShots !== after.plannedShots) {
    const shots = after.plannedShots === null ? plannedShotsFromId : after.plannedShots || null
    happens.push(
      shots
        ? `Eine Scheibe ist dann mit ${shots} Schüssen vollständig.`
        : "Eine Scheibe ist dann vollständig, sobald sie fertig ist."
    )
  }
  if (!happens.length)
    happens.push(
      "Spiegel übernimmt den Vorschlag. Die Disziplin steht danach nicht mehr unter „Neu“."
    )
  if (disciplineRecalculates(before, after))
    happens.push("Spiegel rechnet die vorhandenen Scheiben in den nächsten Minuten neu.")
  happens.push("Neue Scheiben dieser Disziplin kommen gleich so an.")
  return {
    title: `„${name}“ so einordnen?`,
    about: disciplineCards(cards),
    happens,
    notHappening: [
      "An den Schüssen und an den Werten aus Meyton ändert sich nichts.",
      "Hat ein Schütze eine Scheibe selbst auf Zehntel oder ganze Ringe gestellt, bleibt es dabei.",
      "Hat ein Schütze für eine Familie Zehntel oder ganze Ringe gewählt, bleibt es dabei.",
    ],
    undo: "Jederzeit hier wieder umstellen.",
    confirmLabel: "So einordnen",
    destructive: false,
  }
}

export function disciplineIgnore({ name, cards }: { name: string; cards: number }): Decision {
  return {
    title: `„${name}“ ignorieren?`,
    about: disciplineCards(cards),
    happens: [
      "Spiegel zeigt die Scheiben dieser Disziplin nirgends mehr. Auch die Schützen sehen sie nicht.",
      "Neue Scheiben dieser Disziplin kommen weiter an. Sie bleiben unsichtbar.",
      "Die Disziplin steht danach unter „Ignoriert“.",
    ],
    notHappening: ["Keine Scheibe wird gelöscht.", "An den Schüssen ändert sich nichts."],
    undo: "Unter „Ignoriert“ auf „Wieder zeigen“ tippen. Dann sind alle Scheiben wieder da.",
    confirmLabel: "Ignorieren",
    destructive: false,
  }
}

export function disciplineShow({
  name,
  cards,
  visible,
}: {
  name: string
  cards: number
  /** Scheibenbild und Familie sind gesetzt */
  visible: boolean
}): Decision {
  return {
    title: `„${name}“ wieder zeigen?`,
    about: disciplineCards(cards),
    happens: [
      visible
        ? "Spiegel zeigt die Scheiben dieser Disziplin wieder in Start, Scheiben und Fortschritt."
        : "Die Disziplin steht danach wieder unter „Neu“. Ihre Scheiben erscheinen, sobald Scheibe und Familie eingestellt sind.",
    ],
    notHappening: ["An den Schüssen ändert sich nichts."],
    undo: "Jederzeit wieder ignorieren.",
    confirmLabel: "Wieder zeigen",
    destructive: false,
  }
}

export function familyRemove({ name }: { name: string }): Decision {
  return {
    title: `Familie „${name}“ entfernen?`,
    about: "Zu dieser Familie gehört keine Disziplin und keine Scheibe.",
    happens: [
      "Die Familie verschwindet aus der Auswahl.",
      "Hat ein Schütze für diese Familie Zehntel oder ganze Ringe gewählt, fällt diese Wahl weg.",
    ],
    notHappening: ["Keine Scheibe ändert sich."],
    undo: "Eine neue Familie mit demselben Namen anlegen. Die Wahl der Schützen kommt nicht zurück.",
    confirmLabel: "Entfernen",
    destructive: true,
  }
}
