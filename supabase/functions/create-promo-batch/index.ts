import { handleOptions } from '../_shared/cors.ts';
import { authenticatedUser, adminClient } from '../_shared/auth.ts';
import { errorResponse, json } from '../_shared/response.ts';
import { normalizePromoCode, promoDigest, randomPromoCode, requirePromoOperator } from '../_shared/promo.ts';

Deno.serve(async (request) => {
  const options = handleOptions(request); if (options) return options;
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405);
  try {
    const { user } = await authenticatedUser(request); const admin = adminClient(); await requirePromoOperator(admin, user);
    const body = await request.json();
    const plan = body?.plan === 'annual' ? 'annual' : body?.plan === 'monthly' ? 'monthly' : null;
    const quantity = Number(body?.quantity);
    const label = typeof body?.label === 'string' ? body.label.trim().slice(0, 120) : '';
    const expiresAt = new Date(String(body?.expiresAt ?? ''));
    if (!plan || !Number.isInteger(quantity) || quantity < 1 || quantity > 500 || !label || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw new Error('Choose a plan, quantity, label, and future expiration date.');
    }
    const { data: batch, error: batchError } = await admin.from('promo_code_batches').insert({ plan, label, quantity, expires_at: expiresAt.toISOString(), created_by: user.id }).select('id,plan,label,quantity,expires_at').single();
    if (batchError || !batch) throw new Error('Could not create the access-code batch.');
    const generated: Array<{ code: string; suffix: string }> = [];
    const rows = [];
    for (let index = 0; index < quantity; index += 1) {
      const code = randomPromoCode(); const normalized = normalizePromoCode(code); const digest = await promoDigest(normalized);
      generated.push({ code, suffix: normalized.slice(-4) }); rows.push({ batch_id: batch.id, code_digest: digest, code_suffix: normalized.slice(-4) });
    }
    const { error: codeError } = await admin.from('promo_codes').insert(rows);
    if (codeError) {
      await admin.from('promo_code_batches').delete().eq('id', batch.id);
      throw new Error('Could not save the access-code batch.');
    }
    return json(request, { batch, codes: generated });
  } catch (error) { return errorResponse(request, error, 400); }
});
