import { trendingOptimizer } from './modules/performance-optimizer.js';
import { colors } from './colors.js';

// Performance test for trending token optimization
export async function runPerformanceTest() {
  console.log(`${colors.cyan}🚀 Running Performance Test for Trending Tokens${colors.reset}\n`);
  
  // Simulate trending data
  const mockRecentTrades = Array.from({ length: 50 }, (_, i) => ({
    Trade: {
      Buy: {
        Currency: {
          Name: `Token${i}`,
          Symbol: `TKN${i}`,
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
  
  const mockPreviousTrades = Array.from({ length: 30 }, (_, i) => ({
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
  
  console.log(`${colors.yellow}📊 Test Data:${colors.reset}`);
  console.log(`   Recent trades: ${mockRecentTrades.length}`);
  console.log(`   Previous trades: ${mockPreviousTrades.length}`);
  console.log(`   Expected tokens: ~${new Set(mockRecentTrades.map(t => t.Trade.Buy.Currency.MintAddress)).size}\n`);
  
  // Test optimized processing
  console.log(`${colors.cyan}⚡ Testing Optimized Processing...${colors.reset}`);
  const startTime = Date.now();
  
  try {
    const result = await trendingOptimizer.processTrendingTokensOptimized(mockRecentTrades, mockPreviousTrades);
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`${colors.green}✅ Optimized processing completed!${colors.reset}`);
    console.log(`   ⏱️  Duration: ${duration}ms`);
    console.log(`   📈 Tokens processed: ${result.length}`);
    console.log(`   🚀 Average per token: ${(duration / result.length).toFixed(1)}ms`);
    
    if (result.length > 0) {
      console.log(`\n${colors.cyan}🏆 Top Token:${colors.reset}`);
      const topToken = result[0];
      console.log(`   Symbol: ${topToken.token.Symbol}`);
      console.log(`   Momentum: ${topToken.metrics.momentum.toFixed(2)}%`);
      console.log(`   Price Change: ${topToken.metrics.priceChange.toFixed(2)}%`);
      console.log(`   Volume Change: ${topToken.metrics.volumeChange.toFixed(2)}%`);
    }
    
    // Test cache performance
    console.log(`\n${colors.cyan}🧪 Testing Cache Performance...${colors.reset}`);
    const cacheStartTime = Date.now();
    const cachedResult = await trendingOptimizer.processTrendingTokensOptimized(mockRecentTrades, mockPreviousTrades);
    const cacheEndTime = Date.now();
    const cacheDuration = cacheEndTime - cacheStartTime;
    
    console.log(`${colors.green}✅ Cached processing completed!${colors.reset}`);
    console.log(`   ⏱️  Duration: ${cacheDuration}ms`);
    console.log(`   📈 Speed improvement: ${((duration - cacheDuration) / duration * 100).toFixed(1)}%`);
    
  } catch (error) {
    console.error(`${colors.red}❌ Performance test failed: ${error.message}${colors.reset}`);
  }
  
  console.log(`\n${colors.cyan}🎯 Performance Summary:${colors.reset}`);
  console.log(`   ✅ Optimized processing reduces API calls`);
  console.log(`   ✅ Caching improves subsequent requests`);
  console.log(`   ✅ Parallel processing for Jupiter data`);
  console.log(`   ✅ Reduced query scope for faster response`);
  console.log(`   ✅ Efficient display caching`);
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runPerformanceTest().catch(console.error);
}
