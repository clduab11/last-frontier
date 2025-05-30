# Production Deployment Guide

Comprehensive guide for deploying the Last Frontier platform to production environments with security, monitoring, and rollback procedures.

## Table of Contents

- [Pre-Deployment Security Checklist](#pre-deployment-security-checklist)
- [Environment Configuration](#environment-configuration)
- [Database Setup and Migrations](#database-setup-and-migrations)
- [Production Deployment Process](#production-deployment-process)
- [Monitoring and Alerting](#monitoring-and-alerting)
- [Post-Deployment Validation](#post-deployment-validation)
- [Rollback Procedures](#rollback-procedures)
- [Security Hardening](#security-hardening)

## Pre-Deployment Security Checklist

### Critical Security Requirements

**MANDATORY**: All items must be completed before production deployment.

- [ ] **Environment Variables**: All placeholder secrets replaced with production values
- [ ] **JWT Secrets**: 64-character cryptographically secure strings generated
- [ ] **Database Security**: SSL/TLS enabled, strong passwords configured
- [ ] **API Keys**: Production API keys obtained and configured
- [ ] **HTTPS/TLS**: SSL certificates installed and configured
- [ ] **CORS**: Production domains configured in CORS settings
- [ ] **Rate Limiting**: Production rate limits configured
- [ ] **Security Headers**: Helmet.js configured with production settings
- [ ] **Input Validation**: All endpoints validated and sanitized
- [ ] **Error Handling**: No sensitive information leaked in error responses

### Resolved Security Vulnerabilities

The following security measures have been implemented:

#### Authentication & Authorization
- ✅ JWT tokens with HMAC SHA-256 (HS256) algorithm
- ✅ bcrypt password hashing with 12 salt rounds
- ✅ Role-based access control (RBAC) system
- ✅ Token expiration and refresh mechanisms

#### Data Protection
- ✅ SQL injection prevention with parameterized queries
- ✅ Input validation and sanitization
- ✅ XSS protection with security headers
- ✅ CSRF protection implemented

#### Infrastructure Security
- ✅ Security headers via Helmet.js
- ✅ Rate limiting configured
- ✅ CORS properly configured
- ✅ Environment variable security

## Environment Configuration

### Production Environment Setup

#### 1. Copy Production Environment Template

```bash
# Copy the production environment template
cp deployment/production.env .env

# Set secure file permissions
chmod 600 .env
```

#### 2. Replace Placeholder Secrets

**CRITICAL**: Replace ALL placeholder values with actual production secrets.

```bash
# Generate secure JWT secrets (64 characters)
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Generate VCU encryption key (32 bytes, base64 encoded)
VCU_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

# Generate API key salt (32 characters)
API_KEY_SALT=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")

# Generate session secret (32 characters)
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

#### 3. Required Production Values

Update these values in your `.env` file:

| Variable | Description | Example |
|----------|-------------|---------|
| `PGHOST` | Production database host | `your-prod-db.amazonaws.com` |
| `PGPASSWORD` | Strong database password | `[GENERATE_SECURE_PASSWORD]` |
| `PARALLAX_API_KEY` | Production Parallax API key | `[OBTAIN_FROM_PARALLAX]` |
| `CORS_ORIGIN` | Production domain(s) | `https://yourdomain.com` |
| `SMTP_HOST` | Email service host | `smtp.yourmailprovider.com` |
| `SMTP_USER` | Email service username | `[YOUR_SMTP_USERNAME]` |
| `SMTP_PASS` | Email service password | `[YOUR_SMTP_PASSWORD]` |

#### 4. Environment Validation

```bash
# Validate environment configuration
./deployment/deploy.sh validate-env
```

## Database Setup and Migrations

### 1. Database Creation

```sql
-- Connect to PostgreSQL as superuser
CREATE USER lastfrontier_prod WITH PASSWORD '[SECURE_PASSWORD]';
CREATE DATABASE lastfrontier_production OWNER lastfrontier_prod;

-- Grant necessary privileges
GRANT ALL PRIVILEGES ON DATABASE lastfrontier_production TO lastfrontier_prod;
ALTER USER lastfrontier_prod CONNECTION LIMIT 20;
```

### 2. SSL/TLS Configuration

```bash
# Generate SSL certificates for PostgreSQL
openssl req -new -x509 -days 365 -nodes -text \
  -out server.crt -keyout server.key \
  -subj "/CN=your-db-host"

# Set proper permissions
chmod 600 server.key
chown postgres:postgres server.key server.crt
```

### 3. Run Database Migrations

```bash
# Set database environment variables
export PGHOST=your-prod-db-host
export PGUSER=lastfrontier_prod
export PGPASSWORD=your-secure-password
export PGDATABASE=lastfrontier_production

# Run initial schema migration
psql -f src/database/migrations/001_initial_schema.sql

# Run VCU token schema migration
psql -f src/database/migrations/002_vcu_token_schema.sql

# Verify migrations
psql -c "\dt" # List tables to verify schema
```

### 4. Database Backup Setup

```bash
# Create backup directory
sudo mkdir -p /var/backups/postgresql
sudo chown postgres:postgres /var/backups/postgresql

# Setup automated backup cron job
echo "0 2 * * * /usr/local/bin/backup-database.sh" | sudo crontab -u postgres -
```

## Production Deployment Process

### 1. Pre-Deployment Checks

```bash
# Run the deployment script with checks
./deployment/deploy.sh check-prerequisites

# Validate environment
./deployment/deploy.sh validate-environment

# Create backups
./deployment/deploy.sh backup
```

### 2. Automated Deployment

```bash
# Execute full deployment
./deployment/deploy.sh deploy
```

### 3. Manual Deployment Steps

If automated deployment is not available:

```bash
# 1. Stop the service
sudo systemctl stop last-frontier

# 2. Backup current application
tar -czf /var/backups/last-frontier/app_backup_$(date +%Y%m%d_%H%M%S).tar.gz \
  -C /opt/last-frontier --exclude=node_modules .

# 3. Update application code
cd /opt/last-frontier
git pull origin main

# 4. Install dependencies
npm ci --production

# 5. Build application
npm run build

# 6. Run database migrations
npm run migrate:up

# 7. Start service
sudo systemctl start last-frontier

# 8. Verify deployment
curl -f http://localhost:3000/api/v1/health
```

## Monitoring and Alerting

### 1. Health Check Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `/api/v1/health` | Basic health check | `{"status":"healthy"}` |
| `/api/v1/health/detailed` | Detailed system status | Detailed health report |

### 2. Monitoring Configuration

```bash
# Setup monitoring script
cat > /usr/local/bin/monitor-last-frontier.sh << 'EOF'
#!/bin/bash
HEALTH_URL="http://localhost:3000/api/v1/health"
LOG_FILE="/var/log/last-frontier-monitoring.log"

if ! curl -f -s "$HEALTH_URL" > /dev/null; then
    echo "$(date): Health check failed" >> "$LOG_FILE"
    # Send alert (configure your alerting system)
    # systemctl restart last-frontier
fi
EOF

chmod +x /usr/local/bin/monitor-last-frontier.sh

# Setup monitoring cron job
echo "*/5 * * * * /usr/local/bin/monitor-last-frontier.sh" | crontab -
```

### 3. Log Monitoring

```bash
# Setup log rotation
sudo tee /etc/logrotate.d/last-frontier << EOF
/var/log/last-frontier/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 nodejs nodejs
    postrotate
        systemctl reload last-frontier
    endscript
}
EOF
```

### 4. Performance Monitoring

```bash
# Monitor system resources
cat > /usr/local/bin/system-monitor.sh << 'EOF'
#!/bin/bash
# Check CPU usage
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
    echo "High CPU usage: $CPU_USAGE%" | logger -t last-frontier-monitor
fi

# Check memory usage
MEM_USAGE=$(free | grep Mem | awk '{printf "%.2f", $3/$2 * 100.0}')
if (( $(echo "$MEM_USAGE > 80" | bc -l) )); then
    echo "High memory usage: $MEM_USAGE%" | logger -t last-frontier-monitor
fi

# Check disk space
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "High disk usage: $DISK_USAGE%" | logger -t last-frontier-monitor
fi
EOF

chmod +x /usr/local/bin/system-monitor.sh
echo "*/10 * * * * /usr/local/bin/system-monitor.sh" | crontab -
```

## Post-Deployment Validation

### 1. Service Validation

```bash
# Check service status
sudo systemctl status last-frontier

# Verify service is listening
sudo netstat -tlnp | grep :3000

# Check process information
ps aux | grep node
```

### 2. API Endpoint Testing

```bash
# Test health endpoint
curl -f http://localhost:3000/api/v1/health

# Test detailed health endpoint
curl -f http://localhost:3000/api/v1/health/detailed

# Test authentication endpoint
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword"}'
```

### 3. Database Connectivity

```bash
# Test database connection
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -c "SELECT version();"

# Verify tables exist
psql -h $PGHOST -U $PGUSER -d $PGDATABASE -c "\dt"

# Test application database queries
curl -f http://localhost:3000/api/v1/users/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Security Validation

```bash
# Test HTTPS redirect
curl -I http://yourdomain.com

# Verify security headers
curl -I https://yourdomain.com

# Test rate limiting
for i in {1..110}; do curl -s https://yourdomain.com/api/v1/health; done
```

## Rollback Procedures

### 1. Automated Rollback

```bash
# Execute automated rollback
./deployment/deploy.sh rollback
```

### 2. Manual Rollback Process

#### Database Rollback

```bash
# Stop the service
sudo systemctl stop last-frontier

# Restore database from backup
BACKUP_FILE=$(cat /var/backups/last-frontier/latest_backup.txt)
psql $PGDATABASE < "$BACKUP_FILE"
```

#### Application Rollback

```bash
# Restore application from backup
BACKUP_FILE=$(cat /var/backups/last-frontier/latest_app_backup.txt)
cd /opt/last-frontier
tar -xzf "$BACKUP_FILE"

# Restart service
sudo systemctl start last-frontier
```

#### Verification

```bash
# Verify rollback success
curl -f http://localhost:3000/api/v1/health

# Check application logs
sudo journalctl -u last-frontier -f
```

### 3. Emergency Procedures

#### Service Recovery

```bash
# If service fails to start
sudo systemctl status last-frontier
sudo journalctl -u last-frontier --no-pager

# Check configuration
sudo -u nodejs node -c /opt/last-frontier/dist/index.js

# Reset to known good state
git checkout main
npm ci --production
npm run build
sudo systemctl restart last-frontier
```

## Security Hardening

### 1. System Security

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Configure firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Disable unnecessary services
sudo systemctl disable apache2 2>/dev/null || true
sudo systemctl disable nginx 2>/dev/null || true
```

### 2. Application Security

```bash
# Set proper file permissions
sudo chown -R nodejs:nodejs /opt/last-frontier
sudo chmod -R 755 /opt/last-frontier
sudo chmod 600 /opt/last-frontier/.env

# Secure log files
sudo chown -R nodejs:nodejs /var/log/last-frontier
sudo chmod -R 640 /var/log/last-frontier
```

### 3. Database Security

```bash
# Configure PostgreSQL security
sudo -u postgres psql -c "ALTER SYSTEM SET ssl = on;"
sudo -u postgres psql -c "ALTER SYSTEM SET log_connections = on;"
sudo -u postgres psql -c "ALTER SYSTEM SET log_disconnections = on;"
sudo systemctl reload postgresql
```

---

**Production Deployment Checklist**:
- [ ] Security checklist completed
- [ ] Environment variables configured with production values
- [ ] Database setup and migrations completed
- [ ] SSL/TLS certificates installed
- [ ] Monitoring and alerting configured
- [ ] Post-deployment validation passed
- [ ] Rollback procedures tested
- [ ] Security hardening applied

**Emergency Contacts**:
- **Technical Lead**: [Contact Information]
- **Security Team**: security@parallaxanalytics.com
- **Infrastructure Team**: [Contact Information]

**Next Steps**:
- Monitor application performance and logs
- Schedule regular security updates
- Review and update deployment procedures
- Conduct disaster recovery testing