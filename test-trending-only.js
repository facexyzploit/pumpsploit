import { colors } from './colors.js';
import { trendingOptimizer } from './modules/performance-optimizer.js';

// Minimal test for trending functionality
async function testTrendingOnly() {
  console.log(`${colors.cyan}🧪 Testing Trending Functionality Only${colors.reset}`);
  
  try {
    // Create minimal mock data
    const mockRecentTrades = [
      {
        Trade: {
          Buy: {
            Currency: {
              Name: 'TestToken',
              Symbol: 'TEST',
              MintAddress: 'mint1234567890123456789012345678901234567890',
              Decimals: 9,
              Fungible: true
            },
            Price: 0.0001,
            PriceInUSD: 0.0001,
            Amount: 1000000,
            AmountInUSD: 100
          },
          Dex: {
            ProtocolName: 'Raydium',
            ProtocolFamily: 'Raydium'
          }
        },
        Block: { Time: new Date().toISOString() },
        Transaction: { Signature: 'sig123' }
      }
    ];
    
    const mockPreviousTrades = [
      {
        Trade: {
          Buy: {
            Currency: {
              MintAddress: 'mint1234567890123456789012345678901234567890'
            },
            PriceInUSD: 0.00005,
            AmountInUSD: 50
          }
        },
        Block: { Time: new Date(Date.now() - 300000).toISOString() }
      }
    ];
    
    console.log(`${colors.green}✅ Mock data created${colors.reset}`);
    
    // Test trending optimizer
    console.log(`${colors.cyan}Testing trending optimizer...${colors.reset}`);
    const result = await trendingOptimizer.processTrendingTokensOptimized(mockRecentTrades, mockPreviousTrades);
    
    console.log(`${colors.green}✅ Trending optimizer completed${colors.reset}`);
    console.log(`Result: ${JSON.stringify(result, null, 2)}`);
    
    return true;
    
  } catch (error) {
    console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
    console.error(`${colors.red}Stack: ${error.stack}${colors.reset}`);
    return false;
  }
}

// Run test
if (import.meta.url === `file://${process.argv[1]}`) {
  testTrendingOnly().then(success => {
    if (success) {
      console.log(`\n${colors.green}🎉 Trending test completed successfully!${colors.reset}`);
    } else {
      console.log(`\n${colors.red}❌ Trending test failed.${colors.reset}`);
    }
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error(`${colors.red}❌ Test crashed: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}
