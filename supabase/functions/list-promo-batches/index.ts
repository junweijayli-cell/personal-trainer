import { handleOptions } from '../_shared/cors.ts';
import { authenticatedUser, adminClient } from '../_shared/auth.ts';
import { errorResponse, json } from '../_shared/response.ts';
import { requirePromoOperator } from '../_shared/promo.ts';

Deno.serve(async (request) => {
  const options = handleOptions(request); if (options) return options;
  if (request.method !== 'GET') return json(request, { error: 'Method not allowed.' }, 405);
  try {
    const { user } = await authenticatedUser(request); const admin = adminClient(); await requirePromoOperator(admin, user);
    const { data: batches, error } = await admin.from('promo_code_batches').select('id,plan,label,quantity,expires_at,revoked_at,created_at').order('created_at', { ascending: false });
    if (error) throw new Error('Could not load access-code batches.');
    const ids = (batches ?? []).map((batch) => batch.id);
    const { data: codes, error: codeError } = ids.length ? await admin.from('promo_codes').select('batch_id,redeemed_at').in('batch_id', ids) : { data: [], error: null };
    if (codeError) throw new Error('Could not load access-code status.');
    return json(request, { batches: (batches ?? []).map((batch) => {
      const rows = (codes ?? []).filter((code) => code.batch_id === batch.id);
      const unusedRows = rows.filter((code) => !code.redeemed_at);
      const revoked = batch.revoked_at ? unusedRows.length : 0;
      const expired = !batch.revoked_at && new Date(batch.expires_at) <= new Date() ? unusedRows.length : 0;
      return { ...batch, redeemed: rows.length - unusedRows.length, unused: unusedRows.length - expired - revoked, expired, revoked };
    }) });
  } catch (error) { return errorResponse(request, error, 400); }
});
