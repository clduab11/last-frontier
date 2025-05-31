import { VcuConfig } from '../../../src/config/vcuConfig';

describe('VcuConfig', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Clear relevant environment variables before each test
    delete process.env.REDIS_URL;
    delete process.env.DATABASE_URL;
    delete process.env.VCU_ENCRYPTION_KEY;
    delete process.env.TOKEN_DEFAULT_EXPIRY;
    delete process.env.TOKEN_DEFAULT_QUOTA;
    delete process.env.TOKEN_DEFAULT_RATE_LIMIT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Default Values', () => {
    it('should return default Redis URL when REDIS_URL is not set', () => {
      const config = new VcuConfig();
      expect(config.getRedisUrl()).toBe('redis://localhost:6379');
    });

    it('should return default Database URL when DATABASE_URL is not set', () => {
      const config = new VcuConfig();
      expect(config.getDbUrl()).toBe('postgresql://localhost:5432/test');
    });

    it('should return default token expiry when TOKEN_DEFAULT_EXPIRY is not set', () => {
      const config = new VcuConfig();
      expect(config.getTokenDefaultExpiry()).toBe(86400); // 24 hours
    });

    it('should return default token quota when TOKEN_DEFAULT_QUOTA is not set', () => {
      const config = new VcuConfig();
      expect(config.getTokenDefaultQuota()).toBe(1000);
    });

    it('should return default token rate limit when TOKEN_DEFAULT_RATE_LIMIT is not set', () => {
      const config = new VcuConfig();
      expect(config.getTokenDefaultRateLimit()).toBe(100);
    });

    it('should use default encryptionKeyEnv name', () => {
      // This test is more about the internal default rather than a getter
      // We'll test the behavior of getEncryptionKey with this default name later
      const config = new VcuConfig();
      // @ts-expect-error // Accessing private property for testing internal default
      expect(config.options.encryptionKeyEnv).toBe('VCU_ENCRYPTION_KEY');
    });
  });

  describe('Environment Variable Overrides', () => {
    it('should use REDIS_URL from environment if set', () => {
      process.env.REDIS_URL = 'redis://custom-redis:1234';
      const config = new VcuConfig();
      expect(config.getRedisUrl()).toBe('redis://custom-redis:1234');
    });

    it('should use DATABASE_URL from environment if set', () => {
      process.env.DATABASE_URL = 'postgresql://custom-db:5678/customdb';
      const config = new VcuConfig();
      expect(config.getDbUrl()).toBe('postgresql://custom-db:5678/customdb');
    });

    it('should use TOKEN_DEFAULT_EXPIRY from environment if set and valid', () => {
      process.env.TOKEN_DEFAULT_EXPIRY = '3600'; // 1 hour
      const config = new VcuConfig();
      expect(config.getTokenDefaultExpiry()).toBe(3600);
    });

    it('should use TOKEN_DEFAULT_QUOTA from environment if set and valid', () => {
      process.env.TOKEN_DEFAULT_QUOTA = '500';
      const config = new VcuConfig();
      expect(config.getTokenDefaultQuota()).toBe(500);
    });

    it('should use TOKEN_DEFAULT_RATE_LIMIT from environment if set and valid', () => {
      process.env.TOKEN_DEFAULT_RATE_LIMIT = '50';
      const config = new VcuConfig();
      expect(config.getTokenDefaultRateLimit()).toBe(50);
    });
  });

  describe('Encryption Key Handling', () => {
    const validBase64Key = Buffer.from('a'.repeat(32), 'utf8').toString('base64'); // 32-byte key

    it('should return encryption key from VCU_ENCRYPTION_KEY when set and valid', () => {
      process.env.VCU_ENCRYPTION_KEY = validBase64Key;
      const config = new VcuConfig();
      const key = config.getEncryptionKey();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
      expect(key.toString('base64')).toBe(validBase64Key);
    });

    it('should throw error if VCU_ENCRYPTION_KEY is not set', () => {
      const config = new VcuConfig();
      expect(() => config.getEncryptionKey()).toThrow(
        "Missing encryption key: environment variable 'VCU_ENCRYPTION_KEY' is not set."
      );
    });

    it('should throw error if VCU_ENCRYPTION_KEY is not valid base64', () => {
      process.env.VCU_ENCRYPTION_KEY = 'this-is-not-base64!';
      const config = new VcuConfig();
      // Expecting an error related to base64 decoding or length,
      // as Buffer.from might not throw for invalid base64 but produce a short/unexpected buffer.
      // The current implementation will throw due to length check after Buffer.from.
      expect(() => config.getEncryptionKey()).toThrow(
        /Invalid encryption key length: expected 32 bytes for AES-256, got \d+./
      );
    });

    it('should throw error if VCU_ENCRYPTION_KEY is not 32 bytes after base64 decoding', () => {
      const shortKey = Buffer.from('shortkey', 'utf8').toString('base64');
      process.env.VCU_ENCRYPTION_KEY = shortKey;
      const config = new VcuConfig();
      expect(() => config.getEncryptionKey()).toThrow(
        `Invalid encryption key length: expected 32 bytes for AES-256, got ${Buffer.from(shortKey, 'base64').length}.`
      );
    });

    it('should use custom encryptionKeyEnv name if provided in options', () => {
      const customEnvName = 'MY_CUSTOM_VCU_KEY';
      process.env[customEnvName] = validBase64Key;
      // Temporarily modify constructor to accept options for this test
      // This highlights a potential refactor: make VcuConfig constructor accept options.
      // For now, we'll assume a way to pass options or test this aspect differently if needed.
      // Since the constructor isn't designed for options injection currently,
      // we will test this by modifying the internal options post-construction for this specific test.
      const config = new VcuConfig();
      // @ts-expect-error // Accessing private property for testing
      config.options.encryptionKeyEnv = customEnvName;
      const key = config.getEncryptionKey();
      expect(key.toString('base64')).toBe(validBase64Key);
      delete process.env[customEnvName]; // Clean up
    });
  });

  describe('Invalid Environment Variable Values', () => {
    it('should use default token expiry if TOKEN_DEFAULT_EXPIRY is not a valid number', () => {
      process.env.TOKEN_DEFAULT_EXPIRY = 'not-a-number';
      const config = new VcuConfig();
      expect(config.getTokenDefaultExpiry()).toBe(86400); // Default
    });

    it('should use default token quota if TOKEN_DEFAULT_QUOTA is not a valid number', () => {
      process.env.TOKEN_DEFAULT_QUOTA = 'invalid';
      const config = new VcuConfig();
      expect(config.getTokenDefaultQuota()).toBe(1000); // Default
    });

    it('should use default token rate limit if TOKEN_DEFAULT_RATE_LIMIT is not a valid number', () => {
      process.env.TOKEN_DEFAULT_RATE_LIMIT = 'bad-value';
      const config = new VcuConfig();
      expect(config.getTokenDefaultRateLimit()).toBe(100); // Default
    });

    it('should handle empty string for TOKEN_DEFAULT_EXPIRY and use default', () => {
      process.env.TOKEN_DEFAULT_EXPIRY = '';
      const config = new VcuConfig();
      expect(config.getTokenDefaultExpiry()).toBe(86400);
    });

    it('should handle empty string for TOKEN_DEFAULT_QUOTA and use default', () => {
      process.env.TOKEN_DEFAULT_QUOTA = '';
      const config = new VcuConfig();
      expect(config.getTokenDefaultQuota()).toBe(1000);
    });

    it('should handle empty string for TOKEN_DEFAULT_RATE_LIMIT and use default', () => {
      process.env.TOKEN_DEFAULT_RATE_LIMIT = '';
      const config = new VcuConfig();
      expect(config.getTokenDefaultRateLimit()).toBe(100);
    });
  });
});