// Shared reader for the built memory store (.claude/knowledge-graph.json, JSONL).
// Used by memory-server.mjs (runtime search) and search-selftest.mjs (the gate) so
// both build search documents from entities in exactly the same way.
import { readFileSync } from 'node:fs';

// Parse the JSONL store into { entities, relations }. Tolerant: blank/garbage lines
// are skipped so a partially-written store degrades to "fewer results", never a crash.
export function loadStore(path) {
	const entities = [];
	const relations = [];
	let text;
	try {
		text = readFileSync(path, 'utf8');
	} catch {
		return { entities, relations };
	}
	for (const line of text.split('\n')) {
		const s = line.trim();
		if (!s) continue;
		let rec;
		try {
			rec = JSON.parse(s);
		} catch {
			continue;
		}
		if (rec.type === 'entity' && rec.name) entities.push(rec);
		else if (rec.type === 'relation' && rec.from && rec.to) relations.push(rec);
	}
	return { entities, relations };
}

// Turn an entity into a weighted search document. The committed store stays lean,
// so the rich, doc-derived keyword bag is passed in separately (from the search
// sidecar) rather than living in the entity's observations. The `→ file#slug`
// pointer line is excluded from scoring (navigation target, not content); a
// `Keywords:` observation feeds the curated-synonym field.
export function entityToDoc(entity, autokeywords = '') {
	const essence = [];
	let keywords = '';
	for (const obs of entity.observations ?? []) {
		const o = String(obs);
		if (o.startsWith('Keywords:')) keywords += ` ${o.slice('Keywords:'.length)}`;
		else if (/→\s+[^\s#]+#[^\s#]+/.test(o)) continue; // pointer line: skip
		else essence.push(o);
	}
	return {
		id: entity.name,
		type: entity.entityType,
		fields: {
			name: entity.name.replace(/[-_]/g, ' '),
			keywords,
			autokeywords: String(autokeywords ?? ''),
			essence: essence.join(' '),
			type: String(entity.entityType ?? '').replace(/[-_]/g, ' '),
		},
	};
}

// Load the search sidecar (entity-name → auto-keyword string) written by
// build-graph.mjs. Missing/garbled sidecar degrades to an empty map, never a crash —
// search still works on essence + curated keywords alone.
export function loadSidecar(path) {
	try {
		const data = JSON.parse(readFileSync(path, 'utf8'));
		const map = data && typeof data.autokeywords === 'object' ? data.autokeywords : {};
		return map ?? {};
	} catch {
		return {};
	}
}
