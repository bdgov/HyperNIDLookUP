# HyperNIDLookUP — security-focused rebuild base

This ZIP preserves the existing public pages and visual styling where possible, adds a modular server-side API layer, a new Admin Control Center, a clean Supabase schema, and manual bKash/Nagad/Rocket payment submission with admin approval.

## Important limitations — read before deploying

1. **No software can promise 100% hack-proof security.** This project uses server-side authentication, database RLS, least-privilege grants, atomic credit operations, and server-side payment approval. Keep secrets private and monitor logs.
2. **NID lookup is disabled until you configure a lawful, authorized identity-verification provider.** Set `NID_PROVIDER_URL` and `NID_PROVIDER_TOKEN` in Vercel. The provider must accept a POST JSON body `{ "nid": "...", "dob": "YYYY-MM-DD" }` and return JSON with `success: true` (or `code: 200`) and a `data` object. Do not use unauthorized NID databases or services.
3. **Manual payments are implemented as pending orders.** Admin approval adds credits once, atomically. Add receiving numbers under `/admin-tools.html` after installing the database.
4. **Automatic SSLCommerz/bKash/Nagad checkout is fail-closed and not enabled in this build.** Each provider needs merchant credentials, callback URLs, and server-to-server validation. Do not mark a payment successful based on browser input. Add the provider credentials and confirm which merchant products/accounts you have before enabling an adapter.
5. The Admin Control Center is a new separate page at `/admin-tools.html`; the original Admin UI remains at `/admin.html`.

## 1. Database installation

- Back up existing Supabase data first.
- Open Supabase → SQL Editor.
- Run `database/RESET_AND_INSTALL.sql` as project owner.
- This script **drops the app's public tables** (`profiles`, `user_credits`, `packages`, `transactions`, `api_keys`, `lookup_logs`, etc.) and recreates them. It does **not** delete `auth.users`.
- Create your own account through the normal signup page.
- Promote your own account to admin by running this once, replacing the email:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'YOUR-ADMIN-EMAIL';
```

- Sign out and sign in again, then open `/admin-tools.html`.

## 2. Vercel environment variables

Copy `.env.example` values into Vercel → Project → Settings → Environment Variables. Required:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (the Supabase publishable/anon key)
- `SUPABASE_SERVICE_ROLE_KEY` (**secret**; server-side only)

For lookup, also set `NID_PROVIDER_URL` and `NID_PROVIDER_TOKEN` for a provider you are authorized to use. Never put the service role key or provider token in `public/` or GitHub.

Optional: `APP_ORIGIN=https://your-domain.example` to enforce an exact browser Origin on API POSTs.

## 3. Deploy

1. Extract the ZIP.
2. Push the project files to your GitHub repository (do not upload `.env` files or secrets).
3. Import the repository into Vercel.
4. Add the environment variables above.
5. Deploy, then test Signup, Login, Admin guard, package list, manual payment order, admin approval, credit balance, and authorized lookup.

## 4. Manual payment flow

1. Admin opens `/admin-tools.html` and adds a bKash/Nagad/Rocket receiving number.
2. User selects a package, chooses a configured method, sends the exact amount, then submits sender phone and transaction ID.
3. The order is saved as `pending`; no credit is granted yet.
4. Admin reviews it in `/admin.html` and approves. Database RPC locks the transaction and adds credits once.

## 5. Security notes

- The browser no longer sends a trusted `userId` for NID lookup. The API derives the user from a verified Supabase access token.
- NID/DOB are sent only to the configured upstream provider and are not stored in lookup logs. Logs store a SHA-256 hash of NID only.
- Credits are debited atomically and refunded on provider failure.
- API key secrets are generated on the server; only their SHA-256 hashes are stored. The full key is shown once.
- The browser Supabase key is public by design. The service-role key must remain server-only.
- Do not expose lookup results to third parties or use this system without legal authorization and a valid purpose.

## 6. Files to configure before production

- `.env.example`: copy required values into Vercel settings.
- `database/RESET_AND_INSTALL.sql`: new database schema and security functions.
- `api/_lib/supabase.js`: shared verified-auth helpers.
- `api/lookup.js`: authorized provider adapter, atomic credit debit/refund and rate limit.
- `api/create-payment.js`: manual order endpoint; automatic methods fail closed.
- `api/keys.js`: hashed API-key generation.
- `public/admin-tools.html`: packages, manual payment methods, site settings, user role and credit controls.

## 7. Testing checklist

- A normal user cannot update `profiles.role` or `user_credits` directly.
- A normal user cannot insert or approve transactions directly.
- A user cannot query another user's profile/credits/logs/API-key metadata.
- An unauthenticated request to `/api/lookup` returns 401.
- A forged `userId` is ignored because the endpoint does not accept it.
- A failed provider request refunds the reserved credit.
- A duplicate manual transaction reference is rejected.
- Approving one transaction twice does not add credits twice.
- Automatic gateway checkout remains disabled until provider-specific server verification is implemented.
