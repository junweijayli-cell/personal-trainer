/**
 * Explicitly opted-in, one-email SMTP acceptance check, NOT a load test or full E2E.
 * The official, already-authenticated Supabase CLI supplies keys only in memory.
 * SMTP_TEST_INBOX must specify the operator's base Gmail address, without a plus tag.
 * Enter the code on private stdin or use --otp-loopback when the runner closes stdin.
 * The bounded one-use localhost input holds no credentials or codes on disk.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const PROJECT_REF = 'yvcdlrnjhhafywawuknj';
const PROJECT_URL = `https://${PROJECT_REF}.supabase.co`;
const APP_URL = 'https://junweijayli-cell.github.io/personal-trainer/';
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
class SafeCheckError extends Error {}

export function parseArguments(args) {
  if ((args.length !== 3 && args.length !== 4) || args[0] !== '--project-ref' || args[1] !== PROJECT_REF || args[2] !== '--send-test-email' || (args.length === 4 && args[3] !== '--otp-loopback')) {
    throw new SafeCheckError('Require --project-ref yvcdlrnjhhafywawuknj --send-test-email [--otp-loopback]. No other target is permitted.');
  }
  return { otpLoopback: args.length === 4 };
}

export function parseTestInbox(input) {
  if (typeof input !== 'string' || !/^[a-z0-9](?:[a-z0-9.]{0,62}[a-z0-9])?@gmail\.com$/i.test(input) || input.includes('..')) {
    throw new SafeCheckError('Set SMTP_TEST_INBOX to the authorized base Gmail address, without a plus tag or whitespace. No email was sent.');
  }
  return input.toLowerCase();
}

export function parseKeys(input) {
  let rows;
  try { rows = JSON.parse(input.replace(/^\uFEFF/, '')); }
  catch { throw new SafeCheckError('The official CLI did not return valid key JSON. Its output was suppressed.'); }
  if (!Array.isArray(rows)) throw new SafeCheckError('Expected the official CLI API-key array.');
  const get = (name) => rows.find((row) => row.name === name || row.id === name)?.api_key;
  const anon = get('anon');
  const service = get('service_role');
  if (typeof anon !== 'string' || typeof service !== 'string' || anon.length < 20 || service.length < 20 || anon === service) {
    throw new SafeCheckError('Distinct anon and service-role credentials are required.');
  }
  for (const key of [anon, service]) {
    if (key.split('.').length === 3) {
      let claims;
      try { claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()); }
      catch { throw new SafeCheckError('Malformed legacy credential.'); }
      if (claims.ref !== PROJECT_REF) throw new SafeCheckError('Credential project does not match the allowed target.');
    }
  }
  return { anon, service };
}

export function differentWrongCode(correctCode) {
  if (!/^\d{6}$/.test(correctCode)) throw new SafeCheckError('A six-digit code is required.');
  return `${(Number(correctCode[0]) + 1) % 10}${correctCode.slice(1)}`;
}

export function isAllowedLoopbackRequest({ method, path, host, origin, fetchSite, contentType }, expected) {
  return method === 'POST' && path === expected.path && host === expected.host
    && origin === undefined && fetchSite === undefined
    && contentType === 'text/plain';
}

export function parseLoopbackCode(payload) {
  if (typeof payload !== 'string' || Buffer.byteLength(payload) > 64 || !/^\d{6}$/.test(payload)) {
    throw new SafeCheckError('The local code payload must contain exactly six digits.');
  }
  return payload;
}

function demand(condition, message) {
  if (!condition) throw new SafeCheckError(message);
}

function dataOrThrow(result, label) {
  if (result.error) {
    const candidate = String(result.error.code || result.error.status || 'unspecified');
    const code = /^[a-zA-Z0-9_]{1,64}$/.test(candidate) ? candidate : 'redacted';
    throw new SafeCheckError(`${label} failed (code ${code}). Remote details were suppressed.`);
  }
  return result.data;
}

function readKeysFromOfficialCli() {
  // Every executable argument is static. No user-controlled shell interpolation.
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(command, [
    '--yes', '--registry=https://registry.npmjs.org', 'supabase@2.76.15',
    'projects', 'api-keys', '--project-ref', PROJECT_REF, '--output', 'json',
  ], {
    encoding: 'utf8', shell: process.platform === 'win32', windowsHide: true,
    timeout: 90_000, maxBuffer: 1_000_000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error || result.status !== 0) {
    throw new SafeCheckError('Official CLI credential retrieval failed. Sign in separately; CLI output was suppressed.');
  }
  const keys = parseKeys(result.stdout);
  result.stdout = '';
  result.stderr = '';
  return keys;
}

async function readCode(signal) {
  demand(!signal.aborted && !process.stdin.readableEnded, 'Code input ended or the time limit was reached.');
  return new Promise((resolve, reject) => {
    const input = createInterface({ input: process.stdin, terminal: false });
    let settled = false;
    let invalidEntries = 0;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', stop);
      input.close();
      if (error) reject(error); else resolve(value);
    };
    const stop = () => finish(new SafeCheckError('The check was interrupted or its ten-minute time limit was reached.'));
    signal.addEventListener('abort', stop, { once: true });
    input.on('line', (line) => {
      const code = line.trim();
      if (/^\d{6}$/.test(code)) return finish(null, code);
      invalidEntries += 1;
      if (invalidEntries >= 3) return finish(new SafeCheckError('Code input was not six digits; input was not logged.'));
      console.log('WAITING: Enter only the six-digit email code. Input was not logged.');
    });
    input.once('close', () => finish(new SafeCheckError('Code input ended before a valid code was received.')));
    input.once('error', () => finish(new SafeCheckError('Code input could not be read.')));
  });
}

async function readLoopbackCode(signal) {
  demand(!signal.aborted, 'The time limit was reached before code input.');
  return new Promise((resolve, reject) => {
    const noncePath = `/otp/${randomBytes(24).toString('base64url')}`;
    const sockets = new Set();
    let expectedHost = '';
    let settled = false;
    let localRequests = 0;
    const finish = (error, code) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', stop);
      server.close();
      server.closeIdleConnections();
      // Give the accepted response time to flush, then bound idle/malicious sockets.
      const closeTimer = setTimeout(() => { for (const socket of sockets) socket.destroy(); }, 500);
      closeTimer.unref();
      if (error) reject(error); else resolve(code);
    };
    const stop = () => finish(new SafeCheckError('The check was interrupted or its ten-minute time limit was reached.'));
    const server = createServer({ requestTimeout: 5000, headersTimeout: 5000, keepAliveTimeout: 1000 }, (request, response) => {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Type', 'text/plain');
      response.setHeader('Connection', 'close');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      localRequests += 1;
      if (settled || localRequests > 12) {
        response.writeHead(429).end('Local input limit reached.');
        if (!settled) finish(new SafeCheckError('The local code-input request limit was reached.'));
        return;
      }
      const allowed = isAllowedLoopbackRequest({
        method: request.method, path: request.url, host: request.headers.host,
        origin: request.headers.origin, fetchSite: request.headers['sec-fetch-site'],
        contentType: request.headers['content-type'],
      }, { path: noncePath, host: expectedHost });
      if (!allowed) { response.writeHead(403).end('Local non-browser code input only.'); return; }
      const declaredLength = request.headers['content-length'];
      if (declaredLength !== undefined && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > 64)) {
        response.writeHead(413).end('Payload rejected.'); return;
      }
      let size = 0;
      const chunks = [];
      request.on('data', (chunk) => {
        if (response.writableEnded) return;
        size += chunk.length;
        if (size > 64) { chunks.length = 0; response.writeHead(413).end('Payload rejected.'); request.destroy(); return; }
        chunks.push(chunk);
      });
      request.on('error', () => { /* Never log a body or request details. */ });
      request.on('end', () => {
        if (settled || size > 64 || response.writableEnded) return;
        let code;
        try { code = parseLoopbackCode(Buffer.concat(chunks).toString('utf8')); }
        catch { response.writeHead(400).end('Exactly six digits required.'); return; }
        response.writeHead(200).end('Code received; check continues.');
        finish(null, code);
      });
    });
    server.maxConnections = 4;
    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.setTimeout(5000, () => socket.destroy());
      socket.once('close', () => sockets.delete(socket));
    });
    server.once('error', () => finish(new SafeCheckError('Could not open the private loopback code-input endpoint.')));
    signal.addEventListener('abort', stop, { once: true });
    server.listen(0, '127.0.0.1', () => {
      if (settled) { server.close(); return; }
      const address = server.address();
      expectedHost = `127.0.0.1:${address.port}`;
      console.log(`LOCAL_OTP_INPUT: http://${expectedHost}${noncePath}`);
      console.log('WAITING: POST exactly six digits with Content-Type: text/plain from a local non-browser command. This one-use endpoint expires with the check.');
    });
  });
}

