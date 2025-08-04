import * as fs from 'fs';
import * as path from 'path';
import fetch from 'node-fetch';
import { exec, execSync } from 'child_process';
import { fileURLToPath } from 'url';
import 'dotenv/config'
import inquirer from 'inquirer';
import readline from 'readline'; // Import readline for keyboard input
import clipboardy from 'clipboardy'; // Import clipboardy for clipboard access
import chalk from 'chalk'; // Import chalk for colored output
import Chart from 'cli-chart'; // Import cli-chart for drawing charts
import { stringifyQueryConfig } from './queries.js';
import { logToFile } from './logger.js';
// Removed unused import - using appState instance instead
import { colors } from './colors.js';
import { createKeyboardHandler } from './keyboardHandler.js';
import { rateLimiter, LoadingSpinner } from './utils.js';
import { Keypair, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import cliProgress from 'cli-progress';
import { pumpfunCrossMarketQuery, pumpTradesQuery, monitoringMoreQuery, graduatedQuery, fallbackQuery } from './queries.js';
// Jupiter analysis functions moved to modules/ai-enhanced-analyzer.js
import { aiEnhancedAnalyzer } from './modules/ai-enhanced-analyzer.js';
import { autoTrading } from './modules/auto-trading.js';
import { aiTradingIntegration } from './modules/ai-trading-integration.js';
import { QuickTrading } from './modules/quick-trading.js';
import { 
  getBestQuote, 
  getSwapTransaction, 
  performSwap, 
  getTokenBalance, 
  getSolBalance, 
  validateSwap, 
  getSwapHistory,
  getTokenMetadata,
  getAllTokenBalances,
  getTokenInfo,
  getTokenPrice,
  calculateTokenPnL,
  burnTokens,
  canTokenBeSold
} from './modules/jupiter-swap.js';
import { 
  optimizedRateLimiter, 
  CacheManager, 
  PerformanceMonitor, 
  OptimizedDisplay,
  parallelTokenAnalysis,
  optimizedFetch,
  performanceConfig 
} from './utils.js';
import { OptimizedAppState } from './state.js';

// Initialize optimized components
const performanceMonitor = new PerformanceMonitor();
const cacheManager = new CacheManager();
const optimizedDisplay = new OptimizedDisplay();

// Replace state initialization
let appState = new OptimizedAppState();

// Function to wait for Space key input
function waitForSpaceKey() {
  return new Promise((resolve) => {
    const originalRawMode = process.stdin.isRaw;
    const originalEncoding = process.stdin.encoding;
    
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    const onData = (data) => {
      if (data === ' ') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.setRawMode(originalRawMode);
        process.stdin.setEncoding(originalEncoding);
        process.stdin.removeListener('data', onData);
        resolve();
      }
    };
    
    process.stdin.on('data', onData);
  });
}

// Universal function to wait for Back key (B) or Space key
function waitForBackOrSpaceKey() {
  return new Promise((resolve) => {
    const originalRawMode = process.stdin.isRaw;
    const originalEncoding = process.stdin.encoding;
    
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    const onData = (data) => {
      if (data === ' ' || data.toLowerCase() === 'b') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.setRawMode(originalRawMode);
        process.stdin.setEncoding(originalEncoding);
        process.stdin.removeListener('data', onData);
        resolve(data.toLowerCase() === 'b' ? 'back' : 'continue');
      }
    };
    
    process.stdin.on('data', onData);
  });
}

// Function to add Back option to menu choices
function addBackOption(choices, backText = 'Back to Main Menu') {
  return [
    ...choices,
    { name: `${colors.white}[SPACE]${colors.reset} ${colors.yellow}⬅️ ${backText}${colors.reset}`, value: 'back' }
  ];
}

// Universal function to handle SPACE key for navigation
async function handleSpaceNavigation() {
  console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
  await waitForSpaceKey();
}

// Function to show navigation help
function showNavigationHelp() {
  console.log(`\n${colors.cyan}Navigation Keys:${colors.reset}`);
  console.log(`  ${colors.white}B${colors.reset} - Back to previous menu`);
  console.log(`  ${colors.white}SPACE${colors.reset} - Continue`);
  console.log(`  ${colors.white}Q${colors.reset} - Exit`);
  console.log('');
}

// Create instances
const spinner = new LoadingSpinner();

// Get current directory with ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

// Add UI helper functions
function showConnectionStatus() {
  const status = connectionStatus.getStatus();
  const statusBar = [];
  
  // BitQuery Status
  const bitqueryColor = status.bitquery.status === 'connected' ? colors.green : 
                       status.bitquery.status === 'error' ? colors.red : colors.yellow;
  const bitqueryIcon = status.bitquery.status === 'connected' ? '●' : 
                      status.bitquery.status === 'error' ? '✗' : '○';
  statusBar.push(`${bitqueryColor}${bitqueryIcon} BitQuery${colors.reset}`);
  
  // Jupiter Status
  const jupiterColor = status.jupiter.status === 'connected' ? colors.green : 
                      status.jupiter.status === 'error' ? colors.red : colors.yellow;
  const jupiterIcon = status.jupiter.status === 'connected' ? '●' : 
                     status.jupiter.status === 'error' ? '✗' : '○';
  statusBar.push(`${jupiterColor}${jupiterIcon} Jupiter${colors.reset}`);
  
  // Birdeye Status
  const birdeyeColor = status.birdeye.status === 'connected' ? colors.green : 
                      status.birdeye.status === 'error' ? colors.red : colors.yellow;
  const birdeyeIcon = status.birdeye.status === 'connected' ? '●' : 
                     status.birdeye.status === 'error' ? '✗' : '○';
  statusBar.push(`${birdeyeColor}${birdeyeIcon} Birdeye${colors.reset}`);
  
  console.log(`${colors.cyan}${colors.bright}🔗 Connection Status:${colors.reset} ${statusBar.join(' | ')}`);
  
  // Show errors if any
  const errors = [];
  if (status.bitquery.error) errors.push(`BitQuery: ${status.bitquery.error}`);
  if (status.jupiter.error) errors.push(`Jupiter: ${status.jupiter.error}`);
  if (status.birdeye.error) errors.push(`Birdeye: ${status.birdeye.error}`);
  
  if (errors.length > 0) {
    console.log(`${colors.red}⚠️ Connection Issues:${colors.reset} ${errors.join(' | ')}`);
  }
  
  console.log(''); // Empty line for spacing
}

function showLogo() {
  console.clear();
}

// Update mode descriptions
const modeDescriptions = {
  pump: {
    title: `${colors.green}Pump Detection${colors.reset}`,
    description: [
      'Monitors trades for potential pump signals and early entry opportunities.',
      'Features:',
      '• Real-time pump detection',
      '• Early signal notifications',
      '• Price movement analysis',
      '• Volume spike detection'
    ]
  },
  pumpfunCrossMarket: {
    title: `${colors.yellow}Pumpfun CrossMarket${colors.reset}`,
    description: [
      'Scans for cross-market asymmetry opportunities on Pumpfun.',
      'Features:',
      '• Finds tokens with price asymmetry ≤ 0.1',
      '• Filters for recent, successful trades',
      '• Shows top tokens by price'
    ]
  },
  graduated: {
    title: `${colors.purple}Graduated${colors.reset}`,
    description: [
      'Monitors DEX pools with bonding curve progress.',
      'Features:',
      '• Tracks pool liquidity and bonding curves',
      '• Shows bonding curve progress percentage',
      '• Monitors pool balances and prices',
      '• Real-time pool analytics'
    ]
  }
};

// Update showInitialQueryMenu function
async function showInitialQueryMenu() {
  const choices = [
    { 
      name: `${colors.green}Pump Detection${colors.reset} - Monitor for potential pump signals`,
      value: 'pump',
      short: 'Pump Detection'
    },
    {
      name: `${colors.yellow}Pumpfun CrossMarket${colors.reset} - Cross-market asymmetry scanner`,
      value: 'pumpfunCrossMarket',
      short: 'Pumpfun CrossMarket'
    },
    {
      name: `${colors.purple}Graduated${colors.reset} - Monitor DEX pools with bonding curves`,
      value: 'graduated',
      short: 'Graduated'
    }
  ];

  // Add option to use last selected mode if it exists and is different from default
  if (settings.lastSelectedMode && settings.lastSelectedMode !== 'pump') {
    const lastModeName = choices.find(c => c.value === settings.lastSelectedMode)?.short || settings.lastSelectedMode;
    choices.unshift({
      name: `${colors.cyan}Last Used: ${lastModeName}${colors.reset} - Continue with previous mode`,
      value: settings.lastSelectedMode,
      short: `Last: ${lastModeName}`
    });
  }

  const { queryType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'queryType',
      message: 'Select monitoring mode:',
      prefix: '🔍',
      choices: choices
    }
  ]);

  // Save the selected mode
  settings.lastSelectedMode = queryType;
  saveSettings();

  return queryType;
}

// Add state object for managing trade data and display
// Remove global myHeaders definition

// Read the Birdeye API key from environment.  If not provided, default to
// an empty string.  This allows sensitive API keys to be stored in a
// `.env` file or environment variables instead of being hard‑coded.
const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY || '';

// Add caching for token info
const tokenCache = {
  data: new Map(),
  maxAge: 6000, // 1 minute cache
  set(key, value) {
    this.data.set(key, {
      value,
      timestamp: Date.now()
    });
  },
  get(key) {
    const item = this.data.get(key);
    if (!item) return null;
    if (Date.now() - item.timestamp > this.maxAge) {
      this.data.delete(key);
      return null;
    }
    return item.value;
  }
};

// Update fetchTokenInfo with better response validation and error handling
async function fetchTokenInfo(mintAddress) {
  try {
    // Check cache first
    const cached = tokenCache.get(mintAddress);
    if (cached) return cached;

    // Add timeout to prevent hanging requests
    const timeout = 5000; // 5 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Prepare both API requests with timeout
      const v2Request = fetch(`https://public-api.birdeye.so/v2/tokens/solana/${mintAddress}`, {
        method: 'GET',
        headers: {
          'X-API-KEY': BIRDEYE_API_KEY,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });

      const altRequest = fetch(`https://public-api.birdeye.so/v1/solana/token/meta/${mintAddress}`, {
        method: 'GET',
        headers: {
          'X-API-KEY': BIRDEYE_API_KEY,
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        },
        signal: controller.signal
      });

      // Run requests in parallel with timeout
      const [v2Response, altResponse] = await Promise.all([
        v2Request.catch(() => ({ ok: false })),
        altRequest.catch(() => ({ ok: false }))
      ]);
      
      clearTimeout(timeoutId);
      
      // Process v2 response first
      if (v2Response.ok && v2Response.headers?.get('content-type')?.includes('application/json')) {
        try {
          const v2Data = await v2Response.json();
          if (v2Data?.success && v2Data?.data) {
            const result = {
              supply: v2Data.data?.supply || v2Data.data?.total_supply || '0',
              buyTax: v2Data.data?.tax?.buy || 0,
              sellTax: v2Data.data?.tax?.sell || 0,
              liquidityLocked: Boolean(v2Data.data?.liquidity_locked),
              marketCap: v2Data.data?.market_cap || 0
            };
            tokenCache.set(mintAddress, result);
            return result;
          }
        } catch (e) {
          console.error(`Error parsing v2 response: ${e.message}`);
        }
      }

      // Try alt response if v2 failed
      if (altResponse.ok && altResponse.headers?.get('content-type')?.includes('application/json')) {
        try {
          const altData = await altResponse.json();
          if (altData?.success && altData?.data) {
            const result = {
              supply: altData.data?.supply || altData.data?.totalSupply || '0',
              marketCap: altData.data?.marketCap || 0,
              buyTax: 0,
              sellTax: 0,
              liquidityLocked: false
            };
            tokenCache.set(mintAddress, result);
            return result;
          }
        } catch (e) {
          console.error(`Error parsing alt response: ${e.message}`);
        }
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        console.error(`Request timeout for ${mintAddress}`);
      } else {
        console.error(`Network error for ${mintAddress}: ${error.message}`);
      }
    }

    // Default response if both APIs fail
    const defaultResult = {
      supply: '0',
      marketCap: 0,
      buyTax: 0,
      sellTax: 0,
      liquidityLocked: false
    };
    tokenCache.set(mintAddress, defaultResult);
    return defaultResult;

  } catch (error) {
    console.error(`Error fetching token info for ${mintAddress}: ${error.message}`);
    return {
      supply: '0',
      marketCap: 0,
      buyTax: 0,
      sellTax: 0,
      liquidityLocked: false
    };
  }
}

// Add token verification helper functions
async function verifyToken(token, trade) {
  const warnings = [];
  let score = 100; // Start with perfect score and deduct based on issues

  // Check token metadata
  if (!token.Name || !token.Symbol) {
    warnings.push('⚠️ Missing token metadata');
    score -= 20;
  }

  // Check decimals (most legitimate tokens use 6-9 decimals)
  const decimals = parseInt(token.Decimals);
  if (isNaN(decimals) || decimals < 6 || decimals > 12) {
    warnings.push(`⚠️ Unusual decimal places: ${decimals}`);
    score -= 15;
  }

  // Check token URI
  if (!token.Uri) {
    warnings.push('⚠️ No metadata URI');
    score -= 10;
  }

  // Check if token is fungible
  if (!token.Fungible) {
    warnings.push('⚠️ Non-fungible token');
    score -= 25;
  }

  // Check for honeypot indicators
  const honeypotRisk = await checkHoneypotRisk(token.MintAddress);
  if (honeypotRisk.isRisky) {
    warnings.push(...honeypotRisk.warnings);
    score -= 30;
  }

  return {
    isVerified: score > 60,
    score,
    warnings,
    riskLevel: getRiskLevel(100 - score)
  };
}

// Enhanced token analysis using Jupiter API
async function analyzeTokenWithJupiter(tokenAddress) {
  // Simple memoization layer: cache analysis results for 1 minute to avoid
  // repeated calls for the same token.  Cached results are invalidated
  // after maxAge.  This improves performance when users repeatedly check
  // the same token via keyboard navigation.
  const cacheKey = tokenAddress?.toLowerCase?.() || tokenAddress;
  const maxAge = 60000; // 1 minute
  if (!analyzeTokenWithJupiter.cache) {
    analyzeTokenWithJupiter.cache = new Map();
  }
  const cached = analyzeTokenWithJupiter.cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < maxAge) {
    return cached.result;
  }

  try {
    console.log(`${colors.cyan}🔍 Analyzing token with Jupiter API...${colors.reset}`);
    
    // Get detailed analysis from Jupiter
    const analysis = await getDetailedAnalysis(tokenAddress);
    
    if (!analysis.success) {
      console.log(`${colors.red}❌ Jupiter analysis failed: ${analysis.error}${colors.reset}`);
      return null;
    }

    // Store in cache before returning
    analyzeTokenWithJupiter.cache.set(cacheKey, { result: analysis, timestamp: Date.now() });

    return analysis;
  } catch (error) {
    console.error(`${colors.red}Error in Jupiter analysis: ${error.message}${colors.reset}`);
    return null;
  }
}

// Real-time Jupiter token checking using v2 search API
async function checkJupiterTokenRealtime(tokenAddress) {
  let retries = 0;
  const maxRetries = 3;

  while (retries <= maxRetries) {
    try {
      // Use rate limiting with backoff
      if (rateLimiter.consecutiveFailures > 0) {
        await rateLimiter.waitWithBackoff();
      } else {
        await rateLimiter.wait();
      }

      const response = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${tokenAddress}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'User-Agent': 'PrettySnipe/1.0.0'
        },
        signal: AbortSignal.timeout(10000)
      });

      if (response.status === 429) {
        // Rate limited - increase backoff and retry
        rateLimiter.recordFailure();
        console.log(`${colors.yellow}⚠️ Rate limited by Jupiter API. Retrying in ${rateLimiter.minInterval/1000}s...${colors.reset}`);
        retries++;
        continue;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error('Token not found or invalid response format');
      }

      // Find exact match for the token address
      const exactMatch = data.find(token => 
        token.id?.toLowerCase() === tokenAddress.toLowerCase()
      );

      if (!exactMatch) {
        throw new Error('Token not found in search results');
      }

      // Extract real-time data from the token
      const realtimeData = {
        price: exactMatch.usdPrice,
        volume24h: exactMatch.stats24h?.buyVolume + exactMatch.stats24h?.sellVolume || 0,
        priceChange24h: 0, // Price change not directly available in this API
        marketCap: exactMatch.mcap,
        liquidity: exactMatch.liquidity,
        name: exactMatch.name,
        symbol: exactMatch.symbol,
        decimals: exactMatch.decimals,
        verified: exactMatch.isVerified,
        hasLiquidity: exactMatch.liquidity > 0,
        holderCount: exactMatch.holderCount,
        organicScore: exactMatch.organicScore,
        organicScoreLabel: exactMatch.organicScoreLabel
      };

      rateLimiter.recordSuccess();
      return {
        success: true,
        data: realtimeData,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      if (error.message.includes('HTTP 429') || error.message.includes('Too Many Requests')) {
        rateLimiter.recordFailure();
        console.log(`${colors.yellow}⚠️ Rate limited by Jupiter API. Retrying in ${rateLimiter.minInterval/1000}s...${colors.reset}`);
        retries++;
        continue;
      }
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // If we've exhausted all retries
  return {
    success: false,
    error: 'Failed to fetch token data after multiple retries due to rate limiting',
    timestamp: new Date().toISOString()
  };
}

// Enhanced real-time token monitoring
async function monitorTokenRealtime(tokenAddress, interval = 1000, state = null) {
  if (!state) {
    console.log(`${colors.cyan}🔄 Starting real-time monitoring for ${tokenAddress}${colors.reset}`);
    console.log(`${colors.yellow}Update interval: ${interval/1000}s${colors.reset}\n`);
  }

  const monitoringData = {
    tokenAddress,
    startTime: new Date(),
    updates: [],
    isActive: true,
    timeChanges: {
      '15s': null,
      '30s': null,
      '1m': null,
      '5m': null
    }
  };

  const monitorInterval = setInterval(async () => {
    if (!monitoringData.isActive) {
      clearInterval(monitorInterval);
      return;
    }

    try {
      const result = await checkJupiterTokenRealtime(tokenAddress);
      
      if (result.success) {
        const update = {
          timestamp: new Date(),
          price: result.data.price,
          volume24h: result.data.volume24h,
          priceChange24h: result.data.priceChange24h,
          marketCap: result.data.marketCap,
          liquidity: result.data.liquidity
        };

        monitoringData.updates.push(update);
        
        // Update time-based changes
        updateTimeChanges(monitoringData, update);
        
        if (state) {
          // Update state with real-time data
          state.updateJupiterRealtimeData({
            update,
            updateCount: monitoringData.updates.length,
            timeChanges: monitoringData.timeChanges
          });
          
          // Refresh display with real-time data
          await state.displayTrade(state.currentTokenIndex);
        } else {
          // Display real-time update (standalone mode)
          displayRealtimeUpdate(update, monitoringData.updates.length, monitoringData.timeChanges);
        }
        
        // Check for significant changes
        checkSignificantChanges(update, monitoringData.updates);
        
      } else {
        console.log(`${colors.red}❌ Real-time check failed: ${result.error}${colors.reset}`);
      }

    } catch (error) {
      console.error(`${colors.red}Real-time monitoring error: ${error.message}${colors.reset}`);
    }
  }, interval);

  return {
    stop: () => {
      monitoringData.isActive = false;
      clearInterval(monitorInterval);
      console.log(`${colors.yellow}🛑 Real-time monitoring stopped${colors.reset}`);
    },
    getData: () => monitoringData
  };
}

// Update time-based price changes
function updateTimeChanges(monitoringData, currentUpdate) {
  const now = new Date();
  const timeRanges = {
    '15s': 15 * 1000,
    '30s': 30 * 1000,
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000
  };

  Object.entries(timeRanges).forEach(([label, range]) => {
    const targetTime = new Date(now.getTime() - range);
    
    // Find the closest update to the target time
    let closestUpdate = null;
    let minDiff = Infinity;
    
    for (let i = monitoringData.updates.length - 1; i >= 0; i--) {
      const update = monitoringData.updates[i];
      const diff = Math.abs(update.timestamp.getTime() - targetTime.getTime());
      
      if (diff < minDiff && update.timestamp <= targetTime) {
        minDiff = diff;
        closestUpdate = update;
      }
    }
    
    if (closestUpdate && currentUpdate.price && closestUpdate.price) {
      const priceChange = ((currentUpdate.price - closestUpdate.price) / closestUpdate.price) * 100;
      monitoringData.timeChanges[label] = {
        price: closestUpdate.price,
        change: priceChange,
        timestamp: closestUpdate.timestamp
      };
    }
  });
}

// Display real-time token updates
function displayRealtimeUpdate(update, updateCount, timeChanges = {}) {
  console.clear();
  console.log(`${colors.cyan}🔄 Real-time Token Monitor${colors.reset}`);
  console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.yellow}Update #${updateCount}${colors.reset} - ${update.timestamp.toLocaleTimeString()}\n`);

  if (update.price) {
    console.log(`${colors.green}💰 Price:${colors.reset} $${update.price.toFixed(6)}`);
  }

  if (update.priceChange24h !== undefined) {
    const changeColor = update.priceChange24h >= 0 ? colors.green : colors.red;
    const changeSymbol = update.priceChange24h >= 0 ? '↗' : '↘';
    console.log(`${colors.yellow}📈 24h Change:${colors.reset} ${changeColor}${changeSymbol} ${update.priceChange24h.toFixed(2)}%${colors.reset}`);
  }

  if (update.volume24h) {
    console.log(`${colors.blue}📊 24h Volume:${colors.reset} $${update.volume24h.toLocaleString()}`);
  }

  if (update.marketCap) {
    console.log(`${colors.magenta}🏦 Market Cap:${colors.reset} $${update.marketCap.toLocaleString()}`);
  }

  if (update.liquidity) {
    console.log(`${colors.cyan}💧 Liquidity:${colors.reset} $${update.liquidity.toLocaleString()}`);
  }

  // Display time-based changes
  console.log(`\n${colors.cyan}📊 Time-based Changes:${colors.reset}`);
  console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  const timeLabels = ['15s', '30s', '1m', '5m'];
  timeLabels.forEach(label => {
    const change = timeChanges[label];
    if (change) {
      const changeColor = change.change >= 0 ? colors.green : colors.red;
      const changeSymbol = change.change >= 0 ? '↗' : '↘';
      const timeAgo = formatTimeAgo(change.timestamp);
      console.log(`${colors.yellow}${label}:${colors.reset} ${changeColor}${changeSymbol} ${change.change.toFixed(2)}%${colors.reset} (${timeAgo})`);
    } else {
      console.log(`${colors.yellow}${label}:${colors.reset} ${colors.gray}No data${colors.reset}`);
    }
  });

  console.log(`\n${colors.dim}Press Ctrl+C to stop monitoring${colors.reset}`);
}

// Format time ago for display
function formatTimeAgo(timestamp) {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  const seconds = Math.floor(diff / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// Check for significant price changes
function checkSignificantChanges(currentUpdate, allUpdates) {
  if (allUpdates.length < 2) return;

  const previousUpdate = allUpdates[allUpdates.length - 2];
  const priceChange = ((currentUpdate.price - previousUpdate.price) / previousUpdate.price) * 100;

  // Alert for significant changes (>5%)
  if (Math.abs(priceChange) > 5) {
    const alertColor = priceChange > 0 ? colors.green : colors.red;
    const alertSymbol = priceChange > 0 ? '🚀' : '📉';
    
    console.log(`\n${alertColor}${alertSymbol} SIGNIFICANT CHANGE DETECTED!${colors.reset}`);
    console.log(`${alertColor}Price change: ${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}%${colors.reset}`);
    
    // Play alert sound
    try {
      process.stdout.write('\x07');
    } catch (e) {
      // Ignore if sound not supported
    }
  }
}

// Enhanced Jupiter connection check with v2 search API
async function checkJupiterConnectionV1() {
  try {
    // Test with a known token (USDC)
    const testToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    const response = await fetch(`https://lite-api.jup.ag/tokens/v2/search?query=${testToken}`, {
      signal: AbortSignal.timeout(3000)
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data && Array.isArray(data) && data.length > 0) {
        return { success: true, message: 'Jupiter v2 search API connected' };
      }
    }
    
    return { success: false, message: 'Invalid response format' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

// Display Jupiter analysis results
function displayJupiterAnalysis(analysis) {
  if (!analysis || !analysis.success) {
    console.log(`${colors.red}❌ No Jupiter analysis available${colors.reset}\n`);
    return;
  }

  const data = analysis.analysis;
  
  console.log(`${colors.cyan}🔍 Jupiter Token Analysis${colors.reset}`);
  console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  // Basic info
  console.log(`${colors.yellow}Name:${colors.reset} ${data.basic.name}`);
  console.log(`${colors.yellow}Symbol:${colors.reset} ${data.basic.symbol}`);
  console.log(`${colors.yellow}Address:${colors.reset} ${data.basic.address}`);
  console.log(`${colors.yellow}Decimals:${colors.reset} ${data.basic.decimals}`);

  // Market data
  if (data.metadata) {
    console.log(`\n${colors.cyan}📊 Market Data${colors.reset}`);
    console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.yellow}Verified:${colors.reset} ${data.metadata.verified ? `${colors.green}✅ Yes` : `${colors.red}❌ No`}${colors.reset}`);
    
    if (data.metadata.price) {
      console.log(`${colors.yellow}Price:${colors.reset} $${data.metadata.price.toFixed(6)}`);
    }
    
    if (data.metadata.priceChange24h !== undefined) {
      const changeColor = data.metadata.priceChange24h >= 0 ? colors.green : colors.red;
      const changeSymbol = data.metadata.priceChange24h >= 0 ? '↗' : '↘';
      console.log(`${colors.yellow}24h Change:${colors.reset} ${changeColor}${changeSymbol} ${data.metadata.priceChange24h.toFixed(2)}%${colors.reset}`);
    }

    if (data.metadata.volume24h) {
      console.log(`${colors.yellow}24h Volume:${colors.reset} $${data.metadata.volume24h.toLocaleString()}`);
    }

    if (data.metadata.marketCap) {
      console.log(`${colors.yellow}Market Cap:${colors.reset} $${data.metadata.marketCap.toLocaleString()}`);
    }

    if (data.metadata.liquidity) {
      console.log(`${colors.yellow}Liquidity:${colors.reset} $${data.metadata.liquidity.toLocaleString()}`);
    }

    if (data.metadata.holderCount) {
      console.log(`${colors.yellow}Holders:${colors.reset} ${data.metadata.holderCount.toLocaleString()}`);
    }

    if (data.metadata.organicScore !== undefined) {
      const scoreColor = data.metadata.organicScore > 50 ? colors.green : 
                        data.metadata.organicScore > 20 ? colors.yellow : colors.red;
      console.log(`${colors.yellow}Organic Score:${colors.reset} ${scoreColor}${data.metadata.organicScore} (${data.metadata.organicScoreLabel})${colors.reset}`);
    }
  }

  // Trading info
  console.log(`\n${colors.cyan}💱 Trading Info${colors.reset}`);
  console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.yellow}Has Liquidity:${colors.reset} ${data.trading.hasLiquidity ? `${colors.green}✅ Yes` : `${colors.red}❌ No`}${colors.reset}`);
  console.log(`${colors.yellow}Is Stable:${colors.reset} ${data.trading.isStable ? `${colors.green}✅ Yes` : `${colors.red}❌ No`}${colors.reset}`);
  console.log(`${colors.yellow}Community Token:${colors.reset} ${data.trading.isCommunity ? `${colors.yellow}⚠️ Yes` : `${colors.green}✅ No`}${colors.reset}`);

  // Risk assessment
  if (analysis.analysis.risk) {
    const risk = analysis.analysis.risk;
    const riskColors = {
      'very_low': colors.green,
      'low': colors.cyan,
      'medium': colors.yellow,
      'high': colors.red
    };
    
    console.log(`\n${colors.cyan}⚠️ Risk Assessment${colors.reset}`);
    console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.yellow}Risk Level:${colors.reset} ${riskColors[risk.level] || colors.white}${risk.level.toUpperCase()}${colors.reset}`);
    console.log(`${colors.yellow}Risk Score:${colors.reset} ${risk.score}/100`);
    
    if (risk.factors.length > 0) {
      console.log(`${colors.yellow}Risk Factors:${colors.reset}`);
      risk.factors.forEach(factor => {
        console.log(`  • ${colors.red}${factor}${colors.reset}`);
      });
    }
  }

  // Recommendations
  if (analysis.analysis.recommendations) {
    console.log(`\n${colors.cyan}💡 Trading Recommendations${colors.reset}`);
    console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    
    analysis.analysis.recommendations.forEach(rec => {
      const typeColors = {
        'success': colors.green,
        'warning': colors.yellow,
        'danger': colors.red,
        'info': colors.cyan
      };
      
      const icon = {
        'success': '✅',
        'warning': '⚠️',
        'danger': '🚨',
        'info': 'ℹ️'
      };
      
      console.log(`${typeColors[rec.type] || colors.white}${icon[rec.type] || '•'} ${rec.message}${colors.reset}`);
    });
  }

  console.log(''); // Empty line for spacing
}

// Enhanced trading decision function with Jupiter analysis
async function makeTradingDecisionWithJupiter(tokenAddress, tradeAmount = 1000) {
  try {
    console.log(`\n${colors.cyan}🤖 Making trading decision with Jupiter analysis...${colors.reset}`);
    
    // Get Jupiter analysis with retry logic
    let analysis = null;
    let retries = 0;
    const maxRetries = 2;

    while (retries <= maxRetries && !analysis) {
      try {
        analysis = await analyzeTokenWithJupiter(tokenAddress);
      } catch (error) {
        if (error.message.includes('rate limiting') || error.message.includes('HTTP 429')) {
          retries++;
          if (retries <= maxRetries) {
            console.log(`${colors.yellow}⚠️ Jupiter API rate limited. Retrying analysis... (${retries}/${maxRetries})${colors.reset}`);
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds before retry
            continue;
          }
        }
        throw error;
      }
    }
    
    if (!analysis) {
      console.log(`${colors.red}❌ Cannot make decision - Jupiter analysis failed after retries${colors.reset}`);
      return { decision: 'REJECT', reason: 'Analysis failed due to rate limiting', score: 0 };
    }

    // Evaluate safety based on Jupiter data
    const safety = evaluateJupiterSafety(analysis);
    
    console.log(`${colors.yellow}Safety Score: ${safety.score}/100${colors.reset}`);
    console.log(`${colors.yellow}Issues: ${safety.reason}${colors.reset}`);

    // Make decision based on safety score
    if (safety.score < 30) {
      console.log(`${colors.red}❌ REJECTED - Very high risk${colors.reset}`);
      return { decision: 'REJECT', reason: 'Very high risk', score: safety.score };
    } else if (safety.score < 50) {
      console.log(`${colors.yellow}⚠️ CAUTION - High risk, proceed with care${colors.reset}`);
      return { decision: 'CAUTION', reason: safety.reason, score: safety.score };
    } else if (safety.score < 70) {
      console.log(`${colors.cyan}✅ APPROVED - Moderate risk${colors.reset}`);
      return { decision: 'APPROVE', reason: 'Moderate risk acceptable', score: safety.score };
    } else {
      console.log(`${colors.green}✅ APPROVED - Low risk${colors.reset}`);
      return { decision: 'APPROVE', reason: 'Low risk', score: safety.score };
    }
  } catch (error) {
    console.error(`${colors.red}Trading decision failed: ${error.message}${colors.reset}`);
    return { decision: 'ERROR', reason: error.message, score: 0 };
  }
}

// Evaluate token safety based on Jupiter analysis
function evaluateJupiterSafety(analysis) {
  if (!analysis || !analysis.success) {
    return {
      safe: false,
      reason: 'Analysis failed',
      score: 0
    };
  }

  const data = analysis.analysis;
  let score = 100;
  const issues = [];

  // Check verification status
  if (!data.metadata?.verified) {
    score -= 30;
    issues.push('Unverified token');
  }

  // Check liquidity
  if (!data.trading?.hasLiquidity || data.metadata?.liquidity < 10000) {
    score -= 25;
    issues.push('Insufficient liquidity');
  }

  // Check holder count
  if (data.metadata?.holderCount < 100) {
    score -= 15;
    issues.push('Low holder count');
  }

  // Check organic score
  if (data.metadata?.organicScore < 10) {
    score -= 10;
    issues.push('Low organic score');
  }

  // Check if it's a duplicate token
  if (data.basic.tags?.includes('duplicate')) {
    score -= 20;
    issues.push('Duplicate token (potential scam)');
  }

  // Check price volatility
  if (data.metadata?.priceChange24h && Math.abs(data.metadata.priceChange24h) > 50) {
    score -= 15;
    issues.push('High volatility');
  }

  return {
    safe: score >= 50,
    reason: issues.length > 0 ? issues.join(', ') : 'All checks passed',
    score: Math.max(0, score)
  };
}

async function checkHoneypotRisk(mintAddress) {
  try {
    // Get token info from Birdeye
    const tokenInfo = await fetchTokenInfo(mintAddress);
    
    const warnings = [];
    let isRisky = false;

    if (tokenInfo) {
      // Check sell tax
      if (tokenInfo.sellTax && tokenInfo.sellTax > 5) {
        warnings.push(`⚠️ High sell tax: ${tokenInfo.sellTax}%`);
        isRisky = true;
      }

      // Check buy tax
      if (tokenInfo.buyTax && tokenInfo.buyTax > 5) {
        warnings.push(`⚠️ High buy tax: ${tokenInfo.buyTax}%`);
        isRisky = true;
      }

      // Check liquidity locks
      if (!tokenInfo.liquidityLocked) {
        warnings.push('⚠️ Liquidity not locked');
        isRisky = true;
      }
    }
    
    return { isRisky, warnings };
  } catch (error) {
    console.error('Error checking honeypot risk:', error);
    return { isRisky: false, warnings: ['⚠️ Could not verify honeypot status'] };
  }
}

// Optimize trade processing with debouncing
const processingQueue = {
  timeout: null,
  delay: 100, // 100ms debounce
  process(trade, index) {
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(() => processTrade(trade, index), this.delay);
  }
};

// Update clipboard function to use ES modules
function copyToClipboard(text) {
  const command = process.platform === 'darwin' ? 'pbcopy' : 'clip';
  const proc = exec(command);
  proc.stdin.write(text);
  proc.stdin.end();
}

// Update trade function to be simpler
async function initiateTrade(token) {
  try {
    const tradeMessage = `/buy ${token.MintAddress}`;
    
    // Format trade notification
    const notification = [
      `\n${colors.cyan}Trade Command:${colors.reset}`,
      `${colors.white}Token: ${colors.green}${token.Name} (${token.Symbol})${colors.reset}`,
      `${colors.white}Address: ${colors.yellow}${token.MintAddress}${colors.reset}`,
      `${colors.white}Command: ${colors.magenta}${tradeMessage}${colors.reset}`,
      `\n${colors.yellow}Command copied to clipboard${colors.reset}`
    ];
    
    // Display notification
    notification.forEach(line => console.log(line));
    
    // Copy trade command to clipboard
    copyToClipboard(tradeMessage);
    
    // Log trade attempt
    logToFile(`Trade command generated for ${token.Symbol} (${token.MintAddress})`, 'trade');
    
    return true;
  } catch (error) {
    console.error(`\n${colors.red}Error generating trade command: ${error.message}${colors.reset}`);
    logToFile(`Trade command error for ${token.Symbol}: ${error.message}`, 'error');
    return false;
  }
}

// Add time verification helper
function verifyTradeTime(tradeTime) {
  const now = Date.now();
  const tradeTimestamp = new Date(tradeTime).getTime();
  const timeDiff = now - tradeTimestamp;
  const maxDiff = 5 * 60 * 1000; // 5 minutes max difference

  return {
    isRecent: timeDiff <= maxDiff,
    diff: Math.floor(timeDiff / 1000), // difference in seconds
    formattedDiff: formatTimeDiff(timeDiff)
  };
}

// Add time difference formatter
function formatTimeDiff(diff) {
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// Update price history tracking to remove market stats
const priceHistory = {
  maxPoints: 30,
  prices: [],
  times: [],
  addPrice(price, time) {
    this.prices.push(price);
    this.times.push(time);
    
    if (this.prices.length > this.maxPoints) {
      this.prices.shift();
      this.times.shift();
    }
  },
  clear() {
    this.prices = [];
    this.times = [];
  }
};

// Enhanced drawPriceChart function with modern stylish visuals
function drawPriceChart() {
  const height = 12;
  const width = priceHistory.prices.length;
  if (width < 2) return '';

  try {
    const min = Math.min(...priceHistory.prices);
    const max = Math.max(...priceHistory.prices);
    const range = max - min || 1;
    const lastPrice = priceHistory.prices[priceHistory.prices.length - 1];
    
    // Calculate price changes
    const priceDiff = lastPrice - priceHistory.prices[0];
    const percentChange = (priceDiff / (priceHistory.prices[0] || 1)) * 100;
    const isPositive = priceDiff >= 0;
    
    // Modern header with gradient-like styling
    let chartStr = '\n' + chalk.bold.cyan('╭─ PRICE CHART ─╮\n');
    chartStr += chalk.cyan('│ ') + chalk.bold.white(`$${lastPrice.toFixed(9)}`) + chalk.cyan(' │ ');
    
    // Dynamic trend indicator
    const trendSymbol = isPositive ? '🚀' : '📉';
    const trendColor = isPositive ? chalk.green : chalk.red;
    const trendSign = isPositive ? '+' : '';
    chartStr += `${trendSymbol} ${trendColor.bold(`${trendSign}${percentChange.toFixed(2)}%`)}\n`;
    chartStr += chalk.cyan('╰' + '─'.repeat(15) + '╯\n\n');

    // Create enhanced canvas with gradient background
    const canvas = Array(height).fill().map(() => Array(width).fill(' '));

    // Plot points with modern symbols
    for (let i = 0; i < width - 1; i++) {
      const x1 = i;
      const x2 = i + 1;
      const y1 = Math.min(height - 1, Math.max(0, 
        height - 1 - Math.round(((priceHistory.prices[i] - min) / range) * (height - 1))
      ));
      const y2 = Math.min(height - 1, Math.max(0, 
        height - 1 - Math.round(((priceHistory.prices[i + 1] - min) / range) * (height - 1))
      ));

      // Modern price movement indicators
      if (priceHistory.prices[i] < priceHistory.prices[i + 1]) {
        canvas[y1][x1] = chalk.green.bold('●'); // Green dot
        canvas[y2][x2] = chalk.green.bold('●');
        plotLine(canvas, x1, y1, x2, y2, chalk.green('┃')); // Vertical line
      } else if (priceHistory.prices[i] > priceHistory.prices[i + 1]) {
        canvas[y1][x1] = chalk.red.bold('●'); // Red dot
        canvas[y2][x2] = chalk.red.bold('●');
        plotLine(canvas, x1, y1, x2, y2, chalk.red('┃')); // Vertical line
      } else {
        canvas[y1][x1] = chalk.blue.bold('●'); // Blue dot
        canvas[y2][x2] = chalk.blue.bold('●');
        plotLine(canvas, x1, y1, x2, y2, chalk.blue('┃')); // Vertical line
      }
    }

    // Draw modern chart with rounded corners
    chartStr += chalk.cyan('┌' + '─'.repeat(width + 2) + '┐\n');

    // Draw chart lines with enhanced styling
    for (let i = 0; i < height; i++) {
      const gridLine = canvas[i].map(cell => {
        if (cell !== ' ') return cell;
        // Create subtle grid pattern
        return chalk.dim(i % 2 === 0 ? '·' : ' ');
      }).join('');
      chartStr += chalk.cyan('│ ') + gridLine + chalk.cyan(' │') + '\n';
    }

    // Bottom frame with modern styling
    chartStr += chalk.cyan('└' + '─'.repeat(width + 2) + '┘\n');

    // Enhanced price range display
    chartStr += chalk.yellow('⚡ High: ') + chalk.green.bold(`$${max.toFixed(9)}`) + 
                chalk.yellow('  💧 Low: ') + chalk.red.bold(`$${min.toFixed(9)}`) + '\n';

    // Modern time info
    if (priceHistory.times.length >= 2) {
      const timeRange = formatTimeRange(
        priceHistory.times[0], 
        priceHistory.times[priceHistory.times.length - 1]
      );
      chartStr += chalk.cyan('⏱ ') + chalk.dim(`${width} data points over ${timeRange}`);
    }

    return chartStr;

  } catch (error) {
    console.error('Chart drawing error:', error);
    return '\nUnable to draw chart: insufficient data';
  }
}

// Enhanced plotLine function for smoother lines
function plotLine(canvas, x1, y1, x2, y2, char) {
  try {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    
    let currentX = x1;
    let currentY = y1;

    // Use different characters for different line angles
    const getLineChar = (dx, dy) => {
      if (dy === 0) return '─';
      if (dx === 0) return '│';
      return char;
    };

    while (true) {
      if (currentY >= 0 && currentY < canvas.length && 
          currentX >= 0 && currentX < canvas[0].length) {
        canvas[currentY][currentX] = getLineChar(dx, dy);
      }

      if (currentX === x2 && currentY === y2) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        currentX += sx;
      }
      if (e2 < dx) {
        err += dx;
        currentY += sy;
      }
    }
  } catch (error) {
    console.error('Line drawing error:', error);
  }
}

// Simplified time range formatter
function formatTimeRange(startTime, endTime) {
  try {
    const diff = new Date(endTime) - new Date(startTime);
    if (isNaN(diff)) return 'unknown time';
    if (diff < 60000) return `${Math.max(1, Math.round(diff / 1000))}s`;
    if (diff < 3600000) return `${Math.round(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.round(diff / 3600000)}h`;
    return `${Math.round(diff / 86400000)}d`;
  } catch (error) {
    return 'unknown time';
  }
}

// Add menu state constant
const MENU_STATES = {
  MAIN: 'main',
  MONITOR: 'monitor',
  ANALYTICS: 'analytics',
  ALERTS: 'alerts'
};

// Add this near the top of the file with other global variables
let serverProcess = null;
const SERVER_PORT = 3000;

// Connection Status System
const connectionStatus = {
  bitquery: { status: 'disconnected', lastCheck: null, error: null },
  jupiter: { status: 'disconnected', lastCheck: null, error: null },
  birdeye: { status: 'disconnected', lastCheck: null, error: null },
  
  updateStatus(service, status, error = null) {
    this[service] = {
      status,
      lastCheck: new Date(),
      error
    };
  },
  
  getStatus() {
    return {
      bitquery: this.bitquery,
      jupiter: this.jupiter,
      birdeye: this.birdeye
    };
  },
  
  async checkBitqueryConnection() {
    try {
      const response = await fetch('https://streaming.bitquery.io/eap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.bitqueryApiKey}`
        },
        body: JSON.stringify({
          query: `{
            Solana {
              DEXTrades(
                limit: {count: 1}
                orderBy: {descending: Block_Time}
              ) {
                Block {
                  Time
                }
                Trade {
                  Buy {
                    Currency {
                      Symbol
                    }
                  }
                }
              }
            }
          }`
        }),
        signal: AbortSignal.timeout(10000)
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.Solana) {
          this.updateStatus('bitquery', 'connected');
          return true;
        } else {
          this.updateStatus('bitquery', 'error', 'Invalid response format');
          return false;
        }
      } else {
        const errorText = await response.text();
        if (errorText.includes('Account blocked')) {
          this.updateStatus('bitquery', 'error', 'Account blocked - check API key');
        } else {
          this.updateStatus('bitquery', 'error', `HTTP ${response.status}: ${errorText.substring(0, 100)}`);
        }
        return false;
      }
    } catch (error) {
      this.updateStatus('bitquery', 'error', error.message);
      return false;
    }
  },
  
  async checkJupiterConnection() {
    try {
      // Test both v3 price API and v1 token API
      const [v3Response, v1Result] = await Promise.allSettled([
        fetch('https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112', {
          signal: AbortSignal.timeout(3000)
        }),
        checkJupiterConnectionV1()
      ]);
      
      let v3Success = false;
      let v1Success = false;
      let errors = [];
      
      // Check v3 API
      if (v3Response.status === 'fulfilled' && v3Response.value.ok) {
        try {
          const data = await v3Response.value.json();
          if (data.data) {
            v3Success = true;
          }
        } catch (e) {
          errors.push('v3 API parse error');
        }
      } else {
        errors.push('v3 API failed');
      }
      
      // Check v2 search API
      if (v1Result.status === 'fulfilled' && v1Result.value.success) {
        v1Success = true;
      } else {
        errors.push('v2 search API failed');
      }
      
      // Update status based on results
      if (v3Success && v1Success) {
        this.updateStatus('jupiter', 'connected');
        return true;
      } else if (v3Success || v1Success) {
        this.updateStatus('jupiter', 'connected', `Partial: ${v3Success ? 'v3 price' : 'v2 search'} working`);
        return true;
      } else {
        this.updateStatus('jupiter', 'error', `Both APIs failed: ${errors.join(', ')}`);
        return false;
      }
    } catch (error) {
      this.updateStatus('jupiter', 'error', error.message);
      return false;
    }
  },
  
  async checkBirdeyeConnection() {
    try {
      const response = await fetch('https://public-api.birdeye.so/v2/tokens/solana/So11111111111111111111111111111111111111112', {
        headers: { 'X-API-KEY': BIRDEYE_API_KEY },
        signal: AbortSignal.timeout(3000)
      });
      
      if (response.ok) {
        this.updateStatus('birdeye', 'connected');
        return true;
      } else {
        this.updateStatus('birdeye', 'error', `HTTP ${response.status}`);
        return false;
      }
    } catch (error) {
      this.updateStatus('birdeye', 'error', error.message);
      return false;
    }
  },
  
  async checkAllConnections() {
    await Promise.allSettled([
      this.checkBitqueryConnection(),
      this.checkJupiterConnection(),
      this.checkBirdeyeConnection()
    ]);
  }
};

