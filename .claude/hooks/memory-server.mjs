#!/usr/bin/env node
// Vendored, zero-dependency MCP server for the memory graph (ADR-011).
//
// Serves the Obsidian-compatible vault (vault/) DIRECTLY — no build step, no store
// artifact. `vault-loader.mjs` parses the notes into the same entity/relation shape a
// built store used, so the BM25/EN+DE ranked search (`search-index.mjs`) that ADR-008
// introduced is reused UNCHANGED. No npm dependency, no LLM, no embeddings: pure Node,
// fully deterministic.
//
// Transport: MCP stdio = newline-delimited JSON-RPC 2.0 over stdin/stdout. We reload
// the vault fresh on each call so a note edit is picked up without restarting. Existing
// tool NAMES are unchanged (read_graph / open_nodes / search_nodes); ADR-011 adds the
// heading-addressable read (document_map / section_read) and graph walks
// (backlinks / traverse).
//
// Fail-soft: any handler error becomes an empty result or a JSON-RPC error,
// never a crash — a flaky vault must not take the session down.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { entityToDoc } from '../graph-store.mjs';
import {
	loadVault, autokeywordsFor, documentMap, sectionRead, backlinks as backlinksOf,
} from '../vault-loader.mjs';
import { extractKeywords } from '../keyword-extract.mjs';
import { buildIndex, search } from '../search-index.mjs';
import SYNONYMS from '../search-synonyms.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)); // .claude/hooks
const VAULT = resolve(HERE, '..', '..', 'vault');
const DEFAULT_PROTOCOL = '2025-06-18';

// ── graph helpers ────────────────────────────────────────────────────────────
function relationsAmong(relations, names) {
	const set = names instanceof Set ? names : new Set(names);
	return relations.filter((r) => set.has(r.from) && set.has(r.to));
}

function readGraph() {
	const { entities, relations } = loadVault(VAULT);
	return { entities, relations };
}

function openNodes(names) {
	const want = new Set(names ?? []);
	const { entities, relations } = loadVault(VAULT);
	const hit = entities.filter((e) => want.has(e.name));
	return { entities: hit, relations: relationsAmong(relations, hit.map((e) => e.name)) };
}

function searchNodes(query, limit) {
	const { notes, entities, relations } = loadVault(VAULT);
	const index = buildIndex(
		entities.map((e) => entityToDoc(e, autokeywordsFor(notes.get(e.name), notes, extractKeywords))),
	);
	const ranked = search(index, query, { synonyms: SYNONYMS, limit: limit ?? 8 });
	const byName = new Map(entities.map((e) => [e.name, e]));
	const hit = ranked.map((r) => ({ ...byName.get(r.id), score: Number(r.score.toFixed(4)) }));
	return { entities: hit, relations: relationsAmong(relations, hit.map((e) => e.name)) };
}

// ADR-011 tools — the heading-addressable read (frugal section retrieval) and graph walks.
function docMap(id) {
	const { notes } = loadVault(VAULT);
	const note = notes.get(id);
	if (!note) return { error: `no such note: ${id}` };
	const headings = documentMap(note);
	// A flat atomic note has nothing to narrow to — either no headings at all, or only
	// its H1 title (whose "section" is the whole note). Say so, with a line count and how
	// to read it whole, instead of a bare `headings: []` that reads as empty/broken and
	// triggers a wasted round-trip before the agent gives up and reads the note anyway.
	if (headings.every((h) => h.level <= 1)) {
		const bodyLines = note.body.split('\n').filter((l) => l.trim()).length;
		return {
			id,
			relPath: note.relPath,
			headings,
			flat: true,
			bodyLines,
			hint: `Flat atomic note — nothing to narrow to. Read it whole: section_read("${id}") with no \`section\` returns the full body. (open_nodes surfaces only the essence + keywords.)`,
		};
	}
	return { id, relPath: note.relPath, headings };
}

function sectionReadTool(id, section) {
	const { notes } = loadVault(VAULT);
	const note = notes.get(id);
	if (!note) return { error: `no such note: ${id}` };
	const target = String(section ?? '').trim();
	// No section → the whole body. This is the only MCP way to read a flat atomic note in
	// full (document_map's `flat` hint points here); for a structured note it is a handy
	// "give me everything".
	if (!target) return { id, section: null, text: note.body.trim() };
	const text = sectionRead(note, target);
	if (text == null) return { error: `no section "${section}" in ${id}` };
	return { id, section, text };
}

function backlinksTool(id) {
	const { relations } = loadVault(VAULT);
	return { id, backlinks: backlinksOf(id, relations) };
}

// Walk typed edges outward from a start note, up to `depth` hops (default 1),
// optionally restricted to one edge type.
function traverse(id, edge, depth) {
	const { relations } = loadVault(VAULT);
	const maxDepth = Math.max(1, Math.min(5, depth ?? 1));
	const nodes = new Set([id]);
	const edges = [];
	let frontier = [id];
	for (let d = 0; d < maxDepth; d++) {
		const next = [];
		for (const from of frontier) {
			for (const r of relations) {
				if (r.from !== from) continue;
				if (edge && r.relationType !== edge) continue;
				edges.push({ from: r.from, to: r.to, relationType: r.relationType });
				if (!nodes.has(r.to)) { nodes.add(r.to); next.push(r.to); }
			}
		}
		frontier = next;
	}
	return { start: id, nodes: [...nodes], edges };
}

