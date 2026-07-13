// Zero-dependency loader for the Obsidian-compatible knowledge vault (ADR-011).
//
// Reads every note under vault/ (Markdown + YAML-subset frontmatter) into the SAME
// { entities, relations } shape the old built JSONL store produced — so entityToDoc()
// and search-index.mjs (BM25/EN+DE) are reused UNCHANGED. There is no build step and
// no store artifact: the memory MCP server calls loadVault() at startup and holds the
// graph in memory.
//
// Also exposes the heading-addressable read (document_map / section_read — the same
// doc-index.mjs logic that backed doc.mjs, now over vault notes) and the edge
// adjacency (backlinks / traverse). Fail-soft: a malformed note is skipped with a
// warning, never a crash.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { headingSlugs, readFragment, slugify } from './doc-index.mjs';

// A note's `type` (frontmatter) is its KIND — it drives search weighting
// (search-index.mjs TYPE_WEIGHTS: decision/incident nudged below the living entity)
// and semantics. It is decoupled from the folder: FOLDERS are TOPICS (architecture/,
// workflow/, gates/, knowledge/ …), one big topic per folder, each with a MOC hub.
// `incident` is the REMEMBER-tier home (ADR-003) — project-specific incidents/state.
// `source` is provenance for ingested content (one note per origin doc; see KNOWLEDGE.md
// §6). Raw originals live under `.raw/`, which the loader skips (dot-prefixed).
export const NODE_TYPES = ['guide', 'decision', 'subsystem', 'operation', 'concept', 'incident', 'source'];

// Edge vocabulary (see vault/SCHEMA.md §4). Unknown keys warn.
export const EDGE_TYPES = [
	'subsystem_of', 'operation_of', 'feature_of', 'part_of',
	'governed_by', 'informed_by', 'documented_in',
	'supersedes', 'refines',
	'alternative_to', 'depends_on',
	'relates_to', 'see_also', 'contrasts_with',
];

// Meta files that are not entities.
const META = new Set(['index.md', 'hot.md', 'SCHEMA.md', 'README.md']);

// ── frontmatter (targeted YAML subset — we control the emitter) ────────────────
// Handles: scalars (`key: value`), inline lists (`key: [a, "b c"]`), and one level of
// nested map under `edges:` whose values are inline lists of quoted "[[id#sec]]".
function stripQuotes(s) {
	const t = s.trim();
	if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
		return t.slice(1, -1);
	}
	return t;
}

function parseInlineList(raw) {
	const t = raw.trim();
	if (!t.startsWith('[')) return t ? [stripQuotes(t)] : [];
	const inner = t.replace(/^\[/, '').replace(/\]$/, '');
	if (!inner.trim()) return [];
	// split on commas that are not inside quotes
	const out = [];
	let cur = '';
	let q = '';
	for (const ch of inner) {
		if (q) {
			if (ch === q) q = '';
			else cur += ch;
		} else if (ch === '"' || ch === "'") {
			q = ch;
		} else if (ch === ',') {
			out.push(cur);
			cur = '';
		} else {
			cur += ch;
		}
	}
	if (cur.trim()) out.push(cur);
	return out.map((s) => stripQuotes(s)).filter(Boolean);
}

// "[[harness#the-knowledge-system|alias]]" → { id: 'harness', section: 'the-knowledge-system' }
export function parseWikilink(value) {
	const m = /\[\[([^\]]+)\]\]/.exec(String(value).trim());
	const inner = (m ? m[1] : String(value)).trim();
	const noAlias = inner.split('|')[0];
	const [id, section] = noAlias.split('#');
	return { id: id.trim(), section: section ? section.trim() : null };
}

function parseFrontmatter(raw) {
	if (!raw.startsWith('---')) return { data: {}, body: raw };
	const rest = raw.slice(3);
	const end = rest.indexOf('\n---');
	if (end === -1) return { data: {}, body: raw };
	const fmText = rest.slice(0, end);
	const body = rest.slice(end + 4).replace(/^\r?\n/, '');
	const data = {};
	const lines = fmText.split('\n');
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (!line.trim() || /^\s*#/.test(line)) continue;
		if (/^\S/.test(line)) {
			const m = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
			if (!m) continue;
			const [, key, val] = m;
			if (!val.trim()) {
				// Empty value → a YAML block list ("  - item", the form Obsidian's
				// Properties UI writes) or an empty scalar. Collect the block items.
				const items = [];
				while (i + 1 < lines.length && /^\s+-\s/.test(lines[i + 1])) {
					items.push(stripQuotes(lines[++i].replace(/^\s+-\s+/, '')));
				}
				data[key] = items.length ? items : '';
			} else if (val.trim().startsWith('[')) {
				data[key] = parseInlineList(val);
			} else {
				data[key] = stripQuotes(val);
			}
		}
	}
	return { data, body };
}

// ── walk the vault ─────────────────────────────────────────────────────────────
function walk(dir, root, out) {
	for (const name of readdirSync(dir)) {
		// Skip hidden (.obsidian, .git) and Obsidian meta dirs (_templates, _attachments).
		if (name.startsWith('.') || name.startsWith('_')) continue;
		const abs = join(dir, name);
		const st = statSync(abs);
		if (st.isDirectory()) walk(abs, root, out);
		else if (name.endsWith('.md')) out.push(abs);
	}
}