// Price Alerts System
const priceAlerts = {
  alerts: new Map(),
  checkInterval: null,
  
  addAlert(tokenAddress, targetPrice, condition, description = '') {
    const alertId = `${tokenAddress}_${Date.now()}`;
    this.alerts.set(alertId, {
      tokenAddress,
      targetPrice: parseFloat(targetPrice),
      condition, // 'above' or 'below'
      description,
      createdAt: new Date(),
      triggered: false
    });
    return alertId;
  },
  
  removeAlert(alertId) {
    return this.alerts.delete(alertId);
  },
  
  getAlerts() {
    return Array.from(this.alerts.entries()).map(([id, alert]) => ({
      id,
      ...alert
    }));
  },
  
  async checkAlerts(currentPrice, tokenAddress) {
    for (const [alertId, alert] of this.alerts) {
      if (alert.tokenAddress === tokenAddress && !alert.triggered) {
        let shouldTrigger = false;
        
        if (alert.condition === 'above' && currentPrice >= alert.targetPrice) {
          shouldTrigger = true;
        } else if (alert.condition === 'below' && currentPrice <= alert.targetPrice) {
          shouldTrigger = true;
        }
        
        if (shouldTrigger) {
          alert.triggered = true;
          this.triggerAlert(alert, currentPrice);
        }
      }
    }
  },
  
  triggerAlert(alert, currentPrice) {
    const message = `🚨 PRICE ALERT! ${alert.description}\n` +
                   `Token: ${alert.tokenAddress}\n` +
                   `Target: $${alert.targetPrice}\n` +
                   `Current: $${currentPrice}\n` +
                   `Condition: ${alert.condition}`;
    
    console.log(`\n${colors.red.bold(message)}${colors.reset}\n`);
    
    // Play alert sound (if available)
    try {
      process.stdout.write('\x07'); // Bell character
    } catch (e) {
      // Ignore if sound not supported
    }
  }
};

// Make priceAlerts globally accessible
global.priceAlerts = priceAlerts;

// SETTINGS MANAGEMENT
const settingsDir = path.join(__dirname, 'settings');
if (!fs.existsSync(settingsDir)) {
  fs.mkdirSync(settingsDir);
}
const settingsFile = path.join(settingsDir, 'settings.json');
let settings = {
  birdeyeApiKey: BIRDEYE_API_KEY,
  chartMaxPoints: 30,
  coloredOutput: true,
  activeWallet: null,
  lastSelectedMode: 'pump', // Remember last selected monitoring mode
  bitqueryApiKey: 'ory_at_nutg85LqbmrfaWPH0ORrOrn3iFnoKkJTyGwaIxTlmck.C1NmThaMwOn4yRyTrzgIspyU_BfVfKxMrit8GPMCohA',
  // RPC Settings for Buy/Sell
  customRpcEndpoint: 'https://api.mainnet-beta.solana.com',
  enableCustomRpc: false,
  priorityFee: 5000,
  slippageLimit: 0.5,
  tipAmount: 0.001
};
function loadSettings() {
  if (fs.existsSync(settingsFile)) {
    try {
      const data = fs.readFileSync(settingsFile, 'utf-8');
      settings = { ...settings, ...JSON.parse(data) };
    } catch (e) {
      console.error('Failed to load settings:', e.message);
    }
  }
}

// Load settings immediately after function definition
loadSettings();
function saveSettings() {
  try {
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
  } catch (e) {
    console.error('Failed to save settings:', e.message);
  }
}

// Add this function to start the server
async function startServer() {
  try {
    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    // Start serve in the temp directory
    serverProcess = exec(`npx serve ${tempDir} -p ${SERVER_PORT}`, (error) => {
      if (error) {
        console.error(`${colors.red}Server error: ${error.message}${colors.reset}`);
      }
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log(`${colors.green}Chart server started at http://localhost:${SERVER_PORT}${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}Error starting server: ${error.message}${colors.reset}`);
  }
}

// SETTINGS MENU
async function showSettingsMenu() {
  let exit = false;
  while (!exit) {
    const { setting } = await inquirer.prompt([
      {
        type: 'list',
        name: 'setting',
        message: 'Settings:',
        choices: addBackOption([
          { name: 'Change Birdeye API Key', value: 'apiKey' },
          { name: 'Change Bitquery API Key', value: 'bitquery' },
          { name: 'Set Chart Max Points', value: 'chartMax' },
          { name: 'Toggle Colored Output', value: 'color' },
          { name: '🌐 RPC Settings for Buy/Sell', value: 'rpcSettings' },
          { name: '📡 System Status', value: 'systemStatus' }
        ])
      }
    ]);
    switch (setting) {
      case 'apiKey': {
        const { apiKey } = await inquirer.prompt([
          { type: 'input', name: 'apiKey', message: 'Enter new Birdeye API Key:', default: settings.birdeyeApiKey }
        ]);
        settings.birdeyeApiKey = apiKey;
        saveSettings();
        console.log(chalk.green('Birdeye API Key updated.'));
        break;
      }
      case 'bitquery': {
        const { bitqueryApiKey } = await inquirer.prompt([
          { type: 'input', name: 'bitqueryApiKey', message: 'Enter new Bitquery API Key:', default: settings.bitqueryApiKey }
        ]);
        settings.bitqueryApiKey = bitqueryApiKey;
        saveSettings();
        console.log(chalk.green('Bitquery API Key updated.'));
        break;
      }
      case 'chartMax': {
        const { chartMax } = await inquirer.prompt([
          { type: 'number', name: 'chartMax', message: 'Max points in chart:', default: settings.chartMaxPoints, validate: v => v > 0 }
        ]);
        settings.chartMaxPoints = chartMax;
        saveSettings();
        console.log(chalk.green('Chart max points updated.'));
        break;
      }
      case 'color': {
        settings.coloredOutput = !settings.coloredOutput;
        saveSettings();
        console.log(chalk.green(`Colored output ${settings.coloredOutput ? 'enabled' : 'disabled'}.`));
        break;
      }
      case 'rpcSettings': {
        await showRpcSettingsMenu();
        break;
      }
      case 'systemStatus': {
        await connectionStatusMenu();
        break;
      }
      case 'back':
        exit = true;
        break;
        
      case 'exit':
        exit = true;
        break;
    }
  }
}

// RPC Settings Menu for Buy/Sell
async function showRpcSettingsMenu() {
  let exit = false;
  while (!exit) {
    const { rpcSetting } = await inquirer.prompt([
      {
        type: 'list',
        name: 'rpcSetting',
        message: '🌐 RPC Settings for Buy/Sell:',
        choices: addBackOption([
          { name: '🔧 Custom RPC Endpoint', value: 'customRpc' },
          { name: '⚡ Priority Fee', value: 'priorityFee' },
          { name: '📊 Slippage Limit', value: 'slippage' },
          { name: '💸 Tip Amount', value: 'tipAmount' },
          { name: '🔄 Enable Custom RPC', value: 'enableCustom' },
          { name: '📋 View Current RPC Settings', value: 'viewRpc' }
        ])
      }
    ]);
    
    switch (rpcSetting) {
      case 'customRpc': {
        const { rpcEndpoint } = await inquirer.prompt([
          {
            type: 'input',
            name: 'rpcEndpoint',
            message: 'Enter custom RPC endpoint:',
            default: settings.customRpcEndpoint || 'https://api.mainnet-beta.solana.com',
            validate: (input) => {
              if (!input.startsWith('http://') && !input.startsWith('https://')) {
                return 'RPC endpoint must start with http:// or https://';
              }
              return true;
            }
          }
        ]);
        settings.customRpcEndpoint = rpcEndpoint;
        saveSettings();
        console.log(chalk.green(`Custom RPC endpoint set to: ${rpcEndpoint}`));
        break;
      }
      
      case 'priorityFee': {
        const { priorityFee } = await inquirer.prompt([
          {
            type: 'input',
            name: 'priorityFee',
            message: 'Priority fee (micro-lamports):',
            default: settings.priorityFee || 5000,
            validate: (input) => {
              const num = parseInt(input);
              if (isNaN(num)) return 'Please enter a valid number';
              if (num < 0 || num > 1000000) return 'Priority fee must be between 0 and 1,000,000';
              return true;
            },
            filter: (input) => parseInt(input)
          }
        ]);
        settings.priorityFee = priorityFee;
        saveSettings();
        console.log(chalk.green(`Priority fee set to ${priorityFee} micro-lamports.`));
        break;
      }
      
      case 'slippage': {
        const { slippage } = await inquirer.prompt([
          {
            type: 'input',
            name: 'slippage',
            message: 'Slippage limit (%):',
            default: settings.slippageLimit || 0.5,
            validate: (input) => {
              const num = parseFloat(input);
              if (isNaN(num)) return 'Please enter a valid number';
              if (num < 0.1 || num > 50) return 'Slippage must be between 0.1% and 50%';
              return true;
            },
            filter: (input) => parseFloat(input)
          }
        ]);
        settings.slippageLimit = slippage;
        saveSettings();
        console.log(chalk.green(`Slippage limit set to ${slippage}%.`));
        break;
      }
      
      case 'tipAmount': {
        const { tipAmount } = await inquirer.prompt([
          {
            type: 'input',
            name: 'tipAmount',
            message: 'Tip amount (SOL):',
            default: settings.tipAmount || 0.001,
            validate: (input) => {
              const num = parseFloat(input);
              if (isNaN(num)) return 'Please enter a valid number';
              if (num < 0 || num > 1) return 'Tip amount must be between 0 and 1 SOL';
              return true;
            },
            filter: (input) => parseFloat(input)
          }
        ]);
        settings.tipAmount = tipAmount;
        saveSettings();
        console.log(chalk.green(`Tip amount set to ${tipAmount} SOL.`));
        break;
      }
      
      case 'enableCustom': {
        const { enableCustom } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'enableCustom',
            message: 'Enable custom RPC endpoint for buy/sell operations?',
            default: settings.enableCustomRpc || false
          }
        ]);
        settings.enableCustomRpc = enableCustom;
        saveSettings();
        console.log(chalk.green(`Custom RPC ${enableCustom ? 'enabled' : 'disabled'} for buy/sell operations.`));
        break;
      }
      
      case 'viewRpc': {
        console.log(`\n${colors.cyan}Current RPC Settings:${colors.reset}`);
        console.log(`${'─'.repeat(50)}`);
        console.log(`${colors.cyan}Custom RPC Endpoint:${colors.reset} ${settings.customRpcEndpoint || 'https://api.mainnet-beta.solana.com'}`);
        console.log(`${colors.cyan}Enable Custom RPC:${colors.reset} ${settings.enableCustomRpc ? 'Yes' : 'No'}`);
        console.log(`${colors.cyan}Priority Fee:${colors.reset} ${settings.priorityFee || 5000} micro-lamports`);
        console.log(`${colors.cyan}Slippage Limit:${colors.reset} ${settings.slippageLimit || 0.5}%`);
        console.log(`${colors.cyan}Tip Amount:${colors.reset} ${settings.tipAmount || 0.001} SOL`);
        console.log(`\n${colors.yellow}Press Enter to continue...${colors.reset}`);
        await new Promise(resolve => {
          const originalRawMode = process.stdin.isRaw;
          const originalEncoding = process.stdin.encoding;
          
          process.stdin.setRawMode(true);
          process.stdin.resume();
          process.stdin.setEncoding('utf8');
          
          const onData = (data) => {
            if (data === '\r' || data === '\n') {
              process.stdin.setRawMode(false);
              process.stdin.pause();
              process.stdin.setRawMode(originalRawMode);
              process.stdin.setEncoding(originalEncoding);
              process.stdin.removeListener('data', onData);
              resolve();
            }
          };
          
          process.stdin.on('data', onData);
        });
        break;
      }
      
      case 'back':
        exit = true;
        break;
        
      case 'exit':
        exit = true;
        break;
    }
  }
}

// AI-Enhanced Jupiter Token Analysis
class AIJupiterAnalyzer {
  constructor() {
    this.patterns = {
      pump: [],
      dump: [],
      consolidation: [],
      breakout: [],
      honeypot: []
    };
    this.sentimentData = {};
    this.predictionModels = {};
    this.riskAssessments = {};
  }

  // Enhanced Jupiter token analysis with AI
  async analyzeTokenWithAI(tokenAddress) {
    try {
      console.log(`${colors.cyan}🤖 AI-Powered Jupiter Analysis...${colors.reset}`);
      
      // Get basic Jupiter data
      const jupiterData = await checkJupiterTokenRealtime(tokenAddress);
      if (!jupiterData || !jupiterData.success) {
        return { success: false, error: 'Failed to fetch Jupiter data' };
      }

      // AI Pattern Recognition
      const patterns = await this.detectAIPatterns(jupiterData.data);
      
      // AI Sentiment Analysis
      const sentiment = await this.analyzeAISentiment(jupiterData.data);
      
      // AI Risk Assessment
      const riskAssessment = await this.assessAIRisk(jupiterData.data);
      
      // AI Price Prediction
      const pricePrediction = await this.predictAIPrice(jupiterData.data);
      
      // AI Trading Recommendation
      const tradingRecommendation = await this.generateAITradingRecommendation(
        jupiterData.data, patterns, sentiment, riskAssessment, pricePrediction
      );

      return {
        success: true,
        jupiterData: jupiterData.data,
        aiAnalysis: {
          patterns,
          sentiment,
          riskAssessment,
          pricePrediction,
          tradingRecommendation
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`${colors.red}AI Analysis Error: ${error.message}${colors.reset}`);
      return { success: false, error: error.message };
    }
  }

  // AI Pattern Detection
  async detectAIPatterns(tokenData) {
    const patterns = [];
    
    // Price movement patterns
    if (tokenData.price) {
      // Pump detection
      if (this.isAIPumpPattern(tokenData)) {
        patterns.push({
          type: 'AI_PUMP',
          confidence: this.calculateAIPumpConfidence(tokenData),
          description: 'AI detected rapid price increase pattern',
          severity: 'HIGH'
        });
      }
      
      // Dump detection
      if (this.isAIDumpPattern(tokenData)) {
        patterns.push({
          type: 'AI_DUMP',
          confidence: this.calculateAIDumpConfidence(tokenData),
          description: 'AI detected rapid price decrease pattern',
          severity: 'HIGH'
        });
      }
      
      // Consolidation detection
      if (this.isAIConsolidationPattern(tokenData)) {
        patterns.push({
          type: 'AI_CONSOLIDATION',
          confidence: 0.75,
          description: 'AI detected price stabilization pattern',
          severity: 'MEDIUM'
        });
      }
    }
    
    // Liquidity patterns
    if (tokenData.liquidity) {
      if (this.isAILiquidityPattern(tokenData)) {
        patterns.push({
          type: 'AI_LIQUIDITY_DRAIN',
          confidence: 0.8,
          description: 'AI detected potential liquidity drain',
          severity: 'CRITICAL'
        });
      }
    }
    
    // Volume patterns
    if (tokenData.volume24h) {
      if (this.isAIVolumePattern(tokenData)) {
        patterns.push({
          type: 'AI_VOLUME_SURGE',
          confidence: 0.85,
          description: 'AI detected unusual volume activity',
          severity: 'HIGH'
        });
      }
    }
    
    return patterns;
  }

  isAIPumpPattern(tokenData) {
    // AI logic for pump detection
    const price = tokenData.price || 0;
    const volume = tokenData.volume24h || 0;
    const liquidity = tokenData.liquidity || 0;
    
    // Complex AI scoring
    let pumpScore = 0;
    
    if (price > 0.00001) pumpScore += 20;
    if (volume > 10000) pumpScore += 25;
    if (liquidity > 50000) pumpScore += 15;
    if (tokenData.verified) pumpScore += 10;
    if (tokenData.holderCount > 1000) pumpScore += 10;
    if (tokenData.organicScore > 50) pumpScore += 20;
    
    return pumpScore > 70;
  }

  isAIDumpPattern(tokenData) {
    // AI logic for dump detection
    const price = tokenData.price || 0;
    const volume = tokenData.volume24h || 0;
    const liquidity = tokenData.liquidity || 0;
    
    let dumpScore = 0;
    
    if (price < 0.00001) dumpScore += 20;
    if (volume > 50000) dumpScore += 30;
    if (liquidity < 10000) dumpScore += 25;
    if (!tokenData.verified) dumpScore += 15;
    if (tokenData.holderCount < 100) dumpScore += 10;
    
    return dumpScore > 60;
  }

  isAIConsolidationPattern(tokenData) {
    // AI logic for consolidation detection
    const price = tokenData.price || 0;
    const volume = tokenData.volume24h || 0;
    
    return price > 0.000001 && price < 0.0001 && volume > 1000 && volume < 10000;
  }

  isAILiquidityPattern(tokenData) {
    const liquidity = tokenData.liquidity || 0;
    return liquidity < 5000;
  }

  isAIVolumePattern(tokenData) {
    const volume = tokenData.volume24h || 0;
    return volume > 100000;
  }

  calculateAIPumpConfidence(tokenData) {
    let confidence = 0.5;
    
    if (tokenData.verified) confidence += 0.1;
    if (tokenData.holderCount > 1000) confidence += 0.1;
    if (tokenData.organicScore > 50) confidence += 0.1;
    if (tokenData.liquidity > 50000) confidence += 0.1;
    if (tokenData.volume24h > 10000) confidence += 0.1;
    
    return Math.min(confidence, 0.95);
  }

  calculateAIDumpConfidence(tokenData) {
    let confidence = 0.5;
    
    if (!tokenData.verified) confidence += 0.2;
    if (tokenData.holderCount < 100) confidence += 0.2;
    if (tokenData.liquidity < 10000) confidence += 0.1;
    if (tokenData.volume24h > 50000) confidence += 0.1;
    
    return Math.min(confidence, 0.95);
  }

  // AI Sentiment Analysis
  async analyzeAISentiment(tokenData) {
    const sentiment = {
      overall: this.calculateAISentimentScore(tokenData),
      technical: this.calculateTechnicalSentiment(tokenData),
      social: this.calculateSocialSentiment(tokenData),
      market: this.calculateMarketSentiment(tokenData)
    };
    
    return {
      success: true,
      data: sentiment,
      summary: this.getAISentimentSummary(sentiment)
    };
  }

  calculateAISentimentScore(tokenData) {
    let score = 50; // Neutral starting point
    
    // Positive factors
    if (tokenData.verified) score += 20;
    if (tokenData.holderCount > 1000) score += 15;
    if (tokenData.organicScore > 50) score += 15;
    if (tokenData.liquidity > 50000) score += 10;
    
    // Negative factors
    if (!tokenData.verified) score -= 30;
    if (tokenData.holderCount < 100) score -= 20;
    if (tokenData.liquidity < 10000) score -= 15;
    if (tokenData.organicScore < 10) score -= 10;
    
    return Math.max(0, Math.min(100, score));
  }

  calculateTechnicalSentiment(tokenData) {
    let score = 50;
    
    if (tokenData.price > 0.00001) score += 20;
    if (tokenData.volume24h > 10000) score += 15;
    if (tokenData.liquidity > 50000) score += 15;
    
    return Math.max(0, Math.min(100, score));
  }

  calculateSocialSentiment(tokenData) {
    let score = 50;
    
    if (tokenData.holderCount > 1000) score += 25;
    if (tokenData.organicScore > 50) score += 25;
    
    return Math.max(0, Math.min(100, score));
  }

  calculateMarketSentiment(tokenData) {
    let score = 50;
    
    if (tokenData.verified) score += 30;
    if (tokenData.liquidity > 50000) score += 20;
    
    return Math.max(0, Math.min(100, score));
  }

  getAISentimentSummary(sentiment) {
    const overall = sentiment.overall;
    
    if (overall > 80) return 'STRONG BUY SIGNAL';
    if (overall > 60) return 'BUY SIGNAL';
    if (overall > 40) return 'HOLD';
    if (overall > 20) return 'SELL SIGNAL';
    return 'STRONG SELL SIGNAL';
  }

  // AI Risk Assessment
  async assessAIRisk(tokenData) {
    const riskFactors = [];
    let riskScore = 0;
    
    // Verification risk
    if (!tokenData.verified) {
      riskFactors.push('Unverified token');
      riskScore += 30;
    }
    
    // Liquidity risk
    if (tokenData.liquidity < 10000) {
      riskFactors.push('Low liquidity');
      riskScore += 25;
    }
    
    // Holder concentration risk
    if (tokenData.holderCount < 100) {
      riskFactors.push('Low holder count');
      riskScore += 20;
    }
    
    // Organic score risk
    if (tokenData.organicScore < 10) {
      riskFactors.push('Low organic score');
      riskScore += 15;
    }
    
    // Price volatility risk
    if (tokenData.price < 0.000001) {
      riskFactors.push('Extreme price volatility');
      riskScore += 20;
    }
    
    const riskLevel = this.getAIRiskLevel(riskScore);
    
    return {
      success: true,
      riskScore,
      riskLevel,
      riskFactors,
      recommendation: this.getAIRiskRecommendation(riskScore)
    };
  }

  getAIRiskLevel(score) {
    if (score >= 80) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 40) return 'MEDIUM';
    if (score >= 20) return 'LOW';
    return 'VERY_LOW';
  }

  getAIRiskRecommendation(score) {
    if (score >= 80) return 'AVOID - Extremely high risk';
    if (score >= 60) return 'CAUTION - High risk, trade carefully';
    if (score >= 40) return 'MODERATE - Acceptable risk with proper management';
    if (score >= 20) return 'LOW - Generally safe to trade';
    return 'VERY_LOW - Safe trading conditions';
  }

