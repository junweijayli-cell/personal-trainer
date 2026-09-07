import test from 'node:test';
import assert from 'node:assert/strict';
import { parseArguments, parseTestInbox, parseKeys, differentWrongCode, isAllowedLoopbackRequest, parseLoopbackCode } from './smtp-email-smoke.mjs';

test('requires a base Gmail test inbox without whitespace or a plus tag', () => {
  assert.equal(parseTestInbox('relay.test.fixture@gmail.com'), 'relay.test.fixture@gmail.com');
  assert.equal(parseTestInbox('Relay.Test.Fixture@GMAIL.COM'), 'relay.test.fixture@gmail.com');
  for (const invalid of [undefined, null, '', 'fixture@example.com', 'fixture@googlemail.com',
    'fixture+tag@gmail.com', ' fixture@gmail.com', 'fixture@gmail.com ',
    'fixture@gmail.com\n', 'fi xture@gmail.com', '.fixture@gmail.com',
    'fixture.@gmail.com', 'fi..xture@gmail.com', 'fixture@gmail.com.attacker.test']) {
    assert.throws(() => parseTestInbox(invalid));
  }
});

test('requires exact target, email opt-in and known input mode', () => {
  const base = ['--project-ref', 'yvcdlrnjhhafywawuknj', '--send-test-email'];
  assert.deepEqual(parseArguments(base), { otpLoopback: false });
  assert.deepEqual(parseArguments([...base, '--otp-loopback']), { otpLoopback: true });
  assert.throws(() => parseArguments([]));
  assert.throws(() => parseArguments(['--project-ref', 'other', '--send-test-email']));
  assert.throws(() => parseArguments([...base, '--unknown']));
  assert.throws(() => parseKeys('invalid'));
  assert.throws(() => parseKeys('[]'));
});

test('loopback endpoint rejects browser origins, wrong paths/hosts/methods/types', () => {
  const expected = { path: '/otp/test-nonce', host: '127.0.0.1:45678' };
  const valid = { method: 'POST', ...expected, contentType: 'text/plain' };
  assert.equal(isAllowedLoopbackRequest(valid, expected), true);
  assert.equal(isAllowedLoopbackRequest({ ...valid, origin: 'http://127.0.0.1:45678', fetchSite: 'same-origin' }, expected), true);
  for (const changed of [
    { method: 'GET' }, { method: 'OPTIONS' }, { path: '/otp/wrong' },
    { host: 'attacker.example:45678' }, { host: 'localhost:45678' },
    { origin: 'https://attacker.example' }, { origin: 'null' },
    { origin: 'http://127.0.0.1:45678' }, { fetchSite: 'cross-site' },
    { fetchSite: 'same-origin' }, { contentType: 'application/json' },
  ]) assert.equal(isAllowedLoopbackRequest({ ...valid, ...changed }, expected), false);
});

test('only exact six-digit code payload accepted and wrong code differs', () => {
  assert.equal(parseLoopbackCode('012345'), '012345');
  for (const invalid of ['12345', '1234567', '123456\n', ' 123456', 'abcdef', '0'.repeat(65), null]) {
    assert.throws(() => parseLoopbackCode(invalid));
  }
  assert.equal(differentWrongCode('012345'), '112345');
  assert.equal(differentWrongCode('999999'), '099999');
});
