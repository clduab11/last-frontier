# Database Schema & API Contracts - Authentication System

## 1. Database Schema Updates

### 1.1 Users Table Extensions

```sql
-- Extend existing users table with authentication fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'explorer';
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expiry TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expiry TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile JSONB DEFAULT '{}';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX IF NOT EXISTS idx_users_password_reset_token ON users(password_reset_token);
CREATE INDEX IF NOT EXISTS idx_users_account_status ON users(account_status);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Add constraints
ALTER TABLE users ADD CONSTRAINT chk_users_role 
  CHECK (role IN ('explorer', 'professional', 'enterprise', 'admin'));
ALTER TABLE users ADD CONSTRAINT chk_users_account_status 
  CHECK (account_status IN ('pending', 'active', 'locked', 'suspended', 'deactivated'));
```

### 1.2 User Sessions Table

```sql
-- Create user_sessions table
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token VARCHAR(255) NOT NULL UNIQUE,
    device_info JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_refresh_token ON user_sessions(refresh_token);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_is_active ON user_sessions(is_active);

-- Add cleanup function for expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (run via cron or scheduler)
-- SELECT cron.schedule('cleanup-sessions', '0 */6 * * *', 'SELECT cleanup_expired_sessions();');
```

### 1.3 OAuth Accounts Table

```sql
-- Create oauth_accounts table
CREATE TABLE oauth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

-- Add indexes
CREATE INDEX idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX idx_oauth_accounts_provider ON oauth_accounts(provider);
CREATE UNIQUE INDEX idx_oauth_accounts_provider_user ON oauth_accounts(provider, user_id);
CREATE UNIQUE INDEX idx_oauth_accounts_provider_account ON oauth_accounts(provider, provider_account_id);

-- Add constraints
ALTER TABLE oauth_accounts ADD CONSTRAINT chk_oauth_provider 
  CHECK (provider IN ('google', 'github', 'linkedin'));
```

### 1.4 Audit Logs Table

```sql
-- Create audit_logs table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(255),
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_success ON audit_logs(success);

-- Partition by month for performance
CREATE TABLE audit_logs_y2025m01 PARTITION OF audit_logs 
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
```

### 1.5 Rate Limiting Table

```sql
-- Create rate_limits table
CREATE TABLE rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier VARCHAR(255) NOT NULL, -- IP address or user ID
    endpoint VARCHAR(255) NOT NULL,
    attempts INTEGER DEFAULT 1,
    window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    window_end TIMESTAMP NOT NULL,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX idx_rate_limits_identifier ON rate_limits(identifier);
CREATE INDEX idx_rate_limits_endpoint ON rate_limits(endpoint);
CREATE INDEX idx_rate_limits_window_end ON rate_limits(window_end);
CREATE UNIQUE INDEX idx_rate_limits_identifier_endpoint ON rate_limits(identifier, endpoint);

-- Add cleanup function
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS void AS $$
BEGIN
    DELETE FROM rate_limits WHERE window_end < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;
```

### 1.6 Password History Table

```sql
-- Create password_history table
CREATE TABLE password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX idx_password_history_user_id ON password_history(user_id);
CREATE INDEX idx_password_history_created_at ON password_history(created_at);

-- Function to maintain password history (keep last 5)
CREATE OR REPLACE FUNCTION maintain_password_history()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert new password hash
    INSERT INTO password_history (user_id, password_hash)
    VALUES (NEW.id, NEW.password_hash);
    
    -- Keep only last 5 passwords
    DELETE FROM password_history 
    WHERE user_id = NEW.id 
    AND id NOT IN (
        SELECT id FROM password_history 
        WHERE user_id = NEW.id 
        ORDER BY created_at DESC 
        LIMIT 5
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trg_password_history
    AFTER UPDATE OF password_hash ON users
    FOR EACH ROW
    WHEN (OLD.password_hash IS DISTINCT FROM NEW.password_hash)
    EXECUTE FUNCTION maintain_password_history();
```

## 2. API Contract Specifications

### 2.1 Registration Endpoints

#### POST /auth/register

```typescript
// Request Body
interface RegisterRequest {
  email: string;          // Valid email address
  password: string;       // Strong password (8+ chars, mixed case, number, symbol)
  role: 'explorer' | 'professional' | 'enterprise';
  profile: {
    firstName?: string;
    lastName?: string;
    company?: string;
  };
  acceptedTerms: boolean; // Must be true
  ipAddress?: string;     // Captured server-side
  userAgent?: string;     // Captured server-side
}

// Response Body
interface RegisterResponse {
  status: 'success' | 'error';
  message: string;
  data?: {
    userId: string;
    email: string;
    verificationRequired: boolean;
  };
  errors?: ValidationError[];
}

// Status Codes
// 201: Registration successful
// 400: Validation errors
// 409: Email already exists
// 429: Rate limit exceeded
// 500: Internal server error
```

