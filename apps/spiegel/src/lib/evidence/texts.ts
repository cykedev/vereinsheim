// Texte zum Beleg einer eingetragenen Scheibe, für die Actions und den Browser (der eine zu große Datei gar nicht erst
// schickt)

/** so groß darf ein Beleg sein: Luft unter den 5 MiB je Anfrage (Caddy) für das Formular */
export const EVIDENCE_MAX_BYTES = 4 * 1024 * 1024

export const EVIDENCE_TEXTS = {
  tooLarge: "Die Datei ist zu groß, auch verkleinert.",
  unreadable: "Spiegel kann diese Datei nicht lesen. Nimm ein Foto (JPEG, PNG) oder ein PDF.",
  printout:
    "Das ist ein Ausdruck von Meyton. Hole ihn unter „Scheibe holen“ mit „PDF hochladen“, dann übernimmt Spiegel seine Werte. Der Beleg ist nicht angehängt.",
  failed: "Das ließ sich nicht speichern. Bitte noch einmal versuchen.",
} as const
