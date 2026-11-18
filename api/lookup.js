import crypto from 'node:crypto';
import {
  adminDb,
  requireUser,
  methodNotAllowed,
  validJsonBody,
  sameOrigin
} from './_lib/supabase.js';

const sha256 = value =>
  crypto.createHash('sha256').update(value).digest('hex');

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  if (!sameOrigin(req)) {
    return res.status(403).json({
      success: false,
      message: 'Origin not allowed'
    });
  }

  if (!validJsonBody(req, res, 4000)) return;

  try {
    const auth = await requireUser(req);

    if (auth.error) {
      return res.status(auth.status).json({
        success: false,
        message: auth.error
      });
    }

    const nid = String(req.body.nid || '').replace(/\s+/g, '');
    const dob = String(req.body.dob || '');

    if (!/^\d{10,17}$/.test(nid) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid NID or date of birth format'
      });
    }

    const providerUrl = process.env.NID_PROVIDER_URL;

    if (!providerUrl) {
      return res.status(503).json({
        success: false,
        message: 'NID provider is not configured'
      });
    }

    const requestId = crypto.randomUUID();
    const userId = auth.user.id;
    const started = Date.now();

    const ip = String(
      req.headers['x-forwarded-for'] ||
      req.socket?.remoteAddress ||
      'unknown'
    ).split(',')[0].trim();

    const rateKey = sha256(`${userId}:${ip}`);

    const { data: allowed, error: rateError } =
      await adminDb.rpc('check_lookup_rate_limit', {
        p_user_id: userId,
        p_bucket_key: rateKey,
        p_limit: 5
      });

    if (rateError || allowed !== true) {
      return res.status(429).json({
        success: false,
        message: 'Too many lookup attempts. Try again later.'
      });
    }

    let debited = false;

    try {
      const { data: debit, error: debitError } =
        await adminDb.rpc('consume_one_credit', {
          p_user_id: userId,
          p_request_id: requestId
        });

      if (debitError) throw debitError;

      if (!debit?.success) {
        return res.status(402).json({
          success: false,
          message: 'Insufficient credits'
        });
      }

      debited = true;

      // Provider accepts GET parameters: nid and dob.
      const url = new URL(providerUrl);

      if (url.protocol !== 'https:') {
        throw new Error('Provider URL must use HTTPS');
      }

      url.searchParams.set('nid', nid);
      url.searchParams.set('dob', dob);

      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        12000
      );

      let upstream;

      try {
        const headers = {
          Accept: 'application/json'
        };

        if (process.env.NID_PROVIDER_TOKEN) {
          headers.Authorization =
            `Bearer ${process.env.NID_PROVIDER_TOKEN}`;
        }

        upstream = await fetch(url, {
          method: 'GET',
          headers,
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!upstream.ok) {
        throw new Error(`Provider HTTP ${upstream.status}`);
      }

      const contentType =
        upstream.headers.get('content-type') || '';

      if (!contentType.includes('application/json')) {
        throw new Error('Provider returned non-JSON response');
      }

      const payload = await upstream.json();

      if (payload?.success !== true || !payload?.data) {
        const { error: refundError } =
          await adminDb.rpc('refund_one_credit', {
            p_user_id: userId,
            p_request_id: requestId
          });

        if (refundError) throw refundError;

        debited = false;

        await adminDb.from('lookup_logs').insert({
          user_id: userId,
          nid_hash: sha256(nid),
          status: 'not_found',
          response_time_ms: Date.now() - started
        });

        return res.status(200).json({
          success: false,
          message: 'No matching record found. Credit refunded.'
        });
      }

      await adminDb.from('lookup_logs').insert({
        user_id: userId,
        nid_hash: sha256(nid),
        status: 'success',
        response_time_ms: Date.now() - started
      });

      return res.status(200).json({
        success: true,
        message: payload.message || 'Verification successful',
        data: payload.data
      });

    } catch (error) {
      if (debited) {
        const { error: refundError } =
          await adminDb.rpc('refund_one_credit', {
            p_user_id: userId,
            p_request_id: requestId
          });

        if (refundError) {
          console.error('Credit refund failed:', requestId);
        }
      }

      console.error('Lookup failed:', error?.message || 'Unknown error');

      return res.status(502).json({
        success: false,
        message: 'Verification provider unavailable. Please try again later.'
      });
    }

  } catch (error) {
    console.error('Lookup API error:', error?.message || 'Unknown error');

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}
