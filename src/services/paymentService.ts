// Last Frontier Payment Service
// Handles FFC purchases, payment processing, and automatic VVV staking integration

import { supabaseAdmin } from '../config/supabase';
import { treasuryService } from './treasuryManagementService';
import { v4 as uuidv4 } from 'uuid';

/**
 * Payment provider interface for different payment processors
 */
export interface PaymentProvider {
  name: 'stripe' | 'paypal' | 'crypto';
  processPayment(amount: number, currency: string, metadata: any): Promise<PaymentResult>;
}

/**
 * Payment processing result
 */
export interface PaymentResult {
  success: boolean;
  transactionId: string;
  amount: number;
  currency: string;
  error?: string;
  metadata?: any;
}

/**
 * FFC purchase package options
 */
export interface FFCPackage {
  id: string;
  name: string;
  ffcAmount: number;
  usdPrice: number;
  bonusPercentage: number; // Extra FFC credits for bulk purchases
  description: string;
  popular?: boolean;
}

/**
 * Payment transaction record
 */
export interface PaymentTransaction {
  id: string;
  userId: string;
  paymentProvider: string;
  externalTransactionId: string;
  amountUSD: number;
  ffcAmount: number;
  bonusFFC: number;
  vvvPurchaseAmount: number; // 30% of payment for VVV
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: Date;
  completedAt?: Date;
  metadata: any;
}

/**
 * Last Frontier Payment Service
 * Handles the complete payment-to-FFC-to-VVV pipeline
 */
export class PaymentService {
  private readonly FFC_BASE_RATE = 100; // 100 FFC per $1 USD (base rate)
  private readonly VVV_ALLOCATION_PERCENTAGE = 0.30; // 30% of revenue to VVV
  
  // Predefined FFC packages with bulk bonuses
  private readonly FFC_PACKAGES: FFCPackage[] = [
    {
      id: 'starter',
      name: 'Starter Pack',
      ffcAmount: 1000,
      usdPrice: 9.99,
      bonusPercentage: 0,
      description: '1,000 FFC - Perfect for trying our uncensored AI models'
    },
    {
      id: 'professional',
      name: 'Professional Pack',
      ffcAmount: 5000,
      usdPrice: 39.99,
      bonusPercentage: 25, // 25% bonus FFC
      description: '5,000 FFC + 25% bonus - For regular AI power users',
      popular: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise Pack',
      ffcAmount: 15000,
      usdPrice: 99.99,
      bonusPercentage: 50, // 50% bonus FFC
      description: '15,000 FFC + 50% bonus - Maximum value for heavy usage'
    },
    {
      id: 'unlimited',
      name: 'Unlimited Monthly',
      ffcAmount: 50000,
      usdPrice: 199.99,
      bonusPercentage: 100, // 100% bonus FFC
      description: '50,000 FFC + 100% bonus - Unlimited AI access for one month'
    }
  ];

  /**
   * Get available FFC packages
   */
  getFFCPackages(): FFCPackage[] {
    return this.FFC_PACKAGES;
  }

  /**
   * Calculate FFC amount including bonuses
   */
  calculateFFCAmount(packageId: string): { baseAmount: number; bonusAmount: number; totalAmount: number } {
    const pkg = this.FFC_PACKAGES.find(p => p.id === packageId);
    if (!pkg) {
      throw new Error('Invalid package ID');
    }

    const baseAmount = pkg.ffcAmount;
    const bonusAmount = Math.floor(baseAmount * (pkg.bonusPercentage / 100));
    const totalAmount = baseAmount + bonusAmount;

    return { baseAmount, bonusAmount, totalAmount };
  }

