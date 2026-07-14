// Shared library for markdown heading addressing: GitHub-compatible slugs, heading
// extraction (code-fence aware, with duplicate disambiguation), and fragment
// reading. Used identically by doc.mjs (CLI reader), vault-loader.mjs (document_map /
// section_read), and vault-lint.mjs (anchor validation) so a heading can never resolve
// differently across them.

// GitHub-style slug: lowercase, strip punctuation but keep unicode letters
// (so ü/ä/ö survive), then turn each whitespace char into one hyphen (a run of
// two spaces — e.g. around an em-dash — becomes "--", matching GitHub).
export function slugify(text) {
	return String(text)
		.trim()
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s_-]/gu, '')
		.replace(/\s/g, '-');
}

export function headingSlugs(markdown) {
	const lines = String(markdown).split('\n');
	const seen = new Map();
	const out = [];
	let inFence = false;
	let fenceChar = '';
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const fence = line.match(/^\s*(`{3,}|~{3,})/);
		if (fence) {
			const ch = fence[1][0];
			if (!inFence) {
				inFence = true;
				fenceChar = ch;
			} else if (ch === fenceChar) {
				inFence = false;
			}
			continue;
		}
		if (inFence) continue;
		const m = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
		if (!m) continue;
		const level = m[1].length;
		const text = m[2].trim();
		let slug = slugify(text);
		if (seen.has(slug)) {
			const n = seen.get(slug) + 1;
			seen.set(slug, n);
			slug = `${slug}-${n}`;
		} else {
			seen.set(slug, 0);
		}
		out.push({ level, text, slug, line: i });
	}
	return out;
}

// Return the markdown from a heading until the next heading of the same or a
// higher level (i.e. the whole section). Null if the slug is not found.
export function readFragment(markdown, slug) {
	const lines = String(markdown).split('\n');
	const headings = headingSlugs(markdown);
	const idx = headings.findIndex((h) => h.slug === slug);
	if (idx === -1) return null;
	const start = headings[idx].line;
	const level = headings[idx].level;
	let end = lines.length;
	for (let j = idx + 1; j < headings.length; j++) {
		if (headings[j].level <= level) {
			end = headings[j].line;
			break;
		}
	}
	return lines.slice(start, end).join('\n').trim();
}
