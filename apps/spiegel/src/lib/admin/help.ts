// Erklärungen im Admin hinter einem „?“ (P2c, D4): je Station der Übersicht und je Begriff wenige kurze Sätze in
// Alltagsworten, Wortlaut aus dem Textbuch (P2f). Ohne „Neustart der Anlage“ (D0: das regelt Spiegel selbst). Reine Daten.

export const ADMIN_HELP = {
  site: {
    title: "Meyton-Anlage",
    text: "Die elektronische Schießanlage im Schützenhaus. Sie speichert jede Scheibe mit allen Schüssen. Spiegel liest diese Scheiben über die Brücke und ändert an der Anlage nie etwas.",
  },
  bridge: {
    title: "Brücke",
    text: "Ein kleines Gerät im Schützenhaus, verbunden mit der Meyton-Anlage. Es schickt Spiegel nur die Scheiben von Schützen, die zugestimmt haben. Scheiben mit verdeckter Wertung schickt es nie. Nach dem Training ist es aus. Das ist normal.",
  },
  pairingCode: {
    title: "Code für die Brücke",
    text: "Verbindet eine Brücke einmal mit Spiegel. Danach hat das Gerät einen eigenen Schlüssel und braucht den Code nicht mehr.",
  },
  consent: {
    title: "Zustimmung",
    text: "Wer schießt, trägt im Profil die eigene Sportpassnummer ein und stimmt zu, dass die eigenen Scheiben automatisch in Spiegel kommen. Du prüfst einmal, ob die Nummer zu dieser Person gehört. Danach bestätigt die Person selbst die jüngste Scheibe.",
  },
  ranking: {
    title: "Liste",
    text: "Meyton ordnet jede Scheibe einer Liste des Vereins zu, etwa „Training-LP“ oder „RWK_…“. Hier legst du fest, welche als Wettkampf zählen. Alle anderen zählen so, wie Meyton sie vermerkt. Meist ist das Training.",
  },
  timeZone: {
    title: "Zeitzone der Anlage",
    text: "Meyton speichert Uhrzeiten ohne Zeitzone. Spiegel braucht sie, um die Uhrzeit jeder Scheibe richtig zu zeigen. In Deutschland: Europe/Berlin.",
  },
  role: {
    title: "Rolle",
    text: "Ein Schütze sieht die eigenen Scheiben. Ein Admin verwaltet dazu Konten, Sportpassnummern und die Brücke. Fremde Schüsse sieht auch ein Admin nie, je Konto nur die Zahl der Scheiben und den Tag der letzten.",
  },
  deactivated: {
    title: "Deaktiviert",
    text: "Das Konto kann sich nicht anmelden, und Spiegel holt keine Scheiben dafür. Es wird nichts gelöscht.",
  },
  accounts: {
    title: "Konten",
    text: "Wer Spiegel nutzt. Konten legt nur ein Admin an. Alle sehen nur die eigenen Scheiben, auch du.",
  },
} as const satisfies Record<string, { title: string; text: string }>

export type AdminHelpId = keyof typeof ADMIN_HELP
