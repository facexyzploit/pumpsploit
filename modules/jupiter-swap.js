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

// Settings manager
const settingsManager = new SettingsManager();

// Get RPC endpoint from settings
function getRpcEndpoint() {
  return settingsManager.get('enableCustomRpc') 
    ? settingsManager.get('customRpcEndpoint') 
    : 'https://api.mainnet-beta.solana.com';
}

/**
 * Get the best quote for a swap
 * @param {string} fromMint - Source token mint address
 * @param {string} toMint - Destination token mint address  
 * @param {number} amount - Amount to swap (in smallest units)
 * @returns {Promise<Object>} Quote information
 */
export async function getBestQuote(fromMint, toMint, amount) {
  try {
    console.log(`${colors.cyan}🔍 Getting best quote...${colors.reset}`);
    
    // Get slippage from settings
    const slippageLimit = settingsManager.get('slippageLimit') || 0.5;
    const slippageBps = Math.floor(slippageLimit * 100); // Convert % to basis points
    
    const params = new URLSearchParams({
      inputMint: fromMint,
      outputMint: toMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
      onlyDirectRoutes: 'false',
      asLegacyTransaction: 'false'
    });

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
 * Get swap transaction
 * @param {Object} route - Quote route from getBestQuote
 * @param {string} userPublicKey - User's public key
 * @returns {Promise<Object>} Transaction data
 */
export async function getSwapTransaction(route, userPublicKey) {
  try {
    console.log(`${colors.cyan}🔧 Building swap transaction...${colors.reset}`);
    
    const response = await fetch(JUPITER_SWAP_TRANSACTION_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quoteResponse: route,
        userPublicKey: userPublicKey,
        wrapUnwrapSOL: true
      })
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
 * Perform a swap
 * @param {string} fromMint - Source token mint address
 * @param {string} toMint - Destination token mint address
 * @param {number} amount - Amount to swap
 * @param {Object} wallet - Wallet object with keypair
 * @param {number} slippage - Slippage tolerance in basis points (default: 50 = 0.5%)
 * @returns {Promise<Object>} Swap result
 */
export async function performSwap(fromMint, toMint, amount, wallet, slippage = null) {
  try {
    console.log(`${colors.cyan}🚀 Starting swap...${colors.reset}`);
    console.log(`${colors.yellow}From: ${fromMint}${colors.reset}`);
    console.log(`${colors.yellow}To: ${toMint}${colors.reset}`);
    console.log(`${colors.yellow}Amount: ${amount}${colors.reset}`);
    
    // Get settings
    const slippageLimit = slippage !== null ? slippage : settingsManager.get('slippageLimit') || 0.5;
    const priorityFee = settingsManager.get('priorityFee') || 5000;
    const tipAmount = settingsManager.get('tipAmount') || 0.001;
    const rpcEndpoint = getRpcEndpoint();
    
    console.log(`${colors.yellow}Slippage: ${slippageLimit}%${colors.reset}`);
    console.log(`${colors.yellow}Priority Fee: ${priorityFee} micro-lamports${colors.reset}`);
    console.log(`${colors.yellow}Tip Amount: ${tipAmount} SOL${colors.reset}`);
    console.log(`${colors.yellow}RPC: ${rpcEndpoint}${colors.reset}`);

    // Get the best quote
    const quote = await getBestQuote(fromMint, toMint, amount);
    
    // Get swap transaction - wallet is a Keypair object
    const swapData = await getSwapTransaction(quote, wallet.publicKey.toString());
    
    // Sign and send transaction
    const connection = new Connection(rpcEndpoint);
    
    // Decode transaction - handle both legacy and versioned transactions
    let transaction;
    try {
      // Try versioned transaction first
      transaction = VersionedTransaction.deserialize(Buffer.from(swapData.swapTransaction, 'base64'));
      
      // Sign versioned transaction - wallet is the keypair itself
      transaction.sign([wallet]);
      
      // Send versioned transaction
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
      try {
        // Fallback to legacy transaction
        transaction = Transaction.from(Buffer.from(swapData.swapTransaction, 'base64'));
        
        // Sign legacy transaction - wallet is the keypair itself
        transaction.sign(wallet);
        
        // Send legacy transaction
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

/**
 * Get all token balances for a wallet
 * @param {string} walletAddress - Wallet address
 * @returns {Promise<Array>} Array of token balances
 */
export async function getAllTokenBalances(walletAddress) {
  try {
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
    
    return tokens;
  } catch (error) {
    console.error(`${colors.red}❌ Error getting all token balances: ${error.message}${colors.reset}`);
    // Return empty array instead of throwing
    return [];
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
 * @returns {Promise<boolean>} True if token can be sold
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
    
    return quote && quote.outAmount > 0;
  } catch (error) {
    // If we can't get a quote, the token probably can't be sold
    return false;
  }
} 