import fetch from 'node-fetch';
import { colors } from '../colors.js';
import { rateLimiter, LoadingSpinner } from '../utils.js';

/**
 * Auto Trading Module with Jupiter API v6 and Raydium Integration
 * Provides automated trading capabilities with AI-driven signals
 */
export class AutoTrading {
  constructor() {
    this.jupiterV6Url = 'https://quote-api.jup.ag/v6';
    this.raydiumUrl = 'https://api.raydium.io/v2';
    this.spinner = new LoadingSpinner();
    this.tradingConfig = {
      maxSlippage: 0.5, // 0.5%
      maxTradeSize: 100, // $100
      minLiquidity: 1000, // $1000
      stopLoss: 0.1, // 10%
      takeProfit: 0.2, // 20%
      maxOpenPositions: 5
    };
    this.activePositions = new Map();
    this.tradingHistory = [];
    this.performanceStats = {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      totalProfit: 0,
      winRate: 0
    };
  }

  /**
   * Initialize auto trading system
   */
  async initialize() {
    try {
      console.log(`${colors.cyan}🤖 Initializing Auto Trading System...${colors.reset}`);
      
      // Load trading configuration
      await this.loadTradingConfig();
      
      // Initialize position tracking
      await this.loadActivePositions();
      
      // Start performance monitoring
      this.startPerformanceMonitoring();
      
      console.log(`${colors.green}✅ Auto Trading System initialized${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}❌ Failed to initialize auto trading: ${error.message}${colors.reset}`);
    }
  }

  /**
   * Load trading configuration
   */
  async loadTradingConfig() {
    // In production, load from settings file
    this.tradingConfig = {
      maxSlippage: 0.5,
      maxTradeSize: 100,
      minLiquidity: 1000,
      stopLoss: 0.1,
      takeProfit: 0.2,
      maxOpenPositions: 5,
      enableAutoTrading: true,
      riskLevel: 'medium', // low, medium, high
      tradingStrategy: 'ai_signals', // ai_signals, momentum, arbitrage
      preferredDex: 'jupiter' // jupiter, raydium, both
    };
  }

  /**
   * Load active positions
   */
  async loadActivePositions() {
    // In production, load from database
    this.activePositions = new Map();
  }

  /**
   * Start performance monitoring
   */
  startPerformanceMonitoring() {
    setInterval(() => {
      this.updatePerformanceStats();
    }, 60000); // Update every minute
  }

