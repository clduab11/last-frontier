// Last Frontier AI Inference Service
// Secure middleware proxy for AI provider APIs with FCU cost tracking and rate limiting

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { supabaseAdmin } from '../config/supabase';
import { 
  AIInferenceRequest, 
  AIInferenceResponse, 
  FFCCosts, 
  UserFFCProfile,
  FFCTransaction,
  FFCUsageMetrics 
} from '../types/frontier';

/**
 * AI Inference Service Configuration
 */
interface AIProviderConfig {
  apiKey: string;
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
}

/**
 * Last Frontier AI Inference Service
 * Handles all AI operations with FFC cost tracking and user balance management
 * Uses fixed pricing model independent of backend provider costs
 */
export class AIInferenceService {
  private apiClient: AxiosInstance;
  private config: AIProviderConfig;

  constructor() {
    this.config = {
      apiKey: process.env.AI_PROVIDER_API_KEY || '',
      baseUrl: process.env.AI_PROVIDER_BASE_URL || '',
      timeout: 30000,
      retryAttempts: 3
    };

    if (!this.config.apiKey || !this.config.baseUrl) {
      throw new Error('AI provider configuration missing');
    }

    this.apiClient = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Calculate FFC cost for different AI operations
   * Uses fixed pricing model for predictable user experience
   */
  private calculateFFCCost(request: AIInferenceRequest): number {
    const { model, messages, prompt, max_tokens } = request;
    
    // Estimate token count if not provided
    let estimatedTokens = 0;
    if (messages) {
      estimatedTokens = messages.reduce((total, msg) => 
        total + Math.ceil(msg.content.length / 4), 0
      );
    } else if (prompt) {
      estimatedTokens = Math.ceil(prompt.length / 4);
    }
    
    if (max_tokens) {
      estimatedTokens += max_tokens;
    }

    // Apply FFC cost structure (20% premium for uncensored models)
    if (model.includes('image') || model.includes('dall-e')) {
      return FFCCosts.IMAGE_PER_GENERATION;
    } else if (model.includes('code') || model.includes('gpt-4')) {
      return Math.ceil(estimatedTokens / 1000) * FFCCosts.CODE_PER_1K_TOKENS;
    } else {
      return Math.ceil(estimatedTokens / 1000) * FFCCosts.TEXT_PER_1K_TOKENS;
    }
  }

  /**
   * Check if user has sufficient FFC balance
   */
  private async validateUserFFCBalance(userId: string, requiredFFC: number): Promise<boolean> {
    try {
      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('ffc_balance, daily_ffc_limit, last_ffc_reset_date')
        .eq('id', userId)
        .single();

      if (error || !user) {
        throw new Error('User not found');
      }

      // Check if daily limit needs reset
      const today = new Date().toISOString().split('T')[0];
      if (user.last_ffc_reset_date !== today) {
        await this.resetDailyFFCUsage(userId);
      }

      return user.ffc_balance >= requiredFFC;
    } catch (error) {
      console.error('FFC balance validation error:', error);
      return false;
    }
  }

  /**
   * Deduct FFC from user balance and log transaction
   */
  private async deductFFC(userId: string, amount: number, inferenceRequestId: string): Promise<void> {
    try {
      // Get current balance
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('ffc_balance')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        throw new Error('User not found');
      }

      const balanceBefore = parseFloat(user.ffc_balance);
      const balanceAfter = balanceBefore - amount;

      // Create FFC transaction record
      const { error: transactionError } = await supabaseAdmin
        .from('ffc_transactions')
        .insert({
          user_id: userId,
          transaction_type: 'deduction',
          amount: amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          description: 'AI inference request',
          inference_request_id: inferenceRequestId
        });

      if (transactionError) {
        throw new Error(`FFC transaction failed: ${transactionError.message}`);
      }

      // The trigger will automatically update the user's balance
    } catch (error) {
      console.error('FFC deduction error:', error);
      throw error;
    }
  }

  /**
   * Reset daily FFC usage for a user
   */
  private async resetDailyFFCUsage(userId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('users')
      .update({ last_ffc_reset_date: new Date().toISOString().split('T')[0] })
      .eq('id', userId);

    if (error) {
      console.error('Daily FFC reset error:', error);
    }
  }

