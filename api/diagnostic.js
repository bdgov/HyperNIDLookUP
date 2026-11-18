export default function handler(req, res) {
  const names = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_PUBLISHABLE_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SECRET_KEY'
  ];

  const envStatus = {};

  for (const name of names) {
    envStatus[name] = Boolean(process.env[name]);
  }

  return res.status(200).json({
    diagnostic: 'HYPERNID_DIAGNOSTIC_V1',
    deployment: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
    project: process.env.VERCEL_PROJECT_ID || 'unknown',
    environment: process.env.VERCEL_ENV || 'unknown',
    node: process.version,
    variables: envStatus,
    timestamp: new Date().toISOString()
  });
}
