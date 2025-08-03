import inquirer from 'inquirer';
import { colors } from '../colors.js';

// Function to extract token address from GMGN trend URL
export function extractTokenFromGMGNUrl(url) {
  try {
    // Parse the URL to extract the trend ID
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const trendId = pathParts[pathParts.length - 1];
    
    console.log(`${colors.cyan}Extracted trend ID: ${trendId}${colors.reset}`);
    return trendId;
  } catch (error) {
    console.error(`${colors.red}Error parsing GMGN URL: ${error.message}${colors.reset}`);
    return null;
  }
}

// Function to monitor GMGN trend
export async function monitorGMGNTrend(trendId) {
  try {
    console.log(`${colors.cyan}🔍 Starting GMGN trend monitoring for: ${trendId}${colors.reset}`);
    
    // Simulate fetching trend data from GMGN
    // In a real implementation, you would fetch from GMGN API
    const trendData = {
      trendId: trendId,
      tokens: [
        {
          address: '47M8ysSW...', // Example token address
          name: 'Trend Token 1',
          symbol: 'TREND1',
          price: 0.000015,
          change24h: 25.5,
          volume24h: 150000
        }
      ],
      lastUpdated: new Date().toISOString()
    };
    
    return trendData;
  } catch (error) {
    console.error(`${colors.red}Error monitoring GMGN trend: ${error.message}${colors.reset}`);
    return null;
  }
}

// Function to prompt for GMGN URL
export async function promptForGMGNUrl() {
  const { gmgnUrl } = await inquirer.prompt([
    {
      type: 'input',
      name: 'gmgnUrl',
      message: 'Enter GMGN trend URL (e.g., https://gmgn.ai/trend/47M8ysSW?chain=sol):',
      validate: (input) => {
        if (!input.includes('gmgn.ai/trend/')) {
          return 'Please enter a valid GMGN trend URL';
        }
        return true;
      }
    }
  ]);
  
  return gmgnUrl;
}

// Function to process GMGN trend data
export function processGMGNTrendData(trendData, state) {
  try {
    // Process trend data and add to state
    trendData.tokens.forEach((token, index) => {
      const trade = {
        Trade: {
          Buy: {
            Currency: {
              Name: token.name,
              Symbol: token.symbol,
              MintAddress: token.address,
              Decimals: 6
            },
            Price: token.price,
            PriceInUSD: token.price,
            Amount: 1000000
          },
          Sell: {
            Amount: 1000000,
            AmountInUSD: token.price * 1000000
          },
          Dex: {
            ProtocolName: 'gmgn',
            ProtocolFamily: 'GMGN'
          },
          Market: {
            MarketAddress: 'GMGN_TREND'
          }
        },
        Block: {
          Time: new Date().toISOString()
        },
        Transaction: {
          Signature: `gmgn-trend-${trendData.trendId}-${index}`
        }
      };
      
      state.addTrade(trade);
    });
    
    return true;
  } catch (error) {
    console.error(`${colors.red}Error processing GMGN trend data: ${error.message}${colors.reset}`);
    return false;
  }
} 