  /**
   * Log AI inference request to database
   */
  private async logInferenceRequest(
    userId: string,
    request: AIInferenceRequest,
    ffcCost: number,
    status: string = 'pending'
  ): Promise<string> {
    const { data, error } = await supabaseAdmin
      .from('ai_inference_requests')
      .insert({
        user_id: userId,
        model_name: request.model,
        request_type: this.getRequestType(request),
        ffc_cost: ffcCost,
        token_count: this.estimateTokenCount(request),
        request_payload: request,
        status: status
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to log inference request: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Update inference request with response data
   */
  private async updateInferenceRequest(
    requestId: string,
    response: any,
    status: string,
    processingTimeMs?: number,
    errorMessage?: string
  ): Promise<void> {
    const updateData: any = {
      status,
      completed_at: new Date().toISOString()
    };

    if (response) {
      updateData.response_payload = response;
    }
    if (processingTimeMs) {
      updateData.processing_time_ms = processingTimeMs;
    }
    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    const { error } = await supabaseAdmin
      .from('ai_inference_requests')
      .update(updateData)
      .eq('id', requestId);

    if (error) {
      console.error('Failed to update inference request:', error);
    }
  }

  /**
   * Determine request type from inference request
   */
  private getRequestType(request: AIInferenceRequest): string {
    if (request.model.includes('image') || request.model.includes('dall-e')) {
      return 'image';
    } else if (request.model.includes('code')) {
      return 'code';
    } else if (request.messages) {
      return 'chat';
    } else {
      return 'text';
    }
  }

  /**
   * Estimate token count from request
   */
  private estimateTokenCount(request: AIInferenceRequest): number {
    let count = 0;
    if (request.messages) {
      count = request.messages.reduce((total, msg) => 
        total + Math.ceil(msg.content.length / 4), 0
      );
    } else if (request.prompt) {
      count = Math.ceil(request.prompt.length / 4);
    }
    return count;
  }

  /**
   * Main AI inference method with full FFC management
   * CRITICAL: Fixed pricing model - we absorb backend cost fluctuations
   */
  async processInferenceRequest(userId: string, request: AIInferenceRequest): Promise<AIInferenceResponse> {
    const startTime = Date.now();
    let requestId: string | null = null;

    try {
      // Calculate FFC cost (fixed pricing)
      const ffcCost = this.calculateFFCCost(request);

      // Validate user FFC balance
      const hasBalance = await this.validateUserFFCBalance(userId, ffcCost);
      if (!hasBalance) {
        return {
          success: false,
          error: 'Insufficient FFC balance',
          ffcCost: ffcCost,
          requestId: ''
        };
      }

      // Log inference request
      requestId = await this.logInferenceRequest(userId, request, ffcCost, 'processing');

      // Make API call to AI provider (backend agnostic)
      const response: AxiosResponse = await this.apiClient.post('/chat/completions', {
        model: request.model,
        messages: request.messages,
        max_tokens: request.max_tokens,
        temperature: request.temperature
      });

      // Deduct FFC from user balance
      await this.deductFFC(userId, ffcCost, requestId);

      // Update request log with success
      const processingTime = Date.now() - startTime;
      await this.updateInferenceRequest(requestId, response.data, 'completed', processingTime);

      return {
        success: true,
        data: response.data,
        ffcCost: ffcCost,
        requestId: requestId
      };

    } catch (error: any) {
      // Update request log with error
      if (requestId) {
        await this.updateInferenceRequest(requestId, null, 'failed', Date.now() - startTime, error.message);
      }

      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        ffcCost: 0,
        requestId: requestId || ''
      };
    }
  }

  /**
   * Get user FFC usage metrics
   */
  async getUserFFCMetrics(userId: string): Promise<FFCUsageMetrics> {
    try {
      const { data: user, error } = await supabaseAdmin
        .from('users')
        .select('ffc_balance, daily_ffc_limit, ffc_tier')
        .eq('id', userId)
        .single();

      if (error || !user) {
        throw new Error('User not found');
      }

      // Get today's usage
      const today = new Date().toISOString().split('T')[0];
      const { data: todayUsage } = await supabaseAdmin
        .from('ffc_transactions')
        .select('amount')
        .eq('user_id', userId)
        .eq('transaction_type', 'deduction')
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`);

      const dailyUsed = todayUsage?.reduce((sum, t) => sum + parseFloat(t.amount), 0) || 0;

      return {
        userId,
        requestsPerMinute: 0, // TODO: Calculate from recent requests
        ffcPerMinute: 0, // TODO: Calculate from recent usage
        dailyFFCUsed: dailyUsed,
        dailyFFCLimit: parseFloat(user.daily_ffc_limit),
        isRateLimited: dailyUsed >= parseFloat(user.daily_ffc_limit)
      };

    } catch (error) {
      console.error('FFC metrics error:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const aiInferenceService = new AIInferenceService();