#### POST /auth/verify-email

```typescript
// Request Body
interface VerifyEmailRequest {
  token: string;          // Email verification token (UUID)
}

// Response Body
interface VerifyEmailResponse {
  status: 'success' | 'already_verified' | 'error';
  message: string;
  data?: {
    userId: string;
    email: string;
  };
}

// Status Codes
// 200: Verification successful
// 400: Invalid or expired token
// 404: Token not found
// 500: Internal server error
```

### 2.2 Authentication Endpoints

#### POST /auth/login

```typescript
// Request Body
interface LoginRequest {
  email: string;
  password: string;
  twoFactorCode?: string; // Required if 2FA enabled
  rememberMe?: boolean;   // Extends refresh token expiry
  deviceInfo?: {
    deviceType: 'desktop' | 'mobile' | 'tablet' | 'api';
    deviceName?: string;
    platform?: string;
    browser?: string;
  };
}

// Response Body
interface LoginResponse {
  status: 'success' | '2fa_required' | 'error';
  message: string;
  data?: {
    accessToken: string;    // JWT access token
    refreshToken: string;   // Refresh token
    expiresIn: number;      // Token expiry in seconds
    user: PublicUserData;
    requiresTwoFactor?: boolean;
  };
  errors?: AuthenticationError[];
}

// Status Codes
// 200: Login successful
// 202: 2FA required
// 401: Invalid credentials
// 403: Account locked/suspended
// 429: Rate limit exceeded
// 500: Internal server error
```

#### POST /auth/refresh

```typescript
// Request Body
interface RefreshTokenRequest {
  refreshToken: string;
}

// Response Body
interface RefreshTokenResponse {
  status: 'success' | 'error';
  message: string;
  data?: {
    accessToken: string;
    expiresIn: number;
    user: PublicUserData;
  };
}

// Status Codes
// 200: Token refreshed
// 401: Invalid refresh token
// 403: Token expired
// 500: Internal server error
```

### 2.3 Two-Factor Authentication Endpoints

#### POST /auth/enable-2fa

```typescript
// Request Body
interface Enable2FARequest {
  password: string;       // Current password verification
}

// Response Body
interface Enable2FAResponse {
  status: 'success' | 'error';
  message: string;
  data?: {
    qrCode: string;       // QR code data URL
    backupCodes: string[]; // One-time display
    setupExpiry: string;  // ISO timestamp
  };
}

// Status Codes
// 200: 2FA setup initiated
// 401: Invalid password
// 400: 2FA already enabled
// 500: Internal server error
```

#### POST /auth/verify-2fa

```typescript
// Request Body
interface Verify2FARequest {
  code: string;           // TOTP code from authenticator
}

// Response Body
interface Verify2FAResponse {
  status: 'success' | 'error';
  message: string;
  data?: {
    enabled: boolean;
    backupCodesRemaining: number;
  };
}

// Status Codes
// 200: 2FA verified and enabled
// 400: Invalid code
// 404: No pending setup
// 500: Internal server error
```

### 2.4 OAuth Endpoints

#### GET /auth/oauth/:provider

```typescript
// URL Parameters
// :provider - 'google' | 'github' | 'linkedin'

// Query Parameters
interface OAuthInitiateQuery {
  redirect_uri: string;   // Client redirect URI
}

// Response (Redirect)
// 302: Redirect to provider authorization URL
// 400: Invalid provider or redirect URI
```

#### GET /auth/oauth/:provider/callback

```typescript
// Query Parameters
interface OAuthCallbackQuery {
  code: string;           // Authorization code from provider
  state: string;          // CSRF protection state
  error?: string;         // Error from provider
}

// Response Body
interface OAuthCallbackResponse {
  status: 'success' | 'error';
  message: string;
  data?: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    user: PublicUserData;
    isNewUser: boolean;
  };
}

// Status Codes
// 200: OAuth authentication successful
// 400: Invalid code or state
// 401: OAuth authentication failed
// 500: Internal server error
```

### 2.5 Password Management Endpoints

#### POST /auth/forgot-password

```typescript
// Request Body
interface ForgotPasswordRequest {
  email: string;
}

// Response Body
interface ForgotPasswordResponse {
  status: 'success' | 'error';
  message: string; // Always success message for security
}

// Status Codes
// 200: Reset email sent (or would be sent)
// 400: Invalid email format
// 429: Rate limit exceeded
// 500: Internal server error
```

#### POST /auth/reset-password

```typescript
// Request Body
interface ResetPasswordRequest {
  token: string;          // Password reset token
  newPassword: string;    // New password meeting requirements
}

// Response Body
interface ResetPasswordResponse {
  status: 'success' | 'error';
  message: string;
  data?: {
    userId: string;
  };
}

// Status Codes
// 200: Password reset successful
// 400: Invalid token or password
// 404: Token not found
// 500: Internal server error
```

