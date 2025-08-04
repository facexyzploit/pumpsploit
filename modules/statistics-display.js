import { colors } from '../colors.js';
import * as fs from 'fs';

// Enhanced statistics display
export class StatisticsDisplay {
  constructor(state) {
    this.state = state;
    this.stats = {
      totalTrades: 0,
      uniqueTokens: new Set(),
      totalVolume: 0,
      averagePrice: 0,
      topTokens: [],
      recentActivity: [],
      performanceMetrics: {}
    };
  }

  // Update statistics from current state
  updateStats() {
    const trades = this.state.trades || [];
    
    this.stats.totalTrades = trades.length;
    this.stats.uniqueTokens.clear();
    this.stats.totalVolume = 0;
    this.stats.topTokens = [];
    this.stats.recentActivity = [];
    
    const tokenStats = {};
    
    trades.forEach(trade => {
      const token = trade.Trade.Buy.Currency;
      const volume = trade.Sell.AmountInUSD || 0;
      
      // Count unique tokens
      this.stats.uniqueTokens.add(token.MintAddress);
      
      // Calculate total volume
      this.stats.totalVolume += volume;
      
      // Track token statistics
      if (!tokenStats[token.MintAddress]) {
        tokenStats[token.MintAddress] = {
          symbol: token.Symbol,
          name: token.Name,
          volume: 0,
          trades: 0,
          avgPrice: 0,
          lastPrice: trade.Buy.Price,
          lastUpdate: trade.Block.Time
        };
      }
      
      tokenStats[token.MintAddress].volume += volume;
      tokenStats[token.MintAddress].trades += 1;
      tokenStats[token.MintAddress].lastPrice = trade.Buy.Price;
      tokenStats[token.MintAddress].lastUpdate = trade.Block.Time;
    });
    
    // Calculate average price and top tokens
    this.stats.topTokens = Object.values(tokenStats)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 10);
    
    // Recent activity (last 10 trades)
    this.stats.recentActivity = trades.slice(-10).reverse();
    
