-- Create custom users profile table for additional data
-- The following ALTER TABLE statements for auth.users have been removed
-- as they caused permission errors and are redundant with the public.user_profiles table.
-- ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'explorer';
-- ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) DEFAULT 'pending';
-- ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0;
-- ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
-- ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS profile JSONB DEFAULT '{}';
-- ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
-- ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
-- ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS backup_codes TEXT[];

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'explorer',
    account_status VARCHAR(50) DEFAULT 'active',
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    profile JSONB DEFAULT '{}',
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret TEXT,
    backup_codes TEXT[],
    password_history JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_account_status ON public.user_profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_locked_until ON public.user_profiles(locked_until);

-- Add constraints
-- Drop constraints if they already exist to make migration idempotent
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS chk_user_profiles_role;
ALTER TABLE public.user_profiles ADD CONSTRAINT chk_user_profiles_role
  CHECK (role IN ('explorer', 'professional', 'enterprise', 'admin'));
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS chk_user_profiles_account_status;
ALTER TABLE public.user_profiles ADD CONSTRAINT chk_user_profiles_account_status
  CHECK (account_status IN ('pending', 'active', 'locked', 'suspended', 'deactivated'));

-- Create trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, role, profile)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'explorer'), -- Corrected: Use raw_user_meta_data for role
    COALESCE(NEW.raw_user_meta_data -> 'profile', '{}') -- Corrected: Use raw_user_meta_data for profile
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if it exists to make migration idempotent
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();