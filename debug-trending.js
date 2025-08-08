import { colors } from './colors.js';

// Debug script to isolate const reassignment error
async function debugTrending() {
  console.log(`${colors.cyan}🔍 Debugging Trending Error${colors.reset}`);
  
  try {
    // Test 1: Check if the error is in the trending display cache
    console.log(`${colors.yellow}Test 1: Checking trending display cache...${colors.reset}`);
    const trendingDisplayCache = new Map();
    const TRENDING_CACHE_DURATION = 30000;
    
    // Test cache operations
    trendingDisplayCache.set('test', { display: 'test', timestamp: Date.now() });
    console.log(`${colors.green}✅ Cache operations working${colors.reset}`);
    
    // Test 2: Check if the error is in the trending optimizer import
    console.log(`${colors.yellow}Test 2: Checking trending optimizer import...${colors.reset}`);
    const { trendingOptimizer } = await import('./modules/performance-optimizer.js');
    console.log(`${colors.green}✅ Trending optimizer import working${colors.reset}`);
    
    // Test 3: Check if the error is in the connection manager import
    console.log(`${colors.yellow}Test 3: Checking connection manager import...${colors.reset}`);
    const { connectionManager } = await import('./modules/connection-manager.js');
    console.log(`${colors.green}✅ Connection manager import working${colors.reset}`);
    
    // Test 4: Check if the error is in the display function
    console.log(`${colors.yellow}Test 4: Checking display function import...${colors.reset}`);
    const { displayTrendingToken } = await import('./bitquery-stream.js');
    console.log(`${colors.green}✅ Display function import working${colors.reset}`);
    
    // Test 5: Check if the error is in the state import
    console.log(`${colors.yellow}Test 5: Checking state import...${colors.reset}`);
    const { OptimizedAppState } = await import('./state.js');
    console.log(`${colors.green}✅ State import working${colors.reset}`);
    
    console.log(`${colors.green}🎉 All imports and basic operations working!${colors.reset}`);
    return true;
    
  } catch (error) {
    console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
    console.error(`${colors.red}Stack: ${error.stack}${colors.reset}`);
    return false;
  }
}

// Run debug
if (import.meta.url === `file://${process.argv[1]}`) {
  debugTrending().then(success => {
    if (success) {
      console.log(`\n${colors.green}🎉 Debug completed successfully!${colors.reset}`);
    } else {
      console.log(`\n${colors.red}❌ Debug failed.${colors.reset}`);
    }
    process.exit(success ? 0 : 1);
  }).catch(error => {
    console.error(`${colors.red}❌ Debug crashed: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}
