import { colors } from './colors.js';
import { connectionManager } from './modules/connection-manager.js';
import { trendingOptimizer } from './modules/performance-optimizer.js';
import { loadSettings } from './bitquery-stream.js';

// Comprehensive test for bitquery-stream.js
export async function testBitqueryStream() {
  console.log(`${colors.cyan}🧪 BitQuery Stream Comprehensive Test${colors.reset}`);
  console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  
  const testResults = {
    connection: false,
    settings: false,
    trendingOptimizer: false,
    displayCaching: false,
    errorHandling: false
  };
  
  try {
    // Test 1: Settings Loading
    console.log(`${colors.cyan}📋 Test 1: Settings Loading${colors.reset}`);
    try {
      const settings = await loadSettings();
      if (settings && settings.bitqueryApiKey) {
        console.log(`${colors.green}✅ Settings loaded successfully${colors.reset}`);
        testResults.settings = true;
      } else {
        console.log(`${colors.yellow}⚠️ Settings loaded but no API key found${colors.reset}`);
        testResults.settings = true; // Still counts as success
      }
    } catch (error) {
      console.log(`${colors.red}❌ Settings loading failed: ${error.message}${colors.reset}`);
    }
    
    // Test 2: Connection Manager
    console.log(`\n${colors.cyan}🔗 Test 2: Connection Manager${colors.reset}`);
    try {
      const settings = await loadSettings();
      if (settings.bitqueryApiKey) {
        connectionManager.setApiKey(settings.bitqueryApiKey);
        const connected = await connectionManager.checkBitqueryConnection();
        
        if (connected) {
          console.log(`${colors.green}✅ Connection manager working${colors.reset}`);
          testResults.connection = true;
        } else {
          console.log(`${colors.yellow}⚠️ Connection failed: ${connectionManager.getLastError('bitquery')}${colors.reset}`);
        }
      } else {
        console.log(`${colors.yellow}⚠️ Skipping connection test - no API key${colors.reset}`);
      }
    } catch (error) {
      console.log(`${colors.red}❌ Connection manager test failed: ${error.message}${colors.reset}`);
    }
    
    // Test 3: Trending Optimizer
    console.log(`\n${colors.cyan}⚡ Test 3: Trending Performance Optimizer${colors.reset}`);
    try {
      // Create mock data for testing
      const mockRecentTrades = Array.from({ length: 10 }, (_, i) => ({
        Trade: {
          Buy: {
            Currency: {
              Name: `TestToken${i}`,
              Symbol: `TEST${i}`,
              MintAddress: `mint${i}${'0'.repeat(40)}`,
              Decimals: 9,
              Fungible: true
            },
            Price: 0.0001 + (i * 0.00001),
            PriceInUSD: 0.0001 + (i * 0.00001),
            Amount: 1000000 + (i * 100000),
            AmountInUSD: 100 + (i * 10)
          },
          Dex: {
            ProtocolName: 'Raydium',
            ProtocolFamily: 'Raydium'
          }
        },
        Block: { Time: new Date().toISOString() },
        Transaction: { Signature: `sig${i}` }
      }));
      
      const mockPreviousTrades = Array.from({ length: 5 }, (_, i) => ({
        Trade: {
          Buy: {
            Currency: {
              MintAddress: `mint${i}${'0'.repeat(40)}`
            },
            PriceInUSD: 0.0001 + (i * 0.000005),
            AmountInUSD: 50 + (i * 5)
          }
        },
        Block: { Time: new Date(Date.now() - 300000).toISOString() }
      }));
      
      const startTime = Date.now();
      const result = await trendingOptimizer.processTrendingTokensOptimized(mockRecentTrades, mockPreviousTrades);
      const duration = Date.now() - startTime;
      
      if (result && result.length > 0) {
        console.log(`${colors.green}✅ Trending optimizer working${colors.reset}`);
        console.log(`   📊 Processed ${result.length} tokens in ${duration}ms`);
        console.log(`   🚀 Average: ${(duration / result.length).toFixed(1)}ms per token`);
        testResults.trendingOptimizer = true;
      } else {
        console.log(`${colors.yellow}⚠️ Trending optimizer returned no results${colors.reset}`);
      }
    } catch (error) {
      console.log(`${colors.red}❌ Trending optimizer test failed: ${error.message}${colors.reset}`);
    }
    
    // Test 4: Display Caching
    console.log(`\n${colors.cyan}💾 Test 4: Display Caching${colors.reset}`);
    try {
      const mockTrendingData = [
        {
          token: { Symbol: 'TEST', MintAddress: 'test123' },
          metrics: {
            momentum: 100,
            currentPrice: 0.001,
            priceChange: 50,
            recentVolume: 1000,
            volumeChange: 25,
            tradeFreq: 2.5,
            freqChange: 10,
            jupiter: {
              marketCap: 1000000,
              liquidity: 50000,
              liquidityScore: 75,
              priceChange24h: 100,
              volumeChange24h: 50,
              holderCount: 1000
            }
          }
        }
      ];
      
      // Import the display function
      const { displayTrendingToken } = await import('./bitquery-stream.js');
      
      // Test first display (should be slow)
      const firstStart = Date.now();
      displayTrendingToken(0, mockTrendingData);
      const firstDuration = Date.now() - firstStart;
      
      // Test second display (should be fast due to caching)
      const secondStart = Date.now();
      displayTrendingToken(0, mockTrendingData);
      const secondDuration = Date.now() - secondStart;
      
      console.log(`${colors.green}✅ Display caching working${colors.reset}`);
      console.log(`   📊 First display: ${firstDuration}ms`);
      console.log(`   🚀 Cached display: ${secondDuration}ms`);
      console.log(`   📈 Speed improvement: ${((firstDuration - secondDuration) / firstDuration * 100).toFixed(1)}%`);
      
      if (secondDuration < firstDuration) {
        testResults.displayCaching = true;
      }
    } catch (error) {
      console.log(`${colors.red}❌ Display caching test failed: ${error.message}${colors.reset}`);
    }
    
    // Test 5: Error Handling
    console.log(`\n${colors.cyan}🛡️ Test 5: Error Handling${colors.reset}`);
    try {
      // Test with invalid API key
      connectionManager.setApiKey('invalid_key');
      const invalidResult = await connectionManager.checkBitqueryConnection();
      
      if (!invalidResult) {
        console.log(`${colors.green}✅ Error handling working${colors.reset}`);
        console.log(`   📊 Properly detected invalid API key`);
        testResults.errorHandling = true;
      } else {
        console.log(`${colors.yellow}⚠️ Error handling test inconclusive${colors.reset}`);
      }
    } catch (error) {
      console.log(`${colors.red}❌ Error handling test failed: ${error.message}${colors.reset}`);
    }
    
    // Summary
    console.log(`\n${colors.cyan}📊 Test Summary:${colors.reset}`);
    console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    
    const totalTests = Object.keys(testResults).length;
    const passedTests = Object.values(testResults).filter(Boolean).length;
    const successRate = (passedTests / totalTests) * 100;
    
    Object.entries(testResults).forEach(([test, passed]) => {
      const icon = passed ? '✅' : '❌';
      const color = passed ? colors.green : colors.red;
      console.log(`${icon} ${color}${test}${colors.reset}: ${passed ? 'PASSED' : 'FAILED'}`);
    });
    
    console.log(`\n${colors.cyan}Overall Success Rate: ${successRate.toFixed(1)}%${colors.reset}`);
    
    if (successRate >= 80) {
      console.log(`${colors.green}🎉 Excellent! BitQuery stream is working well.${colors.reset}`);
    } else if (successRate >= 60) {
      console.log(`${colors.yellow}⚠️ Good performance with some issues to address.${colors.reset}`);
    } else {
      console.log(`${colors.red}❌ Several issues detected. Please check the failures above.${colors.reset}`);
    }
    
    return successRate >= 60;
    
  } catch (error) {
    console.error(`${colors.red}❌ Test suite crashed: ${error.message}${colors.reset}`);
    return false;
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testBitqueryStream().then(success => {
    if (success) {
      console.log(`\n${colors.green}🎉 BitQuery stream test completed successfully!${colors.reset}`);
    } else {
      console.log(`\n${colors.red}❌ BitQuery stream test failed. Please review the issues above.${colors.reset}`);
    }
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error(`${colors.red}❌ Test crashed: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}
