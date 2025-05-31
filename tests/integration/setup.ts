import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file at the project root
// This should be one of the first things to happen.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Integration test setup for Last Frontier platform
 * Configures database connections and test environment for integration tests
 */

import { UserRole } from '../../src/auth/authService';

/**
 * Integration test environment variable setup.
 * If required env vars are missing, set safe test defaults and print a warning.
 */
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'integration-test-jwt-secret-key';
  // eslint-disable-next-line no-console
  console.warn('[integration-setup] JWT_SECRET not set, using test default.');
}
process.env.NODE_ENV = 'test';
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/last_frontier_integration_test';
  // eslint-disable-next-line no-console
  console.warn('[integration-setup] DATABASE_URL not set, using test default.');
}
if (!process.env.REDIS_URL) {
  process.env.REDIS_URL = 'redis://localhost:6379/2';
  // eslint-disable-next-line no-console
  console.warn('[integration-setup] REDIS_URL not set, using test default.');
}

// Ensure all required PostgreSQL env vars are set for integration tests
const requiredPgVars = [
  { key: 'PGHOST', value: 'localhost' },
  { key: 'PGPORT', value: '5432' },
  { key: 'PGUSER', value: 'test' },
  { key: 'PGPASSWORD', value: 'test' },
  { key: 'PGDATABASE', value: 'last_frontier_integration_test' }
];

for (const { key, value } of requiredPgVars) {
  if (!process.env[key]) {
    process.env[key] = value;
    // eslint-disable-next-line no-console
    console.warn(`[integration-setup] ${key} not set, using test default: ${value}`);
  }
}

// Extended timeout for integration tests
jest.setTimeout(30000);

// Mock external services for integration tests
jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

// Integration test utilities
global.testUtils = {
  ...global.testUtils,
  
  createTestDatabase: async () => {
    // Database setup utilities will be implemented here
    return Promise.resolve();
  },
  
  cleanupTestDatabase: async () => {
    // Database cleanup utilities will be implemented here
    return Promise.resolve();
  },
  
  createMockIntegrationUser: () => ({
    id: 'integration-test-user-id',
    email: 'integration@example.com',
    role: UserRole.PROFESSIONAL,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
};

// Setup and teardown for integration tests
beforeAll(async () => {
  // Initialize test database
  if (global.testUtils.createTestDatabase) {
    await global.testUtils.createTestDatabase();
  }
});

afterAll(async () => {
  // Cleanup test database
  if (global.testUtils.cleanupTestDatabase) {
    await global.testUtils.cleanupTestDatabase();
  }
});

beforeEach(async () => {
  // Reset database state before each test
  jest.clearAllMocks();
});