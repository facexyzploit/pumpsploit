import { colors } from './colors.js';
import { formatNumber, getTimeDiff } from './utils.js';

// Base template that all modes will extend
const baseTemplate = {
  header: (trade, state) => `
${colors.cyan}Token ${state.currentTokenIndex + 1} of ${state.trades.length}${colors.reset}
${colors.dim}Use W/S to navigate between tokens (press H for help)${colors.reset}`,

  tokenDetails: (trade) => `
${colors.yellow}📝 Token Details:${colors.reset}
${colors.white}Name:${colors.reset} ${colors.green}${trade.Trade.Buy.Currency.Name}${colors.reset}
${colors.white}Symbol:${colors.reset} ${colors.green}${trade.Trade.Buy.Currency.Symbol}${colors.reset}
${colors.white}Address:${colors.reset} ${colors.yellow}${trade.Trade.Buy.Currency.MintAddress}${colors.reset}
${colors.white}Decimals:${colors.reset} ${colors.cyan}${trade.Trade.Buy.Currency.Decimals}${colors.reset}
${colors.white}Fungible:${colors.reset} ${trade.Trade.Buy.Currency.Fungible ? colors.green + '✓ Yes' : colors.red + '✗ No'}${colors.reset}
${colors.white}URI:${colors.reset} ${colors.dim}${trade.Trade.Buy.Currency.Uri || 'N/A'}${colors.reset}`,

  transactionDetails: (trade) => `
${colors.yellow}📊 Transaction Details:${colors.reset}
${colors.white}Signature:${colors.reset} ${colors.dim}${trade.Transaction.Signature}${colors.reset}
${colors.white}Time:${colors.reset} ${colors.cyan}${new Date(trade.Block.Time).toISOString()}${colors.reset} (${colors.green}${getTimeDiff(trade.Block.Time)}${colors.reset})`,

  links: (trade) => `
${colors.yellow}🔗 Useful Links:${colors.reset}
${colors.blue}• Solscan:${colors.reset} https://solscan.io/token/${trade.Trade.Buy.Currency.MintAddress}
${colors.blue}• GMGN.io:${colors.reset} https://gmgn.ai/sol/token/${trade.Trade.Buy.Currency.MintAddress}`
};

// Template for pump detection mode
const pumpTemplate = {
  tradeInfo: (trade) => `
${colors.yellow}💰 Trade Information:${colors.reset}
${colors.white}Buy Amount:${colors.reset} ${colors.green}${formatNumber(trade.Trade.Buy.Amount)} ${trade.Trade.Buy.Currency.Symbol}${colors.reset}
${colors.white}Price USD:${colors.reset} ${colors.green}$${formatNumber(trade.Trade.Buy.PriceInUSD)}${colors.reset}
${colors.white}Price SOL:${colors.reset} ${colors.green}${formatNumber(trade.Trade.Buy.Price)} SOL${colors.reset}
${colors.white}Total Value:${colors.reset} ${colors.magenta}$${formatNumber(trade.Trade.Sell.AmountInUSD)}${colors.reset}`,

  marketInfo: (trade) => `
${colors.yellow}🏦 Market Information:${colors.reset}
${colors.white}DEX Protocol:${colors.reset} ${colors.magenta}${trade.Trade.Dex.ProtocolName}${colors.reset}
${colors.white}DEX Family:${colors.reset} ${colors.magenta}${trade.Trade.Dex.ProtocolFamily}${colors.reset}
${colors.white}Market Address:${colors.reset} ${colors.yellow}${trade.Trade.Market.MarketAddress}${colors.reset}`
};