/**
 * Load the vault into memory.
 * @returns {{ notes: Map<string,object>, entities: object[], relations: object[],
 *            autokeywords: Record<string,string>, warnings: string[] }}
 */
export function loadVault(root) {
	const files = [];
	try {
		walk(root, root, files);
	} catch {
		return { notes: new Map(), entities: [], relations: [], autokeywords: {}, warnings: [] };
	}

	const notes = new Map();
	const warnings = [];

	for (const abs of files) {
		const relPath = relative(root, abs).split(sep).join('/');
		const base = relPath.split('/').pop();
		if (META.has(base)) continue;

		let raw;
		try {
			raw = readFileSync(abs, 'utf8');
		} catch (e) {
			warnings.push(`${relPath}: unreadable (${String(e)})`);
			continue;
		}
		const { data, body } = parseFrontmatter(raw);
		if (data.id === undefined && data.type === undefined) continue; // not an entity

		const id = typeof data.id === 'string' ? data.id : '';
		const type = typeof data.type === 'string' ? data.type : '';
		if (!id) { warnings.push(`${relPath}: missing id`); continue; }
		if (!NODE_TYPES.includes(type)) { warnings.push(`${relPath}: invalid type "${type}"`); continue; }
		if (notes.has(id)) { warnings.push(`${relPath}: duplicate id "${id}"`); continue; }

		// Edges are FLAT top-level frontmatter properties named by edge type — so each
		// is a real Obsidian link (graph view / backlinks), which a nested `edges:`
		// object is NOT (Obsidian ignores object-valued properties). The loader picks
		// out the known edge-type keys; other top-level keys are plain metadata.
		const edges = {};
		for (const k of EDGE_TYPES) {
			const v = data[k];
			if (v === undefined || v === '') continue;
			edges[k] = (Array.isArray(v) ? v : [v]).map(parseWikilink);
		}

		notes.set(id, {
			id,
			type,
			title: typeof data.title === 'string' ? data.title : id,
			aliases: Array.isArray(data.aliases) ? data.aliases : [],
			tags: Array.isArray(data.tags) ? data.tags : [],
			keywords: Array.isArray(data.keywords) ? data.keywords : [],
			status: typeof data.status === 'string' ? data.status : null,
			edges,
			body: body.trim(),
			relPath,
			topic: relPath.includes('/') ? relPath.split('/')[0] : '', // folder = topic
		});
	}

	// Second pass: entities, relations, autokeywords.
	const entities = [];
	const relations = [];
	const autokeywords = {};

	for (const note of notes.values()) {
		// Lead paragraph = the essence line(s) the search + open_nodes surface.
		const lead = note.body.split(/\n#{1,6}\s/)[0].split('\n\n')[0].trim();
		const observations = [];
		if (note.status) observations.push(`Status: ${note.status}`);
		observations.push(lead || note.title);
		if (note.keywords.length) observations.push(`Keywords: ${note.keywords.join(' ')}`);

		entities.push({
			type: 'entity',
			name: note.id,
			entityType: note.type,
			observations,
			relPath: note.relPath,
		});

		for (const [edge, targets] of Object.entries(note.edges)) {
			for (const t of targets) {
				relations.push({ type: 'relation', from: note.id, to: t.id, relationType: edge });
				if (!notes.has(t.id)) warnings.push(`${note.relPath}: dangling edge ${edge} -> "${t.id}"`);
			}
		}
	}

	// autokeywords come from search-index consumers; computed lazily by the server to
	// avoid importing keyword-extract here. Exposed via helper below instead.
	return { notes, entities, relations, autokeywords, warnings };
}

// Build the auto-keyword bag for one note: its whole body, PLUS the exact section of
// any `documented_in` target it links (so a thin atomic note inherits the depth of the
// guide section that documents it — no duplicated prose). `extract` is injected to keep
// this module dependency-light.
export function autokeywordsFor(note, notes, extract) {
	const terms = new Set();
	for (const k of extract(note.body)) terms.add(k);
	for (const t of note.edges.documented_in ?? []) {
		const target = notes.get(t.id);
		if (!target) continue;
		// With a section anchor, inherit just that section; without one, the whole
		// target note documents this concept (e.g. an operation → its ADR) — inherit it
		// all. Either way a thin atomic note gains the vocabulary of its documentation
		// without duplicating the prose (single source of truth).
		const frag = t.section ? readFragment(target.body, slugify(t.section)) : target.body;
		if (frag) for (const k of extract(frag)) terms.add(k);
	}
	return [...terms].sort().join(' ');
}

// document_map: the heading paths of a note (slug list), like doc.mjs <file>.
export function documentMap(note) {
	return headingSlugs(note.body).map((h) => ({ level: h.level, text: h.text, slug: h.slug }));
}

// section_read: one section by slug (or by heading text — slugified), like doc.mjs <file>#<slug>.
export function sectionRead(note, target) {
	return readFragment(note.body, slugify(target));
}

// backlinks: notes that link TO id (reverse adjacency), grouped by edge type.
export function backlinks(id, relations) {
	return relations.filter((r) => r.to === id).map((r) => ({ from: r.from, edge: r.relationType }));
}
