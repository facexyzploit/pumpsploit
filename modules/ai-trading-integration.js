import { aiEnhancedAnalyzer } from './ai-enhanced-analyzer.js';
import { autoTrading } from './auto-trading.js';
import { colors } from '../colors.js';
import { LoadingSpinner } from '../utils.js';

/**
 * AI Trading Integration Module
 * Combines AI analysis with automated trading execution
 */
export class AITradingIntegration {
  constructor() {
    this.spinner = new LoadingSpinner();
    this.isRunning = false;
    this.monitoringInterval = null;
    this.tradingQueue = [];
    this.analysisCache = new Map();
    this.performanceMetrics = {
      totalSignals: 0,
      executedTrades: 0,
      successfulTrades: 0,
      totalProfit: 0,
      accuracy: 0
    };
  }

  /**
   * Initialize AI trading integration
   */
  async initialize() {
    try {
      console.log(`${colors.cyan}🤖 Initializing AI Trading Integration...${colors.reset}`);
      
      // Initialize AI analyzer
      await aiEnhancedAnalyzer.initializeModels();
      
      // Initialize auto trading
      await autoTrading.initialize();
      
      console.log(`${colors.green}✅ AI Trading Integration initialized successfully${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}❌ Failed to initialize AI trading integration: ${error.message}${colors.reset}`);
    }
  }

  /**
   * Start AI-powered trading
   */
  async startAITrading(config = {}) {
    try {
      if (this.isRunning) {
        console.log(`${colors.yellow}⚠️ AI trading is already running${colors.reset}`);
        return;
      }

      this.isRunning = true;
      console.log(`${colors.green}🚀 Starting AI-powered trading...${colors.reset}`);

      // Set trading configuration
      if (config.tradingConfig) {
        autoTrading.setTradingConfig(config.tradingConfig);
      }

      // Start monitoring
      this.startMonitoring(config.monitoringInterval || 30000); // Default 30 seconds

      console.log(`${colors.green}✅ AI trading started successfully${colors.reset}`);
    } catch (error) {
      this.isRunning = false;
      console.error(`${colors.red}❌ Failed to start AI trading: ${error.message}${colors.reset}`);
    }
  }

  /**
   * Stop AI trading
   */
  stopAITrading() {
    if (!this.isRunning) {
      console.log(`${colors.yellow}⚠️ AI trading is not running${colors.reset}`);
      return;
    }

    this.isRunning = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log(`${colors.green}✅ AI trading stopped${colors.reset}`);
  }

  /**
   * Start monitoring for trading opportunities
   */
  startMonitoring(interval = 30000) {
    this.monitoringInterval = setInterval(async () => {
      if (!this.isRunning) return;

      try {
        await this.monitorForOpportunities();
      } catch (error) {
        console.error(`${colors.red}Error in monitoring: ${error.message}${colors.reset}`);
      }
    }, interval);

    console.log(`${colors.cyan}📊 Monitoring started (interval: ${interval/1000}s)${colors.reset}`);
  }

  /**
   * Monitor for trading opportunities
   */
  async monitorForOpportunities() {
    try {
      // Get watchlist tokens (in production, this would be from user settings)
      const watchlist = await this.getWatchlistTokens();
      
      for (const tokenAddress of watchlist) {
        try {
          // Perform AI analysis
          const analysis = await this.performAIAnalysis(tokenAddress);
          
          if (!analysis.success) continue;

          // Generate trading signals
          const signals = await this.generateTradingSignals(analysis);
          
          // Execute trades based on signals
          for (const signal of signals) {
            await this.executeSignal(signal, tokenAddress);
          }

        } catch (error) {
          console.error(`${colors.red}Error analyzing token ${tokenAddress}: ${error.message}${colors.reset}`);
        }
      }

      // Monitor existing positions
      await autoTrading.monitorPositions();

    } catch (error) {
      console.error(`${colors.red}Error in opportunity monitoring: ${error.message}${colors.reset}`);
    }
  }

  /**
   * Get watchlist tokens
   */
  async getWatchlistTokens() {
    // In production, this would load from user settings
    // For now, return some popular tokens
    return [
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
      'So11111111111111111111111111111111111111112', // SOL
      'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So', // mSOL
      'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK
      '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj'  // stSOL
    ];
  }