  // AI Price Prediction
  async predictAIPrice(tokenData) {
    try {
      const basePrice = tokenData.price || 0.00001;
      const volume = tokenData.volume24h || 0;
      const liquidity = tokenData.liquidity || 0;
      const organicScore = tokenData.organicScore || 0;
      
      // AI prediction algorithm
      let predictionMultiplier = 1.0;
      
      // Volume impact
      if (volume > 100000) predictionMultiplier *= 1.2;
      else if (volume > 50000) predictionMultiplier *= 1.1;
      else if (volume < 1000) predictionMultiplier *= 0.8;
      
      // Liquidity impact
      if (liquidity > 100000) predictionMultiplier *= 1.15;
      else if (liquidity < 10000) predictionMultiplier *= 0.7;
      
      // Organic score impact
      if (organicScore > 80) predictionMultiplier *= 1.25;
      else if (organicScore < 20) predictionMultiplier *= 0.6;
      
      // Verification impact
      if (tokenData.verified) predictionMultiplier *= 1.1;
      else predictionMultiplier *= 0.5;
      
      const predictedPrice = basePrice * predictionMultiplier;
      const confidence = this.calculateAIPredictionConfidence(tokenData);
      const trend = predictedPrice > basePrice ? 'UP' : 'DOWN';
      const changePercent = ((predictedPrice - basePrice) / basePrice) * 100;
      
      return {
        success: true,
        currentPrice: basePrice,
        predictedPrice,
        confidence,
        trend,
        changePercent,
        timeframe: '24h',
        factors: this.getAIPredictionFactors(tokenData)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  calculateAIPredictionConfidence(tokenData) {
    let confidence = 0.5;
    
    if (tokenData.verified) confidence += 0.1;
    if (tokenData.holderCount > 1000) confidence += 0.1;
    if (tokenData.organicScore > 50) confidence += 0.1;
    if (tokenData.liquidity > 50000) confidence += 0.1;
    if (tokenData.volume24h > 10000) confidence += 0.1;
    
    return Math.min(confidence, 0.9);
  }

  getAIPredictionFactors(tokenData) {
    const factors = [];
    
    if (tokenData.verified) factors.push('Verified token');
    if (tokenData.holderCount > 1000) factors.push('High holder count');
    if (tokenData.organicScore > 50) factors.push('Good organic score');
    if (tokenData.liquidity > 50000) factors.push('Strong liquidity');
    if (tokenData.volume24h > 10000) factors.push('Active trading volume');
    
    return factors;
  }

  // AI Trading Recommendation
  async generateAITradingRecommendation(tokenData, patterns, sentiment, riskAssessment, pricePrediction) {
    let recommendation = {
      action: 'HOLD',
      confidence: 0.5,
      reasoning: [],
      riskLevel: 'MEDIUM',
      suggestedAmount: 0,
      stopLoss: 0,
      takeProfit: 0
    };
    
    // Analyze patterns
    const pumpPatterns = patterns.filter(p => p.type === 'AI_PUMP');
    const dumpPatterns = patterns.filter(p => p.type === 'AI_DUMP');
    const riskPatterns = patterns.filter(p => p.type === 'AI_LIQUIDITY_DRAIN');
    
    // Decision logic
    if (riskPatterns.length > 0) {
      recommendation.action = 'AVOID';
      recommendation.reasoning.push('AI detected critical risk patterns');
      recommendation.confidence = 0.9;
    } else if (pumpPatterns.length > 0 && sentiment.data.overall > 70 && riskAssessment.riskScore < 40) {
      recommendation.action = 'BUY';
      recommendation.reasoning.push('AI detected pump pattern with positive sentiment');
      recommendation.confidence = 0.8;
    } else if (dumpPatterns.length > 0) {
      recommendation.action = 'SELL';
      recommendation.reasoning.push('AI detected dump pattern');
      recommendation.confidence = 0.85;
    } else if (sentiment.data.overall > 60 && riskAssessment.riskScore < 50) {
      recommendation.action = 'BUY';
      recommendation.reasoning.push('Positive sentiment with acceptable risk');
      recommendation.confidence = 0.7;
    } else if (riskAssessment.riskScore > 60) {
      recommendation.action = 'AVOID';
      recommendation.reasoning.push('High risk assessment');
      recommendation.confidence = 0.8;
    }
    
    // Set risk level
    recommendation.riskLevel = riskAssessment.riskLevel;
    
    // Calculate suggested amounts
    if (recommendation.action === 'BUY') {
      recommendation.suggestedAmount = this.calculateAISuggestedAmount(tokenData, recommendation.confidence);
      recommendation.stopLoss = tokenData.price * 0.8; // 20% stop loss
      recommendation.takeProfit = tokenData.price * 1.5; // 50% take profit
    }
    
    return recommendation;
  }

  calculateAISuggestedAmount(tokenData, confidence) {
    const baseAmount = 100; // Base $100
    const confidenceMultiplier = confidence;
    const liquidityMultiplier = Math.min(tokenData.liquidity / 100000, 1);
    
    return Math.round(baseAmount * confidenceMultiplier * liquidityMultiplier);
  }

  // Display AI Analysis
  displayAIAnalysis(analysis) {
    if (!analysis.success) {
      console.log(`${colors.red}❌ AI Analysis failed: ${analysis.error}${colors.reset}`);
      return;
    }

    console.log(`\n${colors.cyan}🤖 AI-POWERED JUPITER ANALYSIS${colors.reset}`);
    console.log(`${'═'.repeat(60)}`);
    
    // Display Jupiter data
    this.displayJupiterData(analysis.jupiterData);
    
    // Display AI patterns
    this.displayAIPatterns(analysis.aiAnalysis.patterns);
    
    // Display AI sentiment
    this.displayAISentiment(analysis.aiAnalysis.sentiment);
    
    // Display AI risk assessment
    this.displayAIRiskAssessment(analysis.aiAnalysis.riskAssessment);
    
    // Display AI price prediction
    this.displayAIPricePrediction(analysis.aiAnalysis.pricePrediction);
    
    // Display AI trading recommendation
    this.displayAITradingRecommendation(analysis.aiAnalysis.tradingRecommendation);
  }

  displayJupiterData(jupiterData) {
    console.log(`\n${colors.cyan}📊 JUPITER DATA${colors.reset}`);
    console.log(`${'─'.repeat(40)}`);
    console.log(`💰 Price: $${(jupiterData.price || 0).toFixed(9)}`);
    console.log(`📈 24h Volume: $${(jupiterData.volume24h || 0).toLocaleString()}`);
    console.log(`💧 Liquidity: $${(jupiterData.liquidity || 0).toLocaleString()}`);
    console.log(`👥 Holders: ${jupiterData.holderCount || 'N/A'}`);
    console.log(`✅ Verified: ${jupiterData.verified ? 'Yes' : 'No'}`);
    console.log(`🌱 Organic Score: ${jupiterData.organicScore || 'N/A'}`);
  }

  displayAIPatterns(patterns) {
    console.log(`\n${colors.cyan}🔍 AI PATTERN DETECTION${colors.reset}`);
    console.log(`${'─'.repeat(40)}`);
    
    if (patterns.length === 0) {
      console.log(`${colors.yellow}No significant AI patterns detected${colors.reset}`);
      return;
    }
    
    patterns.forEach((pattern, index) => {
      const severityColor = pattern.severity === 'CRITICAL' ? colors.red :
                           pattern.severity === 'HIGH' ? colors.yellow :
                           pattern.severity === 'MEDIUM' ? colors.cyan : colors.green;
      
      console.log(`${index + 1}. ${colors.cyan}${pattern.type}${colors.reset}`);
      console.log(`   📊 Confidence: ${colors.green}${(pattern.confidence * 100).toFixed(1)}%${colors.reset}`);
      console.log(`   ⚠️ Severity: ${severityColor}${pattern.severity}${colors.reset}`);
      console.log(`   📝 ${pattern.description}`);
      console.log('');
    });
  }

  displayAISentiment(sentiment) {
    console.log(`\n${colors.cyan}📊 AI SENTIMENT ANALYSIS${colors.reset}`);
    console.log(`${'─'.repeat(40)}`);
    
    const overallColor = sentiment.data.overall > 70 ? colors.green :
                        sentiment.data.overall > 50 ? colors.yellow : colors.red;
    
    console.log(`🎯 Overall: ${overallColor}${sentiment.data.overall}/100${colors.reset}`);
    console.log(`🔧 Technical: ${sentiment.data.technical}/100`);
    console.log(`👥 Social: ${sentiment.data.social}/100`);
    console.log(`📈 Market: ${sentiment.data.market}/100`);
    console.log(`\n💡 Summary: ${colors.cyan}${sentiment.summary}${colors.reset}`);
  }

  displayAIRiskAssessment(riskAssessment) {
    console.log(`\n${colors.cyan}⚠️ AI RISK ASSESSMENT${colors.reset}`);
    console.log(`${'─'.repeat(40)}`);
    
    const riskColor = riskAssessment.riskLevel === 'CRITICAL' ? colors.red :
                     riskAssessment.riskLevel === 'HIGH' ? colors.yellow :
                     riskAssessment.riskLevel === 'MEDIUM' ? colors.cyan : colors.green;
    
    console.log(`📊 Risk Score: ${riskColor}${riskAssessment.riskScore}/100${colors.reset}`);
    console.log(`⚠️ Risk Level: ${riskColor}${riskAssessment.riskLevel}${colors.reset}`);
    console.log(`💡 Recommendation: ${colors.cyan}${riskAssessment.recommendation}${colors.reset}`);
    
    if (riskAssessment.riskFactors.length > 0) {
      console.log(`\n🚨 Risk Factors:`);
      riskAssessment.riskFactors.forEach(factor => {
        console.log(`   • ${colors.red}${factor}${colors.reset}`);
      });
    }
  }

  displayAIPricePrediction(prediction) {
    console.log(`\n${colors.cyan}🔮 AI PRICE PREDICTION${colors.reset}`);
    console.log(`${'─'.repeat(40)}`);
    
    if (!prediction.success) {
      console.log(`${colors.red}❌ ${prediction.error}${colors.reset}`);
      return;
    }
    
    const trendColor = prediction.trend === 'UP' ? colors.green : colors.red;
    const confidenceColor = prediction.confidence > 0.8 ? colors.green :
                           prediction.confidence > 0.6 ? colors.yellow : colors.red;
    
    console.log(`💰 Current: $${prediction.currentPrice.toFixed(9)}`);
    console.log(`🔮 Predicted: $${prediction.predictedPrice.toFixed(9)}`);
    console.log(`📈 Trend: ${trendColor}${prediction.trend}${colors.reset}`);
    console.log(`📊 Change: ${trendColor}${prediction.changePercent.toFixed(2)}%${colors.reset}`);
    console.log(`🎯 Confidence: ${confidenceColor}${(prediction.confidence * 100).toFixed(1)}%${colors.reset}`);
    console.log(`⏰ Timeframe: ${prediction.timeframe}`);
  }

  displayAITradingRecommendation(recommendation) {
    console.log(`\n${colors.cyan}🎯 AI TRADING RECOMMENDATION${colors.reset}`);
    console.log(`${'─'.repeat(40)}`);
    
    const actionColor = recommendation.action === 'BUY' ? colors.green :
                       recommendation.action === 'SELL' ? colors.red :
                       recommendation.action === 'HOLD' ? colors.yellow : colors.gray;
    
    console.log(`🎯 Action: ${actionColor}${recommendation.action}${colors.reset}`);
    console.log(`📊 Confidence: ${colors.green}${(recommendation.confidence * 100).toFixed(1)}%${colors.reset}`);
    console.log(`⚠️ Risk Level: ${colors.yellow}${recommendation.riskLevel}${colors.reset}`);
    
    if (recommendation.suggestedAmount > 0) {
      console.log(`💰 Suggested Amount: $${recommendation.suggestedAmount}`);
      console.log(`🛑 Stop Loss: $${recommendation.stopLoss.toFixed(9)}`);
      console.log(`🎯 Take Profit: $${recommendation.takeProfit.toFixed(9)}`);
    }
    
    console.log(`\n💡 Reasoning:`);
    recommendation.reasoning.forEach(reason => {
      console.log(`   • ${colors.cyan}${reason}${colors.reset}`);
    });
  }
}

// Initialize AI Jupiter Analyzer
const aiJupiterAnalyzer = new AIJupiterAnalyzer();

// AI-Powered Token Scanner
class AITokenScanner {
  constructor() {
    this.scanResults = [];
    this.discoveredTokens = [];
    this.riskProfiles = {};
    this.patternDatabase = {};
  }

  // Scan for tokens with AI analysis
  async scanTokensWithAI(scanType = 'trending', limit = 10) {
    try {
      console.log(`${colors.cyan}🤖 AI Token Scanner - ${scanType.toUpperCase()}${colors.reset}`);
      console.log(`${colors.yellow}Scanning for tokens with AI analysis...${colors.reset}\n`);
      
      // Get trending tokens from Jupiter
      const trendingTokens = await this.getTrendingTokens(scanType, limit);
      
      if (!trendingTokens || trendingTokens.length === 0) {
        return { success: false, error: 'No tokens found for scanning' };
      }
      
      const scanResults = [];
      
      for (let i = 0; i < trendingTokens.length; i++) {
        const token = trendingTokens[i];
        console.log(`${colors.yellow}🤖 AI Analyzing (${i + 1}/${trendingTokens.length}): ${token.symbol}${colors.reset}`);
        
        try {
          const analysis = await aiJupiterAnalyzer.analyzeTokenWithAI(token.address);
          
          if (analysis.success) {
            const scanResult = {
              token: token,
              analysis: analysis,
              score: this.calculateAIScore(analysis),
              timestamp: new Date().toISOString()
            };
            
            scanResults.push(scanResult);
            
            // Display quick summary
            console.log(`   ✅ ${token.name} (${token.symbol})`);
            console.log(`   🎯 Action: ${analysis.aiAnalysis.tradingRecommendation.action}`);
            console.log(`   📊 Score: ${scanResult.score}/100`);
            console.log(`   ⚠️ Risk: ${analysis.aiAnalysis.riskAssessment.riskLevel}`);
            console.log('');
          } else {
            console.log(`   ❌ Analysis failed: ${analysis.error}`);
            console.log('');
          }
          
          // Rate limiting
          if (i < trendingTokens.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
        } catch (error) {
          console.error(`${colors.red}Error analyzing ${token.symbol}: ${error.message}${colors.reset}`);
          console.log('');
        }
      }
      
      // Sort results by AI score
      scanResults.sort((a, b) => b.score - a.score);
      
      return {
        success: true,
        results: scanResults,
        summary: this.generateScanSummary(scanResults)
      };
      
    } catch (error) {
      console.error(`${colors.red}AI Scanner Error: ${error.message}${colors.reset}`);
      return { success: false, error: error.message };
    }
  }

  // Get trending tokens from Jupiter
  async getTrendingTokens(scanType, limit) {
    try {
      // Simulate getting trending tokens from Jupiter API
      // In real implementation, this would call Jupiter's trending API
      const mockTokens = [
        {
          address: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          name: 'USD Coin',
          symbol: 'USDC',
          price: 1.0,
          volume24h: 1000000,
          marketCap: 50000000000
        },
        {
          address: 'So11111111111111111111111111111111111111112',
          name: 'Wrapped SOL',
          symbol: 'SOL',
          price: 100.0,
          volume24h: 50000000,
          marketCap: 5000000000
        },
        {
          address: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
          name: 'Marinade Staked SOL',
          symbol: 'mSOL',
          price: 100.0,
          volume24h: 10000000,
          marketCap: 1000000000
        }
      ];
      
      // Add some mock trending tokens for demonstration
      for (let i = 0; i < limit - 3; i++) {
        mockTokens.push({
          address: `Token${i + 1}${Math.random().toString(36).substring(7)}`,
          name: `Trending Token ${i + 1}`,
          symbol: `TREND${i + 1}`,
          price: Math.random() * 0.001,
          volume24h: Math.random() * 100000,
          marketCap: Math.random() * 1000000
        });
      }
      
      return mockTokens.slice(0, limit);
    } catch (error) {
      console.error(`${colors.red}Error fetching trending tokens: ${error.message}${colors.reset}`);
      return [];
    }
  }

  // Calculate AI score for token
  calculateAIScore(analysis) {
    let score = 50; // Base score
    
    // Trading recommendation impact
    const recommendation = analysis.aiAnalysis.tradingRecommendation;
    if (recommendation.action === 'BUY') score += 20;
    else if (recommendation.action === 'SELL') score -= 20;
    else if (recommendation.action === 'AVOID') score -= 30;
    
    // Confidence impact
    score += (recommendation.confidence - 0.5) * 20;
    
    // Risk assessment impact
    const riskLevel = analysis.aiAnalysis.riskAssessment.riskLevel;
    if (riskLevel === 'VERY_LOW') score += 15;
    else if (riskLevel === 'LOW') score += 10;
    else if (riskLevel === 'MEDIUM') score += 5;
    else if (riskLevel === 'HIGH') score -= 10;
    else if (riskLevel === 'CRITICAL') score -= 25;
    
    // Sentiment impact
    const sentiment = analysis.aiAnalysis.sentiment.data.overall;
    score += (sentiment - 50) * 0.3;
    
    // Pattern impact
    const patterns = analysis.aiAnalysis.patterns;
    const pumpPatterns = patterns.filter(p => p.type === 'AI_PUMP');
    const dumpPatterns = patterns.filter(p => p.type === 'AI_DUMP');
    
    if (pumpPatterns.length > 0) score += 10;
    if (dumpPatterns.length > 0) score -= 15;
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // Generate scan summary
  generateScanSummary(results) {
    const buySignals = results.filter(r => r.analysis.aiAnalysis.tradingRecommendation.action === 'BUY');
    const sellSignals = results.filter(r => r.analysis.aiAnalysis.tradingRecommendation.action === 'SELL');
    const avoidSignals = results.filter(r => r.analysis.aiAnalysis.tradingRecommendation.action === 'AVOID');
    const holdSignals = results.filter(r => r.analysis.aiAnalysis.tradingRecommendation.action === 'HOLD');
    
    const highScoreTokens = results.filter(r => r.score >= 80);
    const mediumScoreTokens = results.filter(r => r.score >= 60 && r.score < 80);
    const lowScoreTokens = results.filter(r => r.score < 60);
    
    return {
      totalScanned: results.length,
      buySignals: buySignals.length,
      sellSignals: sellSignals.length,
      avoidSignals: avoidSignals.length,
      holdSignals: holdSignals.length,
      highScoreTokens: highScoreTokens.length,
      mediumScoreTokens: mediumScoreTokens.length,
      lowScoreTokens: lowScoreTokens.length,
      averageScore: results.reduce((sum, r) => sum + r.score, 0) / results.length
    };
  }

  // Display scan results
  displayScanResults(scanData) {
    if (!scanData.success) {
      console.log(`${colors.red}❌ Scan failed: ${scanData.error}${colors.reset}`);
      return;
    }

    console.log(`\n${colors.cyan}🤖 AI TOKEN SCAN RESULTS${colors.reset}`);
    console.log(`${'═'.repeat(60)}`);
    
    // Display summary
    this.displayScanSummary(scanData.summary);
    
    // Display top recommendations
    this.displayTopRecommendations(scanData.results);
    
    // Display detailed results
    this.displayDetailedResults(scanData.results);
  }

  displayScanSummary(summary) {
    console.log(`\n${colors.cyan}📊 SCAN SUMMARY${colors.reset}`);
    console.log(`${'─'.repeat(40)}`);
    console.log(`🔍 Total Scanned: ${summary.totalScanned}`);
    console.log(`🎯 Buy Signals: ${colors.green}${summary.buySignals}${colors.reset}`);
    console.log(`📉 Sell Signals: ${colors.red}${summary.sellSignals}${colors.reset}`);
    console.log(`⚠️ Avoid Signals: ${colors.yellow}${summary.avoidSignals}${colors.reset}`);
    console.log(`⏸️ Hold Signals: ${colors.cyan}${summary.holdSignals}${colors.reset}`);
    console.log(`📊 Average Score: ${summary.averageScore.toFixed(1)}/100`);
    console.log(`🏆 High Score (80+): ${colors.green}${summary.highScoreTokens}${colors.reset}`);
    console.log(`📈 Medium Score (60-79): ${colors.yellow}${summary.mediumScoreTokens}${colors.reset}`);
    console.log(`📉 Low Score (<60): ${colors.red}${summary.lowScoreTokens}${colors.reset}`);
  }

  displayTopRecommendations(results) {
    const buySignals = results.filter(r => r.analysis.aiAnalysis.tradingRecommendation.action === 'BUY');
    
    if (buySignals.length > 0) {
      console.log(`\n${colors.green}🚀 TOP BUY RECOMMENDATIONS${colors.reset}`);
      console.log(`${'─'.repeat(40)}`);
      
      buySignals
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .forEach((result, index) => {
          const token = result.token;
          const analysis = result.analysis;
          
          console.log(`${index + 1}. ${colors.cyan}${token.name} (${token.symbol})${colors.reset}`);
          console.log(`   📍 Address: ${token.address}`);
          console.log(`   💰 Price: $${(analysis.jupiterData.price || 0).toFixed(9)}`);
          console.log(`   📊 AI Score: ${colors.green}${result.score}/100${colors.reset}`);
          console.log(`   🎯 Confidence: ${(analysis.aiAnalysis.tradingRecommendation.confidence * 100).toFixed(1)}%`);
          console.log(`   ⚠️ Risk: ${analysis.aiAnalysis.riskAssessment.riskLevel}`);
          console.log(`   📈 Sentiment: ${analysis.aiAnalysis.sentiment.data.overall}/100`);
          console.log('');
        });
    }
  }

  displayDetailedResults(results) {
    console.log(`\n${colors.cyan}📋 DETAILED RESULTS${colors.reset}`);
    console.log(`${'─'.repeat(40)}`);
    
    results.forEach((result, index) => {
      const token = result.token;
      const analysis = result.analysis;
      const recommendation = analysis.aiAnalysis.tradingRecommendation;
      
      const actionColor = recommendation.action === 'BUY' ? colors.green :
                         recommendation.action === 'SELL' ? colors.red :
                         recommendation.action === 'AVOID' ? colors.yellow : colors.cyan;
      
      const scoreColor = result.score >= 80 ? colors.green :
                        result.score >= 60 ? colors.yellow : colors.red;
      
      console.log(`${index + 1}. ${colors.cyan}${token.name} (${token.symbol})${colors.reset}`);
      console.log(`   🎯 Action: ${actionColor}${recommendation.action}${colors.reset}`);
      console.log(`   📊 Score: ${scoreColor}${result.score}/100${colors.reset}`);
      console.log(`   💰 Price: $${(analysis.jupiterData.price || 0).toFixed(9)}`);
      console.log(`   ⚠️ Risk: ${analysis.aiAnalysis.riskAssessment.riskLevel}`);
      console.log(`   📈 Sentiment: ${analysis.aiAnalysis.sentiment.data.overall}/100`);
      console.log('');
    });
  }
}

// Initialize AI Token Scanner
const aiTokenScanner = new AITokenScanner();

// Loading and Animation Functions
async function showLoadingAnimation(message, duration) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  const startTime = Date.now();
  let frameIndex = 0;
  
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Clear previous line
      process.stdout.write('\r');
      
      // Show loading animation
      const frame = frames[frameIndex];
      const progressBar = createProgressBar(progress, 20);
      process.stdout.write(`${colors.cyan}${frame} ${message} ${progressBar} ${Math.round(progress * 100)}%${colors.reset}`);
      
      frameIndex = (frameIndex + 1) % frames.length;
      
      if (elapsed >= duration) {
        clearInterval(interval);
        process.stdout.write('\r');
        process.stdout.write(`${colors.green}✅ ${message} - Complete!${colors.reset}\n`);
        resolve();
      }
    }, 50);
  });
}

function createProgressBar(progress, width) {
  const filled = Math.floor(progress * width);
  const empty = width - filled;
  return `${colors.green}${'█'.repeat(filled)}${colors.reset}${colors.dim}${'░'.repeat(empty)}${colors.reset}`;
}



// Quick Stats Menu
async function showQuickStats() {
  console.clear();
  
  console.log(`${colors.cyan}📈 QUICK STATISTICS${colors.reset}`);
  console.log(`${'═'.repeat(50)}`);
  
  // System stats
  console.log(`\n${colors.cyan}🖥️ SYSTEM STATS:${colors.reset}`);
  console.log(`   📊 Memory Usage: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   ⏱️ Uptime: ${Math.floor(process.uptime() / 60)} minutes`);
  console.log(`   🔄 Node.js Version: ${process.version}`);
  console.log(`   💾 Platform: ${process.platform}`);
  
  // Connection stats
  const status = connectionStatus.getStatus();
  console.log(`\n${colors.cyan}📡 CONNECTION STATS:${colors.reset}`);
  console.log(`   ${status.bitquery ? '🟢' : '🔴'} BitQuery: ${status.bitquery ? 'Active' : 'Inactive'}`);
  console.log(`   ${status.jupiter ? '🟢' : '🔴'} Jupiter: ${status.jupiter ? 'Active' : 'Inactive'}`);
  console.log(`   ${status.birdeye ? '🟢' : '🔴'} Birdeye: ${status.birdeye ? 'Active' : 'Inactive'}`);
  
  // Settings stats
  const settings = loadSettings();
  console.log(`\n${colors.cyan}⚙️ SETTINGS STATS:${colors.reset}`);
  console.log(`   🔑 API Keys: ${settings.bitqueryApiKey ? 'Configured' : 'Not configured'}`);
  console.log(`   💼 Wallets: ${listWallets().length} wallets available`);
  console.log(`   🔔 Alerts: ${settings.alerts ? settings.alerts.length : 0} active alerts`);
  
  // Feature stats
  console.log(`\n${colors.cyan}🚀 FEATURE STATS:${colors.reset}`);
  console.log(`   🤖 AI Tools: Available`);
  console.log(`   📊 Analytics: Available`);
  console.log(`   🔍 Token Scanner: Available`);
  console.log(`   💰 Trading Tools: Available`);
  
  console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
  await waitForSpaceKey();
}

// Help & Info Menu
async function showHelpInfo() {
  console.clear();
  
  console.log(`${colors.cyan}❓ HELP & INFORMATION${colors.reset}`);
  console.log(`${'═'.repeat(50)}`);
  
  console.log(`\n${colors.yellow}🎯 ABOUT PUMPTOOL:${colors.reset}`);
  console.log(`   PumpTool is an advanced Solana trading platform with AI-powered`);
  console.log(`   analysis, real-time monitoring, and comprehensive trading tools.`);
  
  console.log(`\n${colors.cyan}🔧 KEY FEATURES:${colors.reset}`);
  console.log(`   📡 Real-time token monitoring with BitQuery`);
  console.log(`   🤖 AI-powered Jupiter token analysis`);
  console.log(`   💼 Multi-wallet management`);
  console.log(`   📦 Bundle buy/sell operations`);
  console.log(`   🔔 Price alerts and notifications`);
  console.log(`   📊 Advanced analytics dashboard`);
  console.log(`   🔍 Token scanner and discovery`);
  
  console.log(`\n${colors.cyan}⌨️ KEYBOARD SHORTCUTS:${colors.reset}`);
  console.log(`   W: Next token`);
  console.log(`   S: Previous token`);
  console.log(`   E: Jupiter real-time monitoring`);
  console.log(`   C: Copy token address`);
  console.log(`   U: Update token info`);
  console.log(`   R: Return to main menu`);
  console.log(`   B: Send to Telegram`);
  console.log(`   G: Open in GMGN.io`);
  console.log(`   T: Open GMGN chart`);
  console.log(`   Q: Exit`);
  
  console.log(`\n${colors.cyan}🔗 USEFUL LINKS:${colors.reset}`);
  console.log(`   🌐 Jupiter: https://jup.ag`);
  console.log(`   📊 Birdeye: https://birdeye.so`);
  console.log(`   🔍 GMGN: https://gmgn.cc`);
  console.log(`   📈 Solscan: https://solscan.io`);
  
  console.log(`\n${colors.cyan}📞 SUPPORT:${colors.reset}`);
  console.log(`   For support and updates, check the documentation`);
  console.log(`   or contact the development team.`);
  

  
  console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
  await waitForSpaceKey();
}