// Template for graduated mode (pool data)
const graduatedTemplate = {
  tokenDetails: (trade) => `
${colors.yellow}📝 Token Details:${colors.reset}
${colors.white}Name:${colors.reset} ${colors.green}${trade.Pool.Market.BaseCurrency.Name}${colors.reset}
${colors.white}Symbol:${colors.reset} ${colors.green}${trade.Pool.Market.BaseCurrency.Symbol}${colors.reset}
${colors.white}Address:${colors.reset} ${colors.yellow}${trade.Pool.Market.BaseCurrency.MintAddress}${colors.reset}
${colors.white}Decimals:${colors.reset} ${colors.cyan}${trade.Pool.Market.BaseCurrency.Decimals}${colors.reset}
${colors.white}Fungible:${colors.reset} ${trade.Pool.Market.BaseCurrency.Fungible ? colors.green + '✓ Yes' : colors.red + '✗ No'}${colors.reset}
${colors.white}URI:${colors.reset} ${colors.dim}${trade.Pool.Market.BaseCurrency.Uri || 'N/A'}${colors.reset}`,

  poolInfo: (trade) => `
${colors.yellow}🏊 Pool Information:${colors.reset}
${colors.white}Base Token:${colors.reset} ${colors.green}${trade.Pool.Market.BaseCurrency.Symbol}${colors.reset}
${colors.white}Quote Token:${colors.reset} ${colors.green}${trade.Pool.Market.QuoteCurrency.Symbol}${colors.reset}
${colors.white}Base Balance:${colors.reset} ${colors.yellow}${formatNumber(trade.Pool.Base.Balance)}${colors.reset}
${colors.white}Quote Amount:${colors.reset} ${colors.yellow}${formatNumber(trade.Pool.Quote.PostAmount)}${colors.reset}
${colors.white}Quote Price USD:${colors.reset} ${colors.yellow}$${formatNumber(trade.Pool.Quote.PriceInUSD)}${colors.reset}
${colors.white}Bonding Curve Progress:${colors.reset} ${colors.magenta}${formatNumber(trade.Bonding_Curve_Progress_percentage)}%${colors.reset}`,

  marketInfo: (trade) => `
${colors.yellow}🏦 Market Information:${colors.reset}
${colors.white}DEX Protocol:${colors.reset} ${colors.magenta}${trade.Pool.Dex.ProtocolName}${colors.reset}
${colors.white}DEX Family:${colors.reset} ${colors.magenta}${trade.Pool.Dex.ProtocolFamily}${colors.reset}
${colors.white}Market Address:${colors.reset} ${colors.yellow}${trade.Pool.Market.MarketAddress}${colors.reset}`,

  links: (trade) => `
${colors.yellow}🔗 Useful Links:${colors.reset}
${colors.blue}• Solscan:${colors.reset} https://solscan.io/token/${trade.Pool.Market.BaseCurrency.MintAddress}
${colors.blue}• GMGN.io:${colors.reset} https://gmgn.ai/sol/token/${trade.Pool.Market.BaseCurrency.MintAddress}`
};

