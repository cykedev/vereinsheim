// Curated thesaurus for memory-graph search — the only "semantic" lever in an
// otherwise purely lexical (BM25) engine. Maps a natural word to the words actually
// used in the docs/entities, so a query phrased differently still ranks the right
// entity. Keys and values are written in plain language; the search layer stems
// both sides, so "tests" / "testing" / "test" all collapse together.
//
// Keep this SMALL and project-relevant. It is version-controlled and deterministic;
// add a line only when a real query missed an entity it should have found. Expansion
// is one-directional (query term → these extra terms), so list the on-doc vocabulary
// on the right.
//
// Seeded with the harness's own vocabulary. /harness-init and ongoing work extend it.
export default {
	// workflow / process
	'unattended': ['autonomous', 'autopilot', 'automatic'],
	'automatic': ['autonomous', 'autopilot'],
	'coding': ['implement', 'code'],
	'run': ['execute', 'gate', 'command'],
	'verify': ['validate', 'check', 'gate', 'test'],
	'verification': ['validate', 'check', 'gate'],
	'ci': ['gate', 'lint', 'test', 'build'],
	'pipeline': ['gate', 'workflow'],

	// knowledge / search
	'search': ['retrieval', 'query', 'find', 'lookup'],
	'find': ['search', 'retrieval', 'lookup'],
	'notes': ['memory', 'knowledge', 'graph'],
	'docs': ['documentation', 'knowledge'],
	'index': ['graph', 'retrieval'],

	// guardrails / safety
	'safety': ['guard', 'guardrail', 'hook'],
	'guardrail': ['guard', 'hook'],
	'secrets': ['env', 'credentials'],
	'protect': ['guard', 'protected'],

	// review / debugging
	'reviewer': ['review', 'code-reviewer'],
	'bug': ['debug', 'debugger', 'failure'],
	'investigate': ['debug', 'debugger', 'investigation'],

	// learning
	'learn': ['lessons', 'consolidate'],
	'correction': ['lessons', 'feedback'],

	// ── Projekt-Vokabular (vereinsheim, Deutsch) ──────────────────────────────
	// Brückt deutsche Synonyme/Komposita auf die in den Docs/Entities benutzten
	// Wörter (rechts steht die On-Doc-Vokabel). Erweitern, wenn eine echte Query
	// die richtige Entity verfehlt.
	'punktzahl': ['scoring', 'punkteberechnung', 'wertung', 'wertungslogik', 'ergebnisberechnung'],
	'punkte': ['scoring', 'wertung', 'punkteberechnung'],
	'berechnen': ['scoring', 'punkteberechnung', 'wertung', 'calculatescore'],
	'berechnet': ['scoring', 'punkteberechnung', 'wertung'],
	'berechnung': ['scoring', 'punkteberechnung', 'wertung'],
	'anmeldung': ['einschreibung', 'teilnehmer', 'enrollment', 'teilnehmerverwaltung'],
	'anmelden': ['einschreibung', 'teilnehmer', 'enrollment'],
	'bestenliste': ['rangliste', 'ranking', 'langzeitwertung', 'jahreswertung'],
	'rangliste': ['ranking', 'langzeitwertung', 'jahreswertung'],
	'wiederherstellen': ['wiederherstellung', 'restore', 'recovery', 'datenrücksicherung', 'einspielen'],
	'wiederherstellung': ['restore', 'recovery', 'datenrücksicherung', 'einspielen'],
};
