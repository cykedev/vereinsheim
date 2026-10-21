/**
 * Spalten der Seite einer Scheibe ab 768 px: links die Scheibe, rechts was daneben steht. Kopf (`CardHeader`) und
 * Raster der Scheibe (`CardPage`) teilen sie, damit Titel und Ergebnis über ihren Spalten stehen.
 * Klassen fest für Tailwind.
 */
export const PAGE_COLUMNS = "md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:gap-x-7"

/**
 * Breite einer einspaltigen Seite (Scheiben, Offen, Profil, Papierkorb, Admin): linksbündig im Rahmen wie die Seiten mit
 * zwei Spalten, höchstens 48 rem. Eine Breite für alle, damit der Inhalt beim Wechsel der Bereiche nicht springt.
 * Formulare darin dürfen schmaler sein (`max-w-lg`).
 */
export const PAGE_SINGLE = "max-w-3xl"
