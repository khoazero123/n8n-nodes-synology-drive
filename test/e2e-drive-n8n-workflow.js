#!/usr/bin/env node
/* Standalone n8n-nodes-synology-drive workflow E2E smoke test.
 * Targets an already-running n8n (N8N_BASE_URL) with the package installed
 * as a custom node. Uses credential type `synologyDriveApi`.
 */
const fs = require('fs');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { ensureN8nSession } = require('./n8nE2eAuth');
const { logRun } = require('./n8nE2eLog');

const PORT = Number(process.env.N8N_PORT || 5681);
const HOST = process.env.N8N_HOST || '127.0.0.1';
const BASE_URL = process.env.N8N_BASE_URL || `http://${HOST}:${PORT}`;
const OWNER_EMAIL = process.env.N8N_OWNER_EMAIL || 'drive-standalone-e2e@example.com';
const OWNER_PASSWORD = process.env.N8N_OWNER_PASSWORD || `N8nDriveE2e-${crypto.randomBytes(12).toString('hex')}!`;
const NODE_TYPE = process.env.N8N_DRIVE_NODE_TYPE || 'CUSTOM.synologyDrive';
const CRED_TYPE = process.env.N8N_DRIVE_CRED_TYPE || 'synologyDriveApi';
const REQUIRED = ['SYNO_BASE_URL', 'SYNO_ACCOUNT', 'SYNO_PASS'];
let cookie = '';

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

function request(method, route, body, auth = true) {
	return new Promise((resolve, reject) => {
		const url = new URL(route, BASE_URL);
		const payload = body === undefined ? undefined : JSON.stringify(body);
		const req = http.request({
			hostname: url.hostname,
			port: url.port,
			path: `${url.pathname}${url.search}`,
			method,
			headers: {
				...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
				...(auth && cookie ? { Cookie: cookie } : {}),
			},
		}, (res) => {
			let raw = '';
			res.on('data', (chunk) => { raw += chunk; });
			res.on('end', () => {
				if (res.headers['set-cookie']) cookie = res.headers['set-cookie'].map((c) => c.split(';')[0]).join('; ');
				let json;
				try { json = raw ? JSON.parse(raw) : {}; } catch { json = { raw }; }
				resolve({ statusCode: res.statusCode, json, raw });
			});
		});
		req.on('error', reject);
		if (payload) req.write(payload);
		req.end();
	});
}

async function api(method, route, body, expected = [200]) {
	const response = await request(method, route, body);
	if (!expected.includes(response.statusCode)) throw new Error(`${method} ${route} -> ${response.statusCode}: ${response.raw}`);
	return response.json.data ?? response.json;
}

function parseExecutionData(execution) {
	let parse;
	try { ({ parse } = require('flatted')); } catch { parse = JSON.parse; }
	return typeof execution.data === 'string' ? parse(execution.data) : execution.data;
}

async function getExecution(executionId) {
	for (let i = 0; i < 90; i++) {
		const execution = await api('GET', `/rest/executions/${executionId}?includeData=true`);
		if (execution.finished || ['success', 'error', 'crashed', 'canceled'].includes(execution.status)) return execution;
		await sleep(1000);
	}
	throw new Error(`Execution ${executionId} did not finish`);
}

