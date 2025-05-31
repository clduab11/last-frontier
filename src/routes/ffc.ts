// Last Frontier FFC (Frontier Freedom Credits) API Routes
// Handles FFC purchases, balance management, and transaction history

import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { requireRole, UserRole } from '../auth/authService';
import { paymentService } from '../services/paymentService';
import { aiInferenceService } from '../services/aiInferenceService';
import { treasuryService } from '../services/treasuryManagementService';

const router = Router();

/**
 * Middleware to check for validation errors
 */
const handleValidationErrors = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: errors.array() 
    });
  }
  next();
};

/**
 * GET /api/ffc/packages
 * Get available FFC packages for purchase
 */
router.get('/packages', (req: Request, res: Response) => {
  try {
    const packages = paymentService.getFFCPackages();
    res.json({
      success: true,
      packages,
      pricing: {
        baseRate: 100, // FFC per USD
        currency: 'USD',
        note: 'Includes 20% premium for uncensored AI model access'
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ffc/purchase
 * Purchase FFC credits with payment processing
 */
router.post('/purchase',
  [
    body('packageId').isString().notEmpty().withMessage('Package ID is required'),
    body('paymentMethod').isIn(['stripe', 'paypal', 'crypto']).withMessage('Invalid payment method'),
    body('paymentDetails').isObject().withMessage('Payment details are required')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { packageId, paymentMethod, paymentDetails } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Create payment provider interface (simplified for demo)
      const paymentProvider = {
        name: paymentMethod as any,
        async processPayment(amount: number, currency: string, metadata: any) {
          // In production: Integrate with actual payment processors
          return {
            success: true,
            transactionId: `demo_${Date.now()}`,
            amount,
            currency,
            metadata
          };
        }
      };

      const transaction = await paymentService.processFFFCPurchase(
        userId,
        packageId,
        paymentProvider,
        paymentDetails
      );

      res.json({
        success: true,
        transaction: {
          id: transaction.id,
          ffcAmount: transaction.ffcAmount,
          bonusFFC: transaction.bonusFFC,
          amountUSD: transaction.amountUSD,
          status: transaction.status
        },
        message: 'FFC purchase completed successfully'
      });

    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/ffc/balance
 * Get user's current FFC balance and usage metrics
 */
router.get('/balance', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const metrics = await aiInferenceService.getUserFFCMetrics(userId);

    res.json({
      success: true,
      balance: {
        current: metrics.dailyFFCLimit - metrics.dailyFFCUsed, // Available today
        dailyLimit: metrics.dailyFFCLimit,
        dailyUsed: metrics.dailyFFCUsed,
        utilizationRate: (metrics.dailyFFCUsed / metrics.dailyFFCLimit) * 100,
        isRateLimited: metrics.isRateLimited
      },
      usage: {
        requestsPerMinute: metrics.requestsPerMinute,
        ffcPerMinute: metrics.ffcPerMinute
      }
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ffc/transactions
 * Get user's FFC transaction history
 */
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { limit = 50, offset = 0 } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const transactions = await paymentService.getUserPaymentHistory(userId);
    
    // Apply pagination
    const paginatedTransactions = transactions
      .slice(Number(offset), Number(offset) + Number(limit));

    res.json({
      success: true,
      transactions: paginatedTransactions,
      pagination: {
        total: transactions.length,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + Number(limit) < transactions.length
      }
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/ffc/refund
 * Request refund for FFC purchase (admin only)
 */
router.post('/refund',
  requireRole([UserRole.ADMIN]),
  [
    body('transactionId').isUUID().withMessage('Valid transaction ID is required'),
    body('reason').isString().notEmpty().withMessage('Refund reason is required')
  ],
  handleValidationErrors,
  async (req: Request, res: Response) => {
    try {
      const { transactionId, reason } = req.body;

      const refundResult = await paymentService.processRefund(transactionId, reason);

      if (refundResult) {
        res.json({
          success: true,
          message: 'Refund processed successfully',
          transactionId
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Refund processing failed'
        });
      }

    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/ffc/pricing
 * Get current FFC pricing structure
 */
router.get('/pricing', (req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      pricing: {
        textGeneration: {
          cost: 2, // FFC per 1K tokens
          unit: '1K tokens',
          models: ['uncensored-text', 'frontier-chat']
        },
        imageGeneration: {
          cost: 4, // FFC per image
          unit: 'per image',
          models: ['uncensored-image', 'frontier-art']
        },
        codeGeneration: {
          cost: 3, // FFC per 1K tokens
          unit: '1K tokens', 
          models: ['uncensored-code', 'frontier-dev']
        }
      },
      premiumValue: {
        uncensoredAccess: true,
        unrestrictedContent: true,
        premiumModels: true,
        marketPremium: '20% above standard AI pricing'
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/ffc/analytics (Admin only)
 * Get FFC usage analytics and treasury metrics
 */
router.get('/analytics',
  requireRole([UserRole.ADMIN]),
  async (req: Request, res: Response) => {
    try {
      const dashboard = await treasuryService.getTreasuryDashboard();
      
      res.json({
        success: true,
        analytics: {
          revenue: dashboard.platformMetrics,
          vvvStrategy: dashboard.vvvStrategy,
          vcuCapacity: dashboard.vcuCapacity,
          marketData: dashboard.marketData,
          profitProjections: dashboard.profitProjections,
          recommendedActions: dashboard.recommendedActions
        }
      });

    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

export default router;