  /**
   * Execute trade based on AI signals
   */
  async executeTrade(signal, tokenAddress, walletAddress) {
    try {
      this.spinner.start('Executing trade...');

      // Validate signal
      if (!this.validateSignal(signal)) {
        throw new Error('Invalid trading signal');
      }

      // Check trading conditions
      const conditions = await this.checkTradingConditions(tokenAddress, signal);
      if (!conditions.canTrade) {
        throw new Error(`Trading conditions not met: ${conditions.reason}`);
      }

      // Get quote from Jupiter
      const quote = await this.getJupiterQuote(tokenAddress, signal.type, signal.amount);
      if (!quote.success) {
        throw new Error(`Failed to get quote: ${quote.error}`);
      }

      // Execute the trade
      const tradeResult = await this.executeJupiterSwap(quote, walletAddress);
      
      // Record the trade
      await this.recordTrade(signal, tradeResult, tokenAddress);

      this.spinner.stop();
      return tradeResult;

    } catch (error) {
      this.spinner.stop();
      console.error(`${colors.red}Trade execution failed: ${error.message}${colors.reset}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate trading signal
   */
  validateSignal(signal) {
    if (!signal || !signal.type || !signal.confidence) {
      return false;
    }

    if (signal.confidence < 0.6) {
      return false;
    }

    if (!['BUY', 'SELL'].includes(signal.type)) {
      return false;
    }

    return true;
  }

  /**
   * Check trading conditions
   */
  async checkTradingConditions(tokenAddress, signal) {
    try {
      // Check if we have too many open positions
      if (this.activePositions.size >= this.tradingConfig.maxOpenPositions) {
        return {
          canTrade: false,
          reason: 'Maximum open positions reached'
        };
      }

      // Get token data
      const tokenData = await this.getTokenData(tokenAddress);
      if (!tokenData.success) {
        return {
          canTrade: false,
          reason: 'Failed to get token data'
        };
      }

      // Check liquidity
      if (tokenData.analysis.metadata.liquidity < this.tradingConfig.minLiquidity) {
        return {
          canTrade: false,
          reason: 'Insufficient liquidity'
        };
      }

      // Check if token is verified (optional)
      if (!tokenData.analysis.metadata.verified && this.tradingConfig.riskLevel === 'low') {
        return {
          canTrade: false,
          reason: 'Token not verified'
        };
      }

      return {
        canTrade: true,
        reason: 'All conditions met'
      };

    } catch (error) {
      return {
        canTrade: false,
        reason: `Error checking conditions: ${error.message}`
      };
    }
  }

  /**
   * Get Jupiter quote for swap
   */
  async getJupiterQuote(tokenAddress, tradeType, amount) {
    try {
      const inputMint = tradeType === 'BUY' ? 'So11111111111111111111111111111111111111112' : tokenAddress; // SOL
      const outputMint = tradeType === 'BUY' ? tokenAddress : 'So11111111111111111111111111111111111111112'; // SOL
      
      const url = `${this.jupiterV6Url}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${this.tradingConfig.maxSlippage * 100}`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AutoTrading/1.0.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        quote: data,
        inputMint,
        outputMint,
        amount,
        expectedOutput: data.outAmount,
        priceImpact: data.priceImpactPct,
        routes: data.routes
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute Jupiter swap
   */
  async executeJupiterSwap(quote, walletAddress) {
    try {
      // In production, this would use @solana/web3.js to sign and send transaction
      // For now, we'll simulate the swap
      
      const swapResult = {
        success: true,
        transactionId: this.generateTransactionId(),
        inputAmount: quote.amount,
        outputAmount: quote.expectedOutput,
        priceImpact: quote.priceImpact,
        timestamp: Date.now(),
        status: 'completed'
      };

      // Simulate some slippage
      const actualOutput = quote.expectedOutput * (1 - (Math.random() * 0.02)); // 0-2% slippage
      swapResult.actualOutput = actualOutput;
      swapResult.slippage = ((quote.expectedOutput - actualOutput) / quote.expectedOutput) * 100;

      return swapResult;

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute Raydium swap (alternative to Jupiter)
   */
  async executeRaydiumSwap(tokenAddress, tradeType, amount) {
    try {
      // Raydium API integration
      const url = `${this.raydiumUrl}/swap`;
      
      const swapData = {
        inputMint: tradeType === 'BUY' ? 'So11111111111111111111111111111111111111112' : tokenAddress,
        outputMint: tradeType === 'BUY' ? tokenAddress : 'So11111111111111111111111111111111111111112',
        amount: amount,
        slippage: this.tradingConfig.maxSlippage
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(swapData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        transactionId: data.txid,
        inputAmount: amount,
        outputAmount: data.outputAmount,
        priceImpact: data.priceImpact,
        timestamp: Date.now(),
        status: 'completed',
        dex: 'raydium'
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Record trade in history
   */
  async recordTrade(signal, tradeResult, tokenAddress) {
    const trade = {
      id: this.generateTradeId(),
      tokenAddress,
      signal: signal,
      result: tradeResult,
      timestamp: Date.now(),
      status: tradeResult.success ? 'completed' : 'failed'
    };

    this.tradingHistory.push(trade);
    
    if (tradeResult.success) {
      // Update active positions
      if (signal.type === 'BUY') {
        this.activePositions.set(trade.id, {
          tokenAddress,
          entryPrice: tradeResult.outputAmount / tradeResult.inputAmount,
          amount: tradeResult.outputAmount,
          timestamp: Date.now(),
          stopLoss: tradeResult.outputAmount * (1 - this.tradingConfig.stopLoss),
          takeProfit: tradeResult.outputAmount * (1 + this.tradingConfig.takeProfit)
        });
      } else if (signal.type === 'SELL') {
        // Close position
        this.activePositions.delete(trade.id);
      }
    }

    // Update performance stats
    this.updatePerformanceStats();
  }

  /**
   * Monitor positions and execute stop loss/take profit
   */
  async monitorPositions() {
    for (const [positionId, position] of this.activePositions) {
      try {
        // Get current price
        const currentPrice = await this.getCurrentPrice(position.tokenAddress);
        
        // Check stop loss
        if (currentPrice <= position.stopLoss) {
          console.log(`${colors.red}🛑 Stop loss triggered for position ${positionId}${colors.reset}`);
          await this.closePosition(positionId, 'stop_loss');
        }
        
        // Check take profit
        else if (currentPrice >= position.takeProfit) {
          console.log(`${colors.green}🎯 Take profit triggered for position ${positionId}${colors.reset}`);
          await this.closePosition(positionId, 'take_profit');
        }
        
      } catch (error) {
        console.error(`${colors.red}Error monitoring position ${positionId}: ${error.message}${colors.reset}`);
      }
    }
  }

  /**
   * Close position
   */
  async closePosition(positionId, reason) {
    try {
      const position = this.activePositions.get(positionId);
      if (!position) return;

      // Execute sell order
      const sellSignal = {
        type: 'SELL',
        confidence: 0.9,
        amount: position.amount,
        reason: reason
      };

      const tradeResult = await this.executeTrade(sellSignal, position.tokenAddress, 'wallet_address');
      
      if (tradeResult.success) {
        this.activePositions.delete(positionId);
        console.log(`${colors.green}✅ Position ${positionId} closed successfully${colors.reset}`);
      }

    } catch (error) {
      console.error(`${colors.red}Error closing position ${positionId}: ${error.message}${colors.reset}`);
    }
  }

  /**
   * Get current token price
   */
  async getCurrentPrice(tokenAddress) {
    try {
      const tokenData = await this.getTokenData(tokenAddress);
      return tokenData.analysis.metadata.price || 0;
    } catch (error) {
      console.error(`Error getting current price: ${error.message}`);
      return 0;
    }
  }

  /**
   * Get token data
   */
  async getTokenData(tokenAddress) {
    try {
      const url = `https://lite-api.jup.ag/tokens/v2/search?query=${tokenAddress}`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AutoTrading/1.0.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const exactMatch = data.find(token => 
        token.id?.toLowerCase() === tokenAddress.toLowerCase()
      );

      if (!exactMatch) {
        return {
          success: false,
          error: 'Token not found'
        };
      }

      return {
        success: true,
        analysis: {
          metadata: {
            price: exactMatch.usdPrice,
            liquidity: exactMatch.liquidity,
            verified: exactMatch.isVerified || false
          }
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update performance statistics
   */
  updatePerformanceStats() {
    const completedTrades = this.tradingHistory.filter(trade => 
      trade.status === 'completed' && trade.result.success
    );

    this.performanceStats.totalTrades = completedTrades.length;
    this.performanceStats.winningTrades = completedTrades.filter(trade => 
      trade.result.actualOutput > trade.result.inputAmount
    ).length;
    this.performanceStats.losingTrades = this.performanceStats.totalTrades - this.performanceStats.winningTrades;
    this.performanceStats.winRate = this.performanceStats.totalTrades > 0 ? 
      this.performanceStats.winningTrades / this.performanceStats.totalTrades : 0;

    // Calculate total profit
    this.performanceStats.totalProfit = completedTrades.reduce((total, trade) => {
      const profit = trade.result.actualOutput - trade.result.inputAmount;
      return total + profit;
    }, 0);
  }

  /**
   * Generate transaction ID
   */
  generateTransactionId() {
    return 'tx_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  /**
   * Generate trade ID
   */
  generateTradeId() {
    return 'trade_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  /**
   * Display trading dashboard
   */
  displayTradingDashboard() {
    console.log(`\n${colors.cyan}🤖 AUTO TRADING DASHBOARD${colors.reset}`);
    console.log(`${'─'.repeat(60)}`);
    
    // Performance Stats
    console.log(`\n${colors.yellow}📊 PERFORMANCE STATISTICS${colors.reset}`);
    console.log(`Total Trades: ${this.performanceStats.totalTrades}`);
    console.log(`Winning Trades: ${colors.green}${this.performanceStats.winningTrades}${colors.reset}`);
    console.log(`Losing Trades: ${colors.red}${this.performanceStats.losingTrades}${colors.reset}`);
    console.log(`Win Rate: ${(this.performanceStats.winRate * 100).toFixed(1)}%`);
    console.log(`Total Profit: ${this.performanceStats.totalProfit > 0 ? colors.green : colors.red}$${this.performanceStats.totalProfit.toFixed(2)}${colors.reset}`);
    
    // Active Positions
    console.log(`\n${colors.yellow}📈 ACTIVE POSITIONS${colors.reset}`);
    if (this.activePositions.size === 0) {
      console.log(`${colors.gray}No active positions${colors.reset}`);
    } else {
      this.activePositions.forEach((position, id) => {
        console.log(`Position ${id}: ${position.tokenAddress}`);
        console.log(`  Amount: ${position.amount.toFixed(6)}`);
        console.log(`  Entry Price: $${position.entryPrice.toFixed(9)}`);
        console.log(`  Stop Loss: $${position.stopLoss.toFixed(9)}`);
        console.log(`  Take Profit: $${position.takeProfit.toFixed(9)}`);
      });
    }
    
    // Trading Configuration
    console.log(`\n${colors.yellow}⚙️ TRADING CONFIGURATION${colors.reset}`);
    console.log(`Max Slippage: ${this.tradingConfig.maxSlippage}%`);
    console.log(`Max Trade Size: $${this.tradingConfig.maxTradeSize}`);
    console.log(`Min Liquidity: $${this.tradingConfig.minLiquidity}`);
    console.log(`Stop Loss: ${this.tradingConfig.stopLoss * 100}%`);
    console.log(`Take Profit: ${this.tradingConfig.takeProfit * 100}%`);
    console.log(`Max Open Positions: ${this.tradingConfig.maxOpenPositions}`);
    console.log(`Risk Level: ${this.tradingConfig.riskLevel.toUpperCase()}`);
    console.log(`Trading Strategy: ${this.tradingConfig.tradingStrategy.toUpperCase()}`);
    console.log(`Preferred DEX: ${this.tradingConfig.preferredDex.toUpperCase()}`);
  }

  /**
   * Display recent trading history
   */
  displayTradingHistory(limit = 10) {
    console.log(`\n${colors.cyan}📋 RECENT TRADING HISTORY${colors.reset}`);
    console.log(`${'─'.repeat(60)}`);
    
    const recentTrades = this.tradingHistory
      .filter(trade => trade.status === 'completed')
      .slice(-limit)
      .reverse();
    
    if (recentTrades.length === 0) {
      console.log(`${colors.gray}No completed trades${colors.reset}`);
      return;
    }
    
    recentTrades.forEach((trade, index) => {
      const signalColor = trade.signal.type === 'BUY' ? colors.green : colors.red;
      const profit = trade.result.actualOutput - trade.result.inputAmount;
      const profitColor = profit > 0 ? colors.green : colors.red;
      
      console.log(`${index + 1}. ${signalColor}${trade.signal.type}${colors.reset} ${trade.tokenAddress}`);
      console.log(`   Amount: ${trade.result.inputAmount.toFixed(6)}`);
      console.log(`   Output: ${trade.result.actualOutput.toFixed(6)}`);
      console.log(`   Profit: ${profitColor}$${profit.toFixed(6)}${colors.reset}`);
      console.log(`   Slippage: ${trade.result.slippage?.toFixed(2)}%`);
      console.log(`   Time: ${new Date(trade.timestamp).toLocaleString()}`);
      console.log('');
    });
  }

  /**
   * Set trading configuration
   */
  setTradingConfig(config) {
    this.tradingConfig = { ...this.tradingConfig, ...config };
    console.log(`${colors.green}✅ Trading configuration updated${colors.reset}`);
  }

  /**
   * Enable/disable auto trading
   */
  setAutoTradingEnabled(enabled) {
    this.tradingConfig.enableAutoTrading = enabled;
    console.log(`${colors.green}✅ Auto trading ${enabled ? 'enabled' : 'disabled'}${colors.reset}`);
  }

  /**
   * Get trading statistics
   */
  getTradingStats() {
    return {
      performance: this.performanceStats,
      activePositions: this.activePositions.size,
      totalHistory: this.tradingHistory.length,
      config: this.tradingConfig
    };
  }
}

// Export singleton instance
export const autoTrading = new AutoTrading(); 