// Last Frontier AI Platform - Compute Token Integration
// Middleware layer for decentralized AI inference with native tokenomics

/**
 * AI Provider Configuration
 */
export interface AIProviderConfig {
  apiKey: string;
  baseUrl: string;
  stakePercentage: number; // 0.3 = 30% of revenue goes to token staking
}

/**
 * FFC (Frontier Freedom Credits) cost structure for AI operations
 * Pricing includes 20% premium for uncensored/unfiltered model access
 * Based on 2024-2025 market rates: GPT-4o ($3-20/1M tokens), Claude ($3-15/1M tokens)
 */
export enum FFCCosts {
  TEXT_PER_1K_TOKENS = 2,     // $0.02 (~20% above $0.015 market average)
  IMAGE_PER_GENERATION = 4,   // $0.04 (~20% above $0.03 market average)  
  CODE_PER_1K_TOKENS = 3,     // $0.03 (~20% above $0.024 market average for code models)
}

/**
 * User's FFC balance and staking information
 */
export interface UserFFCProfile {
  userId: string;
  stakedTokens: number; // Amount of platform tokens staked
  dailyFFCAllocation: number; // Daily FFC based on stake percentage
  currentFFCBalance: number; // Remaining FFC for today
  totalFFCUsed: number; // Lifetime FFC consumption
  lastAllocationUpdate: Date; // When daily allocation was last calculated
  ffcTransactions: FFCTransaction[];
}

/**
 * FFC transaction log for audit and analytics
 */
export interface FFCTransaction {
  id: string;
  userId: string;
  transactionType: 'allocation' | 'deduction' | 'refund';
  amount: number;
  description: string;
  inferenceRequestId?: string; // Link to AI inference request
  timestamp: Date;
}

/**
 * AI inference request types
 */
export interface AIInferenceRequest {
  model: string;
  messages?: Array<{role: string; content: string}>;
  prompt?: string; // For image generation
  max_tokens?: number;
  temperature?: number;
}

/**
 * AI inference response wrapper
 */
export interface AIInferenceResponse {
  success: boolean;
  data?: any;
  error?: string;
  ffcCost: number;
  requestId: string;
}

/**
 * Platform token staking economics
 */
export interface TokenStakingData {
  userStakedTokens: number;
  totalNetworkStakedTokens: number;
  dailyFFCCapacity: number; // Total daily compute capacity
  userDailyAllocation: number; // (userStaked / totalStaked) * dailyCapacity
}

/**
 * Payment to platform token conversion tracking
 */
export interface TokenPurchaseRecord {
  userId: string;
  paymentAmount: number; // USD
  tokenAmount: number; // Platform tokens purchased
  stakeAmount: number; // Amount automatically staked (30% of payment)
  exchangeRate: number; // USD/Token at time of purchase
  transactionId: string;
  timestamp: Date;
}

/**
 * Real-time FFC monitoring for rate limiting
 */
export interface FFCUsageMetrics {
  userId: string;
  requestsPerMinute: number;
  ffcPerMinute: number;
  dailyFFCUsed: number;
  dailyFFCLimit: number;
  isRateLimited: boolean;
}