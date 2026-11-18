import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon || !service) {
  throw new Error('Missing SUPABASE_URL, SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY');
}

export const adminDb = createClient(url, service, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

export function userDb(accessToken) {
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } }
  });
}

export async function requireUser(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return { error: 'Authentication required', status: 401 };

  const userClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${match[1]}` } }
  });
  const { data, error } = await userClient.auth.getUser(match[1]);
  if (error || !data?.user) return { error: 'Invalid or expired session', status: 401 };
  return { user: data.user, token: match[1] };
}

export async function requireAdmin(req) {
  const auth = await requireUser(req);
  if (auth.error) return auth;
  const { data: profile, error } = await adminDb
    .from('profiles').select('role').eq('id', auth.user.id).maybeSingle();
  if (error || profile?.role !== 'admin') return { error: 'Admin access required', status: 403 };
  return auth;
}

export function methodNotAllowed(res, allowed = 'POST') {
  res.setHeader('Allow', allowed);
  return res.status(405).json({ success: false, message: 'Method not allowed' });
}

export function validJsonBody(req, res, maxBytes = 12000) {
  const rawLength = Number(req.headers['content-length'] || 0);
  const measuredLength = (() => { try { return Buffer.byteLength(JSON.stringify(req.body)); } catch { return maxBytes + 1; } })();
  if (rawLength > maxBytes || measuredLength > maxBytes) {
    res.status(413).json({ success: false, message: 'Request too large' });
    return false;
  }
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    res.status(400).json({ success: false, message: 'Invalid request body' });
    return false;
  }
  return true;
}

export function sameOrigin(req) {
  const expected = process.env.APP_ORIGIN;
  const origin = req.headers.origin;
  return !expected || !origin || origin === expected;
}
