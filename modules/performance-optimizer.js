import { colors } from '../colors.js';
import { logToFile } from '../logger.js';

/**
 * Performance Optimizer - Handles caching, batching, and optimization
 */
export class PerformanceOptimizer {
  constructor() {
    this.caches = new Map();
    this.requestQueue = [];
    this.batchSize = 10;
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.connectionPool = new Map();
    this.performanceMetrics = new Map();
    this.cleanupInterval = null;
    
    // Initialize default caches
    this.createCache('tokenInfo', 30000); // 30 seconds
    this.createCache('tokenPrices', 30000); // 30 seconds
    this.createCache('walletBalances', 60000); // 1 minute
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Smart caching with TTL and automatic cleanup
   */
  createCache(name, ttl = 30000) {
    const cache = {
      data: new Map(),
      ttl,
      lastCleanup: Date.now(),
      hits: 0,
      misses: 0
    };
    
    this.caches.set(name, cache);
    return cache;
  }

  /**
   * Get cached data with automatic TTL cleanup
   */
  getCached(cacheName, key) {
    const cache = this.caches.get(cacheName);
    if (!cache) return null;

    const item = cache.data.get(key);
    if (!item) {
      cache.misses++;
      return null;
    }

    if (Date.now() - item.timestamp > cache.ttl) {
      cache.data.delete(key);
      cache.misses++;
      return null;
    }

    cache.hits++;
    return item.data;
  }

  /**
   * Set cached data with timestamp
   */
  setCached(cacheName, key, data) {
    const cache = this.caches.get(cacheName);
    if (!cache) return;

    cache.data.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Batch multiple requests for better performance
   */
  async batchRequests(requests, batchSize = this.batchSize) {
    const results = [];
    const batches = [];
    
    // Split requests into batches
    for (let i = 0; i < requests.length; i += batchSize) {
      batches.push(requests.slice(i, i + batchSize));
    }

    // Process batches with concurrency control
    for (const batch of batches) {
      const batchPromises = batch.map(async (request) => {
        return await this.executeWithRetry(request);
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Execute request with automatic retry and error handling
   */
  async executeWithRetry(operation, retries = this.maxRetries) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const startTime = Date.now();
        const result = await operation();
        const duration = Date.now() - startTime;
        
        this.recordPerformance(operation.name || 'unknown', duration);
        return result;
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        
        // Exponential backoff
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        await this.sleep(delay);
      }
    }
  }

  /**
   * Connection pooling for RPC endpoints
   */
  async getConnection(endpoint) {
    if (this.connectionPool.has(endpoint)) {
      const connection = this.connectionPool.get(endpoint);
      if (connection.lastUsed && Date.now() - connection.lastUsed < 60000) {
        connection.lastUsed = Date.now();
        return connection.connection;
      }
    }

    // Create new connection
    const { Connection } = await import('@solana/web3.js');
    const connection = new Connection(endpoint, 'confirmed');
    
    this.connectionPool.set(endpoint, {
      connection,
      lastUsed: Date.now()
    });

    return connection;
  }

  /**
   * Optimized token info fetching with caching
   */
  async getOptimizedTokenInfo(mintAddress) {
    const cacheKey = `token_info_${mintAddress}`;
    const cached = this.getCached('tokenInfo', cacheKey);
    
    if (cached) {
      return cached;
    }

    const tokenInfo = await this.executeWithRetry(async () => {
      // Your existing token info fetching logic here
      return await this.fetchTokenInfo(mintAddress);
    });

    this.setCached('tokenInfo', cacheKey, tokenInfo);
    return tokenInfo;
  }

  /**
   * Batch token price fetching
   */
  async getBatchTokenPrices(mintAddresses) {
    const requests = mintAddresses.map(mint => ({
      name: `price_${mint}`,
      operation: async () => this.fetchTokenPrice(mint)
    }));

    const results = await this.batchRequests(requests);
    return results.map((result, index) => ({
      mint: mintAddresses[index],
      price: result.status === 'fulfilled' ? result.value : null,
      error: result.status === 'rejected' ? result.reason : null
    }));
  }

  /**
   * Optimized wallet balance fetching
   */
  async getOptimizedWalletBalances(walletAddress) {
    const cacheKey = `balances_${walletAddress}`;
    const cached = this.getCached('walletBalances', cacheKey);
    
    if (cached) {
      return cached;
    }

    const balances = await this.executeWithRetry(async () => {
      return await this.fetchWalletBalances(walletAddress);
    });

    this.setCached('walletBalances', cacheKey, balances);
    return balances;
  }

  /**
   * Performance monitoring
   */
  recordPerformance(operation, duration) {
    if (!this.performanceMetrics.has(operation)) {
      this.performanceMetrics.set(operation, {
        count: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        avgDuration: 0
      });
    }

    const metrics = this.performanceMetrics.get(operation);
    metrics.count++;
    metrics.totalDuration += duration;
    metrics.minDuration = Math.min(metrics.minDuration, duration);
    metrics.maxDuration = Math.max(metrics.maxDuration, duration);
    metrics.avgDuration = metrics.totalDuration / metrics.count;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats() {
    const stats = {};
    for (const [operation, metrics] of this.performanceMetrics) {
      stats[operation] = {
        ...metrics,
        cacheHits: this.caches.get('tokenInfo')?.hits || 0,
        cacheMisses: this.caches.get('tokenInfo')?.misses || 0
      };
    }
    return stats;
  }

  /**
   * Memory cleanup
   */
  cleanup() {
    const now = Date.now();
    
    // Cleanup caches
    for (const [name, cache] of this.caches) {
      for (const [key, item] of cache.data) {
        if (now - item.timestamp > cache.ttl) {
          cache.data.delete(key);
        }
      }
    }

    // Cleanup connection pool
    for (const [endpoint, connection] of this.connectionPool) {
      if (now - connection.lastUsed > 300000) { // 5 minutes
        this.connectionPool.delete(endpoint);
      }
    }

    // Cleanup performance metrics (keep last 1000 operations)
    for (const [operation, metrics] of this.performanceMetrics) {
      if (metrics.count > 1000) {
        metrics.count = Math.floor(metrics.count / 2);
        metrics.totalDuration = Math.floor(metrics.totalDuration / 2);
      }
    }
  }

  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Cleanup every minute
  }

  /**
   * Stop cleanup interval
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Utility sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Display performance statistics
   */
  displayPerformanceStats() {
    console.log(`${colors.cyan}📊 Performance Statistics:${colors.reset}`);
    console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    
    const stats = this.getPerformanceStats();
    for (const [operation, metrics] of Object.entries(stats)) {
      console.log(`${colors.yellow}${operation}:${colors.reset}`);
      console.log(`  📈 Count: ${metrics.count}`);
      console.log(`  ⏱️  Avg: ${metrics.avgDuration.toFixed(2)}ms`);
      console.log(`  🚀 Min: ${metrics.minDuration}ms`);
      console.log(`  🐌 Max: ${metrics.maxDuration}ms`);
      if (metrics.cacheHits !== undefined) {
        const hitRate = metrics.cacheHits / (metrics.cacheHits + metrics.cacheMisses) * 100;
        console.log(`  💾 Cache Hit Rate: ${hitRate.toFixed(1)}%`);
      }
      console.log('');
    }
  }

  /**
   * Optimized error handling with recovery
   */
  async handleError(error, context, recoveryAction = null) {
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now()
    };

    // Log error
    logToFile('error', JSON.stringify(errorInfo));

    // Try recovery action if provided
    if (recoveryAction) {
      try {
        await recoveryAction();
        console.log(`${colors.green}✅ Recovery successful${colors.reset}`);
      } catch (recoveryError) {
        console.error(`${colors.red}❌ Recovery failed: ${recoveryError.message}${colors.reset}`);
      }
    }

    // Return structured error
    return {
      success: false,
      error: error.message,
      context,
      recoverable: !!recoveryAction
    };
  }
}

// Create global instance
export const performanceOptimizer = new PerformanceOptimizer();

// Performance optimization for trending tokens
export class TrendingPerformanceOptimizer {
  constructor() {
    this.jupiterCache = new Map();
    this.displayCache = new Map();
    this.cacheDuration = 30000; // 30 seconds
    this.parallelLimit = 3; // Max concurrent Jupiter API calls
    this.requestQueue = [];
    this.isProcessing = false;
  }

  // Optimized Jupiter API call with caching
  async getJupiterDataOptimized(mintAddress) {
    const cacheKey = `jupiter_${mintAddress}`;
    const cached = this.jupiterCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheDuration) {
      return cached.data;
    }

    // Add to request queue if too many concurrent requests
    if (this.requestQueue.length >= this.parallelLimit) {
      return null; // Skip this request to avoid overwhelming the API
    }

    try {
      const { checkJupiterTokenRealtime } = await import('../bitquery-stream.js');
      const response = await checkJupiterTokenRealtime(mintAddress);
      
      if (response.success && response.data) {
        this.jupiterCache.set(cacheKey, {
          data: response.data,
          timestamp: Date.now()
        });
        return response.data;
      }
    } catch (error) {
      // Silent fail - return null to use BitQuery data only
    }
    
    return null;
  }

  // Batch process Jupiter data for multiple tokens
  async batchProcessJupiterData(tokenMetrics) {
    const promises = tokenMetrics.map(async (token) => {
      const jupiterData = await this.getJupiterDataOptimized(token.mintAddress);
      return {
        ...token,
        jupiterData
      };
    });

    // Process in batches to avoid overwhelming the API
    const results = [];
    for (let i = 0; i < promises.length; i += this.parallelLimit) {
      const batch = promises.slice(i, i + this.parallelLimit);
      const batchResults = await Promise.allSettled(batch);
      
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Use token without Jupiter data
          results.push(tokenMetrics[i + index]);
        }
      });
    }

    return results;
  }

  // Optimized trending token processing
  async processTrendingTokensOptimized(recentTrades, previousTrades) {
    // Group trades by token efficiently
    const tokenGroups = new Map();
    
    // Process recent trades
    recentTrades.forEach(trade => {
      const mintAddress = trade.Trade?.Buy?.Currency?.MintAddress;
      if (mintAddress) {
        if (!tokenGroups.has(mintAddress)) {
          tokenGroups.set(mintAddress, {
            recent: [],
            previous: [],
            token: trade.Trade.Buy.Currency
          });
        }
        tokenGroups.get(mintAddress).recent.push(trade);
      }
    });
    
    // Process previous trades
    previousTrades.forEach(trade => {
      const mintAddress = trade.Trade?.Buy?.Currency?.MintAddress;
      if (mintAddress && tokenGroups.has(mintAddress)) {
        tokenGroups.get(mintAddress).previous.push(trade);
      }
    });
    
    // Calculate metrics efficiently
    const tokenMetrics = [];
    for (const [mintAddress, data] of tokenGroups) {
      const { recent, previous, token } = data;
      
      // Quick volume calculation
      const recentVolume = recent.reduce((sum, t) => sum + (t.Trade?.Buy?.AmountInUSD || 0), 0);
      const previousVolume = previous.reduce((sum, t) => sum + (t.Trade?.Buy?.AmountInUSD || 0), 0);
      const volumeChange = previousVolume > 0 ? ((recentVolume - previousVolume) / previousVolume) * 100 : 0;
      
      // Quick price calculation
      const recentPrices = recent.map(t => t.Trade?.Buy?.PriceInUSD || 0).filter(p => p > 0);
      const previousPrices = previous.map(t => t.Trade?.Buy?.PriceInUSD || 0).filter(p => p > 0);
      
      const currentPrice = recentPrices[0] || 0;
      const oldPrice = previousPrices[0] || currentPrice;
      const priceChange = oldPrice > 0 ? ((currentPrice - oldPrice) / oldPrice) * 100 : 0;
      
      // Quick frequency calculation
      const recentFreq = recent.length / 3; // trades per minute in last 3 min
      const previousFreq = previous.length / 3; // trades per minute in previous 3 min
      const freqChange = previousFreq > 0 ? ((recentFreq - previousFreq) / previousFreq) * 100 : 0;
      
      tokenMetrics.push({
        mintAddress,
        token,
        recentTrade: recent[0],
        metrics: {
          currentPrice,
          priceChange,
          recentVolume,
          volumeChange,
          tradeFreq: recentFreq,
          freqChange,
          momentum: (volumeChange * 0.4) + (priceChange * 0.4) + (freqChange * 0.2)
        }
      });
    }
    
    // Sort by momentum for best performance
    tokenMetrics.sort((a, b) => b.metrics.momentum - a.metrics.momentum);
    
    // Take top 10 for display
    const topTokens = tokenMetrics.slice(0, 10);
    
    // Batch process Jupiter data for top tokens
    const processedTokens = await this.batchProcessJupiterData(topTokens);
    
    // Add Jupiter data to metrics
    return processedTokens.map(token => ({
      ...token,
      metrics: {
        ...token.metrics,
        jupiter: token.jupiterData || null
      }
    }));
  }

  // Clear old cache entries
  cleanupCache() {
    const now = Date.now();
    
    // Clean Jupiter cache
    for (const [key, value] of this.jupiterCache.entries()) {
      if (now - value.timestamp > this.cacheDuration) {
        this.jupiterCache.delete(key);
      }
    }
    
    // Clean display cache
    for (const [key, value] of this.displayCache.entries()) {
      if (now - value.timestamp > this.cacheDuration) {
        this.displayCache.delete(key);
      }
    }
  }

  // Get cached display or create new one
  getCachedDisplay(index, trendingData) {
    const cacheKey = `display_${index}_${trendingData.length}`;
    const cached = this.displayCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheDuration) {
      return cached.display;
    }
    
    return null;
  }

  // Cache display
  cacheDisplay(index, trendingData, display) {
    const cacheKey = `display_${index}_${trendingData.length}`;
    this.displayCache.set(cacheKey, {
      display,
      timestamp: Date.now()
    });
  }
}

// Export singleton instance
export const trendingOptimizer = new TrendingPerformanceOptimizer();
