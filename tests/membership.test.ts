import { describe, expect, it } from 'vitest';
import type { Membership } from '../app/account-types';
import { membershipDaysRemaining, membershipHasAccess } from '../app/membership';

function membership(patch: Partial<Membership> = {}): Membership {
  return {
    billingMode: null,
    status: 'trial',
    plan: 'trial',
    trialStartedAt: '2026-09-01T00:00:00.000Z',
    trialEndsAt: '2026-09-08T00:00:00.000Z',
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    hasAccess: true,
    serverNow: '2026-09-02T00:00:00.000Z',
    ...patch,
  };
}

describe('server-backed membership access', () => {
  it('reports trial time from server timestamps', () => {
    expect(membershipDaysRemaining(membership())).toBe(6);
    expect(membershipHasAccess(membership())).toBe(true);
  });

  it('denies an expired trial even when a stale client flag says access is true', () => {
    const expired = membership({ serverNow: '2026-09-08T00:00:01.000Z' });
    expect(membershipDaysRemaining(expired)).toBe(0);
    expect(membershipHasAccess(expired)).toBe(false);
  });

  it('denies access whenever the backend entitlement denies it', () => {
    expect(membershipHasAccess(membership({ hasAccess: false }))).toBe(false);
  });

  it('allows active paid access and denies past-due access', () => {
    expect(membershipHasAccess(membership({ status: 'active', plan: 'monthly', trialEndsAt: null, billingMode: 'test', currentPeriodEnd: '2026-10-01T00:00:00Z' }))).toBe(true);
    expect(membershipHasAccess(membership({ status: 'past_due', plan: 'monthly', trialEndsAt: null }))).toBe(false);
  });

  it('denies paid access with missing, invalid or expired periods or an unknown mode', () => {
    for (const end of [null, 'invalid', '2026-01-01T00:00:00Z']) {
      expect(membershipHasAccess(membership({ status: 'active', plan: 'monthly', billingMode: 'test', currentPeriodEnd: end }))).toBe(false);
    }
    expect(membershipHasAccess(membership({status:'active', plan:'monthly', currentPeriodEnd:'2026-10-01T00:00:00Z'}))).toBe(false);
  });
});
