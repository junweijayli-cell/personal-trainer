import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authenticate: vi.fn(), userRpc: vi.fn(), adminRpc: vi.fn() }));
vi.mock('../supabase/functions/_shared/auth.ts', () => ({ authenticatedUser: mocks.authenticate }));
let handler: (request: Request) => Promise<Response>;

beforeAll(async () => {
  vi.stubGlobal('Deno', {
    env: { get: (name: string) => name === 'PROMO_CODE_PEPPER' ? 'isolated-unit-test-pepper' : 'https://trainwell.win' },
    serve: (serveHandler: typeof handler) => { handler = serveHandler; },
  });
  // This is a Deno entry point. Import dynamically to exercise the real HTTP
  // handler without including Deno's runtime globals in the frontend compiler.
  const endpoint = '../supabase/functions/redeem-promo-code/index.ts';
  await import(endpoint);
});
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticate.mockResolvedValue({ user: { id: 'verified-user' }, userClient: { rpc: mocks.userRpc }, admin: { rpc: mocks.adminRpc } });
});

it('redeems through the authenticated user so auth.uid() survives the Edge Function boundary', async () => {
  const grant = { plan: 'monthly', starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-10-31T00:00:00Z' };
  mocks.userRpc.mockResolvedValue({ data: [grant], error: null });
  const request = new Request('https://trainwell.win/redeem', {
    method: 'POST', headers: { Authorization: 'Bearer isolated-user-token' },
    body: JSON.stringify({ code: 'abcd-abcd-abcd-abcd-abcd-abcd-abcd-abcd', userId: 'untrusted-other-user' }),
  });
  const response = await handler(request);
  expect(response.status).toBe(200);
  expect(mocks.authenticate).toHaveBeenCalledWith(request);
  expect(mocks.adminRpc).not.toHaveBeenCalled();
  expect(mocks.userRpc).toHaveBeenCalledWith('redeem_promo_code', { p_digest: expect.stringMatching(/^[a-f0-9]{64}$/) });
  expect(await response.json()).toEqual({ plan: grant.plan, startsAt: grant.starts_at, endsAt: grant.ends_at });
});

it('rejects missing authentication before any redemption or privileged RPC', async () => {
  mocks.authenticate.mockRejectedValue(new Error('Authentication required.'));
  const response = await handler(new Request('https://trainwell.win/redeem', { method: 'POST', body: '{}' }));
  expect(response.status).toBe(400);
  expect(mocks.userRpc).not.toHaveBeenCalled();
  expect(mocks.adminRpc).not.toHaveBeenCalled();
});
