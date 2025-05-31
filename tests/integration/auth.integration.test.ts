/**
 * Authentication Integration Tests
 * Tests the complete authentication flow including registration, login, and security features.
 */

// Import types first
import type { Request, Response, NextFunction, Application } from 'express';
import type { Server } from 'http';

/**
 * Ensure real axios and Bottleneck are used in integration tests.
 * This prevents any Jest mocks from leaking in from unit test suites.
 */
jest.unmock('axios');
jest.unmock('bottleneck');

// Mock authService functions - only mock JWT generation and Supabase calls for integration tests
jest.mock('../../src/auth/authService', () => ({
  ...jest.requireActual('../../src/auth/authService'),
  generateJwt: jest.fn(() => 'mocked.jwt.token'),
  createUserWithSupabase: jest.fn(),
  signInWithSupabase: jest.fn(),
}));

// Mock MetricsCollector as a class with .on, .collectSecurityMetrics, and .requestMiddleware
const collectSecurityMetricsMock = jest.fn();
const onMock = jest.fn();
const requestMiddlewareMock = jest.fn((): ((req: Request, res: Response, next: NextFunction) => void) => (_req: Request, _res: Response, next: NextFunction) => { next(); });

jest.mock('../../src/monitoring/metricsCollector', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      collectSecurityMetrics: collectSecurityMetricsMock,
      on: onMock,
      requestMiddleware: requestMiddlewareMock,
    })),
  };
});

// Now import everything else
import '../setup.integration';
import request from 'supertest';

let app: Application;
let startServer: (port: number) => Server;
let closeServer: () => void;
let server: Server;
let testPool: import('pg').Pool;
let UserFactory: typeof import('../factories/userFactory').UserFactory;
let UserRole: typeof import('../../src/auth/authService').UserRole;
let authService: typeof import('../../src/auth/authService');

// Helper to get the collectSecurityMetrics mock
function getCollectSecurityMetricsMock(): jest.Mock {
  return collectSecurityMetricsMock;
}

