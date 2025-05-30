# Development Guide

Comprehensive guide for developers working on the Last Frontier platform, covering local development setup, testing procedures, coding standards, and contribution workflows.

## Table of Contents

- [Development Environment Setup](#development-environment-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Testing Framework](#testing-framework)
- [Development Workflow](#development-workflow)
- [Debugging Procedures](#debugging-procedures)
- [Performance Guidelines](#performance-guidelines)
- [Contributing Guidelines](#contributing-guidelines)

## Development Environment Setup

### Prerequisites

Ensure you have the following installed:

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 8.0.0 or higher
- **Git**: Latest version
- **PostgreSQL**: Version 12 or higher
- **VS Code**: Recommended IDE with extensions

### Recommended VS Code Extensions

```json
{
  "recommendations": [
    "ms-vscode.vscode-typescript-next",
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml"
  ]
}
```

### Local Development Setup

```bash
# Clone the repository
git clone <repository-url>
cd last-frontier-platform

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Setup local database
createdb last_frontier_dev
psql -d last_frontier_dev -f src/database/migrations/001_initial_schema.sql

# Start development server
npm run dev
```

### Environment Configuration for Development

```bash
# .env (development)
NODE_ENV=development
PORT=3000

# JWT Configuration (development keys)
JWT_SECRET=dev-jwt-secret-min-32-characters-long
JWT_REFRESH_SECRET=dev-refresh-secret-min-32-characters
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Database Configuration
PGHOST=localhost
PGPORT=5432
PGUSER=your-username
PGPASSWORD=your-password
PGDATABASE=last_frontier_dev
PGPOOL_MIN=1
PGPOOL_MAX=5

# Development API Keys
API_KEY_SALT=dev-api-salt-16-chars
PARALLAX_API_KEY=dev-parallax-key
PARALLAX_API_URL=https://api.parallaxanalytics.com/vcu-inference

# CORS (allow all origins in development)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

## Project Structure

### Directory Organization

```
last-frontier-platform/
├── src/                    # Source code
│   ├── auth/              # Authentication services
│   ├── database/          # Database connections and migrations
│   ├── types/             # TypeScript type definitions
│   └── index.ts           # Application entry point
├── tests/                 # Test files
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   ├── factories/         # Test data factories
│   └── setup.ts           # Test configuration
├── docs/                  # Documentation
├── coverage/              # Test coverage reports
├── dist/                  # Compiled JavaScript (generated)
└── node_modules/          # Dependencies (generated)
```

### File Naming Conventions

- **TypeScript files**: `camelCase.ts`
- **Test files**: `fileName.test.ts`
- **Type definitions**: `types.ts` or `index.d.ts`
- **Configuration files**: `kebab-case.config.js`
- **Documentation**: `kebab-case.md`

## Coding Standards

### TypeScript Guidelines

#### Type Definitions
```typescript
// Use explicit types for function parameters and return values
export function generateJwt(
  payload: LastFrontierJwtPayload,
  expiresIn: string = '1h'
): string {
  // Implementation
}

// Use interfaces for object structures
export interface LastFrontierJwtPayload extends JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

// Use enums for constants
export enum UserRole {
  EXPLORER = 'explorer',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
  ADMIN = 'admin',
}
```

#### Error Handling
```typescript
// Use proper error handling with try-catch
export async function hashPassword(password: string): Promise<string> {
  try {
    return await bcrypt.hash(password, 12);
  } catch (error) {
    throw new Error(`Password hashing failed: ${error.message}`);
  }
}

// Use custom error types when appropriate
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}
```

### Code Formatting

#### ESLint Configuration
```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

#### Prettier Configuration
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 80,
  "tabWidth": 2
}
```

### Documentation Standards

#### JSDoc Comments
```typescript
/**
 * Generates a signed JWT for a user.
 * @param payload - User info and role
 * @param expiresIn - Expiry string (e.g., '1h')
 * @returns Signed JWT token
 * @throws {Error} When JWT_SECRET is not configured
 */
export function generateJwt(
  payload: LastFrontierJwtPayload,
  expiresIn: string = '1h'
): string {
  // Implementation
}
```

## Testing Framework

### Test Structure

#### Unit Tests
```typescript
// tests/unit/auth/authService.test.ts
import { generateJwt, verifyJwt, UserRole } from '../../../src/auth/authService';

describe('AuthService', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-32-characters-long';
  });

  describe('generateJwt', () => {
    it('should generate a valid JWT token', () => {
      const payload = {
        userId: '123',
        email: 'test@example.com',
        role: UserRole.PROFESSIONAL
      };

      const token = generateJwt(payload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should throw error when JWT_SECRET is not set', () => {
      delete process.env.JWT_SECRET;
      
      expect(() => {
        generateJwt({
          userId: '123',
          email: 'test@example.com',
          role: UserRole.PROFESSIONAL
        });
      }).toThrow('JWT_SECRET not set in environment');
    });
  });
});
```

#### Integration Tests
```typescript
// tests/integration/api.integration.test.ts
import request from 'supertest';
import app from '../../src/index';

describe('API Integration Tests', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('services');
    });
  });

  describe('GET /api/v1/status', () => {
    it('should return service status', async () => {
      const response = await request(app)
        .get('/api/v1/status')
        .expect(200);

      expect(response.body).toHaveProperty('service', 'Last Frontier Platform');
      expect(response.body).toHaveProperty('version');
    });
  });
});
```

### Test Data Factories

```typescript
// tests/factories/userFactory.ts
import { UserRole } from '../../src/auth/authService';

