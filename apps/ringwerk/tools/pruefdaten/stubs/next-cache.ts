// Stellvertreter für `next/cache` außerhalb von Next: Die Actions verwerfen nach dem Schreiben Seiten- und PDF-Caches.
// Im Werkzeug gibt es keinen Cache, die Aufrufe bleiben folgenlos.

export function revalidatePath(): void {}

export function revalidateTag(): void {}
