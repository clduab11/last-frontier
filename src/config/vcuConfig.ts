// VCU Token Management Configuration
// Handles environment variable validation, schema defaults, and secure key management.

export interface VcuConfigOptions {
  redisUrl?: string;
  dbUrl?: string;
  encryptionKeyEnv: string;
  tokenDefaultExpiry: number; // in seconds
  tokenDefaultQuota: number;
  tokenDefaultRateLimit: number;
}

export class VcuConfig {
  private options: VcuConfigOptions;

  /**
   * Loads and validates configuration from environment variables.
   * Throws on missing/invalid config.
   */
  constructor() {
    // Implementation: load from process.env, validate, set defaults
    const tokenDefaultExpiryEnv = parseInt(process.env.TOKEN_DEFAULT_EXPIRY || '', 10);
    const tokenDefaultQuotaEnv = parseInt(process.env.TOKEN_DEFAULT_QUOTA || '', 10);
    const tokenDefaultRateLimitEnv = parseInt(process.env.TOKEN_DEFAULT_RATE_LIMIT || '', 10);

    this.options = {
      redisUrl: process.env.REDIS_URL, // Default is handled by the getter
      dbUrl: process.env.DATABASE_URL,   // Default is handled by the getter
      encryptionKeyEnv: 'VCU_ENCRYPTION_KEY',
      tokenDefaultExpiry: !isNaN(tokenDefaultExpiryEnv) ? tokenDefaultExpiryEnv : 86400, // 24 hours
      tokenDefaultQuota: !isNaN(tokenDefaultQuotaEnv) ? tokenDefaultQuotaEnv : 1000,
      tokenDefaultRateLimit: !isNaN(tokenDefaultRateLimitEnv) ? tokenDefaultRateLimitEnv : 100
    };
  }

  /**
   * Gets the Redis connection URL.
   */
  getRedisUrl(): string {
    return this.options.redisUrl || 'redis://localhost:6379';
  }

  /**
   * Gets the database connection URL.
   */
  getDbUrl(): string {
    return this.options.dbUrl || 'postgresql://localhost:5432/test';
  }

  /**
   * Gets the AES-256 encryption key from environment.
   * Throws if missing or invalid.
   */
  /**
   * Gets the AES-256 encryption key from environment.
   * Throws if missing or invalid (must be 32 bytes for AES-256).
   */
  getEncryptionKey(): Buffer {
      const key = process.env[this.options.encryptionKeyEnv];
      if (!key) {
          throw new Error(
              `Missing encryption key: environment variable '${this.options.encryptionKeyEnv}' is not set.`
          );
      }
      // SECURITY: Use base64 decoding to ensure the key is interpreted as a 32-byte AES-256 key.
      const keyBuffer = Buffer.from(key, 'base64');
      if (keyBuffer.length !== 32) {
          throw new Error(
              `Invalid encryption key length: expected 32 bytes for AES-256, got ${keyBuffer.length}.`
          );
      }
      return keyBuffer;
  }

  /**
   * Gets the default token expiry (in seconds).
   */
  getTokenDefaultExpiry(): number {
    return this.options.tokenDefaultExpiry;
  }

  /**
   * Gets the default token quota.
   */
  getTokenDefaultQuota(): number {
    return this.options.tokenDefaultQuota;
  }

  /**
   * Gets the default token rate limit.
   */
  getTokenDefaultRateLimit(): number {
    return this.options.tokenDefaultRateLimit;
  }
}