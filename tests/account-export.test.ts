import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MemberAccount } from '../app/account-types';
import { loadAccountExport } from '../app/account-service';

type Row = Record<string, unknown>;
const backend = vi.hoisted(() => ({
  userId: 'member-a',
  tables: {} as Record<string, Row[]>,
  errorTable: '',
  requests: [] as { table: string; userId: string; cursor?: string }[],
}));

vi.mock('../app/supabase-client', () => ({
  backendConfigured: true,
  market: 'global',
  appUrl: () => 'https://relay.example/',
  getSupabase: () => ({
    auth: {
      getSession: async () => ({ data: { session: { user: { id: backend.userId, email: 'member@example.com' } } }, error: null }),
    },
    from: (table: string) => {
      let key = 'id';
      let userId = '';
      let cursor: string | undefined;
      const query = {
        select: () => query,
        eq: (_column: string, value: string) => { userId = value; return query; },
        order: (column: string) => { key = column; return query; },
        limit: () => query,
        gt: (_column: string, value: string) => { cursor = value; return query; },
        then: (resolve: (value: { data: Row[] | null; error: { message: string } | null }) => unknown) => {
          backend.requests.push({ table, userId, cursor });
          if (table === backend.errorTable) return Promise.resolve(resolve({ data: null, error: { message: 'Export query failed' } }));
          // Simulate a server page limit lower than the requested 500 rows.
          const rows = (backend.tables[table] ?? [])
            .filter((row) => row.user_id === userId && (!cursor || String(row[key]) > cursor))
            .sort((left, right) => String(left[key]).localeCompare(String(right[key])))
            .slice(0, 25);
          return Promise.resolve(resolve({ data: rows, error: null }));
        },
      };
      return query;
    },
  }),
}));

const member: MemberAccount = {
  userId: 'member-a', email: 'member@example.com', displayName: 'Member', locale: 'en', market: 'global',
  membership: { billingMode: null, status: 'expired', plan: 'trial', trialStartedAt: null, trialEndsAt: null, currentPeriodEnd: null, cancelAtPeriodEnd: false, hasAccess: false, serverNow: '2026-09-06T00:00:00Z' },
};

beforeEach(() => {
  backend.userId = 'member-a';
  backend.tables = {};
  backend.errorTable = '';
  backend.requests = [];
});

describe('complete account export', () => {
  it('exports older sessions and every wellness day for an expired member across server pages', async () => {
    backend.tables.workout_sessions = Array.from({ length: 65 }, (_, index) => ({ id: String(index).padStart(4, '0'), user_id: member.userId }));
    backend.tables.workout_sessions.push({ id: '9999', user_id: 'member-b' });
    backend.tables.wellness_logs = [
      { id: 'day-1', user_id: member.userId, log_date: '2026-09-01' },
      { id: 'day-2', user_id: member.userId, log_date: '2026-09-02' },
    ];
    backend.tables.exercise_logs = [{ id: 'exercise-1', user_id: member.userId, form_feedback: 'Keep hips level' }];
    const result = await loadAccountExport(member);
    expect(result.data.workout_sessions).toHaveLength(65);
    expect(result.data.wellness_logs).toHaveLength(2);
    expect(result.data.exercise_logs[0].form_feedback).toBe('Keep hips level');
    expect(Object.keys(result.data)).toHaveLength(9);
    expect(backend.requests.every((request) => request.userId === member.userId)).toBe(true);
    expect(backend.requests.filter((request) => request.table === 'workout_sessions')).toHaveLength(4);
  });

  it('fails the export instead of downloading partial data when one table fails', async () => {
    backend.errorTable = 'wellness_logs';
    await expect(loadAccountExport(member)).rejects.toThrow('Export query failed');
  });

  it('rejects a stale account after another user signs in before reading any data', async () => {
    backend.userId = 'member-b';
    await expect(loadAccountExport(member)).rejects.toThrow('Your session has expired');
    expect(backend.requests).toHaveLength(0);
  });
});
