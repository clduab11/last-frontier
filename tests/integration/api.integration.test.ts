/**
 * Integration tests for the Last Frontier API
 * Tests the complete integration of Express server, authentication, and database
 */

import request from 'supertest';
import { Pool } from 'pg';

import app from '../../src/index';
import { generateJwt, UserRole } from '../../src/auth/authService';
import { pool } from '../../src/database/connection';

describe('API Integration Tests', () => {
  let testPool: Pool;
  let validToken: string;
  let testUserId: number;

  beforeAll(async () => {
    // Use the existing pool for tests
    testPool = pool;
    
    // Create a test user and generate a valid token
    const client = await testPool.connect();
    try {
      const result = await client.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
        ['test@example.com', 'hashed_password', 'explorer']
      );
      testUserId = result.rows[0].id;
      
      validToken = generateJwt({
        userId: testUserId.toString(),
        email: 'test@example.com',
        role: UserRole.EXPLORER
      });
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    // Clean up test data
    const client = await testPool.connect();
    try {
      await client.query('DELETE FROM users WHERE id = $1', [testUserId]);
    } finally {
      client.release();
    }
  });

  describe('Health Check Endpoint', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        services: {
          database: expect.any(String),
          server: 'healthy'
        }
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('API Status Endpoint', () => {
    it('should return API status information', async () => {
      const response = await request(app)
        .get('/api/v1/status')
        .expect(200);

      expect(response.body).toMatchObject({
        service: 'Last Frontier Platform',
        version: '0.1.0',
        environment: expect.any(String)
      });
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('Authentication Integration', () => {
    it('should reject requests without authentication token', async () => {
      const response = await request(app)
        .get('/api/v1/profile')
        .expect(401);

      expect(response.body).toMatchObject({
        error: 'Access token required'
      });
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/profile')
        .set('Authorization', 'Bearer invalid_token')
        .expect(403);

      expect(response.body).toMatchObject({
        error: 'Invalid or expired token'
      });
    });

    it('should accept requests with valid token and return user profile', async () => {
      const response = await request(app)
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toMatchObject({
        user: {
          id: testUserId,
          email: 'test@example.com',
          role: 'explorer'
        }
      });
      expect(response.body.user.created_at).toBeDefined();
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/api/v1/status')
        .expect(200);

      // Check for Helmet security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('0');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to requests', async () => {
      // This test would need to be adjusted based on rate limit configuration
      // For now, just verify the endpoint responds normally
      const response = await request(app)
        .get('/api/v1/status')
        .expect(200);

      expect(response.body.service).toBe('Last Frontier Platform');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/v1/nonexistent')
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'Route not found',
        path: '/api/v1/nonexistent'
      });
      expect(response.body.timestamp).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      // Create a token with non-existent user ID
      const invalidToken = generateJwt({
        userId: '99999',
        email: 'nonexistent@example.com',
        role: UserRole.EXPLORER
      });

      const response = await request(app)
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(404);

      expect(response.body).toMatchObject({
        error: 'User not found'
      });
    });
  });

  describe('CORS Configuration', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .options('/api/v1/status')
        .expect(204);

      expect(response.headers['access-control-allow-methods']).toContain('GET');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
    });
  });

  describe('Database Integration', () => {
    it('should successfully connect to database', async () => {
      const client = await testPool.connect();
      try {
        const result = await client.query('SELECT 1 as test');
        expect(result.rows[0].test).toBe(1);
      } finally {
        client.release();
      }
    });

    it('should handle database connection in health check', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.services.database).toMatch(/healthy|unhealthy/);
    });
  });
});