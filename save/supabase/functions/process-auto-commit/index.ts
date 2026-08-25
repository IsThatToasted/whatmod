import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'content-type': 'application/json' };
Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: cors });
  const expected = Deno.env.get('SAVE_AUTOCOMMIT_CRON_SECRET');
  const supplied = req.headers.get('x-save-cron-secret');
  if (!expected || !supplied || supplied !== expected) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors });
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return new Response(JSON.stringify({ error: 'Server configuration missing' }), { status: 500, headers: cors });
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.rpc('process_due_auto_commits');
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cors });
  return new Response(JSON.stringify({ ok: true, commitments_updated: data ?? 0 }), { headers: cors });
});
