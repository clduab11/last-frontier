# Production Deployment Guide

Comprehensive guide for deploying the Last Frontier platform to production environments, including infrastructure setup, configuration, and monitoring.

## Table of Contents

- [Deployment Overview](#deployment-overview)
- [Infrastructure Requirements](#infrastructure-requirements)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Application Deployment](#application-deployment)
- [SSL/TLS Configuration](#ssltls-configuration)
- [Load Balancing](#load-balancing)
- [Monitoring & Observability](#monitoring--observability)
- [Backup & Recovery](#backup--recovery)
- [Scaling Considerations](#scaling-considerations)

## Deployment Overview

### Deployment Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │────│   Web Server    │────│   Application   │
│   (nginx/ALB)   │    │   (nginx/PM2)   │    │   (Node.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SSL/TLS       │    │   Static Files  │    │   Database      │
│   (Let's Encrypt)│    │   (CDN/S3)      │    │   (PostgreSQL)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Deployment Environments

| Environment | Purpose | Configuration |
|-------------|---------|---------------|
| **Production** | Live system | High availability, monitoring, backups |
| **Staging** | Pre-production testing | Production-like, limited resources |
| **Development** | Development testing | Local or cloud-based |

## Infrastructure Requirements

### Minimum System Requirements

#### Application Server
- **CPU**: 2 vCPUs (4 vCPUs recommended)
- **RAM**: 4GB (8GB recommended)
- **Storage**: 20GB SSD (50GB recommended)
- **OS**: Ubuntu 20.04 LTS or CentOS 8

#### Database Server
- **CPU**: 2 vCPUs (4 vCPUs recommended)
- **RAM**: 8GB (16GB recommended)
- **Storage**: 100GB SSD with backup storage
- **OS**: Ubuntu 20.04 LTS or CentOS 8

#### Load Balancer
- **CPU**: 1 vCPU (2 vCPUs recommended)
- **RAM**: 2GB (4GB recommended)
- **Storage**: 10GB SSD
- **OS**: Ubuntu 20.04 LTS

### Cloud Provider Recommendations

#### AWS
```yaml
# Application Server
Instance Type: t3.medium (2 vCPU, 4GB RAM)
Storage: 50GB gp3 EBS volume
Security Groups: HTTP/HTTPS, SSH

# Database
Service: RDS PostgreSQL 13+
Instance: db.t3.medium
Storage: 100GB gp3 with automated backups

# Load Balancer
Service: Application Load Balancer (ALB)
SSL: AWS Certificate Manager
```

#### Google Cloud Platform
```yaml
# Application Server
Machine Type: e2-medium (2 vCPU, 4GB RAM)
Storage: 50GB SSD persistent disk
Firewall: Allow HTTP/HTTPS

# Database
Service: Cloud SQL PostgreSQL 13+
Machine Type: db-custom-2-8192
Storage: 100GB SSD with automated backups

# Load Balancer
Service: Cloud Load Balancing
SSL: Google-managed certificates
```

## Environment Configuration

### Production Environment Variables

Create a secure `.env` file for production:

```bash
# Application Configuration
NODE_ENV=production
PORT=3000

# JWT Configuration (Use strong, unique secrets)
JWT_SECRET=<64-character-cryptographically-secure-string>
JWT_REFRESH_SECRET=<64-character-cryptographically-secure-string>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Database Configuration
PGHOST=your-production-db-host
PGPORT=5432
PGUSER=your-production-db-user
PGPASSWORD=<strong-database-password>
PGDATABASE=last_frontier_prod
PGSSL=require
PGPOOL_MIN=2
PGPOOL_MAX=20
PG_CONNECTION_TIMEOUT_MS=5000
PG_IDLE_TIMEOUT_MS=10000

# Redis Configuration
REDIS_URL=redis://your-redis-host:6379

# API Configuration
API_KEY_SALT=<32-character-secure-salt>
PARALLAX_API_KEY=<production-parallax-api-key>
PARALLAX_API_URL=https://api.parallaxanalytics.com/vcu-inference

# CORS Configuration
ALLOWED_ORIGINS=https://yourdomain.com,https://api.yourdomain.com

# OAuth Configuration (if applicable)
OAUTH_GOOGLE_CLIENT_ID=<google-oauth-client-id>
OAUTH_GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>
OAUTH_GITHUB_CLIENT_ID=<github-oauth-client-id>
OAUTH_GITHUB_CLIENT_SECRET=<github-oauth-client-secret>
```

### Secret Management

#### Using AWS Secrets Manager
```bash
# Store secrets in AWS Secrets Manager
aws secretsmanager create-secret \
  --name "last-frontier/production/jwt-secret" \
  --secret-string "your-jwt-secret"

# Retrieve in application
export JWT_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "last-frontier/production/jwt-secret" \
  --query SecretString --output text)
```

#### Using Docker Secrets
```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    image: last-frontier:latest
    secrets:
      - jwt_secret
      - db_password
    environment:
      - JWT_SECRET_FILE=/run/secrets/jwt_secret
      - PGPASSWORD_FILE=/run/secrets/db_password

secrets:
  jwt_secret:
    external: true
  db_password:
    external: true
```

## Database Setup

### PostgreSQL Production Configuration

#### Installation (Ubuntu)
```bash
# Install PostgreSQL 13+
sudo apt update
sudo apt install postgresql-13 postgresql-contrib-13

# Configure PostgreSQL
sudo -u postgres psql
```

#### Database Configuration
```sql
-- Create production database and user
CREATE USER last_frontier_prod WITH PASSWORD 'secure_password';
CREATE DATABASE last_frontier_prod OWNER last_frontier_prod;

-- Grant necessary privileges
GRANT ALL PRIVILEGES ON DATABASE last_frontier_prod TO last_frontier_prod;

-- Configure connection limits
ALTER USER last_frontier_prod CONNECTION LIMIT 20;
```

#### PostgreSQL Configuration (`postgresql.conf`)
```ini
# Connection settings
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 1GB
work_mem = 4MB
maintenance_work_mem = 64MB

# Security settings
ssl = on
ssl_cert_file = '/path/to/server.crt'
ssl_key_file = '/path/to/server.key'

# Logging
log_statement = 'mod'
log_min_duration_statement = 1000
log_connections = on
log_disconnections = on
```

#### Run Database Migrations
```bash
# Run production migrations
PGHOST=your-db-host PGUSER=last_frontier_prod \
PGPASSWORD=secure_password PGDATABASE=last_frontier_prod \
psql -f src/database/migrations/001_initial_schema.sql
```

### Database Security

#### SSL/TLS Configuration
```bash
# Generate SSL certificates for PostgreSQL
openssl req -new -x509 -days 365 -nodes -text \
  -out server.crt -keyout server.key \
  -subj "/CN=your-db-host"

# Set proper permissions
chmod 600 server.key
chown postgres:postgres server.key server.crt
```

#### Backup Configuration
```bash
# Automated backup script
#!/bin/bash
BACKUP_DIR="/var/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/last_frontier_prod_$DATE.sql"

pg_dump -h your-db-host -U last_frontier_prod \
  -d last_frontier_prod > $BACKUP_FILE

# Compress and upload to S3
gzip $BACKUP_FILE
aws s3 cp $BACKUP_FILE.gz s3://your-backup-bucket/
```

## Application Deployment

### Using PM2 (Process Manager)

#### Installation
```bash
# Install PM2 globally
npm install -g pm2

# Install application dependencies
npm ci --production
```

#### PM2 Configuration (`ecosystem.config.js`)
```javascript
module.exports = {
  apps: [{
    name: 'last-frontier',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/last-frontier/error.log',
    out_file: '/var/log/last-frontier/out.log',
    log_file: '/var/log/last-frontier/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

#### Deployment Commands
```bash
# Build application
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup
```

### Using Docker

#### Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --production

# Copy application code
COPY dist/ ./dist/
COPY src/database/ ./src/database/

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

#### Docker Compose
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    depends_on:
      - postgres
      - redis
    restart: unless-stopped

  postgres:
    image: postgres:13-alpine
    environment:
      POSTGRES_DB: last_frontier_prod
      POSTGRES_USER: last_frontier_prod
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    secrets:
      - db_password
    restart: unless-stopped

  redis:
    image: redis:6-alpine
    restart: unless-stopped

volumes:
  postgres_data:

secrets:
  db_password:
    external: true
```

## SSL/TLS Configuration

### Using Let's Encrypt with Certbot

#### Installation
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

#### Nginx Configuration
```nginx
server {
    listen 80;
    server_name yourdomain.com api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Certificate Renewal
```bash
# Test renewal
sudo certbot renew --dry-run

# Setup automatic renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

## Load Balancing

### Nginx Load Balancer Configuration

```nginx
upstream last_frontier_backend {
    least_conn;
    server 10.0.1.10:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:3000 max_fails=3 fail_timeout=30s backup;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL configuration (same as above)
    
    location /health {
        proxy_pass http://last_frontier_backend;
        access_log off;
    }

    location / {
        proxy_pass http://last_frontier_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

## Monitoring & Observability

### Health Check Endpoint

The application provides a health check endpoint at `/health`:

```bash
# Monitor application health
curl -f https://api.yourdomain.com/health || exit 1
```

### Application Monitoring

#### PM2 Monitoring
```bash
# Monitor PM2 processes
pm2 monit

# View logs
pm2 logs last-frontier

# Restart application
pm2 restart last-frontier
```

#### Log Management
```bash
# Setup log rotation
sudo nano /etc/logrotate.d/last-frontier

# Log rotation configuration
/var/log/last-frontier/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 nodejs nodejs
    postrotate
        pm2 reloadLogs
    endscript
}
```

### System Monitoring

#### Basic Monitoring Script
```bash
#!/bin/bash
# monitoring.sh

# Check application health
if ! curl -f -s https://api.yourdomain.com/health > /dev/null; then
    echo "Application health check failed"
    # Send alert (email, Slack, etc.)
fi

# Check database connectivity
if ! pg_isready -h your-db-host -p 5432; then
    echo "Database connectivity check failed"
    # Send alert
fi

# Check disk space
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "Disk usage is above 80%: $DISK_USAGE%"
    # Send alert
fi
```

## Backup & Recovery

### Database Backup Strategy

#### Automated Backup Script
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/var/backups/postgresql"
RETENTION_DAYS=30
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup
pg_dump -h $PGHOST -U $PGUSER -d $PGDATABASE | \
gzip > "$BACKUP_DIR/backup_$DATE.sql.gz"

# Upload to cloud storage
aws s3 cp "$BACKUP_DIR/backup_$DATE.sql.gz" \
s3://your-backup-bucket/database/

# Clean old backups
find $BACKUP_DIR -name "backup_*.sql.gz" \
-mtime +$RETENTION_DAYS -delete
```

#### Backup Verification
```bash
# Test backup restoration
gunzip -c backup_20240101_120000.sql.gz | \
psql -h test-db-host -U test_user -d test_database
```

### Application Backup

#### Code and Configuration Backup
```bash
# Backup application code and configuration
tar -czf app_backup_$(date +%Y%m%d).tar.gz \
/opt/last-frontier \
/etc/nginx/sites-available/last-frontier \
/etc/systemd/system/last-frontier.service
```

## Scaling Considerations

### Horizontal Scaling

#### Load Balancer Configuration
- Add more application servers behind load balancer
- Use session-less authentication (JWT)
- Implement health checks for automatic failover

#### Database Scaling
- Read replicas for read-heavy workloads
- Connection pooling (PgBouncer)
- Database partitioning for large datasets

### Vertical Scaling

#### Application Server
- Increase CPU and memory based on load
- Monitor resource utilization
- Optimize Node.js memory settings

#### Database Server
- Scale CPU and memory for query performance
- Increase storage for data growth
- Optimize PostgreSQL configuration

### Performance Optimization

#### Application Level
```javascript
// Enable compression
app.use(compression());

// Optimize database queries
const result = await client.query(
  'SELECT id, email FROM users WHERE id = $1',
  [userId]
);
```

#### Infrastructure Level
- CDN for static assets
- Redis caching for frequently accessed data
- Database query optimization and indexing

---

**Deployment Checklist**:
- [ ] Environment variables configured
- [ ] Database setup and migrated
- [ ] SSL certificates installed
- [ ] Load balancer configured
- [ ] Monitoring setup
- [ ] Backup procedures tested
- [ ] Security hardening completed
- [ ] Performance testing completed

**Next Steps**:
- Review [Security Guide](3_security_guide.md) for security hardening
- Check [Troubleshooting Guide](6_troubleshooting_guide.md) for common deployment issues
- See [Development Guide](5_development_guide.md) for CI/CD setup