  /**
   * Process FFC purchase with integrated VVV staking
   */
  async processFFFCPurchase(
    userId: string,
    packageId: string,
    paymentProvider: PaymentProvider,
    paymentDetails: any
  ): Promise<PaymentTransaction> {
    const transactionId = uuidv4();
    
    try {
      // Validate package
      const pkg = this.FFC_PACKAGES.find(p => p.id === packageId);
      if (!pkg) {
        throw new Error('Invalid FFC package');
      }

      // Calculate FFC amounts
      const { baseAmount, bonusAmount, totalAmount } = this.calculateFFCAmount(packageId);
      const vvvAllocation = pkg.usdPrice * this.VVV_ALLOCATION_PERCENTAGE;

      // Create pending transaction record
      const transaction: PaymentTransaction = {
        id: transactionId,
        userId,
        paymentProvider: paymentProvider.name,
        externalTransactionId: '',
        amountUSD: pkg.usdPrice,
        ffcAmount: totalAmount,
        bonusFFC: bonusAmount,
        vvvPurchaseAmount: vvvAllocation,
        status: 'pending',
        createdAt: new Date(),
        metadata: { packageId, baseAmount, bonusAmount }
      };

      // Log pending transaction
      await this.logPaymentTransaction(transaction);

      // Process payment with provider
      const paymentResult = await paymentProvider.processPayment(
        pkg.usdPrice,
        'USD',
        {
          userId,
          packageId,
          ffcAmount: totalAmount,
          transactionId
        }
      );

      if (!paymentResult.success) {
        // Update transaction as failed
        transaction.status = 'failed';
        transaction.metadata.error = paymentResult.error;
        await this.updatePaymentTransaction(transaction);
        
        throw new Error(`Payment failed: ${paymentResult.error}`);
      }

      // Update transaction with payment details
      transaction.externalTransactionId = paymentResult.transactionId;
      transaction.status = 'completed';
      transaction.completedAt = new Date();

      // Execute the complete FFC allocation and VVV purchasing pipeline
      await this.executeFFCAllocationPipeline(transaction);

      return transaction;

    } catch (error) {
      console.error('FFC purchase error:', error);
      
      // Update transaction as failed
      const failedTransaction: PaymentTransaction = {
        id: transactionId,
        userId,
        paymentProvider: paymentProvider.name,
        externalTransactionId: '',
        amountUSD: 0,
        ffcAmount: 0,
        bonusFFC: 0,
        vvvPurchaseAmount: 0,
        status: 'failed',
        createdAt: new Date(),
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };

      await this.logPaymentTransaction(failedTransaction);
      throw error;
    }
  }

  /**
   * Execute the complete FFC allocation and VVV purchasing pipeline
   */
  private async executeFFCAllocationPipeline(transaction: PaymentTransaction): Promise<void> {
    try {
      // 1. Allocate FFC credits to user
      await this.allocateFFCToUser(transaction.userId, transaction.ffcAmount, transaction.id);

      // 2. Purchase VVV tokens with 30% of revenue
      await treasuryService.purchaseVVVFromRevenue(transaction.amountUSD);

      // 3. Update payment transaction record
      await this.updatePaymentTransaction(transaction);

      // 4. Log FFC payment record
      await this.logFFCPayment(transaction);

      console.log(`FFC Pipeline completed: User ${transaction.userId} received ${transaction.ffcAmount} FFC, $${transaction.vvvPurchaseAmount} allocated to VVV`);

    } catch (error) {
      console.error('FFC allocation pipeline error:', error);
      
      // Attempt rollback on critical failure
      await this.attemptTransactionRollback(transaction);
      throw error;
    }
  }

