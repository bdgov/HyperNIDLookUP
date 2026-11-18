import { createClient } from '@supabase/supabase-js';

function getConfig() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const anon =
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  const service =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  const missing = [];

  if (!url) missing.push('SUPABASE_URL');
  if (!anon) missing.push('SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY');
  if (!service) missing.push('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY');

  if (missing.length) {
    throw new Error(`Missing Supabase configuration: ${missing.join(', ')}`);
  }

  return { url, anon, service };
}

function getAdminClient() {
  const { url, service } = getConfig();

  return createClient(url, service, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

// Lazy initialization: missing environment variables won't crash
// the module before the API handler can return a JSON response.
export const adminDb = new Proxy({}, {
  get(_target, property) {
    const client = getAdminClient();
    const value = client[property];

    return typeof value === 'function'
      ? value.bind(client)
      : value;
  }
});

export function userDb(accessToken) {
  const { url, anon } = getConfig();

  return createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

export async function requireUser(req) {
  try {
    const { url, anon } = getConfig();

    const header = req.headers.authorization || '';
    const match = header.match(/^Bearer\s+(.+)$/i);

    if (!match) {
      return {
        error: 'Authentication required',
        status: 401
      };
    }

    const userClient = createClient(url, anon, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      global: {
        headers: {
          Authorization: `Bearer ${match[1]}`
        }
      }
    });

    const { data, error } =
      await userClient.auth.getUser(match[1]);

    if (error || !data?.user) {
      return {
        error: 'Invalid or expired session',
        status: 401
      };
    }

    return {
      user: data.user,
      token: match[1]
    };

  } catch (error) {
    console.error(
      'Supabase configuration error:',
      error?.message || 'Unknown error'
    );

    return {
      error: 'Server authentication configuration is incomplete',
      status: 503
    };
  }
}

export async function requireAdmin(req) {
  const auth = await requireUser(req);

  if (auth.error) return auth;

  try {
    const { data: profile, error } = await adminDb
      .from('profiles')
      .select('role')
      .eq('id', auth.user.id)
      .maybeSingle();

    if (error || profile?.role !== 'admin') {
      return {
        error: 'Admin access required',
        status: 403
      };
    }

    return auth;

  } catch (error) {
    console.error(
      'Admin verification error:',
      error?.message || 'Unknown error'
    );

    return {
      error: 'Admin verification is temporarily unavailable',
      status: 503
    };
  }
}

export function methodNotAllowed(res, allowed = 'POST') {
  res.setHeader('Allow', allowed);

  return res.status(405).json({
    success: false,
    message: 'Method not allowed'
  });
}

export function validJsonBody(req, res, maxBytes = 12000) {
  const rawLength = Number(
    req.headers['content-length'] || 0
  );

  const measuredLength = (() => {
    try {
      return Buffer.byteLength(JSON.stringify(req.body));
    } catch {
      return maxBytes + 1;
    }
  })();

  if (rawLength > maxBytes || measuredLength > maxBytes) {
    res.status(413).json({
      success: false,
      message: 'Request too large'
    });

    return false;
  }

  if (
    !req.body ||
    typeof req.body !== 'object' ||
    Array.isArray(req.body)
  ) {
    res.status(400).json({
      success: false,
      message: 'Invalid request body'
    });

    return false;
  }

  return true;
}

export function sameOrigin(req) {
  const expected = process.env.APP_ORIGIN;
  const origin = req.headers.origin;

  return !expected || !origin || origin === expected;
}
