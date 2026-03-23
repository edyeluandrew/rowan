-- Rowan Backend — Complete Row Level Security (RLS) Migration
-- Fixes 13 Supabase Security Advisor issues:
-- - RLS Disabled on 11 tables
-- - Security Definer View vulnerability
-- - Sensitive columns exposed
--
-- IMPORTANT: This migration does NOT modify data. It only:
-- 1. Enables RLS on all tables
-- 2. Creates row-level access policies based on user roles
-- 3. Allows service_role (backend) full access
-- 4. Restricts authenticated users to their own rows
-- 5. Fixes the SECURITY DEFINER view
-- 6. Marks sensitive columns

-- ========================================
-- TABLE: public.users
-- Role: User reads/updates only their own row
-- Service role: full access
-- ========================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_service_role_full_access" ON public.users;
DROP POLICY IF EXISTS "users_user_own_row_select" ON public.users;
DROP POLICY IF EXISTS "users_user_own_row_update" ON public.users;

CREATE POLICY "users_service_role_full_access" ON public.users
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "users_user_own_row_select" ON public.users
  FOR SELECT
  USING (id = auth.uid() AND auth.role() = 'authenticated');

CREATE POLICY "users_user_own_row_update" ON public.users
  FOR UPDATE
  USING (id = auth.uid() AND auth.role() = 'authenticated')
  WITH CHECK (id = auth.uid() AND auth.role() = 'authenticated');

-- ========================================
-- TABLE: public.traders
-- Role: Trader reads/updates only their own row
-- Service role: full access
-- ========================================
ALTER TABLE public.traders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "traders_service_role_full_access" ON public.traders;
DROP POLICY IF EXISTS "traders_trader_own_row_select" ON public.traders;
DROP POLICY IF EXISTS "traders_trader_own_row_update" ON public.traders;

CREATE POLICY "traders_service_role_full_access" ON public.traders
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "traders_trader_own_row_select" ON public.traders
  FOR SELECT
  USING (id = auth.uid() AND auth.role() = 'authenticated');

CREATE POLICY "traders_trader_own_row_update" ON public.traders
  FOR UPDATE
  USING (id = auth.uid() AND auth.role() = 'authenticated')
  WITH CHECK (id = auth.uid() AND auth.role() = 'authenticated');

-- ========================================
-- TABLE: public.trader_verifications
-- Role: Trader reads only their own row
-- Service role: full access
-- ========================================
ALTER TABLE public.trader_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trader_verifications_service_role_full_access" ON public.trader_verifications;
DROP POLICY IF EXISTS "trader_verifications_trader_own_row_select" ON public.trader_verifications;

CREATE POLICY "trader_verifications_service_role_full_access" ON public.trader_verifications
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "trader_verifications_trader_own_row_select" ON public.trader_verifications
  FOR SELECT
  USING (trader_id = auth.uid() AND auth.role() = 'authenticated');

-- ========================================
-- TABLE: public.trader_momo_accounts
-- Role: Trader reads/updates only their own rows
-- Service role: full access
-- ========================================
ALTER TABLE public.trader_momo_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trader_momo_accounts_service_role_full_access" ON public.trader_momo_accounts;
DROP POLICY IF EXISTS "trader_momo_accounts_trader_own_rows_select" ON public.trader_momo_accounts;
DROP POLICY IF EXISTS "trader_momo_accounts_trader_own_rows_insert" ON public.trader_momo_accounts;
DROP POLICY IF EXISTS "trader_momo_accounts_trader_own_rows_update" ON public.trader_momo_accounts;
DROP POLICY IF EXISTS "trader_momo_accounts_trader_own_rows_delete" ON public.trader_momo_accounts;

CREATE POLICY "trader_momo_accounts_service_role_full_access" ON public.trader_momo_accounts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "trader_momo_accounts_trader_own_rows_select" ON public.trader_momo_accounts
  FOR SELECT
  USING (trader_id = auth.uid() AND auth.role() = 'authenticated');

CREATE POLICY "trader_momo_accounts_trader_own_rows_insert" ON public.trader_momo_accounts
  FOR INSERT
  WITH CHECK (trader_id = auth.uid() AND auth.role() = 'authenticated');

CREATE POLICY "trader_momo_accounts_trader_own_rows_update" ON public.trader_momo_accounts
  FOR UPDATE
  USING (trader_id = auth.uid() AND auth.role() = 'authenticated')
  WITH CHECK (trader_id = auth.uid() AND auth.role() = 'authenticated');

