# Security Guide

Comprehensive security documentation for the Last Frontier platform, covering authentication, authorization, data protection, and security best practices.

## Table of Contents

- [Security Architecture](#security-architecture)
- [Authentication System](#authentication-system)
- [Authorization & Access Control](#authorization--access-control)
- [Data Protection](#data-protection)
- [Security Headers](#security-headers)
- [Rate Limiting](#rate-limiting)
- [Input Validation](#input-validation)
- [Environment Security](#environment-security)
- [Security Best Practices](#security-best-practices)
- [Incident Response](#incident-response)

## Security Architecture

The Last Frontier platform implements a multi-layered security approach:

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                         │
├─────────────────────────────────────────────────────────────┤
│ 1. Network Security (HTTPS, CORS, Rate Limiting)           │
│ 2. Application Security (Helmet, Input Validation)         │
│ 3. Authentication (JWT, bcrypt)                            │
│ 4. Authorization (RBAC, Role-based Access)                 │
│ 5. Data Security (Encryption, Secure Storage)              │
│ 6. Infrastructure Security (Environment Variables)         │
└─────────────────────────────────────────────────────────────┘
```

### Security Principles

- **Defense in Depth**: Multiple security layers
- **Least Privilege**: Minimal access rights
- **Zero Trust**: Verify everything, trust nothing
- **Secure by Default**: Security-first configuration
- **Fail Securely**: Graceful security failures

## Authentication System

### JWT (JSON Web Tokens)

The platform uses JWT for stateless authentication with the following configuration:

#### Token Structure
```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "userId": "uuid-string",
    "email": "user@example.com",
    "role": "professional",
    "iat": 1640995200,
    "exp": 1641081600
  }
}
```

#### Security Features
- **Algorithm**: HMAC SHA-256 (HS256)
- **Secret Length**: Minimum 32 characters
- **Expiration**: 15 minutes (configurable)
- **Refresh Tokens**: 7 days (configurable)
- **Secure Storage**: Environment variables only

#### Token Validation
```typescript
// Example token validation process
export function verifyJwt(token: string): LastFrontierJwtPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return jwt.verify(token, secret) as LastFrontierJwtPayload;
}
```

### Password Security

#### Hashing Algorithm
- **Algorithm**: bcrypt
- **Salt Rounds**: 12 (configurable)
- **Time Complexity**: ~250ms per hash

#### Password Requirements
- Minimum 8 characters
- Must include uppercase, lowercase, numbers
- Special characters recommended
- No common passwords (dictionary check)

#### Implementation
```typescript
// Password hashing
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

// Password verification
export async function comparePassword(
  password: string, 
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

## Authorization & Access Control

### Role-Based Access Control (RBAC)

#### User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `explorer` | Basic user | Read access, limited API calls |
| `professional` | Professional user | Enhanced features, higher limits |
| `enterprise` | Enterprise user | Full features, high limits |
| `admin` | System administrator | Full system access |

#### Role Hierarchy
```
admin > enterprise > professional > explorer
```

#### Access Control Implementation
```typescript
export function requireRole(roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as LastFrontierJwtPayload;
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
```

### Permission Matrix

| Resource | Explorer | Professional | Enterprise | Admin |
|----------|----------|--------------|------------|-------|
| Profile Access | ✅ | ✅ | ✅ | ✅ |
| Basic API | ✅ | ✅ | ✅ | ✅ |
| Advanced Features | ❌ | ✅ | ✅ | ✅ |
| Analytics | ❌ | ✅ | ✅ | ✅ |
| Admin Panel | ❌ | ❌ | ❌ | ✅ |
| User Management | ❌ | ❌ | ❌ | ✅ |

## Data Protection

### Encryption

#### Data at Rest
- Database encryption using PostgreSQL TDE
- Environment variables encrypted
- Log files encrypted

#### Data in Transit
- HTTPS/TLS 1.3 for all communications
- Certificate pinning for API calls
- Secure WebSocket connections

### Sensitive Data Handling

#### Personal Information
- Email addresses hashed for lookups
- No plain text passwords stored
- PII encrypted in database
- GDPR compliance measures

#### API Keys and Secrets
- Stored in environment variables only
- Rotated regularly (recommended: 90 days)
- Never logged or exposed in responses
- Separate secrets per environment

## Security Headers

### Helmet.js Configuration

The platform uses Helmet.js for security headers:

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

### Security Headers Applied

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `1; mode=block` | XSS protection |
| `Strict-Transport-Security` | `max-age=31536000` | Force HTTPS |
| `Content-Security-Policy` | `default-src 'self'` | Control resource loading |

## Rate Limiting

### Configuration

| Environment | Requests | Window | Purpose |
|-------------|----------|--------|---------|
| Development | 1000 | 15 minutes | Development testing |
| Production | 100 | 15 minutes | Abuse prevention |

### Implementation
```typescript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
```

### Rate Limit Response
```json
{
  "error": "Too many requests from this IP, please try again later.",
  "retryAfter": 900
}
```

## Input Validation

### Request Validation

#### Body Size Limits
- JSON payload: 10MB maximum
- URL-encoded: 10MB maximum
- File uploads: Configured per endpoint

#### Content Type Validation
- Only accept expected content types
- Reject malformed JSON
- Validate file types for uploads

### SQL Injection Prevention

#### Parameterized Queries
```typescript
// SECURE: Using parameterized queries
const result = await client.query(
  'SELECT id, email FROM users WHERE id = $1',
  [userId]
);

// INSECURE: String concatenation (never do this)
// const query = `SELECT * FROM users WHERE id = ${userId}`;
```

#### Input Sanitization
- All user inputs validated
- SQL parameters properly escaped
- NoSQL injection prevention

## Environment Security

### Environment Variables

#### Required Security Variables
```bash
# JWT Configuration
JWT_SECRET=<64-character-random-string>
JWT_REFRESH_SECRET=<64-character-random-string>

# Database Security
PGPASSWORD=<strong-database-password>
PGSSL=require

# API Security
API_KEY_SALT=<32-character-random-string>
```

#### Secret Generation
```bash
# Generate secure secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Production Environment

#### Security Checklist
- [ ] All secrets are environment variables
- [ ] No hardcoded credentials in code
- [ ] Database uses SSL/TLS connections
- [ ] HTTPS enforced for all endpoints
- [ ] CORS configured for specific origins
- [ ] Rate limiting enabled
- [ ] Security headers configured
- [ ] Log levels set appropriately
- [ ] Error messages don't leak information

## Security Best Practices

### Development Security

#### Code Security
- Regular dependency updates
- Security linting with ESLint
- Static code analysis
- Dependency vulnerability scanning

#### Git Security
- No secrets in version control
- Signed commits (recommended)
- Branch protection rules
- Code review requirements

### Deployment Security

#### Infrastructure
- Secure container images
- Network segmentation
- Firewall configuration
- Regular security updates

#### Monitoring
- Security event logging
- Anomaly detection
- Failed authentication monitoring
- Rate limit violation tracking

### Operational Security

#### Access Management
- Principle of least privilege
- Regular access reviews
- Multi-factor authentication
- Secure key management

#### Incident Response
- Security incident procedures
- Breach notification process
- Recovery procedures
- Post-incident analysis

## Incident Response

### Security Incident Types

#### Authentication Incidents
- Brute force attacks
- Credential stuffing
- Token theft/misuse
- Unauthorized access attempts

#### Application Incidents
- SQL injection attempts
- XSS attacks
- CSRF attacks
- API abuse

### Response Procedures

#### Immediate Response (0-1 hour)
1. **Identify** the incident type and scope
2. **Contain** the threat (rate limiting, IP blocking)
3. **Assess** the impact and affected systems
4. **Notify** relevant stakeholders

#### Short-term Response (1-24 hours)
1. **Investigate** the root cause
2. **Implement** additional security measures
3. **Document** the incident details
4. **Communicate** with affected users (if required)

#### Long-term Response (1-7 days)
1. **Remediate** vulnerabilities
2. **Update** security procedures
3. **Conduct** post-incident review
4. **Implement** preventive measures

### Contact Information

#### Security Team
- **Email**: security@parallaxanalytics.com
- **Emergency**: [Emergency contact procedure]
- **PGP Key**: [Public key for encrypted communications]

### Reporting Security Issues

#### Responsible Disclosure
1. Email security@parallaxanalytics.com
2. Include detailed description
3. Provide reproduction steps
4. Allow reasonable time for response
5. Do not publicly disclose until resolved

---

**Security is everyone's responsibility. When in doubt, choose the more secure option.**

**Next Steps**:
- Review [API Reference](2_api_reference.md) for authentication examples
- Check [Deployment Guide](4_deployment_guide.md) for production security
- See [Troubleshooting Guide](6_troubleshooting_guide.md) for security issues