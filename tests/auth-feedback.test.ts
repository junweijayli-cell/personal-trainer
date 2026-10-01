import { describe, expect, it } from 'vitest';
import { authFeedback } from '../app/auth-feedback';

describe('authentication feedback', () => {
  for (const locale of ['en', 'zh'] as const) {
    it(`distinguishes unavailable services from invalid credentials (${locale})`, () => {
      const network = authFeedback({ name: 'AuthRetryableFetchError', status: 0 }, locale, 'signin');
      const outage = authFeedback({ status: 503 }, locale, 'signin');
      const credentials = authFeedback({ code: 'invalid_credentials', status: 400 }, locale, 'signin');
      expect(network).toContain('trainwell.win@gmail.com');
      expect(outage).toContain('trainwell.win@gmail.com');
      expect(credentials).not.toEqual(outage);
      expect(credentials).not.toEqual(network);
    });
    it(`does not expose account existence or provider details (${locale})`, () => {
      expect(authFeedback({ code: 'user_not_found', message: 'private SMTP detail' }, locale, 'email'))
        .toEqual(authFeedback({ code: 'unexpected_failure' }, locale, 'email'));
      expect(authFeedback(new Error('private database detail'), locale, 'signin')).not.toContain('private');
    });
    it(`recognizes rate limits, CAPTCHA failures and expired reset sessions (${locale})`, () => {
      expect(authFeedback({ status: 429 }, locale, 'email')).toContain('60');
      expect(authFeedback({ code: 'captcha_failed' }, locale, 'signin')).not.toEqual(authFeedback({}, locale, 'signin'));
      expect(authFeedback({ name: 'AuthSessionMissingError' }, locale, 'reset'))
        .toEqual(authFeedback({ code: 'flow_state_expired' }, locale, 'reset'));
    });
  }
});