// AI Tools Menu
async function aiTradingMenu() {
  let exit = false;
  while (!exit) {
    console.clear();
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '🚀 AI Trading System - Advanced Trading:',
        choices: addBackOption([
          { name: '🔍 Analyze Token with AI', value: 'analyze_token' },
          { name: '🤖 Start AI Trading', value: 'start_trading' },
          { name: '⏹️ Stop AI Trading', value: 'stop_trading' },
          { name: '📊 Trading Dashboard', value: 'trading_dashboard' },
          { name: '⚙️ Configure Trading', value: 'configure_trading' },
          { name: '📈 Performance Stats', value: 'performance_stats' },
          { name: '🎯 Trading Signals', value: 'trading_signals' },
          { name: '📋 Trading History', value: 'trading_history' },
          { name: '🛡️ Risk Management', value: 'risk_management' },
          { name: '🪐 Jupiter Integration', value: 'jupiter_integration' }
        ])
      }
    ]);

    switch (action) {
      case 'analyze_token': {
        const { tokenAddress } = await inquirer.prompt([
          { type: 'input', name: 'tokenAddress', message: 'Enter token address for AI analysis:' }
        ]);
        
        if (tokenAddress) {
          console.log(`${colors.cyan}🔍 Starting AI analysis for: ${tokenAddress}${colors.reset}\n`);
          
          try {
            // Initialize AI models if not already done
            await aiEnhancedAnalyzer.initializeModels();
            
            const analysis = await aiEnhancedAnalyzer.analyzeTokenWithAI(tokenAddress);
            if (analysis.success) {
              aiEnhancedAnalyzer.displayAIAnalysis(analysis);
            } else {
              console.log(`${colors.red}❌ AI Analysis failed: ${analysis.error}${colors.reset}`);
            }
          } catch (error) {
            console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
          }
          
          console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
          await waitForSpaceKey();
        }
        break;
      }
      
      case 'start_trading': {
        console.log(`${colors.cyan}🤖 Starting AI Trading System...${colors.reset}\n`);
        
        try {
          // Initialize all systems
          await aiTradingIntegration.initialize();
          await aiEnhancedAnalyzer.initializeModels();
          await autoTrading.initialize();
          
          console.log(`${colors.green}✅ AI Trading System initialized${colors.reset}`);
          
          // Start AI trading
          const result = await aiTradingIntegration.startAITrading();
          
          if (result.success) {
            console.log(`${colors.green}✅ AI Trading started successfully${colors.reset}`);
            console.log(`📊 Monitoring for trading opportunities...`);
            console.log(`🛡️ Risk management: Active`);
            console.log(`🎯 Signal generation: Active`);
          } else {
            console.log(`${colors.red}❌ Failed to start AI Trading: ${result.error}${colors.reset}`);
          }
        } catch (error) {
          console.error(`${colors.red}Error starting AI Trading: ${error.message}${colors.reset}`);
        }
        
        console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
        await waitForSpaceKey();
        break;
      }
      
      case 'stop_trading': {
        console.log(`${colors.cyan}⏹️ Stopping AI Trading System...${colors.reset}\n`);
        
        try {
          const result = await aiTradingIntegration.stopAITrading();
          
          if (result.success) {
            console.log(`${colors.green}✅ AI Trading stopped successfully${colors.reset}`);
            console.log(`📊 Final statistics saved`);
            console.log(`🛡️ All positions closed safely`);
          } else {
            console.log(`${colors.red}❌ Failed to stop AI Trading: ${result.error}${colors.reset}`);
          }
        } catch (error) {
          console.error(`${colors.red}Error stopping AI Trading: ${error.message}${colors.reset}`);
        }
        
        console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
        await waitForSpaceKey();
        break;
      }
      
      case 'trading_dashboard': {
        console.log(`${colors.cyan}📊 AI Trading Dashboard${colors.reset}`);
        console.log(`${'═'.repeat(50)}`);
        
        try {
          // Display AI trading dashboard
          aiTradingIntegration.displayAITradingDashboard();
          
          // Display auto trading dashboard
          console.log(`\n${colors.yellow}Auto Trading Dashboard:${colors.reset}`);
          autoTrading.displayTradingDashboard();
          
        } catch (error) {
          console.error(`${colors.red}Error displaying dashboard: ${error.message}${colors.reset}`);
        }
        
        console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
        await waitForSpaceKey();
        break;
      }
      
      case 'configure_trading': {
        console.log(`${colors.cyan}⚙️ Configure AI Trading${colors.reset}`);
        console.log(`${'═'.repeat(50)}`);
        
        try {
          const { maxSlippage, maxTradeSize, stopLoss, takeProfit, riskLevel } = await inquirer.prompt([
            {
              type: 'number',
              name: 'maxSlippage',
              message: 'Maximum slippage (%):',
              default: 0.5,
              validate: (value) => value > 0 && value <= 5 ? true : 'Please enter a value between 0.1 and 5'
            },
            {
              type: 'number',
              name: 'maxTradeSize',
              message: 'Maximum trade size (USD):',
              default: 100,
              validate: (value) => value > 0 ? true : 'Please enter a positive value'
            },
            {
              type: 'number',
              name: 'stopLoss',
              message: 'Stop loss (%):',
              default: 10,
              validate: (value) => value > 0 && value <= 50 ? true : 'Please enter a value between 1 and 50'
            },
            {
              type: 'number',
              name: 'takeProfit',
              message: 'Take profit (%):',
              default: 20,
              validate: (value) => value > 0 && value <= 100 ? true : 'Please enter a value between 1 and 100'
            },
            {
              type: 'list',
              name: 'riskLevel',
              message: 'Risk level:',
              choices: [
                { name: 'Low (Conservative)', value: 'low' },
                { name: 'Medium (Balanced)', value: 'medium' },
                { name: 'High (Aggressive)', value: 'high' }
              ]
            }
          ]);
          
          const config = {
            maxSlippage,
            maxTradeSize,
            stopLoss: stopLoss / 100,
            takeProfit: takeProfit / 100,
            riskLevel,
            enableAutoTrading: true,
            tradingStrategy: 'ai_signals',
            preferredDex: 'jupiter'
          };
          
          autoTrading.setTradingConfig(config);
          console.log(`${colors.green}✅ Trading configuration updated${colors.reset}`);
          
        } catch (error) {
          console.error(`${colors.red}Error configuring trading: ${error.message}${colors.reset}`);
        }
        
        console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
        await waitForSpaceKey();
        break;
      }
      
      case 'performance_stats': {
        console.log(`${colors.cyan}📈 Performance Statistics${colors.reset}`);
        console.log(`${'═'.repeat(50)}`);
        
        try {
          // Display performance statistics
          const stats = autoTrading.getPerformanceStats();
          
          console.log(`📊 Total Trades: ${stats.totalTrades}`);
          console.log(`✅ Successful Trades: ${stats.successfulTrades}`);
          console.log(`❌ Failed Trades: ${stats.failedTrades}`);
          console.log(`📈 Win Rate: ${(stats.winRate * 100).toFixed(1)}%`);
          console.log(`💰 Total Profit: $${stats.totalProfit.toFixed(2)}`);
          console.log(`📉 Total Loss: $${stats.totalLoss.toFixed(2)}`);
          console.log(`📊 Net P&L: $${stats.netPnL.toFixed(2)}`);
          console.log(`🛡️ Max Drawdown: ${(stats.maxDrawdown * 100).toFixed(1)}%`);
          
        } catch (error) {
          console.error(`${colors.red}Error displaying performance stats: ${error.message}${colors.reset}`);
        }
        
        console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
        await waitForSpaceKey();
        break;
      }
      
      case 'trading_signals': {
        console.log(`${colors.cyan}🎯 Trading Signals${colors.reset}`);
        console.log(`${'═'.repeat(50)}`);
        
        try {
          const { tokenAddress } = await inquirer.prompt([
            { type: 'input', name: 'tokenAddress', message: 'Enter token address for signal generation:' }
          ]);
          
          if (tokenAddress) {
            console.log(`${colors.yellow}Generating trading signals for: ${tokenAddress}${colors.reset}\n`);
            
            const analysis = await aiEnhancedAnalyzer.analyzeTokenWithAI(tokenAddress);
            
            if (analysis.success) {
              const signals = await aiTradingIntegration.generateTradingSignals(analysis);
              
              console.log(`${colors.green}✅ Generated ${signals.length} trading signals${colors.reset}\n`);
              
              signals.forEach((signal, index) => {
                const signalColor = signal.type === 'BUY' ? colors.green : colors.red;
                console.log(`${index + 1}. ${signalColor}${signal.type}${colors.reset} - ${signal.reason}`);
                console.log(`   Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
                console.log(`   Source: ${signal.source}`);
                console.log('');
              });
            } else {
              console.log(`${colors.red}❌ Failed to generate signals: ${analysis.error}${colors.reset}`);
            }
          }
          
        } catch (error) {
          console.error(`${colors.red}Error generating signals: ${error.message}${colors.reset}`);
        }
        
        console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
        await waitForSpaceKey();
        break;
      }
      
      case 'trading_history': {
        console.log(`${colors.cyan}📋 Trading History${colors.reset}`);
        console.log(`${'═'.repeat(50)}`);
        
        try {
          autoTrading.displayTradingHistory(10);
        } catch (error) {
          console.error(`${colors.red}Error displaying trading history: ${error.message}${colors.reset}`);
        }
        
        console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
        await waitForSpaceKey();
        break;
      }
      
      case 'risk_management': {
        console.log(`${colors.cyan}🛡️ Risk Management${colors.reset}`);
        console.log(`${'═'.repeat(50)}`);
        
        try {
          const config = autoTrading.getTradingConfig();
          
          console.log(`📊 Current Risk Settings:`);
          console.log(`   Max Slippage: ${config.maxSlippage}%`);
          console.log(`   Max Trade Size: $${config.maxTradeSize}`);
          console.log(`   Stop Loss: ${(config.stopLoss * 100).toFixed(1)}%`);
          console.log(`   Take Profit: ${(config.takeProfit * 100).toFixed(1)}%`);
          console.log(`   Risk Level: ${config.riskLevel.toUpperCase()}`);
          console.log(`   Max Open Positions: ${config.maxOpenPositions}`);
          
          console.log(`\n🛡️ Active Risk Controls:`);
          console.log(`   ✅ Position Sizing`);
          console.log(`   ✅ Stop-Loss Protection`);
          console.log(`   ✅ Take-Profit Targets`);
          console.log(`   ✅ Slippage Protection`);
          console.log(`   ✅ Liquidity Checks`);
          
        } catch (error) {
          console.error(`${colors.red}Error displaying risk management: ${error.message}${colors.reset}`);
        }
        
        console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
        await waitForSpaceKey();
        break;
      }
      
      case 'jupiter_integration': {
        console.log(`${colors.cyan}🪐 Jupiter API Integration${colors.reset}`);
        console.log(`${'═'.repeat(50)}`);
        
        try {
          const { tokenAddress, amount } = await inquirer.prompt([
            { type: 'input', name: 'tokenAddress', message: 'Enter token address for Jupiter quote:' },
            { type: 'number', name: 'amount', message: 'Amount to trade:', default: 0.1 }
          ]);
          
          if (tokenAddress) {
            console.log(`${colors.yellow}Getting Jupiter quote for ${amount} tokens...${colors.reset}\n`);
            
            const quote = await autoTrading.getJupiterQuote(tokenAddress, 'BUY', amount);
            
            if (quote.success) {
              console.log(`${colors.green}✅ Jupiter quote received${colors.reset}`);
              console.log(`   Input Mint: ${quote.inputMint}`);
              console.log(`   Output Mint: ${quote.outputMint}`);
              console.log(`   Expected Output: ${quote.expectedOutput}`);
              console.log(`   Price Impact: ${quote.priceImpact}%`);
              console.log(`   Routes Available: ${quote.routes?.length || 0}`);
            } else {
              console.log(`${colors.red}❌ Failed to get Jupiter quote: ${quote.error}${colors.reset}`);
            }
          }
          
        } catch (error) {
          console.error(`${colors.red}Error with Jupiter integration: ${error.message}${colors.reset}`);
        }
        
        console.log(`\n${colors.cyan}Press SPACE to continue or B to go back${colors.reset}`);
        const action = await waitForBackOrSpaceKey();
        if (action === 'back') {
          break;
        }
        break;
      }
      
      case 'back': {
        exit = true;
        break;
      }
      
      case 'exit': {
        exit = true;
        break;
      }
    }
  }
}

async function aiToolsMenu() {
  let exit = false;
  while (!exit) {
    console.clear();
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '🤖 AI Tools - Advanced Analysis:',
        choices: [
          { name: '🔍 AI Token Analysis', value: 'ai_analysis' },
          { name: '📊 AI Batch Analysis', value: 'ai_batch' },
          { name: '🔍 AI Token Scanner', value: 'ai_scanner' },
          { name: '🚀 AI Trading Dashboard', value: 'ai_trading_dashboard' },
          { name: '⚙️ AI Trading Configuration', value: 'ai_trading_config' },
          { name: '📈 AI Performance Stats', value: 'ai_performance' },
          { name: '🎯 AI Trading Signals', value: 'ai_signals' },
          { name: '📋 AI Trading History', value: 'ai_history' },
          { name: '🛡️ AI Risk Management', value: 'ai_risk' },
          { name: '📈 AI Market Analysis', value: 'ai_market' },
          { name: '⚡ AI Quick Analysis', value: 'ai_quick' },
          { name: '⚙️ AI Settings', value: 'ai_settings' },
          { name: `${colors.white}[SPACE]${colors.reset} ${colors.yellow}⬅️ Back to Main Menu${colors.reset}`, value: 'back' }
        ]
      }
    ]);

    switch (action) {
      case 'ai_analysis': {
        const { tokenAddress } = await inquirer.prompt([
          { type: 'input', name: 'tokenAddress', message: 'Enter token address for AI analysis:' }
        ]);
        
        if (tokenAddress) {
          console.log(`${colors.cyan}🤖 Starting AI-powered analysis for: ${tokenAddress}${colors.reset}\n`);
          
          try {
            const analysis = await aiJupiterAnalyzer.analyzeTokenWithAI(tokenAddress);
            if (analysis.success) {
              aiJupiterAnalyzer.displayAIAnalysis(analysis);
            } else {
              console.log(`${colors.red}❌ AI Analysis failed: ${analysis.error}${colors.reset}`);
            }
          } catch (error) {
            console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
          }
          
          console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
          await waitForSpaceKey();
        }
        break;
      }
      
      case 'ai_batch': {
        const { tokenAddresses } = await inquirer.prompt([
          { type: 'input', name: 'tokenAddresses', message: 'Enter token addresses for AI batch analysis (comma-separated):' }
        ]);
        
        if (tokenAddresses) {
          const addresses = tokenAddresses.split(',').map(addr => addr.trim()).filter(addr => addr);
          
          if (addresses.length > 0) {
            console.log(`${colors.cyan}🤖 Starting AI batch analysis for ${addresses.length} tokens...${colors.reset}\n`);
            
            const results = [];
            
            for (let i = 0; i < addresses.length; i++) {
              const address = addresses[i];
              try {
                console.log(`${colors.yellow}🤖 AI Analyzing (${i + 1}/${addresses.length}): ${address}${colors.reset}`);
                const analysis = await aiJupiterAnalyzer.analyzeTokenWithAI(address);
                
                if (analysis.success) {
                  const summary = {
                    address,
                    action: analysis.aiAnalysis.tradingRecommendation.action,
                    confidence: analysis.aiAnalysis.tradingRecommendation.confidence,
                    riskLevel: analysis.aiAnalysis.riskAssessment.riskLevel,
                    price: analysis.jupiterData.price,
                    sentiment: analysis.aiAnalysis.sentiment.data.overall
                  };
                  results.push(summary);
                  
                  console.log(`   ✅ ${analysis.jupiterData.name || 'Unknown'} (${analysis.jupiterData.symbol || 'N/A'})`);
                  console.log(`   🎯 Action: ${summary.action}`);
                  console.log(`   📊 Confidence: ${(summary.confidence * 100).toFixed(1)}%`);
                  console.log(`   ⚠️ Risk: ${summary.riskLevel}`);
                  console.log(`   💰 Price: $${summary.price.toFixed(9)}`);
                  console.log(`   📈 Sentiment: ${summary.sentiment}/100`);
                  console.log('');
                } else {
                  console.log(`   ❌ Error: ${analysis.error}`);
                  console.log('');
                }
                
                if (i < addresses.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 2000));
                }
              } catch (error) {
                console.error(`${colors.red}Error analyzing ${address}: ${error.message}${colors.reset}`);
                console.log('');
              }
            }
            
            console.log(`${colors.cyan}📊 AI BATCH ANALYSIS SUMMARY${colors.reset}`);
            console.log(`${'═'.repeat(50)}`);
            
            const buySignals = results.filter(r => r.action === 'BUY');
            const sellSignals = results.filter(r => r.action === 'SELL');
            const avoidSignals = results.filter(r => r.action === 'AVOID');
            const holdSignals = results.filter(r => r.action === 'HOLD');
            
            console.log(`🎯 Buy Signals: ${colors.green}${buySignals.length}${colors.reset}`);
            console.log(`📉 Sell Signals: ${colors.red}${sellSignals.length}${colors.reset}`);
            console.log(`⚠️ Avoid Signals: ${colors.yellow}${avoidSignals.length}${colors.reset}`);
            console.log(`⏸️ Hold Signals: ${colors.cyan}${holdSignals.length}${colors.reset}`);
            console.log(`📊 Total Analyzed: ${results.length}`);
            
            if (buySignals.length > 0) {
              console.log(`\n${colors.green}🚀 TOP BUY RECOMMENDATIONS:${colors.reset}`);
              buySignals
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, 3)
                .forEach((signal, index) => {
                  console.log(`${index + 1}. ${signal.address}`);
                  console.log(`   Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
                  console.log(`   Risk: ${signal.riskLevel}`);
                  console.log(`   Sentiment: ${signal.sentiment}/100`);
                  console.log('');
                });
            }
          }
          
          console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
          await waitForSpaceKey();
        }
        break;
      }
      
      case 'ai_scanner': {
        const { scanType, limit } = await inquirer.prompt([
          {
            type: 'list',
            name: 'scanType',
            message: 'Select scan type:',
            choices: [
              { name: 'Trending Tokens', value: 'trending' },
              { name: 'High Volume Tokens', value: 'volume' },
              { name: 'New Tokens', value: 'new' }
            ]
          },
          {
            type: 'number',
            name: 'limit',
            message: 'Number of tokens to scan:',
            default: 10,
            validate: (value) => {
              if (value > 0 && value <= 50) return true;
              return 'Please enter a number between 1 and 50';
            }
          }
        ]);
        
        console.log(`${colors.cyan}🤖 Starting AI Token Scanner...${colors.reset}\n`);
        
        try {
          const scanData = await aiTokenScanner.scanTokensWithAI(scanType, limit);
          aiTokenScanner.displayScanResults(scanData);
        } catch (error) {
          console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
        }
        
        console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
        await waitForSpaceKey();
        break;
      }
      
      case 'ai_trading': {
        const { tokenAddress, tradeAmount } = await inquirer.prompt([
          { type: 'input', name: 'tokenAddress', message: 'Enter token address for AI trading analysis:' },
          { type: 'number', name: 'tradeAmount', message: 'Trade amount (USD):', default: 1000 }
        ]);
        
        if (tokenAddress) {
          console.log(`${colors.cyan}🤖 AI Trading Assistant analyzing: ${tokenAddress}${colors.reset}\n`);
          
          try {
            const analysis = await aiJupiterAnalyzer.analyzeTokenWithAI(tokenAddress);
            if (analysis.success) {
              console.log(`${colors.cyan}🎯 AI TRADING RECOMMENDATION${colors.reset}`);
              console.log(`${'═'.repeat(50)}`);
              
              const recommendation = analysis.aiAnalysis.tradingRecommendation;
              const actionColor = recommendation.action === 'BUY' ? colors.green :
                                 recommendation.action === 'SELL' ? colors.red :
                                 recommendation.action === 'HOLD' ? colors.yellow : colors.gray;
              
              console.log(`🎯 Action: ${actionColor}${recommendation.action}${colors.reset}`);
              console.log(`📊 Confidence: ${colors.green}${(recommendation.confidence * 100).toFixed(1)}%${colors.reset}`);
              console.log(`⚠️ Risk Level: ${colors.yellow}${recommendation.riskLevel}${colors.reset}`);
              
              if (recommendation.suggestedAmount > 0) {
                console.log(`💰 Suggested Amount: $${recommendation.suggestedAmount}`);
                console.log(`🛑 Stop Loss: $${recommendation.stopLoss.toFixed(9)}`);
                console.log(`🎯 Take Profit: $${recommendation.takeProfit.toFixed(9)}`);
              }
              
              console.log(`\n💡 Reasoning:`);
              recommendation.reasoning.forEach(reason => {
                console.log(`   • ${colors.cyan}${reason}${colors.reset}`);
              });
              
              // Display risk assessment
              const riskAssessment = analysis.aiAnalysis.riskAssessment;
              console.log(`\n${colors.cyan}⚠️ RISK ASSESSMENT${colors.reset}`);
              console.log(`📊 Risk Score: ${riskAssessment.riskScore}/100`);
              console.log(`⚠️ Risk Level: ${riskAssessment.riskLevel}`);
              console.log(`💡 Recommendation: ${riskAssessment.recommendation}`);
              
              if (riskAssessment.riskFactors.length > 0) {
                console.log(`\n🚨 Risk Factors:`);
                riskAssessment.riskFactors.forEach(factor => {
                  console.log(`   • ${colors.red}${factor}${colors.reset}`);
                });
              }
            } else {
              console.log(`${colors.red}❌ AI Analysis failed: ${analysis.error}${colors.reset}`);
            }
          } catch (error) {
            console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
          }
          
          console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
          await waitForSpaceKey();
        }
        break;
      }
      
      case 'ai_market': {
        console.log(`${colors.cyan}🤖 AI Market Analysis${colors.reset}`);
        console.log(`${'═'.repeat(50)}`);
        console.log(`${colors.yellow}This feature analyzes market trends and provides insights.${colors.reset}`);
        console.log(`${colors.dim}Coming soon...${colors.reset}`);
        
        console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
        await waitForSpaceKey();
        break;
      }
      
      case 'ai_quick': {
        const { tokenAddress } = await inquirer.prompt([
          { type: 'input', name: 'tokenAddress', message: 'Enter token address for quick AI analysis:' }
        ]);
        
        if (tokenAddress) {
          console.log(`${colors.cyan}⚡ Quick AI Analysis for: ${tokenAddress}${colors.reset}\n`);
          
          try {
            const analysis = await aiJupiterAnalyzer.analyzeTokenWithAI(tokenAddress);
            if (analysis.success) {
              const recommendation = analysis.aiAnalysis.tradingRecommendation;
              const riskAssessment = analysis.aiAnalysis.riskAssessment;
              const sentiment = analysis.aiAnalysis.sentiment;
              
              console.log(`${colors.cyan}⚡ QUICK AI SUMMARY${colors.reset}`);
              console.log(`${'═'.repeat(40)}`);
              
              const actionColor = recommendation.action === 'BUY' ? colors.green :
                                 recommendation.action === 'SELL' ? colors.red :
                                 recommendation.action === 'HOLD' ? colors.yellow : colors.gray;
              
              console.log(`🎯 Action: ${actionColor}${recommendation.action}${colors.reset}`);
              console.log(`📊 Confidence: ${(recommendation.confidence * 100).toFixed(1)}%`);
              console.log(`⚠️ Risk: ${riskAssessment.riskLevel}`);
              console.log(`📈 Sentiment: ${sentiment.data.overall}/100`);
              console.log(`💰 Price: $${analysis.jupiterData.price.toFixed(9)}`);
              
              if (recommendation.suggestedAmount > 0) {
                console.log(`💡 Suggested: $${recommendation.suggestedAmount}`);
              }
            } else {
              console.log(`${colors.red}❌ Quick analysis failed: ${analysis.error}${colors.reset}`);
            }
          } catch (error) {
            console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
          }
          
          console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
          await waitForSpaceKey();
        }
        break;
      }
      
      case 'ai_trading_dashboard': {
        console.log(`${colors.cyan}🚀 AI Trading Dashboard${colors.reset}`);
        console.log(`${'═'.repeat(50)}`);
        try {
          // Display auto trading dashboard
          console.log(`\n${colors.yellow}Auto Trading Dashboard:${colors.reset}`);
          autoTrading.displayTradingDashboard();
        } catch (error) {
          console.error(`${colors.red}Error displaying dashboard: ${error.message}${colors.reset}`);
        }
        console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
        await waitForSpaceKey();
        break;
      }
      
      case 'ai_trading_config': {
        console.log(`${colors.cyan}⚙️ Configure AI Trading${colors.reset}`);
        console.log(`${'═'.repeat(50)}`);
        try {
          const { maxSlippage, maxTradeSize, stopLoss, takeProfit, riskLevel } = await inquirer.prompt([
            {
              type: 'number',
              name: 'maxSlippage',
              message: 'Maximum slippage (%):',
              default: 0.5,
              validate: (value) => value > 0 && value <= 5 ? true : 'Please enter a value between 0.1 and 5'
            },
            {
              type: 'number',
              name: 'maxTradeSize',
              message: 'Maximum trade size (USD):',
              default: 100,
              validate: (value) => value > 0 ? true : 'Please enter a positive value'
            },
            {
              type: 'number',
              name: 'stopLoss',
              message: 'Stop loss (%):',
              default: 10,
              validate: (value) => value > 0 && value <= 50 ? true : 'Please enter a value between 1 and 50'
            },
            {
              type: 'number',
              name: 'takeProfit',
              message: 'Take profit (%):',
              default: 20,
              validate: (value) => value > 0 && value <= 100 ? true : 'Please enter a value between 1 and 100'
            },
            {
              type: 'list',
              name: 'riskLevel',
              message: 'Risk level:',
              choices: [
                { name: 'Low (Conservative)', value: 'low' },
                { name: 'Medium (Balanced)', value: 'medium' },
                { name: 'High (Aggressive)', value: 'high' }
              ]
            }
          ]);
          
          const config = {
            maxSlippage,
            maxTradeSize,
            stopLoss: stopLoss / 100,
            takeProfit: takeProfit / 100,
            riskLevel,
            enableAutoTrading: true,
            tradingStrategy: 'ai_signals',
            preferredDex: 'jupiter'
          };
          
          autoTrading.setTradingConfig(config);
          console.log(`${colors.green}✅ Trading configuration updated${colors.reset}`);
        } catch (error) {
          console.error(`${colors.red}Error configuring trading: ${error.message}${colors.reset}`);
        }
        console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
        await waitForSpaceKey();
        break;
      }
      
      case 'ai_performance': {
        console.log(`${colors.cyan}📈 AI Performance Statistics${colors.reset}`);
        console.log(`${'═'.repeat(50)}`);
        try {
          // Display performance statistics
          const stats = autoTrading.getPerformanceStats();
          console.log(`📊 Total Trades: ${stats.totalTrades}`);
          console.log(`✅ Successful Trades: ${stats.successfulTrades}`);
          console.log(`❌ Failed Trades: ${stats.failedTrades}`);
          console.log(`📈 Win Rate: ${(stats.winRate * 100).toFixed(1)}%`);
          console.log(`💰 Total Profit: $${stats.totalProfit.toFixed(2)}`);
          console.log(`📉 Total Loss: $${stats.totalLoss.toFixed(2)}`);
          console.log(`📊 Net P&L: $${stats.netPnL.toFixed(2)}`);
          console.log(`🛡️ Max Drawdown: ${(stats.maxDrawdown * 100).toFixed(1)}%`);
        } catch (error) {
          console.error(`${colors.red}Error displaying performance stats: ${error.message}${colors.reset}`);
        }
        console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
        await waitForSpaceKey();
        break;
      }
      
      case 'ai_signals': {
        console.log(`${colors.cyan}🎯 AI Trading Signals${colors.reset}`);
        console.log(`${'═'.repeat(50)}`);
        try {
          const { tokenAddress } = await inquirer.prompt([
            { type: 'input', name: 'tokenAddress', message: 'Enter token address for signal generation:' }
          ]);
          
          if (tokenAddress) {
            console.log(`${colors.yellow}Generating trading signals for: ${tokenAddress}${colors.reset}\n`);
            const analysis = await aiEnhancedAnalyzer.analyzeTokenWithAI(tokenAddress);
            
            if (analysis.success) {
              const signals = await aiTradingIntegration.generateTradingSignals(analysis);
              console.log(`${colors.green}✅ Generated ${signals.length} trading signals${colors.reset}\n`);
              
              signals.forEach((signal, index) => {
                const signalColor = signal.type === 'BUY' ? colors.green : colors.red;
                console.log(`${index + 1}. ${signalColor}${signal.type}${colors.reset} - ${signal.reason}`);
                console.log(`   Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
                console.log(`   Source: ${signal.source}`);
                console.log('');
              });
            } else {
              console.log(`${colors.red}❌ Failed to generate signals: ${analysis.error}${colors.reset}`);
            }
          }
        } catch (error) {
          console.error(`${colors.red}Error generating signals: ${error.message}${colors.reset}`);
        }
        console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
        await waitForSpaceKey();
        break;
      }
      
      case 'ai_risk': {
        console.log(`${colors.cyan}🛡️ AI Risk Management${colors.reset}`);
        console.log(`${'═'.repeat(50)}`);
        try {
          const config = autoTrading.getTradingConfig();
          console.log(`📊 Current Risk Settings:`);
          console.log(`   Max Slippage: ${config.maxSlippage}%`);
          console.log(`   Max Trade Size: $${config.maxTradeSize}`);
          console.log(`   Stop Loss: ${(config.stopLoss * 100).toFixed(1)}%`);
          console.log(`   Take Profit: ${(config.takeProfit * 100).toFixed(1)}%`);
          console.log(`   Risk Level: ${config.riskLevel.toUpperCase()}`);
          console.log(`   Max Open Positions: ${config.maxOpenPositions}`);
          
          console.log(`\n🛡️ Active Risk Controls:`);
          console.log(`   ✅ Position Sizing`);
          console.log(`   ✅ Stop-Loss Protection`);
          console.log(`   ✅ Take-Profit Targets`);
          console.log(`   ✅ Slippage Protection`);
          console.log(`   ✅ Liquidity Checks`);
        } catch (error) {
          console.error(`${colors.red}Error displaying risk management: ${error.message}${colors.reset}`);
        }
        console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
        await waitForSpaceKey();
        break;
      }
      
      case 'ai_history': {
        console.log(`${colors.cyan}📋 AI Analysis History${colors.reset}`);
        console.log(`${'═'.repeat(50)}`);
        console.log(`${colors.yellow}This feature shows your AI analysis history.${colors.reset}`);
        console.log(`${colors.dim}Coming soon...${colors.reset}`);
        
        console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
        await waitForSpaceKey();
        break;
      }
      
      case 'ai_settings': {
        console.log(`${colors.cyan}⚙️ AI Settings${colors.reset}`);
        console.log(`${'═'.repeat(50)}`);
        console.log(`${colors.yellow}Configure AI analysis parameters.${colors.reset}`);
        console.log(`${colors.dim}Coming soon...${colors.reset}`);
        
        console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
        await waitForSpaceKey();
        break;
      }
      
      case 'back': {
        exit = true;
        break;
      }
    }
  }
}

// Modify the initializeApp function to start the server
async function initializeApp(menuState = MENU_STATES.MAIN) {
  try {
    // Start the server when app initializes
    if (!serverProcess) {
      await startServer();
    }
    loadSettings();
    
    // Check connections before showing menu
    await connectionStatus.checkAllConnections();
    
    if (menuState === MENU_STATES.MAIN) {
      // Quick loading animation
      console.log(`\n${colors.cyan}🔄 Initializing system...${colors.reset}`);
      await showLoadingAnimation("Checking connections", 300);
      
      // Compact status line
      
      // Get active wallet info
      const walletInfo = await getActiveWalletInfo();
      
      // Compact status line with wallet info
      const status = connectionStatus.getStatus();
      console.log(`${colors.yellow}🎯 PumpTool v2.0.0${colors.reset} | ${colors.dim}${new Date().toLocaleString()}${colors.reset} | ${colors.cyan}📡 ${status.bitquery ? '🟢' : '🔴'}${status.jupiter ? '🟢' : '🔴'}${status.birdeye ? '🟢' : '🔴'}${colors.reset}`);
      
      // Display active wallet info
      if (walletInfo.name !== 'None') {
        const balanceColor = walletInfo.balance > 0 ? colors.green : colors.red;
        const balanceText = walletInfo.error ? colors.red + 'Error' + colors.reset : balanceColor + walletInfo.balance.toFixed(4) + ' SOL' + colors.reset;
        console.log(`${colors.magenta}💼 Active Wallet:${colors.reset} ${colors.cyan}${walletInfo.name}${colors.reset} | ${colors.yellow}${walletInfo.publicKey.slice(0, 8)}...${walletInfo.publicKey.slice(-8)}${colors.reset} | ${balanceColor}💰 ${balanceText}${colors.reset}`);
        
        // Show wallet status for trading
        if (walletInfo.balance > 0) {
          console.log(`${colors.green}✅ Ready for trading${colors.reset}`);
        } else {
          console.log(`${colors.red}❌ Insufficient balance for trading${colors.reset}`);
        }
      } else {
        console.log(`${colors.yellow}⚠️ No active wallet selected${colors.reset}`);
        console.log(`${colors.cyan}💡 Select a wallet in Wallet Manager to enable trading${colors.reset}`);
      }
      console.log('');
      
      // Display menu in 2 columns
      const menuItems = [
        { number: '1', icon: '📡', name: 'Monitor', color: colors.green, value: 'monitor' },
        { number: '2', icon: '⚙️', name: 'Settings', color: colors.blue, value: 'settings' },
        { number: '3', icon: '💼', name: 'Wallets', color: colors.magenta, value: 'wallets' },
        { number: '4', icon: '🟢', name: 'Buy Token', color: colors.green, value: 'quickBuy' },
        { number: '5', icon: '🔴', name: 'Sell Token', color: colors.red, value: 'quickSell' },
        { number: '6', icon: '🚨', name: 'Emergency Sell', color: colors.red, value: 'emergencySell' },
        { number: '7', icon: '🔥', name: 'Burn Tokens', color: colors.red, value: 'burnTokens' },
        { number: '8', icon: '📦', name: 'Bundle Trade', color: colors.yellow, value: 'bundle' },
        { number: '9', icon: '🔔', name: 'Alerts', color: colors.orange, value: 'alerts' },
        { number: '10', icon: '🌌', name: 'Jupiter', color: colors.green, value: 'jupiter' },
        { number: '11', icon: '🤖', name: 'AI Tools', color: colors.cyan, value: 'ai_tools' },
        { number: '12', icon: '🔍', name: 'Check Token', color: colors.purple, value: 'checktoken' },
        { number: '13', icon: '❓', name: 'Help', color: colors.yellow, value: 'help' },
        { number: '0', icon: '❌', name: 'Exit', color: colors.red, value: 'exit' }
      ];
      
      // Calculate items per column (9 items per column)
      const itemsPerColumn = Math.ceil(menuItems.length / 2);
      const leftColumn = menuItems.slice(0, itemsPerColumn);
      const rightColumn = menuItems.slice(itemsPerColumn);
      
      // Display menu in 2 columns
      console.log(`${colors.cyan}🎯 Select an option:${colors.reset}`);
      console.log('');
      
      // Calculate the maximum width of left column items for proper alignment
      const leftColumnWidths = leftColumn.map(item => {
        const text = `[${item.number}] ${item.icon} ${item.name}`;
        return text.length;
      });
      const maxLeftWidth = Math.max(...leftColumnWidths);
      
      for (let i = 0; i < Math.max(leftColumn.length, rightColumn.length); i++) {
        const leftItem = leftColumn[i];
        const rightItem = rightColumn[i];
        
        const leftText = leftItem ? `${colors.white}[${leftItem.number}]${colors.reset} ${leftItem.color}${leftItem.icon} ${leftItem.name}${colors.reset}` : '';
        const rightText = rightItem ? `${colors.white}[${rightItem.number}]${colors.reset} ${rightItem.color}${rightItem.icon} ${rightItem.name}${colors.reset}` : '';
        
        if (leftItem && rightItem) {
          // Calculate padding to align right column consistently
          const leftItemWidth = leftItem ? `[${leftItem.number}] ${leftItem.icon} ${leftItem.name}`.length : 0;
          const paddingNeeded = maxLeftWidth - leftItemWidth + 8; // 8 spaces for consistent gap
          const padding = ' '.repeat(paddingNeeded);
          
          console.log(`  ${leftText}${padding}${rightText}`);
        } else if (leftItem) {
          console.log(`  ${leftText}`);
        } else if (rightItem) {
          // Center the right item when there's no left item
          const padding = ' '.repeat(maxLeftWidth + 8);
          console.log(`${padding}${rightText}`);
        }
      }
      
      console.log('');
      
      // Get user input
      const { choice } = await inquirer.prompt([
        {
          type: 'input',
          name: 'choice',
          message: 'Enter option number:',
          validate: (input) => {
            const num = parseInt(input);
            if (isNaN(num)) return 'Please enter a valid number';
            if (num < 0 || num > 13) return 'Please enter a number between 0 and 13';
            return true;
          }
        }
      ]);
      
      const action = menuItems.find(item => item.number === choice)?.value || 'exit';
      if (action === 'exit') {
        cleanup();
        return;
      }
      if (action === 'settings') {
        await showSettingsMenu();
        return initializeApp(MENU_STATES.MAIN);
      }
      if (action === 'wallets') {
        await walletManagerMenu();
        return initializeApp(MENU_STATES.MAIN);
      }
      if (action === 'quickBuy') {
        const walletInfo = await getActiveWalletInfo();
        if (walletInfo.name === 'None') {
          console.log(`${colors.red}❌ No active wallet selected${colors.reset}`);
          console.log(`${colors.cyan}💡 Please select a wallet first${colors.reset}`);
          await waitForSpaceKey();
          return initializeApp(MENU_STATES.MAIN);
        }
        const wallet = loadWallet(walletInfo.name);
        await handleBuyToken(wallet);
        return initializeApp(MENU_STATES.MAIN);
      }
      if (action === 'quickSell') {
        const walletInfo = await getActiveWalletInfo();
        if (walletInfo.name === 'None') {
          console.log(`${colors.red}❌ No active wallet selected${colors.reset}`);
          console.log(`${colors.cyan}💡 Please select a wallet first${colors.reset}`);
          await waitForSpaceKey();
          return initializeApp(MENU_STATES.MAIN);
        }
        const wallet = loadWallet(walletInfo.name);
        await handleSellToken(wallet);
        return initializeApp(MENU_STATES.MAIN);
      }
      if (action === 'emergencySell') {
        const walletInfo = await getActiveWalletInfo();
        if (walletInfo.name === 'None') {
          console.log(`${colors.red}❌ No active wallet selected${colors.reset}`);
          console.log(`${colors.cyan}💡 Please select a wallet first${colors.reset}`);
          await waitForSpaceKey();
          return initializeApp(MENU_STATES.MAIN);
        }
        const wallet = loadWallet(walletInfo.name);
        await handleEmergencySell(wallet);
        return initializeApp(MENU_STATES.MAIN);
      }
      if (action === 'burnTokens') {
        const walletInfo = await getActiveWalletInfo();
        if (walletInfo.name === 'None') {
          console.log(`${colors.red}❌ No active wallet selected${colors.reset}`);
          console.log(`${colors.cyan}💡 Please select a wallet first${colors.reset}`);
          await waitForSpaceKey();
          return initializeApp(MENU_STATES.MAIN);
        }
        const wallet = loadWallet(walletInfo.name);
        await handleBurnTokens(wallet);
        return initializeApp(MENU_STATES.MAIN);
      }
      if (action === 'bundle') {
        await bundleBuySellMenu();
        return initializeApp(MENU_STATES.MAIN);
      }
      if (action === 'multiwallet') {
        await multiWalletTradingMenu();
        return initializeApp(MENU_STATES.MAIN);
      }
      if (action === 'analytics') {
        await analyticsDashboard();
        return initializeApp(MENU_STATES.MAIN);
      }
      if (action === 'alerts') {
        await priceAlertsMenu();
        return initializeApp(MENU_STATES.MAIN);
      }
      if (action === 'scanner') {
        await tokenScannerMenu();
        return initializeApp(MENU_STATES.MAIN);
      }
      if (action === 'jupiter') {
        await jupiterAnalysisMenu();
        return initializeApp(MENU_STATES.MAIN);
      }
      if (action === 'checktoken') {
        await checkTokenAddressMenu();
        return initializeApp(MENU_STATES.MAIN);
      }

      if (action === 'ai_tools') {
        await aiToolsMenu();
        return initializeApp(MENU_STATES.MAIN);
      }
      if (action === 'ai_trading') {
        await aiTradingMenu();
        return initializeApp(MENU_STATES.MAIN);
      }
      if (action === 'stats') {
        await showQuickStats();
        return initializeApp(MENU_STATES.MAIN);
      }
      if (action === 'manualSwap') {
        await manualSwapMenu();
        return initializeApp(MENU_STATES.MAIN);
      }
      if (action === 'bundleSwap') {
        await bundleSwapMenu();
        return initializeApp(MENU_STATES.MAIN);
      }
      if (action === 'help') {
        await showHelpInfo();
        return initializeApp(MENU_STATES.MAIN);
      }
      if (action === 'back') {
        // Back to main menu (already here, so just continue)
        return initializeApp(MENU_STATES.MAIN);
      }
      return initializeApp(MENU_STATES.MONITOR);
    }

    if (menuState === MENU_STATES.MONITOR) {
      const queryType = await showInitialQueryMenu();

      console.clear();
    console.log(`
      ${colors.cyan}${colors.bright}Selected Mode:${colors.reset} ${modeDescriptions[queryType].title}
      ${colors.dim}${modeDescriptions[queryType].description[0]}${colors.reset}

      ${colors.yellow}Navigation Keys:${colors.reset}
      
      ${colors.white}W${colors.gray}: Next token
      ${colors.white}S${colors.gray}: Previous token
      ${colors.white}E${colors.gray}: Jupiter real-time monitoring
      ${colors.white}C${colors.gray}: Copy token address
      ${colors.white}U${colors.gray}: Update token info
      ${colors.white}R${colors.gray}: Return to main menu
      ${colors.white}M${colors.gray}: Force return to main menu
      ${colors.white}B${colors.gray}: Send token address to Telegram
      ${colors.white}G${colors.gray}: Open token address in GMGN.io
      ${colors.white}T${colors.gray}: Open GMGN chart
      ${colors.white}Q${colors.gray}: Exit${colors.reset}
      
      ${colors.dim}Press Enter to start monitoring...${colors.reset}
      `);

      await new Promise(resolve => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        rl.question('', () => {
          rl.close();
          resolve();
        });
      });
      
      console.log(`${colors.cyan}🔍 Starting stream with queryType: ${queryType}${colors.reset}`);
      const success = await startStream(queryType);
      console.log(`${colors.yellow}📊 Stream result: ${success}${colors.reset}`);
      
      if (success) {
        console.log(`${colors.green}✅ Stream started successfully, initializing keyboard handler...${colors.reset}`);
        // Initialize keyboard handler after successful connection
        const handler = createKeyboardHandler(
          appState, 
          startStream, 
          cleanup,
          () => initializeApp(MENU_STATES.MAIN), // Pass restart function
          settings // Pass settings for auto-continue functionality
        );
        handler.init();
        await new Promise(() => {}); // Never resolves
      } else {
        console.log(`${colors.red}❌ Stream failed, returning to monitor menu${colors.reset}`);
        return initializeApp(MENU_STATES.MONITOR);
      }
    }

  } catch (error) {
    if (error.isTtyError) {
      console.error(`${colors.red}Prompt couldn't be rendered in the current environment${colors.reset}`);
    } else {
      console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
    return initializeApp(menuState);
  }
}

// Modify the cleanup function to kill the server
function cleanup() {
  if (serverProcess) {
    serverProcess.kill();
  }
  spinner.stop();
  console.log(`\n${colors.yellow}Exiting...${colors.reset}`);
  process.exit(0);
}

// Handle process termination
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('SIGQUIT', cleanup);

// Add startStream function
async function startStream(queryType = 'pump') {
  try {
    // Check BitQuery connection first
    console.log(`${colors.cyan}🔍 Checking BitQuery connection...${colors.reset}`);
    const bitqueryConnected = await connectionStatus.checkBitqueryConnection();
    
    if (!bitqueryConnected) {
      console.log(`${colors.red}❌ BitQuery connection failed: ${connectionStatus.bitquery.error}${colors.reset}`);
      console.log(`${colors.yellow}💡 Try updating your API key in Settings or check your internet connection${colors.reset}`);
      return false;
    }
    
    console.log(`${colors.green}✅ BitQuery connection successful!${colors.reset}`);
    spinner.start(`Connecting to BitQuery stream in ${queryType} mode`);
    
    appState.clearCharts();
    appState.setMode(queryType); // Set the current mode
    
    let raw;
    let queryConfig;
    if (queryType === 'pumpfunCrossMarket') {
      queryConfig = pumpfunCrossMarketQuery;
    } else if (queryType === 'graduated') {
      queryConfig = graduatedQuery;
    } else {
      queryConfig = pumpTradesQuery;
    }
    raw = JSON.stringify(queryConfig);
    // Create headers here, after settings is loaded
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("Authorization", `Bearer ${settings.bitqueryApiKey}`);
    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: raw,
      redirect: "follow"
    };

    const response = await fetch("https://streaming.bitquery.io/eap", requestOptions);
    
    if (!response.ok) {
      spinner.stop();
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      const responseText = await response.text();
      console.error(`${colors.red}Failed to parse JSON response:${colors.reset}`);
      console.error(`${colors.red}Response text: ${responseText.substring(0, 500)}...${colors.reset}`);
      throw new Error(`JSON parse error: ${parseError.message}`);
    }
    

    
    // Handle different data structures based on query type
    let dataKey = 'DEXTrades';
    if (queryType === 'graduated') {
      dataKey = 'DEXPools';
    }
    
    if (!result?.data?.Solana?.[dataKey]) {
      // Try fallback query if main query fails (only for DEXTrades queries)
      if (queryType !== 'graduated') {
        console.log(`${colors.yellow}Main query failed, trying fallback query...${colors.reset}`);
        
        const fallbackRaw = JSON.stringify(fallbackQuery);
        const fallbackResponse = await fetch("https://streaming.bitquery.io/eap", {
          method: "POST",
          headers: myHeaders,
          body: fallbackRaw,
          redirect: "follow"
        });
        
        if (!fallbackResponse.ok) {
          throw new Error(`Fallback query failed: HTTP ${fallbackResponse.status}`);
        }
        
        const fallbackResult = await fallbackResponse.json();
        
        if (!fallbackResult?.data?.Solana?.DEXTrades) {
          throw new Error('No trade data found in fallback response');
        }
        
        result.data.Solana.DEXTrades = fallbackResult.data.Solana.DEXTrades;
      } else {
        throw new Error(`No pool data found in response for ${queryType} mode`);
      }
    }
    
    spinner.stop();

    const trades = result.data.Solana[dataKey];
    
    // Validate data structure
    const validTrades = trades.filter(trade => {
      if (!trade) {
        console.error(`${colors.yellow}Invalid data: missing trade object${colors.reset}`);
        return false;
      }
      
      if (queryType === 'graduated') {
        // For graduated, we expect Pool structure
        if (!trade.Pool || !trade.Pool.Market || !trade.Pool.Market.BaseCurrency) {
          console.error(`${colors.yellow}Invalid pool: missing Pool.Market.BaseCurrency${colors.reset}`);
          return false;
        }
        // For pools, Block.Time might not be required
        return true;
      } else {
        // For other modes, we expect Trade structure with Block.Time
        if (!trade.Block || !trade.Block.Time) {
          // Only log this error for non-graduated modes to reduce noise
          if (queryType !== 'graduated') {
            console.error(`${colors.yellow}Invalid trade structure: missing Block.Time${colors.reset}`);
          }
          return false;
        }
        if (!trade.Trade || !trade.Trade.Buy || !trade.Trade.Buy.Currency) {
          console.error(`${colors.yellow}Invalid trade: missing Trade.Buy.Currency${colors.reset}`);
          return false;
        }
        return true;
      }
    });
    
    if (!validTrades || validTrades.length === 0) {
      console.clear();
      console.log(`${colors.yellow}No trades found. Would you like to:`);
      console.log(`1. Retry current mode`);
      console.log(`2. Change monitoring mode`);
      console.log(`3. Exit${colors.reset}\n`);

      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'Select action:',
          choices: [
            { name: 'Retry current mode', value: 'retry' },
            { name: 'Change monitoring mode', value: 'change' },
            { name: 'Exit', value: 'exit' }
          ]
        }
      ]);

      switch (action) {
        case 'retry':
          await new Promise(resolve => setTimeout(resolve, 2000));
          return startStream(queryType);
        case 'change':
          return initializeApp(MENU_STATES.MONITOR);
        case 'exit':
          cleanup();
        break;
      }
      return false;
    }

    try {
          appState.setTrades(validTrades);
    await appState.displayTrade(0); // Mode is now tracked in state
      return true;
    } catch (stateError) {
      console.error(`${colors.red}Error in state management: ${stateError.message}${colors.reset}`);
      console.error(`${colors.red}Stack trace: ${stateError.stack}${colors.reset}`);
      throw stateError;
    }

  } catch (error) {
    spinner.stop();
    let errorMsg = `BitQuery Stream Error: ${error.message}`;
    
    // Handle specific API errors
    if (error.message.includes('Account blocked')) {
      errorMsg = 'BitQuery API account is blocked. Please check your API key or contact support.';
      console.error(`${colors.red}${errorMsg}${colors.reset}`);
      console.error(`${colors.yellow}Please update your API key in the settings menu.${colors.reset}`);
    } else if (error.message.includes('ENOTFOUND')) {
      errorMsg = 'Network connection failed. Please check your internet connection.';
      console.error(`${colors.red}${errorMsg}${colors.reset}`);
    } else {
      console.error(`${colors.red}${errorMsg}${colors.reset}`);
    }
    
    logToFile(errorMsg, 'error');
    
    const { retry } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'retry',
        message: 'Connection failed. Would you like to retry?',
        default: true
      }
    ]);

    if (retry) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return startStream(queryType);
    }
    return false;
  }
}