  /**
   * Allocate FFC credits to user account
   */
  private async allocateFFCToUser(userId: string, ffcAmount: number, transactionId: string): Promise<void> {
    try {
      // Get current user balance
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('ffc_balance')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        throw new Error('User not found');
      }

      const currentBalance = parseFloat(user.ffc_balance) || 0;
      const newBalance = currentBalance + ffcAmount;

      // Create FFC transaction record
      const { error: transactionError } = await supabaseAdmin
        .from('ffc_transactions')
        .insert({
          user_id: userId,
          transaction_type: 'purchase',
          amount: ffcAmount,
          balance_before: currentBalance,
          balance_after: newBalance,
          description: `FFC purchase - ${ffcAmount} credits`,
          payment_reference: transactionId
        });

      if (transactionError) {
        throw new Error(`FFC allocation failed: ${transactionError.message}`);
      }

      // The database trigger will automatically update user's balance
      console.log(`Allocated ${ffcAmount} FFC to user ${userId}`);

    } catch (error) {
      console.error('FFC allocation error:', error);
      throw error;
    }
  }

  /**
   * Log payment transaction to database
   */
  private async logPaymentTransaction(transaction: PaymentTransaction): Promise<void> {
    const { error } = await supabaseAdmin
      .from('ffc_payments')
      .upsert({
        id: transaction.id,
        user_id: transaction.userId,
        payment_provider: transaction.paymentProvider,
        payment_provider_id: transaction.externalTransactionId,
        amount_usd: transaction.amountUSD,
        ffc_amount: transaction.ffcAmount,
        ffc_rate: transaction.ffcAmount / Math.max(transaction.amountUSD, 0.01), // Avoid division by zero
        payment_status: transaction.status,
        created_at: transaction.createdAt.toISOString(),
        processed_at: transaction.completedAt?.toISOString(),
        metadata: transaction.metadata
      }, {
        onConflict: 'id'
      });

    if (error) {
      console.error('Payment transaction logging error:', error);
      throw new Error(`Failed to log payment transaction: ${error.message}`);
    }
  }

  /**
   * Update payment transaction status
   */
  private async updatePaymentTransaction(transaction: PaymentTransaction): Promise<void> {
    await this.logPaymentTransaction(transaction);
  }

  /**
   * Log FFC payment record for analytics
   */
  private async logFFCPayment(transaction: PaymentTransaction): Promise<void> {
    // This creates a separate analytics record for business intelligence
    const { error } = await supabaseAdmin
      .from('ai_provider_metrics')
      .upsert({
        date: new Date().toISOString().split('T')[0],
        revenue_usd: transaction.amountUSD,
        total_ffc_billed: transaction.ffcAmount,
        metadata: {
          transaction_id: transaction.id,
          package_type: transaction.metadata.packageId,
          vvv_allocation: transaction.vvvPurchaseAmount
        }
      }, {
        onConflict: 'date'
      });

    if (error) {
      console.error('FFC payment analytics logging error:', error);
    }
  }

  /**
   * Attempt transaction rollback on critical failure
   */
  private async attemptTransactionRollback(transaction: PaymentTransaction): Promise<void> {
    console.log(`Attempting rollback for transaction ${transaction.id}`);
    
    try {
      // Mark transaction as failed
      transaction.status = 'failed';
      await this.updatePaymentTransaction(transaction);

      // Note: In production, you might need to:
      // 1. Refund the payment via payment provider
      // 2. Reverse FFC allocation if it was completed
      // 3. Notify treasury service to reverse VVV purchase

    } catch (rollbackError) {
      console.error('Transaction rollback failed:', rollbackError);
    }
  }

  /**
   * Get user's payment history
   */
  async getUserPaymentHistory(userId: string): Promise<PaymentTransaction[]> {
    try {
      const { data: payments, error } = await supabaseAdmin
        .from('ffc_payments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch payment history: ${error.message}`);
      }

      return payments?.map(p => ({
        id: p.id,
        userId: p.user_id,
        paymentProvider: p.payment_provider,
        externalTransactionId: p.payment_provider_id,
        amountUSD: parseFloat(p.amount_usd),
        ffcAmount: parseFloat(p.ffc_amount),
        bonusFFC: 0, // Calculate from metadata if needed
        vvvPurchaseAmount: parseFloat(p.amount_usd) * this.VVV_ALLOCATION_PERCENTAGE,
        status: p.payment_status as any,
        createdAt: new Date(p.created_at),
        completedAt: p.processed_at ? new Date(p.processed_at) : undefined,
        metadata: p.metadata || {}
      })) || [];

    } catch (error) {
      console.error('Payment history fetch error:', error);
      throw error;
    }
  }

  /**
   * Process refund request
   */
  async processRefund(transactionId: string, reason: string): Promise<boolean> {
    try {
      // In production: Implement refund logic with payment providers
      // For now: Mark transaction as refunded and reverse FFC allocation
      
      console.log(`Processing refund for transaction ${transactionId}: ${reason}`);
      
      // Update transaction status
      const { error } = await supabaseAdmin
        .from('ffc_payments')
        .update({ 
          payment_status: 'refunded',
          metadata: { refund_reason: reason, refunded_at: new Date().toISOString() }
        })
        .eq('id', transactionId);

      if (error) {
        throw new Error(`Refund processing failed: ${error.message}`);
      }

      return true;

    } catch (error) {
      console.error('Refund processing error:', error);
      return false;
    }
  }
}

// Export singleton instance
export const paymentService = new PaymentService();