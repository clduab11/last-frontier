/**
 * VCU Token Management Test Factories
 * Provides mock data and test objects for comprehensive test coverage
 * Based on TDD anchors from 11_vcu_token_management_pseudocode.md
 */

import { TokenData, TokenValidationResult, TokenRotationResult, TokenQuotaStatus } from '../../src/types/vcu';
import { VcuConfigOptions } from '../../src/config/vcuConfig';

// Test-specific interfaces for mock objects
interface VeniceApiTokenResponse {
  success: boolean;
  token?: string;
  expiresAt?: string;
  error?: string;
  code?: string;
}

interface VeniceApiValidationResponse {
  valid: boolean;
  metadata?: {
    issuedAt: string;
    environment: string;
  };
  reason?: string;
}

interface DatabaseTokenRecord {
  id: string;
  encrypted_value: string;
  created_at: Date;
  expires_at: Date;
  last_rotated_at: Date;
  usage_count: number;
  quota: number;
  rate_limit: number;
  owner_id: string;
  status: string;
  metadata: string;
}

interface CacheEntry {
  key: string;
  value: string;
  ttl: number;
}

/**
 * Factory for creating mock TokenData objects
 */
export class TokenDataFactory {
  static create(overrides: Partial<TokenData> = {}): TokenData {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const lastRotatedAt = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

    return {
      id: 'token_123456789',
      value: 'vcu_abcdef1234567890abcdef1234567890abcdef12',
      createdAt: now,
      expiresAt,
      lastRotatedAt,
      usageCount: 0,
      quota: 1000,
      rateLimit: 100,
      ownerId: 'user_987654321',
      status: 'active',
      metadata: {
        environment: 'development',
        service: 'parallax-api-integration',
        version: '1.0.0'
      },
      ...overrides
    };
  }

  static createExpired(overrides: Partial<TokenData> = {}): TokenData {
    const now = new Date();
    const expiredDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago

    return this.create({
      expiresAt: expiredDate,
      status: 'expired',
      ...overrides
    });
  }

  static createRevoked(overrides: Partial<TokenData> = {}): TokenData {
    return this.create({
      status: 'revoked',
      ...overrides
    });
  }

  static createNearExpiry(overrides: Partial<TokenData> = {}): TokenData {
    const now = new Date();
    const nearExpiryDate = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 hours

    return this.create({
      expiresAt: nearExpiryDate,
      ...overrides
    });
  }

  static createHighUsage(overrides: Partial<TokenData> = {}): TokenData {
    return this.create({
      usageCount: 950,
      quota: 1000,
      ...overrides
    });
  }

  static createEncrypted(overrides: Partial<TokenData> = {}): TokenData {
    return this.create({
      value: 'encrypted_vcu_token_value_base64_encoded',
      ...overrides
    });
  }
}

/**
 * Factory for creating mock validation results
 */
export class ValidationResultFactory {
  static createValid(overrides: Partial<TokenValidationResult> = {}): TokenValidationResult {
    return {
      valid: true,
      token: TokenDataFactory.create(),
      ...overrides
    };
  }

  static createInvalid(reason: string, overrides: Partial<TokenValidationResult> = {}): TokenValidationResult {
    return {
      valid: false,
      reason,
      ...overrides
    };
  }

  static createExpiredValidation(): TokenValidationResult {
    return this.createInvalid('Token has expired', {
      token: TokenDataFactory.createExpired()
    });
  }

  static createRevokedValidation(): TokenValidationResult {
    return this.createInvalid('Token has been revoked', {
      token: TokenDataFactory.createRevoked()
    });
  }

  static createNotFoundValidation(): TokenValidationResult {
    return this.createInvalid('Token not found');
  }
}

/**
 * Factory for creating mock rotation results
 */
export class RotationResultFactory {
  static createSuccess(overrides: Partial<TokenRotationResult> = {}): TokenRotationResult {
    return {
      success: true,
      newToken: TokenDataFactory.create({
        id: 'token_new_123456789',
        value: 'vcu_newtoken1234567890abcdef1234567890abcd',
        usageCount: 0,
        lastRotatedAt: new Date()
      }),
      ...overrides
    };
  }

  static createFailure(error: string, backoffMs?: number): TokenRotationResult {
    return {
      success: false,
      error,
      backoffMs
    };
  }

  static createWithBackoff(backoffMs: number): TokenRotationResult {
    return this.createFailure('Venice.ai API temporarily unavailable', backoffMs);
  }
}

/**
 * Factory for creating mock quota status
 */
export class QuotaStatusFactory {
  static createAllowed(overrides: Partial<TokenQuotaStatus> = {}): TokenQuotaStatus {
    const resetAt = new Date();
    resetAt.setHours(resetAt.getHours() + 1); // Reset in 1 hour

    return {
      allowed: true,
      remaining: 850,
      resetAt,
      ...overrides
    };
  }

  static createDenied(reason: string, overrides: Partial<TokenQuotaStatus> = {}): TokenQuotaStatus {
    const resetAt = new Date();
    resetAt.setHours(resetAt.getHours() + 1);

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      reason,
      ...overrides
    };
  }

  static createQuotaExceeded(): TokenQuotaStatus {
    return this.createDenied('Quota exceeded');
  }

  static createRateLimited(): TokenQuotaStatus {
    return this.createDenied('Rate limit exceeded');
  }
}

