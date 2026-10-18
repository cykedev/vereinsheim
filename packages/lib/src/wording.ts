// Schreibregeln für sichtbare Texte ([[conventions]] §10 „So schreiben wir“): ein Gedanke pro Satz, also keine
// Semikolons, und die Ellipse als Zeichen „…“ statt drei Punkten (§3). Jede App ergänzt ihre alten Wörter.

/** was in keinem sichtbaren Text einer App stehen darf: Semikolon und drei Punkte statt „…“ */
export const BASE_FORBIDDEN = /;|\.\.\.(?!\.)/

/** die Regel einer App: die Grundregel und ihre alten Wörter */
export function forbiddenWords(extra?: RegExp): RegExp {
  return extra ? new RegExp(`${BASE_FORBIDDEN.source}|${extra.source}`) : BASE_FORBIDDEN
}

/** die Texte, die gegen die Grundregel oder die alten Wörter der App verstoßen; leer, wenn alle passen */
export function forbiddenIn(texts: readonly string[], extra?: RegExp): string[] {
  const rule = forbiddenWords(extra)
  return texts.filter((text) => rule.test(text))
}