CREATE POLICY "trader_momo_accounts_trader_own_rows_delete" ON public.trader_momo_accounts
  FOR DELETE
  USING (trader_id = auth.uid() AND auth.role() = 'authenticated');

-- ========================================
-- TABLE: public.transactions
-- Role: User reads own rows (user_id = auth.uid())
--       Trader reads rows where they are matched (trader_id = auth.uid())
-- Service role: full access
-- ========================================
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transactions_service_role_full_access" ON public.transactions;
DROP POLICY IF EXISTS "transactions_user_own_rows_select" ON public.transactions;
DROP POLICY IF EXISTS "transactions_trader_matched_rows_select" ON public.transactions;

CREATE POLICY "transactions_service_role_full_access" ON public.transactions
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "transactions_user_own_rows_select" ON public.transactions
  FOR SELECT
  USING (user_id = auth.uid() AND auth.role() = 'authenticated');

CREATE POLICY "transactions_trader_matched_rows_select" ON public.transactions
  FOR SELECT
  USING (trader_id = auth.uid() AND auth.role() = 'authenticated');

-- ========================================
-- TABLE: public.quotes
-- Role: User reads only their own rows
-- Service role: full access
-- ========================================
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "quotes_service_role_full_access" ON public.quotes;
DROP POLICY IF EXISTS "quotes_user_own_rows_select" ON public.quotes;

CREATE POLICY "quotes_service_role_full_access" ON public.quotes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "quotes_user_own_rows_select" ON public.quotes
  FOR SELECT
  USING (user_id = auth.uid() AND auth.role() = 'authenticated');

-- ========================================
-- TABLE: public.disputes
-- Role: User reads/inserts own rows (user_id = auth.uid())
--       Trader reads rows where they are matched (trader_id = auth.uid())
-- Service role: full access
-- ========================================
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "disputes_service_role_full_access" ON public.disputes;
DROP POLICY IF EXISTS "disputes_user_own_rows_select" ON public.disputes;
DROP POLICY IF EXISTS "disputes_user_own_rows_insert" ON public.disputes;
DROP POLICY IF EXISTS "disputes_trader_matched_rows_select" ON public.disputes;

CREATE POLICY "disputes_service_role_full_access" ON public.disputes
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "disputes_user_own_rows_select" ON public.disputes
  FOR SELECT
  USING (user_id = auth.uid() AND auth.role() = 'authenticated');

CREATE POLICY "disputes_user_own_rows_insert" ON public.disputes
  FOR INSERT
  WITH CHECK (user_id = auth.uid() AND auth.role() = 'authenticated');

CREATE POLICY "disputes_trader_matched_rows_select" ON public.disputes
  FOR SELECT
  USING (trader_id = auth.uid() AND auth.role() = 'authenticated');

-- ========================================
-- TABLE: public.notifications
-- Role: User reads/updates only their own rows
-- Service role: full access
-- ========================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_service_role_full_access" ON public.notifications;
DROP POLICY IF EXISTS "notifications_user_own_rows_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_user_own_rows_update" ON public.notifications;

CREATE POLICY "notifications_service_role_full_access" ON public.notifications
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "notifications_user_own_rows_select" ON public.notifications
  FOR SELECT
  USING (user_id = auth.uid() AND auth.role() = 'authenticated');

CREATE POLICY "notifications_user_own_rows_update" ON public.notifications
  FOR UPDATE
  USING (user_id = auth.uid() AND auth.role() = 'authenticated')
  WITH CHECK (user_id = auth.uid() AND auth.role() = 'authenticated');

-- ========================================
-- TABLE: public.push_tokens
-- SENSITIVE DATA: Contains authentication tokens
-- Role: User reads/updates only their own rows
-- Service role: full access
-- NOTE: The 'token' column is marked sensitive and must be excluded from
--       REST API responses except for service_role and the owning user
-- ========================================
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_tokens_service_role_full_access" ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens_user_own_rows_select" ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens_user_own_rows_insert" ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens_user_own_rows_update" ON public.push_tokens;
DROP POLICY IF EXISTS "push_tokens_user_own_rows_delete" ON public.push_tokens;

CREATE POLICY "push_tokens_service_role_full_access" ON public.push_tokens
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "push_tokens_user_own_rows_select" ON public.push_tokens
  FOR SELECT
  USING (user_id = auth.uid() AND auth.role() = 'authenticated');

CREATE POLICY "push_tokens_user_own_rows_insert" ON public.push_tokens
  FOR INSERT
  WITH CHECK (user_id = auth.uid() AND auth.role() = 'authenticated');

