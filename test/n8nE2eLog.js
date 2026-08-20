'use strict';

/**
 * E2E logging helpers. In CI (or when SYNO_E2E_QUIET=true) only pass/fail lines and
 * redacted errors are printed — no NAS user data, mail content, or workflow payloads.
 * Set SYNO_E2E_VERBOSE=true for full local debug output.
 */

function isQuiet() {
	if (process.env.SYNO_E2E_VERBOSE === 'true') return false;
	if (process.env.SYNO_E2E_QUIET === 'true') return true;
	return process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
}

function redact(text) {
	if (text == null) return '';
	return String(text)
		.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]')
		.replace(/\b(token|password|passwd|_sid|sid)=[^\s&"']+/gi, '$1=[redacted]')
		.replace(/https?:\/\/[^\s"']+/g, '[url]')
		.replace(/\/mydrive\/[^\s"']+/g, '/mydrive/[path]');
}

function detail(...args) {
	if (isQuiet()) return;
	console.log(...args);
}

function pass(msg, extra) {
	if (extra !== undefined && !isQuiet()) {
		const tail = typeof extra === 'string' ? extra : JSON.stringify(extra).slice(0, 170);
		console.log(`✅ ${msg}: ${tail}`);
	} else {
		console.log(`✅ ${msg}`);
	}
}

function warn(msg) {
	console.warn(`⚠️  ${isQuiet() ? redact(msg) : msg}`);
}

function fail(msg, err) {
	const tail = err && err.message ? err.message : (err ? String(err) : '');
	console.log(`❌ ${msg}${tail ? `: ${redact(tail).slice(0, 220)}` : ''}`);
}

/** Log workflow run metadata without dumping node payloads in CI. */
function logRun(meta) {
	if (isQuiet()) {
		const parts = ['run'];
		if (meta.workflowId) parts.push(`workflow=${meta.workflowId}`);
		if (meta.executionId) parts.push(`exec=${meta.executionId}`);
		if (meta.status) parts.push(`status=${meta.status}`);
		if (meta.lastNode) parts.push(`last=${meta.lastNode}`);
		console.log(parts.join(' '));
	} else {
		console.log(JSON.stringify(meta, null, 2));
	}
}

module.exports = {
	isQuiet,
	redact,
	detail,
	pass,
	warn,
	fail,
	logRun,
};
