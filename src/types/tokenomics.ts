// Last Frontier Tokenomics - VVV Staking Strategy and Profit Optimization
// Advanced economic model leveraging Venice AI's VCU/VVV ecosystem for multi-vector profits

/**
 * VVV Token Market Data
 */
export interface VVVMarketData {
  currentPrice: number; // USD per VVV
  volume24h: number;
  priceChange24h: number;
  marketCap: number;
  lastUpdated: Date;
}

/**
 * Platform VVV Holdings and Strategy
 */
export interface PlatformVVVStrategy {
  totalVVVHoldings: number; // Total VVV tokens owned
  currentlyStaked: number; // VVV currently staked in Venice
  availableToStake: number; // VVV held for strategic staking
  averageBuyPrice: number; // Average USD cost basis
  unrealizedGains: number; // Current profit/loss on holdings
  totalInvested: number; // Total USD invested in VVV
  stakingYieldAPY: number; // Current staking yield percentage
}

/**
 * VCU Capacity Management
 */
export interface VCUCapacityData {
  dailyVCUAllocation: number; // Our allocated VCU from Venice (based on stake %)
  dailyVCUUsed: number; // VCU consumed by user requests today
  utilizationRate: number; // Used / Allocated percentage
  projectedDemand: number; // Forecasted VCU needs based on traffic
  capacityBuffer: number; // Safety margin for peak demand
  overflowRisk: boolean; // Risk of running out of VCU
}

/**
 * Staking Strategy Configuration
 */
export interface StakingStrategy {
  name: string; // 'conservative', 'aggressive', 'dynamic'
  minStakePercentage: number; // Minimum % of holdings to keep staked
  maxStakePercentage: number; // Maximum % to stake (reserve some for trading)
  unstakeThreshold: number; // VVV price increase % to trigger partial unstaking
  restakeThreshold: number; // VVV price decrease % to trigger additional staking
  rebalanceFrequency: 'hourly' | 'daily' | 'weekly';
  profitTakingPercentage: number; // % of gains to realize when unstaking
}

/**
 * Revenue Split Configuration
 */
export interface RevenueAllocation {
  vvvPurchasePercentage: number; // Default 30% of revenue → VVV
  operatingExpenses: number; // Platform costs
  profitMargin: number; // Net profit after expenses
  reinvestmentRate: number; // % of profits to reinvest in VVV
}

/**
 * Economic Performance Metrics
 */
export interface EconomicMetrics {
  dailyRevenue: number; // USD from FFC sales
  dailyVVVPurchases: number; // USD spent on VVV tokens
  tokenAppreciationGains: number; // Unrealized gains from VVV holdings
  stakingYieldEarned: number; // VCU value from staking rewards
  totalPlatformValue: number; // Revenue + Token Gains + Staking Yield
  roiFromTokenization: number; // ROI from tokenomics vs traditional SaaS
}

/**
 * Risk Management Parameters
 */
export interface RiskParameters {
  maxVVVExposure: number; // Maximum % of revenue to hold in VVV
  liquidityReserve: number; // USD reserve for operational needs
  hedgingStrategy: 'none' | 'partial' | 'full';
  stopLossThreshold: number; // VVV price drop % to trigger selling
  concentrationRisk: number; // Max % of total VCU capacity to control
}

/**
 * Market Opportunity Analysis
 */
export interface MarketOpportunity {
  vvvPriceTarget: number; // Target price for profit taking
  expectedPriceAppreciation: number; // Projected % gain over timeframe
  networkGrowthRate: number; // Venice AI network expansion rate
  competitorVCUDemand: number; // External demand for VCU capacity
  arbitrageOpportunities: VVVArbitrageOpportunity[];
}

/**
 * VVV Arbitrage Opportunity
 */
export interface VVVArbitrageOpportunity {
  action: 'stake' | 'unstake' | 'buy' | 'sell';
  reasoning: string;
  expectedProfit: number;
  riskLevel: 'low' | 'medium' | 'high';
  timeframe: string; // 'immediate', '1-7 days', '1-4 weeks'
  confidence: number; // 0-100% confidence in prediction
}

/**
 * Automated Trading Rules
 */
export interface AutomatedTradingRules {
  enabled: boolean;
  maxTradeSize: number; // Maximum VVV tokens to trade at once
  priceMovementThreshold: number; // % price change to trigger action
  volumeConfirmation: boolean; // Require volume confirmation for trades
  cooldownPeriod: number; // Hours between automated trades
  emergencyStopEnabled: boolean; // Auto-disable on large losses
}

/**
 * Treasury Management Dashboard Data
 */
export interface TreasuryDashboard {
  platformMetrics: EconomicMetrics;
  vvvStrategy: PlatformVVVStrategy;
  vcuCapacity: VCUCapacityData;
  marketData: VVVMarketData;
  riskMetrics: RiskParameters;
  recommendedActions: VVVArbitrageOpportunity[];
  profitProjections: {
    next30Days: number;
    next90Days: number;
    nextYear: number;
  };
}