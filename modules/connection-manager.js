import { Connection } from '@solana/web3.js';
import { colors } from '../colors.js';
import { logToFile } from '../logger.js';
import { errorHandler } from './error-handler.js';

/**
 * Optimized Connection Manager - Handles RPC connections and API endpoints
 */
export class ConnectionManager {
  constructor() {
    this.connections = new Map();
    this.endpoints = new Map();
    this.healthChecks = new Map();
    this.currentEndpoint = null;
    this.fallbackEndpoints = [
      'https://api.mainnet-beta.solana.com',
      'https://solana-api.projectserum.com',
      'https://rpc.ankr.com/solana',
      'https://solana.public-rpc.com'
    ];
    
    this.initializeEndpoints();
  }

  /**
   * Initialize default endpoints
   */
  initializeEndpoints() {
    // Primary endpoints
    this.endpoints.set('primary', 'https://api.mainnet-beta.solana.com');
    this.endpoints.set('backup1', 'https://solana-api.projectserum.com');
    this.endpoints.set('backup2', 'https://rpc.ankr.com/solana');
    this.endpoints.set('backup3', 'https://solana.public-rpc.com');
    
    this.currentEndpoint = 'primary';
  }

  /**
   * Get optimized connection with caching
   */
  async getConnection(endpoint = null) {
    const targetEndpoint = endpoint || this.endpoints.get(this.currentEndpoint);
    
    // Check if we have a cached connection
    if (this.connections.has(targetEndpoint)) {
      const connection = this.connections.get(targetEndpoint);
      if (connection.lastUsed && Date.now() - connection.lastUsed < 60000) {
        connection.lastUsed = Date.now();
        return connection.connection;
      }
    }

    // Create new connection
    const connection = new Connection(targetEndpoint, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000
    });

    // Test connection health
    const isHealthy = await this.testConnectionHealth(connection);
    if (!isHealthy) {
      console.log(`${colors.yellow}⚠️ Endpoint ${targetEndpoint} is unhealthy, trying fallback...${colors.reset}`);
      return await this.getFallbackConnection();
    }

    // Cache the connection
    this.connections.set(targetEndpoint, {
      connection,
      lastUsed: Date.now(),
      healthy: true
    });

    return connection;
  }

  /**
   * Test connection health
   */
  async testConnectionHealth(connection) {
    try {
      const startTime = Date.now();
      await connection.getSlot();
      const responseTime = Date.now() - startTime;
      
      // Consider connection healthy if response time is under 5 seconds
      return responseTime < 5000;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get fallback connection
   */
  async getFallbackConnection() {
    for (const [name, endpoint] of this.endpoints) {
      if (name === this.currentEndpoint) continue;
      
      try {
        const connection = new Connection(endpoint, {
          commitment: 'confirmed',
          confirmTransactionInitialTimeout: 60000
        });
        
        const isHealthy = await this.testConnectionHealth(connection);
        if (isHealthy) {
          console.log(`${colors.green}✅ Switched to ${name} endpoint${colors.reset}`);
          this.currentEndpoint = name;
          
          this.connections.set(endpoint, {
            connection,
            lastUsed: Date.now(),
            healthy: true
          });
          
          return connection;
        }
      } catch (error) {
        console.log(`${colors.yellow}⚠️ ${name} endpoint failed: ${error.message}${colors.reset}`);
      }
    }
    
    throw new Error('All endpoints are unavailable');
  }

  /**
   * Get current endpoint info
   */
  getCurrentEndpoint() {
    return {
      name: this.currentEndpoint,
      url: this.endpoints.get(this.currentEndpoint),
      healthy: this.connections.get(this.endpoints.get(this.currentEndpoint))?.healthy || false
    };
  }

  /**
   * Add custom endpoint
   */
  addEndpoint(name, url) {
    this.endpoints.set(name, url);
    console.log(`${colors.green}✅ Added endpoint: ${name} -> ${url}${colors.reset}`);
  }

  /**
   * Remove endpoint
   */
  removeEndpoint(name) {
    if (this.endpoints.has(name)) {
      this.endpoints.delete(name);
      console.log(`${colors.yellow}⚠️ Removed endpoint: ${name}${colors.reset}`);
    }
  }

  /**
   * List all endpoints
   */
  listEndpoints() {
    const endpoints = [];
    for (const [name, url] of this.endpoints) {
      const connection = this.connections.get(url);
      endpoints.push({
        name,
        url,
        healthy: connection?.healthy || false,
        lastUsed: connection?.lastUsed || null,
        isCurrent: name === this.currentEndpoint
      });
    }
    return endpoints;
  }

  /**
   * Display endpoint status
   */
  displayEndpointStatus() {
    console.log(`${colors.cyan}🌐 Endpoint Status:${colors.reset}`);
    console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    
    const endpoints = this.listEndpoints();
    for (const endpoint of endpoints) {
      const status = endpoint.healthy ? '🟢' : '🔴';
      const current = endpoint.isCurrent ? ' (Current)' : '';
      const lastUsed = endpoint.lastUsed ? 
        ` - Last used: ${new Date(endpoint.lastUsed).toLocaleTimeString()}` : '';
      
      console.log(`${status} ${colors.yellow}${endpoint.name}:${colors.reset} ${endpoint.url}${current}${lastUsed}`);
    }
  }

  /**
   * Cleanup old connections
   */
  cleanup() {
    const now = Date.now();
    for (const [endpoint, connection] of this.connections) {
      if (now - connection.lastUsed > 300000) { // 5 minutes
        this.connections.delete(endpoint);
      }
    }
  }

  /**
   * Get optimized RPC endpoint
   */
  getRpcEndpoint() {
    return this.endpoints.get(this.currentEndpoint);
  }

  /**
   * Test all endpoints
   */
  async testAllEndpoints() {
    console.log(`${colors.cyan}🔍 Testing all endpoints...${colors.reset}`);
    
    const results = [];
    for (const [name, url] of this.endpoints) {
      try {
        const connection = new Connection(url, { commitment: 'confirmed' });
        const startTime = Date.now();
        await connection.getSlot();
        const responseTime = Date.now() - startTime;
        
        results.push({
          name,
          url,
          healthy: true,
          responseTime
        });
        
        console.log(`${colors.green}✅ ${name}: ${responseTime}ms${colors.reset}`);
      } catch (error) {
        results.push({
          name,
          url,
          healthy: false,
          error: error.message
        });
        
        console.log(`${colors.red}❌ ${name}: ${error.message}${colors.reset}`);
      }
    }
    
    return results;
  }

  /**
   * Auto-select best endpoint
   */
  async selectBestEndpoint() {
    const results = await this.testAllEndpoints();
    const healthyEndpoints = results.filter(r => r.healthy);
    
    if (healthyEndpoints.length === 0) {
      throw new Error('No healthy endpoints available');
    }
    
    // Select endpoint with lowest response time
    const bestEndpoint = healthyEndpoints.reduce((best, current) => 
      current.responseTime < best.responseTime ? current : best
    );
    
    this.currentEndpoint = bestEndpoint.name;
    console.log(`${colors.green}✅ Selected best endpoint: ${bestEndpoint.name} (${bestEndpoint.responseTime}ms)${colors.reset}`);
    
    return bestEndpoint;
  }

  /**
   * Get connection with automatic fallback
   */
  async getOptimizedConnection() {
    try {
      return await this.getConnection();
    } catch (error) {
      console.log(`${colors.yellow}🔄 Primary endpoint failed, trying fallbacks...${colors.reset}`);
      return await this.getFallbackConnection();
    }
  }
}

// Create global instance
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