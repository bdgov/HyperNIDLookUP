import crypto from 'node:crypto';
import { adminDb, requireUser, methodNotAllowed, validJsonBody, sameOrigin } from './_lib/supabase.js';

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  if (!sameOrigin(req)) return res.status(403).json({ success: false, message: 'Origin not allowed' });
  if (!validJsonBody(req, res, 4000)) return;

  const auth = await requireUser(req);
  if (auth.error) return res.status(auth.status).json({ success: false, message: auth.error });

  const nid = String(req.body.nid || '').replace(/\s+/g, '');
  const dob = String(req.body.dob || '');
  if (!/^\d{10,17}$/.test(nid) || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
    return res.status(400).json({ success: false, message: 'Invalid NID or date of birth format' });
  }
  if (!process.env.NID_PROVIDER_URL || !process.env.NID_PROVIDER_TOKEN) {
    return res.status(503).json({ success: false, message: 'Authorized NID provider is not configured' });
  }

  const requestId = crypto.randomUUID();
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const rateKey = sha256(`${auth.user.id}:${ip}`);
  const { data: allowed, error: rateError } = await adminDb.rpc('check_lookup_rate_limit', { p_user_id: auth.user.id, p_bucket_key: rateKey, p_limit: 5 });
  if (rateError || allowed !== true) return res.status(429).json({ success: false, message: 'Too many lookup attempts. Try again in one minute.' });
  const started = Date.now();
  let debited = false;
  try {
    // Atomic debit. User ID is derived only from the verified Supabase access token.
    const { data: debit, error: debitError } = await adminDb.rpc('consume_one_credit', {
      p_user_id: auth.user.id,
      p_request_id: requestId
    });
    if (debitError) throw debitError;
    if (!debit?.success) return res.status(402).json({ success: false, message: 'Insufficient credits' });
    debited = true;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Math.min(Number(process.env.NID_PROVIDER_TIMEOUT_MS || 12000), 20000));
    let upstream;
    try {
      upstream = await fetch(process.env.NID_PROVIDER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NID_PROVIDER_TOKEN}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify({ nid, dob }),
        signal: controller.signal
      });
    } finally { clearTimeout(timeout); }

    if (!upstream.ok) throw new Error(`Identity provider returned HTTP ${upstream.status}`);
    const payload = await upstream.json();
    if (!(payload?.success === true || payload?.code === 200)) {
      const { error: refundError } = await adminDb.rpc('refund_one_credit', { p_user_id: auth.user.id, p_request_id: requestId });
      if (refundError) throw refundError;
      debited = false;
      await adminDb.from('lookup_logs').insert({ user_id: auth.user.id, nid_hash: sha256(nid), status: 'not_found', response_time_ms: Date.now() - started });
      return res.status(200).json({ success: false, message: 'No matching record was returned. No credit was used.' });
    }

    await adminDb.from('lookup_logs').insert({ user_id: auth.user.id, nid_hash: sha256(nid), status: 'success', response_time_ms: Date.now() - started });
    // Never log or persist the raw NID/DOB. Return only the provider response to the authenticated owner.
    return res.status(200).json({ success: true, data: payload.data ?? payload.result ?? null });
  } catch (error) {
    if (debited) {
      const { error: refundError } = await adminDb.rpc('refund_one_credit', { p_user_id: auth.user.id, p_request_id: requestId });
      if (refundError) console.error('Credit refund failed; request:', requestId);
    }
    console.error('Lookup failed:', error?.message || 'unknown error');
    return res.status(502).json({ success: false, message: 'Verification provider is temporarily unavailable. Check your credit balance before retrying; contact support if a credit was not restored.' });
  }
}
