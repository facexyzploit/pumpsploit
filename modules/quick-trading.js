import inquirer from 'inquirer';
import { colors } from '../colors.js';
import { 
  getBestQuote, 
  performSwap, 
  getTokenBalance, 
  getSolBalance, 
  getTokenMetadata,
  getAllTokenBalances,
  getTokenInfo,
  calculateTokenPnL
} from './jupiter-swap.js';
import { SettingsManager } from './settings-manager.js';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

const settingsManager = new SettingsManager();

export class QuickTrading {
  constructor() {
    this.settings = settingsManager;
  }

  async quickBuyFromWallet(wallet) {
    console.clear();
    console.log(`${colors.green}🟢 Quick Buy from Active Wallet${colors.reset}\n`);
    
    try {
      // Get SOL balance
      const solBalance = await getSolBalance(wallet.publicKey.toString());
      console.log(`${colors.blue}💰 SOL Balance: ${solBalance.toFixed(6)} SOL${colors.reset}\n`);

      if (solBalance < 0.01) {
        console.log(`${colors.red}❌ Insufficient SOL balance for trading${colors.reset}`);
        return;
      }

      // Get token mint address
      const { tokenMint } = await inquirer.prompt([
        {
          type: 'input',
          name: 'tokenMint',
          message: 'Enter token mint address:',
          validate: (input) => input.length > 0 ? true : 'Token mint is required'
        }
      ]);

      // Get SOL amount to spend
      const { solAmount } = await inquirer.prompt([
        {
          type: 'input',
          name: 'solAmount',
          message: `Enter SOL amount to spend (max: ${solBalance.toFixed(6)}):`,
          default: '0.01',
          validate: (input) => {
            const num = parseFloat(input);
            if (isNaN(num)) return 'Please enter a valid number';
            if (num <= 0) return 'Amount must be greater than 0';
            if (num > solBalance) return `Amount cannot exceed balance (${solBalance.toFixed(6)} SOL)`;
            return true;
          },
          filter: (input) => parseFloat(input)
        }
      ]);

      // Convert SOL to lamports
      const solAmountInLamports = Math.floor(solAmount * LAMPORTS_PER_SOL);

      // Get quote
      const quote = await getBestQuote(
        'So11111111111111111111111111111111111111112', // SOL mint
        tokenMint,
        solAmountInLamports
      );

      // Get token info
      const tokenInfo = await getTokenInfo(tokenMint);
      const tokenMetadata = await getTokenMetadata(tokenMint);
      const outputAmount = quote.outAmount / Math.pow(10, tokenMetadata.decimals);

      // Confirm transaction
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Confirm buy ${outputAmount.toLocaleString()} ${tokenInfo.symbol} for ${solAmount} SOL?\nSlippage: ${settingsManager.get('slippageLimit')}%`,
          default: false
        }
      ]);

      if (!confirm) {
        console.log(`${colors.yellow}⚠️ Transaction cancelled${colors.reset}`);
        return;
      }

      // Perform swap
      const result = await performSwap(
        'So11111111111111111111111111111111111111112',
        tokenMint,
        solAmountInLamports,
        wallet
      );

      console.log(`${colors.green}✅ Buy completed!${colors.reset}`);
      console.log(`${colors.blue}📝 Transaction: ${result.signature}${colors.reset}`);
      
      // Clear screen and return to main menu
      console.log(`\n${colors.cyan}Press SPACE to return to main menu...${colors.reset}`);
      await this.waitForSpaceKey();

    } catch (error) {
      console.error(`${colors.red}❌ Buy failed: ${error.message}${colors.reset}`);
      console.log(`\n${colors.cyan}Press SPACE to return to main menu...${colors.reset}`);
      await this.waitForSpaceKey();
    }
  }

  async quickSellFromWallet(wallet) {
    console.clear();
    console.log(`${colors.red}🔴 Quick Sell from Active Wallet${colors.reset}\n`);
    
    try {
      // Get all token balances
      console.log(`${colors.cyan}🔍 Loading your tokens...${colors.reset}`);
      const tokens = await getAllTokenBalances(wallet.publicKey.toString());
      
      if (tokens.length === 0) {
        console.log(`${colors.yellow}⚠️ No tokens found in your wallet${colors.reset}`);
        console.log(`${colors.cyan}💡 You can enter a custom token mint address${colors.reset}`);
        
        const { customMint } = await inquirer.prompt([
          {
            type: 'input',
            name: 'customMint',
            message: 'Enter token mint address:',
            validate: (input) => input.length > 0 ? true : 'Token mint is required'
          }
        ]);
        
        await this.sellSpecificToken(wallet, customMint);
        return;
      }

      // Display tokens with info
      console.log(`${colors.green}📋 Your Tokens:${colors.reset}`);
      console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
      
      const tokensWithInfo = await Promise.all(
        tokens.map(async (token) => {
          const tokenInfo = await getTokenInfo(token.mint);
          const pnl = await calculateTokenPnL(token.mint, token.balance);
          return { ...token, ...tokenInfo, pnl };
        })
      );

      for (let i = 0; i < tokensWithInfo.length; i++) {
        const token = tokensWithInfo[i];
        const pnlColor = token.pnl.pnlPercent >= 0 ? colors.green : colors.red;
        const pnlSymbol = token.pnl.pnlPercent >= 0 ? '📈' : '📉';
        
        console.log(`${colors.cyan}${i + 1}.${colors.reset} ${colors.yellow}${token.symbol}${colors.reset} (${token.mint.slice(0, 8)}...${token.mint.slice(-8)})`);
        console.log(`   💰 Balance: ${token.balance.toLocaleString()}`);
        console.log(`   💵 Price: $${token.pnl.currentPrice.toFixed(6)}`);
        console.log(`   💎 Value: $${token.pnl.currentValue.toFixed(2)}`);
        console.log(`   ${pnlSymbol} PnL: ${pnlColor}$${token.pnl.pnl.toFixed(2)} (${token.pnl.pnlPercent.toFixed(2)}%)${colors.reset}`);
        console.log('');
      }

      // Select token to sell
      const tokenChoices = tokensWithInfo.map((token, index) => ({
        name: `${index + 1}. ${token.symbol} - Balance: ${token.balance.toLocaleString()} - Value: $${token.pnl.currentValue.toFixed(2)}`,
        value: token
      }));

      tokenChoices.push({
        name: `${tokens.length + 1}. Enter custom token mint address`,
        value: 'custom'
      });

      const { selectedToken } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedToken',
          message: 'Select token to sell:',
          choices: tokenChoices
        }
      ]);

      if (selectedToken === 'custom') {
        const { customMint } = await inquirer.prompt([
          {
            type: 'input',
            name: 'customMint',
            message: 'Enter token mint address:',
            validate: (input) => input.length > 0 ? true : 'Token mint is required'
          }
        ]);
        
        await this.sellSpecificToken(wallet, customMint);
      } else {
        await this.sellSpecificToken(wallet, selectedToken.mint, selectedToken.balance, selectedToken.decimals);
      }

    } catch (error) {
      console.error(`${colors.red}❌ Sell failed: ${error.message}${colors.reset}`);
    }
  }

  async sellSpecificToken(wallet, tokenMint, tokenBalance = null, tokenDecimals = null) {
    try {
      // Get token balance if not provided
      if (!tokenBalance) {
        tokenBalance = await getTokenBalance(tokenMint, wallet.publicKey.toString());
      }

      if (tokenBalance <= 0) {
        console.log(`${colors.red}❌ No balance for this token${colors.reset}`);
        return;
      }

      // Get token metadata if not provided
      if (!tokenDecimals) {
        const tokenMetadata = await getTokenMetadata(tokenMint);
        tokenDecimals = tokenMetadata.decimals;
      }

      console.log(`${colors.blue}💰 Token Balance: ${tokenBalance.toLocaleString()}${colors.reset}`);

      // Ask for percentage to sell
      const { sellPercentage } = await inquirer.prompt([
        {
          type: 'list',
          name: 'sellPercentage',
          message: 'How much to sell?',
          choices: [
            { name: '25%', value: 25 },
            { name: '50%', value: 50 },
            { name: '75%', value: 75 },
            { name: '100%', value: 100 },
            { name: 'Custom percentage', value: 'custom' },
            { name: 'Enter sell initials', value: 'initials' }
          ]
        }
      ]);

      let percentage;
      let sellInitials = '';
      
      if (sellPercentage === 'custom') {
        const { customPercentage } = await inquirer.prompt([
          {
            type: 'input',
            name: 'customPercentage',
            message: 'Enter percentage to sell (1-100):',
            validate: (input) => {
              const num = parseFloat(input);
              if (isNaN(num)) return 'Please enter a valid number';
              if (num <= 0 || num > 100) return 'Percentage must be between 1 and 100';
              return true;
            },
            filter: (input) => parseFloat(input)
          }
        ]);
        percentage = customPercentage;
      } else if (sellPercentage === 'initials') {
        const { initials } = await inquirer.prompt([
          {
            type: 'input',
            name: 'initials',
            message: 'Enter your initials for this sell transaction:',
            validate: (input) => {
              if (!input.trim()) return 'Initials are required';
              if (input.length > 10) return 'Initials must be 10 characters or less';
              return true;
            }
          }
        ]);
        sellInitials = initials;
        
        // After getting initials, ask for percentage
        const { sellPercentageAfter } = await inquirer.prompt([
          {
            type: 'list',
            name: 'sellPercentageAfter',
            message: 'How much to sell?',
            choices: [
              { name: '25%', value: 25 },
              { name: '50%', value: 50 },
              { name: '75%', value: 75 },
              { name: '100%', value: 100 },
              { name: 'Custom percentage', value: 'custom' }
            ]
          }
        ]);
        
        if (sellPercentageAfter === 'custom') {
          const { customPercentage } = await inquirer.prompt([
            {
              type: 'input',
              name: 'customPercentage',
              message: 'Enter percentage to sell (1-100):',
              validate: (input) => {
                const num = parseFloat(input);
                if (isNaN(num)) return 'Please enter a valid number';
                if (num <= 0 || num > 100) return 'Percentage must be between 1 and 100';
                return true;
              },
              filter: (input) => parseFloat(input)
            }
          ]);
          percentage = customPercentage;
        } else {
          percentage = sellPercentageAfter;
        }
      } else {
        percentage = sellPercentage;
      }

      // Calculate amount to sell
      const amountToSell = (tokenBalance * percentage) / 100;
      const amountInSmallestUnits = Math.floor(amountToSell * Math.pow(10, tokenDecimals));

      console.log(`${colors.cyan}📊 Selling ${percentage}% of ${tokenBalance.toLocaleString()} = ${amountToSell.toLocaleString()} tokens${colors.reset}`);

      // Get quote
      const quote = await getBestQuote(
        tokenMint,
        'So11111111111111111111111111111111111111112', // SOL mint
        amountInSmallestUnits
      );

      // Get sell initials if not already provided
      if (!sellInitials) {
        const { sellInitialsInput } = await inquirer.prompt([
          {
            type: 'input',
            name: 'sellInitialsInput',
            message: 'Enter your initials for this sell transaction:',
            validate: (input) => {
              if (!input.trim()) return 'Initials are required';
              if (input.length > 10) return 'Initials must be 10 characters or less';
              return true;
            }
          }
        ]);
        sellInitials = sellInitialsInput;
      }

      // Confirm swap
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Confirm swap ${amountToSell.toLocaleString()} tokens (${percentage}%) for ${(quote.outAmount / LAMPORTS_PER_SOL).toFixed(6)} SOL?\nSell Initials: ${sellInitials}\nSlippage: ${settingsManager.get('slippageLimit')}%`,
          default: false
        }
      ]);

      if (!confirm) {
        console.log(`${colors.yellow}⚠️ Swap cancelled${colors.reset}`);
        return;
      }

      // Perform swap
      const result = await performSwap(
        tokenMint,
        'So11111111111111111111111111111111111111112',
        amountInSmallestUnits,
        wallet
      );

      console.log(`${colors.green}✅ Sell completed!${colors.reset}`);
      console.log(`${colors.blue}📝 Transaction: ${result.signature}${colors.reset}`);
      
      // Clear screen and return to main menu
      console.log(`\n${colors.cyan}Press SPACE to return to main menu...${colors.reset}`);
      await this.waitForSpaceKey();

    } catch (error) {
      console.error(`${colors.red}❌ Sell failed: ${error.message}${colors.reset}`);
      console.log(`\n${colors.cyan}Press SPACE to return to main menu...${colors.reset}`);
      await this.waitForSpaceKey();
    }
  }

  // Helper method to wait for space key
  async waitForSpaceKey() {
    return new Promise((resolve) => {
      const originalRawMode = process.stdin.isRaw;
      const originalEncoding = process.stdin.encoding;
      
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      
      const onData = (data) => {
        if (data === ' ') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.setRawMode(originalRawMode);
          process.stdin.setEncoding(originalEncoding);
          process.stdin.removeListener('data', onData);
          resolve();
        }
      };
      
      process.stdin.on('data', onData);
    });
  }
} 