// Add helper function for large number formatting
function formatLargeNumber(num) {
  if (!num || num === 0) return '0';
  
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(2)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(2)}K`;
  }
  if (num < 0.00001) {
    return num.toExponential(2);
  }
  return formatNumber(num);
}

// Update price change calculator
function calculatePriceChanges(prices, times) {
  if (prices.length < 2) return {};
  
  const currentPrice = prices[prices.length - 1];
  const currentTime = new Date(times[times.length - 1]);
  
  const intervals = {
    '30s': 30 * 1000,
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '30m': 30 * 60 * 1000
  };

  const changes = {};
  
  for (const [label, ms] of Object.entries(intervals)) {
    const targetTime = new Date(currentTime - ms);
    let foundIndex = -1;
    
    // Find the closest price to the target time
    for (let i = times.length - 1; i >= 0; i--) {
      if (new Date(times[i]) <= targetTime) {
        foundIndex = i;
        break;
      }
    }
    
    // Skip if no data for this interval
    if (foundIndex === -1) continue;
    
    const oldPrice = prices[foundIndex];
    const change = ((currentPrice - oldPrice) / oldPrice * 100);
    
    changes[label] = change.toFixed(2);
  }
  
  return changes;
}

// Add state for real-time updates
let isRealtimeEnabled = false;
let updateInterval = null;

// Function to toggle real-time updates
export function toggleRealtime(appState) {
  isRealtimeEnabled = !isRealtimeEnabled;
  
  if (isRealtimeEnabled) {
    // Start auto-updates every 1 second
    updateInterval = setInterval(() => {
      if (appState && appState.updatePriceHistory) {
        appState.updatePriceHistory();
        appState.displayTrade(appState.currentTokenIndex);
      }
    }, 1000); // Changed from 2000 to 1000 for 1-second updates
    return `${colors.green}Realtime updates enabled (1s)${colors.reset}`;
  } else {
    // Stop auto-updates
    if (updateInterval) {
      clearInterval(updateInterval);
      updateInterval = null;
    }
    return `${colors.red}Realtime updates disabled${colors.reset}`;
  }
}

// Export realtime state
export function isRealtimeActive() {
  return isRealtimeEnabled;
}

// Function to combine templates based on mode
export function getDisplayTemplate(mode = 'pump') {
  return (trade, state) => {
    let output = '';
    
    // Add header with realtime status
    output += baseTemplate.header(trade, state);
    
    // Show Jupiter real-time status
    const jupiterStatus = state.isJupiterRealtimeActive ? 
      `${colors.green}🔄 Jupiter Realtime [ON]${colors.reset}` : 
      `${colors.red}⏸️ Jupiter Realtime [OFF]${colors.reset}`;
    output += `${colors.dim}Press 'E' to toggle Jupiter realtime updates ${jupiterStatus}${colors.reset}\n`;
    
    if (mode === 'graduated') {
      // Use graduated template for pool data
      output += graduatedTemplate.tokenDetails(trade);
      
      // Add Jupiter real-time data if active
      if (state.isJupiterRealtimeActive && state.jupiterRealtimeData) {
        output += displayJupiterRealtimeData(state.jupiterRealtimeData);
      }
      
      // Add pool information
      output += graduatedTemplate.poolInfo(trade);
      
      // Add market info
      output += graduatedTemplate.marketInfo(trade);
      
      // Add links
      output += graduatedTemplate.links(trade);
    } else {
      // Use default template for trade data
      output += baseTemplate.tokenDetails(trade);
      
      // Add Jupiter real-time data if active
      if (state.isJupiterRealtimeActive && state.jupiterRealtimeData) {
        output += displayJupiterRealtimeData(state.jupiterRealtimeData);
      }
      
      // Add mode-specific trade info
      output += pumpTemplate.tradeInfo(trade);
      
      // Add sparkline chart
      output += drawSparkline(state.priceHistory.prices, state.priceHistory.times);
      
      // Add market info
      output += pumpTemplate.marketInfo(trade);
      
      // Add transaction details
      output += baseTemplate.transactionDetails(trade);
      
      // Add links
      output += baseTemplate.links(trade);
    }
    
    return output;
  };
}

// Display Jupiter real-time data
function displayJupiterRealtimeData(data) {
  const { update, updateCount, timeChanges, roi, entryPrice, dumpTimer, holdIndicator, isStale } = data;
  let output = '\n';
  
  // Show stale data warning if applicable
  if (isStale) {
    output += `${colors.yellow}⚠️  STALE DATA - API connection issues${colors.reset}\n`;
  }
  
  output += `${colors.cyan}🔄 Jupiter Real-time Data (Update #${updateCount})${colors.reset}\n`;
  output += `${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`;
  
  if (update.price) {
    output += `${colors.green}💰 Current Price:${colors.reset} $${update.price.toFixed(6)}\n`;
  }
  
  // ROI Section
  if (entryPrice && roi !== undefined) {
    const roiColor = roi >= 0 ? colors.green : colors.red;
    const roiSymbol = roi >= 0 ? '📈' : '📉';
    output += `${colors.yellow}📊 ROI:${colors.reset} ${roiColor}${roiSymbol} ${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%${colors.reset}\n`;
    output += `${colors.dim}Entry Price: $${entryPrice.toFixed(6)}${colors.reset}\n`;
  }
  
  if (update.volume24h) {
    output += `${colors.blue}📊 24h Volume:${colors.reset} $${update.volume24h.toLocaleString()}\n`;
  }
  
  if (update.marketCap) {
    output += `${colors.magenta}🏦 Market Cap:${colors.reset} $${update.marketCap.toLocaleString()}\n`;
  }
  
  if (update.liquidity) {
    output += `${colors.cyan}💧 Liquidity:${colors.reset} $${update.liquidity.toLocaleString()}\n`;
  }
  
  // Dump Timer Section
  if (dumpTimer && dumpTimer.secondsLeft > 0) {
    const timerColor = dumpTimer.secondsLeft <= 10 ? colors.red : colors.yellow;
    const warningEmoji = dumpTimer.secondsLeft <= 10 ? '🚨' : '⚠️';
    output += `\n${timerColor}${warningEmoji} DUMP TIMER: ${dumpTimer.secondsLeft}s${colors.reset}\n`;
    output += `${colors.red}Price dropped 10% in 30s - Potential dump detected!${colors.reset}\n`;
  }
  
  // Hold Indicator Section
  if (holdIndicator) {
    const indicatorColors = {
      'Hold': colors.green,
      'Caution': colors.yellow,
      'Sell': colors.red
    };
    const indicatorEmojis = {
      'Hold': '💎',
      'Caution': '⚠️',
      'Sell': '📉'
    };
    const color = indicatorColors[holdIndicator.status] || colors.white;
    const emoji = indicatorEmojis[holdIndicator.status] || '❓';
    output += `\n${color}${emoji} HOLD INDICATOR: ${holdIndicator.status.toUpperCase()}${colors.reset}\n`;
    output += `${colors.dim}${holdIndicator.reason}${colors.reset}\n`;
  }
  
  // Display time-based changes
  output += `\n${colors.cyan}📊 Time-based Changes:${colors.reset}\n`;
  const timeLabels = ['15s', '30s', '1m', '5m'];
  timeLabels.forEach(label => {
    const change = timeChanges[label];
    if (change) {
      const changeColor = change.change >= 0 ? colors.green : colors.red;
      const changeSymbol = change.change >= 0 ? '↗' : '↘';
      const timeAgo = formatTimeAgo(change.timestamp);
      output += `${colors.yellow}${label}:${colors.reset} ${changeColor}${changeSymbol} ${change.change.toFixed(2)}%${colors.reset} (${timeAgo})\n`;
    } else {
      output += `${colors.yellow}${label}:${colors.reset} ${colors.gray}No data${colors.reset}\n`;
    }
  });
  
  output += '\n';
  return output;
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

// Format time range for display
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

// Sparkline chart helper
function drawSparkline(prices, times) {
  if (prices.length < 2) return '';
  
  const width = 40;
  const height = 6;
  
  if (prices.length < 2) return '';
  
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const currentPrice = prices[prices.length - 1];
  const priceChange = ((currentPrice - prices[0]) / prices[0] * 100).toFixed(2);
  const isPositive = priceChange >= 0;

  // Create sparkline
  let sparkline = '';
  sparkline += `${colors.white}Current: ${colors.yellow}$${formatNumber(currentPrice)}${colors.reset}`;
  sparkline += ` ${colors.gray}│${colors.reset} `;
  sparkline += `${colors.white}PnL: ${isPositive ? colors.green : colors.red}${priceChange}%${colors.reset}\n`;
  
  // Draw sparkline
  sparkline += `${colors.gray}┌${'─'.repeat(width + 2)}┐${colors.reset}\n`;
  
  for (let y = 0; y < height; y++) {
    sparkline += `${colors.gray}│ ${colors.reset}`;
    const level = max - (range * (y / (height - 1)));
    
    for (let x = 0; x < width; x++) {
      const index = Math.floor(x * prices.length / width);
      const price = prices[index];
      
      if (price >= level) {
        if (index > 0) {
          const isBuy = price >= prices[index - 1];
          const color = isBuy ? colors.green : colors.red;
          const symbol = isBuy ? '●' : '●';
          sparkline += `${color}${symbol}${colors.reset}`;
        } else {
          sparkline += `${colors.cyan}●${colors.reset}`;
        }
      } else {
        sparkline += ' ';
      }
    }
    sparkline += `${colors.gray} │${colors.reset}\n`;
  }
  
  sparkline += `${colors.gray}└${'─'.repeat(width + 2)}┘${colors.reset}\n`;
  
  // Add time info
  if (times.length >= 2) {
    const timeRange = formatTimeRange(times[0], times[times.length - 1]);
    sparkline += `${colors.dim}${prices.length} data points over ${timeRange}${colors.reset}\n`;
  }
  
  return sparkline;
} 