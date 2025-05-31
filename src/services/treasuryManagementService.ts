// Last Frontier Treasury Management Service
// Handles VVV token staking strategy, profit optimization, and VCU capacity planning

import axios from 'axios';
import { supabaseAdmin } from '../config/supabase';
import {
  VVVMarketData,
  PlatformVVVStrategy,
  VCUCapacityData,
  StakingStrategy,
  EconomicMetrics,
  VVVArbitrageOpportunity,
  TreasuryDashboard
} from '../types/tokenomics';

/**
 * Treasury Management Service
 * Core economic engine for VVV staking strategy and profit optimization
 */
export class TreasuryManagementService {
  private readonly VENICE_TOTAL_VCU = 181480; // Venice network daily VCU capacity
  private readonly REVENUE_TO_VVV_PERCENTAGE = 0.30; // 30% of revenue → VVV
  
  private currentStrategy: StakingStrategy = {
    name: 'dynamic',
    minStakePercentage: 0.70, // Always keep 70% staked for VCU capacity
    maxStakePercentage: 0.95, // Max 95% staked (keep 5% for trading opportunities)
    unstakeThreshold: 0.15, // Unstake 25% of excess when VVV rises 15%
    restakeThreshold: -0.10, // Restake when VVV drops 10%
    rebalanceFrequency: 'daily',
    profitTakingPercentage: 0.25 // Take 25% profits when unstaking
  };

  /**
   * Fetch current VVV market data from exchanges
   */
  async getVVVMarketData(): Promise<VVVMarketData> {
    try {
      // In production, integrate with real exchanges (Binance, KuCoin, etc.)
      // For now, simulate realistic data
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
        params: {
          ids: 'venice-ai', // VVV token ID
          vs_currencies: 'usd',
          include_24hr_vol: true,
          include_24hr_change: true,
          include_market_cap: true
        }
      });

      const vvvData = response.data['venice-ai'];
      
