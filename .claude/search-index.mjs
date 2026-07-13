// Deterministic, BILINGUAL (English + German) lexical search over the memory graph.
// Pure, dependency-free: tokenize → synonym-expand → prefix-expand → BM25 rank.
// No embeddings, no LLM, no randomness — the same query over the same store always
// returns the same order. Used by memory-server.mjs (runtime) and search-selftest.mjs.
//
// Why no stemmer: a stemmer good for English ("gates"→"gate") corrupts German
// ("Haus"→"Hau") and still cannot relate "Kunde"/"Kunden" (umlaut/-en) or
// "Rechnung"/"Rechnungen" (-en). Instead we keep raw tokens and expand a query term
// to every index-vocabulary term it shares a prefix with (min length 4). That
// relates additive inflections in BOTH languages — gates/gate, tests/testing,
// kunde/kunden, rechnung/rechnungen — deterministically, with no lossy collisions.

// Stopwords carry no retrieval signal. English + German function words only —
// nothing domain-specific (NOT "build"/"test"/"gate"/"kunde": those are queries).
export const STOPWORDS = new Set([
	// English
	'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'of', 'to', 'in',
	'on', 'at', 'by', 'for', 'with', 'as', 'is', 'are', 'was', 'were', 'be', 'been',
	'being', 'do', 'does', 'did', 'how', 'what', 'when', 'where', 'which', 'who',
	'why', 'this', 'that', 'these', 'those', 'it', 'its', 'you', 'we', 'they',
	'my', 'our', 'your', 'can', 'could', 'would', 'should', 'will', 'shall', 'may',
	'about', 'into', 'from', 'me', 'so', 'no', 'not', 'up', 'out', 'via',
	// German
	'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem',
	'eines', 'einer', 'und', 'oder', 'aber', 'wenn', 'dann', 'sonst', 'von', 'zu',
	'im', 'am', 'auf', 'an', 'bei', 'mit', 'als', 'ist', 'sind', 'war', 'waren',
	'sein', 'wie', 'wann', 'wo', 'welche', 'welcher', 'welches', 'wer', 'warum',
	'dies', 'diese', 'dieser', 'dieses', 'jene', 'jener', 'man', 'nicht', 'nein',
	'auch', 'noch', 'nur', 'sich', 'dass', 'vom', 'zum', 'zur', 'kann', 'soll',
	'wird', 'werden', 'über', 'ich', 'du', 'wir', 'ihr', 'sie', 'es', 'mein',
	'unser', 'dein', 'für', 'durch', 'gibt', 'haben', 'hat', 'wurde', 'wurden',
]);

// Field weights: a term in the entity name counts more than one buried in prose.
export const FIELD_WEIGHTS = {
	name: 6,
	keywords: 4,
	autokeywords: 2,
	essence: 3,
	type: 1,
};

// Per-entityType score multiplier. Provenance/rationale and overview entities are
// secondary to the living thing they describe: a targeted query should surface the
// specific subsystem/operation first, with the topic MOC (`guide`), the ADR that
// decided it (`decision`), or the incident that exercised it (`incident`/`state`) just
// behind. They stay fully findable — only nudged down, not hidden. Unlisted = 1.0.
export const TYPE_WEIGHTS = {
	guide: 0.7,
	decision: 0.8,
	incident: 0.75,
	source: 0.6,
	state: 0.8,
};

// Query-term weights by how the term was derived (exact match counts most).
const W_EXACT = 1.0;
const W_SYNONYM = 0.85;
const W_PREFIX = 0.5; // one term is a whole prefix of the other (gates/gate, kunde/kunden)
const W_STEM = 0.4; // terms share a long common prefix (verwalten/verwaltung, berechnet/berechnung)

const K1 = 1.5;
const B = 0.75;
const PREFIX_MIN = 4; // both sides must be ≥ this length to prefix-match
const STEM_MIN = 5; // shared-prefix length to treat two terms as the same stem

// Length of the common prefix of two strings.
function commonPrefixLen(a, b) {
	const m = Math.min(a.length, b.length);
	let i = 0;
	while (i < m && a[i] === b[i]) i++;
	return i;
}

