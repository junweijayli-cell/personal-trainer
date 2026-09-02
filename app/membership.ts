import type { Membership } from './account-types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function membershipDaysRemaining(membership: Membership) {
  if (!membership.trialEndsAt || membership.status !== 'trial') return null;
  const remaining = new Date(membership.trialEndsAt).getTime() - new Date(membership.serverNow).getTime();
  return Math.max(0, Math.ceil(remaining / DAY_MS));
}

export function membershipHasAccess(membership: Membership) {
  if (!membership.hasAccess) return false;
  if (membership.status === 'trial') {
    return Boolean(membership.trialEndsAt && new Date(membership.trialEndsAt) > new Date(membership.serverNow));
  }
  return membership.status === 'active';
}