async function main() {
	const missing = REQUIRED.filter((key) => !process.env[key]);
	if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`);

	// wait for n8n readiness
	for (let i = 0; i < 60; i++) {
		try {
			const r = await request('GET', '/healthz', undefined, false);
			if (r.statusCode === 200) break;
		} catch {}
		await sleep(1000);
		if (i === 59) throw new Error('n8n not ready');
	}

	await ensureN8nSession({
		request,
		getCookie: () => cookie,
		setCookie: (value) => { cookie = value; },
		email: OWNER_EMAIL,
		password: OWNER_PASSWORD,
		lastName: 'Drive E2E',
	});

	const unique = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
	const folder = `/mydrive/n8n-drive-standalone-e2e-${unique}`;
	const file = `${folder}/hello.txt`;
	const text = `Hello from standalone Synology Drive n8n node E2E ${unique}`;
	let workflow;
	let credential;
	try {
		credential = await api('POST', '/rest/credentials', {
			name: `Synology Drive Standalone E2E ${unique}`,
			type: CRED_TYPE,
			data: {
				baseUrl: process.env.SYNO_BASE_URL,
				username: process.env.SYNO_ACCOUNT,
				password: process.env.SYNO_PASS,
				allowUnauthorizedCerts: process.env.SYNO_ALLOW_UNAUTHORIZED_CERTS !== 'false',
			},
		});
		const c = { [CRED_TYPE]: { id: credential.id, name: credential.name } };
		const nodes = [
			{ name: 'Manual Trigger', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, position: [0, 0], parameters: {} },
			{ name: 'Create Folder', type: NODE_TYPE, typeVersion: 1, position: [240, 0], parameters: { resource: 'file', operation: 'createFileOrFolder', createFileOrFolderType: 'folder', path: folder }, credentials: c },
			{ name: 'Create File', type: NODE_TYPE, typeVersion: 1, position: [480, 0], parameters: { resource: 'file', operation: 'createFileOrFolder', createFileOrFolderType: 'file', path: file, createFileOrFolderFileContent: text }, credentials: c },
			{ name: 'Search File', type: NODE_TYPE, typeVersion: 1, position: [720, 0], parameters: { resource: 'file', operation: 'search', keyword: 'hello.txt', limit: 20, offset: 0, sortBy: 'name', sortDirection: 'asc' }, credentials: c },
			{ name: 'List Folder', type: NODE_TYPE, typeVersion: 1, position: [840, 0], parameters: { resource: 'file', operation: 'getFiles', path: folder, limit: 20, offset: 0, sortBy: 'name', sortDirection: 'asc', filter: {} }, credentials: c },
			{ name: 'List Recent', type: NODE_TYPE, typeVersion: 1, position: [960, 0], parameters: { resource: 'file', operation: 'listItemsRecentlyUsed' }, credentials: c },
			{ name: 'Download File', type: NODE_TYPE, typeVersion: 1, position: [1080, 0], parameters: { resource: 'file', operation: 'downloadFile', path: file }, credentials: c },
			{ name: 'Delete Folder', type: NODE_TYPE, typeVersion: 1, position: [1200, 0], parameters: { resource: 'file', operation: 'deleteFileOrFolder', path: folder, deleteFileOrFolderPermanent: true }, credentials: c },
		];
		const connections = {};
		for (let i = 0; i < nodes.length - 1; i++) connections[nodes[i].name] = { main: [[{ node: nodes[i + 1].name, type: 'main', index: 0 }]] };
		workflow = await api('POST', '/rest/workflows', {
			name: `Synology Drive Standalone Node E2E ${unique}`,
			nodes,
			connections,
			active: false,
			settings: { executionOrder: 'v1' },
			staticData: null,
			pinData: { 'Manual Trigger': [{ json: {} }] },
			tags: [],
		});
		const run = await api('POST', `/rest/workflows/${workflow.id}/run`, { triggerToStartFrom: { name: 'Manual Trigger' } });
		if (!run.executionId) throw new Error(`Manual run did not return executionId: ${JSON.stringify(run)}`);
		const execution = await getExecution(run.executionId);
		const data = parseExecutionData(execution);
		const summary = Object.fromEntries(Object.entries(data.resultData.runData).map(([node, runs]) => [node, runs.map((item) => ({ status: item.executionStatus || (item.error ? 'error' : 'success'), error: item.error?.message, json: item.data?.main?.[0]?.map((entry) => entry.json), binaryKeys: item.data?.main?.[0]?.map((entry) => Object.keys(entry.binary || {})) }))]));
		logRun({ workflowId: workflow.id, executionId: run.executionId, status: execution.status, finished: execution.finished, lastNode: data.resultData.lastNodeExecuted, summary });
		if (execution.status !== 'success') throw new Error(`Execution failed: ${data.resultData.error?.message || execution.status}`);
		if (!JSON.stringify(summary['List Folder']).includes('hello.txt')) throw new Error('List Folder output did not include created hello.txt');
		if (!JSON.stringify(summary['Search File']).includes('hello.txt')) throw new Error('Search did not find created hello.txt');
		if (!JSON.stringify(summary['Download File']).includes('success')) throw new Error('Download File node did not run successfully');
		console.log('\n✅ E2E PASS: create → search → list → recent → download → delete all succeeded via n8n node');
	} finally {
		if (workflow?.id) await request('DELETE', `/rest/workflows/${workflow.id}`);
		if (credential?.id) await request('DELETE', `/rest/credentials/${credential.id}`);
	}
}

main().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