// ── tool registry ────────────────────────────────────────────────────────────
const TOOLS = [
	{
		name: 'read_graph',
		description: 'Return the entire memory graph (all entities and relations).',
		inputSchema: { type: 'object', properties: {} },
	},
	{
		name: 'open_nodes',
		description: 'Return specific entities by exact name, plus relations among them.',
		inputSchema: {
			type: 'object',
			properties: { names: { type: 'array', items: { type: 'string' } } },
			required: ['names'],
		},
	},
	{
		name: 'search_nodes',
		description:
			'Search the memory graph with a NATURAL-LANGUAGE query. Returns entities ' +
			'ranked by relevance (BM25 over names, keywords, and essence, with synonym ' +
			'expansion). A full phrase works — you no longer need a single literal keyword.',
		inputSchema: {
			type: 'object',
			properties: {
				query: { type: 'string', description: 'Natural-language search query.' },
				limit: { type: 'number', description: 'Max results (default 8).' },
			},
			required: ['query'],
		},
	},
	{
		name: 'document_map',
		description:
			'List a note\'s heading paths (id = an entity name from search_nodes/read_graph), ' +
			'without its body — so you can pick the exact section to read next. Frugal. A flat ' +
			'atomic note (most notes) has no sub-sections: the result carries `flat: true` + a ' +
			'line count — read it whole via section_read(id) with no section, do not narrow.',
		inputSchema: {
			type: 'object',
			properties: { id: { type: 'string', description: 'Note id (entity name).' } },
			required: ['id'],
		},
	},
	{
		name: 'section_read',
		description:
			'Read ONE section of a note by heading (text or slug). Pair with document_map: ' +
			'map first to see the headings, then read only the section you need. Omit `section` ' +
			'to get the whole body — the way to read a flat atomic note (document_map reports ' +
			'`flat: true` for those) in full.',
		inputSchema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'Note id (entity name).' },
				section: {
					type: 'string',
					description: 'Heading text or slug from document_map. Omit for the whole body.',
				},
			},
			required: ['id'],
		},
	},
	{
		name: 'backlinks',
		description: 'List notes that link TO this note (reverse adjacency), with the edge type.',
		inputSchema: {
			type: 'object',
			properties: { id: { type: 'string', description: 'Note id (entity name).' } },
			required: ['id'],
		},
	},
	{
		name: 'traverse',
		description:
			'Walk typed edges outward from a note up to `depth` hops (default 1), optionally ' +
			'restricted to one `edge` type. Returns the reachable nodes and the edges walked.',
		inputSchema: {
			type: 'object',
			properties: {
				id: { type: 'string', description: 'Start note id (entity name).' },
				edge: { type: 'string', description: 'Optional edge type to follow (e.g. subsystem_of).' },
				depth: { type: 'number', description: 'Hops to walk (default 1, max 5).' },
			},
			required: ['id'],
		},
	},
];

function callTool(name, args = {}) {
	switch (name) {
		case 'read_graph':
			return readGraph();
		case 'open_nodes':
			return openNodes(args.names);
		case 'search_nodes':
			return searchNodes(String(args.query ?? ''), args.limit);
		case 'document_map':
			return docMap(String(args.id ?? ''));
		case 'section_read':
			return sectionReadTool(String(args.id ?? ''), args.section);
		case 'backlinks':
			return backlinksTool(String(args.id ?? ''));
		case 'traverse':
			return traverse(String(args.id ?? ''), args.edge ? String(args.edge) : null, args.depth);
		default:
			throw new Error(`unknown tool: ${name}`);
	}
}

// ── JSON-RPC dispatch ────────────────────────────────────────────────────────
function handle(msg) {
	const { id, method, params } = msg;
	const isRequest = id !== undefined && id !== null;

	try {
		switch (method) {
			case 'initialize':
				return reply(id, {
					protocolVersion: params?.protocolVersion ?? DEFAULT_PROTOCOL,
					capabilities: { tools: {} },
					serverInfo: { name: 'harness-memory', version: '1.0.0' },
				});
			case 'tools/list':
				return reply(id, { tools: TOOLS });
			case 'tools/call': {
				const result = callTool(params?.name, params?.arguments ?? {});
				return reply(id, {
					content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
				});
			}
			case 'ping':
				return reply(id, {});
			default:
				// Notifications (no id) need no response; unknown requests get an error.
				if (!isRequest) return null;
				return error(id, -32601, `method not found: ${method}`);
		}
	} catch (e) {
		if (!isRequest) return null;
		return error(id, -32603, e?.message ?? 'internal error');
	}
}

function reply(id, result) {
	return { jsonrpc: '2.0', id, result };
}
function error(id, code, message) {
	return { jsonrpc: '2.0', id, error: { code, message } };
}
function send(obj) {
	if (obj) process.stdout.write(`${JSON.stringify(obj)}\n`);
}

// ── stdin loop: newline-delimited JSON ───────────────────────────────────────
let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
	buf += chunk;
	let nl;
	while ((nl = buf.indexOf('\n')) !== -1) {
		const line = buf.slice(0, nl).trim();
		buf = buf.slice(nl + 1);
		if (!line) continue;
		let msg;
		try {
			msg = JSON.parse(line);
		} catch {
			continue; // ignore unparseable lines rather than dying
		}
		send(handle(msg));
	}
});
process.stdin.on('end', () => process.exit(0));
