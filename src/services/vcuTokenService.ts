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
}

// Legacy named export for backward compatibility.
// Allows direct import of getActiveVcuToken for Parallax API client and tests.
export async function getActiveVcuToken(): Promise<string> {
  const service = new VcuTokenService();
  return service.getActiveVcuToken();
}