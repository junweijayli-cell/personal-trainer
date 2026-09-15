import { handleOptions } from '../_shared/cors.ts';
import { authenticatedUser, adminClient } from '../_shared/auth.ts';
import { errorResponse, json } from '../_shared/response.ts';
import { requirePromoOperator } from '../_shared/promo.ts';

Deno.serve(async (request) => {
  const options = handleOptions(request); if (options) return options;
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405);
  try {
    const { user } = await authenticatedUser(request); const admin = adminClient(); await requirePromoOperator(admin, user);
    const body = await request.json(); const batchId = typeof body?.batchId === 'string' ? body.batchId : '';
    if (!/^[0-9a-f-]{36}$/i.test(batchId)) throw new Error('Choose a valid batch.');
    const { data, error } = await admin.from('promo_code_batches').update({ revoked_at: new Date().toISOString() }).eq('id', batchId).is('revoked_at', null).select('id,revoked_at').maybeSingle();
    if (error || !data) throw new Error('The batch is already revoked or unavailable.');
    return json(request, { batch: data });
  } catch (error) { return errorResponse(request, error, 400); }
});
