import { methodNotAllowed } from './_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  // Deliberately fail closed: a browser callback is not proof of payment.
  // Add a provider-specific server-to-server verification adapter before enabling a gateway.
  return res.status(503).json({
    success: false,
    message: 'Automatic payment verification is disabled until a merchant gateway adapter and server credentials are configured.'
  });
}
