/**
 * VCU Token Management Domain and API Types
 * See: 11_vcu_token_management_pseudocode.md, 18_sprint2_api_specification.md
 */

export interface TokenData {
  id: string;
  value: string; // Encrypted token value
  createdAt: Date;
  expiresAt: Date;
  lastRotatedAt: Date;
  usageCount: number;
  quota: number;
  rateLimit: number;
  ownerId: string;
  status: 'active' | 'revoked' | 'expired';
  metadata?: Record<string, unknown>;
}

export interface TokenValidationResult {
  valid: boolean;
  reason?: string;
  token?: TokenData;
}

export interface TokenRotationResult {
  success: boolean;
  newToken?: TokenData;
  error?: string;
  backoffMs?: number;
}

export interface TokenQuotaStatus {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  reason?: string;
}

export interface StoreTokenRequest {
  value: string;
  expiresAt: Date;
  quota: number;
  rateLimit: number;
  ownerId: string;
  metadata?: Record<string, unknown>;
}

export interface StoreTokenResponse {
  token: TokenData;
}

export interface ValidateTokenRequest {
  tokenId: string;
}

export interface ValidateTokenResponse {
  result: TokenValidationResult;
}

export interface RotateTokenRequest {
  tokenId: string;
}

export interface RotateTokenResponse {
  result: TokenRotationResult;
}

export interface QuotaStatusRequest {
  tokenId: string;
}

export interface QuotaStatusResponse {
  status: TokenQuotaStatus;
}