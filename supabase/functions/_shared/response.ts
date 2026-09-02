import { corsHeaders } from './cors.ts';

export function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export function errorResponse(request: Request, error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : 'Unexpected server error.';
  return json(request, { error: message }, status);
}
