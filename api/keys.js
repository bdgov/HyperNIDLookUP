import crypto from 'node:crypto';
import { adminDb, requireUser, methodNotAllowed, validJsonBody } from './_lib/supabase.js';

export default async function handler(req, res) {
  const auth = await requireUser(req);
  if (auth.error) return res.status(auth.status).json({ success: false, message: auth.error });

  if (req.method === 'GET') {
    const { data, error } = await adminDb.from('api_keys')
      .select('id,key_name,key_prefix,is_active,last_used_at,created_at')
      .eq('user_id', auth.user.id).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ success: false, message: 'Could not load API keys' });
    return res.status(200).json({ success: true, keys: data });
  }

  if (req.method !== 'POST') return methodNotAllowed(res, 'GET, POST');
  if (!validJsonBody(req, res, 2000)) return;
  const name = String(req.body.name || '').trim().slice(0, 60);
  if (!name) return res.status(400).json({ success: false, message: 'Key name is required' });

  const { data: entitlements, error: entitlementError } = await adminDb
    .from('transactions').select('package_id,packages(api_access)')
    .eq('user_id', auth.user.id).eq('status', 'completed');
  if (entitlementError) return res.status(500).json({ success: false, message: 'Could not verify API access' });
  if (!(entitlements || []).some(t => t.packages?.api_access === true)) {
    return res.status(403).json({ success: false, message: 'An API-enabled package is required' });
  }

  const secret = `hnl_${crypto.randomBytes(32).toString('hex')}`;
  const hash = crypto.createHash('sha256').update(secret).digest('hex');
  const { error } = await adminDb.from('api_keys').insert({
    user_id: auth.user.id, key_name: name, key_hash: hash, key_prefix: secret.slice(0, 12), is_active: true
  });
  if (error) return res.status(500).json({ success: false, message: 'Could not create API key' });
  // Full secret is shown exactly once. Only its SHA-256 hash is stored.
  return res.status(201).json({ success: true, apiKey: secret });
}