      return {
        currentPrice: vvvData.usd || 0.85, // Fallback price if API fails
        volume24h: vvvData.usd_24h_vol || 2500000,
        priceChange24h: vvvData.usd_24h_change || 3.2,
        marketCap: vvvData.usd_market_cap || 85000000,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('VVV market data fetch error:', error);
      // Return fallback data to keep system operational
      return {
        currentPrice: 0.85,
        volume24h: 2500000,
        priceChange24h: 3.2,
        marketCap: 85000000,
        lastUpdated: new Date()
      };
    }
  }

  /**
   * Get platform's current VVV holdings and strategy performance
   */
  async getPlatformVVVStrategy(): Promise<PlatformVVVStrategy> {
    try {
      // Fetch from platform treasury table
      const { data: treasury, error } = await supabaseAdmin
        .from('ai_provider_metrics')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        throw new Error(`Treasury data fetch failed: ${error.message}`);
      }

      const marketData = await this.getVVVMarketData();
      const totalVVV = treasury?.metadata?.total_vvv_holdings || 0;
      const staked = treasury?.metadata?.currently_staked || 0;
      const avgBuyPrice = treasury?.metadata?.average_buy_price || 0.82;

      return {
        totalVVVHoldings: totalVVV,
        currentlyStaked: staked,
        availableToStake: totalVVV - staked,
        averageBuyPrice: avgBuyPrice,
        unrealizedGains: (marketData.currentPrice - avgBuyPrice) * totalVVV,
        totalInvested: avgBuyPrice * totalVVV,
        stakingYieldAPY: this.calculateStakingYield(staked)
      };
    } catch (error) {
      console.error('Platform VVV strategy fetch error:', error);
      throw error;
    }
  }

  /**
   * Calculate current staking yield based on VCU value
   */
  private calculateStakingYield(stakedVVV: number): number {
    // Estimate: Staked VVV → % of network → VCU allocation → USD value
    const totalStakedVVV = 60000000; // Estimated total network stake
    const ourNetworkPercentage = stakedVVV / totalStakedVVV;
    const dailyVCUAllocation = this.VENICE_TOTAL_VCU * ourNetworkPercentage;
    const vcuValue = 0.10; // $0.10 per VCU (Venice's stated rate)
    const dailyUSDValue = dailyVCUAllocation * vcuValue;
    const annualUSDValue = dailyUSDValue * 365;
    const investmentValue = stakedVVV * 0.85; // Current VVV price estimate
    
    return investmentValue > 0 ? (annualUSDValue / investmentValue) * 100 : 0;
  }

  /**
   * Get VCU capacity data and utilization metrics
   */
  async getVCUCapacityData(): Promise<VCUCapacityData> {
    try {
      const strategy = await this.getPlatformVVVStrategy();
      const totalStakedVVV = 60000000; // Estimated total Venice network stake
      const ourNetworkPercentage = strategy.currentlyStaked / totalStakedVVV;
      const dailyAllocation = this.VENICE_TOTAL_VCU * ourNetworkPercentage;

      // Get today's VCU usage from FFC transactions
      const today = new Date().toISOString().split('T')[0];
      const { data: todayRequests } = await supabaseAdmin
        .from('ai_inference_requests')
        .select('ffc_cost')
        .gte('created_at', `${today}T00:00:00`)
        .lt('created_at', `${today}T23:59:59`);

      const dailyUsed = todayRequests?.reduce((sum, req) => sum + parseFloat(req.ffc_cost), 0) || 0;
      const utilizationRate = dailyAllocation > 0 ? (dailyUsed / dailyAllocation) * 100 : 0;

      return {
        dailyVCUAllocation: dailyAllocation,
        dailyVCUUsed: dailyUsed,
        utilizationRate: utilizationRate,
        projectedDemand: this.projectVCUDemand(dailyUsed),
        capacityBuffer: Math.max(0, dailyAllocation - dailyUsed),
        overflowRisk: utilizationRate > 85 // Risk threshold at 85% utilization
      };
    } catch (error) {
      console.error('VCU capacity data error:', error);
      throw error;
    }
  }

  /**
   * Project future VCU demand based on usage trends
   */
  private projectVCUDemand(currentUsage: number): number {
    // Simple growth projection - can be enhanced with ML models
    const growthRate = 1.05; // 5% daily growth assumption
    return currentUsage * growthRate;
  }

  /**
   * Analyze current market conditions for arbitrage opportunities
   */
  async analyzeArbitrageOpportunities(): Promise<VVVArbitrageOpportunity[]> {
    const marketData = await this.getVVVMarketData();
    const strategy = await this.getPlatformVVVStrategy();
    const vcuData = await this.getVCUCapacityData();
    
    const opportunities: VVVArbitrageOpportunity[] = [];

    // VVV price appreciation opportunity
    if (marketData.priceChange24h > this.currentStrategy.unstakeThreshold * 100) {
      opportunities.push({
        action: 'unstake',
        reasoning: `VVV price up ${marketData.priceChange24h.toFixed(2)}% - take profits`,
        expectedProfit: strategy.unrealizedGains * this.currentStrategy.profitTakingPercentage,
        riskLevel: 'low',
        timeframe: 'immediate',
        confidence: 75
      });
    }

    // VVV price dip opportunity
    if (marketData.priceChange24h < this.currentStrategy.restakeThreshold * 100) {
      opportunities.push({
        action: 'buy',
        reasoning: `VVV price down ${Math.abs(marketData.priceChange24h).toFixed(2)}% - accumulate`,
        expectedProfit: strategy.availableToStake * 0.10, // Estimate 10% recovery
        riskLevel: 'medium',
        timeframe: '1-7 days',
        confidence: 65
      });
    }

    // VCU capacity expansion needed
    if (vcuData.overflowRisk) {
      opportunities.push({
        action: 'stake',
        reasoning: 'VCU utilization >85% - increase capacity to avoid service degradation',
        expectedProfit: 0, // Service quality preservation
        riskLevel: 'low',
        timeframe: 'immediate',
        confidence: 90
      });
    }

    return opportunities;
  }

  /**
   * Execute VVV purchase from USD revenue
   */
  async purchaseVVVFromRevenue(usdAmount: number): Promise<boolean> {
    try {
      const vvvAmount = usdAmount * this.REVENUE_TO_VVV_PERCENTAGE;
      const marketData = await this.getVVVMarketData();
      const vvvTokens = vvvAmount / marketData.currentPrice;

      // In production: Execute actual VVV purchase via exchange API
      // For now: Log the transaction
      console.log(`Treasury: Purchasing ${vvvTokens.toFixed(2)} VVV tokens for $${vvvAmount}`);

      // Update treasury records
      await this.updateTreasuryMetrics({
        vvv_purchased: vvvTokens,
        usd_invested: vvvAmount,
        purchase_price: marketData.currentPrice,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      console.error('VVV purchase error:', error);
      return false;
    }
  }

  /**
   * Execute staking strategy rebalancing
   */
  async rebalanceStakingStrategy(): Promise<void> {
    try {
      const opportunities = await this.analyzeArbitrageOpportunities();
      
      for (const opportunity of opportunities) {
        if (opportunity.confidence > 70) {
          await this.executeArbitrageAction(opportunity);
        }
      }
    } catch (error) {
      console.error('Staking rebalance error:', error);
    }
  }

  /**
   * Execute arbitrage action based on opportunity analysis
   */
  private async executeArbitrageAction(opportunity: VVVArbitrageOpportunity): Promise<void> {
    console.log(`Treasury: Executing ${opportunity.action} - ${opportunity.reasoning}`);
    
    // In production: Execute actual staking/unstaking via Venice API
    // For now: Log the action and update metrics
    
    await this.updateTreasuryMetrics({
      action: opportunity.action,
      reasoning: opportunity.reasoning,
      expected_profit: opportunity.expectedProfit,
      executed_at: new Date()
    });
  }

  /**
   * Update treasury metrics in database
   */
  private async updateTreasuryMetrics(data: any): Promise<void> {
    const { error } = await supabaseAdmin
      .from('ai_provider_metrics')
      .upsert({
        date: new Date().toISOString().split('T')[0],
        metadata: data
      }, {
        onConflict: 'date'
      });

    if (error) {
      console.error('Treasury metrics update error:', error);
    }
  }

  /**
   * Generate treasury dashboard data
   */
  async getTreasuryDashboard(): Promise<TreasuryDashboard> {
    const [vvvStrategy, vcuCapacity, marketData] = await Promise.all([
      this.getPlatformVVVStrategy(),
      this.getVCUCapacityData(),
      this.getVVVMarketData()
    ]);

    const opportunities = await this.analyzeArbitrageOpportunities();

    return {
      platformMetrics: await this.calculateEconomicMetrics(),
      vvvStrategy,
      vcuCapacity,
      marketData,
      riskMetrics: await this.calculateRiskMetrics(),
      recommendedActions: opportunities,
      profitProjections: {
        next30Days: vvvStrategy.unrealizedGains * 0.30,
        next90Days: vvvStrategy.unrealizedGains * 0.50,
        nextYear: vvvStrategy.unrealizedGains * 1.20
      }
    };
  }

  /**
   * Calculate economic performance metrics
   */
  private async calculateEconomicMetrics(): Promise<EconomicMetrics> {
    // Get today's revenue from FFC sales
    const today = new Date().toISOString().split('T')[0];
    const { data: payments } = await supabaseAdmin
      .from('ffc_payments')
      .select('amount_usd')
      .gte('created_at', `${today}T00:00:00`)
      .lt('created_at', `${today}T23:59:59`);

    const dailyRevenue = payments?.reduce((sum, p) => sum + parseFloat(p.amount_usd), 0) || 0;
    const strategy = await this.getPlatformVVVStrategy();

    return {
      dailyRevenue,
      dailyVVVPurchases: dailyRevenue * this.REVENUE_TO_VVV_PERCENTAGE,
      tokenAppreciationGains: strategy.unrealizedGains,
      stakingYieldEarned: strategy.stakingYieldAPY * strategy.totalInvested / 365,
      totalPlatformValue: dailyRevenue + strategy.unrealizedGains,
      roiFromTokenization: strategy.unrealizedGains > 0 ? 
        (strategy.unrealizedGains / strategy.totalInvested) * 100 : 0
    };
  }

  /**
   * Calculate risk management metrics
   */
  private async calculateRiskMetrics(): Promise<any> {
    const strategy = await this.getPlatformVVVStrategy();
    
    return {
      maxVVVExposure: 0.35, // Max 35% of total assets in VVV
      liquidityReserve: 50000, // $50k USD reserve
      currentExposure: strategy.totalInvested,
      hedgingStrategy: 'partial',
      stopLossThreshold: -0.25, // 25% loss threshold
      concentrationRisk: 'medium'
    };
  }
}

// Export singleton instance
export const treasuryService = new TreasuryManagementService();