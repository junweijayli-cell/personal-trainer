import { handleOptions } from '../_shared/cors.ts';
import { authenticatedUser, adminClient } from '../_shared/auth.ts';
import { errorResponse, json } from '../_shared/response.ts';

Deno.serve(async (request) => {
  const options = handleOptions(request); if (options) return options;
  if (request.method !== 'GET') return json(request, { error: 'Method not allowed.' }, 405);
  try {
    const { user } = await authenticatedUser(request); const { data } = await adminClient().from('promo_operators').select('user_id').eq('user_id', user.id).maybeSingle();
    return json(request, { operator: Boolean(data) });
  } catch (error) { return errorResponse(request, error, 400); }
});