// Tokenize text into normalized terms: lowercase, unicode-aware split (keeps
// ü/ä/ö/ß and any letter/digit), drop stopwords and 1-char tokens. No stemming.
export function tokenize(text) {
	return String(text ?? '')
		.toLowerCase()
		.split(/[^\p{L}\p{N}]+/u)
		.filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

// Build a BM25 index from documents shaped as { id, fields: { name, keywords,
// autokeywords, essence, type } } (field values are strings).
export function buildIndex(docs) {
	const postings = []; // [{ id, tf: Map<term, weightedCount>, len }]
	const df = new Map(); // term → number of docs containing it (also the vocabulary)
	let totalLen = 0;

	for (const doc of docs) {
		const tf = new Map();
		let len = 0;
		for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
			const w = weight ?? 1;
			for (const term of tokenize(doc.fields?.[field])) {
				tf.set(term, (tf.get(term) ?? 0) + w);
				len += w;
			}
		}
		for (const term of tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
		totalLen += len;
		postings.push({ id: doc.id, tf, len, type: doc.type });
	}

	const avgdl = postings.length ? totalLen / postings.length : 0;
	return { postings, df, avgdl, n: postings.length };
}

// Normalize a raw synonym map { "word": ["syn", ...] } so both sides are tokenized
// — lets the curated map be written in plain natural words (EN or DE).
export function normalizeSynonyms(raw) {
	if (!raw) return null;
	const map = {};
	for (const [k, vals] of Object.entries(raw)) {
		for (const key of tokenize(k)) {
			const bucket = (map[key] ??= []);
			for (const v of vals) for (const tv of tokenize(v)) if (!bucket.includes(tv)) bucket.push(tv);
		}
	}
	return map;
}

// Build the effective weighted query: exact tokens, then synonym expansion, then
// prefix expansion against the index vocabulary. A term reached multiple ways keeps
// its highest weight. Returns Map<term, weight>.
export function expandQuery(index, query, synonyms) {
	const base = tokenize(query);
	const weights = new Map();
	const bump = (t, w) => weights.set(t, Math.max(weights.get(t) ?? 0, w));
	for (const t of base) bump(t, W_EXACT);

	const syn = normalizeSynonyms(synonyms);
	if (syn) for (const t of base) for (const h of syn[t] ?? []) bump(h, W_SYNONYM);

	// Prefix expansion: relate inflections/compounds in either language against the
	// actual vocabulary. A full-prefix relation (gates⊃gate) is strong; a shared long
	// prefix (verwalten≈verwaltung, berechnet≈berechnung) is a weaker stem signal.
	for (const q of new Set(base)) {
		if (q.length < PREFIX_MIN) continue;
		for (const v of index.df.keys()) {
			if (v === q) continue;
			if (Math.min(v.length, q.length) < PREFIX_MIN) continue;
			if (v.startsWith(q) || q.startsWith(v)) bump(v, W_PREFIX);
			else if (commonPrefixLen(v, q) >= STEM_MIN) bump(v, W_STEM);
		}
	}
	return weights;
}

// Score every document against the query with weighted BM25; return ranked
// [{ id, score }] (descending, deterministic tie-break by id).
export function search(index, query, { synonyms, limit = 8 } = {}) {
	const weights = expandQuery(index, query, synonyms);
	if (!weights.size) return [];
	const { postings, df, avgdl, n } = index;
	const scored = [];
	for (const p of postings) {
		let score = 0;
		for (const [term, qw] of weights) {
			const f = p.tf.get(term);
			if (!f) continue;
			const idf = Math.log(1 + (n - df.get(term) + 0.5) / (df.get(term) + 0.5));
			const denom = f + K1 * (1 - B + (B * p.len) / (avgdl || 1));
			score += qw * idf * ((f * (K1 + 1)) / denom);
		}
		score *= TYPE_WEIGHTS[p.type] ?? 1;
		if (score > 1e-9) scored.push({ id: p.id, score });
	}
	scored.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	return scored.slice(0, limit);
}