async function main() {
  const { otpLoopback } = parseArguments(process.argv.slice(2));
  const inbox = parseTestInbox(process.env.SMTP_TEST_INBOX);
  const { anon, service } = readKeysFromOfficialCli();
  const runTag = `relay-smtp-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const email = `${inbox.split('@')[0]}+relaycheck-${Date.now()}-${randomUUID().slice(0, 8)}@gmail.com`;
  const password = `Aa9!${randomBytes(32).toString('base64url')}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10 * 60 * 1000);
  const interrupt = () => controller.abort();
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  let cleaningUp = false;
  let requests = 0;
  let createdId = null;
  let signupAttempted = false;
  let failed = false;
  let cleanupStatus = 'No test account created';
  const checks = [];
  const controlledFetch = async (resource, options = {}) => {
    const destination = new URL(typeof resource === 'string' ? resource : resource.url || resource.href);
    demand(destination.origin === PROJECT_URL && !destination.username && !destination.password, 'Unexpected API destination blocked.');
    requests += 1;
    demand(requests <= 15, 'The fifteen-request safety limit was reached.');
    const signals = [AbortSignal.timeout(12_000)];
    if (options.signal) signals.push(options.signal);
    if (!cleaningUp) signals.push(controller.signal);
    return fetch(resource, { ...options, signal: AbortSignal.any(signals) });
  };
  const makeClient = (key) => createClient(PROJECT_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: controlledFetch },
  });
  const client = makeClient(anon);
  const admin = makeClient(service);
  const pass = (name) => { checks.push({ name, result: 'PASS' }); console.log(`PASS: ${name}`); };
  const ownsUser = (user) => user?.email === email && user.user_metadata?.relay_smtp_run === runTag;
  try {
    signupAttempted = true;
    const signup = await client.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: APP_URL,
        data: { display_name: 'Disposable SMTP acceptance check', market: 'global', locale: 'en', relay_smtp_run: runTag },
      },
    });
    // Retain the exact returned identity even when a provider error accompanies it.
    if (ownsUser(signup.data?.user)) createdId = signup.data.user.id;
    const signedUp = dataOrThrow(signup, 'Request verification email');
    demand(ownsUser(signedUp.user) && createdId, 'Signup did not return this unique test identity.');
    demand(!signedUp.session && !signedUp.user.email_confirmed_at, 'Email confirmation is disabled or was bypassed; stopping the check.');
    console.log(`EMAIL_REQUEST_ACCEPTED: ${email}`);
    console.log('WAITING: Check the owner inbox for the six-digit code. Provider acceptance alone is not inbox-delivery proof.');
    let code = otpLoopback ? await readLoopbackCode(controller.signal) : await readCode(controller.signal);
    const incorrect = await client.auth.verifyOtp({ email, token: differentWrongCode(code), type: 'email' });
    demand(incorrect.error && !incorrect.data?.session && incorrect.error.code === 'otp_expired', 'The intentionally incorrect code did not receive the expected invalid-code rejection.');
    pass('Incorrect OTP rejected');
    const verified = dataOrThrow(await client.auth.verifyOtp({ email, token: code, type: 'email' }), 'Verify delivered code');
    demand(verified.session?.access_token && verified.user?.id === createdId, 'Code verification did not establish this test account session.');
    pass('Delivered six-digit code verified');
    const entitlement = dataOrThrow(await client.rpc('get_my_entitlement'), 'Read server entitlement')?.[0];
    demand(entitlement?.status === 'trial' && entitlement.has_access && Date.parse(entitlement.trial_ends_at) - Date.parse(entitlement.trial_started_at) === SEVEN_DAYS, 'Verified trial was not exactly seven server-calculated days.');
    pass('Verification starts exactly seven server-calculated trial days');
    const reused = await client.auth.verifyOtp({ email, token: code, type: 'email' });
    code = '';
    demand(reused.error && !reused.data?.session && reused.error.code === 'otp_expired', 'The reused code did not receive the expected rejection.');
    pass('Reused OTP rejected');
  } catch (error) {
    failed = true;
    const detail = error instanceof SafeCheckError ? error.message : 'Request failed; raw error details suppressed to protect credentials.';
    checks.push({ name: 'SMTP acceptance check', result: 'FAIL', detail });
    console.log(`CHECK_STOPPED: ${detail}`);
  } finally {
    cleaningUp = true;
    clearTimeout(timer);
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    try {
      // If an SMTP/network error hid the ID, locate only the exact unique identity.
      // A bounded scan never logs users and never deletes an unmarked account.
      if (!createdId && signupAttempted) {
        let fullySearched = false;
        for (let page = 1; page <= 5 && requests < 12; page += 1) {
          const data = dataOrThrow(await admin.auth.admin.listUsers({ page, perPage: 1000 }), 'Locate this disposable account for cleanup');
          const match = data.users.find(ownsUser);
          if (match) { createdId = match.id; break; }
          if (data.users.length < 1000) { fullySearched = true; break; }
        }
        demand(createdId || fullySearched, 'Cleanup lookup limit reached; manual verification of this unique test email is required.');
      }
      if (createdId) {
        const current = dataOrThrow(await admin.auth.admin.getUserById(createdId), 'Verify disposable identity before cleanup');
        demand(ownsUser(current.user), 'Cleanup identity check failed; no account was deleted.');
        dataOrThrow(await admin.auth.admin.deleteUser(createdId), 'Delete only this disposable account');
        cleanupStatus = 'Disposable test account and cascading account data removed';
      }
    } catch {
      failed = true;
      cleanupStatus = 'MANUAL CLEANUP CHECK REQUIRED for the unique test recipient reported below; unrelated accounts were not touched';
    }
    console.log(JSON.stringify({
      project: PROJECT_REF, recipient: email,
      type: 'One-email SMTP acceptance check; not a load test or full browser E2E',
      checks, requests, cleanup: cleanupStatus,
      resendTested: false, recoveryTested: false, expiryWaitTested: false, paymentsTested: false,
      result: failed ? 'FAIL' : 'PASS',
    }, null, 2));
    process.stdin.pause();
    process.exitCode = failed ? 1 : 0;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof SafeCheckError ? error.message : 'SMTP check did not start; details suppressed to protect credentials.');
    process.exitCode = 1;
  });
}
