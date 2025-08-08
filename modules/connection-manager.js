import { colors } from '../colors.js';
import { logToFile } from '../logger.js';
import { Connection } from '@solana/web3.js';

export class ConnectionManager {
  constructor() {
    this.connectionStatus = {
      bitquery: { connected: false, error: null, lastCheck: 0 },
      jupiter: { connected: false, error: null, lastCheck: 0 },
      birdeye: { connected: false, error: null, lastCheck: 0 }
    };
    this.retryAttempts = 0;
    this.maxRetries = 3;
    this.retryDelay = 2000;
    this.apiKey = null;
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  async checkBitqueryConnection() {
    try {
      // Check if we have a valid API key
      if (!this.apiKey) {
        this.connectionStatus.bitquery = {
          connected: false,
          error: 'No API key configured',
          lastCheck: Date.now()
        };
        return false;
      }

      // Simple test query to check connection
      const testQuery = {
        query: `{
          Solana {
            DEXTrades(
              limit: {count: 1}
              where: {
                Block: {Time: {since_relative: {minutes_ago: 1}}}
                Trade: {
                  Buy: {
                    Currency: {MintAddress: {notIn: ["11111111111111111111111111111111"]}}
                  }
                }
              }
            ) {
              Trade {
                Buy {
                  Currency {
                    Symbol
                    MintAddress
                  }
                }
              }
            }
          }
        }`,
        variables: {}
      };

      const headers = new Headers();
      headers.append("Content-Type", "application/json");
      headers.append("Authorization", `Bearer ${this.apiKey}`);

      const response = await fetch("https://streaming.bitquery.io/eap", {
        method: "POST",
        headers: headers,
        body: JSON.stringify(testQuery),
        redirect: "follow"
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'GraphQL errors');
      }

      this.connectionStatus.bitquery = {
        connected: true,
        error: null,
        lastCheck: Date.now()
      };

      return true;

    } catch (error) {
      this.connectionStatus.bitquery = {
        connected: false,
        error: error.message,
        lastCheck: Date.now()
      };
      
      logToFile(`BitQuery connection failed: ${error.message}`, 'error');
      return false;
    }
  }

  async checkJupiterConnection() {
    try {
      const response = await fetch('https://price.jup.ag/v4/price?ids=SOL', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.data) {
        throw new Error('Invalid Jupiter response');
      }

      this.connectionStatus.jupiter = {
        connected: true,
        error: null,
        lastCheck: Date.now()
      };

      return true;

    } catch (error) {
      this.connectionStatus.jupiter = {
        connected: false,
        error: error.message,
        lastCheck: Date.now()
      };
      
      logToFile(`Jupiter connection failed: ${error.message}`, 'error');
      return false;
    }
  }

  async checkAllConnections() {
    const results = await Promise.allSettled([
      this.checkBitqueryConnection(),
      this.checkJupiterConnection()
    ]);

    return {
      bitquery: results[0].status === 'fulfilled' ? results[0].value : false,
      jupiter: results[1].status === 'fulfilled' ? results[1].value : false
    };
  }

  async makeBitqueryRequest(query, retryCount = 0) {
    try {
      if (!this.apiKey) {
        throw new Error('No API key configured');
      }

      const headers = new Headers();
      headers.append("Content-Type", "application/json");
      headers.append("Authorization", `Bearer ${this.apiKey}`);

      const response = await fetch("https://streaming.bitquery.io/eap", {
        method: "POST",
        headers: headers,
        body: JSON.stringify(query),
        redirect: "follow"
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'GraphQL errors');
      }

      // Reset retry attempts on success
      this.retryAttempts = 0;
      return result;

    } catch (error) {
      // Handle specific error types
      if (error.message.includes('Account blocked') || error.message.includes('401')) {
        throw new Error('API key is invalid or blocked. Please check your BitQuery API key.');
      }
      
      if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        throw new Error('Network connection failed. Please check your internet connection.');
      }

      // Retry logic for transient errors
      if (retryCount < this.maxRetries && this.shouldRetry(error)) {
        console.log(`${colors.yellow}⚠️ Request failed, retrying... (${retryCount + 1}/${this.maxRetries})${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retryCount + 1)));
        return this.makeBitqueryRequest(query, retryCount + 1);
      }

      throw error;
    }
  }

  shouldRetry(error) {
    // Retry on network errors, timeouts, and rate limits
    const retryableErrors = [
      'ENOTFOUND',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ECONNRESET',
      'rate limit',
      'timeout',
      'network'
    ];

    return retryableErrors.some(retryableError => 
      error.message.toLowerCase().includes(retryableError)
    );
  }

  getConnectionStatus() {
    return this.connectionStatus;
  }

  isConnected(service = 'bitquery') {
    return this.connectionStatus[service]?.connected || false;
  }

  getLastError(service = 'bitquery') {
    return this.connectionStatus[service]?.error || null;
  }

  // Get optimized connection for RPC operations
  async getOptimizedConnection() {
    try {
      // Use a reliable RPC endpoint for wallet operations
      const rpcEndpoint = 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpcEndpoint, 'confirmed');
      return connection;
    } catch (error) {
      console.error(`${colors.red}❌ Failed to create optimized connection: ${error.message}${colors.reset}`);
      throw error;
    }
  }

  // Display connection status
  displayConnectionStatus() {
    console.log(`\n${colors.cyan}🔗 Connection Status:${colors.reset}`);
    
    Object.entries(this.connectionStatus).forEach(([service, status]) => {
      const icon = status.connected ? '✅' : '❌';
      const color = status.connected ? colors.green : colors.red;
      const lastCheck = status.lastCheck ? new Date(status.lastCheck).toLocaleTimeString() : 'Never';
      
      console.log(`${icon} ${color}${service.toUpperCase()}${colors.reset}: ${status.connected ? 'Connected' : 'Disconnected'}`);
      if (!status.connected && status.error) {
        console.log(`   ${colors.yellow}Error: ${status.error}${colors.reset}`);
      }
      console.log(`   Last check: ${lastCheck}`);
    });
  }

  // Auto-reconnect functionality
  async autoReconnect(service = 'bitquery') {
    if (this.isConnected(service)) {
      return true;
    }

    console.log(`${colors.yellow}🔄 Attempting to reconnect to ${service}...${colors.reset}`);
    
    try {
      let success = false;
      
      if (service === 'bitquery') {
        success = await this.checkBitqueryConnection();
      } else if (service === 'jupiter') {
        success = await this.checkJupiterConnection();
      }

      if (success) {
        console.log(`${colors.green}✅ Successfully reconnected to ${service}!${colors.reset}`);
        return true;
      } else {
        console.log(`${colors.red}❌ Failed to reconnect to ${service}${colors.reset}`);
        return false;
      }
    } catch (error) {
      console.log(`${colors.red}❌ Reconnection failed: ${error.message}${colors.reset}`);
      return false;
    }
  }
}

// Export singleton instance
export const connectionManager = new ConnectionManager();

// Price Alerts Manager
export class PriceAlerts {
  constructor() {
    this.alerts = new Map();
    this.alertId = 0;
  }

  addAlert(tokenAddress, targetPrice, condition, description = '') {
    const id = ++this.alertId;
    this.alerts.set(id, {
      id,
      tokenAddress,
      targetPrice,
      condition,
      description,
      createdAt: new Date()
    });
    return id;
  }

  removeAlert(alertId) {
    return this.alerts.delete(alertId);
  }

  getAlerts() {
    return Array.from(this.alerts.values());
  }

  async checkAlerts(currentPrice, tokenAddress) {
    const triggeredAlerts = [];
    
    for (const alert of this.alerts.values()) {
      if (alert.tokenAddress === tokenAddress) {
        let triggered = false;
        
        switch (alert.condition) {
          case 'above':
            triggered = currentPrice > alert.targetPrice;
            break;
          case 'below':
            triggered = currentPrice < alert.targetPrice;
            break;
          case 'equals':
            triggered = Math.abs(currentPrice - alert.targetPrice) < 0.000001;
            break;
        }
        
        if (triggered) {
          triggeredAlerts.push(alert);
        }
      }
    }
    
    return triggeredAlerts;
  }

  triggerAlert(alert, currentPrice) {
    console.log(`\n${colors.yellow}🚨 PRICE ALERT TRIGGERED!${colors.reset}`);
    console.log(`${colors.cyan}Token: ${alert.tokenAddress}${colors.reset}`);
    console.log(`${colors.green}Current Price: $${currentPrice}${colors.reset}`);
    console.log(`${colors.yellow}Target Price: $${alert.targetPrice} (${alert.condition})${colors.reset}`);
    if (alert.description) {
      console.log(`${colors.dim}Description: ${alert.description}${colors.reset}`);
    }
    console.log('');
  }
} 