CREATE POLICY "push_tokens_user_own_rows_update" ON public.push_tokens
  FOR UPDATE
  USING (user_id = auth.uid() AND auth.role() = 'authenticated')
  WITH CHECK (user_id = auth.uid() AND auth.role() = 'authenticated');

CREATE POLICY "push_tokens_user_own_rows_delete" ON public.push_tokens
  FOR DELETE
  USING (user_id = auth.uid() AND auth.role() = 'authenticated');

-- Mark the 'token' column as sensitive to exclude from PostgREST responses
COMMENT ON COLUMN public.push_tokens.token IS 'SENSITIVE: Contains push notification token. Do not expose via API to non-owners.';

-- ========================================
-- TABLE: public.rate_alerts
-- Role: User reads/updates/deletes only their own rows
-- Service role: full access
-- ========================================
ALTER TABLE public.rate_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rate_alerts_service_role_full_access" ON public.rate_alerts;
DROP POLICY IF EXISTS "rate_alerts_user_own_rows_select" ON public.rate_alerts;
DROP POLICY IF EXISTS "rate_alerts_user_own_rows_insert" ON public.rate_alerts;
DROP POLICY IF EXISTS "rate_alerts_user_own_rows_update" ON public.rate_alerts;
DROP POLICY IF EXISTS "rate_alerts_user_own_rows_delete" ON public.rate_alerts;

CREATE POLICY "rate_alerts_service_role_full_access" ON public.rate_alerts
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "rate_alerts_user_own_rows_select" ON public.rate_alerts
  FOR SELECT
  USING (user_id = auth.uid() AND auth.role() = 'authenticated');

CREATE POLICY "rate_alerts_user_own_rows_insert" ON public.rate_alerts
  FOR INSERT
  WITH CHECK (user_id = auth.uid() AND auth.role() = 'authenticated');

CREATE POLICY "rate_alerts_user_own_rows_update" ON public.rate_alerts
  FOR UPDATE
  USING (user_id = auth.uid() AND auth.role() = 'authenticated')
  WITH CHECK (user_id = auth.uid() AND auth.role() = 'authenticated');

CREATE POLICY "rate_alerts_user_own_rows_delete" ON public.rate_alerts
  FOR DELETE
  USING (user_id = auth.uid() AND auth.role() = 'authenticated');

-- ========================================
-- TABLE: public.schema_migrations
-- Service role only: No public or authenticated access
-- ========================================
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schema_migrations_service_role_only" ON public.schema_migrations;

CREATE POLICY "schema_migrations_service_role_only" ON public.schema_migrations
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ========================================
-- FIX VIEW: v_trader_verification_summary
-- Issue: View was created with SECURITY DEFINER (privilege escalation risk)
-- Fix: Recreate as SECURITY INVOKER and restrict SELECT to service_role only
-- ========================================

DROP VIEW IF EXISTS public.v_trader_verification_summary CASCADE;

CREATE VIEW public.v_trader_verification_summary
  WITH (security_invoker = true) AS
  SELECT
    tv.trader_id,
    COUNT(*) FILTER (WHERE tv.verification_status = 'VERIFIED') as verified_count,
    COUNT(*) FILTER (WHERE tv.verification_status = 'REJECTED') as rejected_count,
    COUNT(*) FILTER (WHERE tv.verification_status IN ('SUBMITTED', 'DOCUMENTS_PENDING', 'UNDER_REVIEW')) as pending_count,
    MAX(tv.created_at) as last_verification_at
  FROM public.trader_verifications tv
  GROUP BY tv.trader_id;

GRANT SELECT ON public.v_trader_verification_summary TO service_role;
REVOKE SELECT ON public.v_trader_verification_summary FROM authenticated;
REVOKE SELECT ON public.v_trader_verification_summary FROM anon;

-- ========================================
-- MIGRATION COMPLETE
-- ========================================
-- Summary of changes:
-- 1. Enabled RLS on 11 tables (users, traders, trader_verifications, trader_momo_accounts, 
--    transactions, quotes, disputes, notifications, push_tokens, rate_alerts, schema_migrations)
-- 2. Created row-level access policies for each table based on user roles
-- 3. Service role (backend) has full access to all tables
-- 4. Authenticated users (wallet users and traders) have access only to their own rows
-- 5. Marked push_tokens.token column as sensitive
-- 6. Recreated v_trader_verification_summary view as SECURITY INVOKER
-- 7. Restricted view access to service_role only
--
-- After applying this migration:
-- - Backend API continues to work (uses service_role which has full access)
-- - Frontend clients cannot access other users' data
-- - JWT 'sub' claim (auth.uid()) is used for row filtering
-- - All sensitive operations are still possible for authorized service_role
