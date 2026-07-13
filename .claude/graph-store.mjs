// Turn a graph entity into a weighted search document. Shared by memory-server.mjs
// (runtime search) and search-selftest.mjs (the gate) so both build search documents
// from entities in exactly the same way. The entities come from vault-loader.mjs
// (ADR-011); the rich, note-body-derived keyword bag is passed in separately (see
// autokeywordsFor) rather than living in the entity's observations, so read_graph /
// open_nodes stay lean.
//
// A `Keywords:` observation feeds the curated-synonym field; the `→ file#slug` pointer
// line (if any) is excluded from scoring — it is a navigation target, not content.
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
