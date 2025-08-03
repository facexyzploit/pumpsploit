import { colors } from '../colors.js';
import clipboardy from 'clipboardy';
import { exec } from 'child_process';

// Quick actions configuration
export const QUICK_ACTIONS = {
  '1': { name: 'Copy Address', action: 'copyAddress', color: colors.cyan },
  '2': { name: 'Jupiter Analysis', action: 'jupiterAnalysis', color: colors.green },
  '3': { name: 'Birdeye Chart', action: 'openBirdeye', color: colors.blue },
  '4': { name: 'GMGN Chart', action: 'openGMGN', color: colors.purple },
  '5': { name: 'Trade Details', action: 'showTradeDetails', color: colors.yellow },
  '6': { name: 'Price History', action: 'showPriceHistory', color: colors.magenta },
  '7': { name: 'Volume Analysis', action: 'showVolumeAnalysis', color: colors.orange },
  '8': { name: 'Liquidity Check', action: 'checkLiquidity', color: colors.red },
  '9': { name: 'Risk Assessment', action: 'assessRisk', color: colors.pink },
  '0': { name: 'Add to Watchlist', action: 'addToWatchlist', color: colors.gray }
};

// Navigation shortcuts
export const NAVIGATION_SHORTCUTS = {
  'up': 'Navigate up',
  'down': 'Navigate down', 
  'left': 'Navigate left',
  'right': 'Navigate right',
  'enter': 'Select item',
  'space': 'Pause/Resume',
  'escape': 'Go back'
};

// Menu shortcuts
export const MENU_SHORTCUTS = {
  'h': 'Help',
  'q': 'Quit',
  'r': 'Refresh',
  's': 'Status',
  'a': 'Analytics',
  'm': 'Main Menu',
  'c': 'Clear Screen'
};

export class QuickActionHandler {
  constructor(state, streamHandler) {
    this.state = state;
    this.streamHandler = streamHandler;
    this.watchlist = new Set();
  }

  // Copy token address to clipboard
  async copyAddress() {
    const currentTrade = this.state.getCurrentTrade();
    if (!currentTrade) {
      this.showError('No trade selected');
      return;
    }

    try {
      const address = currentTrade.Trade.Buy.Currency.MintAddress;
      await clipboardy.write(address);
      this.showSuccess(`Address copied: ${address}`);
    } catch (error) {
      this.showError(`Failed to copy address: ${error.message}`);
    }
  }

  // Run Jupiter analysis
  async jupiterAnalysis() {
    const currentTrade = this.state.getCurrentTrade();
    if (!currentTrade) {
      this.showError('No trade selected');
      return;
    }

    try {
      const address = currentTrade.Trade.Buy.Currency.MintAddress;
      const symbol = currentTrade.Trade.Buy.Currency.Symbol;
      
      this.showInfo(`Running Jupiter analysis for ${symbol}...`);
      
      // Import Jupiter analysis module
      // Jupiter analysis functions moved to ai-enhanced-analyzer.js
const { aiEnhancedAnalyzer } = await import('./ai-enhanced-analyzer.js');
              const analysis = await aiEnhancedAnalyzer.analyzeToken(address);
      
      this.displayJupiterAnalysis(analysis);
    } catch (error) {
      this.showError(`Jupiter analysis failed: ${error.message}`);
    }
  }

  // Open Birdeye chart
  async openBirdeye() {
    const currentTrade = this.state.getCurrentTrade();
    if (!currentTrade) {
      this.showError('No trade selected');
      return;
    }

    try {
      const address = currentTrade.Trade.Buy.Currency.MintAddress;
      const symbol = currentTrade.Trade.Buy.Currency.Symbol;
      const url = `https://birdeye.so/token/${address}`;
      
      this.showInfo(`Opening Birdeye chart for ${symbol}...`);
      
      // Open URL based on platform
      if (process.platform === 'win32') {
        exec(`start ${url}`);
      } else if (process.platform === 'darwin') {
        exec(`open ${url}`);
      } else {
        exec(`xdg-open ${url}`);
      }
      
      this.showSuccess(`Birdeye chart opened: ${url}`);
    } catch (error) {
      this.showError(`Failed to open Birdeye: ${error.message}`);
    }
  }

