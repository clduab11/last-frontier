-- Combined migrations for remaining database changes

-- =======================
-- SESSION MANAGEMENT
-- =======================

-- Create enhanced user sessions table
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL UNIQUE,
    refresh_token VARCHAR(255) NOT NULL UNIQUE,
    device_info JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_token ON public.user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_refresh_token ON public.user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON public.user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_is_active ON public.user_sessions(is_active);

-- Session cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM public.user_sessions WHERE expires_at < CURRENT_TIMESTAMP;
    DELETE FROM public.user_sessions WHERE is_active = FALSE AND created_at < CURRENT_TIMESTAMP - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================
-- OAUTH INTEGRATION
-- =======================

-- Create enhanced oauth accounts table
CREATE TABLE IF NOT EXISTS public.oauth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_account_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP,
    scope TEXT,
    token_type VARCHAR(50) DEFAULT 'Bearer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for OAuth
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON public.oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider ON public.oauth_accounts(provider);
CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_accounts_provider_user ON public.oauth_accounts(provider, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_accounts_provider_account ON public.oauth_accounts(provider, provider_account_id);

-- Add constraints for OAuth
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_oauth_provider') THEN
        ALTER TABLE public.oauth_accounts ADD CONSTRAINT chk_oauth_provider 
        CHECK (provider IN ('google', 'github', 'linkedin'));
    END IF;
END $$;

-- Function to handle OAuth account creation
CREATE OR REPLACE FUNCTION public.handle_oauth_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert OAuth account record
  INSERT INTO public.oauth_accounts (
    user_id, 
    provider, 
    provider_account_id, 
    provider_email,
    access_token,
    refresh_token
  )
  VALUES (
    NEW.id,
    NEW.raw_app_meta_data ->> 'provider',
    NEW.raw_app_meta_data ->> 'sub',
    NEW.email,
    NEW.raw_app_meta_data ->> 'provider_token',
    NEW.raw_app_meta_data ->> 'provider_refresh_token'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate OAuth trigger
DROP TRIGGER IF EXISTS on_oauth_user_created ON auth.users;
CREATE TRIGGER on_oauth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  WHEN (NEW.raw_app_meta_data ->> 'provider' IS NOT NULL)
  EXECUTE FUNCTION public.handle_oauth_signup();

-- =======================
-- AUDIT LOGGING
-- =======================

-- Create audit logs table with partitioning
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions for current and next 2 months
CREATE TABLE IF NOT EXISTS public.audit_logs_y2025m05 PARTITION OF public.audit_logs
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE IF NOT EXISTS public.audit_logs_y2025m06 PARTITION OF public.audit_logs
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE IF NOT EXISTS public.audit_logs_y2025m07 PARTITION OF public.audit_logs
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

-- Add indexes for audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON public.audit_logs(success);

-- =======================
-- RATE LIMITING
-- =======================

-- Create rate limiting table
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(255) NOT NULL, -- IP address, user ID, or API key
    endpoint VARCHAR(255) NOT NULL,
    request_count INTEGER DEFAULT 1,
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    window_end TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for rate limiting
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier ON public.rate_limits(identifier);
CREATE INDEX IF NOT EXISTS idx_rate_limits_endpoint ON public.rate_limits(endpoint);
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_end ON public.rate_limits(window_end);
CREATE INDEX IF NOT EXISTS idx_rate_limits_identifier_endpoint ON public.rate_limits(identifier, endpoint);

-- Rate limit cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM public.rate_limits WHERE window_end < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;