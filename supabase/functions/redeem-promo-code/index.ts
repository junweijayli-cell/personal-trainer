import { handleOptions } from '../_shared/cors.ts';
import { authenticatedUser } from '../_shared/auth.ts';
import { errorResponse, json } from '../_shared/response.ts';
import { normalizePromoCode, promoDigest } from '../_shared/promo.ts';

Deno.serve(async (request) => {
  const options = handleOptions(request); if (options) return options;
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed.' }, 405);
  try {
    const { userClient } = await authenticatedUser(request);
    const normalized = normalizePromoCode((await request.json())?.code);
    const digest = await promoDigest(normalized);
    // The RPC derives its recipient from auth.uid(); a service-role client has
    // no user identity and must never be used for this operation.
    const { data, error } = await userClient.rpc('redeem_promo_code', { p_digest: digest });
    if (error) throw new Error(error.message);
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw new Error('This access code is invalid or unavailable.');
    return json(request, { plan: result.plan, startsAt: result.starts_at, endsAt: result.ends_at });
  } catch (error) { return errorResponse(request, error, 400); }
});
