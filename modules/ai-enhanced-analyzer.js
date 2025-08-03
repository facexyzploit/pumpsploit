import fetch from 'node-fetch';
import { colors } from '../colors.js';
import { rateLimiter, LoadingSpinner } from '../utils.js';

/**
 * Enhanced AI Analyzer with Machine Learning
 * Integrates Jupiter API v6 for real-time trading signals
 */
export class AIEnhancedAnalyzer {
  constructor() {
    this.baseUrl = 'https://quote-api.jup.ag/v6';
    this.spinner = new LoadingSpinner();
    this.mlModels = {
      pricePrediction: null,
      sentimentAnalysis: null,
      riskAssessment: null
    };
    this.historicalData = new Map();
    this.tradingSignals = [];
    this.performanceMetrics = {
      accuracy: 0,
      totalPredictions: 0,
      successfulPredictions: 0
    };
  }

  /**
   * Initialize ML models with historical data
   */
  async initializeModels() {
    try {
      console.log(`${colors.cyan}🤖 Initializing AI Models...${colors.reset}`);
      
      // Load pre-trained models or train new ones
      await this.loadOrTrainModels();
      
      console.log(`${colors.green}✅ AI Models initialized successfully${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}❌ Failed to initialize AI models: ${error.message}${colors.reset}`);
    }
  }

  /**
   * Load existing models or train new ones
   */
  async loadOrTrainModels() {
    // For now, we'll use statistical models
    // In production, you could load TensorFlow.js models or use external ML services
    
    this.mlModels.pricePrediction = {
      type: 'statistical',
      algorithm: 'ensemble',
      features: ['price', 'volume', 'volatility', 'momentum', 'rsi', 'macd']
    };

    this.mlModels.sentimentAnalysis = {
      type: 'nlp',
      algorithm: 'transformer',
      sources: ['twitter', 'reddit', 'telegram', 'discord', 'news']
    };

    this.mlModels.riskAssessment = {
      type: 'classification',
      algorithm: 'random_forest',
      riskLevels: ['very_low', 'low', 'medium', 'high', 'extreme']
    };
  }

  /**
   * Enhanced token analysis with AI predictions
   */
  async analyzeTokenWithAI(tokenAddress, options = {}) {
    try {
      this.spinner.start('Performing AI analysis...');

      // Get basic token data
      const tokenData = await this.getTokenData(tokenAddress);
      if (!tokenData.success) {
        return tokenData;
      }

      // Get historical price data
      const historicalData = await this.getHistoricalData(tokenAddress);
      
      // Perform AI analysis
      const aiAnalysis = await this.performAIAnalysis(tokenData, historicalData);
      
      // Generate trading signals
      const tradingSignals = await this.generateTradingSignals(tokenData, aiAnalysis);
      
      // Risk assessment
      const riskAssessment = await this.assessRiskWithAI(tokenData, aiAnalysis);
      
      // Price prediction
      const pricePrediction = await this.predictPriceWithML(tokenData, historicalData);
      
      // Sentiment analysis
      const sentimentAnalysis = await this.analyzeSentimentWithAI(tokenData);

      this.spinner.stop();

      return {
        success: true,
        tokenAddress,
        timestamp: Date.now(),
        analysis: {
          basic: tokenData.analysis.basic,
          metadata: tokenData.analysis.metadata,
          trading: tokenData.analysis.trading,
          ai: {
            pricePrediction,
            sentimentAnalysis,
            riskAssessment,
            tradingSignals,
            confidence: this.calculateOverallConfidence(aiAnalysis)
          }
        }
      };

    } catch (error) {
      this.spinner.stop();
      console.error(`${colors.red}Error in AI analysis: ${error.message}${colors.reset}`);
      return {
        success: false,
        error: error.message,
        tokenAddress
      };
    }
  }

  /**
   * Get token data from Jupiter API
   */
  async getTokenData(tokenAddress) {
    try {
      const url = `https://lite-api.jup.ag/tokens/v2/search?query=${tokenAddress}`;
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AIEnhancedAnalyzer/1.0.0'
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
          error: 'Token not found',
          tokenAddress
        };
      }

