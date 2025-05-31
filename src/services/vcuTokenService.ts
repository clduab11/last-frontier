/**
 * VCU Token Management Service
 * Restores core functionality for Parallax API and content generation integration.
 * Follows Sprint 1 patterns: class-based, dependency-injected, type-safe, and testable.
 */

import { TokenStorage } from '../storage/tokenStorage';
import { TokenData } from '../types/vcu';

/**
 * VcuTokenService provides secure VCU token management and retrieval.
 * All methods are instance-based for testability and integration.
 */
export class VcuTokenService {
  private storage: TokenStorage;
  private activeTokenId: string;

  /**
   * Constructs the service with injected dependencies.
   * @param storage TokenStorage instance
   */
  constructor(storage?: TokenStorage) {
    this.storage = storage || new TokenStorage();
    // Determine the active token ID from environment or config
    this.activeTokenId = process.env.VCU_ACTIVE_TOKEN_ID || '';
    if (!this.activeTokenId) {
      throw new Error('VCU_ACTIVE_TOKEN_ID environment variable is not set.');
    }
  }

  /**
   * Retrieves the currently active, valid VCU token for API authentication.
   * Throws if no valid token is available.
   * @returns Promise<string> - decrypted VCU token value
   */
  async getActiveVcuToken(): Promise<string> {
    const token: TokenData | null = await this.storage.get(this.activeTokenId);
    if (!token) {
      throw new Error('No VCU token found for the configured active token ID.');
    }
    if (token.status !== 'active') {
      throw new Error(`VCU token is not active (status: ${token.status}).`);
    }
    if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
      throw new Error('VCU token is expired.');
    }
    // Decrypt token value if needed (assume storage.get returns decrypted for now)
    if (!token.value) {
      throw new Error('VCU token value is missing.');
    }
    return token.value;
  }

  // Additional methods (storeToken, getToken, validateToken, etc.) can be restored as needed.

  /**
   * Stores a new VCU token securely.
   * @param req StoreTokenRequest
   * @returns Promise<StoreTokenResponse>
   */
  async storeToken(req: import('../types/vcu').StoreTokenRequest): Promise<import('../types/vcu').StoreTokenResponse> {
    // Generate a new token ID (UUID or similar)
    const id = `vcu_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const now = new Date();
    const token: import('../types/vcu').TokenData = {
      id,
      value: req.value,
      createdAt: now,
      expiresAt: req.expiresAt,
      lastRotatedAt: now,
      usageCount: 0,
      quota: req.quota,
      rateLimit: req.rateLimit,
      ownerId: req.ownerId,
      status: 'active',
      metadata: req.metadata,
    };
    const stored = await this.storage.store(token);
    return { token: stored };
  }

  /**
   * Retrieves a token by ID.
   * @param tokenId string
   * @returns Promise<TokenData | null>
   */
  async getToken(tokenId: string): Promise<import('../types/vcu').TokenData | null> {
    return this.storage.get(tokenId);
  }

  /**
   * Validates a token by ID (status, expiry, etc).
   * @param req ValidateTokenRequest
   * @returns Promise<ValidateTokenResponse>
   */
  async validateToken(req: import('../types/vcu').ValidateTokenRequest): Promise<import('../types/vcu').ValidateTokenResponse> {
    const token = await this.storage.get(req.tokenId);
    if (!token) {
      return { result: { valid: false, reason: 'Token not found' } };
    }
    
    // Check for required fields to detect malformed tokens
    if (!token.status || !token.value || !token.createdAt) {
      return { result: { valid: false, reason: 'Token data is invalid', token } };
    }
    
    if (token.status !== 'active') {
      return { result: { valid: false, reason: `Token status is ${token.status}`, token } };
    }
    if (token.expiresAt && new Date(token.expiresAt) < new Date()) {
      return { result: { valid: false, reason: 'Token expired', token } };
    }
    return { result: { valid: true, token } };
  }

  /**
   * Rotates a token (generates a new value and updates rotation time).
   * @param req RotateTokenRequest
   * @returns Promise<RotateTokenResponse>
   */
  async rotateToken(req: import('../types/vcu').RotateTokenRequest): Promise<import('../types/vcu').RotateTokenResponse> {
    try {
      // First, check if the token exists
      const existingToken = await this.storage.get(req.tokenId);
      if (!existingToken) {
        return { result: { success: false, error: 'Token not found' } };
      }

      // Generate a new random value (simulate)
      const newValue = `rotated_${Math.random().toString(36).slice(2, 10)}`;
      const updated = await this.storage.rotate(req.tokenId, newValue);
      return { result: { success: true, newToken: updated } };
    } catch (error: unknown) {
      let errorMsg = 'Rotation failed';
      if (error instanceof Error) {
        errorMsg = error.message;
      }
      return { result: { success: false, error: errorMsg } };
    }
  }

  /**
   * Checks quota and rate limit for a token.
   * @param req QuotaStatusRequest
   * @returns Promise<QuotaStatusResponse>
   */
  async checkQuota(req: import('../types/vcu').QuotaStatusRequest): Promise<import('../types/vcu').QuotaStatusResponse> {
    const token = await this.storage.get(req.tokenId);
    if (!token) {
      return {
        status: {
          allowed: false,
          remaining: 0,
          resetAt: new Date(),
          reason: 'Token not found',
        },
      };
    }
    // For demonstration, assume quota is per day and resets at midnight UTC
    const now = new Date();
    const resetAt = new Date(now);
    resetAt.setUTCHours(24, 0, 0, 0);
    const remaining = Math.max(0, token.quota - token.usageCount);
    const allowed = token.status === 'active' && remaining > 0;
    let reason: string | undefined;
    if (token.status !== 'active') reason = `Token status is ${token.status}`;
    else if (remaining <= 0) reason = 'Quota exceeded';

    // If allowed, increment usage
    if (allowed) {
      try {
        await this.storage.incrementUsage(req.tokenId);
      } catch (error: unknown) {
        // If incrementUsage fails (e.g., rate limit), deny the request
        let errorReason = 'Usage increment failed';
        if (error instanceof Error) {
          errorReason = error.message;
        }
        return {
          status: {
            allowed: false,
            remaining: remaining,
            resetAt,
            reason: errorReason,
          },
        };
      }
    }

    return {
      status: {
        allowed,
        remaining: Math.max(0, remaining - (allowed ? 1 : 0)), // Adjust remaining if we consumed one
        resetAt,
        reason,
      },
    };
  }

  /**
   * Revokes a token (deletes it from storage).
   * @param tokenId string
   * @returns Promise<boolean>
   */
  async revokeToken(tokenId: string): Promise<boolean> {
    return this.storage.delete(tokenId);
  }
}

// Legacy named export for backward compatibility.
// Allows direct import of getActiveVcuToken for Parallax API client and tests.
export async function getActiveVcuToken(): Promise<string> {
  const service = new VcuTokenService();
  return service.getActiveVcuToken();
}