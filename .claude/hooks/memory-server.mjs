#!/usr/bin/env node
// Vendored, zero-dependency MCP server for the memory graph.
//
// Replaces the upstream @modelcontextprotocol/server-memory (whose `search_nodes`
// only did LITERAL substring matching) with our own search: tokenized,
// synonym-expanded, BM25-ranked — so natural-language queries return ranked hits.
// No npm dependency, no LLM, no embeddings: pure Node, fully deterministic.
//
// Transport: MCP stdio = newline-delimited JSON-RPC 2.0 over stdin/stdout. We read
// the store (.claude/knowledge-graph.json, JSONL) fresh on each search so a rebuild
// is picked up without restarting the server. Tool NAMES are unchanged
// (read_graph / open_nodes / search_nodes) so nothing downstream breaks.
//
// Fail-soft: any handler error becomes an empty result or a JSON-RPC error,
// never a crash — a flaky store must not take the session down.
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { loadStore, loadSidecar, entityToDoc } from '../graph-store.mjs';
import { buildIndex, search } from '../search-index.mjs';
import SYNONYMS from '../search-synonyms.mjs';

const HERE = dirname(fileURLToPath(import.meta.url)); // .claude/hooks
const STORE = resolve(HERE, '..', 'knowledge-graph.json');
const SEARCH_SIDECAR = resolve(HERE, '..', 'knowledge-graph.search.json');
const DEFAULT_PROTOCOL = '2025-06-18';

// ── graph helpers ────────────────────────────────────────────────────────────
function relationsAmong(relations, names) {
	const set = names instanceof Set ? names : new Set(names);
	return relations.filter((r) => set.has(r.from) && set.has(r.to));
}

function readGraph() {
	const { entities, relations } = loadStore(STORE);
	return { entities, relations };
}

function openNodes(names) {
	const want = new Set(names ?? []);
	const { entities, relations } = loadStore(STORE);
	const hit = entities.filter((e) => want.has(e.name));
	return { entities: hit, relations: relationsAmong(relations, hit.map((e) => e.name)) };
}

function searchNodes(query, limit) {
	const { entities, relations } = loadStore(STORE);
	const autokw = loadSidecar(SEARCH_SIDECAR);
	const index = buildIndex(entities.map((e) => entityToDoc(e, autokw[e.name] ?? '')));
	const ranked = search(index, query, { synonyms: SYNONYMS, limit: limit ?? 8 });
	const byName = new Map(entities.map((e) => [e.name, e]));
	const hit = ranked.map((r) => ({ ...byName.get(r.id), score: Number(r.score.toFixed(4)) }));
	return { entities: hit, relations: relationsAmong(relations, hit.map((e) => e.name)) };
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
];

function callTool(name, args = {}) {
	switch (name) {
		case 'read_graph':
			return readGraph();
		case 'open_nodes':
			return openNodes(args.names);
		case 'search_nodes':
			return searchNodes(String(args.query ?? ''), args.limit);
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
