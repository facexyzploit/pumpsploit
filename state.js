import { colors } from './colors.js';
import { verifyTradeTime, formatNumber, getTimeDiff, PerformanceMonitor, CacheManager, OptimizedDisplay } from './utils.js';
import { logToFile } from './logger.js';
import { getTokenMetrics } from './queries.js';
import { getDisplayTemplate, toggleRealtime } from './templates.js';
import { stringifyQueryConfig } from './queries.js';
import fetch from 'cross-fetch';

class AppState {
  constructor() {
    this.currentTokenIndex = 0;
    this.trades = [];
    this.tradeChart = {
      maxPoints: 30,
      prices: [],
      times: []
    };
    this.priceHistory = {
      maxPoints: 30,
      prices: [],
      times: []
    };
    this.currentMode = 'pump';
    this.tokenMetrics = {
      volume: null,
      liquidity: null,
      marketcap: null
    };
    this.lastQueryTime = Date.now();
    this.isRealtimeEnabled = false;
    this.realtimeInterval = null;
    this.isJupiterRealtimeActive = false;
    this.jupiterRealtimeMonitor = null;
    this.jupiterRealtimeData = null;
    // Request options for BitQuery GraphQL.  The API token is read from the
    // BITQUERY_AUTH environment variable if provided; otherwise the
    // existing hard‑coded token is used for backwards compatibility.
    const authToken = process.env.BITQUERY_AUTH || 'ory_at_nutg85LqbmrfaWPH0ORrOrn3iFnoKkJTyGwaIxTlmck.C1NmThaMwOn4yRyTrzgIspyU_BfVfKxMrit8GPMCohA';
    this.requestOptions = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`
      }
    };
  }

  async toggleRealtime() {
    this.isRealtimeEnabled = !this.isRealtimeEnabled;
    
    if (this.isRealtimeEnabled) {
      // Clear existing cache
      this.tokenMetrics = {
        volume: null,
        liquidity: null,
        marketcap: null
      };
      
      // Start auto-refresh
      this.realtimeInterval = setInterval(async () => {
        try {
          const currentTrade = this.getCurrentTrade();
          if (currentTrade) {
            // Update token metrics
            await this.updateTokenMetrics(currentTrade.Trade.Buy.Currency.MintAddress);
            
            // Update trade data
            await this.updateCurrentTrade();
            
            // Update price history
            await this.updatePriceHistory();
            
            // Refresh display
            await this.displayTrade(this.currentTokenIndex);
          }
        } catch (error) {
          console.error(`${colors.red}Error in realtime update: ${error.message}${colors.reset}`);
        }
      }, 1000); // Update every second
      
      return `${colors.green}Realtime updates enabled - refreshing every second${colors.reset}`;
    } else {
      // Stop auto-refresh
      if (this.realtimeInterval) {
        clearInterval(this.realtimeInterval);
        this.realtimeInterval = null;
      }
      return `${colors.yellow}Realtime updates disabled${colors.reset}`;
    }
  }

  setJupiterRealtimeMonitor(monitor) {
    this.jupiterRealtimeMonitor = monitor;
    this.isJupiterRealtimeActive = true;
  }

  stopJupiterRealtime() {
    if (this.jupiterRealtimeMonitor) {
      this.jupiterRealtimeMonitor.stop();
      this.jupiterRealtimeMonitor = null;
    }
    this.isJupiterRealtimeActive = false;
    this.jupiterRealtimeData = null;
  }

  updateJupiterRealtimeData(data) {
    this.jupiterRealtimeData = data;
    
    // Update price history with Jupiter real-time data
    if (data.update && data.update.price) {
      this.priceHistory.prices.push(data.update.price);
      this.priceHistory.times.push(new Date());
      
      // Keep only last N points
      if (this.priceHistory.prices.length > this.priceHistory.maxPoints) {
        this.priceHistory.prices.shift();
        this.priceHistory.times.shift();
      }
    }
  }

  async updateCurrentTrade() {
    try {
      const currentTrade = this.getCurrentTrade();
      if (!currentTrade) return;

      const queryConfig = {
        query: `{
          Solana {
            DEXTrades(
              options: {limit: 1}
              where: {Trade: {Buy: {Currency: {MintAddress: {is: "${currentTrade.Trade.Buy.Currency.MintAddress}"}}}}}
            ) {
              Block {
                Time
              }
              Transaction {
                Signature
              }
              Trade {
                Buy {
                  Amount
                  Price
                  PriceInUSD
                  Currency {
                    Name
                    Symbol
                    MintAddress
                    Decimals
                    Fungible
                    Uri
                  }
                }
                Sell {
                  Amount
                  AmountInUSD
                }
                Dex {
                  ProtocolName
                  ProtocolFamily
                }
                Market {
                  MarketAddress
                }
              }
            }
          }
        }`
      };

      // Add timeout to prevent hanging requests
      const timeout = 5000; // 5 seconds
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch("https://streaming.bitquery.io/eap", {
        ...this.requestOptions,
        body: JSON.stringify(queryConfig),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const responseText = await response.text();
        if (responseText.includes('Account blocked')) {
          throw new Error('Account blocked');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result?.data?.Solana?.DEXTrades?.length) {
        return;
      }

      // Update current trade data
      const updatedTrade = result.data.Solana.DEXTrades[0];
      if (updatedTrade) {
        this.trades[this.currentTokenIndex] = updatedTrade;
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error(`${colors.red}Token update request timeout${colors.reset}`);
      } else if (error.message.includes('Account blocked')) {
        console.error(`${colors.red}BitQuery API account blocked. Please check your API key.${colors.reset}`);
      } else {
        console.error(`${colors.red}Error updating token: ${error.message}${colors.reset}`);
      }
    }
  }

  clearCharts() {
    this.tradeChart.prices = [];
    this.tradeChart.times = [];
    this.priceHistory.prices = [];
    this.priceHistory.times = [];
  }

  async displayTrade(index) {
    try {
      if (index >= 0 && index < this.trades.length) {
        this.currentTokenIndex = index;
        const trade = this.trades[index];
        
        // Validate data structure based on mode
        if (!trade) {
          console.error(`${colors.red}Missing trade data at index ${index}${colors.reset}`);
          return false;
        }
        
        if (this.currentMode === 'graduated') {
          // For graduated mode, we expect Pool structure without Block.Time
          if (!trade.Pool || !trade.Pool.Market || !trade.Pool.Market.BaseCurrency) {
            console.error(`${colors.red}Invalid pool structure at index ${index}${colors.reset}`);
            return false;
          }
        } else {
          // For other modes, we expect Block.Time
          if (!trade.Block || !trade.Block.Time) {
            console.error(`${colors.red}Missing Block.Time in data at index ${index}${colors.reset}`);
            return false;
          }
        }
        
        if (this.currentMode === 'pumpfunGraduated' || this.currentMode === 'pumpfunNewTokens') {
          // For pumpfun modes, validate instruction structure
          if (!trade.Instruction || !trade.Instruction.Program) {
            console.error(`${colors.red}Invalid instruction structure at index ${index}${colors.reset}`);
            return false;
          }
          
          console.clear();
          console.log(this.displayInstruction(trade, index));
          return true;
        } else if (this.currentMode === 'graduated') {
          // For graduated mode, validate pool structure
          if (!trade.Pool || !trade.Pool.Market || !trade.Pool.Market.BaseCurrency) {
            console.error(`${colors.red}Invalid pool structure at index ${index}${colors.reset}`);
            return false;
          }
          
          // For graduated mode, we don't update metrics or price history
          console.clear();
          const template = getDisplayTemplate(this.currentMode);
          console.log(template(trade, this));
          return true;
        } else {
          // For other modes, validate trade structure
          if (!trade.Trade || !trade.Trade.Buy || !trade.Trade.Buy.Currency) {
            console.error(`${colors.red}Invalid trade structure at index ${index}${colors.reset}`);
            return false;
          }
          
          // Update metrics before display (with timeout to prevent blocking)
          const metricsPromise = this.updateTokenMetrics(trade.Trade.Buy.Currency.MintAddress);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Metrics update timeout')), 5000)
          );
          
          try {
            await Promise.race([metricsPromise, timeoutPromise]);
          } catch (error) {
            console.log(`${colors.yellow}Warning: Metrics update failed, continuing with display${colors.reset}`);
          }
          
          // Update price history with safe access
          const price = trade.Trade.Buy.PriceInUSD || 0;
          const time = trade.Block.Time;
          
          this.priceHistory.prices.push(price);
          this.priceHistory.times.push(time);
          
          // Check price alerts (non-blocking)
          if (typeof global.priceAlerts !== 'undefined') {
            global.priceAlerts.checkAlerts(price, trade.Trade.Buy.Currency.MintAddress)
              .catch(error => console.log(`${colors.yellow}Price alert check failed: ${error.message}${colors.reset}`));
          }
          
          // Keep only last N points
          if (this.priceHistory.prices.length > this.priceHistory.maxPoints) {
            this.priceHistory.prices.shift();
            this.priceHistory.times.shift();
          }
          
          console.clear();
          const template = getDisplayTemplate(this.currentMode);
          console.log(template(trade, this));
        }

        // Log token details for trade modes (non-blocking)
        if (this.currentMode !== 'pumpfunGraduated' && this.currentMode !== 'pumpfunNewTokens' && this.currentMode !== 'graduated') {
          const logEntry = [
            `Time: ${new Date(trade.Block.Time).toISOString()}`,
            `Name: ${trade.Trade?.Buy?.Currency?.Name || 'N/A'}`,
            `Symbol: ${trade.Trade?.Buy?.Currency?.Symbol || 'N/A'}`,
            `Address: ${trade.Trade?.Buy?.Currency?.MintAddress || 'N/A'}`,
            `Price USD: $${trade.Trade?.Buy?.PriceInUSD || 'N/A'}`,
            `Jupiter Price: $${this.tokenMetrics.jupPrice || 'N/A'}`,
            `Volume 24h: $${this.tokenMetrics.jupVolume24h || 'N/A'}`,
            `Liquidity: $${this.tokenMetrics.jupLiquidity || 'N/A'}`
          ].join(' | ');
          
          // Log asynchronously to prevent blocking
          setImmediate(() => {
            try {
              logToFile(logEntry, 'tokens');
            } catch (error) {
              console.log(`${colors.yellow}Logging failed: ${error.message}${colors.reset}`);
            }
          });
        }

        return true;
      }
      return false;
    } catch (error) {
      console.error(`${colors.red}Error displaying trade: ${error.message}${colors.reset}`);
      return false;
    }
  }

  async processTrade(trade, index) {
    try {
      // Clear console before showing new token
      console.clear();
      
      // Show position indicator
      console.log(`${colors.cyan}Token ${index + 1} of ${this.getTradesCount()}${colors.reset}`);
      console.log(`${colors.gray}Use W/S to navigate between tokens${colors.reset}\n`);

      const buyToken = trade?.Trade?.Buy?.Currency;
      const sellToken = trade?.Trade?.Sell?.Currency;
      const dex = trade?.Trade?.Dex;
      const market = trade?.Trade?.Market;
      const block = trade?.Block;
      const transaction = trade?.Transaction;

      if (!buyToken || !sellToken) {
        const errorMsg = `Invalid trade data structure for trade ${index + 1}`;
        console.error(`${colors.red}${errorMsg}${colors.reset}`);
        logToFile(errorMsg, 'error');
        return;
      }

      // Enhanced token info display with Jupiter v6 data
      console.log(`${colors.cyan}📊 Token Information:${colors.reset}`);
      console.log(`Name: ${colors.green}${buyToken.Name || 'Unknown'}${colors.reset}`);
      console.log(`Symbol: ${colors.green}${buyToken.Symbol || 'Unknown'}${colors.reset}`);
      console.log(`Address: ${colors.yellow}${buyToken.MintAddress || 'Unknown'}${colors.reset}`);
      console.log(`Decimals: ${buyToken.Decimals || 'Unknown'}`);
      console.log(`Fungible: ${buyToken.Fungible ? colors.green + 'Yes' : colors.red + 'No'}${colors.reset}`);
      
      // Jupiter v6 enhanced data
      if (this.tokenMetrics.jupPrice) {
        console.log(`${colors.cyan}💰 Jupiter v6 Data:${colors.reset}`);
        console.log(`Price: ${colors.green}$${this.tokenMetrics.jupPrice.toFixed(9)}${colors.reset}`);
        if (this.tokenMetrics.jupPriceChange24h !== null) {
          const changeColor = this.tokenMetrics.jupPriceChange24h >= 0 ? colors.green : colors.red;
          const changeSign = this.tokenMetrics.jupPriceChange24h >= 0 ? '+' : '';
          console.log(`24h Change: ${changeColor}${changeSign}${this.tokenMetrics.jupPriceChange24h.toFixed(2)}%${colors.reset}`);
        }
        if (this.tokenMetrics.jupVolume24h) {
          console.log(`24h Volume: ${colors.blue}$${(this.tokenMetrics.jupVolume24h / 1000000).toFixed(2)}M${colors.reset}`);
        }
        if (this.tokenMetrics.jupMarketCap) {
          console.log(`Market Cap: ${colors.magenta}$${(this.tokenMetrics.jupMarketCap / 1000000).toFixed(2)}M${colors.reset}`);
        }
        if (this.tokenMetrics.jupFdv) {
          console.log(`FDV: ${colors.yellow}$${(this.tokenMetrics.jupFdv / 1000000).toFixed(2)}M${colors.reset}`);
        }
      }
      
      console.log(`URI: ${colors.dim}${buyToken.Uri || 'None'}${colors.reset}\n`);

      // Trade Information
      const totalValue = (trade.Trade.Buy.Amount * trade.Trade.Buy.PriceInUSD) || 0;
      console.log(`${colors.cyan}Trade Information:${colors.reset}`);
      console.log(`Buy Amount: ${colors.green}${trade.Trade.Buy.Amount || 0} ${buyToken.Symbol}${colors.reset}`);
      console.log(`Price USD: ${colors.yellow}$${(trade.Trade.Buy.PriceInUSD || 0).toFixed(6)}${colors.reset}`);
      console.log(`Price SOL: ${colors.yellow}${(trade.Trade.Buy.Price || 0).toFixed(8)} SOL${colors.reset}`);
      console.log(`Total Value: ${colors.magenta}$${totalValue.toFixed(2)}${colors.reset}\n`);

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

      // Links
      console.log(`${colors.cyan}Useful Links:${colors.reset}`);
      console.log(`${colors.blue}• Solscan: https://solscan.io/token/${buyToken.MintAddress}${colors.reset}`);
      console.log(`${colors.blue}• GMGN.io: https://gmgn.ai/sol/token/${buyToken.MintAddress}${colors.reset}\n`);

      // Draw price chart if we have enough data
      if (this.priceHistory.prices.length > 1) {
        const pnl = this.calculatePnL();
        console.log(this.drawPriceChart(pnl));
      }

    } catch (err) {
      const errorMsg = `Error processing trade ${index + 1}: ${err.message}`;
      console.error(`${colors.red}${errorMsg}${colors.reset}`);
      logToFile(errorMsg, 'error');
    }
  }

  setTrades(trades) {
    this.trades = trades.filter(trade => {
      // Validate trade structure before processing
      if (!trade) {
        console.error(`${colors.yellow}Invalid trade structure: missing trade object${colors.reset}`);
        return false;
      }
      
      // Handle different data structures based on current mode
      if (this.currentMode === 'graduated') {
        // For graduated mode, we expect Pool structure
        if (!trade.Pool || !trade.Pool.Market || !trade.Pool.Market.BaseCurrency) {
          console.error(`${colors.yellow}Invalid pool structure: missing Pool.Market.BaseCurrency${colors.reset}`);
          return false;
        }
        // For pools, Block.Time might not be required
        return true;
      } else {
        // For other modes, we expect Trade structure with Block.Time
        if (!trade.Block || !trade.Block.Time) {
          // Only log this error for non-graduated modes to reduce noise
          if (this.currentMode !== 'graduated') {
            console.error(`${colors.yellow}Invalid trade structure: missing Block.Time${colors.reset}`);
          }
          return false;
        }
        
        if (!trade.Trade || !trade.Trade.Buy || !trade.Trade.Buy.Currency) {
          console.error(`${colors.yellow}Invalid trade structure: missing Trade.Buy.Currency${colors.reset}`);
          return false;
        }
        
        const timeVerification = verifyTradeTime(trade.Block.Time);
        return timeVerification.isRecent;
      }
    });
    this.currentTokenIndex = 0;
  }

  getCurrentTrade() {
    return this.trades[this.currentTokenIndex];
  }

  hasMoreTrades() {
    return this.currentTokenIndex < this.trades.length - 1;
  }

  hasPreviousTrades() {
    return this.currentTokenIndex > 0;
  }

  getTradesCount() {
    return this.trades.length;
  }

  // Add helper methods for chart drawing
  calculatePnL() {
    if (this.priceHistory.prices.length < 2) return 0;
    const initialPrice = this.priceHistory.prices[0];
    const finalPrice = this.priceHistory.prices[this.priceHistory.prices.length - 1];
    return ((finalPrice - initialPrice) / initialPrice * 100).toFixed(2);
  }

  drawPriceChart(pnl) {
    const height = 8; // Smaller height for compact display
    const width = Math.min(this.priceHistory.prices.length, 20); // Limit width for better readability
    if (width < 2) return '';

    try {
      const min = Math.min(...this.priceHistory.prices);
      const max = Math.max(...this.priceHistory.prices);
      const range = max - min || 1;
      const lastPrice = this.priceHistory.prices[this.priceHistory.prices.length - 1];
      
      // Calculate price changes
      const priceDiff = lastPrice - this.priceHistory.prices[0];
      const percentChange = (priceDiff / (this.priceHistory.prices[0] || 1)) * 100;
      const isPositive = priceDiff >= 0;
      
      // Modern header with gradient-like styling
      let chartStr = '\n' + colors.bold.cyan('╭─ PRICE CHART ─╮\n');
      chartStr += colors.cyan('│ ') + colors.bold.white(`$${lastPrice.toFixed(9)}`) + colors.cyan(' │ ');
      
      // Dynamic trend indicator
      const trendSymbol = isPositive ? '🚀' : '📉';
      const trendColor = isPositive ? colors.green : colors.red;
      const trendSign = isPositive ? '+' : '';
      chartStr += `${trendSymbol} ${trendColor.bold(`${trendSign}${percentChange.toFixed(2)}%`)}\n`;
      chartStr += colors.cyan('╰' + '─'.repeat(15) + '╯\n\n');

      // Create enhanced canvas with gradient background
      const canvas = Array(height).fill().map(() => Array(width).fill(' '));

      // Plot points with modern symbols
      for (let i = 0; i < width - 1; i++) {
        const x1 = i;
        const x2 = i + 1;
        const y1 = Math.min(height - 1, Math.max(0, 
          height - 1 - Math.round(((this.priceHistory.prices[i] - min) / range) * (height - 1))
        ));
        const y2 = Math.min(height - 1, Math.max(0, 
          height - 1 - Math.round(((this.priceHistory.prices[i + 1] - min) / range) * (height - 1))
        ));

        // Modern price movement indicators
        if (this.priceHistory.prices[i] < this.priceHistory.prices[i + 1]) {
          canvas[y1][x1] = colors.green.bold('●'); // Green dot
          canvas[y2][x2] = colors.green.bold('●');
          this.plotLine(canvas, x1, y1, x2, y2, colors.green('┃')); // Vertical line
        } else if (this.priceHistory.prices[i] > this.priceHistory.prices[i + 1]) {
          canvas[y1][x1] = colors.red.bold('●'); // Red dot
          canvas[y2][x2] = colors.red.bold('●');
          this.plotLine(canvas, x1, y1, x2, y2, colors.red('┃')); // Vertical line
        } else {
          canvas[y1][x1] = colors.blue.bold('●'); // Blue dot
          canvas[y2][x2] = colors.blue.bold('●');
          this.plotLine(canvas, x1, y1, x2, y2, colors.blue('┃')); // Vertical line
        }
      }

      // Draw modern chart with rounded corners
      chartStr += colors.cyan('┌' + '─'.repeat(width + 2) + '┐\n');

      // Draw chart lines with enhanced styling
      for (let i = 0; i < height; i++) {
        const gridLine = canvas[i].map(cell => {
          if (cell !== ' ') return cell;
          // Create subtle grid pattern
          return colors.dim(i % 2 === 0 ? '·' : ' ');
        }).join('');
        chartStr += colors.cyan('│ ') + gridLine + colors.cyan(' │') + '\n';
      }

      // Bottom frame with modern styling
      chartStr += colors.cyan('└' + '─'.repeat(width + 2) + '┘\n');

      // Enhanced price range display
      chartStr += colors.yellow('⚡ High: ') + colors.green.bold(`$${max.toFixed(9)}`) + 
                  colors.yellow('  💧 Low: ') + colors.red.bold(`$${min.toFixed(9)}`) + '\n';

      // Modern time info
      if (this.priceHistory.times.length >= 2) {
        const timeRange = this.formatTimeRange(
          this.priceHistory.times[0], 
          this.priceHistory.times[this.priceHistory.times.length - 1]
        );
        chartStr += colors.cyan('⏱ ') + colors.dim(`${width} data points over ${timeRange}`);
      }

      return chartStr;

    } catch (error) {
      console.error('Chart drawing error:', error);
      return '\nUnable to draw chart: insufficient data';
    }
  }

  plotLine(canvas, x1, y1, x2, y2, char) {
    try {
      const dx = Math.abs(x2 - x1);
      const dy = Math.abs(y2 - y1);
      const sx = x1 < x2 ? 1 : -1;
      const sy = y1 < y2 ? 1 : -1;
      let err = dx - dy;
      
      let currentX = x1;
      let currentY = y1;

      while (true) {
        if (currentY >= 0 && currentY < canvas.length && 
            currentX >= 0 && currentX < canvas[0].length) {
          canvas[currentY][currentX] = char;
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

  formatTimeRange(startTime, endTime) {
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

  setMode(mode) {
    this.currentMode = mode;
  }

  getMode() {
    return this.currentMode;
  }

  displayInstruction(instruction, index) {
    const program = instruction.Instruction.Program;
    const accounts = instruction.Instruction.Accounts;
    const transaction = instruction.Transaction;
    const block = instruction.Block;
    
    let output = '';
    
    // Header
    output += `${colors.cyan}Instruction ${index + 1} of ${this.trades.length}${colors.reset}\n`;
    output += `${colors.dim}Use W/S to navigate between instructions${colors.reset}\n\n`;
    
    // Program Details
    output += `${colors.yellow}📝 Program Details:${colors.reset}\n`;
    output += `${colors.white}Name:${colors.reset} ${colors.green}${program.Name || 'Unknown'}${colors.reset}\n`;
    output += `${colors.white}Method:${colors.reset} ${colors.green}${program.Method || 'Unknown'}${colors.reset}\n`;
    output += `${colors.white}Address:${colors.reset} ${colors.yellow}${program.Address || 'Unknown'}${colors.reset}\n`;
    if (program.AccountNames && program.AccountNames.length > 0) {
      output += `${colors.white}Account Names:${colors.reset} ${colors.cyan}${program.AccountNames.join(', ')}${colors.reset}\n`;
    }
    output += '\n';
    
    // Arguments
    if (program.Arguments && program.Arguments.length > 0) {
      output += `${colors.yellow}🔧 Arguments:${colors.reset}\n`;
      program.Arguments.forEach((arg, i) => {
        const value = this.formatArgumentValue(arg.Value);
        output += `${colors.white}${arg.Name || `Arg${i}`}:${colors.reset} ${colors.cyan}${value}${colors.reset}\n`;
      });
      output += '\n';
    }
    
    // Accounts
    if (accounts && accounts.length > 0) {
      output += `${colors.yellow}🏦 Accounts:${colors.reset}\n`;
      accounts.forEach((account, i) => {
        output += `${colors.white}Account ${i + 1}:${colors.reset}\n`;
        output += `  ${colors.dim}Address:${colors.reset} ${colors.yellow}${account.Address}${colors.reset}\n`;
        output += `  ${colors.dim}Writable:${colors.reset} ${account.IsWritable ? colors.green + 'Yes' : colors.red + 'No'}${colors.reset}\n`;
        if (account.Token) {
          output += `  ${colors.dim}Token Program:${colors.reset} ${colors.cyan}${account.Token.ProgramId}${colors.reset}\n`;
          output += `  ${colors.dim}Token Owner:${colors.reset} ${colors.cyan}${account.Token.Owner}${colors.reset}\n`;
          output += `  ${colors.dim}Token Mint:${colors.reset} ${colors.cyan}${account.Token.Mint}${colors.reset}\n`;
        }
        output += '\n';
      });
    }
    
    // Transaction Details
    output += `${colors.yellow}📊 Transaction Details:${colors.reset}\n`;
    output += `${colors.white}Signature:${colors.reset} ${colors.dim}${transaction?.Signature || 'Unknown'}${colors.reset}\n`;
    const timeVerification = verifyTradeTime(block?.Time);
    output += `${colors.white}Time:${colors.reset} ${colors.cyan}${new Date(block?.Time || Date.now()).toISOString()}${colors.reset} (${colors.green}${timeVerification.formattedDiff}${colors.reset})\n\n`;
    
    // Links
    output += `${colors.yellow}🔗 Useful Links:${colors.reset}\n`;
    if (transaction?.Signature) {
      output += `${colors.blue}• Solscan:${colors.reset} https://solscan.io/tx/${transaction.Signature}\n`;
    }
    if (program.Address) {
      output += `${colors.blue}• Program:${colors.reset} https://solscan.io/account/${program.Address}\n`;
    }
    
    return output;
  }

  formatArgumentValue(value) {
    if (!value) return 'null';
    
    if (value.json) return `JSON: ${JSON.stringify(value.json)}`;
    if (value.float !== undefined) return `Float: ${value.float}`;
    if (value.bool !== undefined) return `Boolean: ${value.bool}`;
    if (value.hex) return `Hex: ${value.hex}`;
    if (value.bigInteger) return `BigInt: ${value.bigInteger}`;
    if (value.address) return `Address: ${value.address}`;
    if (value.string) return `String: ${value.string}`;
    if (value.integer !== undefined) return `Integer: ${value.integer}`;
    
    return 'Unknown type';
  }

  async updateTokenMetrics(tokenAddress) {
    try {
      // Fetch Jupiter v6 data with timeout
      const jupDataPromise = fetchJupiterTokenData(tokenAddress);
      const jupTimeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Jupiter API timeout')), 3000)
      );
      
      const jupData = await Promise.race([jupDataPromise, jupTimeoutPromise]);
      this.tokenMetrics = {
        ...jupData,
        // Keep BitQuery fallback for other metrics
        ...this.tokenMetrics
      };
    } catch (error) {
      // Silently fail for Jupiter data - it's not critical
      console.log(`${colors.yellow}Jupiter data fetch failed: ${error.message}${colors.reset}`);
    }
    
    try {
      // Add timeout to prevent hanging requests
      const timeout = 3000; // 3 seconds (reduced from 5)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch("https://streaming.bitquery.io/eap", {
        ...this.requestOptions,
        body: JSON.stringify(getTokenMetrics(tokenAddress)),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const responseText = await response.text();
        if (responseText.includes('Account blocked')) {
          throw new Error('Account blocked');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const data = result.data.Solana;

      this.tokenMetrics = {
        ...this.tokenMetrics, // Keep Jupiter data
        volume: data.volume?.[0]?.sum || 0,
        liquidity: data.liquidity?.[0]?.Pool?.Base?.PostAmountInUSD || 0,
        marketcap: data.marketcap?.[0]?.TokenSupplyUpdate?.PostBalanceInUSD || 0
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`${colors.yellow}Token metrics request timeout for ${tokenAddress}${colors.reset}`);
      } else if (error.message.includes('Account blocked')) {
        console.log(`${colors.yellow}BitQuery API account blocked. Please check your API key.${colors.reset}`);
      } else {
        console.log(`${colors.yellow}Error fetching token metrics: ${error.message}${colors.reset}`);
      }
    }
  }

  async updatePriceHistory() {
    try {
      // Only query if at least 1 second has passed since last query
      if (Date.now() - this.lastQueryTime < 1000) {
        return;
      }

      const currentTrade = this.getCurrentTrade();
      if (!currentTrade) return;

      const queryConfig = {
        query: `{
          Solana {
            DEXTrades(
              options: {limit: 1}
              where: {Trade: {Buy: {Currency: {MintAddress: {is: "${currentTrade.Trade.Buy.Currency.MintAddress}"}}}}}
            ) {
              Block {
                Time
              }
              Trade {
                Buy {
                  PriceInUSD
                }
              }
            }
          }
        }`
      };

      // Add timeout to prevent hanging requests
      const timeout = 3000; // 3 seconds (reduced from 5)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch("https://streaming.bitquery.io/eap", {
        ...this.requestOptions,
        body: JSON.stringify(queryConfig),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const responseText = await response.text();
        if (responseText.includes('Account blocked')) {
          throw new Error('Account blocked');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const latestTrade = result?.data?.Solana?.DEXTrades?.[0];

      if (latestTrade) {
        this.lastQueryTime = Date.now();
        
        // Add new price point
        this.priceHistory.prices.push(latestTrade.Trade.Buy.PriceInUSD);
        this.priceHistory.times.push(latestTrade.Block.Time);
        
        // Keep only last N points
        if (this.priceHistory.prices.length > this.priceHistory.maxPoints) {
          this.priceHistory.prices.shift();
          this.priceHistory.times.shift();
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`${colors.yellow}Price history update request timeout${colors.reset}`);
      } else if (error.message.includes('Account blocked')) {
        console.log(`${colors.yellow}BitQuery API account blocked. Please check your API key.${colors.reset}`);
      } else {
        console.log(`${colors.yellow}Error updating price history: ${error.message}${colors.reset}`);
      }
    }
  }
}

// Optimized AppState with memory management
class OptimizedAppState extends AppState {
  constructor() {
    super();
    this.maxTradesInMemory = 100; // Limit memory usage
    this.maxPriceHistoryPoints = 50; // Limit price history
    this.cleanupInterval = null;
    this.performanceMonitor = new PerformanceMonitor();
    this.cacheManager = new CacheManager();
    this.optimizedDisplay = new OptimizedDisplay();
    
    // Start cleanup interval
    this.startCleanupInterval();
  }
  
  startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, 60000); // Cleanup every minute
  }
  
  cleanupOldData() {
    // Cleanup trades
    if (this.trades.length > this.maxTradesInMemory) {
      const removed = this.trades.length - this.maxTradesInMemory;
      this.trades = this.trades.slice(-this.maxTradesInMemory);
      console.log(`${colors.yellow}🧹 Cleaned up ${removed} old trades from memory${colors.reset}`);
    }
    
    // Cleanup price history
    if (this.priceHistory.prices.length > this.maxPriceHistoryPoints) {
      const removed = this.priceHistory.prices.length - this.maxPriceHistoryPoints;
      this.priceHistory.prices = this.priceHistory.prices.slice(-this.maxPriceHistoryPoints);
      this.priceHistory.times = this.priceHistory.times.slice(-this.maxPriceHistoryPoints);
      console.log(`${colors.yellow}🧹 Cleaned up ${removed} old price points from memory${colors.reset}`);
    }
    
    // Cleanup trade chart
    if (this.tradeChart.prices.length > this.maxPriceHistoryPoints) {
      this.tradeChart.prices = this.tradeChart.prices.slice(-this.maxPriceHistoryPoints);
      this.tradeChart.times = this.tradeChart.times.slice(-this.maxPriceHistoryPoints);
    }
  }
  
  async displayTrade(index) {
    this.performanceMonitor.startTimer('displayTrade');
    const result = await super.displayTrade(index);
    this.performanceMonitor.endTimer('displayTrade');
    return result;
  }
  
  async updateTokenMetrics(tokenAddress) {
    // Check cache first
    const cacheKey = `token_metrics_${tokenAddress}`;
    const cached = this.cacheManager.get(cacheKey);
    if (cached) {
      this.tokenMetrics = cached;
      return;
    }
    
    this.performanceMonitor.startTimer('updateTokenMetrics');
    await super.updateTokenMetrics(tokenAddress);
    this.cacheManager.set(cacheKey, this.tokenMetrics);
    this.performanceMonitor.endTimer('updateTokenMetrics');
  }
  
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    super.destroy?.();
  }
  
  // Add explicit clearCharts method to ensure inheritance works
  clearCharts() {
    this.tradeChart.prices = [];
    this.tradeChart.times = [];
    this.priceHistory.prices = [];
    this.priceHistory.times = [];
  }
}

// Export both classes
export default AppState;
export { OptimizedAppState };

// Update displayFormats to keep only pump mode
const displayFormats = {
  pump: (trade) => {
    return `
${colors.cyan}Token ${state.currentTokenIndex + 1} of ${state.trades.length}${colors.reset}
${colors.dim}Use W/S to navigate between tokens${colors.reset}

${colors.yellow}📝 Token Details:${colors.reset}
${colors.white}Name:${colors.reset} ${colors.green}${trade.Trade.Buy.Currency.Name}${colors.reset}
${colors.white}Symbol:${colors.reset} ${colors.green}${trade.Trade.Buy.Currency.Symbol}${colors.reset}
${colors.white}Address:${colors.reset} ${colors.yellow}${trade.Trade.Buy.Currency.MintAddress}${colors.reset}
${colors.white}Decimals:${colors.reset} ${colors.cyan}${trade.Trade.Buy.Currency.Decimals}${colors.reset}
${colors.white}Fungible:${colors.reset} ${trade.Trade.Buy.Currency.Fungible ? colors.green + '✓ Yes' : colors.red + '✗ No'}${colors.reset}
${colors.white}URI:${colors.reset} ${colors.dim}${trade.Trade.Buy.Currency.Uri || 'N/A'}${colors.reset}

${colors.yellow}💰 Trade Information:${colors.reset}
${colors.white}Buy Amount:${colors.reset} ${colors.green}${formatNumber(trade.Trade.Buy.Amount)} ${trade.Trade.Buy.Currency.Symbol}${colors.reset}
${colors.white}Price USD:${colors.reset} ${colors.green}$${formatNumber(trade.Trade.Buy.PriceInUSD)}${colors.reset}
${colors.white}Price SOL:${colors.reset} ${colors.green}${formatNumber(trade.Trade.Buy.Price)} SOL${colors.reset}
${colors.white}Total Value:${colors.reset} ${colors.magenta}$${formatNumber(trade.Trade.Sell.AmountInUSD)}${colors.reset}

${colors.yellow}📈 Market Stats:${colors.reset}
${colors.white}Market Cap:${colors.reset} ${colors.magenta}$${formatNumber(state.tokenMetrics.marketcap)}${colors.reset}
${colors.white}Liquidity:${colors.reset} ${colors.cyan}$${formatNumber(state.tokenMetrics.liquidity)}${colors.reset}
${colors.white}1h Volume:${colors.reset} ${colors.blue}$${formatNumber(state.tokenMetrics.volume)}${colors.reset}
${drawTokenChart(trade, state.priceHistory.prices, state.priceHistory.times)}

${colors.yellow}🏦 Market Information:${colors.reset}
${colors.white}DEX Protocol:${colors.reset} ${colors.magenta}${trade.Trade.Dex.ProtocolName}${colors.reset}
${colors.white}DEX Family:${colors.reset} ${colors.magenta}${trade.Trade.Dex.ProtocolFamily}${colors.reset}
${colors.white}Market Address:${colors.reset} ${colors.yellow}${trade.Trade.Market.MarketAddress}${colors.reset}

${colors.yellow}📊 Transaction Details:${colors.reset}
${colors.white}Signature:${colors.reset} ${colors.dim}${trade.Transaction.Signature}${colors.reset}
${colors.white}Time:${colors.reset} ${colors.cyan}${new Date(trade.Block.Time).toISOString()}${colors.reset} (${colors.green}${getTimeDiff(trade.Block.Time)}${colors.reset})

${colors.yellow}🔗 Useful Links:${colors.reset}
${colors.blue}• Solscan:${colors.reset} https://solscan.io/token/${trade.Trade.Buy.Currency.MintAddress}
${colors.blue}• GMGN.io:${colors.reset} https://gmgn.ai/sol/token/${trade.Trade.Buy.Currency.MintAddress}
`;
  }
};

// Add drawTokenChart function before displayFormats
function drawTokenChart(trade, prices, times) {
  const width = 50;
  const height = 10;
  
  if (prices.length < 2) return ''; // Don't draw chart if not enough data
  
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min;
  const priceChange = ((prices[prices.length - 1] - prices[0]) / prices[0] * 100).toFixed(2);
  const isPositive = priceChange >= 0;

  let chart = `\n${colors.yellow}📈 Price Chart (${isPositive ? colors.green : colors.red}${priceChange}%${colors.reset})${colors.reset}\n`;
  chart += `${colors.dim}$${formatNumber(max)}${colors.reset}\n`;
  chart += `${colors.gray}┌${'─'.repeat(width + 2)}┐${colors.reset}\n`;

  for (let y = 0; y < height; y++) {
    chart += `${colors.gray}│ ${colors.reset}`;
    const level = max - (range * (y / (height - 1)));
    
    for (let x = 0; x < width; x++) {
      const price = prices[Math.floor(x * prices.length / width)];
      if (price >= level) {
        chart += isPositive ? colors.green + '•' : colors.red + '•' + colors.reset;
      } else {
        chart += ' ';
      }
    }
    chart += `${colors.gray} │${colors.reset}\n`;
  }

  chart += `${colors.gray}└${'─'.repeat(width + 2)}┘${colors.reset}\n`;
  chart += `${colors.dim}$${formatNumber(min)}${colors.reset}\n`;
  chart += `${colors.dim}Last ${times.length} trades over ${getTimeDiff(times[0])}${colors.reset}\n`;

  return chart;
}

async function fetchJupiterTokenData(mintAddress) {
  try {
    // Add timeout to prevent hanging requests
    const timeout = 2000; // 2 seconds (reduced from 3)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    // Fetch price and token info from Jupiter Lite API with timeout
    const priceRes = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mintAddress}`, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!priceRes.ok) {
      throw new Error(`HTTP ${priceRes.status}: ${priceRes.statusText}`);
    }
    
    const priceData = await priceRes.json();
    const priceInfo = priceData.data?.[mintAddress] || {};

    return {
      jupPrice: priceInfo.price,
      jupLpPrice: priceInfo.lpPrice,
      jupTime: priceInfo.time,
      jupVolume24h: priceInfo.volume24h,
      jupLiquidity: priceInfo.liquidity,
      jupSymbol: priceInfo.symbol,
      jupName: priceInfo.name,
      jupPriceChange24h: priceInfo.priceChange24h,
      jupMarketCap: priceInfo.marketCap,
      jupFdv: priceInfo.fdv,
      jupCoingeckoId: priceInfo.coingeckoId
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log(`${colors.yellow}Jupiter API timeout for ${mintAddress}${colors.reset}`);
    } else if (error.code === 'ENOTFOUND') {
      console.log(`${colors.yellow}Jupiter API DNS resolution failed for ${mintAddress}${colors.reset}`);
    } else {
      console.log(`${colors.yellow}Jupiter API error for ${mintAddress}: ${error.message}${colors.reset}`);
    }
    
    // Return default values on error
    return {
      jupPrice: null,
      jupLpPrice: null,
      jupTime: null,
      jupVolume24h: null,
      jupLiquidity: null,
      jupSymbol: null,
      jupName: null,
      jupPriceChange24h: null,
      jupMarketCap: null,
      jupFdv: null,
      jupCoingeckoId: null
    };
  }
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
  }
};