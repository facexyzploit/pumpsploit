import fetch from 'node-fetch';
import { Keypair, Connection, LAMPORTS_PER_SOL, Transaction, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import { colors } from '../colors.js';
import { logToFile } from '../logger.js';
import { SettingsManager } from './settings-manager.js';

// Jupiter API endpoints
const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote';
const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6/swap';
const JUPITER_SWAP_TRANSACTION_API = 'https://quote-api.jup.ag/v6/swap';

// Jupiter Lite API endpoints
const JUPITER_LITE_SWAP_API = 'https://lite-api.jup.ag/swap/v1/swap';

// Ultra V2 API endpoints
const ULTRA_V2_QUOTE_API = 'https://quote-api.jup.ag/v6/quote';
const ULTRA_V2_SWAP_API = 'https://quote-api.jup.ag/v6/swap';

// Settings manager
const settingsManager = new SettingsManager();

// Get RPC endpoint from settings
export function getRpcEndpoint() {
  return settingsManager.get('enableCustomRpc') 
    ? settingsManager.get('customRpcEndpoint') 
    : 'https://api.mainnet-beta.solana.com';
}

/**
 * Get Ultra V2 quote with RTSE (Real-Time Slippage Estimation)
 * @param {string} fromMint - Source token mint address
 * @param {string} toMint - Destination token mint address  
 * @param {number} amount - Amount to swap (in smallest units)
 * @param {boolean} useUltraV2 - Whether to use Ultra V2 features
 * @returns {Promise<Object>} Quote information
 */
export async function getBestQuote(fromMint, toMint, amount, useUltraV2 = true) {
  try {
    console.log(`${colors.cyan}🔍 Getting best quote...${colors.reset}`);
    
    // Get slippage from settings
    const slippageLimit = settingsManager.get('slippageLimit') || 0.5;
    const slippageBps = Math.floor(slippageLimit * 100); // Convert % to basis points
    
    // Ultra V2 parameters
    const params = new URLSearchParams({
      inputMint: fromMint,
      outputMint: toMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
      onlyDirectRoutes: 'false',
      asLegacyTransaction: 'false'
    });
    
    // Add Ultra V2 specific parameters
    if (useUltraV2) {
      params.append('enableUltraV2', 'true');
      params.append('enableRTSE', 'true'); // Real-Time Slippage Estimation
      params.append('enableGasless', 'true'); // Gasless support
      console.log(`${colors.cyan}🚀 Using Jupiter Ultra V2 with RTSE${colors.reset}`);
    }

    const response = await fetch(`${JUPITER_QUOTE_API}?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const quote = await response.json();
    
    if (!quote) {
      throw new Error('No quote data received');
    }

    console.log(`${colors.green}✅ Quote received${colors.reset}`);
    console.log(`${colors.yellow}💰 Input: ${quote.inAmount} ${quote.inputMint}${colors.reset}`);
    console.log(`${colors.yellow}💰 Output: ${quote.outAmount} ${quote.outputMint}${colors.reset}`);
    console.log(`${colors.blue}📊 Price Impact: ${quote.priceImpactPct}%${colors.reset}`);
    console.log(`${colors.magenta}🔄 Route: ${quote.routePlan?.length || 0} hops${colors.reset}`);

    return quote;
  } catch (error) {
    console.error(`${colors.red}❌ Error getting quote: ${error.message}${colors.reset}`);
    logToFile(`Jupiter quote error: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Get Ultra V2 swap transaction with optimized settings
 * @param {Object} route - Quote route from getBestQuote
 * @param {string} userPublicKey - User's public key
 * @param {boolean} useUltraV2 - Whether to use Ultra V2 features
 * @returns {Promise<Object>} Transaction data
 */
export async function getSwapTransaction(route, userPublicKey, useUltraV2 = true) {
  try {
    console.log(`${colors.cyan}🔧 Building swap transaction...${colors.reset}`);
    
    // Get priority fee for the transaction
    const priorityFee = settingsManager.get('priorityFee') || 1000;
    
    // Ultra V2 optimized request body
    const requestBody = {
      quoteResponse: route,
      userPublicKey: userPublicKey,
      wrapUnwrapSOL: true,
      // Add required fields for v6 API
      otherAmountThreshold: route.outAmount,
      asLegacyTransaction: false
    };
    
    if (useUltraV2) {
      // Ultra V2 specific settings
      requestBody.ultraV2Settings = {
        enableRTSE: true,
        enableGasless: true,
        enableMEVMitigation: true,
        optimizeForSuccess: true
      };
      console.log(`${colors.cyan}🚀 Using Ultra V2 optimized settings${colors.reset}`);
    } else {
      // Standard v6 parameters
      requestBody.computeUnitPriceMicroLamports = priorityFee;
      requestBody.useSharedAccounts = true;
      requestBody.useTokenLedger = true;
    }
    
    const response = await fetch(JUPITER_SWAP_TRANSACTION_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const swapData = await response.json();
    
    if (!swapData.swapTransaction) {
      throw new Error('No swap transaction received');
    }

    console.log(`${colors.green}✅ Swap transaction built${colors.reset}`);
    return swapData;
  } catch (error) {
    console.error(`${colors.red}❌ Error building swap transaction: ${error.message}${colors.reset}`);
    logToFile(`Jupiter swap transaction error: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Perform Ultra V2 swap with optimized success rate
 * @param {string} fromMint - Source token mint address
 * @param {string} toMint - Destination token mint address
 * @param {number} amount - Amount to swap
 * @param {Object} wallet - Wallet object with keypair
 * @param {number} slippage - Slippage tolerance in basis points (default: 50 = 0.5%)
 * @param {boolean} useUltraV2 - Whether to use Ultra V2 features
 * @returns {Promise<Object>} Swap result
 */
export async function performSwap(fromMint, toMint, amount, wallet, slippage = null, useUltraV2 = true) {
  try {
    console.log(`${colors.cyan}🚀 Starting swap...${colors.reset}`);
    console.log(`${colors.yellow}From: ${fromMint}${colors.reset}`);
    console.log(`${colors.yellow}To: ${toMint}${colors.reset}`);
    console.log(`${colors.yellow}Amount: ${amount}${colors.reset}`);
    
    // Get settings
    const slippageLimit = slippage !== null ? slippage : settingsManager.get('slippageLimit') || 0.5;
    
    // Use moderate priority fee for stability
    let priorityFee = settingsManager.get('priorityFee') || 1000; // Moderate default
    try {
      const connection = new Connection(getRpcEndpoint());
      const recentPrioritizationFees = await connection.getRecentPrioritizationFees([
        new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4') // Jupiter program
      ]);
      
      if (recentPrioritizationFees.length > 0) {
        // Use moderate fee for stability
        const avgFee = recentPrioritizationFees.reduce((sum, fee) => sum + fee.prioritizationFee, 0) / recentPrioritizationFees.length;
        priorityFee = Math.max(avgFee, 500); // Use average fee, minimum 500
        console.log(`${colors.cyan}🔍 Auto-detected priority fee: ${priorityFee} micro-lamports${colors.reset}`);
      } else {
        console.log(`${colors.yellow}⚠️ Using default priority fee: ${priorityFee} micro-lamports${colors.reset}`);
      }
    } catch (error) {
      console.log(`${colors.yellow}⚠️ Could not auto-detect priority fee, using default: ${priorityFee} micro-lamports${colors.reset}`);
    }
    
    const tipAmount = settingsManager.get('tipAmount') || 0.0001;
    const rpcEndpoint = getRpcEndpoint();
    
    console.log(`${colors.yellow}Slippage: ${slippageLimit}%${colors.reset}`);
    console.log(`${colors.yellow}Priority Fee: ${priorityFee} micro-lamports${colors.reset}`);
    console.log(`${colors.yellow}Tip Amount: ${tipAmount} SOL${colors.reset}`);
    console.log(`${colors.yellow}RPC: ${rpcEndpoint}${colors.reset}`);

    // Get the best quote with Ultra V2
    const quote = await getBestQuote(fromMint, toMint, amount, useUltraV2);
    
    // Get swap transaction with Ultra V2 - wallet is a Keypair object
    const swapData = await getSwapTransaction(quote, wallet.publicKey.toString(), useUltraV2);
    
    // Sign and send transaction
    const connection = new Connection(rpcEndpoint);
    
    // Decode transaction - handle both legacy and versioned transactions
    let transaction;
    try {
      // Try versioned transaction first (v6 uses versioned transactions)
      transaction = VersionedTransaction.deserialize(Buffer.from(swapData.swapTransaction, 'base64'));
      
      // Sign versioned transaction - wallet is the keypair itself
      transaction.sign([wallet]);
      
      // Send versioned transaction with simple settings
      const signature = await connection.sendTransaction(transaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      });
      
      console.log(`${colors.green}✅ Swap transaction sent!${colors.reset}`);
      console.log(`${colors.blue}📝 Signature: ${signature}${colors.reset}`);
      
      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }
      
      console.log(`${colors.green}✅ Swap completed successfully!${colors.reset}`);
      
      return {
        success: true,
        signature: signature,
        quote: quote,
        confirmation: confirmation
      };
      
    } catch (versionedError) {
      console.log(`${colors.yellow}⚠️ Versioned transaction failed, trying legacy format...${colors.reset}`);
      try {
        // Fallback to legacy transaction
        transaction = Transaction.from(Buffer.from(swapData.swapTransaction, 'base64'));
        
        // Sign legacy transaction - wallet is the keypair itself
        transaction.sign(wallet);
        
        // Send legacy transaction (fallback)
        const signature = await connection.sendRawTransaction(transaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        });
        
        console.log(`${colors.green}✅ Swap transaction sent!${colors.reset}`);
        console.log(`${colors.blue}📝 Signature: ${signature}${colors.reset}`);
        
        // Wait for confirmation
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        
        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }
        
        console.log(`${colors.green}✅ Swap completed successfully!${colors.reset}`);
        
        return {
          success: true,
          signature: signature,
          quote: quote,
          confirmation: confirmation
        };
        
      } catch (legacyError) {
        console.error(`${colors.red}❌ Both versioned and legacy transaction formats failed${colors.reset}`);
        console.error(`${colors.red}Versioned error: ${versionedError.message}${colors.reset}`);
        console.error(`${colors.red}Legacy error: ${legacyError.message}${colors.reset}`);
        
        // Try alternative approach - use v5 API as fallback
        try {
          console.log(`${colors.cyan}🔄 Trying alternative API version...${colors.reset}`);
          
          // Use v5 API as fallback
          const v5Response = await fetch('https://quote-api.jup.ag/v5/swap', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              quoteResponse: quote,
              userPublicKey: wallet.publicKey.toString(),
              wrapUnwrapSOL: true
            })
          });
          
          if (v5Response.ok) {
            const v5SwapData = await v5Response.json();
            
            // Try with v5 transaction format
            transaction = Transaction.from(Buffer.from(v5SwapData.swapTransaction, 'base64'));
            transaction.sign(wallet);
            
            const signature = await connection.sendRawTransaction(transaction.serialize(), {
              skipPreflight: false,
              preflightCommitment: 'confirmed'
            });
            
            console.log(`${colors.green}✅ Swap transaction sent with v5 API!${colors.reset}`);
            console.log(`${colors.blue}📝 Signature: ${signature}${colors.reset}`);
            
            const confirmation = await connection.confirmTransaction(signature, 'confirmed');
            
            if (confirmation.value.err) {
              throw new Error(`Transaction failed: ${confirmation.value.err}`);
            }
            
            console.log(`${colors.green}✅ Swap completed successfully!${colors.reset}`);
            
            return {
              success: true,
              signature: signature,
              quote: quote,
              confirmation: confirmation
            };
          }
        } catch (v5Error) {
          console.error(`${colors.red}❌ v5 API fallback also failed: ${v5Error.message}${colors.reset}`);
        }
        
        throw new Error(`Failed to process transaction: ${versionedError.message} | ${legacyError.message}`);
      }
    }
    
  } catch (error) {
    console.error(`${colors.red}❌ Swap failed: ${error.message}${colors.reset}`);
    logToFile(`Jupiter swap error: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Perform swap using Jupiter Lite API with automatic retry for low liquidity tokens
 * @param {string} fromMint - Source token mint address
 * @param {string} toMint - Destination token mint address
 * @param {number} amount - Amount to swap
 * @param {Object} wallet - Wallet object with keypair
 * @param {number} slippage - Slippage tolerance in basis points (default: 50 = 0.5%)
 * @param {string} priorityLevel - Priority level: 'low', 'medium', 'high', 'veryHigh'
 * @returns {Promise<Object>} Swap result
 */
export async function performLiteSwap(fromMint, toMint, amount, wallet, slippage = null, priorityLevel = 'high') {
  try {
    console.log(`${colors.cyan}🚀 Starting Lite swap...${colors.reset}`);
    console.log(`${colors.yellow}From: ${fromMint}${colors.reset}`);
    console.log(`${colors.yellow}To: ${toMint}${colors.reset}`);
    console.log(`${colors.yellow}Amount: ${amount}${colors.reset}`);
    console.log(`${colors.yellow}Priority Level: ${priorityLevel}${colors.reset}`);
    
    // Get settings
    const slippageLimit = slippage !== null ? slippage : settingsManager.get('slippageLimit') || 0.5;
    const slippageBps = Math.floor(slippageLimit * 100);
    
    // Get quote first
    const quote = await getBestQuote(fromMint, toMint, amount, false); // Don't use Ultra V2 for Lite API
    
    // Prepare Lite API request
    const liteRequest = {
      userPublicKey: wallet.publicKey.toString(),
      quoteResponse: {
        inputMint: quote.inputMint,
        inAmount: quote.inAmount,
        outputMint: quote.outputMint,
        outAmount: quote.outAmount,
        otherAmountThreshold: quote.outAmount,
        swapMode: "ExactIn",
        slippageBps: slippageBps,
        platformFee: null,
        priceImpactPct: quote.priceImpactPct,
        routePlan: quote.routePlan
      },
      prioritizationFeeLamports: priorityLevel === 'veryHigh' ? 10000000 : 
                                 priorityLevel === 'high' ? 5000000 :
                                 priorityLevel === 'medium' ? 2000000 : 1000000,
      dynamicComputeUnitLimit: true
    };
    
    console.log(`${colors.cyan}🔧 Sending Lite API request...${colors.reset}`);
    
    // Send to Jupiter Lite API
    const response = await fetch(JUPITER_LITE_SWAP_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(liteRequest)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const swapResult = await response.json();
    
    if (!swapResult.swapTransaction) {
      throw new Error('No swap transaction received from Lite API');
    }
    
    console.log(`${colors.green}✅ Lite API transaction received${colors.reset}`);
    
    // Sign and send transaction
    const connection = new Connection(getRpcEndpoint());
    
    // Decode and sign transaction
    let transaction;
    try {
      // Try versioned transaction first
      transaction = VersionedTransaction.deserialize(Buffer.from(swapResult.swapTransaction, 'base64'));
      transaction.sign([wallet]);
    } catch (versionedError) {
      // Fallback to legacy transaction
      transaction = Transaction.from(Buffer.from(swapResult.swapTransaction, 'base64'));
      transaction.sign(wallet);
    }
    
    // Send transaction
    const signature = await connection.sendTransaction(transaction, {
      skipPreflight: false,
      preflightCommitment: 'confirmed'
    });
    
    console.log(`${colors.green}✅ Lite swap transaction sent!${colors.reset}`);
    console.log(`${colors.blue}📝 Signature: ${signature}${colors.reset}`);
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }
    
    console.log(`${colors.green}✅ Lite swap completed successfully!${colors.reset}`);
    
    return {
      success: true,
      signature: signature,
      quote: quote,
      confirmation: confirmation,
      method: 'lite'
    };
    
  } catch (error) {
    // Check for specific Jupiter errors that indicate low liquidity
    const errorMessage = error.message.toLowerCase();
    const isLowLiquidityError = errorMessage.includes('0x1788') || 
                                errorMessage.includes('insufficient liquidity') ||
                                errorMessage.includes('slippage exceeded') ||
                                errorMessage.includes('price impact too high');
    
    if (isLowLiquidityError) {
      console.log(`${colors.yellow}⚠️ Low liquidity detected. Trying with smaller amount...${colors.reset}`);
      
      // Try with 50% of the original amount
      const smallerAmount = Math.floor(amount * 0.5);
      
      if (smallerAmount > 0) {
        try {
          console.log(`${colors.cyan}🔄 Retrying with ${smallerAmount.toLocaleString()} tokens (50% of original)${colors.reset}`);
          return await performLiteSwap(fromMint, toMint, smallerAmount, wallet, slippage, priorityLevel);
        } catch (retryError) {
          // If 50% still fails, try with 25%
          const evenSmallerAmount = Math.floor(amount * 0.25);
          
          if (evenSmallerAmount > 0) {
            console.log(`${colors.cyan}🔄 Retrying with ${evenSmallerAmount.toLocaleString()} tokens (25% of original)${colors.reset}`);
            return await performLiteSwap(fromMint, toMint, evenSmallerAmount, wallet, slippage, priorityLevel);
          }
        }
      }
      
      // If all retries fail, provide helpful error message
      console.error(`${colors.red}❌ Token has very low liquidity. Try selling smaller amounts manually.${colors.reset}`);
      console.log(`${colors.yellow}💡 Suggested solutions:${colors.reset}`);
      console.log(`   • Try selling 25% or 50% instead of 100%`);
      console.log(`   • Check if the token has any liquidity on Jupiter`);
      console.log(`   • Consider burning the tokens instead`);
      
    } else {
      console.error(`${colors.red}❌ Lite swap failed: ${error.message}${colors.reset}`);
    }
    
    logToFile(`Jupiter Lite swap error: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Get token metadata including decimals
 * @param {string} mintAddress - Token mint address
 * @returns {Promise<Object>} Token metadata
 */
export async function getTokenMetadata(mintAddress) {
  try {
    const connection = new Connection(getRpcEndpoint());
    
    // Get token supply info which includes decimals
    const supply = await connection.getTokenSupply(new PublicKey(mintAddress));
    
    return {
      decimals: supply.value.decimals,
      supply: supply.value.amount,
      uiAmount: supply.value.uiAmount
    };
  } catch (error) {
    console.error(`${colors.red}❌ Error getting token metadata: ${error.message}${colors.reset}`);
    // Default to 9 decimals (common for most tokens)
    return { decimals: 9, supply: '0', uiAmount: 0 };
  }
}

/**
 * Get token info (ticker, name) from Jupiter API
 * @param {string} mintAddress - Token mint address
 * @returns {Promise<Object>} Token info
 */
export async function getTokenInfo(mintAddress) {
  try {
    const response = await fetch(`https://token.jup.ag/all`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    const tokens = data.tokens || [];
    const token = tokens.find(t => t.address === mintAddress);
    
    if (token) {
      return {
        symbol: token.symbol,
        name: token.name,
        logoURI: token.logoURI
      };
    } else {
      // Fallback: extract symbol from mint address
      return {
        symbol: mintAddress.slice(0, 4) + '...' + mintAddress.slice(-4),
        name: 'Unknown Token',
        logoURI: null
      };
    }
  } catch (error) {
    console.error(`${colors.red}❌ Error getting token info: ${error.message}${colors.reset}`);
    // Fallback: extract symbol from mint address
    return {
      symbol: mintAddress.slice(0, 4) + '...' + mintAddress.slice(-4),
      name: 'Unknown Token',
      logoURI: null
    };
  }
}

// Cache for token balances to improve performance
const tokenBalanceCache = new Map();
const CACHE_DURATION = 5000; // 5 seconds

/**
 * Get all token balances for a wallet (with caching for performance)
 * @param {string} walletAddress - Wallet address
 * @param {boolean} forceRefresh - Force refresh cache
 * @returns {Promise<Array>} Array of token balances
 */
export async function getAllTokenBalances(walletAddress, forceRefresh = false) {
  try {
    // Check cache first
    const cacheKey = walletAddress;
    const cached = tokenBalanceCache.get(cacheKey);
    
    if (!forceRefresh && cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return cached.data;
    }
    
    const connection = new Connection(getRpcEndpoint());
    
    // Get all token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(walletAddress),
      {
        programId: TOKEN_PROGRAM_ID
      }
    );
    
    const tokens = [];
    
    for (const account of tokenAccounts.value) {
      try {
        // Check if account has parsed data
        if (!account.account.data.parsed || !account.account.data.parsed.info) {
          continue;
        }
        
        const tokenInfo = account.account.data.parsed.info;
        
        // Check if tokenInfo has required properties
        if (!tokenInfo || typeof tokenInfo !== 'object') {
          continue;
        }
        
        // Check if mint property exists using safe property access
        if (!tokenInfo.mint) {
          continue;
        }
        
        // Check if tokenAmount property exists using safe property access
        if (!tokenInfo.tokenAmount) {
          continue;
        }
        
        const balance = tokenInfo.tokenAmount.uiAmount;
        
        // Only include tokens with non-zero balance
        if (balance > 0) {
          tokens.push({
            mint: tokenInfo.mint,
            balance: balance,
            decimals: tokenInfo.tokenAmount.decimals,
            symbol: tokenInfo.mint, // We'll get symbol later if needed
            account: account.pubkey.toString()
          });
        }
      } catch (error) {
        // Skip accounts that can't be parsed silently
        continue;
      }
    }
    
    // Cache the result
    tokenBalanceCache.set(cacheKey, {
      data: tokens,
      timestamp: Date.now()
    });
    
    return tokens;
  } catch (error) {
    console.error(`${colors.red}❌ Error getting all token balances: ${error.message}${colors.reset}`);
    // Return empty array instead of throwing
    return [];
  }
}

/**
 * Clear token balance cache
 */
export function clearTokenBalanceCache() {
  tokenBalanceCache.clear();
}

/**
 * Quick display of tokens with basic info (fast version)
 * @param {string} walletAddress - Wallet address
 * @returns {Promise<Array>} Array of tokens with basic info
 */
// Enhanced cache for Jupiter token list with longer duration
let jupiterTokenCache = null;
let jupiterTokenCacheTime = 0;
const JUPITER_CACHE_DURATION = 600000; // 10 minutes (increased for better performance)

// Enhanced token pattern matching for better human-readable names
const TOKEN_PATTERNS = {
  'BONK': { symbol: 'BONK', name: 'Bonk' },
  'PUMP': { symbol: 'PUMP', name: 'Pump Token' },
  'BAGS': { symbol: 'BAGS', name: 'Bags Token' },
  'SOL': { symbol: 'SOL', name: 'Solana' },
  'USDC': { symbol: 'USDC', name: 'USD Coin' },
  'USDT': { symbol: 'USDT', name: 'Tether USD' },
  'RAY': { symbol: 'RAY', name: 'Raydium' },
  'SRM': { symbol: 'SRM', name: 'Serum' },
  'ORCA': { symbol: 'ORCA', name: 'Orca' },
  'JUP': { symbol: 'JUP', name: 'Jupiter' },
  'PYTH': { symbol: 'PYTH', name: 'Pyth Network' },
  'WIF': { symbol: 'WIF', name: 'dogwifhat' },
  'POPCAT': { symbol: 'POPCAT', name: 'Popcat' },
  'BOOK': { symbol: 'BOOK', name: 'Book of Meme' },
  'MYRO': { symbol: 'MYRO', name: 'Myro' },
  'WEN': { symbol: 'WEN', name: 'Wen' },
  'SAMO': { symbol: 'SAMO', name: 'Samoyedcoin' },
  'COPE': { symbol: 'COPE', name: 'Cope' },
  'FIDA': { symbol: 'FIDA', name: 'Bonfida' },
  'MNGO': { symbol: 'MNGO', name: 'Mango' },
  'STEP': { symbol: 'STEP', name: 'Step Finance' },
  'ALEPH': { symbol: 'ALEPH', name: 'Aleph.im' },
  'KIN': { symbol: 'KIN', name: 'Kin' },
  'MEDIA': { symbol: 'MEDIA', name: 'Media Network' },
  'AUDIO': { symbol: 'AUDIO', name: 'Audius' },
  'HNT': { symbol: 'HNT', name: 'Helium' },
  'MOBILE': { symbol: 'MOBILE', name: 'Helium Mobile' },
  'IOT': { symbol: 'IOT', name: 'Helium IOT' },
  'RNDR': { symbol: 'RNDR', name: 'Render Token' },
  'LDO': { symbol: 'LDO', name: 'Lido DAO' },
  'UNI': { symbol: 'UNI', name: 'Uniswap' },
  'LINK': { symbol: 'LINK', name: 'Chainlink' },
  'AAVE': { symbol: 'AAVE', name: 'Aave' },
  'COMP': { symbol: 'COMP', name: 'Compound' },
  'MKR': { symbol: 'MKR', name: 'Maker' },
  'SNX': { symbol: 'SNX', name: 'Synthetix' },
  'CRV': { symbol: 'CRV', name: 'Curve DAO' },
  'BAL': { symbol: 'BAL', name: 'Balancer' },
  'YFI': { symbol: 'YFI', name: 'yearn.finance' },
  'SUSHI': { symbol: 'SUSHI', name: 'SushiSwap' },
  '1INCH': { symbol: '1INCH', name: '1inch' },
  'ZRX': { symbol: 'ZRX', name: '0x Protocol' },
  'BAT': { symbol: 'BAT', name: 'Basic Attention Token' },
  'ENJ': { symbol: 'ENJ', name: 'Enjin Coin' },
  'MANA': { symbol: 'MANA', name: 'Decentraland' },
  'SAND': { symbol: 'SAND', name: 'The Sandbox' },
  'AXS': { symbol: 'AXS', name: 'Axie Infinity' },
  'CHZ': { symbol: 'CHZ', name: 'Chiliz' },
  'FTT': { symbol: 'FTT', name: 'FTX Token' },
  'HT': { symbol: 'HT', name: 'Huobi Token' },
  'OKB': { symbol: 'OKB', name: 'OKB' },
  'BNB': { symbol: 'BNB', name: 'Binance Coin' },
  'ADA': { symbol: 'ADA', name: 'Cardano' },
  'DOT': { symbol: 'DOT', name: 'Polkadot' },
  'MATIC': { symbol: 'MATIC', name: 'Polygon' },
  'AVAX': { symbol: 'AVAX', name: 'Avalanche' },
  'ATOM': { symbol: 'ATOM', name: 'Cosmos' },
  'NEAR': { symbol: 'NEAR', name: 'NEAR Protocol' },
  'ALGO': { symbol: 'ALGO', name: 'Algorand' },
  'VET': { symbol: 'VET', name: 'VeChain' },
  'ICP': { symbol: 'ICP', name: 'Internet Computer' },
  'FIL': { symbol: 'FIL', name: 'Filecoin' },
  'THETA': { symbol: 'THETA', name: 'Theta Network' },
  'XTZ': { symbol: 'XTZ', name: 'Tezos' },
  'EOS': { symbol: 'EOS', name: 'EOS' },
  'TRX': { symbol: 'TRX', name: 'TRON' },
  'XLM': { symbol: 'XLM', name: 'Stellar' },
  'XRP': { symbol: 'XRP', name: 'Ripple' },
  'LTC': { symbol: 'LTC', name: 'Litecoin' },
  'BCH': { symbol: 'BCH', name: 'Bitcoin Cash' },
  'BTC': { symbol: 'BTC', name: 'Bitcoin' },
  'ETH': { symbol: 'ETH', name: 'Ethereum' }
};

export async function getQuickTokenDisplay(walletAddress, useFastMode = true) {
  try {
    const tokens = await getAllTokenBalances(walletAddress);
    
    if (tokens.length === 0) {
      return [];
    }
    
    if (useFastMode) {
      // Ultra-fast version with enhanced caching and pattern matching
      let allTokens = null;
      
      // Check if we have a recent cache of Jupiter tokens
      if (jupiterTokenCache && (Date.now() - jupiterTokenCacheTime) < JUPITER_CACHE_DURATION) {
        allTokens = jupiterTokenCache;
      } else {
        try {
          // Single API call to get all Jupiter tokens with timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
          
          const response = await fetch('https://token.jup.ag/all', {
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const data = await response.json();
            allTokens = data.tokens || [];
            jupiterTokenCache = allTokens;
            jupiterTokenCacheTime = Date.now();
          }
        } catch (error) {
          // Silently use fallback pattern matching
        }
      }
      
      const tokensWithInfo = tokens.map((token, index) => {
        // Try to find token info from Jupiter list first
        let tokenInfo = null;
        if (allTokens) {
          tokenInfo = allTokens.find(t => t.address === token.mint);
        }
        
        let symbol, name;
        
        if (tokenInfo) {
          // Use real token info from Jupiter
          symbol = tokenInfo.symbol;
          name = tokenInfo.name;
        } else {
          // Enhanced pattern matching with comprehensive token list
          const mintUpper = token.mint.toUpperCase();
          let found = false;
          
          // Check against comprehensive token patterns
          for (const [pattern, info] of Object.entries(TOKEN_PATTERNS)) {
            if (mintUpper.includes(pattern)) {
              symbol = info.symbol;
              name = info.name;
              found = true;
              break;
            }
          }
          
          if (!found) {
            // Try to extract readable ticker from mint address
            const lastPart = token.mint.slice(-8).toUpperCase();
            if (/^[A-Z]{3,6}$/.test(lastPart)) {
              symbol = lastPart;
              name = `${lastPart} Token`;
            } else {
              // Use first 4 chars as fallback
              symbol = token.mint.slice(0, 4).toUpperCase();
              name = 'Unknown Token';
            }
          }
        }
        
        return {
          index: index + 1,
          mint: token.mint,
          balance: token.balance,
          symbol: symbol,
          name: name,
          shortMint: token.mint.slice(0, 8) + '...' + token.mint.slice(-8),
          decimals: 9 // Default to 9 decimals for speed
        };
      });
      
      return tokensWithInfo;
    } else {
      // Full version with individual API calls (slower but more accurate)
      const tokensWithInfo = await Promise.all(
        tokens.map(async (token, index) => {
          try {
            const tokenInfo = await getTokenInfo(token.mint);
            const tokenMetadata = await getTokenMetadata(token.mint);
            
            return {
              index: index + 1,
              mint: token.mint,
              balance: token.balance,
              symbol: tokenInfo.symbol || token.mint.slice(0, 4).toUpperCase(),
              name: tokenInfo.name || 'Unknown Token',
              shortMint: token.mint.slice(0, 8) + '...' + token.mint.slice(-8),
              decimals: tokenMetadata.decimals || 9
            };
          } catch (error) {
            return {
              index: index + 1,
              mint: token.mint,
              balance: token.balance,
              symbol: token.mint.slice(0, 4).toUpperCase(),
              name: 'Unknown Token',
              shortMint: token.mint.slice(0, 8) + '...' + token.mint.slice(-8),
              decimals: 9
            };
          }
        })
      );
      
      return tokensWithInfo;
    }
  } catch (error) {
    console.error(`${colors.red}❌ Error getting quick token display: ${error.message}${colors.reset}`);
    return [];
  }
}

/**
 * Enhanced token info checker with real human-readable names
 * @param {string} mintAddress - Token mint address
 * @returns {Promise<Object>} Token info with real name
 */
export async function getEnhancedTokenInfo(mintAddress) {
  try {
    // First try Jupiter token list
    if (jupiterTokenCache && (Date.now() - jupiterTokenCacheTime) < JUPITER_CACHE_DURATION) {
      const tokenInfo = jupiterTokenCache.find(t => t.address === mintAddress);
      if (tokenInfo) {
        return {
          symbol: tokenInfo.symbol,
          name: tokenInfo.name,
          decimals: tokenInfo.decimals || 9,
          verified: true
        };
      }
    }
    
    // Try pattern matching
    const mintUpper = mintAddress.toUpperCase();
    for (const [pattern, info] of Object.entries(TOKEN_PATTERNS)) {
      if (mintUpper.includes(pattern)) {
        return {
          symbol: info.symbol,
          name: info.name,
          decimals: 9,
          verified: true
        };
      }
    }
    
    // Try individual API calls as fallback
    try {
      const tokenInfo = await getTokenInfo(mintAddress);
      const tokenMetadata = await getTokenMetadata(mintAddress);
      
      return {
        symbol: tokenInfo.symbol || mintAddress.slice(0, 4).toUpperCase(),
        name: tokenInfo.name || 'Unknown Token',
        decimals: tokenMetadata.decimals || 9,
        verified: tokenInfo.name && tokenInfo.name !== 'Unknown Token'
      };
    } catch (error) {
      // Final fallback
      return {
        symbol: mintAddress.slice(0, 4).toUpperCase(),
        name: 'Unknown Token',
        decimals: 9,
        verified: false
      };
    }
  } catch (error) {
    return {
      symbol: mintAddress.slice(0, 4).toUpperCase(),
      name: 'Unknown Token',
      decimals: 9,
      verified: false
    };
  }
}

/**
 * Get token balance
 * @param {string} mintAddress - Token mint address
 * @param {string} walletAddress - Wallet address
 * @returns {Promise<number>} Token balance
 */
export async function getTokenBalance(mintAddress, walletAddress) {
  try {
    const connection = new Connection(getRpcEndpoint());
    
    // Get token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(walletAddress),
      { mint: new PublicKey(mintAddress) }
    );
    
    if (tokenAccounts.value.length === 0) {
      return 0;
    }
    
    // Return balance of first account
    return tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
  } catch (error) {
    console.error(`${colors.red}❌ Error getting token balance: ${error.message}${colors.reset}`);
    return 0;
  }
}

/**
 * Get SOL balance
 * @param {string} walletAddress - Wallet address
 * @returns {Promise<number>} SOL balance
 */
export async function getSolBalance(walletAddress) {
  try {
    const connection = new Connection(getRpcEndpoint());
    const balance = await connection.getBalance(new PublicKey(walletAddress));
    return balance / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error(`${colors.red}❌ Error getting SOL balance: ${error.message}${colors.reset}`);
    return 0;
  }
}

/**
 * Validate swap parameters
 * @param {string} fromMint - Source token mint
 * @param {string} toMint - Destination token mint
 * @param {number} amount - Amount to swap
 * @param {Object} wallet - Wallet object
 * @returns {Promise<boolean>} Validation result
 */
export async function validateSwap(fromMint, toMint, amount, wallet) {
  try {
    // Check if tokens are different
    if (fromMint === toMint) {
      throw new Error('Cannot swap same token');
    }
    
    // Check amount
    if (amount <= 0) {
      throw new Error('Amount must be greater than 0');
    }
    
    // Check wallet - wallet is a Keypair object
    if (!wallet || !wallet.publicKey) {
      throw new Error('Invalid wallet');
    }
    
    // Check balance
    const balance = await getTokenBalance(fromMint, wallet.publicKey.toString());
    if (balance < amount) {
      throw new Error(`Insufficient balance. Available: ${balance}, Required: ${amount}`);
    }
    
    return true;
  } catch (error) {
    console.error(`${colors.red}❌ Swap validation failed: ${error.message}${colors.reset}`);
    return false;
  }
}

/**
 * Get realtime price for a token
 * @param {string} mintAddress - Token mint address
 * @returns {Promise<number>} Token price in USD
 */
export async function getTokenPrice(mintAddress) {
  try {
    // Use Jupiter price API with timeout and retry
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`https://price.jup.ag/v4/price?ids=${mintAddress}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    const priceData = data.data[mintAddress];
    
    if (priceData) {
      return priceData.price;
    } else {
      return 0;
    }
  } catch (error) {
    // Silent error for price API to avoid spam
    return 0;
  }
}

/**
 * Calculate PnL for a token
 * @param {string} mintAddress - Token mint address
 * @param {number} balance - Token balance
 * @param {number} avgPrice - Average purchase price (optional)
 * @returns {Promise<Object>} PnL information
 */
export async function calculateTokenPnL(mintAddress, balance, avgPrice = 0) {
  try {
    const currentPrice = await getTokenPrice(mintAddress);
    const currentValue = balance * currentPrice;
    
    let pnl = 0;
    let pnlPercent = 0;
    
    if (avgPrice > 0) {
      const purchaseValue = balance * avgPrice;
      pnl = currentValue - purchaseValue;
      pnlPercent = ((currentPrice - avgPrice) / avgPrice) * 100;
    }
    
    return {
      currentPrice,
      currentValue,
      pnl,
      pnlPercent,
      avgPrice
    };
  } catch (error) {
    console.error(`${colors.red}❌ Error calculating PnL: ${error.message}${colors.reset}`);
    return {
      currentPrice: 0,
      currentValue: 0,
      pnl: 0,
      pnlPercent: 0,
      avgPrice: 0
    };
  }
}

/**
 * Get swap history for a wallet
 * @param {string} walletAddress - Wallet address
 * @param {number} limit - Number of transactions to fetch
 * @returns {Promise<Array>} Swap history
 */
export async function getSwapHistory(walletAddress, limit = 10) {
  try {
    const connection = new Connection(getRpcEndpoint());
    
    // Get recent transactions
    const signatures = await connection.getSignaturesForAddress(
      new PublicKey(walletAddress),
      { limit: limit }
    );
    
    const transactions = await Promise.all(
      signatures.map(async (sig) => {
        try {
          const tx = await connection.getTransaction(sig.signature, {
            maxSupportedTransactionVersion: 0
          });
          return {
            signature: sig.signature,
            blockTime: sig.blockTime,
            transaction: tx
          };
        } catch (error) {
          return null;
        }
      })
    );
    
    return transactions.filter(tx => tx !== null);
  } catch (error) {
    console.error(`${colors.red}❌ Error getting swap history: ${error.message}${colors.reset}`);
    return [];
  }
}

/**
 * Burn tokens by sending to dead address (simplest and most reliable method)
 * @param {string} mintAddress - Token mint address
 * @param {number} amount - Amount to burn (in smallest units)
 * @param {Object} wallet - Wallet keypair
 * @returns {Promise<Object>} Burn transaction result
 */
export async function burnTokens(mintAddress, amount, wallet) {
  try {
    console.log(`${colors.red}🔥 Burning tokens by sending to dead address...${colors.reset}`);
    
    // Create connection
    const connection = new Connection(getRpcEndpoint());
    
    // Get token account info
    const tokenMint = new PublicKey(mintAddress);
    const userTokenAccount = await connection.getTokenAccountsByOwner(wallet.publicKey, {
      mint: tokenMint
    });
    
    if (userTokenAccount.value.length === 0) {
      throw new Error('No token account found for this mint');
    }
    
    const userTokenAccountAddress = userTokenAccount.value[0].pubkey;
    
    // Get account info to check balance
    const accountInfo = await connection.getTokenAccountBalance(userTokenAccountAddress);
    const currentBalance = accountInfo.value.amount;
    
    console.log(`${colors.cyan}📊 Current balance: ${currentBalance} smallest units${colors.reset}`);
    console.log(`${colors.cyan}📊 Attempting to burn: ${amount} smallest units${colors.reset}`);
    
    // Create transaction
    const transaction = new Transaction();
    
    // Create transfer instruction to a known dead address
    // Using a simple approach: transfer to the mint address itself (which acts as a dead address)
    const transferInstruction = {
      programId: TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: userTokenAccountAddress, isSigner: false, isWritable: true },
        { pubkey: tokenMint, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false }
      ],
      data: Buffer.from([
        3, // Transfer instruction
        ...new Uint8Array(new Uint8Array(amount.toString().padStart(8, '0').split('').map(Number)))
      ])
    };
    
    transaction.add(transferInstruction);
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // Sign and send transaction
    transaction.sign(wallet);
    const signature = await connection.sendRawTransaction(transaction.serialize());
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature);
    
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }
    
    console.log(`${colors.green}✅ Tokens sent to dead address successfully!${colors.reset}`);
    console.log(`${colors.blue}📝 Transaction: ${signature}${colors.reset}`);
    console.log(`${colors.yellow}💡 Tokens have been effectively burned${colors.reset}`);
    
    return {
      success: true,
      signature: signature,
      method: 'send_to_dead_address',
      amount: amount
    };
    
  } catch (error) {
    console.error(`${colors.red}❌ Error burning tokens: ${error.message}${colors.reset}`);
    logToFile(`Token burn error: ${error.message}`, 'error');
    
    // Try alternative method - close account
    console.log(`${colors.yellow}🔄 Trying alternative burn method...${colors.reset}`);
    try {
      return await closeTokenAccount(mintAddress, wallet);
    } catch (closeError) {
      console.error(`${colors.red}❌ Alternative burn method also failed: ${closeError.message}${colors.reset}`);
      throw error; // Throw original error
    }
  }
}

/**
 * Close token account (alternative burn method)
 * @param {string} mintAddress - Token mint address
 * @param {Object} wallet - Wallet keypair
 * @returns {Promise<Object>} Close transaction result
 */
export async function closeTokenAccount(mintAddress, wallet) {
  try {
    console.log(`${colors.red}🔥 Closing token account...${colors.reset}`);
    
    // Create connection
    const connection = new Connection(getRpcEndpoint());
    
    // Get token account info
    const tokenMint = new PublicKey(mintAddress);
    const userTokenAccount = await connection.getTokenAccountsByOwner(wallet.publicKey, {
      mint: tokenMint
    });
    
    if (userTokenAccount.value.length === 0) {
      throw new Error('No token account found for this mint');
    }
    
    const userTokenAccountAddress = userTokenAccount.value[0].pubkey;
    
    // Create transaction
    const transaction = new Transaction();
    
    // Create close account instruction
    const closeInstruction = {
      programId: TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: userTokenAccountAddress, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false }
      ],
      data: Buffer.from([9]) // Close account instruction
    };
    
    transaction.add(closeInstruction);
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // Sign and send transaction
    transaction.sign(wallet);
    const signature = await connection.sendRawTransaction(transaction.serialize());
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature);
    
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }
    
    console.log(`${colors.green}✅ Token account closed successfully!${colors.reset}`);
    console.log(`${colors.blue}📝 Transaction: ${signature}${colors.reset}`);
    
    return {
      success: true,
      signature: signature,
      method: 'close_account'
    };
    
  } catch (error) {
    console.error(`${colors.red}❌ Error closing token account: ${error.message}${colors.reset}`);
    logToFile(`Token close error: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Send tokens to dead address (most reliable burn method)
 * @param {string} mintAddress - Token mint address
 * @param {number} amount - Amount to burn (in smallest units)
 * @param {Object} wallet - Wallet keypair
 * @returns {Promise<Object>} Burn transaction result
 */
export async function sendToDeadAddress(mintAddress, amount, wallet) {
  try {
    console.log(`${colors.red}🔥 Sending tokens to dead address...${colors.reset}`);
    
    // Create connection
    const connection = new Connection(getRpcEndpoint());
    
    // Get token account info
    const tokenMint = new PublicKey(mintAddress);
    const userTokenAccount = await connection.getTokenAccountsByOwner(wallet.publicKey, {
      mint: tokenMint
    });
    
    if (userTokenAccount.value.length === 0) {
      throw new Error('No token account found for this mint');
    }
    
    const userTokenAccountAddress = userTokenAccount.value[0].pubkey;
    
    // Get token metadata to understand decimals
    const tokenMetadata = await getTokenMetadata(mintAddress);
    const decimals = tokenMetadata.decimals;
    
    // Use amount as is (it should already be in smallest units from the calling function)
    const amountInSmallestUnits = amount;
    
    console.log(`${colors.cyan}📊 Sending ${amountInSmallestUnits.toLocaleString()} smallest units to dead address${colors.reset}`);
    
    // Create transaction
    const transaction = new Transaction();
    
    // Create transfer instruction to mint address itself (simplest dead address)
    const transferInstruction = {
      programId: TOKEN_PROGRAM_ID,
      keys: [
        { pubkey: userTokenAccountAddress, isSigner: false, isWritable: true },
        { pubkey: tokenMint, isSigner: false, isWritable: true },
        { pubkey: wallet.publicKey, isSigner: true, isWritable: false }
      ],
      data: Buffer.from([
        3, // Transfer instruction
        ...new Uint8Array(new Uint8Array(amountInSmallestUnits.toString().padStart(8, '0').split('').map(Number)))
      ])
    };
    
    transaction.add(transferInstruction);
    
    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = wallet.publicKey;
    
    // Sign and send transaction
    transaction.sign(wallet);
    const signature = await connection.sendRawTransaction(transaction.serialize());
    
    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature);
    
    if (confirmation.value.err) {
      throw new Error(`Transaction failed: ${confirmation.value.err}`);
    }
    
    console.log(`${colors.green}✅ Tokens sent to dead address successfully!${colors.reset}`);
    console.log(`${colors.blue}📝 Transaction: ${signature}${colors.reset}`);
    
    return {
      success: true,
      signature: signature,
      method: 'send_to_dead_address'
    };
    
  } catch (error) {
    console.error(`${colors.red}❌ Error sending to dead address: ${error.message}${colors.reset}`);
    logToFile(`Dead address send error: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Check if token can be sold (has liquidity)
 * @param {string} mintAddress - Token mint address
 * @returns {Promise<Object>} Object with canSell boolean and maxAmount
 */
export async function canTokenBeSold(mintAddress) {
  try {
    // Try to get a quote for selling a small amount
    const testAmount = 1000; // Small test amount
    
    const quote = await getBestQuote(
      mintAddress,
      'So11111111111111111111111111111111111111112', // SOL
      testAmount
    );
    
    if (!quote || quote.outAmount <= 0) {
      return { canSell: false, maxAmount: 0, reason: 'No liquidity found' };
    }
    
    // Check price impact
    const priceImpact = parseFloat(quote.priceImpactPct);
    if (priceImpact > 10) { // More than 10% price impact
      return { canSell: false, maxAmount: 0, reason: 'Price impact too high (>10%)' };
    }
    
    return { 
      canSell: true, 
      maxAmount: quote.inAmount,
      priceImpact: priceImpact,
      estimatedOutput: quote.outAmount
    };
  } catch (error) {
    // Check for specific Jupiter errors
    const errorMessage = error.message.toLowerCase();
    
    if (errorMessage.includes('could not find any route') || 
        errorMessage.includes('no route found') ||
        errorMessage.includes('insufficient liquidity')) {
      return { canSell: false, maxAmount: 0, reason: 'No trading pairs available' };
    } else if (errorMessage.includes('price impact too high') || 
               errorMessage.includes('slippage exceeded')) {
      return { canSell: false, maxAmount: 0, reason: 'Price impact too high' };
    } else {
      return { canSell: false, maxAmount: 0, reason: error.message };
    }
  }
} 