import { colors } from './colors.js';

export function showLogo() {
  console.log(`
${colors.cyan}╔══════════════════════════════════════════════════════════════╗
║${colors.reset}${colors.bright}${colors.white}                    🚀 PumpTool v2.0.0 🚀                    ${colors.reset}${colors.cyan}║
║${colors.reset}${colors.dim}${colors.white}              Advanced Solana Token Trading Tool              ${colors.reset}${colors.cyan}║
║${colors.reset}${colors.dim}${colors.white}                 Jupiter API Integration                      ${colors.reset}${colors.cyan}║
║${colors.reset}${colors.dim}${colors.white}                    AI-Powered Analytics                       ${colors.reset}${colors.cyan}║
╚══════════════════════════════════════════════════════════════╝${colors.reset}
  `);
}

export function verifyTradeTime(tradeTime) {
  try {
    if (!tradeTime) {
      console.error(`${colors.yellow}verifyTradeTime: tradeTime is undefined or null${colors.reset}`);
      return {
        isRecent: false,
        diff: 999999,
        formattedDiff: 'unknown'
      };
    }
    
    const now = Date.now();
    const tradeTimestamp = new Date(tradeTime).getTime();
    
    if (isNaN(tradeTimestamp)) {
      console.error(`${colors.yellow}verifyTradeTime: Invalid tradeTime format: ${tradeTime}${colors.reset}`);
      return {
        isRecent: false,
        diff: 999999,
        formattedDiff: 'invalid'
      };
    }
    
    const timeDiff = now - tradeTimestamp;
    const maxDiff = 5 * 60 * 1000; // 5 minutes max difference

    return {
      isRecent: timeDiff <= maxDiff,
      diff: Math.floor(timeDiff / 1000), // difference in seconds
      formattedDiff: formatTimeDiff(timeDiff)
    };
  } catch (error) {
    console.error(`${colors.red}Error in verifyTradeTime: ${error.message}${colors.reset}`);
    return {
      isRecent: false,
      diff: 999999,
      formattedDiff: 'error'
    };
  }
}