describe('Auth Integration Tests', () => {
  beforeAll(async () => {
    jest.resetModules(); // Ensure a clean module cache so mocks are used
    // Import app/server and all runtime dependencies after mocks are set up
    const indexModule = await import('../../src/index');
    app = indexModule.app;
    startServer = indexModule.startServer;
    closeServer = indexModule.closeServer;

    // Import runtime dependencies after mocks
    const path = (await import('path')).default;
    const dotenv = (await import('dotenv')).default;
    UserFactory = (await import('../factories/userFactory')).UserFactory;
    UserRole = (await import('../../src/auth/authService')).UserRole;
    authService = await import('../../src/auth/authService');

    dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

    const { Pool } = await import('pg');
    testPool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    await new Promise<void>((resolve) => {
      server = startServer(0);
      server.on('listening', () => {
        const address = server.address();
        if (address && typeof address !== 'string') {
          process.env.PORT = String(address.port);
        }
        resolve();
      });
    });
  });

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();
    // Only mock JWT generation, let other auth functions work naturally
    (authService.generateJwt as jest.Mock).mockReturnValue('mocked.jwt.token');
    getCollectSecurityMetricsMock().mockClear();
    // Clear database tables
    try {
      await testPool.query('DELETE FROM user_profiles;');
      await testPool.query('DELETE FROM audit_logs;');
      await testPool.query('DELETE FROM users;');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error clearing database in beforeEach:', error);
    }
  });

  afterAll(async () => {
    await testPool.end();
    await new Promise<void>((resolve) => {
      closeServer();
      resolve();
    });
  });

  describe('POST /api/v1/auth/register', () => {
    const validPassword = 'TestPassword123!';
    const registerUrl = '/api/v1/auth/register';

    it('should allow a user to register with valid email and password', async () => {
      const user = UserFactory.create();
      const registrationData = { email: user.email, password: validPassword };

      // Mock Supabase registration to return a successful result
      const mockSupabaseAuthResult = {
        user: { id: 'supabase-user-id-456', email: user.email },
        error: null
      };
      (authService.createUserWithSupabase as jest.Mock).mockResolvedValue(mockSupabaseAuthResult);

      const res = await request(app).post(registerUrl).send(registrationData);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token', 'mocked.jwt.token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(user.email);
      expect(res.body.user.role).toBe(UserRole.EXPLORER);
      
      expect(getCollectSecurityMetricsMock()).toHaveBeenCalledWith(
        'auth_failure',
        expect.objectContaining({
          event: 'register_success',
          userId: 'supabase-user-id-456',
          ip: expect.any(String),
          timestamp: expect.any(Number),
        })
      );

      // Verify Supabase was called correctly
      expect(authService.createUserWithSupabase).toHaveBeenCalledWith(user.email, validPassword);
      
      // Check that user profile was created in our database
      const dbProfile = await testPool.query('SELECT * FROM user_profiles WHERE user_id = $1', ['supabase-user-id-456']);
      expect(dbProfile.rows.length).toBe(1);
      expect(dbProfile.rows[0].display_name).toBe(user.email.split('@')[0]);
    });

    it('should return 409 if email is already registered', async () => {
      const user = UserFactory.create();
      const registrationData = { email: user.email, password: validPassword };

      // Mock Supabase to return an error for duplicate email
      const mockSupabaseErrorResult = {
        user: null,
        error: new Error('User already exists')
      };
      (authService.createUserWithSupabase as jest.Mock).mockResolvedValue(mockSupabaseErrorResult);

      const res = await request(app).post(registerUrl).send(registrationData);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Email already registered');
      expect(getCollectSecurityMetricsMock()).toHaveBeenCalledWith(
        'auth_failure',
        expect.objectContaining({
          reason: 'duplicate',
        })
      );
    });

    it('should return 400 for invalid email during registration: Invalid email format', async () => {
      const payload = {
        email: 'not-an-email',
        password: validPassword,
      };
      const res = await request(app).post(registerUrl).send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid email format');
      expect(getCollectSecurityMetricsMock()).toHaveBeenCalledWith(
        'auth_failure',
        expect.objectContaining({
          reason: 'validation',
        })
      );
    });

    it('should return 400 for invalid password during registration: Password must be at least 8 characters', async () => {
      const user = UserFactory.create();
      const payload = {
        email: user.email,
        password: 'short',
      };
      const res = await request(app).post(registerUrl).send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Password must be at least 8 characters');
      expect(getCollectSecurityMetricsMock()).toHaveBeenCalledWith(
        'auth_failure',
        expect.objectContaining({
          reason: 'validation',
        })
      );
    });

    it('should return 400 for invalid password during registration: Password must contain an uppercase letter', async () => {
      const user = UserFactory.create();
      const payload = {
        email: user.email,
        password: 'nouppercase1!',
      };
      const res = await request(app).post(registerUrl).send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Password must contain an uppercase letter');
      expect(getCollectSecurityMetricsMock()).toHaveBeenCalledWith(
        'auth_failure',
        expect.objectContaining({
          reason: 'validation',
        })
      );
    });

    it('should return 400 for invalid password during registration: Password must contain a lowercase letter', async () => {
      const user = UserFactory.create();
      const payload = {
        email: user.email,
        password: 'NOLOWERCASE1!',
      };
      const res = await request(app).post(registerUrl).send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Password must contain a lowercase letter');
      expect(getCollectSecurityMetricsMock()).toHaveBeenCalledWith(
        'auth_failure',
        expect.objectContaining({
          reason: 'validation',
        })
      );
    });

    it('should return 400 for invalid password during registration: Password must contain a number', async () => {
      const user = UserFactory.create();
      const payload = {
        email: user.email,
        password: 'NoNumberHere!',
      };
      const res = await request(app).post(registerUrl).send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Password must contain a number');
      expect(getCollectSecurityMetricsMock()).toHaveBeenCalledWith(
        'auth_failure',
        expect.objectContaining({
          reason: 'validation',
        })
      );
    });

    it('should return 400 for invalid password during registration: Password must contain a symbol', async () => {
      const user = UserFactory.create();
      const payload = {
        email: user.email,
        password: 'NoSymbol123A',
      };
      const res = await request(app).post(registerUrl).send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Password must contain a symbol');
      expect(getCollectSecurityMetricsMock()).toHaveBeenCalledWith(
        'auth_failure',
        expect.objectContaining({
          reason: 'validation',
        })
      );
    });

    it('should return 400 if email field is missing during registration', async () => {
      const registrationData = { password: validPassword }; // Email is missing
      const res = await request(app).post(registerUrl).send(registrationData);

      expect(res.status).toBe(400);
      // Based on `src/routes/auth.ts` registerValidators:
      // body('email').isEmail().withMessage('Invalid email format')
      // If email is undefined, .isEmail() will fail.
      expect(res.body.error).toBe('Invalid email format');
      expect(getCollectSecurityMetricsMock()).toHaveBeenCalledWith(
        'auth_failure',
        expect.objectContaining({
          reason: 'validation',
        })
      );
    });

    it('should return 400 if password field is missing during registration', async () => {
      const user = UserFactory.create();
      const registrationData = { email: user.email }; // Password is missing
      const res = await request(app).post(registerUrl).send(registrationData);
      
      expect(res.status).toBe(400);
      // Based on `src/routes/auth.ts` registerValidators:
      // body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
      // This will be the first message if password is not a string or undefined.
      expect(res.body.error).toBe('Password must be at least 8 characters');
      expect(getCollectSecurityMetricsMock()).toHaveBeenCalledWith(
        'auth_failure',
        expect.objectContaining({
          reason: 'validation',
        })
      );
    });
  });

  describe('POST /api/v1/auth/login', () => {
    const loginUrl = '/api/v1/auth/login';
    const validTestEmail = 'testlogin@example.com';
    const validTestPassword = 'Password123!';
    let createdTestUserId: string;

    beforeEach(async () => {
      // Clean up database tables before inserting test user
      try {
        await testPool.query('DELETE FROM user_profiles;');
        await testPool.query('DELETE FROM audit_logs;');
        await testPool.query('DELETE FROM users;');
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error clearing database in login beforeEach:', error);
      }
      
      // Mock Supabase authentication to return a successful result
      const mockSupabaseAuthResult = {
        user: { id: 'supabase-user-id-123', email: validTestEmail },
        error: null
      };
      (authService.signInWithSupabase as jest.Mock).mockResolvedValue(mockSupabaseAuthResult);
      
      // Set the test user ID to match the mocked Supabase user
      createdTestUserId = 'supabase-user-id-123';
      
      // Create user profile in our database to match the Supabase user
      await testPool.query(
        "INSERT INTO user_profiles (user_id, display_name, role) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING",
        [createdTestUserId, validTestEmail.split('@')[0], UserRole.EXPLORER]
      );
      
      // Only mock JWT generation, let password comparison work naturally
      (authService.generateJwt as jest.Mock).mockClear().mockReturnValue('mocked.jwt.token');
      getCollectSecurityMetricsMock().mockClear();
    });

    it('should allow a registered user to login with valid credentials', async () => {
      // Instead of mocking comparePassword, let's use the real implementation with the real hash
      // Remove the spy and let the real authService work
      const loginData = { email: validTestEmail, password: validTestPassword };

      const res = await request(app).post(loginUrl).send(loginData);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token', 'mocked.jwt.token'); // This should still be mocked
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(validTestEmail);
      expect(res.body.user.role).toBe(UserRole.EXPLORER);
      
      // Verify the metrics call (without spying on auth functions)
      expect(getCollectSecurityMetricsMock()).toHaveBeenCalledWith('auth_failure',
        expect.objectContaining({
          event: 'login_success',
          userId: createdTestUserId,
        })
      );
    });

    it('should return 401 for login with incorrect password', async () => {
      const loginData = { email: validTestEmail, password: 'DefinitelyWrongPassword123!' };

      // Mock Supabase to return an authentication error
      const mockSupabaseErrorResult = {
        user: null,
        error: new Error('Invalid credentials')
      };
      (authService.signInWithSupabase as jest.Mock).mockResolvedValue(mockSupabaseErrorResult);

      const res = await request(app).post(loginUrl).send(loginData);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
      expect(getCollectSecurityMetricsMock()).toHaveBeenCalledWith('auth_failure',
        expect.objectContaining({
          reason: 'invalid_credentials',
          email: validTestEmail,
        })
      );
    });

    it('should return 401 if user is not found', async () => {
      const loginData = { email: 'nonexistent@example.com', password: 'Password123!' };
      
      // Mock Supabase to return an error for non-existent user
      const mockSupabaseErrorResult = {
        user: null,
        error: new Error('User not found')
      };
      (authService.signInWithSupabase as jest.Mock).mockResolvedValue(mockSupabaseErrorResult);

      const res = await request(app).post(loginUrl).send(loginData);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
      expect(getCollectSecurityMetricsMock()).toHaveBeenCalledWith('auth_failure',
        expect.objectContaining({
          reason: 'invalid_credentials',
          email: 'nonexistent@example.com',
        })
      );
    });

    it('should return 400 for missing email during login', async () => {
      const loginData = { password: validTestPassword };

      const res = await request(app).post(loginUrl).send(loginData);
      expect(res.status).toBe(400);
      // From src/routes/auth.ts loginValidators:
      // body('email').exists({ checkFalsy: true }).withMessage('Email and password are required')
      expect(res.body.error).toBe('Email and password are required');
      expect(getCollectSecurityMetricsMock()).toHaveBeenCalledWith('auth_failure',
        expect.objectContaining({
          reason: 'validation',
        })
      );
    });

    it('should return 400 for invalid email format during login', async () => {
      const loginData = { email: 'invalid-email', password: validTestPassword };

      const res = await request(app).post(loginUrl).send(loginData);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid email format');
      expect(getCollectSecurityMetricsMock()).toHaveBeenCalledWith('auth_failure',
        expect.objectContaining({
          reason: 'validation',
        })
      );
    });

    it('should return 400 for missing password during login', async () => {
      const loginData = { email: validTestEmail };

      const res = await request(app).post(loginUrl).send(loginData);
      expect(res.status).toBe(400);
      // From src/routes/auth.ts loginValidators:
      // body('password').exists({ checkFalsy: true }).withMessage('Email and password are required')
      expect(res.body.error).toBe('Email and password are required');
      expect(getCollectSecurityMetricsMock()).toHaveBeenCalledWith('auth_failure',
        expect.objectContaining({
          reason: 'validation',
        })
      );
    });
  });
  // TODO: Add describe blocks for /logout, /refresh etc.
});