## 3. Data Transfer Objects

### 3.1 Public User Data

```typescript
interface PublicUserData {
  id: string;
  email: string;
  emailVerified: boolean;
  role: UserRole;
  profile: {
    firstName?: string;
    lastName?: string;
    displayName?: string;
    avatarUrl?: string;
    company?: string;
  };
  twoFactorEnabled: boolean;
  accountStatus: AccountStatus;
  lastLoginAt?: string;
  createdAt: string;
}
```

### 3.2 Error Response Format

```typescript
interface ErrorResponse {
  status: 'error';
  message: string;
  code: string;           // Error code for client handling
  details?: any;          // Additional error context
  timestamp: string;      // ISO timestamp
  path: string;           // Request path
}

interface ValidationError {
  field: string;
  message: string;
  code: string;
}
```

## 4. Security Considerations Checklist

### 4.1 Authentication Security

- ✅ **Password Hashing**: bcrypt with strength 12
- ✅ **Rate Limiting**: Multiple layers (IP, user, endpoint)
- ✅ **Account Lockout**: Progressive lockout with exponential backoff
- ✅ **Session Management**: Secure JWT + refresh token rotation
- ✅ **2FA Implementation**: TOTP with backup codes
- ✅ **Password Policies**: Strong requirements + history enforcement

### 4.2 Input Validation

- ✅ **Email Validation**: RFC 5322 compliance + format verification
- ✅ **Password Validation**: Complexity requirements + common password checks
- ✅ **SQL Injection Prevention**: Parameterized queries only
- ✅ **XSS Prevention**: Input sanitization + CSP headers
- ✅ **CSRF Protection**: State parameter for OAuth, CSRF tokens for forms

### 4.3 Data Protection

- ✅ **Encryption at Rest**: Sensitive data encrypted in database
- ✅ **Encryption in Transit**: HTTPS only, secure headers
- ✅ **Token Security**: Secure generation + proper expiration
- ✅ **PII Handling**: Minimal data collection + secure storage
- ✅ **Audit Logging**: Comprehensive security event logging

### 4.4 Compliance Requirements

- ✅ **GDPR Compliance**: Data minimization + user consent
- ✅ **CCPA Compliance**: Privacy rights + data deletion
- ✅ **SOC 2 Compliance**: Security controls + audit trails
- ✅ **NIST Guidelines**: Password policy compliance

## 5. Environment Variables

### 5.1 Required Configuration

```bash
# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_ACCESS_TOKEN_EXPIRY=1h
JWT_REFRESH_TOKEN_EXPIRY=30d

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/last_frontier
DATABASE_POOL_SIZE=20

# Email Service Configuration
EMAIL_SERVICE_API_KEY=your_email_service_key
EMAIL_FROM_ADDRESS=noreply@lastfrontier.ai
EMAIL_FROM_NAME=Last Frontier

# OAuth Provider Configuration
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret

# Security Configuration
ENCRYPTION_KEY=your_32_byte_encryption_key
CSRF_SECRET=your_csrf_secret_key
RATE_LIMIT_REDIS_URL=redis://localhost:6379

# Application Configuration
BASE_URL=https://lastfrontier.ai
ENVIRONMENT=production
LOG_LEVEL=info
```

## 6. Implementation Summary

### 6.1 Integration Points

1. **Existing JWT System**: Extend [`src/auth/authService.ts`](../src/auth/authService.ts) with new functions
2. **Database Migrations**: Apply schema updates via migration scripts
3. **Express Routes**: Create new auth router with all endpoints
4. **Middleware**: Rate limiting, authentication, validation middleware
5. **Email Service**: Integration with SendGrid/AWS SES for notifications

### 6.2 Testing Strategy

1. **Unit Tests**: All service modules with TDD anchors
2. **Integration Tests**: API endpoints with database
3. **Security Tests**: Authentication flows, rate limiting, input validation
4. **Load Tests**: Performance under concurrent users
5. **E2E Tests**: Complete user journeys

### 6.3 Deployment Considerations

1. **Database Migrations**: Run schema updates before code deployment
2. **Environment Secrets**: Secure configuration management
3. **Monitoring**: Authentication metrics and alerting
4. **Rollback Plan**: Database migration rollback procedures
5. **Performance**: Database indexing and query optimization

### 6.4 Success Metrics

1. **Security**: Zero critical vulnerabilities in audit
2. **Performance**: <500ms response time for auth operations
3. **Reliability**: 99.9% uptime for authentication services
4. **User Experience**: <2% authentication failure rate
5. **Compliance**: Pass all regulatory audits

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-30  
**Implementation Ready**: ✅ Complete Specification