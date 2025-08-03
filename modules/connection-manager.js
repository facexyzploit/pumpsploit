import { colors } from '../colors.js';

// Connection Status Manager
export class ConnectionStatus {
  constructor() {
    this.bitquery = { status: 'disconnected', error: null };
    this.jupiter = { status: 'disconnected', error: null };
    this.birdeye = { status: 'disconnected', error: null };
  }

  updateStatus(service, status, error = null) {
    if (this[service]) {
      this[service].status = status;
      this[service].error = error;
    }
  }

  getStatus() {
    return {
      bitquery: this.bitquery,
      jupiter: this.jupiter,
      birdeye: this.birdeye
    };
  }

  async checkBitqueryConnection() {
    try {
      // Simulate BitQuery connection check
      this.updateStatus('bitquery', 'connected');
      return true;
    } catch (error) {
      this.updateStatus('bitquery', 'error', error.message);
      return false;
    }
  }

  async checkJupiterConnection() {
    try {
      // Simulate Jupiter connection check
      this.updateStatus('jupiter', 'connected');
      return true;
    } catch (error) {
      this.updateStatus('jupiter', 'error', error.message);
      return false;
    }
  }

  async checkBirdeyeConnection() {
    try {
      // Simulate Birdeye connection check
      this.updateStatus('birdeye', 'connected');
      return true;
    } catch (error) {
      this.updateStatus('birdeye', 'error', error.message);
      return false;
    }
  }

  async checkAllConnections() {
    await Promise.all([
      this.checkBitqueryConnection(),
      this.checkJupiterConnection(),
      this.checkBirdeyeConnection()
    ]);
  }
}

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