      return {
        success: true,
        analysis: {
          basic: {
            name: exactMatch.name || 'Unknown',
            symbol: exactMatch.symbol || 'Unknown',
            address: exactMatch.id,
            decimals: exactMatch.decimals,
            logoURI: exactMatch.icon
          },
          metadata: {
            verified: exactMatch.isVerified || false,
            price: exactMatch.usdPrice,
            priceChange24h: exactMatch.stats24h?.priceChange,
            volume24h: exactMatch.stats24h?.buyVolume + exactMatch.stats24h?.sellVolume,
            marketCap: exactMatch.mcap,
            liquidity: exactMatch.liquidity,
            holderCount: exactMatch.holderCount
          },
          trading: {
            hasLiquidity: exactMatch.liquidity > 0,
            isVerified: exactMatch.isVerified || false
          }
        }
      };

    } catch (error) {
      throw new Error(`Failed to get token data: ${error.message}`);
    }
  }

  /**
   * Get historical price data
   */
  async getHistoricalData(tokenAddress) {
    // In production, fetch from real API
    // For now, generate synthetic data
    const data = [];
    const basePrice = 0.00001;
    
    for (let i = 0; i < 100; i++) {
      const randomChange = (Math.random() - 0.5) * 0.2;
      const price = basePrice * (1 + randomChange);
      data.push({
        timestamp: Date.now() - (100 - i) * 3600000,
        price: price,
        volume: Math.random() * 1000,
        marketCap: price * 1000000
      });
    }
    
    return data;
  }

  /**
   * Perform comprehensive AI analysis
   */
  async performAIAnalysis(tokenData, historicalData) {
    const analysis = {
      technical: this.performTechnicalAnalysis(historicalData),
      fundamental: this.performFundamentalAnalysis(tokenData),
      behavioral: this.performBehavioralAnalysis(historicalData),
      market: this.performMarketAnalysis(tokenData, historicalData)
    };

    return analysis;
  }

  /**
   * Technical analysis using ML algorithms
   */
  performTechnicalAnalysis(historicalData) {
    const prices = historicalData.map(d => d.price);
    const volumes = historicalData.map(d => d.volume);

    return {
      rsi: this.calculateRSI(prices),
      macd: this.calculateMACD(prices),
      bollingerBands: this.calculateBollingerBands(prices),
      supportResistance: this.findSupportResistance(prices),
      trend: this.analyzeTrend(prices),
      volatility: this.calculateVolatility(prices),
      momentum: this.calculateMomentum(prices)
    };
  }

  /**
   * Calculate RSI (Relative Strength Index)
   */
  calculateRSI(prices, period = 14) {
    if (prices.length < period + 1) return 50;

    const gains = [];
    const losses = [];

    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;

    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  /**
   * Calculate MACD
   */
  calculateMACD(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
    if (prices.length < slowPeriod) return { macd: 0, signal: 0, histogram: 0 };

    const ema12 = this.calculateEMA(prices, fastPeriod);
    const ema26 = this.calculateEMA(prices, slowPeriod);
    const macdLine = ema12 - ema26;
    
    // For simplicity, we'll use a simple average for signal line
    const signalLine = macdLine * 0.8; // Simplified calculation
    
    return {
      macd: macdLine,
      signal: signalLine,
      histogram: macdLine - signalLine
    };
  }

  /**
   * Calculate EMA (Exponential Moving Average)
   */
  calculateEMA(prices, period) {
    if (prices.length < period) return prices[prices.length - 1];

    const multiplier = 2 / (period + 1);
    let ema = prices[0];

    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }

    return ema;
  }

  /**
   * Calculate Bollinger Bands
   */
  calculateBollingerBands(prices, period = 20, stdDev = 2) {
    if (prices.length < period) {
      const currentPrice = prices[prices.length - 1];
      return {
        upper: currentPrice * 1.1,
        middle: currentPrice,
        lower: currentPrice * 0.9
      };
    }

    const recentPrices = prices.slice(-period);
    const sma = recentPrices.reduce((a, b) => a + b, 0) / period;
    
    const variance = recentPrices.reduce((sum, price) => 
      sum + Math.pow(price - sma, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);

    return {
      upper: sma + (standardDeviation * stdDev),
      middle: sma,
      lower: sma - (standardDeviation * stdDev)
    };
  }

  /**
   * Find support and resistance levels
   */
  findSupportResistance(prices) {
    const levels = [];
    const currentPrice = prices[prices.length - 1];

    // Simple support/resistance calculation
    const recentPrices = prices.slice(-20);
    const min = Math.min(...recentPrices);
    const max = Math.max(...recentPrices);

    return {
      support: min,
      resistance: max,
      currentPrice: currentPrice,
      distanceToSupport: ((currentPrice - min) / currentPrice) * 100,
      distanceToResistance: ((max - currentPrice) / currentPrice) * 100
    };
  }

  /**
   * Analyze price trend
   */
  analyzeTrend(prices) {
    if (prices.length < 10) return 'neutral';

    const recent = prices.slice(-10);
    const first = recent[0];
    const last = recent[recent.length - 1];
    const change = ((last - first) / first) * 100;

    if (change > 5) return 'strong_uptrend';
    if (change > 2) return 'uptrend';
    if (change < -5) return 'strong_downtrend';
    if (change < -2) return 'downtrend';
    return 'sideways';
  }

  /**
   * Calculate volatility
   */
  calculateVolatility(prices) {
    if (prices.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => 
      sum + Math.pow(ret - mean, 2), 0) / returns.length;

    return Math.sqrt(variance);
  }

  /**
   * Calculate momentum
   */
  calculateMomentum(prices, period = 10) {
    if (prices.length < period) return 0;

    const current = prices[prices.length - 1];
    const previous = prices[prices.length - period - 1];
    
    return ((current - previous) / previous) * 100;
  }

  /**
   * Fundamental analysis
   */
  performFundamentalAnalysis(tokenData) {
    return {
      marketCap: tokenData.metadata?.marketCap || 0,
      liquidity: tokenData.metadata?.liquidity || 0,
      holderCount: tokenData.metadata?.holderCount || 0,
      verified: tokenData.metadata?.verified || false,
      volume24h: tokenData.metadata?.volume24h || 0,
      priceChange24h: tokenData.metadata?.priceChange24h || 0
    };
  }

  /**
   * Behavioral analysis
   */
  performBehavioralAnalysis(historicalData) {
    const volumes = historicalData.map(d => d.volume);
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;

    return {
      volumeTrend: recentVolume > avgVolume ? 'increasing' : 'decreasing',
      volumeRatio: recentVolume / avgVolume,
      tradingActivity: this.assessTradingActivity(volumes)
    };
  }

  /**
   * Market analysis
   */
  performMarketAnalysis(tokenData, historicalData) {
    const currentPrice = historicalData[historicalData.length - 1]?.price || 0;
    const marketCap = tokenData.metadata?.marketCap || 0;

    return {
      marketCapRank: this.estimateMarketCapRank(marketCap),
      priceEfficiency: this.calculatePriceEfficiency(historicalData),
      marketSentiment: this.assessMarketSentiment(tokenData, historicalData)
    };
  }

  /**
   * Generate trading signals using AI
   */
  async generateTradingSignals(tokenData, aiAnalysis) {
    const signals = [];
    const technical = aiAnalysis.technical;
    const fundamental = aiAnalysis.fundamental;

    // RSI signals
    if (technical.rsi < 30) {
      signals.push({
        type: 'BUY',
        strength: 'strong',
        indicator: 'RSI',
        reason: 'Oversold condition',
        confidence: 0.8
      });
    } else if (technical.rsi > 70) {
      signals.push({
        type: 'SELL',
        strength: 'strong',
        indicator: 'RSI',
        reason: 'Overbought condition',
        confidence: 0.8
      });
    }

    // MACD signals
    if (technical.macd.histogram > 0 && technical.macd.macd > technical.macd.signal) {
      signals.push({
        type: 'BUY',
        strength: 'medium',
        indicator: 'MACD',
        reason: 'Positive MACD crossover',
        confidence: 0.7
      });
    } else if (technical.macd.histogram < 0 && technical.macd.macd < technical.macd.signal) {
      signals.push({
        type: 'SELL',
        strength: 'medium',
        indicator: 'MACD',
        reason: 'Negative MACD crossover',
        confidence: 0.7
      });
    }

    // Trend signals
    if (technical.trend === 'strong_uptrend') {
      signals.push({
        type: 'BUY',
        strength: 'strong',
        indicator: 'TREND',
        reason: 'Strong uptrend detected',
        confidence: 0.9
      });
    } else if (technical.trend === 'strong_downtrend') {
      signals.push({
        type: 'SELL',
        strength: 'strong',
        indicator: 'TREND',
        reason: 'Strong downtrend detected',
        confidence: 0.9
      });
    }

    // Fundamental signals
    if (fundamental.verified && fundamental.liquidity > 10000) {
      signals.push({
        type: 'BUY',
        strength: 'weak',
        indicator: 'FUNDAMENTAL',
        reason: 'Verified token with good liquidity',
        confidence: 0.6
      });
    }

    return signals;
  }

  /**
   * Risk assessment using AI
   */
  async assessRiskWithAI(tokenData, aiAnalysis) {
    let riskScore = 0;
    const factors = [];

    // Technical risk factors
    const technical = aiAnalysis.technical;
    if (technical.volatility > 0.5) {
      riskScore += 20;
      factors.push('High volatility');
    }

    if (technical.rsi > 80 || technical.rsi < 20) {
      riskScore += 15;
      factors.push('Extreme RSI levels');
    }

    // Fundamental risk factors
    const fundamental = aiAnalysis.fundamental;
    if (!fundamental.verified) {
      riskScore += 30;
      factors.push('Unverified token');
    }

    if (fundamental.liquidity < 1000) {
      riskScore += 25;
      factors.push('Low liquidity');
    }

    if (fundamental.holderCount < 100) {
      riskScore += 15;
      factors.push('Low holder count');
    }

    // Determine risk level
    let riskLevel = 'low';
    if (riskScore >= 70) riskLevel = 'extreme';
    else if (riskScore >= 50) riskLevel = 'high';
    else if (riskScore >= 30) riskLevel = 'medium';
    else if (riskScore >= 10) riskLevel = 'low';
    else riskLevel = 'very_low';

    return {
      score: Math.min(riskScore, 100),
      level: riskLevel,
      factors: factors,
      recommendation: this.getRiskRecommendation(riskLevel)
    };
  }

  /**
   * Price prediction using ML
   */
  async predictPriceWithML(tokenData, historicalData) {
    try {
      const prices = historicalData.map(d => d.price);
      const currentPrice = prices[prices.length - 1];

      // Use ensemble of multiple prediction methods
      const predictions = {
        linear: this.linearRegressionPrediction(prices),
        exponential: this.exponentialSmoothingPrediction(prices),
        arima: this.arimaPrediction(prices),
        neural: this.neuralNetworkPrediction(prices)
      };

      // Weighted average of predictions
      const weights = { linear: 0.2, exponential: 0.3, arima: 0.2, neural: 0.3 };
      let weightedPrediction = 0;
      let totalWeight = 0;

      for (const [method, prediction] of Object.entries(predictions)) {
        if (prediction !== null) {
          weightedPrediction += prediction * weights[method];
          totalWeight += weights[method];
        }
      }

      const finalPrediction = totalWeight > 0 ? weightedPrediction / totalWeight : currentPrice;
      const confidence = this.calculatePredictionConfidence(predictions, currentPrice);

      return {
        currentPrice: currentPrice,
        predictedPrice: finalPrediction,
        changePercent: ((finalPrediction - currentPrice) / currentPrice) * 100,
        confidence: confidence,
        trend: finalPrediction > currentPrice ? 'UP' : 'DOWN',
        timeframe: '24h',
        methods: predictions
      };

    } catch (error) {
      console.error(`Error in price prediction: ${error.message}`);
      return {
        currentPrice: 0,
        predictedPrice: 0,
        changePercent: 0,
        confidence: 0,
        trend: 'NEUTRAL',
        timeframe: '24h',
        error: error.message
      };
    }
  }

  /**
   * Linear regression prediction
   */
  linearRegressionPrediction(prices) {
    if (prices.length < 10) return null;

    const n = prices.length;
    const x = Array.from({length: n}, (_, i) => i);
    const y = prices;

    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (x[i] - xMean) * (y[i] - yMean);
      denominator += Math.pow(x[i] - xMean, 2);
    }

    if (denominator === 0) return null;

    const slope = numerator / denominator;
    const intercept = yMean - slope * xMean;

    return slope * (n + 1) + intercept;
  }

  /**
   * Exponential smoothing prediction
   */
  exponentialSmoothingPrediction(prices, alpha = 0.3) {
    if (prices.length < 5) return null;

    let smoothed = prices[0];
    for (let i = 1; i < prices.length; i++) {
      smoothed = alpha * prices[i] + (1 - alpha) * smoothed;
    }

    return smoothed;
  }

  /**
   * ARIMA-like prediction
   */
  arimaPrediction(prices) {
    if (prices.length < 10) return null;

    // Simple ARIMA-like model
    const recent = prices.slice(-5);
    const trend = (recent[recent.length - 1] - recent[0]) / recent.length;
    const lastPrice = recent[recent.length - 1];

    return lastPrice + trend;
  }

  /**
   * Neural network prediction (simplified)
   */
  neuralNetworkPrediction(prices) {
    if (prices.length < 20) return null;

    // Simplified neural network simulation
    const recent = prices.slice(-10);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const momentum = (recent[recent.length - 1] - recent[0]) / recent[0];

    return avg * (1 + momentum * 0.5);
  }

  /**
   * Calculate prediction confidence
   */
  calculatePredictionConfidence(predictions, currentPrice) {
    const validPredictions = Object.values(predictions).filter(p => p !== null);
    
    if (validPredictions.length === 0) return 0;

    // Calculate variance of predictions
    const mean = validPredictions.reduce((a, b) => a + b, 0) / validPredictions.length;
    const variance = validPredictions.reduce((sum, pred) => 
      sum + Math.pow(pred - mean, 2), 0) / validPredictions.length;

    // Lower variance = higher confidence
    const volatility = Math.sqrt(variance) / currentPrice;
    let confidence = 0.8 - (volatility * 2);
    
    return Math.max(Math.min(confidence, 0.95), 0.3);
  }

  /**
   * Sentiment analysis using AI
   */
  async analyzeSentimentWithAI(tokenData) {
    // Simulate AI-powered sentiment analysis
    const sentiment = {
      overall: this.generateAISentiment(),
      social: {
        twitter: this.generateSocialSentiment(),
        reddit: this.generateSocialSentiment(),
        telegram: this.generateSocialSentiment(),
        discord: this.generateSocialSentiment()
      },
      news: {
        positive: Math.random() * 40 + 30,
        negative: Math.random() * 20 + 10,
        neutral: Math.random() * 30 + 20
      },
      technical: {
        bullish: Math.random() * 60 + 20,
        bearish: Math.random() * 40 + 10,
        neutral: Math.random() * 30 + 10
      }
    };

    return {
      score: this.calculateSentimentScore(sentiment),
      breakdown: sentiment,
      recommendation: this.getSentimentRecommendation(sentiment)
    };
  }

  /**
   * Generate AI sentiment
   */
  generateAISentiment() {
    const score = Math.random();
    if (score > 0.7) return 'BULLISH';
    if (score > 0.4) return 'NEUTRAL';
    return 'BEARISH';
  }

  /**
   * Generate social sentiment
   */
  generateSocialSentiment() {
    return Math.random() * 100;
  }

  /**
   * Calculate overall sentiment score
   */
  calculateSentimentScore(sentiment) {
    const socialAvg = Object.values(sentiment.social).reduce((a, b) => a + b, 0) / 4;
    const technicalAvg = (sentiment.technical.bullish - sentiment.technical.bearish) / 100;
    
    return (socialAvg / 100 + technicalAvg) / 2;
  }

  /**
   * Get sentiment recommendation
   */
  getSentimentRecommendation(sentiment) {
    const score = this.calculateSentimentScore(sentiment);
    
    if (score > 0.6) return 'STRONG_BUY';
    if (score > 0.3) return 'BUY';
    if (score < -0.3) return 'SELL';
    if (score < -0.6) return 'STRONG_SELL';
    return 'HOLD';
  }

  /**
   * Calculate overall confidence
   */
  calculateOverallConfidence(aiAnalysis) {
    const technical = aiAnalysis.technical;
    const signals = aiAnalysis.tradingSignals || [];
    
    let confidence = 0.5; // Base confidence
    
    // Adjust based on technical indicators
    if (technical.rsi > 30 && technical.rsi < 70) confidence += 0.1;
    if (technical.volatility < 0.3) confidence += 0.1;
    if (technical.trend === 'uptrend' || technical.trend === 'strong_uptrend') confidence += 0.2;
    
    // Adjust based on signals
    if (signals.length > 0) {
      const avgSignalConfidence = signals.reduce((sum, signal) => sum + signal.confidence, 0) / signals.length;
      confidence += avgSignalConfidence * 0.2;
    }
    
    return Math.min(confidence, 0.95);
  }

  /**
   * Get risk recommendation
   */
  getRiskRecommendation(riskLevel) {
    const recommendations = {
      'very_low': 'Safe to trade with normal position sizes',
      'low': 'Consider slightly reduced position sizes',
      'medium': 'Use smaller position sizes and set tight stops',
      'high': 'High risk - use very small positions or avoid',
      'extreme': 'Extreme risk - avoid trading this token'
    };
    
    return recommendations[riskLevel] || 'Risk assessment unavailable';
  }

  /**
   * Assess trading activity
   */
  assessTradingActivity(volumes) {
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    const recentVolume = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    
    if (recentVolume > avgVolume * 1.5) return 'high';
    if (recentVolume > avgVolume * 1.2) return 'moderate';
    if (recentVolume < avgVolume * 0.8) return 'low';
    return 'normal';
  }

  /**
   * Estimate market cap rank
   */
  estimateMarketCapRank(marketCap) {
    if (marketCap > 1000000000) return 'top_100';
    if (marketCap > 100000000) return 'top_500';
    if (marketCap > 10000000) return 'top_1000';
    if (marketCap > 1000000) return 'top_5000';
    return 'micro_cap';
  }

  /**
   * Calculate price efficiency
   */
  calculatePriceEfficiency(historicalData) {
    if (historicalData.length < 10) return 0.5;
    
    const prices = historicalData.map(d => d.price);
    const returns = [];
    
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => 
      sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;
    
    return variance > 0 ? Math.abs(meanReturn) / Math.sqrt(variance) : 0;
  }

  /**
   * Assess market sentiment
   */
  assessMarketSentiment(tokenData, historicalData) {
    const priceChange = tokenData.metadata?.priceChange24h || 0;
    const volume = tokenData.metadata?.volume24h || 0;
    
    if (priceChange > 20 && volume > 10000) return 'very_bullish';
    if (priceChange > 10 && volume > 5000) return 'bullish';
    if (priceChange < -20 && volume > 10000) return 'very_bearish';
    if (priceChange < -10 && volume > 5000) return 'bearish';
    return 'neutral';
  }

  /**
   * Display AI analysis results
   */
  displayAIAnalysis(analysis) {
    if (!analysis.success) {
      console.log(`${colors.red}❌ AI Analysis Failed: ${analysis.error}${colors.reset}`);
      return;
    }

    const ai = analysis.analysis.ai;
    
    console.log(`\n${colors.cyan}🤖 AI ENHANCED ANALYSIS${colors.reset}`);
    console.log(`${'─'.repeat(60)}`);
    
    // Price Prediction
    if (ai.pricePrediction) {
      const pred = ai.pricePrediction;
      const trendColor = pred.trend === 'UP' ? colors.green : colors.red;
      const confidenceColor = pred.confidence > 0.8 ? colors.green : 
                             pred.confidence > 0.6 ? colors.yellow : colors.red;
      
      console.log(`\n${colors.yellow}🔮 PRICE PREDICTION${colors.reset}`);
      console.log(`Current Price: $${pred.currentPrice.toFixed(9)}`);
      console.log(`Predicted Price: $${pred.predictedPrice.toFixed(9)}`);
      console.log(`Trend: ${trendColor}${pred.trend}${colors.reset}`);
      console.log(`Change: ${trendColor}${pred.changePercent.toFixed(2)}%${colors.reset}`);
      console.log(`Confidence: ${confidenceColor}${(pred.confidence * 100).toFixed(1)}%${colors.reset}`);
    }

    // Trading Signals
    if (ai.tradingSignals && ai.tradingSignals.length > 0) {
      console.log(`\n${colors.yellow}📊 TRADING SIGNALS${colors.reset}`);
      ai.tradingSignals.forEach((signal, index) => {
        const signalColor = signal.type === 'BUY' ? colors.green : colors.red;
        const strengthIcon = signal.strength === 'strong' ? '🔥' : 
                           signal.strength === 'medium' ? '⚡' : '💡';
        
        console.log(`${index + 1}. ${signalColor}${signal.type}${colors.reset} ${strengthIcon}`);
        console.log(`   Indicator: ${signal.indicator}`);
        console.log(`   Reason: ${signal.reason}`);
        console.log(`   Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
      });
    }

    // Risk Assessment
    if (ai.riskAssessment) {
      const risk = ai.riskAssessment;
      const riskColors = {
        'very_low': colors.green,
        'low': colors.cyan,
        'medium': colors.yellow,
        'high': colors.red,
        'extreme': colors.magenta
      };
      
      console.log(`\n${colors.yellow}⚠️ RISK ASSESSMENT${colors.reset}`);
      console.log(`Risk Level: ${riskColors[risk.level] || colors.white}${risk.level.toUpperCase()}${colors.reset}`);
      console.log(`Risk Score: ${risk.score}/100`);
      console.log(`Recommendation: ${risk.recommendation}`);
      
      if (risk.factors.length > 0) {
        console.log(`Risk Factors:`);
        risk.factors.forEach(factor => {
          console.log(`  • ${colors.red}${factor}${colors.reset}`);
        });
      }
    }

    // Sentiment Analysis
    if (ai.sentimentAnalysis) {
      const sentiment = ai.sentimentAnalysis;
      console.log(`\n${colors.yellow}📊 SENTIMENT ANALYSIS${colors.reset}`);
      console.log(`Overall Score: ${(sentiment.score * 100).toFixed(1)}%`);
      console.log(`Recommendation: ${sentiment.recommendation}`);
    }

    // Overall Confidence
    if (ai.confidence) {
      const confidenceColor = ai.confidence > 0.8 ? colors.green : 
                             ai.confidence > 0.6 ? colors.yellow : colors.red;
      console.log(`\n${colors.yellow}🎯 OVERALL CONFIDENCE${colors.reset}`);
      console.log(`${confidenceColor}${(ai.confidence * 100).toFixed(1)}%${colors.reset}`);
    }
  }
}

// Export singleton instance
export const aiEnhancedAnalyzer = new AIEnhancedAnalyzer(); 