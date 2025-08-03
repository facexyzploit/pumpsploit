import { colors } from '../colors.js';
import { ConnectionStatus } from './connection-manager.js';
import { extractTokenFromGMGNUrl, monitorGMGNTrend, promptForGMGNUrl, processGMGNTrendData } from './gmgn-monitor.js';

export class StreamHandler {
  constructor(state, spinner) {
    this.state = state;
    this.spinner = spinner;
    this.connectionStatus = new ConnectionStatus();
  }

  async startStream(queryType = 'pump') {
    try {
      // Check BitQuery connection first
      console.log(`${colors.cyan}🔍 Checking BitQuery connection...${colors.reset}`);
      const bitqueryConnected = await this.connectionStatus.checkBitqueryConnection();
      
      if (!bitqueryConnected) {
        console.log(`${colors.red}❌ BitQuery connection failed: ${this.connectionStatus.bitquery.error}${colors.reset}`);
        console.log(`${colors.yellow}💡 Try updating your API key in Settings or check your internet connection${colors.reset}`);
        return false;
      }
      
      console.log(`${colors.green}✅ BitQuery connection successful!${colors.reset}`);
      this.spinner.start(`Connecting to BitQuery stream in ${queryType} mode`);
      
      this.state.clearCharts();
      this.state.setMode(queryType); // Set the current mode
      
      // Handle GMGN trend monitoring
      if (queryType === 'gmgnTrend') {
        return await this.handleGMGNTrend();
      }
      
      // Handle other query types
      return await this.handleStandardStream(queryType);
      
    } catch (error) {
      this.spinner.stop();
      console.error(`${colors.red}❌ Error starting stream: ${error.message}${colors.reset}`);
      return false;
    }
  }

  async handleGMGNTrend() {
    try {
      const gmgnUrl = await promptForGMGNUrl();
      const trendId = extractTokenFromGMGNUrl(gmgnUrl);
      
      if (!trendId) {
        console.log(`${colors.red}❌ Failed to extract trend ID from URL${colors.reset}`);
        return false;
      }
      
      const trendData = await monitorGMGNTrend(trendId);
      if (!trendData) {
        console.log(`${colors.red}❌ Failed to fetch trend data${colors.reset}`);
        return false;
      }
      
      const success = processGMGNTrendData(trendData, this.state);
      if (!success) {
        console.log(`${colors.red}❌ Failed to process trend data${colors.reset}`);
        return false;
      }
      
      this.spinner.stop();
      console.log(`${colors.green}✅ GMGN trend monitoring started!${colors.reset}`);
      console.log(`${colors.cyan} Monitoring ${trendData.tokens.length} tokens from trend${colors.reset}`);
      
      // Display the first token
      if (this.state.trades.length > 0) {
        await this.state.displayTrade(0);
      }
      
      return true;
    } catch (error) {
      console.error(`${colors.red}Error handling GMGN trend: ${error.message}${colors.reset}`);
      return false;
    }
  }

  async handleStandardStream(queryType) {
    try {
      // Simulate stream connection
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      this.spinner.stop();
      console.log(`${colors.green}✅ Stream connected successfully!${colors.reset}`);
      console.log(`${colors.cyan} Monitoring in ${queryType} mode${colors.reset}`);
      
      // Simulate some initial data
      const mockTrade = {
        Trade: {
          Buy: {
            Currency: {
              Name: 'Test Token',
              Symbol: 'TEST',
              MintAddress: 'TestAddress123',
              Decimals: 6
            },
            Price: 0.000015,
            PriceInUSD: 0.000015,
            Amount: 1000000
          },
          Sell: {
            Amount: 1000000,
            AmountInUSD: 0.015
          },
          Dex: {
            ProtocolName: queryType,
            ProtocolFamily: 'Test'
          },
          Market: {
            MarketAddress: 'TestMarket'
          }
        },
        Block: {
          Time: new Date().toISOString()
        },
        Transaction: {
          Signature: 'test-signature-123'
        }
      };
      
      this.state.addTrade(mockTrade);
      await this.state.displayTrade(0);
      
      return true;
    } catch (error) {
      console.error(`${colors.red}Error in standard stream: ${error.message}${colors.reset}`);
      return false;
    }
  }

  async checkAllConnections() {
    return await this.connectionStatus.checkAllConnections();
  }

  getConnectionStatus() {
    return this.connectionStatus.getStatus();
  }
} 