/**
 * Global test setup for Last Frontier platform
 * Configures Jest environment, mocks, and test utilities
 */

import { UserRole } from '../src/auth/authService';

// Mock environment variables for testing
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/last_frontier_test';
process.env.REDIS_URL = 'redis://localhost:6379/1';

// Global test timeout
jest.setTimeout(10000);

// Mock external dependencies
jest.mock('bcryptjs', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(),
}));

// Global test utilities
global.testUtils = {
  // Test data factory helpers will be added here
  createMockUser: () => ({
    id: 'test-user-id',
    email: 'test@example.com',
    role: UserRole.EXPLORER,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  
  createMockJwtPayload: () => ({
    userId: 'test-user-id',
    email: 'test@example.com',
    role: UserRole.EXPLORER,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  }),
};

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});