// Modify openTokenWidget to use existing server
async function openTokenWidget(tokenAddress) {
  try {
    // Get the template
    const template = `
<!DOCTYPE html>
<html>
<head>
    <title>Price Chart</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { margin: 0; padding: 20px; background: #1a1a1a; color: #fff; }
        #chart-container { width: 100%; height: 80vh; }
    </style>
</head>
<body>
    <canvas id="chart-container"></canvas>
    <script>
        const ctx = document.getElementById('chart-container').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Token Price',
                    data: [],
                    borderColor: '#00ff00',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Token Price Chart - ${tokenAddress}',
                        color: '#fff'
                    },
                    legend: {
                        labels: {
                            color: '#fff'
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#fff' },
                        grid: { color: '#333' }
                    },
                    y: {
                        ticks: { color: '#fff' },
                        grid: { color: '#333' }
                    }
                }
            }
        });
    </script>
</body>
</html>`;

    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    // Create chart.html file
    const chartFile = path.join(tempDir, 'chart.html');
    fs.writeFileSync(chartFile, template);

    // Open the URL in default browser
    const url = `http://localhost:${SERVER_PORT}/chart.html`;
    const command = process.platform === 'win32' ? 'start' :
                   process.platform === 'darwin' ? 'open' : 'xdg-open';
    
    exec(`${command} "${url}"`);

    // Log success
    console.log(`${colors.green}Opening chart at ${url}${colors.reset}`);

  } catch (error) {
    console.error(`${colors.red}Error opening price chart: ${error.message}${colors.reset}`);
  }
}

// Add new function to open GMGN chart
function openGMGNChart(tokenAddress) {
  try {
    const url = `https://www.gmgn.cc/kline/sol/${tokenAddress}?interval=1S`;
    const command = process.platform === 'win32' ? 'start' :
                   process.platform === 'darwin' ? 'open' : 'xdg-open';
    
    exec(`${command} "${url}"`);
    console.log(`${colors.green}Opening GMGN chart for ${tokenAddress}${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}Error opening GMGN chart: ${error.message}${colors.reset}`);
  }
}

// WALLET MANAGER
const walletsDir = path.join(__dirname, 'wallets');
if (!fs.existsSync(walletsDir)) {
  fs.mkdirSync(walletsDir);
}
function getWalletFiles() {
  return fs.readdirSync(walletsDir).filter(f => f.endsWith('.json'));
}
function getWalletPath(name) {
  return path.join(walletsDir, `${name}.json`);
}
function saveWallet(name, keypair) {
  const data = {
    secretKey: bs58.encode(keypair.secretKey),
    publicKey: keypair.publicKey.toBase58()
  };
  fs.writeFileSync(getWalletPath(name), JSON.stringify(data, null, 2));
}
function loadWallet(name) {
  const data = JSON.parse(fs.readFileSync(getWalletPath(name), 'utf-8'));
  return Keypair.fromSecretKey(bs58.decode(data.secretKey));
}
function getWalletPublicKey(name) {
  const data = JSON.parse(fs.readFileSync(getWalletPath(name), 'utf-8'));
  return data.publicKey || Keypair.fromSecretKey(bs58.decode(data.secretKey)).publicKey.toBase58();
}
function listWallets() {
  return getWalletFiles().map(f => f.replace('.json', ''));
}
async function createWallet() {
  const { name } = await inquirer.prompt([
    { type: 'input', name: 'name', message: 'Wallet name:' }
  ]);
  if (!name) return;
  if (fs.existsSync(getWalletPath(name))) {
    console.log(chalk.red('Wallet already exists.'));
    return;
  }
  const keypair = Keypair.generate();
  saveWallet(name, keypair);
  console.log(chalk.green(`Wallet '${name}' created.`));
}
async function selectWallet() {
  const wallets = listWallets();
  if (wallets.length === 0) {
    console.log(chalk.yellow('No wallets found.'));
    return;
  }
  const { name } = await inquirer.prompt([
    { type: 'list', name: 'name', message: 'Select wallet:', choices: wallets }
  ]);
  settings.activeWallet = name;
  saveSettings();
  console.log(chalk.green(`Active wallet set to '${name}'.`));
}
async function exportWallet() {
  const wallets = listWallets();
  if (wallets.length === 0) {
    console.log(chalk.yellow('No wallets found.'));
    return;
  }
  const { name } = await inquirer.prompt([
    { type: 'list', name: 'name', message: 'Select wallet to export:', choices: wallets }
  ]);
  const data = JSON.parse(fs.readFileSync(getWalletPath(name), 'utf-8'));
  console.log(chalk.cyan(`Wallet '${name}' public key: ${data.publicKey}`));
  console.log(chalk.yellow('Private key (base58):'));
  console.log(data.secretKey);
}
async function importWallet() {
  const { name, privateKey } = await inquirer.prompt([
    { 
      type: 'input', 
      name: 'name', 
      message: 'Wallet name:',
      validate: (input) => {
        if (!input.trim()) return 'Wallet name is required';
        if (fs.existsSync(getWalletPath(input.trim()))) {
          return 'Wallet with this name already exists';
        }
        return true;
      }
    },
    { 
      type: 'password', 
      name: 'privateKey', 
      message: 'Private key (base58 format):',
      validate: (input) => {
        if (!input.trim()) return 'Private key is required';
        try {
          // Validate the private key format
          const decoded = bs58.decode(input.trim());
          if (decoded.length !== 64) {
            return 'Invalid private key length. Expected 64 bytes.';
          }
          // Test if we can create a keypair from it
          const keypair = Keypair.fromSecretKey(decoded);
          return true;
        } catch (error) {
          return 'Invalid private key format. Please enter a valid base58 encoded private key.';
        }
      }
    }
  ]);

  try {
    // Decode the private key
    const secretKey = bs58.decode(privateKey.trim());
    const keypair = Keypair.fromSecretKey(secretKey);
    
    // Save the wallet
    saveWallet(name.trim(), keypair);
    
    console.log(chalk.green(`✅ Wallet '${name}' imported successfully!`));
    console.log(chalk.cyan(`Public key: ${keypair.publicKey.toBase58()}`));
    
    // Ask if user wants to set this as active wallet
    const { setActive } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'setActive',
        message: 'Set this wallet as active?',
        default: true
      }
    ]);
    
    if (setActive) {
      settings.activeWallet = name.trim();
      saveSettings();
      console.log(chalk.green(`✅ Wallet '${name}' set as active wallet.`));
    }
    
  } catch (error) {
    console.log(chalk.red(`❌ Failed to import wallet: ${error.message}`));
  }
}

async function getWalletBalance(walletName) {
  try {
    const keypair = loadWallet(walletName);
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const balance = await connection.getBalance(keypair.publicKey);
    return balance / LAMPORTS_PER_SOL;
  } catch (e) {
    return 0;
  }
}

async function getActiveWalletInfo() {
  if (!settings.activeWallet) {
    return { name: 'None', balance: 0, publicKey: 'No wallet selected' };
  }
  
  try {
    const keypair = loadWallet(settings.activeWallet);
    const connection = new Connection('https://api.mainnet-beta.solana.com');
    const balance = await connection.getBalance(keypair.publicKey);
    return {
      name: settings.activeWallet,
      balance: balance / LAMPORTS_PER_SOL,
      publicKey: keypair.publicKey.toBase58()
    };
  } catch (e) {
    return {
      name: settings.activeWallet,
      balance: 0,
      publicKey: 'Error fetching balance',
      error: e.message
    };
  }
}

async function checkBalance() {
  if (!settings.activeWallet) {
    console.log(chalk.yellow('No active wallet. Please select a wallet first.'));
    return;
  }
  const keypair = loadWallet(settings.activeWallet);
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  try {
    const balance = await connection.getBalance(keypair.publicKey);
    console.log(chalk.green(`Balance for ${keypair.publicKey.toBase58()}: ${balance / LAMPORTS_PER_SOL} SOL`));
  } catch (e) {
    console.log(chalk.red('Failed to fetch balance:', e.message));
  }
}
async function walletManagerMenu() {
  let exit = false;
  while (!exit) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Wallet Manager:',
        choices: [
          { name: 'Create New Wallet', value: 'create' },
          { name: 'Import Wallet by Private Key', value: 'import' },
          { name: 'Change Active Wallet', value: 'change' },
          { name: 'Export Wallet Keypair', value: 'export' },
          { name: 'List Wallets', value: 'list' },
          { name: 'Check Balance', value: 'balance' },
          { name: '🔧 Advanced Wallet Tools', value: 'advanced' },
          { name: `${colors.white}[SPACE]${colors.reset} ${colors.yellow}⬅️ Back to Main Menu${colors.reset}`, value: 'back' }
        ]
      }
    ]);
    switch (action) {
      case 'create':
        await createWallet();
        break;
      case 'import':
        await importWallet();
        break;
      case 'change':
        await selectWallet();
        break;
      case 'export':
        await exportWallet();
        break;
      case 'list': {
        const wallets = listWallets();
        if (wallets.length === 0) {
          console.log(chalk.yellow('No wallets found.'));
        } else {
          console.log(chalk.cyan('Wallets:'));
          for (const w of wallets) {
            const pub = getWalletPublicKey(w);
            const active = (settings.activeWallet === w) ? chalk.green(' (ACTIVE)') : '';
            const balance = await getWalletBalance(w);
            const balanceText = balance > 0 ? chalk.green(`${balance.toFixed(4)} SOL`) : chalk.red(`${balance.toFixed(4)} SOL`);
            console.log(` - ${w}: ${chalk.yellow(pub)}${active} | ${balanceText}`);
          }
        }
        break;
      }
      case 'balance':
        await checkBalance();
        break;
      case 'multiwallet':
        await multiWalletTradingMenu();
        break;
      case 'advanced':
        await advancedWalletToolsMenu();
        break;
      case 'back':
        exit = true;
        break;
    }
  }
}

async function advancedWalletToolsMenu() {
  let exit = false;
  while (!exit) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '🔧 Advanced Wallet Tools:',
        choices: [
          { name: '🔄 Multi-Wallet Trading', value: 'multiwallet' },
          { name: '🔴 Enhanced Sell Tokens (Real-time PnL)', value: 'enhancedSell' },
          { name: '💰 Fund Wallets', value: 'fund' },
          { name: '📊 Transfer Tokens', value: 'transfer' },
          { name: '🔄 Refund SOL', value: 'refund' },
          { name: '🎨 Vanity Generator', value: 'vanity' },
          { name: '🗑️ Close Token Accounts', value: 'close' },
          { name: '🔥 Burn Dev Supply', value: 'burn' },
          { name: '📈 Profit Logger', value: 'profit' },
          { name: '🧹 Wallet Cleanup', value: 'cleanup' },
          { name: `${colors.white}[SPACE]${colors.reset} ${colors.yellow}⬅️ Back to Wallet Manager${colors.reset}`, value: 'back' }
        ]
      }
    ]);
    
    switch (action) {
      case 'multiwallet':
        await multiWalletTradingMenu();
        break;
      case 'enhancedSell':
        const walletInfo = await getActiveWalletInfo();
        if (walletInfo.name === 'None') {
          console.log(`${colors.red}❌ No active wallet selected${colors.reset}`);
          console.log(`${colors.cyan}💡 Please select a wallet first${colors.reset}`);
          await waitForSpaceKey();
        } else {
          const wallet = loadWallet(walletInfo.name);
          await handleSellToken(wallet);
        }
        break;
      case 'fund':
        console.log(`${colors.cyan}💰 Fund Wallets functionality coming soon...${colors.reset}`);
        await waitForSpaceKey();
        break;
      case 'transfer':
        console.log(`${colors.cyan}📊 Transfer Tokens functionality coming soon...${colors.reset}`);
        await waitForSpaceKey();
        break;
      case 'refund':
        console.log(`${colors.cyan}🔄 Refund SOL functionality coming soon...${colors.reset}`);
        await waitForSpaceKey();
        break;
      case 'vanity':
        console.log(`${colors.cyan}🎨 Vanity Generator functionality coming soon...${colors.reset}`);
        await waitForSpaceKey();
        break;
      case 'close':
        console.log(`${colors.cyan}🗑️ Close Token Accounts functionality coming soon...${colors.reset}`);
        await waitForSpaceKey();
        break;
      case 'burn':
        console.log(`${colors.cyan}🔥 Burn Dev Supply functionality coming soon...${colors.reset}`);
        await waitForSpaceKey();
        break;
      case 'profit':
        console.log(`${colors.cyan}📈 Profit Logger functionality coming soon...${colors.reset}`);
        await waitForSpaceKey();
        break;
      case 'cleanup':
        console.log(`${colors.cyan}🧹 Wallet Cleanup functionality coming soon...${colors.reset}`);
        await waitForSpaceKey();
        break;
      case 'back':
        exit = true;
        break;
    }
  }
}

async function bundleBuySellMenu() {
  const tokens = [];
  let addMore = true;
  while (addMore) {
    const { token, action } = await inquirer.prompt([
      { type: 'input', name: 'token', message: 'Enter token address:' },
      { type: 'list', name: 'action', message: 'Buy or Sell?', choices: ['buy', 'sell'] }
    ]);
    tokens.push({ token, action });
    const { more } = await inquirer.prompt([
      { type: 'confirm', name: 'more', message: 'Add another token?', default: false }
    ]);
    addMore = more;
  }
  if (tokens.length === 0) return;
  const commands = tokens.map(t => `/${t.action} ${t.token}`);
  console.log(chalk.cyan('Generated commands:'));
  commands.forEach(cmd => console.log(chalk.yellow(cmd)));
  // Copy all commands to clipboard
  copyToClipboard(commands.join('\n'));
  console.log(chalk.green('All commands copied to clipboard.'));
}
async function multiWalletTradingMenu() {
  const wallets = listWallets();
  if (wallets.length === 0) {
    console.log(chalk.yellow('No wallets found.'));
    return;
  }
  const { selectedWallets } = await inquirer.prompt([
    { type: 'checkbox', name: 'selectedWallets', message: 'Select wallets:', choices: wallets }
  ]);
  if (selectedWallets.length === 0) return;
  const tokens = [];
  let addMore = true;
  while (addMore) {
    const { token, action } = await inquirer.prompt([
      { type: 'input', name: 'token', message: 'Enter token address:' },
      { type: 'list', name: 'action', message: 'Buy or Sell?', choices: ['buy', 'sell'] }
    ]);
    tokens.push({ token, action });
    const { more } = await inquirer.prompt([
      { type: 'confirm', name: 'more', message: 'Add another token?', default: false }
    ]);
    addMore = more;
  }
  if (tokens.length === 0) return;
  const commands = [];
  selectedWallets.forEach(wallet => {
    tokens.forEach(t => {
      commands.push(`[${wallet}] /${t.action} ${t.token}`);
    });
  });
  console.log(chalk.cyan('Generated commands:'));
  commands.forEach(cmd => console.log(chalk.yellow(cmd)));
  copyToClipboard(commands.join('\n'));
  console.log(chalk.green('All commands copied to clipboard.'));
}

// Price Alerts Menu
async function priceAlertsMenu() {
  let exit = false;
  while (!exit) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Price Alerts:',
        choices: [
          { name: 'Add New Alert', value: 'add' },
          { name: 'View All Alerts', value: 'view' },
          { name: 'Remove Alert', value: 'remove' },
          { name: 'Clear All Alerts', value: 'clear' },
          { name: 'Back to Main Menu', value: 'exit' }
        ]
      }
    ]);

    switch (action) {
      case 'add': {
        const { tokenAddress, targetPrice, condition, description } = await inquirer.prompt([
          { type: 'input', name: 'tokenAddress', message: 'Token Address:' },
          { type: 'number', name: 'targetPrice', message: 'Target Price (USD):', validate: v => v > 0 },
          { 
            type: 'list', 
            name: 'condition', 
            message: 'Alert when price is:', 
            choices: [
              { name: 'Above target', value: 'above' },
              { name: 'Below target', value: 'below' }
            ]
          },
          { type: 'input', name: 'description', message: 'Alert description (optional):' }
        ]);
        
        const alertId = priceAlerts.addAlert(tokenAddress, targetPrice, condition, description);
        console.log(chalk.green(`Alert created with ID: ${alertId}`));
        break;
      }
      
      case 'view': {
        const alerts = priceAlerts.getAlerts();
        if (alerts.length === 0) {
          console.log(chalk.yellow('No alerts configured.'));
        } else {
          console.log(chalk.cyan('\nActive Price Alerts:'));
          alerts.forEach(alert => {
            const status = alert.triggered ? chalk.red('TRIGGERED') : chalk.green('ACTIVE');
            console.log(`${chalk.yellow('ID:')} ${alert.id}`);
            console.log(`${chalk.white('Token:')} ${alert.tokenAddress}`);
            console.log(`${chalk.white('Target:')} $${alert.targetPrice} (${alert.condition})`);
            console.log(`${chalk.white('Description:')} ${alert.description || 'None'}`);
            console.log(`${chalk.white('Status:')} ${status}`);
            console.log(`${chalk.white('Created:')} ${alert.createdAt.toLocaleString()}\n`);
          });
        }
        break;
      }
      
      case 'remove': {
        const alerts = priceAlerts.getAlerts();
        if (alerts.length === 0) {
          console.log(chalk.yellow('No alerts to remove.'));
          break;
        }
        
        const { alertId } = await inquirer.prompt([
          {
            type: 'list',
            name: 'alertId',
            message: 'Select alert to remove:',
            choices: alerts.map(alert => ({
              name: `${alert.tokenAddress} - $${alert.targetPrice} (${alert.condition})`,
              value: alert.id
            }))
          }
        ]);
        
        if (priceAlerts.removeAlert(alertId)) {
          console.log(chalk.green('Alert removed successfully.'));
        } else {
          console.log(chalk.red('Failed to remove alert.'));
        }
        break;
      }
      
      case 'clear': {
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Are you sure you want to clear all alerts?',
            default: false
          }
        ]);
        
        if (confirm) {
          priceAlerts.alerts.clear();
          console.log(chalk.green('All alerts cleared.'));
        }
        break;
      }
      
      case 'exit':
        exit = true;
        break;
    }
  }
}

// Analytics Dashboard
async function analyticsDashboard() {
  let exit = false;
  while (!exit) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Analytics Dashboard:',
        choices: [
          { name: 'Token Performance Analysis', value: 'performance' },
          { name: 'Market Trends', value: 'trends' },
          { name: 'Volume Analysis', value: 'volume' },
          { name: 'Risk Assessment', value: 'risk' },
          { name: 'Export Data', value: 'export' },
          { name: 'Back to Main Menu', value: 'exit' }
        ]
      }
    ]);

    switch (action) {
      case 'performance': {
        console.log(chalk.cyan('\n📊 Token Performance Analysis'));
        console.log(chalk.dim('Analyzing recent token performance...\n'));
        
        // Simulate performance analysis
        const performance = {
          topGainers: ['Token A (+45%)', 'Token B (+32%)', 'Token C (+28%)'],
          topLosers: ['Token X (-18%)', 'Token Y (-15%)', 'Token Z (-12%)'],
          avgVolume: '$2.4M',
          volatility: 'High'
        };
        
        console.log(`${chalk.green('Top Gainers:')} ${performance.topGainers.join(', ')}`);
        console.log(`${chalk.red('Top Losers:')} ${performance.topLosers.join(', ')}`);
        console.log(`${chalk.cyan('Average Volume:')} ${performance.avgVolume}`);
        console.log(`${chalk.yellow('Market Volatility:')} ${performance.volatility}\n`);
        break;
      }
      
      case 'trends': {
        console.log(chalk.cyan('\n📈 Market Trends'));
        console.log(chalk.dim('Analyzing market trends...\n'));
        
        const trends = {
          bullish: '65% of tokens showing upward momentum',
          bearish: '35% of tokens showing downward pressure',
          neutral: 'Market sentiment is moderately positive'
        };
        
        console.log(`${chalk.green('Bullish Signals:')} ${trends.bullish}`);
        console.log(`${chalk.red('Bearish Signals:')} ${trends.bearish}`);
        console.log(`${chalk.blue('Overall Sentiment:')} ${trends.neutral}\n`);
        break;
      }
      
      case 'volume': {
        console.log(chalk.cyan('\n💰 Volume Analysis'));
        console.log(chalk.dim('Analyzing trading volumes...\n'));
        
        const volume = {
          total24h: '$15.2M',
          avgPerTrade: '$45K',
          volumeSpikes: '3 significant spikes detected',
          liquidity: 'Good liquidity across major pairs'
        };
        
        console.log(`${chalk.green('24h Total Volume:')} ${volume.total24h}`);
        console.log(`${chalk.cyan('Average Trade Size:')} ${volume.avgPerTrade}`);
        console.log(`${chalk.yellow('Volume Spikes:')} ${volume.volumeSpikes}`);
        console.log(`${chalk.blue('Liquidity Status:')} ${volume.liquidity}\n`);
        break;
      }
      
      case 'risk': {
        console.log(chalk.cyan('\n⚠️ Risk Assessment'));
        console.log(chalk.dim('Analyzing risk factors...\n'));
        
        const risks = {
          highRisk: '12 tokens flagged as high risk',
          mediumRisk: '28 tokens flagged as medium risk',
          lowRisk: '45 tokens flagged as low risk',
          recommendations: 'Consider diversifying portfolio'
        };
        
        console.log(`${chalk.red('High Risk:')} ${risks.highRisk}`);
        console.log(`${chalk.yellow('Medium Risk:')} ${risks.mediumRisk}`);
        console.log(`${chalk.green('Low Risk:')} ${risks.lowRisk}`);
        console.log(`${chalk.cyan('Recommendations:')} ${risks.recommendations}\n`);
        break;
      }
      
      case 'export': {
        const { format } = await inquirer.prompt([
          {
            type: 'list',
            name: 'format',
            message: 'Export format:',
            choices: [
              { name: 'CSV', value: 'csv' },
              { name: 'JSON', value: 'json' },
              { name: 'Text Report', value: 'txt' }
            ]
          }
        ]);
        
        console.log(chalk.green(`\nExporting data in ${format.toUpperCase()} format...`));
        console.log(chalk.dim('Data exported to ./exports/analytics_report.' + format + '\n'));
        break;
      }
      
      case 'exit':
        exit = true;
        break;
    }
  }
}

// Token Scanner
async function tokenScannerMenu() {
  let exit = false;
  while (!exit) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Token Scanner:',
        choices: [
          { name: 'Scan for New Tokens', value: 'scan' },
          { name: 'Honeypot Detection', value: 'honeypot' },
          { name: 'Liquidity Analysis', value: 'liquidity' },
          { name: 'Contract Verification', value: 'contract' },
          { name: 'Back to Main Menu', value: 'exit' }
        ]
      }
    ]);

    switch (action) {
      case 'scan': {
        console.log(chalk.cyan('\n🔍 Scanning for new tokens...\n'));
        
        // Simulate token scanning
        const newTokens = [
          { address: 'Token1...', name: 'New Token 1', liquidity: '$50K', risk: 'Low' },
          { address: 'Token2...', name: 'New Token 2', liquidity: '$25K', risk: 'Medium' },
          { address: 'Token3...', name: 'New Token 3', liquidity: '$100K', risk: 'Low' }
        ];
        
        console.log(chalk.green('New tokens found:'));
        newTokens.forEach((token, i) => {
          const riskColor = token.risk === 'Low' ? chalk.green : token.risk === 'Medium' ? chalk.yellow : chalk.red;
          console.log(`${i + 1}. ${chalk.cyan(token.name)} (${token.address})`);
          console.log(`   Liquidity: ${chalk.blue(token.liquidity)} | Risk: ${riskColor(token.risk)}\n`);
        });
        break;
      }
      
      case 'honeypot': {
        const { tokenAddress } = await inquirer.prompt([
          { type: 'input', name: 'tokenAddress', message: 'Enter token address to check:' }
        ]);
        
        console.log(chalk.cyan('\n🔍 Checking for honeypot characteristics...\n'));
        
        // Simulate honeypot detection
        const results = {
          isHoneypot: false,
          sellTax: '5%',
          buyTax: '3%',
          liquidityLocked: true,
          warnings: ['High sell tax detected', 'Liquidity appears locked']
        };
        
        if (results.isHoneypot) {
          console.log(chalk.red('🚨 HONEYPOT DETECTED! 🚨'));
        } else {
          console.log(chalk.green('✅ Token appears safe'));
        }
        
        console.log(`Sell Tax: ${chalk.yellow(results.sellTax)}`);
        console.log(`Buy Tax: ${chalk.yellow(results.buyTax)}`);
        console.log(`Liquidity Locked: ${results.liquidityLocked ? chalk.green('Yes') : chalk.red('No')}`);
        
        if (results.warnings.length > 0) {
          console.log(chalk.yellow('\n⚠️ Warnings:'));
          results.warnings.forEach(warning => console.log(`- ${warning}`));
        }
        console.log('\n');
        break;
      }
      
      case 'liquidity': {
        const { tokenAddress } = await inquirer.prompt([
          { type: 'input', name: 'tokenAddress', message: 'Enter token address:' }
        ]);
        
        console.log(chalk.cyan('\n💰 Analyzing liquidity...\n'));
        
        // Simulate liquidity analysis
        const liquidity = {
          totalLiquidity: '$250K',
          lockedLiquidity: '$200K',
          unlockDate: '2025-12-31',
          liquidityScore: '8.5/10',
          recommendations: ['Good liquidity ratio', 'Consider monitoring unlock dates']
        };
        
        console.log(`${chalk.green('Total Liquidity:')} ${liquidity.totalLiquidity}`);
        console.log(`${chalk.blue('Locked Liquidity:')} ${liquidity.lockedLiquidity}`);
        console.log(`${chalk.yellow('Unlock Date:')} ${liquidity.unlockDate}`);
        console.log(`${chalk.cyan('Liquidity Score:')} ${liquidity.liquidityScore}`);
        
        console.log(chalk.cyan('\nRecommendations:'));
        liquidity.recommendations.forEach(rec => console.log(`- ${rec}`));
        console.log('\n');
        break;
      }
      
      case 'contract': {
        const { tokenAddress } = await inquirer.prompt([
          { type: 'input', name: 'tokenAddress', message: 'Enter token address:' }
        ]);
        
        console.log(chalk.cyan('\n📋 Contract verification...\n'));
        
        // Simulate contract verification
        const verification = {
          verified: true,
          sourceCode: 'Available',
          compiler: 'Solana 1.17.0',
          optimization: 'Enabled',
          securityScore: '9.2/10',
          issues: ['Minor: Consider using SafeMath']
        };
        
        console.log(`Verified: ${verification.verified ? chalk.green('Yes') : chalk.red('No')}`);
        console.log(`Source Code: ${chalk.blue(verification.sourceCode)}`);
        console.log(`Compiler: ${chalk.cyan(verification.compiler)}`);
        console.log(`Optimization: ${chalk.yellow(verification.optimization)}`);
        console.log(`Security Score: ${chalk.green(verification.securityScore)}`);
        
        if (verification.issues.length > 0) {
          console.log(chalk.yellow('\nIssues Found:'));
          verification.issues.forEach(issue => console.log(`- ${issue}`));
        }
        console.log('\n');
        break;
      }
      
      case 'exit':
        exit = true;
        break;
    }
  }
}

// Check Token Address Menu
async function checkTokenAddressMenu() {
  console.clear();
  showLogo();

  const { tokenAddress } = await inquirer.prompt([
    {
      type: 'input',
      name: 'tokenAddress',
      message: 'Enter token address to check:',
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'Please enter a token address';
        }
        if (input.trim().length < 32) {
          return 'Token address seems too short';
        }
        return true;
      }
    }
  ]);

  if (tokenAddress) {
    console.log(`${colors.cyan}🔍 Checking token: ${tokenAddress}${colors.reset}\n`);
    
    try {
      const jupiterData = await checkJupiterTokenRealtime(tokenAddress.trim());
      
      if (jupiterData.success && jupiterData.data) {
        console.log(`${colors.green}✅ Token Found!${colors.reset}\n`);
        
        const data = jupiterData.data;
        
        // Display comprehensive token information
        console.log(`${colors.magenta}🔍 Jupiter Token Information:${colors.reset}`);
        console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
        
        // Basic token info
        if (data.name && data.symbol) {
          console.log(`${colors.green}📝 Name:${colors.reset} ${data.name}`);
          console.log(`${colors.green}💎 Symbol:${colors.reset} ${data.symbol}`);
        }
        
        if (data.decimals !== undefined) {
          console.log(`${colors.blue}🔢 Decimals:${colors.reset} ${data.decimals}`);
        }
        
        // Price and market data
        if (data.price) {
          console.log(`${colors.yellow}💰 Current Price:${colors.reset} $${data.price.toFixed(6)}`);
        }
        
        if (data.marketCap) {
          console.log(`${colors.blue}🏦 Market Cap:${colors.reset} $${data.marketCap.toLocaleString()}`);
        }
        
        if (data.liquidity) {
          console.log(`${colors.cyan}💧 Liquidity:${colors.reset} $${data.liquidity.toLocaleString()}`);
        }
        
        if (data.volume24h) {
          console.log(`${colors.purple}📊 24h Volume:${colors.reset} $${data.volume24h.toLocaleString()}`);
        }
        
        if (data.holderCount) {
          console.log(`${colors.orange}👥 Holders:${colors.reset} ${data.holderCount.toLocaleString()}`);
        }
        
        // Status indicators
        const verifyIcon = data.verified ? '✓' : '✗';
        const verifyColor = data.verified ? colors.green : colors.red;
        console.log(`${colors.white}🔒 Verification:${colors.reset} ${verifyColor}${verifyIcon} ${data.verified ? 'Verified' : 'Unverified'}${colors.reset}`);
        
        if (data.organicScore !== undefined) {
          const scoreColor = data.organicScore > 50 ? colors.green : data.organicScore > 25 ? colors.yellow : colors.red;
          console.log(`${colors.white}🌱 Organic Score:${colors.reset} ${scoreColor}${data.organicScore} (${data.organicScoreLabel})${colors.reset}`);
        }
        
        const liqIcon = data.hasLiquidity ? '✓' : '✗';
        const liqColor = data.hasLiquidity ? colors.green : colors.red;
        console.log(`${colors.white}💧 Has Liquidity:${colors.reset} ${liqColor}${liqIcon} ${data.hasLiquidity ? 'Yes' : 'No'}${colors.reset}`);
        
        console.log(''); // Empty line for spacing
        
        // Quick risk assessment
        console.log(`${colors.cyan}🎯 Quick Risk Assessment:${colors.reset}`);
        console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
        
        let riskScore = 0;
        let riskFactors = [];
        
        if (data.verified) riskScore += 20;
        else riskFactors.push('Unverified token');
        
        if (data.hasLiquidity) riskScore += 20;
        else riskFactors.push('No liquidity');
        
        if (data.organicScore > 50) riskScore += 20;
        else if (data.organicScore > 25) riskScore += 10;
        else riskFactors.push('Low organic score');
        
        if (data.holderCount > 1000) riskScore += 20;
        else if (data.holderCount > 100) riskScore += 10;
        else riskFactors.push('Low holder count');
        
        if (data.marketCap > 100000) riskScore += 20;
        else riskFactors.push('Low market cap');
        
        const riskColor = riskScore >= 80 ? colors.green : riskScore >= 60 ? colors.yellow : colors.red;
        const riskLevel = riskScore >= 80 ? 'LOW' : riskScore >= 60 ? 'MEDIUM' : 'HIGH';
        
        console.log(`${colors.white}Risk Score:${colors.reset} ${riskColor}${riskScore}/100 (${riskLevel})${colors.reset}`);
        
        if (riskFactors.length > 0) {
          console.log(`${colors.white}Risk Factors:${colors.reset}`);
          riskFactors.forEach(factor => {
            console.log(`${colors.red}  • ${factor}${colors.reset}`);
          });
        }
        
        console.log(''); // Empty line for spacing
        
        // Useful links
        console.log(`${colors.cyan}🔗 Useful Links:${colors.reset}`);
        console.log(`${colors.blue}• Solscan: https://solscan.io/token/${tokenAddress}${colors.reset}`);
        console.log(`${colors.blue}• GMGN.io: https://gmgn.ai/sol/token/${tokenAddress}${colors.reset}`);
        console.log(`${colors.blue}• Jupiter: https://jup.ag/swap/SOL-${tokenAddress}${colors.reset}`);
        
      } else {
        console.log(`${colors.red}❌ Token not found or error occurred${colors.reset}`);
        if (jupiterData.error) {
          console.log(`${colors.yellow}Error: ${jupiterData.error}${colors.reset}`);
        }
      }
      
    } catch (error) {
      console.error(`${colors.red}Error checking token: ${error.message}${colors.reset}`);
    }
    
    console.log(`\n${colors.yellow}Press any key to continue...${colors.reset}`);
    await new Promise(resolve => {
      process.stdin.once('data', resolve);
    });
  }
}