export function formatTimeDiff(diff) {
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export const rateLimiter = {
  lastCall: 1,
  minInterval: 2000, // 2 seconds between calls to avoid rate limiting
  consecutiveFailures: 0,
  maxRetries: 3,
  
  async wait() {
    const now = Date.now();
    const timeToWait = Math.max(0, this.lastCall + this.minInterval - now);
    if (timeToWait > 0) {
      await new Promise(resolve => setTimeout(resolve, timeToWait));
    }
    this.lastCall = Date.now();
  },
  
  async waitWithBackoff() {
    // Exponential backoff based on consecutive failures
    const backoffMultiplier = Math.min(2 ** this.consecutiveFailures, 8);
    const waitTime = this.minInterval * backoffMultiplier;
    
    console.log(`${colors.yellow}⏳ Rate limiting: waiting ${waitTime/1000}s before next request${colors.reset}`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    this.lastCall = Date.now();
  },
  
  recordFailure() {
    this.consecutiveFailures++;
    this.minInterval = Math.min(this.minInterval * 1.5, 10000); // Increase interval up to 10s
  },
  
  recordSuccess() {
    this.consecutiveFailures = 0;
    this.minInterval = Math.max(this.minInterval * 0.9, 2000); // Gradually decrease back to 2s
  }
};

// Add loading animation utility
export class LoadingSpinner {
  constructor() {
    this.frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    this.interval = null;
    this.currentFrame = 0;
    this.message = '';
  }

  start(message = 'Loading') {
    this.message = message;
    this.currentFrame = 0;
    this.interval = setInterval(() => {
      process.stdout.write('\r' + this.frames[this.currentFrame] + ' ' + this.message);
      this.currentFrame = (this.currentFrame + 1) % this.frames.length;
    }, 80);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      process.stdout.write('\r' + ' '.repeat(this.message.length + 2) + '\r');
    }
  }
}

// Add formatNumber function
export function formatNumber(num) {
  if (num === undefined || num === null) return 'N/A';
  
  // Handle very small numbers
  if (num < 0.000001) {
    return num.toExponential(6);
  }
  
  // Handle regular numbers
  if (num >= 1) {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }
  
  // Handle decimals between 0 and 1
  return num.toFixed(6);
}

// Add time difference helper
export function getTimeDiff(timestamp) {
  const now = new Date();
  const time = new Date(timestamp);
  const diff = Math.floor((now - time) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Add utility function to display menu items in 3 columns
export function displayMenuInColumns(menuItems, columnWidth = 30) {
  const itemsPerColumn = Math.ceil(menuItems.length / 3);
  const column1 = menuItems.slice(0, itemsPerColumn);
  const column2 = menuItems.slice(itemsPerColumn, itemsPerColumn * 2);
  const column3 = menuItems.slice(itemsPerColumn * 2);

  for (let i = 0; i < Math.max(column1.length, column2.length, column3.length); i++) {
    let line = '';
    
    // Column 1
    if (column1[i]) {
      line += column1[i];
    }
    
    // Column 2
    if (column2[i]) {
      const padding1 = columnWidth - (column1[i] ? column1[i].length : 0);
      line += ' '.repeat(Math.max(0, padding1)) + column2[i];
    }
    
    // Column 3
    if (column3[i]) {
      const padding2 = columnWidth - (column2[i] ? column2[i].length : 0);
      line += ' '.repeat(Math.max(0, padding2)) + column3[i];
    }
    
    console.log(line);
  }
} 

export const optimizedRateLimiter = {
  minInterval: 500, // Reduced from 2000ms
  maxConcurrent: 5, // Allow concurrent requests
  requestQueue: [],
  
  async batchRequests(requests, batchSize = 5) {
    const results = [];
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(batch);
      results.push(...batchResults);
      await this.wait();
    }
    return results;
  }
}; 

export class CacheManager {
  constructor() {
    this.cache = new Map();
    this.maxCacheSize = 1000;
    this.cacheTimeout = 30000; // 30 seconds
  }
  
  get(key) {
    const item = this.cache.get(key);
    if (item && Date.now() - item.timestamp < this.cacheTimeout) {
      return item.data;
    }
    this.cache.delete(key);
    return null;
  }
  
  set(key, data) {
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }
}

export async function parallelTokenAnalysis(tokens, maxConcurrent = 5) {
  const results = [];
  for (let i = 0; i < tokens.length; i += maxConcurrent) {
    const batch = tokens.slice(i, i + maxConcurrent);
    const batchPromises = batch.map(token => analyzeTokenWithJupiter(token));
    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults);
  }
  return results;
}

export const optimizedQueries = {
  // Use indexed queries
  getRecentTrades: (limit = 50) => {
    return `SELECT * FROM trades 
            WHERE timestamp > datetime('now', '-1 hour') 
            ORDER BY timestamp DESC 
            LIMIT ${limit}`;
  },
  
  // Batch operations
  batchInsertTrades: (trades) => {
    const values = trades.map(trade => 
      `('${trade.id}', '${trade.timestamp}', '${trade.data}')`
    ).join(',');
    return `INSERT INTO trades (id, timestamp, data) VALUES ${values}`;
  }
};

export class OptimizedDisplay {
  constructor() {
    this.lastRender = 0;
    this.renderThrottle = 100; // 100ms throttle
  }
  
  throttledDisplay(trade, state) {
    const now = Date.now();
    if (now - this.lastRender < this.renderThrottle) {
      return; // Skip render if too frequent
    }
    this.lastRender = now;
    return getDisplayTemplate(state.getMode())(trade, state);
  }
}

export const optimizedFetch = {
  async fetch(url, options = {}) {
    // Use AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'PumpTool/1.0',
          'Accept': 'application/json',
          ...options.headers
        }
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
};

export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }
  
  startTimer(operation) {
    this.metrics.set(operation, Date.now());
  }
  
  endTimer(operation) {
    const start = this.metrics.get(operation);
    if (start) {
      const duration = Date.now() - start;
      console.log(`${colors.cyan}⏱️ ${operation}: ${duration}ms${colors.reset}`);
      this.metrics.delete(operation);
    }
  }
}

export const performanceConfig = {
  maxConcurrentRequests: 5,
  cacheTimeout: 30000,
  maxTradesInMemory: 100,
  renderThrottle: 100,
  cleanupInterval: 60000,
  enableParallelProcessing: true,
  enableCaching: true,
  enableCompression: true
}; 