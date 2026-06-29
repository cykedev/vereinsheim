// Deterministic keyword extraction from a markdown doc section. Pure, dependency-free
// (beyond the shared tokenizer). This is the "automatic, extensive keywording": the
// richer the doc section a graph entity points at, the more search vocabulary it
// gains — for free, language-agnostic (EN/DE), and stable across rebuilds.
//
// Salience: sub-headings, **bold** and `code` spans count more than plain prose,
// then term frequency over the whole section. Output is the top-N tokens, sorted
// alphabetically so the build artifact diffs cleanly.
import { tokenize } from './search-index.mjs';

// Low-signal tokens that leak in from doc sections: bare numbers (ADR refs, list
// indices), date/format placeholders, and file-extension fragments. They add noise
// without disambiguating, so they are excluded from the keyword bag.
const NOISE = new Set(['yyyy', 'mm', 'dd', 'nnn', 'mjs', 'json', 'md']);
const isNoise = (t) => /^\d+$/.test(t) || NOISE.has(t);

export function extractKeywords(fragment, { limit = 30, minLen = 3 } = {}) {
	const score = new Map();
	const add = (text, weight) => {
		for (const t of tokenize(text)) score.set(t, (score.get(t) ?? 0) + weight);
	};

	const md = String(fragment ?? '');

	// Structural salience: sub-headings inside the section.
	for (const line of md.split('\n')) {
		const h = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
		if (h) add(h[1], 5);
	}
	// Emphasis: bold and inline code.
	for (const m of md.matchAll(/\*\*([^*]+)\*\*/g)) add(m[1], 4);
	for (const m of md.matchAll(/`([^`]+)`/g)) add(m[1], 4);
	// Body term frequency (headings/emphasis included again → they keep their bonus).
	add(md, 1);

	return [...score.entries()]
		.filter(([t]) => t.length >= minLen && !isNoise(t))
		.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
		.slice(0, limit)
		.map(([t]) => t)
		.sort();
}