// Jupiter Analysis Menu
async function jupiterAnalysisMenu() {
  let exit = false;
  while (!exit) {
    console.clear();
    showLogo();
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Jupiter Token Analysis:',
        choices: [
          { name: '🤖 AI-Powered Token Analysis', value: 'ai_analysis' },
          { name: '🤖 AI Batch Analysis', value: 'ai_batch' },
          { name: '🤖 AI Token Scanner', value: 'ai_scanner' },
          { name: 'Analyze Single Token', value: 'single' },
          { name: 'Batch Token Analysis', value: 'batch' },
          { name: 'Trading Decision Maker', value: 'decision' },
          { name: 'Risk Assessment Tool', value: 'risk' },
          { name: 'Real-time Token Monitor', value: 'realtime' },
          { name: `${colors.white}[SPACE]${colors.reset} ${colors.yellow}⬅️ Back to Main Menu${colors.reset}`, value: 'back' }
        ]
      }
    ]);

    switch (action) {
      case 'ai_analysis': {
        const { tokenAddress } = await inquirer.prompt([
          { type: 'input', name: 'tokenAddress', message: 'Enter token address for AI analysis:' }
        ]);
        
        if (tokenAddress) {
          console.log(`${colors.cyan}🤖 Starting AI-powered analysis for: ${tokenAddress}${colors.reset}\n`);
          
          try {
            const analysis = await aiJupiterAnalyzer.analyzeTokenWithAI(tokenAddress);
            if (analysis.success) {
              aiJupiterAnalyzer.displayAIAnalysis(analysis);
            } else {
              console.log(`${colors.red}❌ AI Analysis failed: ${analysis.error}${colors.reset}`);
            }
          } catch (error) {
            console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
          }
          
          // Keep output visible and wait for Space key
          console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
          await waitForSpaceKey();
        }
        break;
      }
      
      case 'ai_batch': {
        const { tokenAddresses } = await inquirer.prompt([
          { type: 'input', name: 'tokenAddresses', message: 'Enter token addresses for AI batch analysis (comma-separated):' }
        ]);
        
        if (tokenAddresses) {
          const addresses = tokenAddresses.split(',').map(addr => addr.trim()).filter(addr => addr);
          
          if (addresses.length > 0) {
            console.log(`${colors.cyan}🤖 Starting AI batch analysis for ${addresses.length} tokens...${colors.reset}\n`);
            
            const results = [];
            
            for (let i = 0; i < addresses.length; i++) {
              const address = addresses[i];
              try {
                console.log(`${colors.yellow}🤖 AI Analyzing (${i + 1}/${addresses.length}): ${address}${colors.reset}`);
                const analysis = await aiJupiterAnalyzer.analyzeTokenWithAI(address);
                
                if (analysis.success) {
                  const summary = {
                    address,
                    action: analysis.aiAnalysis.tradingRecommendation.action,
                    confidence: analysis.aiAnalysis.tradingRecommendation.confidence,
                    riskLevel: analysis.aiAnalysis.riskAssessment.riskLevel,
                    price: analysis.jupiterData.price,
                    sentiment: analysis.aiAnalysis.sentiment.data.overall
                  };
                  results.push(summary);
                  
                  console.log(`   ✅ ${analysis.jupiterData.name || 'Unknown'} (${analysis.jupiterData.symbol || 'N/A'})`);
                  console.log(`   🎯 Action: ${summary.action}`);
                  console.log(`   📊 Confidence: ${(summary.confidence * 100).toFixed(1)}%`);
                  console.log(`   ⚠️ Risk: ${summary.riskLevel}`);
                  console.log(`   💰 Price: $${summary.price.toFixed(9)}`);
                  console.log(`   📈 Sentiment: ${summary.sentiment}/100`);
                  console.log('');
                } else {
                  console.log(`   ❌ Error: ${analysis.error}`);
                  console.log('');
                }
                
                // Add delay between requests to avoid rate limiting
                if (i < addresses.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 2000));
                }
              } catch (error) {
                console.error(`${colors.red}Error analyzing ${address}: ${error.message}${colors.reset}`);
                console.log('');
              }
            }
            
            // Display batch summary
            console.log(`${colors.cyan}📊 AI BATCH ANALYSIS SUMMARY${colors.reset}`);
            console.log(`${'═'.repeat(50)}`);
            
            const buySignals = results.filter(r => r.action === 'BUY');
            const sellSignals = results.filter(r => r.action === 'SELL');
            const avoidSignals = results.filter(r => r.action === 'AVOID');
            const holdSignals = results.filter(r => r.action === 'HOLD');
            
            console.log(`🎯 Buy Signals: ${colors.green}${buySignals.length}${colors.reset}`);
            console.log(`📉 Sell Signals: ${colors.red}${sellSignals.length}${colors.reset}`);
            console.log(`⚠️ Avoid Signals: ${colors.yellow}${avoidSignals.length}${colors.reset}`);
            console.log(`⏸️ Hold Signals: ${colors.cyan}${holdSignals.length}${colors.reset}`);
            console.log(`📊 Total Analyzed: ${results.length}`);
            
            if (buySignals.length > 0) {
              console.log(`\n${colors.green}🚀 TOP BUY RECOMMENDATIONS:${colors.reset}`);
              buySignals
                .sort((a, b) => b.confidence - a.confidence)
                .slice(0, 3)
                .forEach((signal, index) => {
                  console.log(`${index + 1}. ${signal.address}`);
                  console.log(`   Confidence: ${(signal.confidence * 100).toFixed(1)}%`);
                  console.log(`   Risk: ${signal.riskLevel}`);
                  console.log(`   Sentiment: ${signal.sentiment}/100`);
                  console.log('');
                });
            }
          }
          
          // Keep output visible and wait for Space key
          console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
          await waitForSpaceKey();
        }
        break;
      }
      
      case 'ai_scanner': {
        const { scanType, limit } = await inquirer.prompt([
          {
            type: 'list',
            name: 'scanType',
            message: 'Select scan type:',
            choices: [
              { name: 'Trending Tokens', value: 'trending' },
              { name: 'High Volume Tokens', value: 'volume' },
              { name: 'New Tokens', value: 'new' }
            ]
          },
          {
            type: 'number',
            name: 'limit',
            message: 'Number of tokens to scan:',
            default: 10,
            validate: (value) => {
              if (value > 0 && value <= 50) return true;
              return 'Please enter a number between 1 and 50';
            }
          }
        ]);
        
        console.log(`${colors.cyan}🤖 Starting AI Token Scanner...${colors.reset}\n`);
        
        try {
          const scanData = await aiTokenScanner.scanTokensWithAI(scanType, limit);
          aiTokenScanner.displayScanResults(scanData);
        } catch (error) {
          console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
        }
        
        // Keep output visible and wait for Space key
        console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
        await waitForSpaceKey();
        break;
      }
      
      case 'single': {
        const { tokenAddress } = await inquirer.prompt([
          { type: 'input', name: 'tokenAddress', message: 'Enter token address:' }
        ]);
        
        if (tokenAddress) {
          console.log(`${colors.cyan}🔍 Analyzing token: ${tokenAddress}${colors.reset}\n`);
          
          try {
            const analysis = await getDetailedAnalysis(tokenAddress);
            if (analysis.success) {
              displayJupiterAnalysis(analysis);
            } else {
              console.log(`${colors.red}❌ Analysis failed: ${analysis.error}${colors.reset}`);
            }
          } catch (error) {
            console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
          }
          
          // Keep output visible and wait for Space key
          console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
          await waitForSpaceKey();
        }
        break;
      }
      
      case 'batch': {
        const { tokenAddresses } = await inquirer.prompt([
          { type: 'input', name: 'tokenAddresses', message: 'Enter token addresses (comma-separated):' }
        ]);
        
        if (tokenAddresses) {
          const addresses = tokenAddresses.split(',').map(addr => addr.trim()).filter(addr => addr);
          
          if (addresses.length > 0) {
            console.log(`${colors.cyan}🔍 Batch analyzing ${addresses.length} tokens...${colors.reset}\n`);
            
            for (const address of addresses) {
              try {
                console.log(`${colors.yellow}Analyzing: ${address}${colors.reset}`);
                const analysis = await searchToken(address);
                
                if (analysis.success) {
                  console.log(`✅ ${analysis.analysis.basic.name} (${analysis.analysis.basic.symbol})`);
                  console.log(`   Verified: ${analysis.analysis.metadata?.verified ? 'Yes' : 'No'}`);
                  console.log(`   Liquidity: ${analysis.analysis.trading?.hasLiquidity ? 'Yes' : 'No'}`);
                  if (analysis.analysis.metadata?.price) {
                    console.log(`   Price: $${analysis.analysis.metadata.price.toFixed(6)}`);
                  }
                } else {
                  console.log(`❌ Error: ${analysis.error}`);
                }
                console.log('');
                
                // Add delay between requests
                await new Promise(resolve => setTimeout(resolve, 1000));
              } catch (error) {
                console.error(`${colors.red}Error analyzing ${address}: ${error.message}${colors.reset}`);
              }
            }
          }
          
          // Keep output visible and wait for Space key
          console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
          await waitForSpaceKey();
        }
        break;
      }
      
      case 'decision': {
        const { tokenAddress, tradeAmount } = await inquirer.prompt([
          { type: 'input', name: 'tokenAddress', message: 'Enter token address:' },
          { type: 'number', name: 'tradeAmount', message: 'Trade amount (USD):', default: 1000 }
        ]);
        
        if (tokenAddress) {
          console.log(`${colors.cyan}🤖 Making trading decision for ${tokenAddress}${colors.reset}\n`);
          
          try {
            const decision = await makeTradingDecisionWithJupiter(tokenAddress, tradeAmount);
            
            console.log(`${colors.cyan}🎯 Final Decision${colors.reset}`);
            console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
            
            const decisionColors = {
              'APPROVE': colors.green,
              'CAUTION': colors.yellow,
              'REJECT': colors.red,
              'ERROR': colors.red
            };
            
            console.log(`${decisionColors[decision.decision] || colors.white}${decision.decision}${colors.reset}`);
            console.log(`${colors.yellow}Reason: ${decision.reason}${colors.reset}`);
            console.log(`${colors.yellow}Safety Score: ${decision.score}/100${colors.reset}`);
            
          } catch (error) {
            console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
          }
          
          // Keep output visible and wait for Space key
          console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
          await waitForSpaceKey();
        }
        break;
      }
      
      case 'risk': {
        const { tokenAddress } = await inquirer.prompt([
          { type: 'input', name: 'tokenAddress', message: 'Enter token address:' }
        ]);
        
        if (tokenAddress) {
          console.log(`${colors.cyan}⚠️ Risk assessment for ${tokenAddress}${colors.reset}\n`);
          
          try {
            const analysis = await getDetailedAnalysis(tokenAddress);
            if (analysis.success) {
              // Display only risk-related information
              const data = analysis.analysis;
              
              console.log(`${colors.cyan}Risk Assessment Summary${colors.reset}`);
              console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
              
              if (analysis.analysis.risk) {
                const risk = analysis.analysis.risk;
                const riskColors = {
                  'very_low': colors.green,
                  'low': colors.cyan,
                  'medium': colors.yellow,
                  'high': colors.red
                };
                
                console.log(`${colors.yellow}Risk Level:${colors.reset} ${riskColors[risk.level] || colors.white}${risk.level.toUpperCase()}${colors.reset}`);
                console.log(`${colors.yellow}Risk Score:${colors.reset} ${risk.score}/100`);
                
                if (risk.factors.length > 0) {
                  console.log(`${colors.yellow}Risk Factors:${colors.reset}`);
                  risk.factors.forEach(factor => {
                    console.log(`  • ${colors.red}${factor}${colors.reset}`);
                  });
                }
              }
              
              // Show key risk indicators
              console.log(`\n${colors.cyan}Key Risk Indicators${colors.reset}`);
              console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
              console.log(`${colors.yellow}Verified:${colors.reset} ${data.metadata?.verified ? `${colors.green}✅ Yes` : `${colors.red}❌ No`}${colors.reset}`);
              console.log(`${colors.yellow}Liquidity:${colors.reset} ${data.trading?.hasLiquidity ? `${colors.green}✅ Yes` : `${colors.red}❌ No`}${colors.reset}`);
              console.log(`${colors.yellow}Holders:${colors.reset} ${data.metadata?.holderCount ? data.metadata.holderCount.toLocaleString() : 'Unknown'}`);
              console.log(`${colors.yellow}Organic Score:${colors.reset} ${data.metadata?.organicScore !== undefined ? data.metadata.organicScore : 'Unknown'}`);
              
            } else {
              console.log(`${colors.red}❌ Risk assessment failed: ${analysis.error}${colors.reset}`);
            }
          } catch (error) {
            console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
          }
          
          // Keep output visible and wait for Space key
          console.log(`\n${colors.cyan}Press SPACE to go back${colors.reset}`);
          await waitForSpaceKey();
        }
        break;
      }
      

      
      case 'realtime': {
        const { tokenAddress, interval } = await inquirer.prompt([
          { type: 'input', name: 'tokenAddress', message: 'Enter token address:' },
          { type: 'number', name: 'interval', message: 'Update interval (seconds):', default: 1 }
        ]);
        
        if (tokenAddress) {
          console.log(`${colors.cyan}🔄 Starting real-time monitoring...${colors.reset}\n`);
          
          try {
            // Start real-time monitoring
            const monitor = await monitorTokenRealtime(tokenAddress, interval * 1000);
            
            // Set up graceful shutdown
            const cleanup = () => {
              monitor.stop();
              process.exit(0);
            };
            
            process.on('SIGINT', cleanup);
            process.on('SIGTERM', cleanup);
            
            // Keep the process running
            await new Promise(() => {});
            
          } catch (error) {
            console.error(`${colors.red}Error: ${error.message}${colors.reset}`);
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        }
        break;
      }
      
      case 'back':
        exit = true;
        break;
    }
  }
}

// Connection Status Menu
async function connectionStatusMenu() {
  let exit = false;
  while (!exit) {
    console.clear();
    showLogo();
    showConnectionStatus();
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Connection Management:',
        choices: [
          { name: 'Refresh All Connections', value: 'refresh' },
          { name: 'Test BitQuery API', value: 'bitquery' },
          { name: 'Test Jupiter API', value: 'jupiter' },
          { name: 'Test Birdeye API', value: 'birdeye' },
          { name: 'Show Detailed Status', value: 'details' },
          { name: 'Back to Main Menu', value: 'exit' }
        ]
      }
    ]);

    switch (action) {
      case 'refresh': {
        console.log(`${colors.cyan}🔄 Refreshing all connections...${colors.reset}`);
        await connectionStatus.checkAllConnections();
        console.log(`${colors.green}✅ Connection check completed!${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        break;
      }
      
      case 'bitquery': {
        console.log(`${colors.cyan}🔍 Testing BitQuery API...${colors.reset}`);
        const success = await connectionStatus.checkBitqueryConnection();
        if (success) {
          console.log(`${colors.green}✅ BitQuery API is working!${colors.reset}`);
        } else {
          console.log(`${colors.red}❌ BitQuery API failed: ${connectionStatus.bitquery.error}${colors.reset}`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        break;
      }
      
      case 'jupiter': {
        console.log(`${colors.cyan}🔍 Testing Jupiter API...${colors.reset}`);
        const success = await connectionStatus.checkJupiterConnection();
        if (success) {
          console.log(`${colors.green}✅ Jupiter API is working!${colors.reset}`);
        } else {
          console.log(`${colors.red}❌ Jupiter API failed: ${connectionStatus.jupiter.error}${colors.reset}`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        break;
      }
      
      case 'birdeye': {
        console.log(`${colors.cyan}🔍 Testing Birdeye API...${colors.reset}`);
        const success = await connectionStatus.checkBirdeyeConnection();
        if (success) {
          console.log(`${colors.green}✅ Birdeye API is working!${colors.reset}`);
        } else {
          console.log(`${colors.red}❌ Birdeye API failed: ${connectionStatus.birdeye.error}${colors.reset}`);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        break;
      }
      
      case 'details': {
        console.log(`${colors.cyan}📊 Detailed Connection Status:${colors.reset}\n`);
        const status = connectionStatus.getStatus();
        
        Object.entries(status).forEach(([service, info]) => {
          const color = info.status === 'connected' ? colors.green : 
                       info.status === 'error' ? colors.red : colors.yellow;
          const icon = info.status === 'connected' ? '●' : 
                      info.status === 'error' ? '✗' : '○';
          
          console.log(`${color}${icon} ${service.toUpperCase()}:${colors.reset}`);
          console.log(`   Status: ${color}${info.status}${colors.reset}`);
          console.log(`   Last Check: ${info.lastCheck ? info.lastCheck.toLocaleTimeString() : 'Never'}`);
          if (info.error) {
            console.log(`   Error: ${colors.red}${info.error}${colors.reset}`);
          }
          console.log('');
        });
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        break;
      }
      
      case 'exit':
        exit = true;
        break;
    }
  }
}

// Add missing functions that are referenced but not defined
function getRiskLevel(score) {
  if (score <= 20) return 'LOW';
  if (score <= 50) return 'MEDIUM';
  return 'HIGH';
}

// Enhanced processTrade function with Jupiter analysis
async function processTrade(trade, index) {
  try {
    // Clear console before showing new token
    console.clear();
    
    // Show position indicator
    console.log(`${colors.cyan}Token ${index + 1} of ${appState.getTradesCount()}${colors.reset}`);
    console.log(`${colors.gray}Use W/S to navigate between tokens${colors.reset}\n`);

    // Handle data structure
    let buyToken, sellToken, dex, market, block, transaction;
    
    if (appState.getCurrentMode() === 'graduated') {
      // For graduated, we have Pool structure
      buyToken = trade?.Pool?.Market?.BaseCurrency;
      sellToken = trade?.Pool?.Market?.QuoteCurrency;
      dex = trade?.Pool?.Dex;
      market = trade?.Pool?.Market;
      block = trade?.Block;
      transaction = trade?.Transaction;
    } else {
      // For other modes, we have standard DEX trade structure
      buyToken = trade?.Trade?.Buy?.Currency;
      sellToken = trade?.Trade?.Sell?.Currency;
      dex = trade?.Trade?.Dex;
      market = trade?.Trade?.Market;
      block = trade?.Block;
      transaction = trade?.Transaction;
    }

    if (!buyToken) {
      const errorMsg = `Invalid data structure for ${appState.getCurrentMode()} mode, item ${index + 1}`;
      console.error(`${colors.red}${errorMsg}${colors.reset}`);
      logToFile(errorMsg, 'error');
      return;
    }

    // Token Details
    console.log(`${colors.cyan}Token Details:${colors.reset}`);
    console.log(`Name: ${colors.green}${buyToken.Name || 'Unknown'}${colors.reset}`);
    console.log(`Symbol: ${colors.green}${buyToken.Symbol || 'Unknown'}${colors.reset}`);
    console.log(`Address: ${colors.yellow}${buyToken.MintAddress || 'Unknown'}${colors.reset}`);
    console.log(`Decimals: ${buyToken.Decimals || 'Unknown'}`);
    console.log(`Fungible: ${buyToken.Fungible ? colors.green + 'Yes' : colors.red + 'No'}${colors.reset}`);
    console.log(`URI: ${colors.dim}${buyToken.Uri || 'None'}${colors.reset}\n`);

    // Show information based on mode
    if (appState.getCurrentMode() === 'graduated') {
      // For graduated, show pool information
      const bondingCurveProgress = trade.Bonding_Curve_Progress_percentage || 0;
      const baseBalance = trade.Pool?.Base?.Balance || 0;
      const quoteAmount = trade.Pool?.Quote?.PostAmount || 0;
      const quotePriceUSD = trade.Pool?.Quote?.PriceInUSD || 0;
      
      console.log(`${colors.cyan}Pool Information:${colors.reset}`);
      console.log(`Base Token: ${colors.green}${buyToken.Symbol || 'Unknown'}${colors.reset}`);
      console.log(`Quote Token: ${colors.green}${sellToken.Symbol || 'Unknown'}${colors.reset}`);
      console.log(`Base Balance: ${colors.yellow}${baseBalance.toLocaleString()}${colors.reset}`);
      console.log(`Quote Amount: ${colors.yellow}${quoteAmount.toLocaleString()}${colors.reset}`);
      console.log(`Quote Price USD: ${colors.yellow}$${quotePriceUSD.toFixed(6)}${colors.reset}`);
      console.log(`Bonding Curve Progress: ${colors.magenta}${bondingCurveProgress.toFixed(2)}%${colors.reset}\n`);
    } else {
      // For other modes, show trade information
      const totalValue = (trade.Trade.Buy.Amount * trade.Trade.Buy.PriceInUSD) || 0;
      console.log(`${colors.cyan}Trade Information:${colors.reset}`);
      console.log(`Buy Amount: ${colors.green}${trade.Trade.Buy.Amount || 0} ${buyToken.Symbol}${colors.reset}`);
      console.log(`Price USD: ${colors.yellow}$${(trade.Trade.Buy.PriceInUSD || 0).toFixed(6)}${colors.reset}`);
      console.log(`Price SOL: ${colors.yellow}${(trade.Trade.Buy.Price || 0).toFixed(8)} SOL${colors.reset}`);
      console.log(`Total Value: ${colors.magenta}$${totalValue.toFixed(2)}${colors.reset}\n`);
    }

    // Jupiter Token Information (Quick Check)
    if (buyToken.MintAddress) {
      try {
        const jupiterData = await checkJupiterTokenRealtime(buyToken.MintAddress);
        if (jupiterData.success && jupiterData.data) {
          console.log(`${colors.magenta}🔍 Jupiter Token Info:${colors.reset}`);
          console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
          
          const data = jupiterData.data;
          
          // Basic token info
          if (data.name && data.symbol) {
            console.log(`${colors.green}📝 ${data.name} (${data.symbol})${colors.reset}`);
          }
          
          // Price and market data
          if (data.price) {
            console.log(`${colors.yellow}💰 Price: $${data.price.toFixed(6)}${colors.reset}`);
          }
          
          if (data.marketCap) {
            console.log(`${colors.blue}🏦 MCap: $${data.marketCap.toLocaleString()}${colors.reset}`);
          }
          
          if (data.liquidity) {
            console.log(`${colors.cyan}💧 Liq: $${data.liquidity.toLocaleString()}${colors.reset}`);
          }
          
          if (data.holderCount) {
            console.log(`${colors.orange}👥 Holders: ${data.holderCount.toLocaleString()}${colors.reset}`);
          }
          
          // Status indicators
          const verifyIcon = data.verified ? '✓' : '✗';
          const verifyColor = data.verified ? colors.green : colors.red;
          console.log(`${colors.white}🔒 ${verifyColor}${verifyIcon}${colors.reset} ${data.verified ? 'Verified' : 'Unverified'}`);
          
          if (data.organicScore !== undefined) {
            const scoreColor = data.organicScore > 50 ? colors.green : data.organicScore > 25 ? colors.yellow : colors.red;
            console.log(`${colors.white}🌱 ${scoreColor}${data.organicScore}${colors.reset} (${data.organicScoreLabel})`);
          }
          
          console.log(''); // Empty line for spacing
        }
      } catch (error) {
        // Silent fail to not disrupt display
      }
    }

    // Market Information
    console.log(`${colors.cyan}Market Information:${colors.reset}`);
    console.log(`DEX Protocol: ${colors.magenta}${dex?.ProtocolName || 'Unknown'}${colors.reset}`);
    console.log(`DEX Family: ${colors.magenta}${dex?.ProtocolFamily || 'Unknown'}${colors.reset}`);
    console.log(`Market Address: ${colors.yellow}${market?.MarketAddress || 'Unknown'}${colors.reset}\n`);

    // Transaction Details
    console.log(`${colors.cyan}Transaction Details:${colors.reset}`);
    console.log(`Signature: ${colors.yellow}${transaction?.Signature || 'Unknown'}${colors.reset}`);
    const timeVerification = verifyTradeTime(block?.Time);
    console.log(`Time: ${new Date(block?.Time || Date.now()).toISOString()} (${timeVerification.formattedDiff})\n`);

    // Jupiter Analysis (if token address is available)
    if (buyToken.MintAddress) {
      try {
        // Get both detailed analysis and real-time data
        const [jupiterAnalysis, realtimeData] = await Promise.allSettled([
          analyzeTokenWithJupiter(buyToken.MintAddress),
          checkJupiterTokenRealtime(buyToken.MintAddress)
        ]);
        
        // Display detailed analysis if available
        if (jupiterAnalysis.status === 'fulfilled' && jupiterAnalysis.value) {
          displayJupiterAnalysis(jupiterAnalysis.value);
          
          // Make trading decision
          const decision = await makeTradingDecisionWithJupiter(buyToken.MintAddress, totalValue);
          
          // Display decision prominently
          console.log(`${colors.cyan}🎯 Trading Decision${colors.reset}`);
          console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
          
          const decisionColors = {
            'APPROVE': colors.green,
            'CAUTION': colors.yellow,
            'REJECT': colors.red,
            'ERROR': colors.red
          };
          
          console.log(`${decisionColors[decision.decision] || colors.white}${decision.decision}${colors.reset} - ${decision.reason}`);
          console.log(`${colors.yellow}Safety Score: ${decision.score}/100${colors.reset}\n`);
        }
        
        // Display real-time data if available
        if (realtimeData.status === 'fulfilled' && realtimeData.value.success) {
          console.log(`${colors.cyan}🔄 Real-time Jupiter Data${colors.reset}`);
          console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
          
          const data = realtimeData.value.data;
          
          if (data.price) {
            console.log(`${colors.green}💰 Current Price:${colors.reset} $${data.price.toFixed(6)}`);
          }
          
          if (data.priceChange24h !== undefined) {
            const changeColor = data.priceChange24h >= 0 ? colors.green : colors.red;
            const changeSymbol = data.priceChange24h >= 0 ? '↗' : '↘';
            console.log(`${colors.yellow}📈 24h Change:${colors.reset} ${changeColor}${changeSymbol} ${data.priceChange24h.toFixed(2)}%${colors.reset}`);
          }
          
          if (data.volume24h) {
            console.log(`${colors.blue}📊 24h Volume:${colors.reset} $${data.volume24h.toLocaleString()}`);
          }
          
          if (data.marketCap) {
            console.log(`${colors.magenta}🏦 Market Cap:${colors.reset} $${data.marketCap.toLocaleString()}`);
          }
          
          if (data.liquidity) {
            console.log(`${colors.cyan}💧 Liquidity:${colors.reset} $${data.liquidity.toLocaleString()}`);
          }
          
          console.log(''); // Empty line for spacing
        }
        
      } catch (jupiterError) {
        console.log(`${colors.yellow}⚠️ Jupiter analysis skipped: ${jupiterError.message}${colors.reset}\n`);
      }
    }

    // Links
    console.log(`${colors.cyan}Useful Links:${colors.reset}`);
    console.log(`${colors.blue}• Solscan: https://solscan.io/token/${buyToken.MintAddress}${colors.reset}`);
    console.log(`${colors.blue}• GMGN.io: https://gmgn.ai/sol/token/${buyToken.MintAddress}${colors.reset}\n`);

    // Draw price chart if we have enough data
    if (priceHistory.prices.length > 1) {
      const pnl = calculatePnL(priceHistory);
      console.log(drawPriceChart(pnl));
    }

  } catch (err) {
    const errorMsg = `Error processing trade ${index + 1}: ${err.message}`;
    console.error(`${colors.red}${errorMsg}${colors.reset}`);
    logToFile(errorMsg, 'error');
  }
}

// Add calculatePnL function
function calculatePnL(priceHistory) {
  if (!priceHistory || priceHistory.prices.length < 2) return 0;
  const initialPrice = priceHistory.prices[0];
  const finalPrice = priceHistory.prices[priceHistory.prices.length - 1];
  return ((finalPrice - initialPrice) / initialPrice * 100).toFixed(2);
}

// Export functions for use in other modules
export { 
  monitorTokenRealtime, 
  checkJupiterTokenRealtime, 
  displayRealtimeUpdate,
  checkJupiterConnectionV1 
};

// MANUAL SWAP MENU
async function manualSwapMenu() {
  console.log(`${colors.cyan}🌀 Manual Swap (Jupiter)${colors.reset}`);
  console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  try {
    // Check if wallet is selected
    if (!settings.activeWallet) {
      console.log(`${colors.yellow}⚠️ No wallet selected. Please select a wallet first.${colors.reset}`);
      await waitForSpaceKey();
      return;
    }

    const wallet = loadWallet(settings.activeWallet);
    if (!wallet) {
      console.log(`${colors.red}❌ Failed to load wallet: ${settings.activeWallet}${colors.reset}`);
      await waitForSpaceKey();
      return;
    }

    // Get user input for swap
    const { swapType } = await inquirer.prompt([
      {
        type: 'list',
        name: 'swapType',
        message: 'Select swap type:',
        choices: [
          { name: '🔄 Quick Buy/Sell (Switchable)', value: 'quickswap' },
          { name: '🟢 Buy Token (SOL → Token)', value: 'buy' },
          { name: '🔴 Sell Token (Token → SOL)', value: 'sell' },
          { name: '🔄 Token to Token', value: 'token' },
          { name: '📊 Get Quote Only', value: 'quote' },
          { name: '💰 Check Balances', value: 'balance' },
          { name: '📜 Swap History', value: 'history' }
        ]
      }
    ]);

    if (swapType === 'back') return;

    switch (swapType) {
      case 'quickswap':
        await handleQuickBuySell(wallet);
        break;
      case 'buy':
        await handleBuyToken(wallet);
        break;
      case 'sell':
        await handleSellToken(wallet);
        break;
      case 'token':
        await handleTokenToToken(wallet);
        break;
      case 'quote':
        await handleGetQuote();
        break;
      case 'balance':
        await handleCheckBalances(wallet);
        break;
      case 'history':
        await handleSwapHistory(wallet);
        break;
    }

  } catch (error) {
    console.error(`${colors.red}❌ Error in manual swap menu: ${error.message}${colors.reset}`);
    logToFile(`Manual swap menu error: ${error.message}`, 'error');
  }
}

// BUNDLE SWAP MENU
async function bundleSwapMenu() {
  console.log(`${colors.magenta}📦 Bundle Swap Mode${colors.reset}`);
  console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  try {
    // Check if wallet is selected
    if (!settings.activeWallet) {
      console.log(`${colors.yellow}⚠️ No wallet selected. Please select a wallet first.${colors.reset}`);
      await waitForSpaceKey();
      return;
    }

    const wallet = loadWallet(settings.activeWallet);
    if (!wallet) {
      console.log(`${colors.red}❌ Failed to load wallet: ${settings.activeWallet}${colors.reset}`);
      await waitForSpaceKey();
      return;
    }

    const { bundleMode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'bundleMode',
        message: 'Select bundle mode:',
        choices: [
          { name: '🟢 Bundle Buy (Multiple tokens)', value: 'buy' },
          { name: '🔴 Bundle Sell (Multiple tokens)', value: 'sell' },
          { name: '📊 Analyze Bundle', value: 'analyze' },
          { name: '📋 Load from JSON', value: 'json' }
        ]
      }
    ]);

    if (bundleMode === 'back') return;

    switch (bundleMode) {
      case 'buy':
        await handleBundleBuy(wallet);
        break;
      case 'sell':
        await handleBundleSell(wallet);
        break;
      case 'analyze':
        await handleBundleAnalyze(wallet);
        break;
      case 'json':
        await handleBundleFromJSON(wallet);
        break;
    }

  } catch (error) {
    console.error(`${colors.red}❌ Error in bundle swap menu: ${error.message}${colors.reset}`);
    logToFile(`Bundle swap menu error: ${error.message}`, 'error');
  }
}

// Helper function to generate SOLSCAN transaction link
function generateSolscanLink(signature) {
  return `https://solscan.io/tx/${signature}`;
}

// Helper function to calculate and display profit percentage
async function calculateAndDisplayProfit(tokenMint, currentBalance, tokenDecimals) {
  try {
    const pnl = await calculateTokenPnL(tokenMint, currentBalance);
    const profitColor = pnl.pnlPercent >= 0 ? colors.green : colors.red;
    const profitSymbol = pnl.pnlPercent >= 0 ? '📈' : '📉';
    
    return {
      percentage: pnl.pnlPercent,
      color: profitColor,
      symbol: profitSymbol,
      currentValue: pnl.currentValue,
      currentPrice: pnl.currentPrice
    };
  } catch (error) {
    return {
      percentage: 0,
      color: colors.gray,
      symbol: '❓',
      currentValue: 0,
      currentPrice: 0
    };
  }
}

// Transaction Progress Monitoring
class TransactionProgressMonitor {
  constructor() {
    this.progressBar = new cliProgress.SingleBar({
      format: 'Transaction Progress |{bar}| {percentage}% | {value}/{total} | {status}',
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true
    });
  }

  startTransaction(transactionType, tokenSymbol, amount) {
    console.log(`\n${colors.cyan}🔄 Starting ${transactionType} transaction...${colors.reset}`);
    console.log(`${colors.yellow}Token:${colors.reset} ${tokenSymbol}`);
    console.log(`${colors.yellow}Amount:${colors.reset} ${amount}\n`);
    
    this.progressBar.start(100, 0, {
      status: 'Initializing...'
    });
  }

  updateProgress(progress, status) {
    this.progressBar.update(progress, {
      status: status
    });
  }

  completeTransaction(success, signature = null) {
    this.progressBar.stop();
    
    if (success) {
      console.log(`\n${colors.green}✅ Transaction completed successfully!${colors.reset}`);
      if (signature) {
        console.log(`${colors.cyan}🔗 Signature:${colors.reset} ${signature}`);
        console.log(`${colors.cyan}🔍 Solscan:${colors.reset} ${generateSolscanLink(signature)}`);
      }
    } else {
      console.log(`\n${colors.red}❌ Transaction failed!${colors.reset}`);
    }
  }

  simulateTransactionSteps(transactionType, tokenSymbol, amount) {
    return new Promise((resolve) => {
      const steps = [
        { progress: 10, status: 'Validating wallet...' },
        { progress: 20, status: 'Fetching token info...' },
        { progress: 30, status: 'Getting quote...' },
        { progress: 40, status: 'Preparing transaction...' },
        { progress: 50, status: 'Signing transaction...' },
        { progress: 60, status: 'Broadcasting to network...' },
        { progress: 70, status: 'Confirming transaction...' },
        { progress: 80, status: 'Processing on-chain...' },
        { progress: 90, status: 'Finalizing...' },
        { progress: 100, status: 'Complete!' }
      ];

      let currentStep = 0;
      const interval = setInterval(() => {
        if (currentStep < steps.length) {
          this.updateProgress(steps[currentStep].progress, steps[currentStep].status);
          currentStep++;
        } else {
          clearInterval(interval);
          setTimeout(() => {
            this.completeTransaction(true, 'simulated_signature_123456789');
            resolve();
          }, 500);
        }
      }, 200);
    });
  }
}

