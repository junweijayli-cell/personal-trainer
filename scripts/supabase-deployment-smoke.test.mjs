import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArguments, parseKeys } from './supabase-deployment-smoke.mjs';

const ref = 'yvcdlrnjhhafywawuknj';
const jwt = (claims) => `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
const fixture = (project = ref) => JSON.stringify([
  { name: 'anon', api_key: jwt({ ref: project, role: 'anon' }) },
  { name: 'service_role', api_key: jwt({ ref: project, role: 'service_role' }) },
]);

test('live mutations require the exact project and explicit account opt-in', () => {
  assert.equal(parseArguments(['--project-ref', ref, '--allow-test-accounts']), `https://${ref}.supabase.co`);
  for (const args of [[], ['--project-ref', ref], ['--project-ref', 'anotherproject', '--allow-test-accounts'], ['--project-ref', ref, '--allow-test-accounts', '--anything']]) {
    assert.throws(() => parseArguments(args));
  }
});

test('key parser accepts CLI array and does not accept keys for another project', () => {
  assert.notEqual(parseKeys(fixture()).anon, parseKeys(fixture()).service);
  assert.throws(() => parseKeys(fixture('anotherproject')));
});

test('key parser rejects malformed or incomplete input without echoing it', () => {
  const sensitiveText = 'do-not-print-this-secret';
  for (const input of [sensitiveText, '{}', '[]', JSON.stringify([{ name: 'anon', api_key: sensitiveText }])]) {
    assert.throws(() => parseKeys(input), (error) => !error.message.includes(sensitiveText));
  }
});
