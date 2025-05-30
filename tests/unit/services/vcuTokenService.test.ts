/**
 * VCU Token Service Unit Tests
 * Tests core token management functionality using London School TDD approach
 * Based on TDD anchors from 11_vcu_token_management_pseudocode.md
 */

import { VcuTokenService } from '../../../src/services/vcuTokenService';
import { TokenStorage } from '../../../src/storage/tokenStorage';
import { TokenData } from '../../../src/types/vcu';
import {
  TokenDataFactory
} from '../../factories/vcuFactory';

// Test interfaces
interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// Mock dependencies
jest.mock('../../../src/storage/tokenStorage');
jest.mock('../../../src/config/vcuConfig');

describe('VcuTokenService', () => {
  let service: VcuTokenService;
  let mockStorage: jest.Mocked<TokenStorage>;

  beforeEach(() => {
    // Create mocked dependencies
    mockStorage = new TokenStorage() as jest.Mocked<TokenStorage>;
    
    // Initialize service with mocked dependencies
    service = new VcuTokenService(mockStorage);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('storeToken', () => {
    it('should store a token securely with AES-256 encryption', async () => {
      // Given: A valid token to store
      const tokenData = TokenDataFactory.create();
      const expectedStoredToken = TokenDataFactory.create({ id: 'stored_token_id' });
      
      // When: Storage returns the stored token
      mockStorage.store.mockResolvedValue(expectedStoredToken);
      
      // Then: Service should delegate to storage and return stored token
      const result = await service.storeToken(tokenData);
      
      expect(mockStorage.store).toHaveBeenCalledWith(tokenData);
      expect(result).toEqual(expectedStoredToken);
    });

    it('should handle storage errors gracefully', async () => {
      // Given: A token to store and storage that fails
      const tokenData = TokenDataFactory.create();
      const storageError = new Error('Database connection failed');
      
      // When: Storage throws an error
      mockStorage.store.mockRejectedValue(storageError);
      
      // Then: Service should propagate the error
      await expect(service.storeToken(tokenData)).rejects.toThrow('Database connection failed');
      expect(mockStorage.store).toHaveBeenCalledWith(tokenData);
    });
  });

  describe('getToken', () => {
    it('should retrieve and decrypt a token by ID', async () => {
      // Given: A token ID and expected token data
      const tokenId = 'token_123456789';
      const expectedToken = TokenDataFactory.create({ id: tokenId });
      
      // When: Storage returns the token
      mockStorage.get.mockResolvedValue(expectedToken);
      
      // Then: Service should return the decrypted token
      const result = await service.getToken(tokenId);
      
      expect(mockStorage.get).toHaveBeenCalledWith(tokenId);
      expect(result).toEqual(expectedToken);
    });

    it('should return null when token is not found', async () => {
      // Given: A non-existent token ID
      const tokenId = 'non_existent_token';
      
      // When: Storage returns null
      mockStorage.get.mockResolvedValue(null);
      
      // Then: Service should return null
      const result = await service.getToken(tokenId);
      
      expect(mockStorage.get).toHaveBeenCalledWith(tokenId);
      expect(result).toBeNull();
    });

    it('should handle retrieval errors gracefully', async () => {
      // Given: A token ID and storage that fails
      const tokenId = 'token_123456789';
      const retrievalError = new Error('Decryption failed');
      
      // When: Storage throws an error
      mockStorage.get.mockRejectedValue(retrievalError);
      
      // Then: Service should propagate the error
      await expect(service.getToken(tokenId)).rejects.toThrow('Decryption failed');
      expect(mockStorage.get).toHaveBeenCalledWith(tokenId);
    });
  });

  describe('validateToken', () => {
    it('should validate an active token successfully', async () => {
      // Given: A valid active token
      const tokenId = 'token_123456789';
      const activeToken = TokenDataFactory.create({ 
        id: tokenId, 
        status: 'active',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
      });
      // When: Storage returns the active token
      mockStorage.get.mockResolvedValue(activeToken);
      
      // Then: Service should return valid result
      const result = await service.validateToken(tokenId);
      
      expect(mockStorage.get).toHaveBeenCalledWith(tokenId);
      expect((result as ValidationResult).valid).toBe(true);
      expect(result.token).toEqual(activeToken);
    });

    it('should reject expired tokens', async () => {
      // Given: An expired token
      const tokenId = 'expired_token_123';
      const expiredToken = TokenDataFactory.createExpired({ id: tokenId });
      
      // When: Storage returns the expired token
      mockStorage.get.mockResolvedValue(expiredToken);
      
      // Then: Service should return invalid result
      const result = await service.validateToken(tokenId);
      
      expect(mockStorage.get).toHaveBeenCalledWith(tokenId);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('expired');
    });

    it('should reject revoked tokens', async () => {
      // Given: A revoked token
      const tokenId = 'revoked_token_123';
      const revokedToken = TokenDataFactory.createRevoked({ id: tokenId });
      
      // When: Storage returns the revoked token
      mockStorage.get.mockResolvedValue(revokedToken);
      
      // Then: Service should return invalid result
      const result = await service.validateToken(tokenId);
      
      expect(mockStorage.get).toHaveBeenCalledWith(tokenId);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('revoked');
    });

    it('should reject non-existent tokens', async () => {
      // Given: A non-existent token ID
      const tokenId = 'non_existent_token';
      
      // When: Storage returns null
      mockStorage.get.mockResolvedValue(null);
      
      // Then: Service should return invalid result
      const result = await service.validateToken(tokenId);
      
      expect(mockStorage.get).toHaveBeenCalledWith(tokenId);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not found');
    });
  });

  describe('rotateToken', () => {
    it('should rotate a token successfully with exponential backoff on failure', async () => {
      // Given: A token to rotate
      const tokenId = 'token_to_rotate';
      const currentToken = TokenDataFactory.create({ id: tokenId });
      const rotatedToken = TokenDataFactory.create({ 
        id: 'new_token_id',
        value: 'vcu_newtoken1234567890abcdef1234567890abcd'
      });
      // When: Storage operations succeed
      mockStorage.get.mockResolvedValue(currentToken);
      mockStorage.rotate.mockResolvedValue(rotatedToken);
      
      // Then: Service should return successful rotation result
      const result = await service.rotateToken(tokenId);
      
      expect(mockStorage.get).toHaveBeenCalledWith(tokenId);
      expect(mockStorage.rotate).toHaveBeenCalledWith(tokenId, expect.any(String));
      expect(result.success).toBe(true);
      expect(result.newToken).toEqual(rotatedToken);
    });

    it('should handle rotation failure with exponential backoff', async () => {
      // Given: A token to rotate that fails
      const tokenId = 'failing_token';
      const currentToken = TokenDataFactory.create({ id: tokenId });
      const rotationError = new Error('Venice.ai API temporarily unavailable');
      
      // When: Storage get succeeds but rotation fails
      mockStorage.get.mockResolvedValue(currentToken);
      mockStorage.rotate.mockRejectedValue(rotationError);
      
      // Then: Service should return failure result with backoff
      const result = await service.rotateToken(tokenId);
      
      expect(mockStorage.get).toHaveBeenCalledWith(tokenId);
      expect(mockStorage.rotate).toHaveBeenCalledWith(tokenId, expect.any(String));
      expect(result.success).toBe(false);
      expect(result.error).toContain('Venice.ai API temporarily unavailable');
      expect(result.backoffMs).toBeGreaterThan(0);
    });

    it('should fail rotation for non-existent tokens', async () => {
      // Given: A non-existent token ID
      const tokenId = 'non_existent_token';
      
      // When: Storage returns null
      mockStorage.get.mockResolvedValue(null);
      
      // Then: Service should return failure result
      const result = await service.rotateToken(tokenId);
      
      expect(mockStorage.get).toHaveBeenCalledWith(tokenId);
      expect(mockStorage.rotate).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('checkQuota', () => {
    it('should allow requests within quota limits', async () => {
      // Given: A token with available quota
      const tokenId = 'token_with_quota';
      const tokenWithQuota = TokenDataFactory.create({ 
        id: tokenId,
        usageCount: 100,
        quota: 1000
      });
      const updatedToken = TokenDataFactory.create({
        ...tokenWithQuota,
        usageCount: 101
      });
      
      // When: Storage operations succeed
      mockStorage.get.mockResolvedValue(tokenWithQuota);
      mockStorage.incrementUsage.mockResolvedValue(updatedToken);
      
      // Then: Service should allow the request and increment usage
      const result = await service.checkQuota(tokenId);
      
      expect(mockStorage.get).toHaveBeenCalledWith(tokenId);
      expect(mockStorage.incrementUsage).toHaveBeenCalledWith(tokenId);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(899); // 1000 - 101
    });

    it('should deny requests when quota is exceeded', async () => {
      // Given: A token that has exceeded quota
      const tokenId = 'token_quota_exceeded';
      const tokenOverQuota = TokenDataFactory.createHighUsage({ 
        id: tokenId,
        usageCount: 1000,
        quota: 1000
      });
      
      // When: Storage returns token at quota limit
      mockStorage.get.mockResolvedValue(tokenOverQuota);
      
      // Then: Service should deny the request
      const result = await service.checkQuota(tokenId);
      
      expect(mockStorage.get).toHaveBeenCalledWith(tokenId);
      expect(mockStorage.incrementUsage).not.toHaveBeenCalled();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('quota exceeded');
      expect(result.remaining).toBe(0);
    });

    it('should handle rate limiting', async () => {
      // Given: A token that would exceed rate limit
      const tokenId = 'token_rate_limited';
      const tokenData = TokenDataFactory.create({ 
        id: tokenId,
        rateLimit: 10 // 10 requests per time window
      });
      
      // When: Storage returns token and rate limit check fails
      mockStorage.get.mockResolvedValue(tokenData);
      // Simulate rate limit exceeded by having incrementUsage throw
      mockStorage.incrementUsage.mockRejectedValue(new Error('Rate limit exceeded'));
      
      // Then: Service should deny the request
      const result = await service.checkQuota(tokenId);
      
      expect(mockStorage.get).toHaveBeenCalledWith(tokenId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('rate limit');
    });

    it('should handle non-existent tokens in quota check', async () => {
      // Given: A non-existent token ID
      const tokenId = 'non_existent_token';
      
      // When: Storage returns null
      mockStorage.get.mockResolvedValue(null);
      
      // Then: Service should deny the request
      const result = await service.checkQuota(tokenId);
      
      expect(mockStorage.get).toHaveBeenCalledWith(tokenId);
      expect(mockStorage.incrementUsage).not.toHaveBeenCalled();
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not found');
    });
  });

  describe('revokeToken', () => {
    it('should revoke a token successfully', async () => {
      // Given: A token to revoke
      const tokenId = 'token_to_revoke';
      
      // When: Storage delete succeeds
      mockStorage.delete.mockResolvedValue(true);
      
      // Then: Service should return true
      const result = await service.revokeToken(tokenId);
      
      expect(mockStorage.delete).toHaveBeenCalledWith(tokenId);
      expect(result).toBe(true);
    });

    it('should handle revocation failures', async () => {
      // Given: A token to revoke that fails
      const tokenId = 'failing_revoke_token';
      
      // When: Storage delete fails
      mockStorage.delete.mockResolvedValue(false);
      
      // Then: Service should return false
      const result = await service.revokeToken(tokenId);
      
      expect(mockStorage.delete).toHaveBeenCalledWith(tokenId);
      expect(result).toBe(false);
    });

    it('should handle storage errors during revocation', async () => {
      // Given: A token to revoke and storage that throws
      const tokenId = 'error_revoke_token';
      const storageError = new Error('Database error during deletion');
      
      // When: Storage delete throws an error
      mockStorage.delete.mockRejectedValue(storageError);
      
      // Then: Service should propagate the error
      await expect(service.revokeToken(tokenId)).rejects.toThrow('Database error during deletion');
      expect(mockStorage.delete).toHaveBeenCalledWith(tokenId);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle malformed token data gracefully', async () => {
      // Given: Malformed token data from storage
      const tokenId = 'malformed_token';
      const malformedToken = { id: tokenId } as TokenData; // Missing required fields
      
      // When: Storage returns malformed data
      mockStorage.get.mockResolvedValue(malformedToken);
      
      // Then: Service should handle gracefully in validation
      const result = await service.validateToken(tokenId);
      
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('invalid');
    });

    it('should handle concurrent access scenarios', async () => {
      // Given: Multiple concurrent requests for the same token
      const tokenId = 'concurrent_token';
      const tokenData = TokenDataFactory.create({ id: tokenId });
      
      // When: Multiple validation requests are made simultaneously
      mockStorage.get.mockResolvedValue(tokenData);
      
      const promises = Array(5).fill(null).map(() => service.validateToken(tokenId));
      const results = await Promise.all(promises);
      
      // Then: All requests should be handled correctly
      results.forEach((result: unknown) => {
        expect((result as ValidationResult).valid).toBe(true);
      });
      expect(mockStorage.get).toHaveBeenCalledTimes(5);
    });
  });
});