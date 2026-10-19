// Folgen bei Disziplinen (eigene und Standard) und Konten (Admin).

import type { Decision } from "@vereinsheim/ui/design2/decision-dialog"

export function disciplineArchive({
  name,
  system,
  favourite,
}: {
  name: string
  /** Standarddisziplin: alle Konten sehen sie, nur ein Admin archiviert sie */
  system: boolean
  /** die eigene Lieblingsdisziplin */
  favourite: boolean
}): Decision {
  if (system)
    return {
      title: `Standarddisziplin „${name}“ archivieren?`,
      about: `„${name}“ ist eine Standarddisziplin. Alle Konten sehen sie.`,
      happens: [
        "Für alle Konten steht sie bei einer neuen Einheit und einem neuen Ablauf nicht mehr zur Auswahl.",
        "Wer sie als Lieblingsdisziplin gewählt hat, verliert diese Wahl.",
      ],
      notHappening: [
        "Einheiten mit dieser Disziplin bleiben, bei allen Konten. Ihre Ergebnisse zählen weiter in der Statistik.",
      ],
      undo: "Unter „Disziplinen“ mit „Aktivieren“. Die Lieblingsdisziplin wählt jedes Konto selbst neu.",
      confirmLabel: "Archivieren",
      destructive: true,
    }
  return {
    title: `Disziplin „${name}“ archivieren?`,
    about: `„${name}“ ist eine deiner eigenen Disziplinen.`,
    happens: [
      "Bei einer neuen Einheit und einem neuen Ablauf steht sie nicht mehr zur Auswahl.",
      ...(favourite ? ["Sie ist danach nicht mehr deine Lieblingsdisziplin."] : []),
    ],
    notHappening: [
      "Einheiten mit dieser Disziplin bleiben. Ihre Ergebnisse zählen weiter in der Statistik.",
    ],
    undo: "Unter „Disziplinen“ mit „Aktivieren“. Die Lieblingsdisziplin wählst du dann neu.",
    confirmLabel: "Archivieren",
    destructive: true,
  }
}

export function disciplineActivate({ name, system }: { name: string; system: boolean }): Decision {
  return {
    title: `Disziplin „${name}“ wieder aktivieren?`,
    about: `„${name}“ ist archiviert.`,
    happens: [
      `Bei einer neuen Einheit und einem neuen Ablauf steht sie wieder zur Auswahl.${system ? " Das gilt für alle Konten." : ""}`,
    ],
    notHappening: ["Eine frühere Wahl als Lieblingsdisziplin kommt nicht zurück."],
    undo: "Mit „Archivieren“.",
    confirmLabel: "Aktivieren",
    destructive: false,
  }
}

export function disciplineDelete({ name, system }: { name: string; system: boolean }): Decision {
  return {
    title: `Disziplin „${name}“ löschen?`,
    about: `Keine Einheit und kein Ablauf verwendet „${name}“. Nur deshalb lässt sie sich löschen.`,
    happens: [
      `Die Disziplin verschwindet unter „Disziplinen“ und aus der Auswahl.${system ? " Das gilt für alle Konten." : ""}`,
      "Wer sie als Lieblingsdisziplin gewählt hat, verliert diese Wahl.",
    ],
    notHappening: ["Keine Einheit wird gelöscht."],
    undo: "Nicht möglich. Du kannst sie neu anlegen. Soll sie nur aus der Auswahl verschwinden, archiviere sie stattdessen.",
    confirmLabel: "Disziplin löschen",
    destructive: true,
  }
}

export function accountDeactivate({
  name,
  email,
}: {
  name: string | null
  email: string
}): Decision {
  const who = name || email
  return {
    title: `Konto von ${who} deaktivieren?`,
    about: `${who} meldet sich mit ${email} an.`,
    happens: [
      `${who} kann sich nicht mehr anmelden.`,
      `Ist ${who} gerade angemeldet, endet das beim nächsten Klick.`,
    ],
    notHappening: [`Es wird nichts gelöscht. Einheiten, Ziele und Abläufe von ${who} bleiben.`],
    undo: "Unter „Admin“ mit „Aktivieren“. Danach gilt das bisherige Passwort wieder.",
    confirmLabel: "Deaktivieren",
    destructive: true,
  }
}
