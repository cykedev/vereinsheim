/** gehört die Adresse zum Tagebuch: `/diary` und alles darunter (nur der Pfad, der Rahmen setzt damit den Bereich) */
export const isDiaryPath = (pathname: string) =>
  pathname === "/diary" || pathname.startsWith("/diary/")
