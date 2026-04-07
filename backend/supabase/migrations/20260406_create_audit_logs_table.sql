-- Create audit_logs table for admin action tracking
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID,
  actor_role TEXT NOT NULL DEFAULT 'system',
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  old_value JSONB DEFAULT '{}',
  new_value JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add foreign key constraint (optional - admin_id may be UUID without FK)
-- Note: Uncomment if admin_id references public.users or auth.users
-- ALTER TABLE audit_logs
-- ADD CONSTRAINT audit_logs_admin_id_fkey 
-- FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Create indexes for query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_role ON audit_logs(actor_role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata ON audit_logs USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_audit_logs_old_value ON audit_logs USING GIN (old_value);
CREATE INDEX IF NOT EXISTS idx_audit_logs_new_value ON audit_logs USING GIN (new_value);

-- Enable Row-Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Row-level security policies
-- Service role (backend) - full access for logging
CREATE POLICY "audit_logs_service_role_access" ON audit_logs
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Admin role - can select logs via application middleware
CREATE POLICY "audit_logs_admin_access" ON audit_logs
  FOR SELECT
  USING (auth.role() = 'service_role');