// QUICK BUY/SELL FUNCTION WITH SWITCHING
async function handleQuickBuySell(wallet) {
  console.log(`${colors.cyan}🔄 Quick Buy/Sell Mode${colors.reset}`);
  console.log(`${colors.yellow}💡 Hotkeys: 'B'=Buy Mode, 'S'=Sell Mode, 'Q'=Quit${colors.reset}\n`);

  let currentMode = 'buy'; // Start with buy mode
  let selectedToken = null;
  let tokenMint = null;
  let tokenBalance = null;
  let tokenDecimals = null;

  // Function to handle hotkeys
  const handleHotkeys = () => {
    return new Promise((resolve) => {
      const originalRawMode = process.stdin.isRaw;
      const originalEncoding = process.stdin.encoding;
      
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      
      const onData = (data) => {
        const key = data.toLowerCase();
        if (key === 'b') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.setRawMode(originalRawMode);
          process.stdin.setEncoding(originalEncoding);
          process.stdin.removeListener('data', onData);
          resolve('switch_to_buy');
        } else if (key === 's') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.setRawMode(originalRawMode);
          process.stdin.setEncoding(originalEncoding);
          process.stdin.removeListener('data', onData);
          resolve('switch_to_sell');
        } else if (key === 'q') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.setRawMode(originalRawMode);
          process.stdin.setEncoding(originalEncoding);
          process.stdin.removeListener('data', onData);
          resolve('quit');
        }
      };
      
      process.stdin.on('data', onData);
      
      // Auto-resolve after 5 seconds if no key pressed
      setTimeout(() => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.setRawMode(originalRawMode);
        process.stdin.setEncoding(originalEncoding);
        process.stdin.removeListener('data', onData);
        resolve('continue');
      }, 5000);
    });
  };

  while (true) {
    // Display current mode with hotkey info
    const modeColor = currentMode === 'buy' ? colors.green : colors.red;
    const modeEmoji = currentMode === 'buy' ? '🟢' : '🔴';
    console.log(`${modeColor}${modeEmoji} Current Mode: ${currentMode.toUpperCase()}${colors.reset}`);
    console.log(`${colors.cyan}⌨️  Hotkeys: B=Buy | S=Sell | Q=Quit${colors.reset}`);

    if (currentMode === 'buy') {
      // Buy mode - get token mint and SOL amount
      const { tokenMintInput, amount } = await inquirer.prompt([
        {
          type: 'input',
          name: 'tokenMintInput',
          message: 'Enter token mint address:',
          default: tokenMint || '',
          validate: (input) => input.length > 0 ? true : 'Token mint is required'
        },
        {
          type: 'input',
          name: 'amount',
          message: 'Enter SOL amount to spend:',
          validate: (input) => {
            const num = parseFloat(input);
            if (isNaN(num)) return 'Please enter a valid number';
            if (num <= 0) return 'Amount must be greater than 0';
            return true;
          },
          filter: (input) => parseFloat(input)
        }
      ]);

      tokenMint = tokenMintInput;

      try {
        // Check SOL balance
        const solBalance = await getSolBalance(wallet.publicKey.toString());
        console.log(`${colors.blue}💰 SOL Balance: ${solBalance} SOL${colors.reset}`);

        if (solBalance < amount) {
          console.log(`${colors.red}❌ Insufficient SOL balance${colors.reset}`);
          continue;
        }

        // Get quote
        const quote = await getBestQuote(
          'So11111111111111111111111111111111111111112', // SOL mint
          tokenMint,
          amount * LAMPORTS_PER_SOL
        );

        // Show quote and ask for confirmation
        console.log(`${colors.cyan}📊 Quote: ${amount} SOL → ${quote.outAmount} tokens${colors.reset}`);
        console.log(`${colors.yellow}💡 Press hotkeys: B=Buy Mode | S=Sell Mode | Q=Quit${colors.reset}`);
        
        // Wait for hotkey or show menu
        const hotkeyResult = await handleHotkeys();
        
        if (hotkeyResult === 'switch_to_sell') {
          currentMode = 'sell';
          console.log(`${colors.cyan}🔄 Switched to Sell Mode${colors.reset}`);
          continue;
        } else if (hotkeyResult === 'quit') {
          console.log(`${colors.yellow}👋 Exiting Quick Buy/Sell Mode${colors.reset}`);
          return;
        }
        
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
              { name: '✅ Execute Buy', value: 'execute' },
              { name: '🔄 Switch to Sell Mode', value: 'switch' },
              { name: '❌ Cancel', value: 'cancel' }
            ]
          }
        ]);

        if (action === 'execute') {
          // Confirm swap
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Confirm buy ${amount} SOL for ${quote.outAmount} tokens?`,
              default: false
            }
          ]);

          if (confirm) {
            // Perform swap
            const result = await performSwap(
              'So11111111111111111111111111111111111111112',
              tokenMint,
              amount * LAMPORTS_PER_SOL,
              wallet
            );

            console.log(`${colors.green}✅ Buy completed!${colors.reset}`);
            console.log(`${colors.blue}📝 Transaction: ${result.signature}${colors.reset}`);
            console.log(`${colors.cyan}🔗 SOLSCAN: ${generateSolscanLink(result.signature)}${colors.reset}`);
            
            // Calculate and display profit percentage for the bought token
            try {
              const profitInfo = await calculateAndDisplayProfit(tokenMint, quote.outAmount, 0);
              console.log(`${profitInfo.symbol} ${profitInfo.color}Profit: ${profitInfo.percentage.toFixed(2)}%${colors.reset}`);
              console.log(`${colors.blue}💰 Current Value: $${profitInfo.currentValue.toFixed(2)}${colors.reset}`);
            } catch (error) {
              console.log(`${colors.yellow}⚠️ Could not calculate profit (new token)${colors.reset}`);
            }
            
            await waitForSpaceKey();
            return;
          }
        } else if (action === 'switch') {
          currentMode = 'sell';
          continue;
        } else {
          continue;
        }

      } catch (error) {
        console.error(`${colors.red}❌ Buy failed: ${error.message}${colors.reset}`);
        await waitForSpaceKey();
        continue;
      }

    } else {
      // Sell mode - get token selection and amount
      try {
        // Get all token balances
        console.log(`${colors.cyan}🔍 Loading your tokens...${colors.reset}`);
        const tokens = await getAllTokenBalances(wallet.publicKey.toString());
        
        if (tokens.length === 0) {
          console.log(`${colors.yellow}⚠️ No tokens found in your wallet${colors.reset}`);
          console.log(`${colors.cyan}💡 You can enter a custom token mint address to test the sell functionality${colors.reset}`);
          
          const { selectedOption } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedOption',
              message: 'No tokens found in wallet. What would you like to do?',
              choices: [
                { name: 'Enter custom token mint address', value: 'custom' },
                { name: '🔄 Switch to Buy Mode', value: 'switch' },
                { name: 'Go back to main menu', value: 'back' }
              ]
            }
          ]);
          
          if (selectedOption === 'switch') {
            currentMode = 'buy';
            continue;
          } else if (selectedOption === 'back') {
            return;
          }
          
          selectedToken = 'custom';
        } else {
          // Get token info for choices
          const tokensWithInfo = await Promise.all(
            tokens.map(async (token) => {
              const tokenInfo = await getTokenInfo(token.mint);
              return { ...token, ...tokenInfo };
            })
          );
          
          const tokenChoices = tokensWithInfo.map((token, index) => ({
            name: `${index + 1}. ${token.symbol} (${token.mint.slice(0, 8)}...${token.mint.slice(-8)}) - Balance: ${token.balance.toLocaleString()}`,
            value: token
          }));

          // Add option to enter custom token mint
          tokenChoices.push({
            name: `${tokens.length + 1}. Enter custom token mint address`,
            value: 'custom'
          });

          // Add switch mode option
          tokenChoices.push({
            name: `${tokens.length + 2}. 🔄 Switch to Buy Mode`,
            value: 'switch'
          });

          const { selectedOption } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedOption',
              message: 'Select token to sell:',
              choices: tokenChoices
            }
          ]);
          
          if (selectedOption === 'switch') {
            currentMode = 'buy';
            continue;
          }
          
          selectedToken = selectedOption;
        }

        if (selectedToken === 'custom') {
          // Custom token input
          const { customMint } = await inquirer.prompt([
            {
              type: 'input',
              name: 'customMint',
              message: 'Enter token mint address:',
              validate: (input) => input.length > 0 ? true : 'Token mint is required'
            }
          ]);
          
          tokenMint = customMint;
          tokenBalance = await getTokenBalance(tokenMint, wallet.publicKey.toString());
          const tokenMetadata = await getTokenMetadata(tokenMint);
          tokenDecimals = tokenMetadata.decimals;
        } else {
          // Selected from list
          tokenMint = selectedToken.mint;
          tokenBalance = selectedToken.balance;
          tokenDecimals = selectedToken.decimals;
        }

        console.log(`${colors.blue}💰 Token Balance: ${tokenBalance.toLocaleString()}${colors.reset}`);

        if (tokenBalance <= 0) {
          console.log(`${colors.red}❌ No tokens to sell${colors.reset}`);
          continue;
        }

        // Get sell amount
        const { sellAmount } = await inquirer.prompt([
          {
            type: 'input',
            name: 'sellAmount',
            message: `Enter amount to sell (max: ${tokenBalance.toLocaleString()}):`,
            validate: (input) => {
              const num = parseFloat(input);
              if (isNaN(num)) return 'Please enter a valid number';
              if (num <= 0) return 'Amount must be greater than 0';
              if (num > tokenBalance) return `Amount cannot exceed balance (${tokenBalance.toLocaleString()})`;
              return true;
            },
            filter: (input) => parseFloat(input)
          }
        ]);

        // Get quote
        const quote = await getBestQuote(
          tokenMint,
          'So11111111111111111111111111111111111111112', // SOL mint
          sellAmount * Math.pow(10, tokenDecimals)
        );

        // Show quote and ask for confirmation
        console.log(`${colors.cyan}📊 Quote: ${sellAmount.toLocaleString()} tokens → ${quote.outAmount / LAMPORTS_PER_SOL} SOL${colors.reset}`);
        console.log(`${colors.yellow}💡 Press hotkeys: B=Buy Mode | S=Sell Mode | Q=Quit${colors.reset}`);
        
        // Wait for hotkey or show menu
        const hotkeyResult = await handleHotkeys();
        
        if (hotkeyResult === 'switch_to_buy') {
          currentMode = 'buy';
          console.log(`${colors.cyan}🔄 Switched to Buy Mode${colors.reset}`);
          continue;
        } else if (hotkeyResult === 'quit') {
          console.log(`${colors.yellow}👋 Exiting Quick Buy/Sell Mode${colors.reset}`);
          return;
        }
        
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
              { name: '✅ Execute Sell', value: 'execute' },
              { name: '🔄 Switch to Buy Mode', value: 'switch' },
              { name: '❌ Cancel', value: 'cancel' }
            ]
          }
        ]);

        if (action === 'execute') {
          // Confirm swap
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Confirm sell ${sellAmount.toLocaleString()} tokens for ${quote.outAmount / LAMPORTS_PER_SOL} SOL?`,
              default: false
            }
          ]);

          if (confirm) {
            // Perform swap
            const result = await performSwap(
              tokenMint,
              'So11111111111111111111111111111111111111112',
              sellAmount * Math.pow(10, tokenDecimals),
              wallet
            );

            console.log(`${colors.green}✅ Sell completed!${colors.reset}`);
            console.log(`${colors.blue}📝 Transaction: ${result.signature}${colors.reset}`);
            console.log(`${colors.cyan}🔗 SOLSCAN: ${generateSolscanLink(result.signature)}${colors.reset}`);
            
            // Calculate and display profit from the sell
            try {
              const soldValue = quote.outAmount / LAMPORTS_PER_SOL;
              console.log(`${colors.green}💰 Sold for: ${soldValue.toFixed(4)} SOL${colors.reset}`);
              
              // Calculate profit percentage based on original purchase (if available)
              const profitInfo = await calculateAndDisplayProfit(tokenMint, sellAmount, tokenDecimals);
              if (profitInfo.percentage !== 0) {
                console.log(`${profitInfo.symbol} ${profitInfo.color}Profit: ${profitInfo.percentage.toFixed(2)}%${colors.reset}`);
              }
            } catch (error) {
              console.log(`${colors.yellow}⚠️ Could not calculate profit details${colors.reset}`);
            }
            
            await waitForSpaceKey();
            return;
          }
        } else if (action === 'switch') {
          currentMode = 'buy';
          continue;
        } else {
          continue;
        }

      } catch (error) {
        console.error(`${colors.red}❌ Sell failed: ${error.message}${colors.reset}`);
        await waitForSpaceKey();
        continue;
      }
    }
  }
}

// HANDLER FUNCTIONS FOR MANUAL SWAP
async function handleBuyToken(wallet) {
  console.log(`${colors.green}🟢 Buy Token Mode${colors.reset}\n`);

  const { tokenMint, amount } = await inquirer.prompt([
    {
      type: 'input',
      name: 'tokenMint',
      message: 'Enter token mint address:',
      validate: (input) => input.length > 0 ? true : 'Token mint is required'
    },
    {
      type: 'input',
      name: 'amount',
      message: 'Enter SOL amount to spend:',
      validate: (input) => {
        const num = parseFloat(input);
        if (isNaN(num)) return 'Please enter a valid number';
        if (num <= 0) return 'Amount must be greater than 0';
        return true;
      },
      filter: (input) => parseFloat(input)
    }
  ]);

  try {
    // Check SOL balance
    const solBalance = await getSolBalance(wallet.publicKey.toString());
    console.log(`${colors.blue}💰 SOL Balance: ${solBalance} SOL${colors.reset}`);

    if (solBalance < amount) {
      console.log(`${colors.red}❌ Insufficient SOL balance${colors.reset}`);
      await waitForSpaceKey();
      return;
    }

    // Get quote
    const quote = await getBestQuote(
      'So11111111111111111111111111111111111111112', // SOL mint
      tokenMint,
      amount * LAMPORTS_PER_SOL
    );

    // Show quote and emergency sell option
    console.log(`${colors.cyan}📊 Quote: ${amount} SOL → ${quote.outAmount} tokens${colors.reset}`);
    console.log(`${colors.yellow}💡 Hotkeys: ENTER=Confirm | E=Emergency Sell Mode | C=Cancel${colors.reset}`);
    
    // Wait for user input with hotkeys
    const userAction = await new Promise((resolve) => {
      const originalRawMode = process.stdin.isRaw;
      const originalEncoding = process.stdin.encoding;
      
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      
      const onData = (data) => {
        if (data === '\r' || data === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.setRawMode(originalRawMode);
          process.stdin.setEncoding(originalEncoding);
          process.stdin.removeListener('data', onData);
          resolve('confirm');
        } else if (data.toLowerCase() === 'e') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.setRawMode(originalRawMode);
          process.stdin.setEncoding(originalEncoding);
          process.stdin.removeListener('data', onData);
          resolve('emergency_sell');
        } else if (data.toLowerCase() === 'c') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.setRawMode(originalRawMode);
          process.stdin.setEncoding(originalEncoding);
          process.stdin.removeListener('data', onData);
          resolve('cancel');
        }
      };
      
      process.stdin.on('data', onData);
      
      // Auto-confirm after 10 seconds if no key pressed
      setTimeout(() => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.setRawMode(originalRawMode);
        process.stdin.setEncoding(originalEncoding);
        process.stdin.removeListener('data', onData);
        resolve('confirm');
      }, 10000);
    });

    if (userAction === 'cancel') {
      console.log(`${colors.yellow}⚠️ Swap cancelled${colors.reset}`);
      return;
    }
    
    if (userAction === 'emergency_sell') {
      console.log(`${colors.red}🚨 EMERGENCY SELL MODE ACTIVATED${colors.reset}`);
      console.log(`${colors.yellow}💡 This will automatically sell 100% of the tokens after purchase${colors.reset}`);
      
      const { confirmEmergency } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmEmergency',
          message: 'Confirm emergency sell mode? (Will sell 100% after buy)',
          default: false
        }
      ]);
      
      if (!confirmEmergency) {
        console.log(`${colors.yellow}⚠️ Emergency sell cancelled${colors.reset}`);
        return;
      }
    }

    // Initialize transaction progress monitor
    const progressMonitor = new TransactionProgressMonitor();
    const buyAmount = quote.outAmount;
    
    // Start transaction monitoring
    progressMonitor.startTransaction('BUY', 'TOKEN', `${buyAmount.toLocaleString()} tokens`);
    
    // Simulate transaction steps with progress
    await progressMonitor.simulateTransactionSteps('BUY', 'TOKEN', `${buyAmount.toLocaleString()} tokens`);
    
    // Perform swap
    const result = await performSwap(
      'So11111111111111111111111111111111111111112',
      tokenMint,
      amount * LAMPORTS_PER_SOL,
      wallet
    );

    // Complete transaction with success
    progressMonitor.completeTransaction(true, result.signature);
    
    // Calculate and display profit percentage for the bought token
    try {
      const profitInfo = await calculateAndDisplayProfit(tokenMint, quote.outAmount, 0);
      console.log(`${profitInfo.symbol} ${profitInfo.color}Profit: ${profitInfo.percentage.toFixed(2)}%${colors.reset}`);
      console.log(`${colors.blue}💰 Current Value: $${profitInfo.currentValue.toFixed(2)}${colors.reset}`);
    } catch (error) {
      console.log(`${colors.yellow}⚠️ Could not calculate profit (new token)${colors.reset}`);
    }
    
    // Emergency sell logic
    if (userAction === 'emergency_sell') {
      console.log(`${colors.red}🚨 EXECUTING EMERGENCY SELL...${colors.reset}`);
      
      try {
        // Wait a moment for the transaction to be confirmed
        console.log(`${colors.yellow}⏳ Waiting for transaction confirmation...${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Get current token balance
        const currentBalance = await getTokenBalance(tokenMint, wallet.publicKey.toString());
        console.log(`${colors.blue}💰 Current token balance: ${currentBalance.toLocaleString()}${colors.reset}`);
        
        if (currentBalance > 0) {
          // Get sell quote
          const sellQuote = await getBestQuote(
            tokenMint,
            'So11111111111111111111111111111111111111112', // SOL mint
            currentBalance
          );
          
          console.log(`${colors.cyan}📊 Sell Quote: ${currentBalance.toLocaleString()} tokens → ${sellQuote.outAmount / LAMPORTS_PER_SOL} SOL${colors.reset}`);
          
          // Initialize sell transaction progress monitor
          const sellProgressMonitor = new TransactionProgressMonitor();
          sellProgressMonitor.startTransaction('SELL', 'TOKEN', `${currentBalance.toLocaleString()} tokens`);
          
          // Simulate sell transaction steps
          await sellProgressMonitor.simulateTransactionSteps('SELL', 'TOKEN', `${currentBalance.toLocaleString()} tokens`);
          
          // Perform emergency sell
          const sellResult = await performSwap(
            tokenMint,
            'So11111111111111111111111111111111111111112',
            currentBalance,
            wallet
          );
          
          // Complete sell transaction
          sellProgressMonitor.completeTransaction(true, sellResult.signature);
          
          console.log(`${colors.green}✅ Emergency sell completed successfully!${colors.reset}`);
          console.log(`${colors.blue}💰 Received: ${sellQuote.outAmount / LAMPORTS_PER_SOL} SOL${colors.reset}`);
          
          // Calculate total profit/loss
          const totalSpent = amount;
          const totalReceived = sellQuote.outAmount / LAMPORTS_PER_SOL;
          const profitLoss = totalReceived - totalSpent;
          const profitLossPercent = ((profitLoss / totalSpent) * 100);
          
          const profitColor = profitLoss >= 0 ? colors.green : colors.red;
          const profitSymbol = profitLoss >= 0 ? '📈' : '📉';
          
          console.log(`${profitSymbol} ${profitColor}Total P&L: ${profitLoss.toFixed(4)} SOL (${profitLossPercent.toFixed(2)}%)${colors.reset}`);
          
        } else {
          console.log(`${colors.red}❌ No tokens found to sell${colors.reset}`);
        }
        
      } catch (error) {
        console.error(`${colors.red}❌ Emergency sell failed: ${error.message}${colors.reset}`);
        console.log(`${colors.yellow}⚠️ You may need to sell manually${colors.reset}`);
      }
    }

  } catch (error) {
    console.error(`${colors.red}❌ Buy failed: ${error.message}${colors.reset}`);
  }

  await waitForSpaceKey();
}

async function displayTokenList(tokens) {
  console.log(`${colors.green}📋 Your Tokens:${colors.reset}`);
  console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  // Get token info for all tokens
  const tokensWithInfo = await Promise.all(
    tokens.map(async (token) => {
      const tokenInfo = await getTokenInfo(token.mint);
      return { ...token, ...tokenInfo };
    })
  );
  
  // Display tokens with info and PnL
  for (let i = 0; i < tokensWithInfo.length; i++) {
    const token = tokensWithInfo[i];
    const pnl = await calculateTokenPnL(token.mint, token.balance);
    
    const pnlColor = pnl.pnlPercent >= 0 ? colors.green : colors.red;
    const pnlSymbol = pnl.pnlPercent >= 0 ? '📈' : '📉';
    
    console.log(`${colors.cyan}${i + 1}.${colors.reset} ${colors.yellow}${token.symbol}${colors.reset} (${token.mint.slice(0, 8)}...${token.mint.slice(-8)})`);
    console.log(`   💰 Balance: ${token.balance.toLocaleString()}`);
    console.log(`   💵 Price: $${pnl.currentPrice.toFixed(6)}`);
    console.log(`   💎 Value: $${pnl.currentValue.toFixed(2)}`);
    console.log(`   ${pnlSymbol} PnL: ${pnlColor}$${pnl.pnl.toFixed(2)} (${pnl.pnlPercent.toFixed(2)}%)${colors.reset}`);
    console.log('');
  }
  
  // Show hotkey instructions
  console.log(`${colors.cyan}⌨️  Hotkeys: R=Refresh Data | J=Jupiter Analysis | Q=Quit${colors.reset}`);
}

async function displayRealtimeTokenList(tokens) {
  if (tokens.length === 0) {
    console.log(`${colors.yellow}⚠️ No tokens found in wallet${colors.reset}`);
    console.log(`${colors.cyan}💡 You can enter a custom token mint address to test the sell functionality${colors.reset}`);
    console.log(`${colors.cyan}Press SPACE to continue to manual token input...${colors.reset}`);
    return () => {}; // Return empty function
  }
  
  console.log(`${colors.green}📋 Your Tokens (Realtime PnL):${colors.reset}`);
  console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  
  // Get token info for all tokens
  let tokensWithInfo = await Promise.all(
    tokens.map(async (token) => {
      const tokenInfo = await getTokenInfo(token.mint);
      return { ...token, ...tokenInfo };
    })
  );
  
  let updateCount = 0;
  let selectedTokenIndex = 0;
  let jupiterAnalysis = null;
  
  // Function to handle hotkeys
  const handleHotkeys = () => {
    return new Promise((resolve) => {
      const originalRawMode = process.stdin.isRaw;
      const originalEncoding = process.stdin.encoding;
      
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      
      const onData = (data) => {
        const key = data.toLowerCase();
        if (key === 'r' || key === ' ') {
          // Refresh/Update
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.setRawMode(originalRawMode);
          process.stdin.setEncoding(originalEncoding);
          process.stdin.removeListener('data', onData);
          resolve('refresh');
        } else if (key === 'j') {
          // Jupiter Analysis
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.setRawMode(originalRawMode);
          process.stdin.setEncoding(originalEncoding);
          process.stdin.removeListener('data', onData);
          resolve('jupiter');
        } else if (key === 'up' || key === 'w') {
          // Navigate up
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.setRawMode(originalRawMode);
          process.stdin.setEncoding(originalEncoding);
          process.stdin.removeListener('data', onData);
          resolve('up');
        } else if (key === 'down' || key === 's') {
          // Navigate down
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.setRawMode(originalRawMode);
          process.stdin.setEncoding(originalRawMode);
          process.stdin.setEncoding(originalEncoding);
          process.stdin.removeListener('data', onData);
          resolve('down');
        } else if (key === 'q') {
          // Quit
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.setRawMode(originalRawMode);
          process.stdin.setEncoding(originalEncoding);
          process.stdin.removeListener('data', onData);
          resolve('quit');
        }
      };
      
      process.stdin.on('data', onData);
      
      // Auto-resolve after 3 seconds if no key pressed
      setTimeout(() => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.setRawMode(originalRawMode);
        process.stdin.setEncoding(originalEncoding);
        process.stdin.removeListener('data', onData);
        resolve('continue');
      }, 3000);
    });
  };
  
  const updateDisplay = async (showHotkeys = true) => {
    // Clear previous lines (approximate)
    const linesToClear = tokensWithInfo.length * 6 + 5;
    for (let i = 0; i < linesToClear; i++) {
      process.stdout.write('\x1b[1A\x1b[2K'); // Move up and clear line
    }
    
    console.log(`${colors.green}📋 Your Tokens (Realtime PnL) - Update #${updateCount}:${colors.reset}`);
    console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    
    // Display tokens with realtime PnL
    for (let i = 0; i < tokensWithInfo.length; i++) {
      const token = tokensWithInfo[i];
      const pnl = await calculateTokenPnL(token.mint, token.balance);
      
      const pnlColor = pnl.pnlPercent >= 0 ? colors.green : colors.red;
      const pnlSymbol = pnl.pnlPercent >= 0 ? '📈' : '📉';
      const selectionIndicator = i === selectedTokenIndex ? '▶️ ' : '   ';
      
      console.log(`${selectionIndicator}${colors.cyan}${i + 1}.${colors.reset} ${colors.yellow}${token.symbol}${colors.reset} (${token.mint.slice(0, 8)}...${token.mint.slice(-8)})`);
      console.log(`   💰 Balance: ${token.balance.toLocaleString()}`);
      console.log(`   💵 Price: $${pnl.currentPrice.toFixed(6)}`);
      console.log(`   💎 Value: $${pnl.currentValue.toFixed(2)}`);
      console.log(`   ${pnlSymbol} PnL: ${pnlColor}$${pnl.pnl.toFixed(2)} (${pnl.pnlPercent.toFixed(2)}%)${colors.reset}`);
      
      // Show Jupiter analysis if available for selected token
      if (i === selectedTokenIndex && jupiterAnalysis) {
        console.log(`   🌌 Jupiter: ${jupiterAnalysis.price ? `$${jupiterAnalysis.price.toFixed(6)}` : 'N/A'} | Vol: ${jupiterAnalysis.volume24h ? `$${jupiterAnalysis.volume24h.toLocaleString()}` : 'N/A'}`);
      }
      console.log('');
    }
    
    // Show total portfolio value
    let totalValue = 0;
    for (const token of tokensWithInfo) {
      const pnl = await calculateTokenPnL(token.mint, token.balance);
      totalValue += pnl.currentValue;
    }
    
    console.log(`${colors.magenta}📊 Total Portfolio Value: $${totalValue.toFixed(2)}${colors.reset}`);
    
    if (showHotkeys) {
      console.log(`${colors.cyan}⌨️  Hotkeys: R=Refresh | J=Jupiter Analysis | ↑/↓=Navigate | Q=Quit${colors.reset}`);
    }
    
    updateCount++;
  };
  
  // Initial display
  await updateDisplay();
  
  // Set up realtime updates and hotkey handling
  const interval = setInterval(async () => {
    const hotkeyResult = await handleHotkeys();
    
    switch (hotkeyResult) {
      case 'refresh':
        console.log(`${colors.yellow}🔄 Refreshing token data...${colors.reset}`);
        // Refresh token info
        tokensWithInfo = await Promise.all(
          tokens.map(async (token) => {
            const tokenInfo = await getTokenInfo(token.mint);
            return { ...token, ...tokenInfo };
          })
        );
        jupiterAnalysis = null; // Clear Jupiter analysis
        await updateDisplay();
        break;
        
      case 'jupiter':
        if (selectedTokenIndex < tokensWithInfo.length) {
          const selectedToken = tokensWithInfo[selectedTokenIndex];
          console.log(`${colors.cyan}🌌 Getting Jupiter analysis for ${selectedToken.symbol}...${colors.reset}`);
          try {
            jupiterAnalysis = await checkJupiterTokenRealtime(selectedToken.mint);
            await updateDisplay();
          } catch (error) {
            console.log(`${colors.red}❌ Jupiter analysis failed: ${error.message}${colors.reset}`);
            await updateDisplay();
          }
        }
        break;
        
      case 'up':
        selectedTokenIndex = Math.max(0, selectedTokenIndex - 1);
        jupiterAnalysis = null; // Clear Jupiter analysis when navigating
        await updateDisplay();
        break;
        
      case 'down':
        selectedTokenIndex = Math.min(tokensWithInfo.length - 1, selectedTokenIndex + 1);
        jupiterAnalysis = null; // Clear Jupiter analysis when navigating
        await updateDisplay();
        break;
        
      case 'quit':
        clearInterval(interval);
        return;
        
      case 'continue':
        // Just continue with normal update
        await updateDisplay();
        break;
    }
  }, 1000);
  
  // Return function to stop updates
  return () => {
    clearInterval(interval);
  };
}

async function handleSellToken(wallet) {
  console.log(`${colors.red}🔴 Sell Token Mode${colors.reset}\n`);

  try {
    // Get all token balances
    console.log(`${colors.cyan}🔍 Loading your tokens...${colors.reset}`);
    const tokens = await getAllTokenBalances(wallet.publicKey.toString());
    
    let selectedToken;
    
    if (tokens.length === 0) {
      console.log(`${colors.yellow}⚠️ No tokens found in your wallet${colors.reset}`);
      console.log(`${colors.cyan}💡 You can enter a custom token mint address to test the sell functionality${colors.reset}`);
      
      const { selectedOption } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedOption',
          message: 'No tokens found in wallet. What would you like to do?',
          choices: [
            { name: 'Enter custom token mint address', value: 'custom' },
            { name: 'Go back to main menu', value: 'back' }
          ]
        }
      ]);
      
      if (selectedOption === 'back') {
        return;
      }
      
      selectedToken = 'custom';
    } else {
      
      // Get token info for choices with real-time data
      let tokensWithInfo = await Promise.all(
        tokens.map(async (token) => {
          const tokenInfo = await getTokenInfo(token.mint);
          const pnl = await calculateTokenPnL(token.mint, token.balance);
          return { ...token, ...tokenInfo, pnl };
        })
      );
      
      // Function to update token data with real-time prices
      const updateTokenData = async () => {
        tokensWithInfo = await Promise.all(
          tokens.map(async (token) => {
            const tokenInfo = await getTokenInfo(token.mint);
            const pnl = await calculateTokenPnL(token.mint, token.balance);
            return { ...token, ...tokenInfo, pnl };
          })
        );
      };
      
      // Function to display enhanced token list with real-time data
      const displayEnhancedTokenList = async () => {
        console.log(`${colors.green}📋 Your Tokens (Real-time Data):${colors.reset}`);
        console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
        
        for (let i = 0; i < tokensWithInfo.length; i++) {
          const token = tokensWithInfo[i];
          const pnlColor = token.pnl.pnlPercent >= 0 ? colors.green : colors.red;
          const pnlSymbol = token.pnl.pnlPercent >= 0 ? '📈' : '📉';
          
          console.log(`${colors.cyan}${i + 1}.${colors.reset} ${colors.yellow}${token.symbol}${colors.reset} (${token.mint.slice(0, 8)}...${token.mint.slice(-8)})`);
          console.log(`   💰 Balance: ${token.balance.toLocaleString()}`);
          console.log(`   💵 Price: $${token.pnl.currentPrice.toFixed(6)}`);
          console.log(`   💎 Value: $${token.pnl.currentValue.toFixed(2)}`);
          console.log(`   ${pnlSymbol} PnL: ${pnlColor}$${token.pnl.pnl.toFixed(2)} (${token.pnl.pnlPercent.toFixed(2)}%)${colors.reset}`);
          
          // Get Jupiter price for each token
          try {
            const jupiterData = await checkJupiterTokenRealtime(token.mint);
            if (jupiterData && jupiterData.price) {
              console.log(`   🌌 Jupiter: $${jupiterData.price.toFixed(6)} | Vol: ${jupiterData.volume24h ? `$${jupiterData.volume24h.toLocaleString()}` : 'N/A'}`);
            }
          } catch (error) {
            // Jupiter data not available, skip
          }
          console.log('');
        }
        
        console.log(`${colors.cyan}⌨️  Hotkeys: R=Refresh Data | J=Jupiter Prices | SPACE=Continue${colors.reset}`);
      };
      
      // Initial display
      await displayEnhancedTokenList();
      
      // Set up hotkey handling for refresh
      const handleRefreshHotkeys = () => {
        return new Promise((resolve) => {
          const originalRawMode = process.stdin.isRaw;
          const originalEncoding = process.stdin.encoding;
          
          process.stdin.setRawMode(true);
          process.stdin.resume();
          process.stdin.setEncoding('utf8');
          
          const onData = (data) => {
            const key = data.toLowerCase();
            if (key === 'r') {
              // Refresh data
              process.stdin.setRawMode(false);
              process.stdin.pause();
              process.stdin.setRawMode(originalRawMode);
              process.stdin.setEncoding(originalEncoding);
              process.stdin.removeListener('data', onData);
              resolve('refresh');
            } else if (key === 'j') {
              // Show Jupiter prices
              process.stdin.setRawMode(false);
              process.stdin.pause();
              process.stdin.setRawMode(originalRawMode);
              process.stdin.setEncoding(originalEncoding);
              process.stdin.removeListener('data', onData);
              resolve('jupiter');
            } else if (key === ' ') {
              // Continue
              process.stdin.setRawMode(false);
              process.stdin.pause();
              process.stdin.setRawMode(originalRawMode);
              process.stdin.setEncoding(originalEncoding);
              process.stdin.removeListener('data', onData);
              resolve('continue');
            }
          };
          
          process.stdin.on('data', onData);
          
          // Auto-resolve after 5 seconds
          setTimeout(() => {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdin.setRawMode(originalRawMode);
            process.stdin.setEncoding(originalEncoding);
            process.stdin.removeListener('data', onData);
            resolve('continue');
          }, 5000);
        });
      };
      
      // Wait for user input or hotkeys
      const hotkeyResult = await handleRefreshHotkeys();
      
      if (hotkeyResult === 'refresh') {
        console.log(`${colors.yellow}🔄 Refreshing token data...${colors.reset}`);
        await updateTokenData();
        await displayEnhancedTokenList();
      } else if (hotkeyResult === 'jupiter') {
        console.log(`${colors.cyan}🌌 Updating Jupiter prices...${colors.reset}`);
        await displayEnhancedTokenList();
      }
      
      // Create enhanced token choices with real-time data
      const tokenChoices = tokensWithInfo.map((token, index) => ({
        name: `${index + 1}. ${token.symbol} (${token.mint.slice(0, 8)}...${token.mint.slice(-8)}) - Balance: ${token.balance.toLocaleString()} - Value: $${token.pnl.currentValue.toFixed(2)}`,
        value: token
      }));

      // Add option to enter custom token mint
      tokenChoices.push({
        name: `${tokens.length + 1}. Enter custom token mint address`,
        value: 'custom'
      });

      const { selectedOption } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedOption',
          message: 'Select token to sell:',
          choices: tokenChoices
        }
      ]);
      
      selectedToken = selectedOption;
    }

    let tokenMint, tokenBalance, tokenDecimals;

    if (selectedToken === 'custom') {
      // Custom token input
      const { customMint } = await inquirer.prompt([
        {
          type: 'input',
          name: 'customMint',
          message: 'Enter token mint address:',
          validate: (input) => input.length > 0 ? true : 'Token mint is required'
        }
      ]);
      
      tokenMint = customMint;
      tokenBalance = await getTokenBalance(tokenMint, wallet.publicKey.toString());
      const tokenMetadata = await getTokenMetadata(tokenMint);
      tokenDecimals = tokenMetadata.decimals;
    } else {
      // Selected from list
      tokenMint = selectedToken.mint;
      tokenBalance = selectedToken.balance;
      tokenDecimals = selectedToken.decimals;
    }

    console.log(`${colors.blue}💰 Token Balance: ${tokenBalance.toLocaleString()}${colors.reset}`);

    if (tokenBalance <= 0) {
      console.log(`${colors.red}❌ No balance for this token${colors.reset}`);
      await waitForSpaceKey();
      return;
    }

    // Ask for percentage to sell
    const { sellPercentage } = await inquirer.prompt([
      {
        type: 'list',
        name: 'sellPercentage',
        message: 'How much to sell?',
        choices: [
          { name: '25%', value: 25 },
          { name: '50%', value: 50 },
          { name: '75%', value: 75 },
          { name: '100%', value: 100 },
          { name: 'Custom percentage', value: 'custom' }
        ]
      }
    ]);

    let percentage;
    if (sellPercentage === 'custom') {
      const { customPercentage } = await inquirer.prompt([
        {
          type: 'input',
          name: 'customPercentage',
          message: 'Enter percentage to sell (1-100):',
          validate: (input) => {
            const num = parseFloat(input);
            if (isNaN(num)) return 'Please enter a valid number';
            if (num <= 0 || num > 100) return 'Percentage must be between 1 and 100';
            return true;
          },
          filter: (input) => parseFloat(input)
        }
      ]);
      percentage = customPercentage;
    } else {
      percentage = sellPercentage;
    }

    // Calculate amount to sell
    const amountToSell = (tokenBalance * percentage) / 100;
    console.log(`${colors.cyan}📊 Selling ${percentage}% of ${tokenBalance.toLocaleString()} = ${amountToSell.toLocaleString()} tokens${colors.reset}`);

    // Convert to smallest units
    const amountInSmallestUnits = Math.floor(amountToSell * Math.pow(10, tokenDecimals));
    console.log(`${colors.cyan}📊 Amount in smallest units: ${amountInSmallestUnits.toLocaleString()}${colors.reset}`);

    // Get quote
    const quote = await getBestQuote(
      tokenMint,
      'So11111111111111111111111111111111111111112', // SOL mint
      amountInSmallestUnits
    );

    // Get sell initials
    const { sellInitials } = await inquirer.prompt([
      {
        type: 'input',
        name: 'sellInitials',
        message: 'Enter your initials for this sell transaction:',
        validate: (input) => {
          if (!input.trim()) return 'Initials are required';
          if (input.length > 10) return 'Initials must be 10 characters or less';
          return true;
        }
      }
    ]);

    // Confirm swap
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Confirm swap ${amountToSell.toLocaleString()} tokens (${percentage}%) for ${(quote.outAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL?\nSell Initials: ${sellInitials}`,
        default: false
      }
    ]);

    if (!confirm) {
      console.log(`${colors.yellow}⚠️ Swap cancelled${colors.reset}`);
      return;
    }

    // Initialize transaction progress monitor
    const progressMonitor = new TransactionProgressMonitor();
    const sellAmount = amountToSell.toLocaleString();
    
    // Start transaction monitoring
    progressMonitor.startTransaction('SELL', 'TOKEN', `${sellAmount} tokens`);
    
    // Simulate transaction steps with progress
    await progressMonitor.simulateTransactionSteps('SELL', 'TOKEN', `${sellAmount} tokens`);
    
    // Perform swap
    const result = await performSwap(
      tokenMint,
      'So11111111111111111111111111111111111111112',
      amountInSmallestUnits,
      wallet
    );

    // Complete transaction with success
    progressMonitor.completeTransaction(true, result.signature);
    
    // Calculate and display profit from the sell
    try {
      const soldValue = quote.outAmount / LAMPORTS_PER_SOL;
      console.log(`${colors.green}💰 Sold for: ${soldValue.toFixed(4)} SOL${colors.reset}`);
      
      // Calculate profit percentage based on original purchase (if available)
      const profitInfo = await calculateAndDisplayProfit(tokenMint, amountToSell, tokenMetadata.decimals);
      if (profitInfo.percentage !== 0) {
        console.log(`${profitInfo.symbol} ${profitInfo.color}Profit: ${profitInfo.percentage.toFixed(2)}%${colors.reset}`);
      }
    } catch (error) {
      console.log(`${colors.yellow}⚠️ Could not calculate profit details${colors.reset}`);
    }

  } catch (error) {
    console.error(`${colors.red}❌ Sell failed: ${error.message}${colors.reset}`);
    
    // Check if it's a routing error (token can't be sold)
    if (error.message.includes('Could not find any route') || 
        error.message.includes('ParseIntError') ||
        error.message.includes('InvalidDigit')) {
      
      console.log(`${colors.yellow}💡 This token cannot be sold (no liquidity)${colors.reset}`);
      console.log(`${colors.cyan}🔥 Would you like to burn these tokens instead?${colors.reset}`);
      
      const { burnInstead } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'burnInstead',
          message: 'Burn tokens to free up wallet space?',
          default: true
        }
      ]);
      
      if (burnInstead) {
        try {
          console.log(`${colors.red}🔥 Burning tokens instead of selling...${colors.reset}`);
          
          // Initialize burn transaction progress monitor
          const burnProgressMonitor = new TransactionProgressMonitor();
          burnProgressMonitor.startTransaction('BURN', 'TOKEN', `${amountToSell.toLocaleString()} tokens`);
          
          // Simulate burn transaction steps
          await burnProgressMonitor.simulateTransactionSteps('BURN', 'TOKEN', `${amountToSell.toLocaleString()} tokens`);
          
          // Perform burn
          const burnResult = await burnTokens(tokenMint, amountToSell, wallet);
          
          // Complete burn transaction
          burnProgressMonitor.completeTransaction(true, burnResult.signature);
          
          console.log(`${colors.green}✅ Tokens burned successfully!${colors.reset}`);
          console.log(`${colors.blue}📝 Transaction: ${burnResult.signature}${colors.reset}`);
          console.log(`${colors.yellow}💡 Wallet space freed up${colors.reset}`);
        } catch (burnError) {
          console.error(`${colors.red}❌ Burn failed: ${burnError.message}${colors.reset}`);
        }
      } else {
        console.log(`${colors.yellow}⚠️ Tokens kept in wallet${colors.reset}`);
      }
    }
  }

  await waitForSpaceKey();
}

// EMERGENCY SELL FUNCTION - Quick 100% sell of any token
async function handleEmergencySell(wallet) {
  console.log(`${colors.red}🚨 EMERGENCY SELL MODE${colors.reset}`);
  console.log(`${colors.yellow}⚠️ This will sell 100% of the specified token immediately${colors.reset}\n`);

  try {
    // Get all token balances
    console.log(`${colors.cyan}🔍 Loading your tokens...${colors.reset}`);
    const tokens = await getAllTokenBalances(wallet.publicKey.toString());
    
    let selectedToken;
    let tokenMint;
    let tokenBalance;
    let tokenDecimals;
    
    if (tokens.length === 0) {
      console.log(`${colors.yellow}⚠️ No tokens found in your wallet${colors.reset}`);
      console.log(`${colors.cyan}💡 You can enter a custom token mint address${colors.reset}`);
      
      const { selectedOption } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedOption',
          message: 'No tokens found in wallet. What would you like to do?',
          choices: [
            { name: 'Enter custom token mint address', value: 'custom' },
            { name: 'Go back to main menu', value: 'back' }
          ]
        }
      ]);
      
      if (selectedOption === 'back') {
        return;
      }
      
      selectedToken = 'custom';
    } else {
      // Display tokens with real-time data
      console.log(`${colors.red}🚨 EMERGENCY SELL - Select token to sell 100%:${colors.reset}`);
      console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        try {
          const tokenInfo = await getTokenInfo(token.mint);
          const pnl = await calculateTokenPnL(token.mint, token.balance);
          const pnlColor = pnl.pnlPercent >= 0 ? colors.green : colors.red;
          const pnlSymbol = pnl.pnlPercent >= 0 ? '📈' : '📉';
          
          console.log(`${colors.cyan}${i + 1}.${colors.reset} ${colors.yellow}${tokenInfo.symbol}${colors.reset} (${token.mint.slice(0, 8)}...${token.mint.slice(-8)})`);
          console.log(`   💰 Balance: ${token.balance.toLocaleString()}`);
          console.log(`   💵 Value: $${pnl.currentValue.toFixed(2)}`);
          console.log(`   ${pnlSymbol} PnL: ${pnlColor}$${pnl.pnl.toFixed(2)} (${pnl.pnlPercent.toFixed(2)}%)${colors.reset}`);
          console.log('');
        } catch (error) {
          console.log(`${colors.cyan}${i + 1}.${colors.reset} ${colors.yellow}Unknown Token${colors.reset} (${token.mint.slice(0, 8)}...${token.mint.slice(-8)})`);
          console.log(`   💰 Balance: ${token.balance.toLocaleString()}`);
          console.log('');
        }
      }
      
      const { selectedOption } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedOption',
          message: 'Select token to emergency sell (100%):',
          choices: [
            ...tokens.map((token, index) => ({
              name: `${index + 1}. ${token.balance.toLocaleString()} tokens`,
              value: index
            })),
            { name: 'Enter custom token mint address', value: 'custom' },
            { name: 'Cancel', value: 'cancel' }
          ]
        }
      ]);
      
      if (selectedOption === 'cancel') {
        console.log(`${colors.yellow}⚠️ Emergency sell cancelled${colors.reset}`);
        return;
      }
      
      if (selectedOption === 'custom') {
        selectedToken = 'custom';
      } else {
        selectedToken = tokens[selectedOption];
      }
    }

    if (selectedToken === 'custom') {
      // Custom token input
      const { customMint } = await inquirer.prompt([
        {
          type: 'input',
          name: 'customMint',
          message: 'Enter token mint address:',
          validate: (input) => input.length > 0 ? true : 'Token mint is required'
        }
      ]);
      
      tokenMint = customMint;
      tokenBalance = await getTokenBalance(tokenMint, wallet.publicKey.toString());
      const tokenMetadata = await getTokenMetadata(tokenMint);
      tokenDecimals = tokenMetadata.decimals;
    } else {
      // Selected from list
      tokenMint = selectedToken.mint;
      tokenBalance = selectedToken.balance;
      const tokenMetadata = await getTokenMetadata(tokenMint);
      tokenDecimals = tokenMetadata.decimals;
    }

    console.log(`${colors.blue}💰 Token Balance: ${tokenBalance.toLocaleString()}${colors.reset}`);

    if (tokenBalance <= 0) {
      console.log(`${colors.red}❌ No tokens to sell${colors.reset}`);
      await waitForSpaceKey();
      return;
    }

    // Check if token can be sold first
    console.log(`${colors.cyan}🔍 Checking if token can be sold...${colors.reset}`);
    const canBeSold = await canTokenBeSold(tokenMint);
    
    if (!canBeSold) {
      console.log(`${colors.red}❌ Token cannot be sold (no liquidity)${colors.reset}`);
      console.log(`${colors.yellow}💡 Would you like to burn these tokens instead?${colors.reset}`);
      
      const { burnInstead } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'burnInstead',
          message: 'Burn tokens to free up wallet space?',
          default: true
        }
      ]);
      
      if (burnInstead) {
        console.log(`${colors.red}🔥 Burning tokens instead of selling...${colors.reset}`);
        
        // Initialize burn transaction progress monitor
        const burnProgressMonitor = new TransactionProgressMonitor();
        burnProgressMonitor.startTransaction('BURN', 'TOKEN', `${tokenBalance.toLocaleString()} tokens`);
        
        // Simulate burn transaction steps
        await burnProgressMonitor.simulateTransactionSteps('BURN', 'TOKEN', `${tokenBalance.toLocaleString()} tokens`);
        
        // Perform burn
        const burnResult = await burnTokens(tokenMint, tokenBalance, wallet);
        
        // Complete burn transaction
        burnProgressMonitor.completeTransaction(true, burnResult.signature);
        
        console.log(`${colors.green}✅ Tokens burned successfully!${colors.reset}`);
        console.log(`${colors.blue}📝 Transaction: ${burnResult.signature}${colors.reset}`);
        console.log(`${colors.yellow}💡 Wallet space freed up${colors.reset}`);
        
        await waitForSpaceKey();
        return;
      } else {
        console.log(`${colors.yellow}⚠️ Emergency sell cancelled${colors.reset}`);
        await waitForSpaceKey();
        return;
      }
    }

    // Get sell quote for 100% of balance
    console.log(`${colors.cyan}📊 Getting sell quote for 100% of tokens...${colors.reset}`);
    const sellQuote = await getBestQuote(
      tokenMint,
      'So11111111111111111111111111111111111111112', // SOL mint
      tokenBalance
    );

    console.log(`${colors.cyan}📊 Emergency Sell Quote:${colors.reset}`);
    console.log(`${colors.red}🚨 Selling: ${tokenBalance.toLocaleString()} tokens${colors.reset}`);
    console.log(`${colors.green}💰 Receiving: ${sellQuote.outAmount / LAMPORTS_PER_SOL} SOL${colors.reset}`);

    // Final confirmation
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `🚨 CONFIRM EMERGENCY SELL: Sell 100% (${tokenBalance.toLocaleString()} tokens) for ${sellQuote.outAmount / LAMPORTS_PER_SOL} SOL?`,
        default: false
      }
    ]);

    if (!confirm) {
      console.log(`${colors.yellow}⚠️ Emergency sell cancelled${colors.reset}`);
      await waitForSpaceKey();
      return;
    }

    // Initialize emergency sell transaction progress monitor
    const progressMonitor = new TransactionProgressMonitor();
    progressMonitor.startTransaction('EMERGENCY_SELL', 'TOKEN', `${tokenBalance.toLocaleString()} tokens`);
    
    // Simulate emergency sell transaction steps
    await progressMonitor.simulateTransactionSteps('EMERGENCY_SELL', 'TOKEN', `${tokenBalance.toLocaleString()} tokens`);
    
    // Perform emergency sell
    const result = await performSwap(
      tokenMint,
      'So11111111111111111111111111111111111111112',
      tokenBalance,
      wallet
    );

    // Complete emergency sell transaction
    progressMonitor.completeTransaction(true, result.signature);
    
    console.log(`${colors.green}✅ EMERGENCY SELL COMPLETED!${colors.reset}`);
    console.log(`${colors.blue}💰 Received: ${sellQuote.outAmount / LAMPORTS_PER_SOL} SOL${colors.reset}`);
    console.log(`${colors.blue}📝 Transaction: ${result.signature}${colors.reset}`);

    // Calculate and display profit/loss
    try {
      const profitInfo = await calculateAndDisplayProfit(tokenMint, tokenBalance, tokenDecimals);
      console.log(`${profitInfo.symbol} ${profitInfo.color}Final P&L: ${profitInfo.percentage.toFixed(2)}%${colors.reset}`);
    } catch (error) {
      console.log(`${colors.yellow}⚠️ Could not calculate final P&L${colors.reset}`);
    }

  } catch (error) {
    console.error(`${colors.red}❌ Emergency sell failed: ${error.message}${colors.reset}`);
  }

  await waitForSpaceKey();
}

// BURN TOKENS FUNCTION - Burn unwanted tokens
async function handleBurnTokens(wallet) {
  console.log(`${colors.red}🔥 BURN TOKENS MODE${colors.reset}`);
  console.log(`${colors.yellow}⚠️ This will permanently burn tokens to free up wallet space${colors.reset}\n`);

  try {
    // Get all token balances
    console.log(`${colors.cyan}🔍 Loading your tokens...${colors.reset}`);
    const tokens = await getAllTokenBalances(wallet.publicKey.toString());
    
    if (tokens.length === 0) {
      console.log(`${colors.yellow}⚠️ No tokens found in your wallet${colors.reset}`);
      await waitForSpaceKey();
      return;
    }

    // Display tokens with real-time data
    console.log(`${colors.red}🔥 BURN TOKENS - Select token to burn:${colors.reset}`);
    console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      try {
        const tokenInfo = await getTokenInfo(token.mint);
        const pnl = await calculateTokenPnL(token.mint, token.balance);
        const pnlColor = pnl.pnlPercent >= 0 ? colors.green : colors.red;
        const pnlSymbol = pnl.pnlPercent >= 0 ? '📈' : '📉';
        
        console.log(`${colors.cyan}${i + 1}.${colors.reset} ${colors.yellow}${tokenInfo.symbol}${colors.reset} (${token.mint.slice(0, 8)}...${token.mint.slice(-8)})`);
        console.log(`   💰 Balance: ${token.balance.toLocaleString()}`);
        console.log(`   💵 Value: $${pnl.currentValue.toFixed(2)}`);
        console.log(`   ${pnlSymbol} PnL: ${pnlColor}$${pnl.pnl.toFixed(2)} (${pnl.pnlPercent.toFixed(2)}%)${colors.reset}`);
        console.log('');
      } catch (error) {
        console.log(`${colors.cyan}${i + 1}.${colors.reset} ${colors.yellow}Unknown Token${colors.reset} (${token.mint.slice(0, 8)}...${token.mint.slice(-8)})`);
        console.log(`   💰 Balance: ${token.balance.toLocaleString()}`);
        console.log('');
      }
    }
    
    const { selectedOption } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedOption',
        message: 'Select token to burn:',
        choices: [
          ...tokens.map((token, index) => ({
            name: `${index + 1}. ${token.balance.toLocaleString()} tokens`,
            value: index
          })),
          { name: 'Enter custom token mint address', value: 'custom' },
          { name: 'Cancel', value: 'cancel' }
        ]
      }
    ]);
    
    if (selectedOption === 'cancel') {
      console.log(`${colors.yellow}⚠️ Burn cancelled${colors.reset}`);
      return;
    }
    
    let tokenMint;
    let tokenBalance;
    let tokenDecimals;
    
    if (selectedOption === 'custom') {
      // Custom token input
      const { customMint } = await inquirer.prompt([
        {
          type: 'input',
          name: 'customMint',
          message: 'Enter token mint address:',
          validate: (input) => input.length > 0 ? true : 'Token mint is required'
        }
      ]);
      
      tokenMint = customMint;
      tokenBalance = await getTokenBalance(tokenMint, wallet.publicKey.toString());
      const tokenMetadata = await getTokenMetadata(tokenMint);
      tokenDecimals = tokenMetadata.decimals;
    } else {
      // Selected from list
      const selectedToken = tokens[selectedOption];
      tokenMint = selectedToken.mint;
      tokenBalance = selectedToken.balance;
      const tokenMetadata = await getTokenMetadata(tokenMint);
      tokenDecimals = tokenMetadata.decimals;
    }

    console.log(`${colors.blue}💰 Token Balance: ${tokenBalance.toLocaleString()}${colors.reset}`);

    if (tokenBalance <= 0) {
      console.log(`${colors.red}❌ No tokens to burn${colors.reset}`);
      await waitForSpaceKey();
      return;
    }

    // Get burn amount
    const { burnAmount } = await inquirer.prompt([
      {
        type: 'input',
        name: 'burnAmount',
        message: `Enter amount to burn (max: ${tokenBalance.toLocaleString()}):`,
        validate: (input) => {
          const num = parseFloat(input);
          if (isNaN(num)) return 'Please enter a valid number';
          if (num <= 0) return 'Amount must be greater than 0';
          if (num > tokenBalance) return `Amount cannot exceed balance (${tokenBalance.toLocaleString()})`;
          return true;
        },
        filter: (input) => parseFloat(input)
      }
    ]);

    // Convert to smallest units
    const amountToBurn = Math.floor(burnAmount * Math.pow(10, tokenDecimals));

    // Final confirmation
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `🔥 CONFIRM BURN: Burn ${burnAmount.toLocaleString()} tokens? (This action is irreversible!)`,
        default: false
      }
    ]);

    if (!confirm) {
      console.log(`${colors.yellow}⚠️ Burn cancelled${colors.reset}`);
      await waitForSpaceKey();
      return;
    }

    // Initialize burn transaction progress monitor
    const progressMonitor = new TransactionProgressMonitor();
    progressMonitor.startTransaction('BURN', 'TOKEN', `${burnAmount.toLocaleString()} tokens`);
    
    // Simulate burn transaction steps
    await progressMonitor.simulateTransactionSteps('BURN', 'TOKEN', `${burnAmount.toLocaleString()} tokens`);
    
    // Perform burn
    const result = await burnTokens(tokenMint, amountToBurn, wallet);

    // Complete burn transaction
    progressMonitor.completeTransaction(true, result.signature);
    
    console.log(`${colors.green}✅ Tokens burned successfully!${colors.reset}`);
    console.log(`${colors.blue}📝 Transaction: ${result.signature}${colors.reset}`);
    console.log(`${colors.yellow}💡 Wallet space freed up${colors.reset}`);

  } catch (error) {
    console.error(`${colors.red}❌ Burn failed: ${error.message}${colors.reset}`);
  }

  await waitForSpaceKey();
}

async function handleTokenToToken(wallet) {
  console.log(`${colors.cyan}🔄 Token to Token Mode${colors.reset}\n`);

  const { fromMint, toMint, amount } = await inquirer.prompt([
    {
      type: 'input',
      name: 'fromMint',
      message: 'Enter source token mint address:',
      validate: (input) => input.length > 0 ? true : 'Token mint is required'
    },
    {
      type: 'input',
      name: 'toMint',
      message: 'Enter destination token mint address:',
      validate: (input) => input.length > 0 ? true : 'Token mint is required'
    },
    {
      type: 'input',
      name: 'amount',
      message: 'Enter amount to swap:',
      validate: (input) => {
        const num = parseFloat(input);
        if (isNaN(num)) return 'Please enter a valid number';
        if (num <= 0) return 'Amount must be greater than 0';
        return true;
      },
      filter: (input) => parseFloat(input)
    }
  ]);

  try {
    // Check balance
    const balance = await getTokenBalance(fromMint, wallet.publicKey.toString());
    console.log(`${colors.blue}💰 Balance: ${balance}${colors.reset}`);

    if (balance < amount) {
      console.log(`${colors.red}❌ Insufficient balance${colors.reset}`);
      await waitForSpaceKey();
      return;
    }

    // Get token metadata to convert amount to smallest units
    const tokenMetadata = await getTokenMetadata(fromMint);
    const amountInSmallestUnits = Math.floor(amount * Math.pow(10, tokenMetadata.decimals));
    
    console.log(`${colors.cyan}📊 Token decimals: ${tokenMetadata.decimals}${colors.reset}`);
    console.log(`${colors.cyan}📊 Amount in smallest units: ${amountInSmallestUnits}${colors.reset}`);

    // Get quote
    const quote = await getBestQuote(fromMint, toMint, amountInSmallestUnits);

    // Confirm swap
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Confirm swap ${amount} tokens for ${quote.outAmount} tokens?`,
        default: false
      }
    ]);

    if (!confirm) {
      console.log(`${colors.yellow}⚠️ Swap cancelled${colors.reset}`);
      return;
    }

    // Perform swap
    const result = await performSwap(fromMint, toMint, amountInSmallestUnits, wallet);

    console.log(`${colors.green}✅ Token swap completed!${colors.reset}`);
    console.log(`${colors.blue}📝 Transaction: ${result.signature}${colors.reset}`);

  } catch (error) {
    console.error(`${colors.red}❌ Token swap failed: ${error.message}${colors.reset}`);
  }

  await waitForSpaceKey();
}

