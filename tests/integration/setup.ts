/**
 * Integration test setup for Last Frontier platform
 * Configures database connections and test environment for integration tests
 */

import { UserRole } from '../../src/auth/authService';

// Integration test environment variables
process.env.JWT_SECRET = 'integration-test-jwt-secret-key';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/last_frontier_integration_test';
process.env.REDIS_URL = 'redis://localhost:6379/2';

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