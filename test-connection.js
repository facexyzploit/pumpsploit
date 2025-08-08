import { connectionManager } from './modules/connection-manager.js';
import { colors } from './colors.js';
import { loadSettings } from './bitquery-stream.js';

// Connection test script
export async function testConnection() {
  console.log(`${colors.cyan}🔍 BitQuery Connection Test${colors.reset}`);
  console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  
  try {
    // Load settings
    const settings = await loadSettings();
    
    if (!settings.bitqueryApiKey) {
      console.log(`${colors.red}❌ No API key found!${colors.reset}`);
      console.log(`${colors.yellow}💡 Please set your BitQuery API key in Settings${colors.reset}`);
      return false;
    }
    
    console.log(`${colors.green}✅ API key found${colors.reset}`);
    console.log(`${colors.dim}Key: ${settings.bitqueryApiKey.substring(0, 10)}...${settings.bitqueryApiKey.substring(settings.bitqueryApiKey.length - 4)}${colors.reset}\n`);
    
    // Set API key in connection manager
    connectionManager.setApiKey(settings.bitqueryApiKey);
    
    // Test connection
    console.log(`${colors.cyan}🔄 Testing BitQuery connection...${colors.reset}`);
    const connected = await connectionManager.checkBitqueryConnection();
    
    if (connected) {
      console.log(`${colors.green}✅ BitQuery connection successful!${colors.reset}`);
      
      // Test Jupiter connection too
      console.log(`${colors.cyan}🔄 Testing Jupiter connection...${colors.reset}`);
      const jupiterConnected = await connectionManager.checkJupiterConnection();
      
      if (jupiterConnected) {
        console.log(`${colors.green}✅ Jupiter connection successful!${colors.reset}`);
      } else {
        console.log(`${colors.yellow}⚠️ Jupiter connection failed: ${connectionManager.getLastError('jupiter')}${colors.reset}`);
      }
      
      // Display full status
      connectionManager.displayConnectionStatus();
      
      return true;
    } else {
      console.log(`${colors.red}❌ BitQuery connection failed!${colors.reset}`);
      console.log(`${colors.yellow}Error: ${connectionManager.getLastError('bitquery')}${colors.reset}\n`);
      
      // Provide troubleshooting tips
      console.log(`${colors.cyan}🔧 Troubleshooting Tips:${colors.reset}`);
      console.log(`   • Check your internet connection`);
      console.log(`   • Verify your API key is correct`);
      console.log(`   • Make sure your BitQuery account is active`);
      console.log(`   • Check if you've exceeded your API limits`);
      console.log(`   • Try updating your API key in Settings\n`);
      
      return false;
    }
    
  } catch (error) {
    console.error(`${colors.red}❌ Connection test failed: ${error.message}${colors.reset}`);
    return false;
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testConnection().then(success => {
    if (success) {
      console.log(`\n${colors.green}🎉 All tests passed! Your connection is working properly.${colors.reset}`);
    } else {
      console.log(`\n${colors.red}❌ Connection test failed. Please check the issues above.${colors.reset}`);
    }
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error(`${colors.red}❌ Test crashed: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}
