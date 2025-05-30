# Troubleshooting Guide

Comprehensive troubleshooting guide for the Last Frontier platform, covering common issues, diagnostic procedures, and solutions for development, deployment, and production environments.

## Table of Contents

- [Quick Diagnostic Checklist](#quick-diagnostic-checklist)
- [Installation & Setup Issues](#installation--setup-issues)
- [Authentication & Authorization Problems](#authentication--authorization-problems)
- [Database Connection Issues](#database-connection-issues)
- [API & Network Problems](#api--network-problems)
- [Performance Issues](#performance-issues)
- [Security & CORS Issues](#security--cors-issues)
- [Production Deployment Problems](#production-deployment-problems)
- [Monitoring & Logging](#monitoring--logging)
- [Getting Additional Help](#getting-additional-help)

## Quick Diagnostic Checklist

Before diving into specific issues, run through this quick checklist:

### Environment Check
```bash
# Check Node.js version
node --version  # Should be 18.0.0+

# Check npm version
npm --version   # Should be 8.0.0+

# Check environment variables
echo $NODE_ENV
echo $PORT
```

### Service Health Check
```bash
# Check application health
curl http://localhost:3000/health

# Check database connectivity
pg_isready -h localhost -p 5432

# Check if port is available
lsof -i :3000
```

### Log Review
```bash
# Check application logs
npm run dev  # Development logs
pm2 logs     # Production logs (if using PM2)

# Check system logs
tail -f /var/log/syslog  # Linux
tail -f /var/log/system.log  # macOS
```

## Installation & Setup Issues

### Node.js Version Compatibility

**Problem**: Application fails to start with Node.js version errors

**Symptoms**:
```
Error: The engine "node" is incompatible with this module
```

**Solutions**:
1. **Update Node.js**:
```bash
# Using nvm (recommended)
nvm install 18
nvm use 18

# Verify version
node --version
```

2. **Clear npm cache**:
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Dependency Installation Failures

**Problem**: npm install fails with permission or network errors

**Symptoms**:
```
EACCES: permission denied
ENETUNREACH: network is unreachable
```

**Solutions**:
1. **Fix npm permissions**:
```bash
# Set npm prefix
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH

# Or use npx for global packages
npx create-react-app my-app
```

2. **Network issues**:
```bash
# Use different registry
npm config set registry https://registry.npmjs.org/

# Clear npm cache
npm cache clean --force

# Try with verbose logging
npm install --verbose
```

### Environment Configuration Issues

**Problem**: Application fails to load environment variables

**Symptoms**:
```
JWT_SECRET not set in environment
Database connection failed
```

**Solutions**:
1. **Verify .env file**:
```bash
# Check if .env exists
ls -la .env

# Verify content (without exposing secrets)
grep -v "SECRET\|PASSWORD" .env
```

2. **Environment loading**:
```typescript
// Ensure dotenv is loaded early
import dotenv from 'dotenv';
dotenv.config();

// Debug environment loading
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
```

## Authentication & Authorization Problems

### JWT Token Issues

**Problem**: JWT authentication fails

**Symptoms**:
```json
{
  "error": "Invalid or expired token",
  "code": "FORBIDDEN"
}
```

**Diagnostic Steps**:
```bash
# Check JWT secret configuration
echo $JWT_SECRET | wc -c  # Should be 32+ characters

# Decode JWT token (without verification)
node -e "console.log(JSON.stringify(JSON.parse(Buffer.from('TOKEN_PAYLOAD_PART'.split('.')[1], 'base64').toString()), null, 2))"
```

**Solutions**:
1. **Token expiration**:
```typescript
// Check token expiration
const decoded = jwt.decode(token) as any;
const now = Math.floor(Date.now() / 1000);
if (decoded.exp < now) {
  console.log('Token expired');
}
```

2. **Secret mismatch**:
```bash
# Ensure JWT_SECRET is consistent across environments
# Generate new secret if needed
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Password Authentication Failures

**Problem**: Password verification fails

**Symptoms**:
```
Password authentication failed
bcrypt compare returned false
```

**Solutions**:
1. **Check bcrypt version compatibility**:
```bash
npm list bcrypt bcryptjs
# Ensure consistent bcrypt library usage
```

2. **Debug password hashing**:
```typescript
// Test password hashing
const testPassword = 'testpassword';
const hash = await bcrypt.hash(testPassword, 12);
const isValid = await bcrypt.compare(testPassword, hash);
console.log('Hash test:', isValid); // Should be true
```

## Database Connection Issues

### PostgreSQL Connection Failures

**Problem**: Cannot connect to PostgreSQL database

**Symptoms**:
```
ECONNREFUSED 127.0.0.1:5432
password authentication failed for user
```

**Diagnostic Steps**:
```bash
# Check PostgreSQL status
sudo systemctl status postgresql  # Linux
brew services list | grep postgres  # macOS

# Test connection manually
psql -h localhost -U username -d database_name

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-*.log
```

**Solutions**:
1. **Service not running**:
```bash
# Start PostgreSQL
sudo systemctl start postgresql  # Linux
brew services start postgresql   # macOS
```

2. **Authentication issues**:
```sql
-- Connect as postgres user
sudo -u postgres psql

-- Check user exists
\du

-- Reset password
ALTER USER username PASSWORD 'newpassword';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE dbname TO username;
```

3. **Connection configuration**:
```bash
# Check pg_hba.conf
sudo nano /etc/postgresql/13/main/pg_hba.conf

# Ensure local connections are allowed
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5
```

### Database Pool Exhaustion

**Problem**: Connection pool exhausted

**Symptoms**:
```
Error: Connection pool exhausted
TimeoutError: ResourceRequest timed out
```

**Solutions**:
1. **Increase pool size**:
```typescript
const pool = new Pool({
  max: 20,  // Increase from default 10
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
```

2. **Fix connection leaks**:
```typescript
// Always release connections
const client = await pool.connect();
try {
  const result = await client.query('SELECT * FROM users');
  return result;
} finally {
  client.release();  // Critical: always release
}
```

## API & Network Problems

### CORS Issues

**Problem**: Cross-origin requests blocked

**Symptoms**:
```
Access to fetch at 'http://localhost:3000/api' from origin 'http://localhost:3001' 
has been blocked by CORS policy
```

**Solutions**:
1. **Configure CORS properly**:
```typescript
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') 
    : true,  // Allow all origins in development
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

2. **Debug CORS headers**:
```bash
# Check CORS headers
curl -H "Origin: http://localhost:3001" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS \
     http://localhost:3000/api/v1/status
```

### Rate Limiting Issues

**Problem**: Requests being rate limited

**Symptoms**:
```json
{
  "error": "Too many requests from this IP, please try again later.",
  "retryAfter": 900
}
```

**Solutions**:
1. **Check rate limit configuration**:
```typescript
// Adjust rate limits for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
});
```

2. **Reset rate limit**:
```bash
# If using Redis for rate limiting
redis-cli FLUSHDB

# Or restart application to reset memory-based limits
pm2 restart last-frontier
```

### SSL/TLS Certificate Issues

**Problem**: SSL certificate errors in production

**Symptoms**:
```
SSL_ERROR_BAD_CERT_DOMAIN
certificate has expired
```

**Solutions**:
1. **Check certificate status**:
```bash
# Check certificate expiration
openssl x509 -in /path/to/cert.pem -text -noout | grep "Not After"

# Test SSL connection
openssl s_client -connect yourdomain.com:443
```

2. **Renew Let's Encrypt certificate**:
```bash
# Renew certificate
sudo certbot renew

# Test renewal
sudo certbot renew --dry-run
```

## Performance Issues

### High Memory Usage

**Problem**: Application consuming excessive memory

**Symptoms**:
```
FATAL ERROR: Ineffective mark-compacts near heap limit
Process killed (OOM)
```

**Diagnostic Steps**:
```bash
# Monitor memory usage
top -p $(pgrep node)
htop

# Node.js memory usage
node --max-old-space-size=4096 dist/index.js
```

**Solutions**:
1. **Increase heap size**:
```bash
# Set Node.js heap size
export NODE_OPTIONS="--max-old-space-size=4096"
node dist/index.js
```

2. **Fix memory leaks**:
```typescript
// Proper cleanup
process.on('SIGTERM', async () => {
  await pool.end();
  server.close();
  process.exit(0);
});

// Avoid global variables
// Use weak references for caches
```

### Slow Database Queries

**Problem**: Database queries taking too long

**Symptoms**:
```
Query timeout
Slow response times
High CPU usage on database server
```

**Solutions**:
1. **Add database indexes**:
```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Check query execution plan
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'user@example.com';
```

2. **Optimize queries**:
```typescript
// Use specific columns instead of SELECT *
const result = await client.query(
  'SELECT id, email, role FROM users WHERE id = $1',
  [userId]
);

// Use LIMIT for large result sets
const result = await client.query(
  'SELECT * FROM users ORDER BY created_at DESC LIMIT $1',
  [50]
);
```

## Security & CORS Issues

### Security Header Problems

**Problem**: Security headers not being set

**Symptoms**:
```
Missing security headers in response
Content Security Policy violations
```

**Solutions**:
1. **Verify Helmet configuration**:
```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
    },
  },
}));
```

2. **Test security headers**:
```bash
# Check security headers
curl -I https://yourdomain.com

# Use online tools
# https://securityheaders.com/
```

### Authentication Bypass

**Problem**: Authentication middleware not working

**Symptoms**:
```
Unauthorized access to protected routes
req.user is undefined
```

**Solutions**:
1. **Check middleware order**:
```typescript
// Ensure authentication middleware is applied correctly
app.use('/api/v1/profile', authenticateToken, profileHandler);

// Debug middleware execution
app.use((req, res, next) => {
  console.log('Request path:', req.path);
  console.log('User:', req.user);
  next();
});
```

## Production Deployment Problems

### PM2 Process Issues

**Problem**: PM2 processes crashing or not starting

**Symptoms**:
```
Process not found
Application not responding
PM2 shows stopped status
```

**Solutions**:
1. **Check PM2 status**:
```bash
# Check process status
pm2 status

# View logs
pm2 logs last-frontier

# Restart process
pm2 restart last-frontier

# Reload configuration
pm2 reload ecosystem.config.js
```

2. **Fix PM2 configuration**:
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'last-frontier',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

### Load Balancer Issues

**Problem**: Load balancer not distributing traffic properly

**Symptoms**:
```
502 Bad Gateway
Uneven load distribution
Health check failures
```

**Solutions**:
1. **Check nginx configuration**:
```nginx
# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Check nginx logs
sudo tail -f /var/log/nginx/error.log
```

2. **Verify upstream servers**:
```bash
# Check if application servers are responding
curl http://localhost:3000/health
curl http://server2:3000/health
```

## Monitoring & Logging

### Log Analysis

**Problem**: Difficulty diagnosing issues from logs

**Solutions**:
1. **Structured logging**:
```typescript
// Use structured logging format
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'error',
  message: 'Database connection failed',
  error: error.message,
  stack: error.stack
}));
```

2. **Log aggregation**:
```bash
# Use log rotation
sudo nano /etc/logrotate.d/last-frontier

# Centralized logging with journalctl
journalctl -u last-frontier -f
```

### Performance Monitoring

**Problem**: Need to monitor application performance

**Solutions**:
1. **Basic monitoring script**:
```bash
#!/bin/bash
# monitor.sh
while true; do
  echo "$(date): Health check"
  curl -f http://localhost:3000/health || echo "Health check failed"
  sleep 60
done
```

2. **Resource monitoring**:
```bash
# Monitor system resources
iostat -x 1
vmstat 1
netstat -tuln
```

## Getting Additional Help

### Debug Information Collection

When reporting issues, collect this information:

```bash
# System information
uname -a
node --version
npm --version

# Application information
npm list --depth=0
cat package.json | grep version

# Environment information
env | grep -E "(NODE_|PG|JWT_|API_)" | sed 's/=.*/=***/'

# Process information
ps aux | grep node
lsof -i :3000

# Log excerpts (last 50 lines)
tail -50 /var/log/last-frontier/error.log
```

### Support Channels

1. **GitHub Issues**: Create detailed issue reports
2. **Documentation**: Review all documentation files
3. **Community**: Check existing issues and discussions
4. **Support Email**: security@parallaxanalytics.com for security issues

### Issue Report Template

```markdown
## Issue Description
Brief description of the problem

## Environment
- OS: [e.g., Ubuntu 20.04]
- Node.js version: [e.g., 18.17.0]
- Application version: [e.g., 0.1.0]

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Error Messages
```
Paste error messages here
```

## Additional Context
Any other relevant information
```

---

**Remember**: When troubleshooting, always check the basics first (environment variables, service status, network connectivity) before diving into complex debugging procedures.

**Security Note**: Never share actual secrets, passwords, or sensitive data when reporting issues. Use placeholder values or redacted information.