  // Open GMGN chart
  async openGMGN() {
    const currentTrade = this.state.getCurrentTrade();
    if (!currentTrade) {
      this.showError('No trade selected');
      return;
    }

    try {
      const address = currentTrade.Trade.Buy.Currency.MintAddress;
      const symbol = currentTrade.Trade.Buy.Currency.Symbol;
      const url = `https://gmgn.ai/token/${address}`;
      
      this.showInfo(`Opening GMGN chart for ${symbol}...`);
      
      // Open URL based on platform
      if (process.platform === 'win32') {
        exec(`start ${url}`);
      } else if (process.platform === 'darwin') {
        exec(`open ${url}`);
      } else {
        exec(`xdg-open ${url}`);
      }
      
      this.showSuccess(`GMGN chart opened: ${url}`);
    } catch (error) {
      this.showError(`Failed to open GMGN: ${error.message}`);
    }
  }

  // Show detailed trade information
  showTradeDetails() {
    const currentTrade = this.state.getCurrentTrade();
    if (!currentTrade) {
      this.showError('No trade selected');
      return;
    }

    const trade = currentTrade.Trade;
    const currency = trade.Buy.Currency;
    
    console.log(`\n${colors.cyan}${'═'.repeat(50)}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}📋 TRADE DETAILS${colors.reset}`);
    console.log(`${colors.cyan}${'═'.repeat(50)}${colors.reset}\n`);
    
    console.log(`${colors.yellow}Token Information:${colors.reset}`);
    console.log(`  Symbol: ${colors.green}${currency.Symbol}${colors.reset}`);
    console.log(`  Name: ${currency.Name}`);
    console.log(`  Address: ${currency.MintAddress}`);
    console.log(`  Decimals: ${currency.Decimals}\n`);
    
    console.log(`${colors.yellow}Trading Information:${colors.reset}`);
    console.log(`  Price: ${colors.green}$${trade.Buy.Price}${colors.reset}`);
    console.log(`  Price USD: ${colors.green}$${trade.Buy.PriceInUSD}${colors.reset}`);
    console.log(`  Amount: ${trade.Buy.Amount.toLocaleString()}`);
    console.log(`  Amount USD: ${colors.green}$${trade.Sell.AmountInUSD}${colors.reset}\n`);
    
    console.log(`${colors.yellow}Market Information:${colors.reset}`);
    console.log(`  DEX: ${colors.blue}${trade.Dex.ProtocolName}${colors.reset}`);
    console.log(`  Protocol Family: ${trade.Dex.ProtocolFamily}`);
    console.log(`  Market Address: ${trade.Market.MarketAddress}\n`);
    
    console.log(`${colors.yellow}Transaction Information:${colors.reset}`);
    console.log(`  Signature: ${currentTrade.Transaction.Signature}`);
    console.log(`  Block Time: ${new Date(currentTrade.Block.Time).toLocaleString()}\n`);
    
    console.log(`${colors.cyan}${'═'.repeat(50)}${colors.reset}`);
  }

  // Show price history chart
  showPriceHistory() {
    const currentTrade = this.state.getCurrentTrade();
    if (!currentTrade) {
      this.showError('No trade selected');
      return;
    }

    console.log(`\n${colors.cyan}📈 Price History for ${currentTrade.Trade.Buy.Currency.Symbol}${colors.reset}`);
    // Implement price history display
    this.showInfo('Price history feature coming soon...');
  }

  // Show volume analysis
  showVolumeAnalysis() {
    const currentTrade = this.state.getCurrentTrade();
    if (!currentTrade) {
      this.showError('No trade selected');
      return;
    }

    console.log(`\n${colors.cyan}📊 Volume Analysis for ${currentTrade.Trade.Buy.Currency.Symbol}${colors.reset}`);
    // Implement volume analysis
    this.showInfo('Volume analysis feature coming soon...');
  }

  // Check liquidity
  async checkLiquidity() {
    const currentTrade = this.state.getCurrentTrade();
    if (!currentTrade) {
      this.showError('No trade selected');
      return;
    }

    try {
      const address = currentTrade.Trade.Buy.Currency.MintAddress;
      const symbol = currentTrade.Trade.Buy.Currency.Symbol;
      
      this.showInfo(`Checking liquidity for ${symbol}...`);
      
      // Implement liquidity check
      const liquidity = await this.fetchLiquidity(address);
      
      console.log(`\n${colors.cyan}💧 Liquidity Check for ${symbol}${colors.reset}`);
      console.log(`  Total Liquidity: $${liquidity.total.toLocaleString()}`);
      console.log(`  Available Liquidity: $${liquidity.available.toLocaleString()}`);
      console.log(`  Liquidity Score: ${liquidity.score}/10`);
      
    } catch (error) {
      this.showError(`Liquidity check failed: ${error.message}`);
    }
  }

