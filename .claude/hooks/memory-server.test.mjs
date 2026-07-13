#!/usr/bin/env node
// Smoke test for the vendored memory MCP server: spawns it, drives the JSON-RPC
// handshake + every tool over stdio, and asserts the responses. Guards the server
// protocol and the tool handlers (search_nodes / document_map / section_read /
// backlinks / traverse) against regression — the search RANKING is separately guarded
// by search-selftest.mjs. Runs in the gate via `node --test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SERVER = resolve(ROOT, '.claude', 'hooks', 'memory-server.mjs');

// Send every request, collect responses by id, resolve once all are in (then kill —
// don't rely on the server's stdin-end exit, which could truncate the last write).
function drive(requests, timeoutMs = 15000) {
	return new Promise((resolvePromise, reject) => {
		const p = spawn('node', [SERVER], { cwd: ROOT });
		const wantIds = requests.filter((r) => r.id != null).map((r) => r.id);
		const got = new Map();
		let buf = '';
		const timer = setTimeout(() => {
			p.kill();
			reject(new Error(`timeout; got ids [${[...got.keys()]}]`));
		}, timeoutMs);
		p.stdout.on('data', (d) => {
			buf += d;
			let nl;
			while ((nl = buf.indexOf('\n')) !== -1) {
				const line = buf.slice(0, nl).trim();
				buf = buf.slice(nl + 1);
				if (!line) continue;
				let m;
				try { m = JSON.parse(line); } catch { continue; }
				if (m.id != null) got.set(m.id, m);
				if (wantIds.every((id) => got.has(id))) {
					clearTimeout(timer);
					p.kill();
					resolvePromise(got);
				}
			}
		});
		p.on('error', (e) => { clearTimeout(timer); reject(e); });
		for (const r of requests) p.stdin.write(`${JSON.stringify(r)}\n`);
	});
}

const call = (id, name, args) => ({
	jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args },
});
const payload = (r) => JSON.parse(r.result.content[0].text);

test('memory-server: handshake, tool list, all seven tools, and flat-note handling', async () => {
	const got = await drive([
		{ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
		{ jsonrpc: '2.0', id: 2, method: 'tools/list' },
		call(3, 'search_nodes', { query: 'quality gates lint typecheck', limit: 3 }),
		call(4, 'document_map', { id: 'harness-walkthrough' }),
		call(5, 'section_read', { id: 'harness-walkthrough', section: 'The four pillars' }),
		call(6, 'backlinks', { id: 'harness' }),
		call(7, 'traverse', { id: 'workflow', depth: 1 }),
		call(8, 'read_graph', {}),
		call(9, 'document_map', { id: 'knowledge' }),
		call(10, 'section_read', { id: 'knowledge' }),
	]);

	// initialize
	assert.equal(got.get(1).result.serverInfo.name, 'harness-memory');

	// tools/list — the four original + the three ADR-011 additions
	const tools = got.get(2).result.tools.map((t) => t.name);
	for (const t of ['read_graph', 'open_nodes', 'search_nodes', 'document_map', 'section_read', 'backlinks', 'traverse']) {
		assert.ok(tools.includes(t), `tools/list missing ${t}`);
	}

	// search_nodes → ranked entities, top hit is the gates subsystem
	const search = payload(got.get(3));
	assert.ok(search.entities.length > 0, 'search returned no entities');
	assert.equal(search.entities[0].name, 'quality-gates');

	// document_map → heading list for a note with headings
	const map = payload(got.get(4));
	assert.ok(map.headings.some((h) => h.text === 'The four pillars'), 'document_map missing headings');

	// section_read → just that section
	const section = payload(got.get(5));
	assert.match(section.text, /## The four pillars/);

	// backlinks → harness has inbound edges from its members
	const back = payload(got.get(6));
	assert.ok(back.backlinks.length > 0, 'harness has no backlinks');

	// traverse → reaches at least the start's neighbours
	const walk = payload(got.get(7));
	assert.ok(walk.nodes.includes('workflow'), 'traverse dropped the start node');
	assert.ok(walk.edges.length > 0, 'traverse found no edges');

	// read_graph → the whole graph
	const graph = payload(got.get(8));
	assert.ok(graph.entities.length >= 20, 'read_graph returned too few entities');
	assert.ok(graph.relations.length > 0, 'read_graph returned no relations');

	// document_map on a flat note (a topic MOC — no sub-headings; ADRs are structured now)
	// → flat flag + line count, no sub-headings
	const flat = payload(got.get(9));
	assert.equal(flat.flat, true, 'flat note not flagged flat');
	assert.ok(flat.bodyLines > 0, 'flat note reported no bodyLines');
	assert.ok(!flat.headings.some((h) => h.level > 1), 'flat note should have no sub-headings');

	// section_read with no section → the whole body
	const whole = payload(got.get(10));
	assert.match(whole.text, /knowledge/i, 'no-section read did not return the body');
});