export const createTestUser = (overrides = {}) => ({
  userId: '550e8400-e29b-41d4-a716-446655440000',
  email: 'test@example.com',
  role: UserRole.PROFESSIONAL,
  ...overrides
});

export const createTestJwtPayload = (overrides = {}) => ({
  ...createTestUser(),
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
  ...overrides
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test -- authService.test.ts

# Run integration tests only
npm run test:integration

# Run unit tests only
npm run test:unit
```

## Development Workflow

### Git Workflow

#### Branch Naming Convention
- **Feature branches**: `feature/description-of-feature`
- **Bug fixes**: `fix/description-of-fix`
- **Hotfixes**: `hotfix/description-of-hotfix`
- **Documentation**: `docs/description-of-docs`

#### Commit Message Format
```
type(scope): description

[optional body]

[optional footer]
```

Examples:
```bash
feat(auth): add JWT token refresh functionality
fix(database): resolve connection pool timeout issue
docs(api): update authentication endpoint documentation
test(auth): add unit tests for password hashing
```

#### Development Process

1. **Create Feature Branch**
```bash
git checkout -b feature/jwt-refresh-tokens
```

2. **Make Changes and Test**
```bash
# Make your changes
npm test
npm run lint
npm run format
```

3. **Commit Changes**
```bash
git add .
git commit -m "feat(auth): add JWT refresh token functionality"
```

4. **Push and Create Pull Request**
```bash
git push origin feature/jwt-refresh-tokens
# Create PR through GitHub/GitLab interface
```

### Code Review Guidelines

#### Pull Request Checklist
- [ ] Code follows project coding standards
- [ ] All tests pass
- [ ] Code coverage maintained or improved
- [ ] Documentation updated if needed
- [ ] No hardcoded secrets or credentials
- [ ] Error handling implemented
- [ ] Performance considerations addressed

#### Review Criteria
- **Functionality**: Does the code work as intended?
- **Security**: Are there any security vulnerabilities?
- **Performance**: Will this impact application performance?
- **Maintainability**: Is the code readable and maintainable?
- **Testing**: Are there adequate tests?

## Debugging Procedures

### Local Debugging

#### VS Code Debug Configuration
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Last Frontier",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/index.ts",
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "runtimeArgs": ["-r", "ts-node/register"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "restart": true
    }
  ]
}
```

#### Logging Best Practices
```typescript
// Use structured logging
console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - IP: ${req.ip}`);

// Log errors with context
console.error('Database connection failed:', {
  error: error.message,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  timestamp: new Date().toISOString()
});
```

### Database Debugging

#### Query Debugging
```typescript
// Enable query logging in development
if (process.env.NODE_ENV === 'development') {
  console.log('Executing query:', query, params);
}

const result = await client.query(query, params);
```

#### Connection Pool Monitoring
```typescript
// Monitor connection pool
pool.on('connect', () => {
  console.log('New database connection established');
});

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});
```

## Performance Guidelines

### Database Performance

#### Query Optimization
```typescript
// Use indexes for frequently queried columns
// CREATE INDEX idx_users_email ON users(email);

// Use parameterized queries
const result = await client.query(
  'SELECT id, email FROM users WHERE role = $1 AND created_at > $2',
  [role, startDate]
);

// Limit result sets
const result = await client.query(
  'SELECT * FROM users ORDER BY created_at DESC LIMIT $1',
  [limit]
);
```

#### Connection Pool Configuration
```typescript
const pool = new Pool({
  host: process.env.PGHOST,
  port: parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  min: parseInt(process.env.PGPOOL_MIN || '1'),
  max: parseInt(process.env.PGPOOL_MAX || '10'),
  idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT_MS || '10000'),
  connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT_MS || '5000'),
});
```

### Application Performance

#### Memory Management
```typescript
// Avoid memory leaks with proper cleanup
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await pool.end();
  server.close(() => {
    process.exit(0);
  });
});
```

#### Response Time Optimization
```typescript
// Use compression middleware
import compression from 'compression';
app.use(compression());

// Implement caching for static responses
app.use('/api/v1/status', (req, res, next) => {
  res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
  next();
});
```

## Contributing Guidelines

### Getting Started

1. **Fork the Repository**
2. **Clone Your Fork**
```bash
git clone https://github.com/your-username/last-frontier-platform.git
```

3. **Set Up Development Environment**
```bash
npm install
cp .env.example .env
# Configure your .env file
npm run dev
```

4. **Create Feature Branch**
```bash
git checkout -b feature/your-feature-name
```

### Contribution Process

1. **Make Your Changes**
   - Follow coding standards
   - Add tests for new functionality
   - Update documentation if needed

2. **Test Your Changes**
```bash
npm test
npm run lint
npm run format
```

3. **Commit Your Changes**
```bash
git add .
git commit -m "feat: add your feature description"
```

4. **Push and Create Pull Request**
```bash
git push origin feature/your-feature-name
```

### Code Quality Standards

- **Test Coverage**: Maintain minimum 80% test coverage
- **Linting**: All code must pass ESLint checks
- **Formatting**: Use Prettier for consistent formatting
- **Documentation**: Update relevant documentation
- **Security**: No hardcoded secrets or vulnerabilities

---

**Development Resources**:
- [API Reference](2_api_reference.md) for endpoint documentation
- [Security Guide](3_security_guide.md) for security best practices
- [Troubleshooting Guide](6_troubleshooting_guide.md) for common issues
- [Deployment Guide](4_deployment_guide.md) for production deployment

**Need Help?**
- Create an issue on GitHub
- Contact the development team
- Review existing documentation and tests