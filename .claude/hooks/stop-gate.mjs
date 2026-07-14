#!/usr/bin/env node
// Stop-Gate (ADR-018, ENFORCE auf Harness-Ebene): blockt das Turn-Ende, bis
// `pnpm check` grün ist (lint/format/test/tsc/next build, turbo-gecacht → billig
// bei No-Change). Fail-open: pnpm fehlt ODER Dev-Postgres nicht erreichbar → erlauben
// (nie bricken). `evaluate()` ist der reine Check (geteilt mit dem stop.mjs-Dispatcher);
// der Standalone-Runner unten erhält das Hook-Verhalten (stop_hook_active-Guard).
import { execSync } from 'node:child_process';
import { createConnection } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readInput } from './_lib.mjs';

// harness:gate-fast — das Turn-Gate. `true` wäre ein No-op; hier: die volle 5er-Gate.
const GATE = { command: 'pnpm check' };
// harness:dev-db — der geteilte Dev-Postgres (docker-compose.dev.yml: ports "5432:5432").
// Die `test`-Gate braucht ihn; läuft er NICHT, kann `pnpm check` unmöglich grün werden —
// dann fail-open statt blocken (ein Infra-Fehlen kann der User nicht "grün ziehen"). Ein
// TCP-Connect ist robuster als Fehler-Text-Matching: Prisma 7 + pg-Adapter liefern keinen
// stabilen DB-down-Marker im Test-Output.
const DEV_DB = { host: '127.0.0.1', port: 5432 };

function dbReachable({ host, port }, timeoutMs = 2000) {
	return new Promise((res) => {
		const sock = createConnection({ host, port });
		let settled = false;
		const done = (ok) => {
			if (settled) return;
			settled = true;
			sock.destroy();
			res(ok);
		};
		sock.setTimeout(timeoutMs);
		sock.once('connect', () => done(true));
		sock.once('timeout', () => done(false));
		sock.once('error', () => done(false));
	});
}

// Liefert { block, message?, note? }. block=true → Gates rot, Turn-Ende halten.
// note = nicht-blockierender Hinweis (vom Dispatcher + Standalone-Runner ausgegeben).
export async function evaluate() {
	try {
		// Vorab: läuft die Dev-DB? Wenn nicht, sind die DB-Tests zwangsläufig rot → fail-open.
		if (!(await dbReachable(DEV_DB))) {
			return {
				block: false,
				note: `[stop-gate] Dev-Postgres (${DEV_DB.host}:${DEV_DB.port}) nicht erreichbar — Gate ÜBERSPRUNGEN (fail-open). Vor dem Commit grün ziehen: docker compose -f docker-compose.dev.yml up -d && pnpm check`,
			};
		}
		execSync(GATE.command, { stdio: 'pipe', timeout: 600000 });
		return { block: false };
	} catch (e) {
		if (e.code === 'ENOENT') return { block: false };
		const out = ((e.stdout && e.stdout.toString()) || '') + ((e.stderr && e.stderr.toString()) || '');
		// Netz: DB bricht mitten im Lauf weg (Reachability-Check war grün) → weiterhin fail-open.
		if (/ECONNREFUSED|SASL|password authentication|could not connect|Connection terminated|getaddrinfo|Can't reach database/i.test(out)) {
			return { block: false, note: '[stop-gate] Dev-Postgres während des Laufs nicht erreichbar — Gate übersprungen (fail-open). Starte: docker compose -f docker-compose.dev.yml up -d' };
		}
		return { block: true, message: `[stop-gate] Gates sind ROT — bitte grün ziehen, bevor du aufhörst:\n${out.slice(-2200)}` };
	}
}

async function main() {
	try {
		const input = await readInput();
		if (input.stop_hook_active) process.exit(0);
		const r = await evaluate();
		if (r.note) console.error(r.note);
		if (r.block) {
			process.stderr.write(`${r.message}\n`);
			process.exit(2);
		}
	} catch {
		// fail-open
	}
	process.exit(0);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