    // Calculate performance metrics
    this.calculatePerformanceMetrics();
  }

  // Display main statistics dashboard
  displayDashboard() {
    this.updateStats();
    
    console.log(`\n${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}📊 REAL-TIME STATISTICS DASHBOARD${colors.reset}`);
    console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}\n`);
    
    // Overview metrics
    this.displayOverviewMetrics();
    
    // Top tokens
    this.displayTopTokens();
    
    // Recent activity
    this.displayRecentActivity();
    
    // Performance metrics
    this.displayPerformanceMetrics();
    
    console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}\n`);
  }

  // Display overview metrics
  displayOverviewMetrics() {
    console.log(`${colors.yellow}📈 OVERVIEW METRICS${colors.reset}`);
    console.log(`${colors.cyan}${'─'.repeat(40)}${colors.reset}`);
    
    const avgVolume = this.stats.totalTrades > 0 ? this.stats.totalVolume / this.stats.totalTrades : 0;
    
    console.log(`Total Trades: ${colors.green}${this.stats.totalTrades.toLocaleString()}${colors.reset}`);
    console.log(`Unique Tokens: ${colors.blue}${this.stats.uniqueTokens.size}${colors.reset}`);
    console.log(`Total Volume: ${colors.green}$${this.stats.totalVolume.toLocaleString()}${colors.reset}`);
    console.log(`Average Trade Volume: ${colors.green}$${avgVolume.toLocaleString()}${colors.reset}`);
    console.log(`Session Duration: ${this.formatDuration(Date.now() - this.state.sessionStartTime)}\n`);
  }

  // Display top tokens by volume
  displayTopTokens() {
    if (this.stats.topTokens.length === 0) return;
    
    console.log(`${colors.yellow}🏆 TOP TOKENS BY VOLUME${colors.reset}`);
    console.log(`${colors.cyan}${'─'.repeat(40)}${colors.reset}`);
    
    this.stats.topTokens.slice(0, 5).forEach((token, index) => {
      const rank = index + 1;
      const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      
      console.log(`${rankIcon} ${colors.bright}${token.symbol}${colors.reset} (${token.name})`);
      console.log(`   Volume: ${colors.green}$${token.volume.toLocaleString()}${colors.reset}`);
      console.log(`   Trades: ${colors.blue}${token.trades}${colors.reset}`);
      console.log(`   Last Price: ${colors.yellow}$${token.lastPrice}${colors.reset}`);
      console.log(`   Last Update: ${this.formatTimeAgo(token.lastUpdate)}\n`);
    });
  }

  // Display recent activity
  displayRecentActivity() {
    if (this.stats.recentActivity.length === 0) return;
    
    console.log(`${colors.yellow}🕒 RECENT ACTIVITY${colors.reset}`);
    console.log(`${colors.cyan}${'─'.repeat(40)}${colors.reset}`);
    
    this.stats.recentActivity.slice(0, 5).forEach(trade => {
      const token = trade.Trade.Buy.Currency;
      const volume = trade.Sell.AmountInUSD || 0;
      const timeAgo = this.formatTimeAgo(trade.Block.Time);
      
      console.log(`• ${colors.bright}${token.Symbol}${colors.reset} - $${volume.toLocaleString()} (${timeAgo})`);
    });
    console.log('');
  }

  // Display performance metrics
  displayPerformanceMetrics() {
    console.log(`${colors.yellow}⚡ PERFORMANCE METRICS${colors.reset}`);
    console.log(`${colors.cyan}${'─'.repeat(40)}${colors.reset}`);
    
    const metrics = this.stats.performanceMetrics;
    
    console.log(`Trades per Minute: ${colors.green}${metrics.tradesPerMinute || 0}${colors.reset}`);
    console.log(`Volume per Minute: ${colors.green}$${metrics.volumePerMinute || 0}${colors.reset}`);
    console.log(`Average Response Time: ${colors.blue}${metrics.avgResponseTime || 0}ms${colors.reset}`);
    console.log(`Success Rate: ${colors.green}${metrics.successRate || 100}%${colors.reset}`);
    console.log(`Error Rate: ${colors.red}${metrics.errorRate || 0}%${colors.reset}\n`);
  }

  // Display detailed token analysis
  displayTokenAnalysis(tokenAddress) {
    const trades = this.state.trades.filter(t => 
      t.Trade.Buy.Currency.MintAddress === tokenAddress
    );
    
    if (trades.length === 0) {
      console.log(`${colors.red}❌ No trades found for this token${colors.reset}`);
      return;
    }
    
    const token = trades[0].Trade.Buy.Currency;
    const totalVolume = trades.reduce((sum, t) => sum + (t.Sell.AmountInUSD || 0), 0);
    const avgPrice = trades.reduce((sum, t) => sum + t.Buy.Price, 0) / trades.length;
    const priceChange = this.calculatePriceChange(trades);
    
    console.log(`\n${colors.cyan}${'═'.repeat(50)}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}🔍 TOKEN ANALYSIS: ${token.Symbol}${colors.reset}`);
    console.log(`${colors.cyan}${'═'.repeat(50)}${colors.reset}\n`);
    
    console.log(`${colors.yellow}Token Information:${colors.reset}`);
    console.log(`  Symbol: ${colors.green}${token.Symbol}${colors.reset}`);
    console.log(`  Name: ${token.Name}`);
    console.log(`  Address: ${token.MintAddress}`);
    console.log(`  Decimals: ${token.Decimals}\n`);
    
    console.log(`${colors.yellow}Trading Statistics:${colors.reset}`);
    console.log(`  Total Trades: ${colors.blue}${trades.length}${colors.reset}`);
    console.log(`  Total Volume: ${colors.green}$${totalVolume.toLocaleString()}${colors.reset}`);
    console.log(`  Average Price: ${colors.yellow}$${avgPrice.toFixed(9)}${colors.reset}`);
    console.log(`  Price Change: ${this.getPriceChangeColor(priceChange)}${priceChange}%${colors.reset}\n`);
    
    console.log(`${colors.yellow}Recent Trades:${colors.reset}`);
    trades.slice(-5).reverse().forEach((trade, index) => {
      const volume = trade.Sell.AmountInUSD || 0;
      const timeAgo = this.formatTimeAgo(trade.Block.Time);
      console.log(`  ${index + 1}. $${volume.toLocaleString()} - ${timeAgo}`);
    });
    
    console.log(`\n${colors.cyan}${'═'.repeat(50)}${colors.reset}`);
  }

  // Display volume analysis
  displayVolumeAnalysis() {
    console.log(`\n${colors.cyan}📊 VOLUME ANALYSIS${colors.reset}`);
    console.log(`${colors.cyan}${'═'.repeat(40)}${colors.reset}\n`);
    
    const volumeRanges = {
      'High (>$10k)': 0,
      'Medium ($1k-$10k)': 0,
      'Low (<$1k)': 0
    };
    
    this.state.trades.forEach(trade => {
      const volume = trade.Sell.AmountInUSD || 0;
      if (volume > 10000) volumeRanges['High (>$10k)']++;
      else if (volume > 1000) volumeRanges['Medium ($1k-$10k)']++;
      else volumeRanges['Low (<$1k)']++;
    });
    
    Object.entries(volumeRanges).forEach(([range, count]) => {
      const percentage = this.stats.totalTrades > 0 ? (count / this.stats.totalTrades * 100).toFixed(1) : 0;
      console.log(`${range}: ${colors.blue}${count}${colors.reset} trades (${percentage}%)`);
    });
    
    console.log('');
  }

  // Calculate performance metrics
  calculatePerformanceMetrics() {
    const now = Date.now();
    const sessionDuration = (now - this.state.sessionStartTime) / 1000 / 60; // minutes
    
    this.stats.performanceMetrics = {
      tradesPerMinute: sessionDuration > 0 ? this.stats.totalTrades / sessionDuration : 0,
      volumePerMinute: sessionDuration > 0 ? this.stats.totalVolume / sessionDuration : 0,
      avgResponseTime: 200, // Mock value
      successRate: 98, // Mock value
      errorRate: 2 // Mock value
    };
  }

  // Calculate price change
  calculatePriceChange(trades) {
    if (trades.length < 2) return 0;
    
    const firstPrice = trades[0].Trade.Buy.Price;
    const lastPrice = trades[trades.length - 1].Trade.Buy.Price;
    
    return ((lastPrice - firstPrice) / firstPrice * 100).toFixed(2);
  }

  // Get color for price change
  getPriceChangeColor(change) {
    const numChange = parseFloat(change);
    if (numChange > 0) return colors.green;
    if (numChange < 0) return colors.red;
    return colors.gray;
  }

  // Format duration
  formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  // Format time ago
  formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - new Date(timestamp).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  }

  // Display real-time updates
  displayRealTimeUpdate(trade) {
    const token = trade.Trade.Buy.Currency;
    const volume = trade.Sell.AmountInUSD || 0;
    
    console.log(`\n${colors.green}🆕 NEW TRADE DETECTED${colors.reset}`);
    console.log(`${colors.cyan}${'─'.repeat(30)}${colors.reset}`);
    console.log(`Token: ${colors.bright}${token.Symbol}${colors.reset} (${token.Name})`);
    console.log(`Volume: ${colors.green}$${volume.toLocaleString()}${colors.reset}`);
    console.log(`Price: ${colors.yellow}$${trade.Trade.Buy.Price}${colors.reset}`);
    console.log(`DEX: ${colors.blue}${trade.Trade.Dex.ProtocolName}${colors.reset}`);
    console.log(`Time: ${this.formatTimeAgo(trade.Block.Time)}`);
    console.log(`${colors.cyan}${'─'.repeat(30)}${colors.reset}`);
  }

  // Export statistics to file
  exportStats(filename = 'statistics.json') {
    const data = {
      timestamp: new Date().toISOString(),
      statistics: this.stats,
      sessionDuration: Date.now() - this.state.sessionStartTime
    };
    
    try {
      fs.writeFileSync(filename, JSON.stringify(data, null, 2));
      console.log(`${colors.green}✅ Statistics exported to ${filename}${colors.reset}`);
    } catch (error) {
      console.log(`${colors.red}❌ Failed to export statistics: ${error.message}${colors.reset}`);
    }
  }
}

// Export singleton instance
export const statisticsDisplay = new StatisticsDisplay(); 