import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const auth = req.headers.get('Authorization');
  if (!auth) return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } });

  const body = await req.json().catch(() => null);
  if (!body?.rooms || !Array.isArray(body.rooms)) return new Response(JSON.stringify({ error: 'rooms[] is required' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });

  // Provider-neutral production boundary. Add an AI provider here using a server-only secret.
  // Never accept provider credentials from the client. Measurements remain authoritative input,
  // and generated text must never modify them without explicit user review.
  const roomNames = body.rooms.map((r: { name?: string }) => r.name).filter(Boolean);
  return new Response(JSON.stringify({
    status: 'provider_not_configured',
    summary: null,
    message: 'Configure a server-side AI provider secret before enabling generated estimate summaries.',
    capturedRooms: roomNames.length
  }), { headers: { ...cors, 'Content-Type': 'application/json' } });
});
