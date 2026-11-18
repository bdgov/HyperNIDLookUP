-- Run after RESET_AND_INSTALL.sql. Read-only verification.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r'
  AND c.relname IN ('profiles','user_credits','packages','payment_methods','transactions','api_keys','lookup_logs','site_settings','credit_operations','api_rate_limits')
ORDER BY c.relname;

SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema='public'
  AND table_name IN ('profiles','user_credits','packages','payment_methods','transactions','api_keys','lookup_logs','site_settings')
  AND grantee IN ('anon','authenticated','service_role')
ORDER BY table_name,grantee,privilege_type;

SELECT p.proname AS function_name, pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef AS security_definer, p.proconfig AS settings
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public'
  AND p.proname IN ('is_admin','handle_new_user','create_manual_order','admin_review_transaction',
                    'consume_one_credit','refund_one_credit','admin_adjust_credits',
                    'admin_set_user_role','admin_grant_package','check_lookup_rate_limit')
ORDER BY p.proname;

SELECT count(*) AS profiles_backfilled FROM public.profiles;
SELECT count(*) AS credit_rows FROM public.user_credits;
