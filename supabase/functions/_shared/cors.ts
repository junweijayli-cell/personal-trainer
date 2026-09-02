const configuredOrigins = (Deno.env.get('ALLOWED_ORIGINS') || Deno.env.get('APP_URL') || '')
  .split(',')
  .map((value) => {
    try { return new URL(value.trim()).origin; }
    catch { return value.trim().replace(/\/$/, ''); }
  })
  .filter(Boolean);

export function corsHeaders(request: Request) {
  const origin = request.headers.get('origin')?.replace(/\/$/, '') ?? '';
  const allowOrigin = configuredOrigins.includes(origin) ? origin : configuredOrigins[0] || '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Vary': 'Origin',
  };
}

export function handleOptions(request: Request) {
  if (request.method !== 'OPTIONS') return null;
  return new Response('ok', { headers: corsHeaders(request) });
}
