/**
 * Global type definitions for Last Frontier test environment
 */

import { UserRole } from '../../src/auth/authService';

declare global {
  namespace NodeJS {
    interface Global {
      testUtils: TestUtils;
    }
  }

  // eslint-disable-next-line no-var
  var testUtils: TestUtils;

  interface TestUtils {
    createMockUser(): MockUser;
    createMockJwtPayload(): MockJwtPayload;
    createTestDatabase?(): Promise<void>;
    cleanupTestDatabase?(): Promise<void>;
    createMockIntegrationUser?(): MockUser;
  }

  interface MockUser {
    id: string;
    email: string;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
  }

  interface MockJwtPayload {
    userId: string;
    email: string;
    role: UserRole;
    iat: number;
    exp: number;
  }
}

export {};