  // Assess risk
  async assessRisk() {
    const currentTrade = this.state.getCurrentTrade();
    if (!currentTrade) {
      this.showError('No trade selected');
      return;
    }

    try {
      const address = currentTrade.Trade.Buy.Currency.MintAddress;
      const symbol = currentTrade.Trade.Buy.Currency.Symbol;
      
      this.showInfo(`Assessing risk for ${symbol}...`);
      
      // Implement risk assessment
      const risk = await this.calculateRisk(address);
      
      console.log(`\n${colors.cyan}⚠️  Risk Assessment for ${symbol}${colors.reset}`);
      console.log(`  Risk Level: ${this.getRiskColor(risk.level)}${risk.level}${colors.reset}`);
      console.log(`  Risk Score: ${risk.score}/100`);
      console.log(`  Factors: ${risk.factors.join(', ')}`);
      
    } catch (error) {
      this.showError(`Risk assessment failed: ${error.message}`);
    }
  }

  // Add to watchlist
  addToWatchlist() {
    const currentTrade = this.state.getCurrentTrade();
    if (!currentTrade) {
      this.showError('No trade selected');
      return;
    }

    const address = currentTrade.Trade.Buy.Currency.MintAddress;
    const symbol = currentTrade.Trade.Buy.Currency.Symbol;
    
    if (this.watchlist.has(address)) {
      this.watchlist.delete(address);
      this.showSuccess(`${symbol} removed from watchlist`);
    } else {
      this.watchlist.add(address);
      this.showSuccess(`${symbol} added to watchlist`);
    }
  }

  // Display Jupiter analysis results
  displayJupiterAnalysis(analysis) {
    console.log(`\n${colors.green}🪐 Jupiter Analysis Results${colors.reset}`);
    console.log(`${colors.cyan}${'═'.repeat(50)}${colors.reset}\n`);
    
    if (analysis.success) {
      console.log(`${colors.yellow}Price Information:${colors.reset}`);
      console.log(`  Current Price: $${analysis.price}`);
      console.log(`  Price Change 24h: ${analysis.priceChange24h}%`);
      console.log(`  Market Cap: $${analysis.marketCap?.toLocaleString() || 'N/A'}\n`);
      
      console.log(`${colors.yellow}Liquidity Information:${colors.reset}`);
      console.log(`  Total Liquidity: $${analysis.liquidity?.toLocaleString() || 'N/A'}`);
      console.log(`  Available Liquidity: $${analysis.availableLiquidity?.toLocaleString() || 'N/A'}\n`);
      
      console.log(`${colors.yellow}Volume Information:${colors.reset}`);
      console.log(`  Volume 24h: $${analysis.volume24h?.toLocaleString() || 'N/A'}`);
      console.log(`  Volume Change 24h: ${analysis.volumeChange24h || 'N/A'}%\n`);
      
      if (analysis.safety) {
        console.log(`${colors.yellow}Safety Assessment:${colors.reset}`);
        console.log(`  Honeypot Risk: ${analysis.safety.honeypot ? 'High' : 'Low'}`);
        console.log(`  Rug Pull Risk: ${analysis.safety.rugPull ? 'High' : 'Low'}`);
        console.log(`  Overall Safety: ${analysis.safety.overall}/10\n`);
      }
    } else {
      console.log(`${colors.red}❌ Analysis failed: ${analysis.error}${colors.reset}\n`);
    }
    
    console.log(`${colors.cyan}${'═'.repeat(50)}${colors.reset}`);
  }

  // Helper methods
  showSuccess(message) {
    console.log(`\n${colors.green}✅ ${message}${colors.reset}`);
  }

  showError(message) {
    console.log(`\n${colors.red}❌ ${message}${colors.reset}`);
  }

  showInfo(message) {
    console.log(`\n${colors.blue}ℹ️  ${message}${colors.reset}`);
  }

  getRiskColor(level) {
    switch (level.toLowerCase()) {
      case 'low': return colors.green;
      case 'medium': return colors.yellow;
      case 'high': return colors.red;
      default: return colors.gray;
    }
  }

  // Mock methods for future implementation
  async fetchLiquidity(address) {
    // Mock implementation
    return {
      total: 50000,
      available: 25000,
      score: 7
    };
  }

  async calculateRisk(address) {
    // Mock implementation
    return {
      level: 'Medium',
      score: 65,
      factors: ['Low liquidity', 'New token', 'High volatility']
    };
  }
}

// Export singleton instance
export const quickActions = new QuickActionHandler(); 