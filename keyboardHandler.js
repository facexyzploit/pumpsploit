import { exec, execSync, execFile } from 'child_process';
import { colors } from './colors.js';
import inquirer from 'inquirer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get current directory with ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Add menu states
const MENU_STATES = {
  MAIN: 'main',
  MONITOR: 'monitor'
};

class KeyboardHandler {
  constructor(state, startStream, cleanup, restartApp, settings) {
    this.state = state;
    this.startStream = startStream;
    this.cleanup = cleanup;
    this.restartApp = restartApp;
    this.settings = settings;
  }

  init() {
    console.log(`${colors.cyan}🔧 Initializing keyboard handler...${colors.reset}`);
    
    // Enable raw mode for keyboard input
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    // Listen for key presses
    process.stdin.on('data', async (key) => {
      try {
        const keyStr = key.toString().trim().toUpperCase();
        
        // Handle Ctrl+C explicitly
        if (keyStr === '\u0003') {
          await this.cleanup();
          return;
        }

        console.log(`${colors.yellow}🔍 Key pressed: ${keyStr}${colors.reset}`);
        await this.handleKeyPress(keyStr);
      } catch (error) {
        console.error(`${colors.red}Error handling keyboard input: ${error.message}${colors.reset}`);
      }
    });
    
    console.log(`${colors.green}✅ Keyboard handler initialized!${colors.reset}`);
  }

  async handleKeyPress(keyStr) {
    switch (keyStr) {
      case 'W':
        await this.handleNextToken();
        break;
      case 'S':
        await this.handlePreviousToken();
        break;
      case 'C':
        await this.handleCopyAddress();
        break;
      case 'E':
        await this.handleJupiterRealtimeMonitoring();
        break;
      case 'R':
        console.log(`${colors.cyan}🔄 Returning to main menu...${colors.reset}`);
        await this.restartApp();
        break;
      case 'B':
        await this.handleTelegramSend();
        break;
      case 'M':
        console.log(`${colors.cyan}🏠 Force returning to main menu...${colors.reset}`);
        await this.restartApp();
        break;
      case 'G':
        await this.handleOpenGMGN();
        break;
      case 'Q':
        await this.cleanup();
        break;
      case 'T':
        const currentTrade = this.state.getCurrentTrade();
        
            // Handle different data structures based on current mode
    let tokenAddress;
    if (this.state.getMode() === 'graduated') {
      tokenAddress = currentTrade?.Pool?.Market?.BaseCurrency?.MintAddress;
    } else {
      tokenAddress = currentTrade?.Trade?.Buy?.Currency?.MintAddress;
    }
        
        if (tokenAddress) {
          const url = `https://www.gmgn.cc/kline/sol/${tokenAddress}?interval=1S`;
          const command = process.platform === 'win32' ? 'start' :
                         process.platform === 'darwin' ? 'open' : 'xdg-open';
          
          exec(`${command} "${url}"`);
          console.log(`${colors.green}Opening GMGN chart for ${tokenAddress}${colors.reset}`);
        } else {
          console.log(`${colors.yellow}No token address available for current token${colors.reset}`);
        }
        break;
      case 'U':
        await this.handleUpdateTokenInfo();
        break;
      case 'H':
        await this.handleHelp();
        break;
      default:
        // Ignore other keys
        break;
    }
  }

