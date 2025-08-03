import { colors } from '../colors.js';

// Enhanced connection status display
export class ConnectionDisplay {
  constructor(connectionStatus) {
    this.connectionStatus = connectionStatus;
  }

  // Display connection status with enhanced styling
  displayStatus() {
    console.log(`\n${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}🔗 CONNECTION STATUS${colors.reset}`);
    console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}\n`);
    
    const status = this.connectionStatus.getStatus();
    const services = [
      { name: 'BitQuery', status: status.bitquery, icon: '🔍', description: 'Real-time trade data' },
      { name: 'Jupiter', status: status.jupiter, icon: '🪐', description: 'Token analysis & pricing' },
      { name: 'Birdeye', status: status.birdeye, icon: '👁️', description: 'Market data & charts' }
    ];
    
    let allConnected = true;
    
    services.forEach(service => {
      const isConnected = service.status.connected;
      const statusColor = isConnected ? colors.green : colors.red;
      const statusText = isConnected ? '● Connected' : '● Disconnected';
      const statusIcon = isConnected ? '✅' : '❌';
      
      if (!isConnected) allConnected = false;
      
      console.log(`${service.icon} ${colors.bright}${service.name}${colors.reset}`);
      console.log(`   ${statusIcon} ${statusColor}${statusText}${colors.reset}`);
      console.log(`   📝 ${service.description}`);
      
      if (!isConnected && service.status.error) {
        console.log(`   ${colors.red}⚠️  Error: ${service.status.error}${colors.reset}`);
      }
      
      console.log('');
    });
    
    // Overall status
    const overallColor = allConnected ? colors.green : colors.yellow;
    const overallText = allConnected ? 'All services connected' : 'Some services disconnected';
    console.log(`${overallColor}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${overallColor}📊 Overall Status: ${overallText}${colors.reset}`);
    console.log(`${overallColor}${'═'.repeat(60)}${colors.reset}\n`);
    
    // Quick actions
    this.displayQuickActions();
  }

  // Display quick actions for connection management
  displayQuickActions() {
    console.log(`${colors.yellow}💡 Quick Actions:${colors.reset}`);
    console.log(`  ${colors.cyan}[R]${colors.reset} Retry all connections`);
    console.log(`  ${colors.cyan}[S]${colors.reset} Show detailed status`);
    console.log(`  ${colors.cyan}[T]${colors.reset} Test individual services`);
    console.log(`  ${colors.cyan}[M]${colors.reset} Return to main menu`);
    console.log(`  ${colors.cyan}[H]${colors.reset} Help & troubleshooting\n`);
  }

  // Display detailed connection information
  displayDetailedStatus() {
    console.log(`\n${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}🔍 DETAILED CONNECTION STATUS${colors.reset}`);
    console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}\n`);
    
    const status = this.connectionStatus.getStatus();
    
    // BitQuery details
    console.log(`${colors.blue}🔍 BitQuery Connection:${colors.reset}`);
    console.log(`   Status: ${status.bitquery.connected ? colors.green + 'Connected' : colors.red + 'Disconnected'}${colors.reset}`);
    console.log(`   Response Time: ${status.bitquery.responseTime || 'N/A'}ms`);
    console.log(`   Last Check: ${status.bitquery.lastCheck || 'N/A'}`);
    if (status.bitquery.error) {
      console.log(`   Error: ${colors.red}${status.bitquery.error}${colors.reset}`);
    }
    console.log('');
    
    // Jupiter details
    console.log(`${colors.green}🪐 Jupiter Connection:${colors.reset}`);
    console.log(`   Status: ${status.jupiter.connected ? colors.green + 'Connected' : colors.red + 'Disconnected'}${colors.reset}`);
    console.log(`   Response Time: ${status.jupiter.responseTime || 'N/A'}ms`);
    console.log(`   Last Check: ${status.jupiter.lastCheck || 'N/A'}`);
    if (status.jupiter.error) {
      console.log(`   Error: ${colors.red}${status.jupiter.error}${colors.reset}`);
    }
    console.log('');
    
    // Birdeye details
    console.log(`${colors.purple}👁️  Birdeye Connection:${colors.reset}`);
    console.log(`   Status: ${status.birdeye.connected ? colors.green + 'Connected' : colors.red + 'Disconnected'}${colors.reset}`);
    console.log(`   Response Time: ${status.birdeye.responseTime || 'N/A'}ms`);
    console.log(`   Last Check: ${status.birdeye.lastCheck || 'N/A'}`);
    if (status.birdeye.error) {
      console.log(`   Error: ${colors.red}${status.birdeye.error}${colors.reset}`);
    }
    console.log('');
  }

  // Display connection test results
  async displayTestResults() {
    console.log(`\n${colors.cyan}🧪 Testing Connections...${colors.reset}\n`);
    
    const services = [
      { name: 'BitQuery', test: () => this.connectionStatus.checkBitqueryConnection() },
      { name: 'Jupiter', test: () => this.connectionStatus.checkJupiterConnection() },
      { name: 'Birdeye', test: () => this.connectionStatus.checkBirdeyeConnection() }
    ];
    
    for (const service of services) {
      console.log(`Testing ${service.name}...`);
      try {
        const result = await service.test();
        const status = result ? colors.green + 'PASS' : colors.red + 'FAIL';
        console.log(`  ${status}${colors.reset}\n`);
      } catch (error) {
        console.log(`  ${colors.red}FAIL${colors.reset} - ${error.message}\n`);
      }
    }
  }

  // Display troubleshooting tips
  displayTroubleshooting() {
    console.log(`\n${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
    console.log(`${colors.bright}${colors.cyan}🔧 TROUBLESHOOTING GUIDE${colors.reset}`);
    console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}\n`);
    
    console.log(`${colors.yellow}Common Issues & Solutions:${colors.reset}\n`);
    
    console.log(`${colors.red}❌ BitQuery Connection Failed:${colors.reset}`);
    console.log(`  • Check your API key in settings`);
    console.log(`  • Verify internet connection`);
    console.log(`  • Check BitQuery service status`);
    console.log(`  • Try refreshing the connection\n`);
    
    console.log(`${colors.red}❌ Jupiter Connection Failed:${colors.reset}`);
    console.log(`  • Check Jupiter API status`);
    console.log(`  • Verify network connectivity`);
    console.log(`  • Try alternative endpoints`);
    console.log(`  • Check rate limiting\n`);
    
    console.log(`${colors.red}❌ Birdeye Connection Failed:${colors.reset}`);
    console.log(`  • Check Birdeye service status`);
    console.log(`  • Verify API access`);
    console.log(`  • Check network connectivity`);
    console.log(`  • Try refreshing the connection\n`);
    
    console.log(`${colors.yellow}💡 General Tips:${colors.reset}`);
    console.log(`  • Restart the application`);
    console.log(`  • Check firewall settings`);
    console.log(`  • Update API keys if needed`);
    console.log(`  • Contact support if issues persist\n`);
    
    console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
  }

  // Display connection health metrics
  displayHealthMetrics() {
    console.log(`\n${colors.cyan}📊 Connection Health Metrics${colors.reset}`);
    console.log(`${colors.cyan}${'═'.repeat(50)}${colors.reset}\n`);
    
    const status = this.connectionStatus.getStatus();
    const services = [
      { name: 'BitQuery', status: status.bitquery },
      { name: 'Jupiter', status: status.jupiter },
      { name: 'Birdeye', status: status.birdeye }
    ];
    
    services.forEach(service => {
      const health = this.calculateHealthScore(service.status);
      const healthColor = health >= 80 ? colors.green : health >= 60 ? colors.yellow : colors.red;
      const healthText = health >= 80 ? 'Excellent' : health >= 60 ? 'Good' : 'Poor';
      
      console.log(`${service.name}:`);
      console.log(`  Health Score: ${healthColor}${health}%${colors.reset}`);
      console.log(`  Status: ${healthColor}${healthText}${colors.reset}`);
      console.log(`  Response Time: ${service.status.responseTime || 'N/A'}ms`);
      console.log('');
    });
  }

  // Calculate health score for a service
  calculateHealthScore(status) {
    if (!status.connected) return 0;
    
    let score = 100;
    
    // Deduct points for slow response time
    if (status.responseTime > 5000) score -= 30;
    else if (status.responseTime > 2000) score -= 15;
    else if (status.responseTime > 1000) score -= 5;
    
    // Deduct points for errors
    if (status.error) score -= 20;
    
    return Math.max(0, score);
  }

  // Display connection summary
  displaySummary() {
    const status = this.connectionStatus.getStatus();
    const connectedServices = Object.values(status).filter(s => s.connected).length;
    const totalServices = Object.keys(status).length;
    
    console.log(`\n${colors.cyan}📈 Connection Summary${colors.reset}`);
    console.log(`${colors.cyan}${'═'.repeat(40)}${colors.reset}`);
    console.log(`Connected Services: ${colors.green}${connectedServices}/${totalServices}${colors.reset}`);
    console.log(`Overall Health: ${this.getOverallHealthColor(connectedServices, totalServices)}${this.getOverallHealthText(connectedServices, totalServices)}${colors.reset}`);
    console.log(`${colors.cyan}${'═'.repeat(40)}${colors.reset}\n`);
  }

  getOverallHealthColor(connected, total) {
    const percentage = (connected / total) * 100;
    if (percentage >= 80) return colors.green;
    if (percentage >= 60) return colors.yellow;
    return colors.red;
  }

  getOverallHealthText(connected, total) {
    const percentage = (connected / total) * 100;
    if (percentage >= 80) return 'Excellent';
    if (percentage >= 60) return 'Good';
    if (percentage >= 40) return 'Fair';
    return 'Poor';
  }
}

// Export singleton instance
export const connectionDisplay = new ConnectionDisplay(); 