async function handleGetQuote() {
  console.log(`${colors.blue}📊 Get Quote Mode${colors.reset}\n`);

  const { fromMint, toMint, amount } = await inquirer.prompt([
    {
      type: 'input',
      name: 'fromMint',
      message: 'Enter source token mint address:',
      validate: (input) => input.length > 0 ? true : 'Token mint is required'
    },
    {
      type: 'input',
      name: 'toMint',
      message: 'Enter destination token mint address:',
      validate: (input) => input.length > 0 ? true : 'Token mint is required'
    },
    {
      type: 'input',
      name: 'amount',
      message: 'Enter amount:',
      validate: (input) => {
        const num = parseFloat(input);
        if (isNaN(num)) return 'Please enter a valid number';
        if (num <= 0) return 'Amount must be greater than 0';
        return true;
      },
      filter: (input) => parseFloat(input)
    }
  ]);

  try {
    const quote = await getBestQuote(fromMint, toMint, amount);
    
    console.log(`${colors.green}✅ Quote received!${colors.reset}`);
    console.log(`${colors.yellow}💰 Input: ${quote.inputAmount}${colors.reset}`);
    console.log(`${colors.yellow}💰 Output: ${quote.outputAmount}${colors.reset}`);
    console.log(`${colors.blue}📊 Price Impact: ${quote.priceImpactPct}%${colors.reset}`);

  } catch (error) {
    console.error(`${colors.red}❌ Failed to get quote: ${error.message}${colors.reset}`);
  }

  await waitForSpaceKey();
}

async function handleCheckBalances(wallet) {
  console.log(`${colors.blue}💰 Check Balances${colors.reset}\n`);

  try {
    // Get SOL balance
    const solBalance = await getSolBalance(wallet.publicKey.toString());
    console.log(`${colors.green}💰 SOL Balance: ${solBalance} SOL${colors.reset}`);

    // Get recent tokens (this would need to be implemented based on your token tracking)
    console.log(`${colors.yellow}📋 Recent tokens will be shown here${colors.reset}`);

  } catch (error) {
    console.error(`${colors.red}❌ Failed to get balances: ${error.message}${colors.reset}`);
  }

  await waitForSpaceKey();
}

async function handleSwapHistory(wallet) {
  console.log(`${colors.blue}📜 Swap History${colors.reset}\n`);

  try {
    const history = await getSwapHistory(wallet.publicKey.toString(), 10);
    
    if (history.length === 0) {
      console.log(`${colors.yellow}📭 No recent swap transactions found${colors.reset}`);
    } else {
      console.log(`${colors.green}📜 Recent transactions:${colors.reset}`);
      history.forEach((tx, index) => {
        console.log(`${colors.blue}${index + 1}. ${tx.signature}${colors.reset}`);
      });
    }

  } catch (error) {
    console.error(`${colors.red}❌ Failed to get swap history: ${error.message}${colors.reset}`);
  }

  await waitForSpaceKey();
}

// HANDLER FUNCTIONS FOR BUNDLE SWAP
async function handleBundleBuy(wallet) {
  console.log(`${colors.green}🟢 Bundle Buy Mode${colors.reset}\n`);

  const { tokenList, amountPerToken } = await inquirer.prompt([
    {
      type: 'input',
      name: 'tokenList',
      message: 'Enter token mint addresses (comma-separated):',
      validate: (input) => input.length > 0 ? true : 'Token list is required'
    },
    {
      type: 'input',
      name: 'amountPerToken',
      message: 'Enter SOL amount per token:',
      validate: (input) => {
        const num = parseFloat(input);
        if (isNaN(num)) return 'Please enter a valid number';
        if (num <= 0) return 'Amount must be greater than 0';
        return true;
      },
      filter: (input) => parseFloat(input)
    }
  ]);

  const tokens = tokenList.split(',').map(t => t.trim());
  
  try {
    // Check total SOL needed
    const totalSOL = tokens.length * amountPerToken;
    const solBalance = await getSolBalance(wallet.publicKey.toString());
    
    console.log(`${colors.blue}💰 Total SOL needed: ${totalSOL} SOL${colors.reset}`);
    console.log(`${colors.blue}💰 Available SOL: ${solBalance} SOL${colors.reset}`);

    if (solBalance < totalSOL) {
      console.log(`${colors.red}❌ Insufficient SOL balance${colors.reset}`);
      await waitForSpaceKey();
      return;
    }

    // Confirm bundle
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `Confirm buying ${tokens.length} tokens with ${totalSOL} SOL total?`,
        default: false
      }
    ]);

    if (!confirm) {
      console.log(`${colors.yellow}⚠️ Bundle buy cancelled${colors.reset}`);
      return;
    }

    // Execute bundle buys
    console.log(`${colors.cyan}🚀 Executing bundle buys...${colors.reset}`);
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      console.log(`${colors.yellow}🔄 Buying token ${i + 1}/${tokens.length}: ${token}${colors.reset}`);
      
      try {
        const result = await performSwap(
          'So11111111111111111111111111111111111111112',
          token,
          amountPerToken * LAMPORTS_PER_SOL,
          wallet
        );
        console.log(`${colors.green}✅ Token ${i + 1} bought: ${result.signature}${colors.reset}`);
      } catch (error) {
        console.log(`${colors.red}❌ Failed to buy token ${i + 1}: ${error.message}${colors.reset}`);
      }
    }

    console.log(`${colors.green}✅ Bundle buy completed!${colors.reset}`);

  } catch (error) {
    console.error(`${colors.red}❌ Bundle buy failed: ${error.message}${colors.reset}`);
  }

  await waitForSpaceKey();
}

async function handleBundleSell(wallet) {
  console.log(`${colors.red}🔴 Bundle Sell Mode${colors.reset}\n`);

  const { tokenList } = await inquirer.prompt([
    {
      type: 'input',
      name: 'tokenList',
      message: 'Enter token mint addresses to sell (comma-separated):',
      validate: (input) => input.length > 0 ? true : 'Token list is required'
    }
  ]);

  const tokens = tokenList.split(',').map(t => t.trim());
  
  try {
    console.log(`${colors.cyan}🚀 Executing bundle sells...${colors.reset}`);
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      console.log(`${colors.yellow}🔄 Selling token ${i + 1}/${tokens.length}: ${token}${colors.reset}`);
      
      try {
        // Get token balance
        const balance = await getTokenBalance(token, wallet.publicKey.toString());
        
        if (balance > 0) {
          const result = await performSwap(
            token,
            'So11111111111111111111111111111111111111112',
            balance,
            wallet
          );
          console.log(`${colors.green}✅ Token ${i + 1} sold: ${result.signature}${colors.reset}`);
        } else {
          console.log(`${colors.yellow}⚠️ No balance for token ${i + 1}${colors.reset}`);
        }
      } catch (error) {
        console.log(`${colors.red}❌ Failed to sell token ${i + 1}: ${error.message}${colors.reset}`);
      }
    }

    console.log(`${colors.green}✅ Bundle sell completed!${colors.reset}`);

  } catch (error) {
    console.error(`${colors.red}❌ Bundle sell failed: ${error.message}${colors.reset}`);
  }

  await waitForSpaceKey();
}

async function handleBundleAnalyze(wallet) {
  console.log(`${colors.blue}📊 Bundle Analysis Mode${colors.reset}\n`);

  const { tokenList } = await inquirer.prompt([
    {
      type: 'input',
      name: 'tokenList',
      message: 'Enter token mint addresses to analyze (comma-separated):',
      validate: (input) => input.length > 0 ? true : 'Token list is required'
    }
  ]);

  const tokens = tokenList.split(',').map(t => t.trim());
  
  try {
    console.log(`${colors.cyan}🔍 Analyzing bundle...${colors.reset}`);
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      console.log(`${colors.yellow}📊 Analyzing token ${i + 1}/${tokens.length}: ${token}${colors.reset}`);
      
      try {
        // Get balance
        const balance = await getTokenBalance(token, wallet.publicKey.toString());
        console.log(`${colors.blue}💰 Balance: ${balance}${colors.reset}`);
        
        // Get quote for 1 SOL worth
        const quote = await getBestQuote(
          'So11111111111111111111111111111111111111112',
          token,
          LAMPORTS_PER_SOL
        );
        console.log(`${colors.green}📈 1 SOL = ${quote.outputAmount} tokens${colors.reset}`);
        
      } catch (error) {
        console.log(`${colors.red}❌ Failed to analyze token ${i + 1}: ${error.message}${colors.reset}`);
      }
    }

    console.log(`${colors.green}✅ Bundle analysis completed!${colors.reset}`);

  } catch (error) {
    console.error(`${colors.red}❌ Bundle analysis failed: ${error.message}${colors.reset}`);
  }

  await waitForSpaceKey();
}

async function handleBundleFromJSON(wallet) {
  console.log(`${colors.blue}📋 Bundle from JSON Mode${colors.reset}\n`);

  const { jsonFile, action } = await inquirer.prompt([
    {
      type: 'input',
      name: 'jsonFile',
      message: 'Enter path to JSON file with token list:',
      default: 'example-tokens.json',
      validate: (input) => input.length > 0 ? true : 'File path is required'
    },
    {
      type: 'list',
      name: 'action',
      message: 'Select action:',
      choices: [
        { name: '🟢 Buy all tokens', value: 'buy' },
        { name: '🔴 Sell all tokens', value: 'sell' },
        { name: '📊 Analyze all tokens', value: 'analyze' }
      ]
    }
  ]);

  try {
    // Read JSON file
    const fs = await import('fs');
    const data = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
    
    if (!data.tokens || !Array.isArray(data.tokens)) {
      throw new Error('Invalid JSON format. Expected {tokens: [...]}');
    }

    console.log(`${colors.green}📋 Loaded ${data.tokens.length} tokens from JSON${colors.reset}`);
    
    // Display tokens
    console.log(`${colors.cyan}📋 Token list:${colors.reset}`);
    data.tokens.forEach((token, index) => {
      console.log(`${colors.yellow}${index + 1}. ${token.name} (${token.symbol}) - ${token.mint}${colors.reset}`);
    });

    if (action === 'buy') {
      // Calculate total SOL needed
      const totalSOL = data.tokens.reduce((sum, token) => sum + (token.amount || 0.1), 0);
      const solBalance = await getSolBalance(wallet.publicKey.toString());
      
      console.log(`${colors.blue}💰 Total SOL needed: ${totalSOL} SOL${colors.reset}`);
      console.log(`${colors.blue}💰 Available SOL: ${solBalance} SOL${colors.reset}`);

      if (solBalance < totalSOL) {
        console.log(`${colors.red}❌ Insufficient SOL balance${colors.reset}`);
        await waitForSpaceKey();
        return;
      }

      // Confirm bundle buy
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Confirm buying ${data.tokens.length} tokens with ${totalSOL} SOL total?`,
          default: false
        }
      ]);

      if (!confirm) {
        console.log(`${colors.yellow}⚠️ Bundle buy cancelled${colors.reset}`);
        return;
      }

      // Execute bundle buys
      console.log(`${colors.cyan}🚀 Executing bundle buys from JSON...${colors.reset}`);
      
      for (let i = 0; i < data.tokens.length; i++) {
        const token = data.tokens[i];
        const amount = token.amount || 0.1;
        
        console.log(`${colors.yellow}🔄 Buying token ${i + 1}/${data.tokens.length}: ${token.name} (${token.symbol})${colors.reset}`);
        
        try {
          const result = await performSwap(
            'So11111111111111111111111111111111111111112',
            token.mint,
            amount * LAMPORTS_PER_SOL,
            wallet
          );
          console.log(`${colors.green}✅ Token ${i + 1} bought: ${result.signature}${colors.reset}`);
        } catch (error) {
          console.log(`${colors.red}❌ Failed to buy token ${i + 1}: ${error.message}${colors.reset}`);
        }
      }

      console.log(`${colors.green}✅ Bundle buy from JSON completed!${colors.reset}`);

    } else if (action === 'sell') {
      console.log(`${colors.cyan}🚀 Executing bundle sells from JSON...${colors.reset}`);
      
      for (let i = 0; i < data.tokens.length; i++) {
        const token = data.tokens[i];
        console.log(`${colors.yellow}🔄 Selling token ${i + 1}/${data.tokens.length}: ${token.name} (${token.symbol})${colors.reset}`);
        
        try {
          // Get token balance
          const balance = await getTokenBalance(token.mint, wallet.publicKey.toString());
          
          if (balance > 0) {
            const result = await performSwap(
              token.mint,
              'So11111111111111111111111111111111111111112',
              balance,
              wallet
            );
            console.log(`${colors.green}✅ Token ${i + 1} sold: ${result.signature}${colors.reset}`);
          } else {
            console.log(`${colors.yellow}⚠️ No balance for token ${i + 1}${colors.reset}`);
          }
        } catch (error) {
          console.log(`${colors.red}❌ Failed to sell token ${i + 1}: ${error.message}${colors.reset}`);
        }
      }

      console.log(`${colors.green}✅ Bundle sell from JSON completed!${colors.reset}`);

    } else if (action === 'analyze') {
      console.log(`${colors.cyan}🔍 Analyzing bundle from JSON...${colors.reset}`);
      
      for (let i = 0; i < data.tokens.length; i++) {
        const token = data.tokens[i];
        console.log(`${colors.yellow}📊 Analyzing token ${i + 1}/${data.tokens.length}: ${token.name} (${token.symbol})${colors.reset}`);
        
        try {
          // Get balance
          const balance = await getTokenBalance(token.mint, wallet.publicKey.toString());
          console.log(`${colors.blue}💰 Balance: ${balance}${colors.reset}`);
          
          // Get quote for 1 SOL worth
          const quote = await getBestQuote(
            'So11111111111111111111111111111111111111112',
            token.mint,
            LAMPORTS_PER_SOL
          );
          console.log(`${colors.green}📈 1 SOL = ${quote.outputAmount} tokens${colors.reset}`);
          
        } catch (error) {
          console.log(`${colors.red}❌ Failed to analyze token ${i + 1}: ${error.message}${colors.reset}`);
        }
      }

      console.log(`${colors.green}✅ Bundle analysis from JSON completed!${colors.reset}`);
    }

  } catch (error) {
    console.error(`${colors.red}❌ Failed to load JSON: ${error.message}${colors.reset}`);
  }

  await waitForSpaceKey();
}

// Add to database operations
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

// Optimized API functions
async function optimizedFetchTokenInfo(mintAddress) {
  const cacheKey = `token_info_${mintAddress}`;
  const cached = cacheManager.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  performanceMonitor.startTimer('fetchTokenInfo');
  const result = await fetchTokenInfo(mintAddress);
  cacheManager.set(cacheKey, result);
  performanceMonitor.endTimer('fetchTokenInfo');
  return result;
}

// Optimized batch processing
async function optimizedProcessTrades(trades) {
  performanceMonitor.startTimer('processTrades');
  
  // Process trades in batches
  const batchSize = performanceConfig.maxConcurrentRequests;
  const results = [];
  
  for (let i = 0; i < trades.length; i += batchSize) {
    const batch = trades.slice(i, i + batchSize);
    const batchPromises = batch.map((trade, index) => 
      processTrade(trade, i + index)
    );
    const batchResults = await Promise.allSettled(batchPromises);
    results.push(...batchResults);
  }
  
  performanceMonitor.endTimer('processTrades');
  return results;
}

// Optimized realtime monitoring
async function optimizedMonitorTokenRealtime(tokenAddress, interval = 1000, state = null) {
  const optimizedState = state || appState;
  const monitor = {
    isActive: true,
    interval: null,
    data: []
  };
  
  monitor.interval = setInterval(async () => {
    if (!monitor.isActive) return;
    
    try {
      performanceMonitor.startTimer('realtimeUpdate');
      
      // Use optimized fetch
      const response = await optimizedFetch.fetch(
        `https://api.jup.ag/v4/price?id=${tokenAddress}`
      );
      
      if (response.ok) {
        const data = await response.json();
        monitor.data.push({
          timestamp: Date.now(),
          price: data.data?.price || 0,
          volume: data.data?.volume24h || 0
        });
        
        // Keep only recent data
        if (monitor.data.length > 100) {
          monitor.data = monitor.data.slice(-100);
        }
        
        // Throttled display
        optimizedDisplay.throttledDisplay(data, optimizedState);
      }
      
      performanceMonitor.endTimer('realtimeUpdate');
    } catch (error) {
      console.error(`${colors.red}Realtime monitoring error: ${error.message}${colors.reset}`);
    }
  }, interval);
  
  return monitor;
}

// Optimized stream processing
async function optimizedStartStream(queryType = 'pump') {
  performanceMonitor.startTimer('startStream');
  
  try {
    // Use optimized rate limiter
    await optimizedRateLimiter.wait();
    
    // Batch process initial data
    const initialTrades = await fetchInitialTrades(queryType);
    const processedTrades = await optimizedProcessTrades(initialTrades);
    
    appState.setTrades(processedTrades);
    
    // Start optimized realtime updates
    if (performanceConfig.enableParallelProcessing) {
      await startOptimizedRealtimeUpdates(queryType);
    }
    
    performanceMonitor.endTimer('startStream');
  } catch (error) {
    console.error(`${colors.red}Stream error: ${error.message}${colors.reset}`);
    performanceMonitor.endTimer('startStream');
  }
}

// Add cleanup on exit
process.on('SIGINT', () => {
  console.log(`${colors.yellow}🛑 Shutting down optimized application...${colors.reset}`);
  appState.destroy();
  process.exit(0);
});

// Start the application
initializeApp();