  /**
   * Display a concise help message listing available keyboard controls.  This
   * method can be triggered with the 'H' key.  The help text is printed
   * to the console without clearing the current display.
   */
  async handleHelp() {
    console.log(`\n${colors.cyan}Available Controls:${colors.reset}`);
    console.log(`${colors.white}W${colors.reset} / ${colors.white}S${colors.reset} – Navigate to next/previous token`);
    console.log(`${colors.white}C${colors.reset} – Copy current token address to clipboard`);
    console.log(`${colors.white}E${colors.reset} – Toggle Jupiter real‑time monitoring`);
    console.log(`${colors.white}R${colors.reset} – Return to main menu`);
    console.log(`${colors.white}B${colors.reset} – Send token address to Telegram`);
    console.log(`${colors.white}G${colors.reset} – Open GMGN chart`);
    console.log(`${colors.white}U${colors.reset} – Update token info (fetch latest Jupiter data)`);
    console.log(`${colors.white}Q${colors.reset} – Exit the application`);
    console.log(`${colors.white}H${colors.reset} – Show this help message`);
    console.log('');
    // Wait briefly so the user can read the help before the screen refreshes
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  async handleNextToken() {
    // Handle trending mode differently
    if (this.state.getMode() === 'trending') {
      if (this.state.hasNextTrendingToken()) {
        this.state.nextTrendingToken();
        const trendingData = this.state.getTrendingData();
        const index = this.state.getCurrentTrendingIndex();
        // Import displayTrendingToken function
        const { displayTrendingToken } = await import('./bitquery-stream.js');
        displayTrendingToken(index, trendingData);
      } else {
        console.log(`${colors.yellow}⚠️ No more trending tokens to display${colors.reset}`);
      }
    } else {
      if (this.state.currentTokenIndex < this.state.trades.length - 1) {
        await this.state.displayTrade(this.state.currentTokenIndex + 1);
      } else {
        // Auto-continue with last remembered mode
        const lastMode = this.settings?.lastSelectedMode || this.state.getMode();
        console.log(`\n${colors.cyan}🔄 Auto-continuing with last mode: ${lastMode}${colors.reset}`);
        await this.startStream(lastMode);
      }
    }
  }

  async handlePreviousToken() {
    // Handle trending mode differently
    if (this.state.getMode() === 'trending') {
      if (this.state.hasPreviousTrendingToken()) {
        this.state.previousTrendingToken();
        const trendingData = this.state.getTrendingData();
        const index = this.state.getCurrentTrendingIndex();
        // Import displayTrendingToken function
        const { displayTrendingToken } = await import('./bitquery-stream.js');
        displayTrendingToken(index, trendingData);
      } else {
        console.log(`${colors.yellow}⚠️ No previous trending tokens to display${colors.reset}`);
      }
    } else {
      if (this.state.currentTokenIndex > 0) {
        await this.state.displayTrade(this.state.currentTokenIndex - 1);
      }
    }
  }

  async handleCopyAddress() {
    let tokenAddress;
    
    // Handle trending mode differently
    if (this.state.getMode() === 'trending') {
      const currentTrendingToken = this.state.getCurrentTrendingToken();
      tokenAddress = currentTrendingToken?.token?.MintAddress;
    } else {
      const currentTrade = this.state.trades[this.state.currentTokenIndex];
      
      // Handle different data structures based on current mode
      if (this.state.getMode() === 'graduated') {
        tokenAddress = currentTrade?.Pool?.Market?.BaseCurrency?.MintAddress;
      } else {
        tokenAddress = currentTrade?.Trade?.Buy?.Currency?.MintAddress;
      }
    }
    
    if (tokenAddress) {
      this.copyToClipboard(tokenAddress);
      console.log(`\n${colors.green}Token address copied to clipboard!${colors.reset}`);
    }
  }

  async handleOpenGMGN() {
    let tokenAddress;
    
    // Handle trending mode differently
    if (this.state.getMode() === 'trending') {
      const currentTrendingToken = this.state.getCurrentTrendingToken();
      tokenAddress = currentTrendingToken?.token?.MintAddress;
    } else {
      const activeToken = this.state.trades[this.state.currentTokenIndex];
      
      // Handle different data structures based on current mode
      if (this.state.getMode() === 'graduated') {
        tokenAddress = activeToken?.Pool?.Market?.BaseCurrency?.MintAddress;
      } else {
        tokenAddress = activeToken?.Trade?.Buy?.Currency?.MintAddress;
      }
    }
    
    if (tokenAddress) {
      execFile('open', [`https://gmgn.ai/sol/token/${tokenAddress}`]);
      console.log(`Opening token address: https://gmgn.ai/sol/token/${tokenAddress}`);
    }
  }

  async handleTelegramSend() {
    let mintAddress;
    
    // Handle trending mode differently
    if (this.state.getMode() === 'trending') {
      const currentTrendingToken = this.state.getCurrentTrendingToken();
      mintAddress = currentTrendingToken?.token?.MintAddress;
    } else {
      const telegramToken = this.state.trades[this.state.currentTokenIndex];
      
      // Handle different data structures based on current mode
      if (this.state.getMode() === 'graduated') {
        mintAddress = telegramToken?.Pool?.Market?.BaseCurrency?.MintAddress;
      } else {
        mintAddress = telegramToken?.Trade?.Buy?.Currency?.MintAddress;
      }
    }
    
    if (mintAddress) {
      execSync(`osascript -e 'tell application "Telegram" to activate' \
        -e 'tell application "System Events" to keystroke "/buy"' \
        -e 'delay 0.5' \
        -e 'tell application "System Events" to keystroke return' \
        -e 'delay 0.5' \
        -e 'tell application "System Events" to keystroke "${mintAddress}"' \
        -e 'delay 0.5' \
        -e 'tell application "System Events" to keystroke return'`);
      console.log(`Sending token address to Telegram: ${mintAddress}`);
    }
  }

  async handleJupiterRealtimeMonitoring() {
    let tokenAddress;
    
    // Handle trending mode differently
    if (this.state.getMode() === 'trending') {
      const currentTrendingToken = this.state.getCurrentTrendingToken();
      tokenAddress = currentTrendingToken?.token?.MintAddress;
    } else {
      const currentTrade = this.state.getCurrentTrade();
      
      // Handle different data structures based on current mode
      if (this.state.getMode() === 'graduated') {
        // For graduated mode, we have Pool structure
        tokenAddress = currentTrade?.Pool?.Market?.BaseCurrency?.MintAddress;
      } else {
        // For other modes, we have Trade structure
        tokenAddress = currentTrade?.Trade?.Buy?.Currency?.MintAddress;
      }
    }
    
    if (!tokenAddress) {
      console.log(`${colors.yellow}No token address available for current token${colors.reset}`);
      return;
    }

    // Toggle real-time monitoring
    if (this.state.isJupiterRealtimeActive) {
      // Stop monitoring
      this.state.stopJupiterRealtime();
      console.log(`${colors.yellow}🛑 Jupiter real-time monitoring stopped${colors.reset}`);
      // Refresh display to show OFF status
      await this.state.displayTrade(this.state.currentTokenIndex);
    } else {
      // Start monitoring
      console.log(`${colors.cyan}🔄 Starting Jupiter real-time monitoring for ${tokenAddress}${colors.reset}`);
      console.log(`${colors.yellow}Press 'E' again to stop monitoring${colors.reset}\n`);
      
      try {
        // Import the real-time monitoring function from bitquery-stream
        const { monitorTokenRealtime } = await import('./bitquery-stream.js');
        
        // Start real-time monitoring with 1-second intervals
        const monitor = await monitorTokenRealtime(tokenAddress, 1000, this.state);
        
        // Store monitor in state for later cleanup
        this.state.setJupiterRealtimeMonitor(monitor);
        
      } catch (error) {
        console.error(`${colors.red}Error starting Jupiter monitoring: ${error.message}${colors.reset}`);
        // Return to normal display
        await this.state.displayTrade(this.state.currentTokenIndex);
      }
    }
  }

  async handleUpdateTokenInfo() {
    const currentTrade = this.state.getCurrentTrade();
    
    // Handle different data structures based on current mode
    let tokenAddress;
    if (this.state.getMode() === 'graduated') {
      tokenAddress = currentTrade?.Pool?.Market?.BaseCurrency?.MintAddress;
    } else {
      tokenAddress = currentTrade?.Trade?.Buy?.Currency?.MintAddress;
    }
    
    if (!tokenAddress) {
      console.log(`${colors.yellow}No token address available for current token${colors.reset}`);
      return;
    }

    console.log(`\n${colors.cyan}🔄 Updating token info for: ${tokenAddress}${colors.reset}`);
    
    try {
      // Import the Jupiter analysis functions
      const { checkJupiterTokenRealtime, analyzeTokenWithJupiter } = await import('./bitquery-stream.js');
      
      // Get real-time Jupiter data
      const jupiterData = await checkJupiterTokenRealtime(tokenAddress);
      
      if (jupiterData && jupiterData.success) {
        console.log(`${colors.green}✅ Token info updated successfully!${colors.reset}`);
        console.log(`${colors.cyan}📊 Updated Data:${colors.reset}`);
        console.log(`   💰 Price: $${(jupiterData.data.price || 0).toFixed(9)}`);
        console.log(`   📈 24h Volume: $${(jupiterData.data.volume24h || 0).toLocaleString()}`);
        console.log(`   💧 Liquidity: $${(jupiterData.data.liquidity || 0).toLocaleString()}`);
        console.log(`   👥 Holders: ${jupiterData.data.holderCount || 'N/A'}`);
        console.log(`   ✅ Verified: ${jupiterData.data.verified ? 'Yes' : 'No'}`);
        console.log(`   🌱 Organic Score: ${jupiterData.data.organicScore || 'N/A'}`);
        
        // Also try to get detailed analysis
        try {
          const analysis = await analyzeTokenWithJupiter(tokenAddress);
          if (analysis && analysis.success) {
            console.log(`\n${colors.cyan}🎯 Trading Decision:${colors.reset}`);
            const decision = analysis.analysis?.trading?.decision || 'N/A';
            const confidence = analysis.analysis?.trading?.confidence || 'N/A';
            console.log(`   🎯 Decision: ${decision}`);
            console.log(`   📊 Confidence: ${confidence}`);
          }
        } catch (analysisError) {
          console.log(`${colors.yellow}⚠️ Could not get detailed analysis: ${analysisError.message}${colors.reset}`);
        }
      } else {
        console.log(`${colors.red}❌ Failed to update token info: ${jupiterData?.error || 'Unknown error'}${colors.reset}`);
      }
    } catch (error) {
      console.error(`${colors.red}Error updating token info: ${error.message}${colors.reset}`);
    }
    
    // Wait a moment for user to read the output
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Refresh the display
    await this.state.displayTrade(this.state.currentTokenIndex);
  }

  copyToClipboard(text) {
    const command = process.platform === 'darwin' ? 'pbcopy' : 'clip';
    const proc = exec(command);
    proc.stdin.write(text);
    proc.stdin.end();
  }
}

// Create a global handler instance to be used by the exported functions
let handlerInstance = null;

export function createKeyboardHandler(state, startStream, cleanup, restartApp, settings) {
  handlerInstance = new KeyboardHandler(state, startStream, cleanup, restartApp, settings);
  return handlerInstance;
}

export function enableKeyboard() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
}

export function disableKeyboard() {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }
  process.stdin.pause();
}

export function setupKeyboardInput(state, startStream, cleanup, restartApp) {
  // Create a handler if not already created
  if (!handlerInstance) {
    handlerInstance = new KeyboardHandler(state, startStream, cleanup, restartApp);
  }
  
  // Enable keyboard input
  enableKeyboard();
  
  // Set up the event listener
  process.stdin.on('data', async (key) => {
    try {
      const keyStr = key.toString().trim().toUpperCase();
      
      // Handle Ctrl+C explicitly
      if (keyStr === '\u0003') {
        await cleanup();
        return;
      }

      await handlerInstance.handleKeyPress(keyStr);
    } catch (error) {
      console.error(`${colors.red}Error handling keyboard input: ${error.message}${colors.reset}`);
    }
  });
  
  return handlerInstance;
}