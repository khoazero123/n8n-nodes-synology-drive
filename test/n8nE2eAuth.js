'use strict';

/**
 * Shared n8n REST auth for workflow E2E scripts.
 *
 * n8n rate-limits POST /rest/login to 5 attempts / minute / email. CI runs many
 * scripts against one owner account, so we persist the session cookie across
 * steps in the same job and retry with backoff on HTTP 429.
 */
const fs = require('fs');
const path = require('path');

const COOKIE_FILE = process.env.N8N_E2E_COOKIE_FILE
	|| path.join('/tmp', 'n8n-nodes-synology-e2e.cookie');

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadSavedCookie() {
	try {
		return fs.readFileSync(COOKIE_FILE, 'utf8').trim();
	} catch {
		return '';
	}
}

function saveCookie(cookie) {
	if (!cookie) return;
	fs.writeFileSync(COOKIE_FILE, cookie, 'utf8');
}

/**
 * @param {object} opts
 * @param {(method: string, route: string, body?: unknown, useAuth?: boolean) => Promise<{statusCode: number, raw: string, json: any}>} opts.request
 * @param {() => string} opts.getCookie
 * @param {(cookie: string) => void} opts.setCookie
 * @param {string} opts.email
 * @param {string} opts.password
 * @param {string} [opts.firstName]
 * @param {string} [opts.lastName]
 */
async function ensureN8nSession(opts) {
	const {
		request,
		getCookie,
		setCookie,
		email,
		password,
		firstName = 'Synology',
		lastName = 'E2E',
	} = opts;

	const saved = loadSavedCookie();
	if (saved) {
		setCookie(saved);
		const probe = await request('GET', '/rest/settings', undefined, true);
		if (probe.statusCode === 200 && !String(probe.raw || '').includes('n8n is starting up')) {
			return;
		}
	}

	const setup = await request('POST', '/rest/owner/setup', {
		email,
		firstName,
		lastName,
		password,
	}, false);
	if (![200, 400].includes(setup.statusCode)) {
		throw new Error(`Owner setup failed: ${setup.statusCode} ${String(setup.raw).slice(0, 300)}`);
	}

	for (let attempt = 1; attempt <= 8; attempt++) {
		const login = await request('POST', '/rest/login', {
			emailOrLdapLoginId: email,
			password,
		}, false);
		const cookie = getCookie();
		if (login.statusCode === 200 && cookie) {
			saveCookie(cookie);
			return;
		}
		if (login.statusCode === 429) {
			console.log(`n8n login rate-limited (429); waiting 65s before retry ${attempt}/8...`);
			await sleep(65_000);
			continue;
		}
		throw new Error(`Login failed: ${login.statusCode} ${String(login.raw).slice(0, 300)}`);
	}

	throw new Error('Login failed: still rate-limited after retries');
}

/** Parse n8n execution payload (flatted JSON string or object). */
function parseExecutionData(execJson) {
	const raw = execJson?.data?.data ?? execJson?.data ?? execJson;
	if (!raw) return null;
	if (typeof raw === 'string') {
		const { parse } = require('flatted');
		return parse(raw);
	}
	return raw;
}

/**
 * Poll GET /rest/executions/:id until status is terminal.
 * @returns {Promise<{ status: string, runData: Record<string, unknown> }>}
 */
async function waitForExecution(getExecution, execId, { timeoutMs = 60_000, intervalMs = 2_000 } = {}) {
	const deadline = Date.now() + timeoutMs;
	let lastStatus = 'unknown';
	while (Date.now() < deadline) {
		const exec = await getExecution(execId);
		lastStatus = exec.json?.data?.status || exec.json?.status || lastStatus;
		const parsed = parseExecutionData(exec.json?.data ?? exec.json);
		const runData = parsed?.resultData?.runData || {};
		if (lastStatus === 'success' || lastStatus === 'error') {
			return { status: lastStatus, runData, exec };
		}
		await sleep(intervalMs);
	}
	throw new Error(`Timed out waiting for execution ${execId} (last status: ${lastStatus})`);
}

module.exports = {
	COOKIE_FILE,
	ensureN8nSession,
	loadSavedCookie,
	saveCookie,
	parseExecutionData,
	waitForExecution,
};
