import { colors } from '../colors.js';
import { logToFile } from '../logger.js';

/**
 * Enhanced Error Handler - Provides better error recovery and user feedback
 */
export class ErrorHandler {
  constructor() {
    this.errorCounts = new Map();
    this.recoveryStrategies = new Map();
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  /**
   * Handle errors with automatic recovery strategies
   */
  async handleError(error, context = {}, recoveryStrategy = null) {
    const errorKey = `${error.name}_${error.message}`;
    const count = (this.errorCounts.get(errorKey) || 0) + 1;
    this.errorCounts.set(errorKey, count);

    // Log error with context
    const errorInfo = {
      name: error.name,
      message: error.message,
      stack: error.stack,
      context,
      count,
      timestamp: new Date().toISOString()
    };

    logToFile('error', JSON.stringify(errorInfo));

    // Try recovery strategy if available
    if (recoveryStrategy && count <= this.maxRetries) {
      try {
        console.log(`${colors.yellow}🔄 Attempting recovery (attempt ${count}/${this.maxRetries})...${colors.reset}`);
        await recoveryStrategy(error, context);
        console.log(`${colors.green}✅ Recovery successful${colors.reset}`);
        return { success: true, recovered: true };
      } catch (recoveryError) {
        console.error(`${colors.red}❌ Recovery failed: ${recoveryError.message}${colors.reset}`);
      }
    }

    // Provide user-friendly error message
    const userMessage = this.getUserFriendlyMessage(error, context);
    console.error(`${colors.red}❌ ${userMessage}${colors.reset}`);

    return {
      success: false,
      error: error.message,
      userMessage,
      context,
      recoverable: !!recoveryStrategy && count <= this.maxRetries
    };
  }

  /**
   * Get user-friendly error messages
   */
  getUserFriendlyMessage(error, context) {
    const { operation, mintAddress, walletAddress } = context;

    if (error.message.includes('Account blocked')) {
      return 'BitQuery API account blocked. Please check your API key in Settings.';
    }

    if (error.message.includes('timeout')) {
      return 'Request timed out. Please check your internet connection and try again.';
    }

    if (error.message.includes('network')) {
      return 'Network error. Please check your internet connection.';
    }

    if (error.message.includes('insufficient balance')) {
      return 'Insufficient balance for this operation.';
    }

    if (error.message.includes('slippage')) {
      return 'Slippage tolerance exceeded. Try increasing slippage or reducing amount.';
    }

    if (operation === 'getTokenInfo' && mintAddress) {
      return `Failed to get token info for ${mintAddress.slice(0, 8)}...`;
    }

    if (operation === 'getTokenPrice' && mintAddress) {
      return `Failed to get price for ${mintAddress.slice(0, 8)}...`;
    }

    if (operation === 'getAllTokenBalances' && walletAddress) {
      return `Failed to get wallet balances for ${walletAddress.slice(0, 8)}...`;
    }

    if (operation === 'performSwap') {
      return 'Swap transaction failed. Please check your balance and try again.';
    }

    // Default error message
    return error.message || 'An unexpected error occurred.';
  }

  /**
   * Register recovery strategy for specific error types
   */
  registerRecoveryStrategy(errorPattern, strategy) {
    this.recoveryStrategies.set(errorPattern, strategy);
  }

  /**
   * Handle network errors with automatic retry
   */
  async handleNetworkError(error, context) {
    if (error.message.includes('timeout') || error.message.includes('network')) {
      const retryDelay = this.retryDelay * Math.pow(2, context.attempt || 0);
      console.log(`${colors.yellow}⏳ Retrying in ${retryDelay}ms...${colors.reset}`);
      await this.sleep(retryDelay);
      return true; // Indicate retry should be attempted
    }
    return false;
  }

  /**
   * Handle API rate limiting
   */
  async handleRateLimitError(error, context) {
    if (error.message.includes('rate limit') || error.message.includes('429')) {
      const retryDelay = 5000; // Wait 5 seconds for rate limits
      console.log(`${colors.yellow}⏳ Rate limited. Waiting ${retryDelay}ms...${colors.reset}`);
      await this.sleep(retryDelay);
      return true;
    }
    return false;
  }

  /**
   * Handle RPC connection errors
   */
  async handleRpcError(error, context) {
    if (error.message.includes('RPC') || error.message.includes('connection')) {
      console.log(`${colors.yellow}🔄 Switching RPC endpoint...${colors.reset}`);
      // You can implement RPC endpoint switching here
      return true;
    }
    return false;
  }

  /**
   * Validate operation parameters
   */
  validateParameters(params, required) {
    const missing = [];
    for (const field of required) {
      if (!params[field]) {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required parameters: ${missing.join(', ')}`);
    }
  }

  /**
   * Safe async operation wrapper
   */
  async safeExecute(operation, context = {}) {
    try {
      return await operation();
    } catch (error) {
      return await this.handleError(error, context);
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  async retryOperation(operation, maxRetries = this.maxRetries, context = {}) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        context.attempt = attempt;
        
        // Check if error is recoverable
        if (await this.handleNetworkError(error, context) ||
            await this.handleRateLimitError(error, context) ||
            await this.handleRpcError(error, context)) {
          continue; // Retry
        }

        // If this is the last attempt, throw the error
        if (attempt === maxRetries) {
          throw error;
        }

        // Exponential backoff
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        console.log(`${colors.yellow}⏳ Retrying in ${delay}ms... (attempt ${attempt}/${maxRetries})${colors.reset}`);
        await this.sleep(delay);
      }
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const stats = {};
    for (const [errorKey, count] of this.errorCounts) {
      stats[errorKey] = count;
    }
    return stats;
  }

  /**
   * Clear error statistics
   */
  clearErrorStats() {
    this.errorCounts.clear();
  }

  /**
   * Display error statistics
   */
  displayErrorStats() {
    const stats = this.getErrorStats();
    if (Object.keys(stats).length === 0) {
      console.log(`${colors.green}✅ No errors recorded${colors.reset}`);
      return;
    }

    console.log(`${colors.cyan}📊 Error Statistics:${colors.reset}`);
    console.log(`${colors.white}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    
    for (const [errorKey, count] of Object.entries(stats)) {
      console.log(`${colors.red}${errorKey}: ${count} occurrences${colors.reset}`);
    }
  }

  /**
   * Utility sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if error is recoverable
   */
  isRecoverableError(error) {
    const recoverablePatterns = [
      'timeout',
      'network',
      'rate limit',
      '429',
      'RPC',
      'connection',
      'temporary'
    ];

    return recoverablePatterns.some(pattern => 
      error.message.toLowerCase().includes(pattern)
    );
  }

  /**
   * Get suggested action for error
   */
  getSuggestedAction(error, context) {
    if (error.message.includes('Account blocked')) {
      return 'Check your BitQuery API key in Settings';
    }

    if (error.message.includes('insufficient balance')) {
      return 'Add more SOL to your wallet';
    }

    if (error.message.includes('slippage')) {
      return 'Increase slippage tolerance or reduce amount';
    }

    if (error.message.includes('timeout')) {
      return 'Check your internet connection';
    }

    if (error.message.includes('rate limit')) {
      return 'Wait a moment and try again';
    }

    return 'Try again or contact support';
  }
}

// Create global instance
export const errorHandler = new ErrorHandler();