  /**
   * Perform AI analysis on token
   */
  async performAIAnalysis(tokenAddress) {
    try {
      // Check cache first
      const cached = this.analysisCache.get(tokenAddress);
      if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
        return cached.analysis;
      }

      // Perform fresh analysis
      const analysis = await aiEnhancedAnalyzer.analyzeTokenWithAI(tokenAddress);
      
      // Cache the result
      this.analysisCache.set(tokenAddress, {
        analysis,
        timestamp: Date.now()
      });

      return analysis;

    } catch (error) {
      console.error(`Error performing AI analysis: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate trading signals from AI analysis
   */
  async generateTradingSignals(analysis) {
    const signals = [];

    if (!analysis.success || !analysis.analysis.ai) {
      return signals;
    }

    const ai = analysis.analysis.ai;

    // Generate signals based on AI predictions
    if (ai.pricePrediction && ai.pricePrediction.confidence > 0.7) {
      const pred = ai.pricePrediction;
      const changePercent = Math.abs(pred.changePercent);

      if (changePercent > 5) { // Only trade if significant movement expected
        signals.push({
          type: pred.trend === 'UP' ? 'BUY' : 'SELL',
          confidence: pred.confidence,
          amount: this.calculateTradeAmount(analysis.analysis.metadata.price),
          reason: `AI price prediction: ${pred.trend} ${changePercent.toFixed(2)}%`,
          source: 'ai_prediction'
        });
      }
    }

    // Generate signals based on trading signals
    if (ai.tradingSignals) {
      for (const signal of ai.tradingSignals) {
        if (signal.confidence > 0.7) {
          signals.push({
            type: signal.type,
            confidence: signal.confidence,
            amount: this.calculateTradeAmount(analysis.analysis.metadata.price),
            reason: `${signal.indicator}: ${signal.reason}`,
            source: 'technical_analysis'
          });
        }
      }
    }

    // Generate signals based on sentiment
    if (ai.sentimentAnalysis && ai.sentimentAnalysis.score > 0.6) {
      const sentiment = ai.sentimentAnalysis;
      if (sentiment.recommendation === 'STRONG_BUY') {
        signals.push({
          type: 'BUY',
          confidence: sentiment.score,
          amount: this.calculateTradeAmount(analysis.analysis.metadata.price),
          reason: `Strong bullish sentiment: ${(sentiment.score * 100).toFixed(1)}%`,
          source: 'sentiment_analysis'
        });
      } else if (sentiment.recommendation === 'STRONG_SELL') {
        signals.push({
          type: 'SELL',
          confidence: sentiment.score,
          amount: this.calculateTradeAmount(analysis.analysis.metadata.price),
          reason: `Strong bearish sentiment: ${(sentiment.score * 100).toFixed(1)}%`,
          source: 'sentiment_analysis'
        });
      }
    }

    return signals;
  }

  /**
   * Calculate trade amount based on token price and risk management
   */
  calculateTradeAmount(tokenPrice) {
    const config = autoTrading.tradingConfig;
    const maxTradeSize = config.maxTradeSize;
    
    // Calculate amount based on token price
    let amount = maxTradeSize / tokenPrice;
    
    // Apply risk management
    if (config.riskLevel === 'low') {
      amount *= 0.5; // 50% of max size
    } else if (config.riskLevel === 'high') {
      amount *= 1.5; // 150% of max size
    }
    
    return Math.min(amount, maxTradeSize / tokenPrice);
  }

  /**
   * Execute trading signal
   */
  async executeSignal(signal, tokenAddress) {
    try {
      this.performanceMetrics.totalSignals++;

      // Check if auto trading is enabled
      if (!autoTrading.tradingConfig.enableAutoTrading) {
        console.log(`${colors.yellow}⚠️ Auto trading is disabled${colors.reset}`);
        return;
      }

      // Validate signal
      if (!this.validateSignal(signal)) {
        console.log(`${colors.yellow}⚠️ Invalid signal: ${signal.reason}${colors.reset}`);
        return;
      }

      // Check if we should execute this signal
      if (!this.shouldExecuteSignal(signal, tokenAddress)) {
        return;
      }

      console.log(`${colors.cyan}📊 Executing signal: ${signal.type} ${tokenAddress}${colors.reset}`);
      console.log(`${colors.gray}Reason: ${signal.reason}${colors.reset}`);
      console.log(`${colors.gray}Confidence: ${(signal.confidence * 100).toFixed(1)}%${colors.reset}`);

      // Execute the trade
      const tradeResult = await autoTrading.executeTrade(signal, tokenAddress, 'wallet_address');

      if (tradeResult.success) {
        this.performanceMetrics.executedTrades++;
        this.performanceMetrics.successfulTrades++;
        
        const profit = tradeResult.actualOutput - tradeResult.inputAmount;
        this.performanceMetrics.totalProfit += profit;

        console.log(`${colors.green}✅ Trade executed successfully${colors.reset}`);
        console.log(`${colors.gray}Profit: $${profit.toFixed(6)}${colors.reset}`);
        console.log(`${colors.gray}Transaction: ${tradeResult.transactionId}${colors.reset}`);
      } else {
        console.log(`${colors.red}❌ Trade execution failed: ${tradeResult.error}${colors.reset}`);
      }

      // Update accuracy
      this.performanceMetrics.accuracy = this.performanceMetrics.successfulTrades / this.performanceMetrics.executedTrades;

    } catch (error) {
      console.error(`${colors.red}Error executing signal: ${error.message}${colors.reset}`);
    }
  }

  /**
   * Validate trading signal
   */
  validateSignal(signal) {
    if (!signal || !signal.type || !signal.confidence || !signal.amount) {
      return false;
    }

    if (signal.confidence < 0.6) {
      return false;
    }

    if (!['BUY', 'SELL'].includes(signal.type)) {
      return false;
    }

    if (signal.amount <= 0) {
      return false;
    }

    return true;
  }

  /**
   * Determine if signal should be executed
   */
  shouldExecuteSignal(signal, tokenAddress) {
    // Check if we already have a recent signal for this token
    const recentSignals = this.tradingQueue.filter(trade => 
      trade.tokenAddress === tokenAddress && 
      Date.now() - trade.timestamp < 300000 // 5 minutes
    );

    if (recentSignals.length > 0) {
      console.log(`${colors.yellow}⚠️ Recent signal already exists for ${tokenAddress}${colors.reset}`);
      return false;
    }

    // Check performance threshold
    if (this.performanceMetrics.accuracy < 0.4 && this.performanceMetrics.executedTrades > 10) {
      console.log(`${colors.yellow}⚠️ Performance below threshold, skipping signal${colors.reset}`);
      return false;
    }

    return true;
  }

  /**
   * Analyze specific token with AI
   */
  async analyzeToken(tokenAddress) {
    try {
      this.spinner.start('Performing AI analysis...');

      const analysis = await aiEnhancedAnalyzer.analyzeTokenWithAI(tokenAddress);
      
      if (analysis.success) {
        aiEnhancedAnalyzer.displayAIAnalysis(analysis);
        
        // Generate and display signals
        const signals = await this.generateTradingSignals(analysis);
        this.displaySignals(signals, tokenAddress);
      } else {
        console.log(`${colors.red}❌ Analysis failed: ${analysis.error}${colors.reset}`);
      }

      this.spinner.stop();
      return analysis;

    } catch (error) {
      this.spinner.stop();
      console.error(`${colors.red}Error analyzing token: ${error.message}${colors.reset}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Display trading signals
   */
  displaySignals(signals, tokenAddress) {
    if (signals.length === 0) {
      console.log(`${colors.yellow}📊 No trading signals generated for ${tokenAddress}${colors.reset}`);
      return;
    }

    console.log(`\n${colors.cyan}📊 TRADING SIGNALS FOR ${tokenAddress}${colors.reset}`);
    console.log(`${'─'.repeat(60)}`);

    signals.forEach((signal, index) => {
      const signalColor = signal.type === 'BUY' ? colors.green : colors.red;
      const confidenceColor = signal.confidence > 0.8 ? colors.green : 
                             signal.confidence > 0.6 ? colors.yellow : colors.red;
      
      console.log(`${index + 1}. ${signalColor}${signal.type}${colors.reset}`);
      console.log(`   Confidence: ${confidenceColor}${(signal.confidence * 100).toFixed(1)}%${colors.reset}`);
      console.log(`   Amount: ${signal.amount.toFixed(6)}`);
      console.log(`   Reason: ${signal.reason}`);
      console.log(`   Source: ${signal.source}`);
      console.log('');
    });
  }

  /**
   * Display AI trading dashboard
   */
  displayAITradingDashboard() {
    console.log(`\n${colors.cyan}🤖 AI TRADING DASHBOARD${colors.reset}`);
    console.log(`${'─'.repeat(60)}`);
    
    // Performance Metrics
    console.log(`\n${colors.yellow}📊 PERFORMANCE METRICS${colors.reset}`);
    console.log(`Total Signals: ${this.performanceMetrics.totalSignals}`);
    console.log(`Executed Trades: ${this.performanceMetrics.executedTrades}`);
    console.log(`Successful Trades: ${colors.green}${this.performanceMetrics.successfulTrades}${colors.reset}`);
    console.log(`Accuracy: ${(this.performanceMetrics.accuracy * 100).toFixed(1)}%`);
    console.log(`Total Profit: ${this.performanceMetrics.totalProfit > 0 ? colors.green : colors.red}$${this.performanceMetrics.totalProfit.toFixed(6)}${colors.reset}`);
    
    // Status
    console.log(`\n${colors.yellow}📈 TRADING STATUS${colors.reset}`);
    console.log(`AI Trading: ${this.isRunning ? colors.green + 'RUNNING' : colors.red + 'STOPPED'}${colors.reset}`);
    console.log(`Auto Trading: ${autoTrading.tradingConfig.enableAutoTrading ? colors.green + 'ENABLED' : colors.red + 'DISABLED'}${colors.reset}`);
    console.log(`Active Positions: ${autoTrading.activePositions.size}`);
    console.log(`Queue Length: ${this.tradingQueue.length}`);
    
    // Configuration
    console.log(`\n${colors.yellow}⚙️ CONFIGURATION${colors.reset}`);
    console.log(`Risk Level: ${autoTrading.tradingConfig.riskLevel.toUpperCase()}`);
    console.log(`Trading Strategy: ${autoTrading.tradingConfig.tradingStrategy.toUpperCase()}`);
    console.log(`Preferred DEX: ${autoTrading.tradingConfig.preferredDex.toUpperCase()}`);
    console.log(`Max Trade Size: $${autoTrading.tradingConfig.maxTradeSize}`);
    console.log(`Stop Loss: ${autoTrading.tradingConfig.stopLoss * 100}%`);
    console.log(`Take Profit: ${autoTrading.tradingConfig.takeProfit * 100}%`);
  }

  /**
   * Get AI trading statistics
   */
  getAITradingStats() {
    return {
      performance: this.performanceMetrics,
      trading: autoTrading.getTradingStats(),
      status: {
        isRunning: this.isRunning,
        activePositions: autoTrading.activePositions.size,
        queueLength: this.tradingQueue.length
      }
    };
  }

  /**
   * Set AI trading configuration
   */
  setAITradingConfig(config) {
    if (config.tradingConfig) {
      autoTrading.setTradingConfig(config.tradingConfig);
    }
    
    console.log(`${colors.green}✅ AI trading configuration updated${colors.reset}`);
  }

  /**
   * Enable/disable AI trading
   */
  setAITradingEnabled(enabled) {
    if (enabled && !this.isRunning) {
      this.startAITrading();
    } else if (!enabled && this.isRunning) {
      this.stopAITrading();
    }
  }

  /**
   * Clear analysis cache
   */
  clearAnalysisCache() {
    this.analysisCache.clear();
    console.log(`${colors.green}✅ Analysis cache cleared${colors.reset}`);
  }

  /**
   * Export trading data
   */
  exportTradingData() {
    const data = {
      performance: this.performanceMetrics,
      tradingHistory: autoTrading.tradingHistory,
      activePositions: Array.from(autoTrading.activePositions.entries()),
      configuration: autoTrading.tradingConfig,
      timestamp: Date.now()
    };

    return data;
  }
}

// Export singleton instance
export const aiTradingIntegration = new AITradingIntegration(); 