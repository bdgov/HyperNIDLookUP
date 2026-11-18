import { userDb, requireUser, methodNotAllowed, validJsonBody, sameOrigin } from './_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  if (!sameOrigin(req)) return res.status(403).json({ success: false, message: 'Origin not allowed' });
  if (!validJsonBody(req, res, 5000)) return;
  const auth = await requireUser(req);
  if (auth.error) return res.status(auth.status).json({ success: false, message: auth.error });

  const packageId = Number(req.body.packageId);
  const method = String(req.body.method || 'manual');
  if (!Number.isInteger(packageId) || packageId < 1) return res.status(400).json({ success: false, message: 'Invalid package' });

  if (method === 'manual') {
    const { data, error } = await userDb(auth.token).rpc('create_manual_order', {
      p_package_id: packageId,
      p_payment_method: String(req.body.paymentMethod || ''),
      p_sender_phone: String(req.body.senderPhone || '').trim(),
      p_transaction_ref: String(req.body.transactionRef || '').trim()
    });
    if (error) return res.status(400).json({ success: false, message: error.message });
    return res.status(201).json({ success: true, order: data });
  }

  // Live gateway sessions must be created and verified with the selected provider's
  // merchant credentials and callback protocol. Never accept a browser-supplied success flag.
  return res.status(503).json({ success: false, message: `${method} automatic checkout is not configured. Use manual payment or configure a verified gateway adapter.` });
}
