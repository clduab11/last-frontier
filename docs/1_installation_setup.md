# Installation & Setup Guide

This guide provides comprehensive instructions for setting up the Last Frontier platform in development and production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Development Setup](#development-setup)
- [Environment Configuration](#environment-configuration)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Verification](#verification)
- [Production Considerations](#production-considerations)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher (comes with Node.js)
- **PostgreSQL**: Version 12 or higher
- **Redis**: Version 6.0 or higher (optional, for caching)
- **Git**: For version control

### Recommended Development Tools

- **VS Code**: With TypeScript and ESLint extensions
- **Postman**: For API testing
- **pgAdmin**: For database management
- **Docker**: For containerized development (optional)

## Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd last-frontier-platform
```

### 2. Install Dependencies

```bash
# Install all dependencies
npm install

# Verify installation
npm list --depth=0
```

### 3. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:

```bash
# Basic Configuration
NODE_ENV=development
PORT=3000

# JWT Configuration (REQUIRED)
JWT_SECRET=your-secure-jwt-secret-min-32-characters
JWT_REFRESH_SECRET=your-secure-refresh-secret-min-32-characters
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Database Configuration (REQUIRED)
PGHOST=localhost
PGPORT=5432
PGUSER=your-database-user
PGPASSWORD=your-secure-password
PGDATABASE=last_frontier_dev
PGPOOL_MIN=1
PGPOOL_MAX=10
PG_CONNECTION_TIMEOUT_MS=5000
PG_IDLE_TIMEOUT_MS=10000

# Redis Configuration (Optional)
REDIS_URL=redis://localhost:6379

# API Configuration
API_KEY_SALT=your-secure-api-salt
PARALLAX_API_KEY=your-parallax-api-key
PARALLAX_API_URL=https://api.parallaxanalytics.com/vcu-inference

# CORS Configuration (Development)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### 4. Generate Secure Secrets

Generate secure secrets for JWT tokens:

```bash
# Generate JWT secrets (32+ characters each)
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('API_KEY_SALT=' + require('crypto').randomBytes(16).toString('hex'))"
```

## Database Setup

### 1. Install PostgreSQL

#### macOS (using Homebrew)
```bash
brew install postgresql
brew services start postgresql
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Windows
Download and install from [PostgreSQL official website](https://www.postgresql.org/download/windows/)

### 2. Create Database and User

```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database user
CREATE USER your_username WITH PASSWORD 'your_secure_password';

# Create database
CREATE DATABASE last_frontier_dev OWNER your_username;

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE last_frontier_dev TO your_username;

# Exit PostgreSQL
\q
```

### 3. Run Database Migrations

```bash
# Run the initial schema migration
psql -h localhost -U your_username -d last_frontier_dev -f src/database/migrations/001_initial_schema.sql

# Optional: Load development seed data
psql -h localhost -U your_username -d last_frontier_dev -f src/database/seeds/dev_seed.sql
```

### 4. Verify Database Connection

```bash
# Test database connection
npm run db:test
```

## Running the Application

### Development Mode

```bash
# Start development server with hot reload
npm run dev

# The server will start on http://localhost:3000
```

### Production Build

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build TypeScript to JavaScript |
| `npm start` | Start production server |
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

## Verification

### 1. Health Check

Test the health endpoint:

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "database": "healthy",
    "server": "healthy"
  }
}
```

### 2. API Status

Test the status endpoint:

```bash
curl http://localhost:3000/api/v1/status
```

Expected response:
```json
{
  "service": "Last Frontier Platform",
  "version": "0.1.0",
  "environment": "development",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 3. Run Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

## Production Considerations

### Environment Variables

For production, ensure these critical variables are set:

```bash
NODE_ENV=production
PORT=3000

# Use strong, unique secrets
JWT_SECRET=<64-character-random-string>
JWT_REFRESH_SECRET=<64-character-random-string>

# Production database
PGHOST=your-production-db-host
PGUSER=your-production-user
PGPASSWORD=<strong-password>
PGDATABASE=last_frontier_prod

# Restrict CORS origins
ALLOWED_ORIGINS=https://yourdomain.com,https://api.yourdomain.com

# Production API keys
PARALLAX_API_KEY=<production-api-key>
```

### Security Checklist

- [ ] All secrets are environment variables (no hardcoded values)
- [ ] JWT secrets are 32+ characters and cryptographically random
- [ ] Database uses strong passwords and restricted access
- [ ] CORS is configured for specific origins only
- [ ] Rate limiting is enabled (100 requests/15min)
- [ ] HTTPS is enforced in production
- [ ] Database connections use SSL/TLS

### Performance Optimization

- [ ] Database connection pooling is configured
- [ ] Redis caching is enabled
- [ ] Proper indexes are in place
- [ ] Log levels are set appropriately
- [ ] Health monitoring is configured

## Troubleshooting

### Common Issues

#### Database Connection Failed

**Error**: `ECONNREFUSED` or `password authentication failed`

**Solutions**:
1. Verify PostgreSQL is running: `sudo systemctl status postgresql`
2. Check database credentials in `.env`
3. Ensure database exists: `psql -l`
4. Verify user permissions

#### Port Already in Use

**Error**: `EADDRINUSE: address already in use :::3000`

**Solutions**:
1. Kill process using port: `lsof -ti:3000 | xargs kill -9`
2. Change PORT in `.env` file
3. Use different port: `PORT=3001 npm run dev`

#### JWT Secret Missing

**Error**: `JWT_SECRET not set in environment`

**Solutions**:
1. Ensure `.env` file exists and is loaded
2. Generate secure JWT secret (see Environment Configuration)
3. Restart the application after updating `.env`

#### TypeScript Compilation Errors

**Error**: Various TypeScript compilation errors

**Solutions**:
1. Clear build cache: `rm -rf dist/`
2. Reinstall dependencies: `rm -rf node_modules && npm install`
3. Check TypeScript version: `npx tsc --version`

### Getting Help

If you encounter issues not covered here:

1. Check the [Troubleshooting Guide](6_troubleshooting_guide.md)
2. Review application logs for detailed error messages
3. Ensure all prerequisites are correctly installed
4. Verify environment configuration matches requirements

### Next Steps

After successful installation:

- Review the [API Reference](2_api_reference.md) for endpoint documentation
- Read the [Security Guide](3_security_guide.md) for security best practices
- Check the [Development Guide](5_development_guide.md) for development workflows

---

**Need help?** Contact support at support@parallaxanalytics.com