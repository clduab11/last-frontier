/**
 * Unit tests for Last Frontier Authentication Service
 * Tests JWT generation, verification, password hashing, and role-based access control
 * Uses London School TDD approach with mocks and behavior verification
 */

import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import {
  generateJwt,
  verifyJwt,
  hashPassword,
  comparePassword,
  requireRole,
  UserRole,
  LastFrontierJwtPayload,
} from '../../../src/auth/authService';

// Mock external dependencies
jest.mock('jsonwebtoken');
jest.mock('bcryptjs');

const mockJwt = jwt as jest.Mocked<typeof jwt>;
const mockBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set up test environment
    process.env.JWT_SECRET = 'test-secret-key';
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  describe('generateJwt', () => {
    it('should generate a JWT token with valid payload and default expiry', () => {
      // Arrange
      const payload: LastFrontierJwtPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: UserRole.EXPLORER,
      };
      const expectedToken = 'mock-jwt-token';
      (mockJwt.sign as jest.Mock).mockReturnValue(expectedToken);

      // Act
      const result = generateJwt(payload);

      // Assert
      expect(mockJwt.sign).toHaveBeenCalledWith(
        payload,
        'test-secret-key',
        { expiresIn: '1h' }
      );
      expect(result).toBe(expectedToken);
    });

    it('should generate a JWT token with custom expiry time', () => {
      // Arrange
      const payload: LastFrontierJwtPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: UserRole.PROFESSIONAL,
      };
      const customExpiry = '24h';
      const expectedToken = 'mock-jwt-token-24h';
      (mockJwt.sign as jest.Mock).mockReturnValue(expectedToken);

      // Act
      const result = generateJwt(payload, customExpiry);

      // Assert
      expect(mockJwt.sign).toHaveBeenCalledWith(
        payload,
        'test-secret-key',
        { expiresIn: customExpiry }
      );
      expect(result).toBe(expectedToken);
    });

    it('should throw error when JWT_SECRET is not set', () => {
      // Arrange
      delete process.env.JWT_SECRET;
      const payload: LastFrontierJwtPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: UserRole.EXPLORER,
      };

      // Act & Assert
      expect(() => generateJwt(payload)).toThrow('JWT_SECRET not set in environment');
      expect(mockJwt.sign).not.toHaveBeenCalled();
    });
  });

  describe('verifyJwt', () => {
    it('should verify and return valid JWT payload', () => {
      // Arrange
      const token = 'valid-jwt-token';
      const expectedPayload: LastFrontierJwtPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: UserRole.EXPLORER,
        iat: 1234567890,
        exp: 1234571490,
      };
      (mockJwt.verify as jest.Mock).mockReturnValue(expectedPayload);

      // Act
      const result = verifyJwt(token);

      // Assert
      expect(mockJwt.verify).toHaveBeenCalledWith(token, 'test-secret-key');
      expect(result).toEqual(expectedPayload);
    });

    it('should throw error when JWT_SECRET is not set', () => {
      // Arrange
      delete process.env.JWT_SECRET;
      const token = 'some-token';

      // Act & Assert
      expect(() => verifyJwt(token)).toThrow('JWT_SECRET not set in environment');
      expect(mockJwt.verify).not.toHaveBeenCalled();
    });

    it('should propagate JWT verification errors', () => {
      // Arrange
      const token = 'invalid-token';
      const jwtError = new Error('Invalid token');
      (mockJwt.verify as jest.Mock).mockImplementation(() => {
        throw jwtError;
      });

      // Act & Assert
      expect(() => verifyJwt(token)).toThrow('Invalid token');
      expect(mockJwt.verify).toHaveBeenCalledWith(token, 'test-secret-key');
    });
  });

  describe('hashPassword', () => {
    it('should hash password using bcrypt with salt rounds 12', async () => {
      // Arrange
      const password = 'plaintext-password';
      const hashedPassword = 'hashed-password-result';
      (mockBcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      // Act
      const result = await hashPassword(password);

      // Assert
      expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 12);
      expect(result).toBe(hashedPassword);
    });

    it('should propagate bcrypt hashing errors', async () => {
      // Arrange
      const password = 'plaintext-password';
      const bcryptError = new Error('Hashing failed');
      (mockBcrypt.hash as jest.Mock).mockRejectedValue(bcryptError);

      // Act & Assert
      await expect(hashPassword(password)).rejects.toThrow('Hashing failed');
      expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 12);
    });
  });

  describe('comparePassword', () => {
    it('should return true when password matches hash', async () => {
      // Arrange
      const password = 'plaintext-password';
      const hash = 'stored-hash';
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await comparePassword(password, hash);

      // Assert
      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hash);
      expect(result).toBe(true);
    });

    it('should return false when password does not match hash', async () => {
      // Arrange
      const password = 'wrong-password';
      const hash = 'stored-hash';
      (mockBcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Act
      const result = await comparePassword(password, hash);

      // Assert
      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hash);
      expect(result).toBe(false);
    });

    it('should propagate bcrypt comparison errors', async () => {
      // Arrange
      const password = 'plaintext-password';
      const hash = 'stored-hash';
      const bcryptError = new Error('Comparison failed');
      (mockBcrypt.compare as jest.Mock).mockRejectedValue(bcryptError);

      // Act & Assert
      await expect(comparePassword(password, hash)).rejects.toThrow('Comparison failed');
      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hash);
    });
  });

  describe('requireRole middleware', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockRequest = {};
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      mockNext = jest.fn();
    });

    it('should call next() when user has required role', () => {
      // Arrange
      const user: LastFrontierJwtPayload = {
        userId: 'user-123',
        email: 'admin@example.com',
        role: UserRole.ADMIN,
      };
      mockRequest.user = user;
      const middleware = requireRole([UserRole.ADMIN]);

      // Act
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should call next() when user has one of multiple required roles', () => {
      // Arrange
      const user: LastFrontierJwtPayload = {
        userId: 'user-123',
        email: 'pro@example.com',
        role: UserRole.PROFESSIONAL,
      };
      mockRequest.user = user;
      const middleware = requireRole([UserRole.PROFESSIONAL, UserRole.ENTERPRISE]);

      // Act
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockNext).toHaveBeenCalledWith();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should return 403 when user does not have required role', () => {
      // Arrange
      const user: LastFrontierJwtPayload = {
        userId: 'user-123',
        email: 'explorer@example.com',
        role: UserRole.EXPLORER,
      };
      mockRequest.user = user;
      const middleware = requireRole([UserRole.ADMIN]);

      // Act
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Forbidden' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when user is not present in request', () => {
      // Arrange
      mockRequest.user = undefined;
      const middleware = requireRole([UserRole.ADMIN]);

      // Act
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Forbidden' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when user is null', () => {
      // Arrange
      mockRequest.user = null as unknown as LastFrontierJwtPayload;
      const middleware = requireRole([UserRole.PROFESSIONAL]);

      // Act
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Forbidden' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});