/**
 * Factory for creating mock configuration options
 */
export class ConfigFactory {
  static createValid(overrides: Partial<VcuConfigOptions> = {}): VcuConfigOptions {
    return {
      redisUrl: 'redis://localhost:6379',
      dbUrl: 'postgresql://localhost:5432/test_db',
      encryptionKeyEnv: 'VCU_ENCRYPTION_KEY',
      tokenDefaultExpiry: 2592000, // 30 days in seconds
      tokenDefaultQuota: 1000,
      tokenDefaultRateLimit: 100,
      ...overrides
    };
  }

  static createMissingEncryption(): VcuConfigOptions {
    return this.createValid({
      encryptionKeyEnv: ''
    });
  }

  static createInvalidExpiry(): VcuConfigOptions {
    return this.createValid({
      tokenDefaultExpiry: -1
    });
  }
}

/**
 * Factory for creating mock environment variables
 */
export class EnvironmentFactory {
  static createValid(): Record<string, string> {
    return {
      VCU_ENCRYPTION_KEY: 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890', // 64 hex chars = 32 bytes
      REDIS_URL: 'redis://localhost:6379',
      DATABASE_URL: 'postgresql://localhost:5432/test_db',
      VCU_TOKEN_DEFAULT_EXPIRY: '2592000',
      VCU_TOKEN_DEFAULT_QUOTA: '1000',
      VCU_TOKEN_DEFAULT_RATE_LIMIT: '100',
      VENICE_API_KEY_DEV: 'dev_api_key_12345',
      VENICE_API_KEY_STAGING: 'staging_api_key_12345',
      VENICE_API_KEY_PROD: 'prod_api_key_12345'
    };
  }

  static createMissingKey(): Record<string, string> {
    const env = this.createValid();
    delete env.VCU_ENCRYPTION_KEY;
    return env;
  }

  static createInvalidKey(): Record<string, string> {
    return {
      ...this.createValid(),
      VCU_ENCRYPTION_KEY: 'invalid_short_key'
    };
  }
}

/**
 * Factory for creating mock Venice.ai API responses
 */
export class VeniceApiFactory {
  static createTokenResponse(success: boolean = true): VeniceApiTokenResponse {
    if (success) {
      return {
        success: true,
        token: 'vcu_newtoken1234567890abcdef1234567890abcd',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };
    }

    return {
      success: false,
      error: 'Failed to generate token',
      code: 'TOKEN_GENERATION_FAILED'
    };
  }

  static createValidationResponse(valid: boolean = true): VeniceApiValidationResponse {
    if (valid) {
      return {
        valid: true,
        metadata: {
          issuedAt: new Date().toISOString(),
          environment: 'development'
        }
      };
    }

    return {
      valid: false,
      reason: 'Token validation failed'
    };
  }
}

/**
 * Factory for creating mock database records
 */
export class DatabaseRecordFactory {
  static createTokenRecord(overrides: Partial<DatabaseTokenRecord> = {}): DatabaseTokenRecord {
    const token = TokenDataFactory.create();
    return {
      id: token.id,
      encrypted_value: 'encrypted_base64_token_value',
      created_at: token.createdAt,
      expires_at: token.expiresAt,
      last_rotated_at: token.lastRotatedAt,
      usage_count: token.usageCount,
      quota: token.quota,
      rate_limit: token.rateLimit,
      owner_id: token.ownerId,
      status: token.status,
      metadata: JSON.stringify(token.metadata),
      ...overrides
    };
  }
}

/**
 * Factory for creating mock Redis cache entries
 */
export class CacheEntryFactory {
  static createValidationCache(tokenId: string, result: TokenValidationResult): CacheEntry {
    return {
      key: `token_validation:${tokenId}`,
      value: JSON.stringify(result),
      ttl: 300 // 5 minutes
    };
  }

  static createTokenCache(tokenId: string, token: TokenData): CacheEntry {
    return {
      key: `token:${tokenId}`,
      value: JSON.stringify(token),
      ttl: 3600 // 1 hour
    };
  }
}

/**
 * Factory for creating mock error scenarios
 */
export class ErrorFactory {
  static createDatabaseError(): Error {
    const error = new Error('Database connection failed');
    error.name = 'DatabaseError';
    return error;
  }

  static createRedisError(): Error {
    const error = new Error('Redis connection failed');
    error.name = 'RedisError';
    return error;
  }

  static createEncryptionError(): Error {
    const error = new Error('Encryption failed');
    error.name = 'EncryptionError';
    return error;
  }

  static createVeniceApiError(): Error {
    const error = new Error('Venice.ai API error');
    error.name = 'VeniceApiError';
    return error;
  }

  static createValidationError(message: string): Error {
    const error = new Error(message);
    error.name = 'ValidationError';
    return error;
  }

  static createConfigurationError(message: string): Error {
    const error = new Error(message);
    error.name = 'ConfigurationError';
    return error;
  }
}