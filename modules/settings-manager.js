import * as fs from 'fs';
import * as path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import readline from 'readline';
import { colors } from '../colors.js';
import { showLogo } from '../utils.js';

export class SettingsManager {
  constructor() {
    this.settingsPath = path.join(process.cwd(), 'settings', 'settings.json');
    this.ensureSettingsDirectory();
    this.settings = this.loadSettings();
  }

  ensureSettingsDirectory() {
    const settingsDir = path.dirname(this.settingsPath);
    if (!fs.existsSync(settingsDir)) {
      fs.mkdirSync(settingsDir, { recursive: true });
    }
  }

  loadSettings() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        return JSON.parse(fs.readFileSync(this.settingsPath, 'utf8'));
      }
    } catch (error) {
      console.error(`${colors.red}Error loading settings: ${error.message}${colors.reset}`);
    }
    
    // Default settings
    return {
      bitqueryApiKey: process.env.BITQUERY_API_KEY || '',
      jupiterRealtimeInterval: 1,
      maxTokensToDisplay: 50,
      autoRefreshInterval: 5,
      enableNotifications: true,
      enableSoundAlerts: false,
      theme: 'default',
      language: 'en',
      // New trading settings
      customRpcEndpoint: 'https://api.mainnet-beta.solana.com',
      slippageLimit: 0.5,
      priorityFee: 5000,
      tipAmount: 0.001,
      enableCustomRpc: false
    };
  }

  saveSettings() {
    try {
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
      console.log(`${colors.green}Settings saved successfully!${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}Error saving settings: ${error.message}${colors.reset}`);
    }
  }

  get(key) {
    return this.settings[key];
  }

  set(key, value) {
    this.settings[key] = value;
    this.saveSettings();
  }

  async showSettingsMenu() {
    let exit = false;
    
    while (!exit) {
      console.clear();
      showLogo();
      
      console.log(`${colors.blue}⚙️ Settings${colors.reset}`);
      console.log(`${colors.dim}Configure application settings${colors.reset}\n`);
      
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'Select setting to configure:',
          choices: [
            { name: '🔑 BitQuery API Key', value: 'bitqueryApiKey' },
            { name: '🌐 Custom RPC Endpoint', value: 'customRpc' },
            { name: '📊 Slippage Limit', value: 'slippage' },
            { name: '⚡ Priority Fee', value: 'priorityFee' },
            { name: '💸 Tip Amount', value: 'tipAmount' },
            { name: '⏱️ Jupiter Realtime Interval', value: 'jupiterInterval' },
            { name: '📊 Max Tokens to Display', value: 'maxTokens' },
            { name: '🔄 Auto Refresh Interval', value: 'autoRefresh' },
            { name: '🔔 Enable Notifications', value: 'notifications' },
            { name: '🔊 Enable Sound Alerts', value: 'soundAlerts' },
            { name: '🎨 Theme', value: 'theme' },
            { name: '🌐 Language', value: 'language' },
            { name: '📋 View All Settings', value: 'view' },
            { name: '🔙 Back to Main Menu', value: 'exit' }
          ]
        }
      ]);

      switch (action) {
        case 'bitqueryApiKey': {
          const { apiKey } = await inquirer.prompt([
            {
              type: 'password',
              name: 'apiKey',
              message: 'Enter BitQuery API Key:',
              default: this.settings.bitqueryApiKey
            }
          ]);
          this.settings.bitqueryApiKey = apiKey;
          this.saveSettings();
          console.log(chalk.green('BitQuery API key updated successfully.'));
          break;
        }
        
        case 'customRpc': {
          const { rpcEndpoint, enableCustom } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'enableCustom',
              message: 'Enable custom RPC endpoint?',
              default: this.settings.enableCustomRpc
            },
            {
              type: 'input',
              name: 'rpcEndpoint',
              message: 'Enter custom RPC endpoint:',
              default: this.settings.customRpcEndpoint,
              when: (answers) => answers.enableCustom,
              validate: (input) => {
                if (!input.startsWith('http://') && !input.startsWith('https://')) {
                  return 'RPC endpoint must start with http:// or https://';
                }
                return true;
              }
            }
          ]);
          this.settings.enableCustomRpc = enableCustom;
          if (enableCustom) {
            this.settings.customRpcEndpoint = rpcEndpoint;
          }
          this.saveSettings();
          console.log(chalk.green(`Custom RPC ${enableCustom ? 'enabled' : 'disabled'}.`));
          break;
        }
        
        case 'slippage': {
          const { slippage } = await inquirer.prompt([
            {
              type: 'input',
              name: 'slippage',
              message: 'Slippage limit (%):',
              default: this.settings.slippageLimit,
              validate: (input) => {
                const num = parseFloat(input);
                if (isNaN(num)) return 'Please enter a valid number';
                if (num < 0.1 || num > 50) return 'Slippage must be between 0.1% and 50%';
                return true;
              },
              filter: (input) => parseFloat(input)
            }
          ]);
          this.settings.slippageLimit = slippage;
          this.saveSettings();
          console.log(chalk.green(`Slippage limit set to ${slippage}%.`));
          break;
        }
        
        case 'priorityFee': {
          const { priorityFee } = await inquirer.prompt([
            {
              type: 'input',
              name: 'priorityFee',
              message: 'Priority fee (micro-lamports):',
              default: this.settings.priorityFee,
              validate: (input) => {
                const num = parseInt(input);
                if (isNaN(num)) return 'Please enter a valid number';
                if (num < 0 || num > 1000000) return 'Priority fee must be between 0 and 1,000,000';
                return true;
              },
              filter: (input) => parseInt(input)
            }
          ]);
          this.settings.priorityFee = priorityFee;
          this.saveSettings();
          console.log(chalk.green(`Priority fee set to ${priorityFee} micro-lamports.`));
          break;
        }
        
        case 'tipAmount': {
          const { tipAmount } = await inquirer.prompt([
            {
              type: 'input',
              name: 'tipAmount',
              message: 'Tip amount (SOL):',
              default: this.settings.tipAmount,
              validate: (input) => {
                const num = parseFloat(input);
                if (isNaN(num)) return 'Please enter a valid number';
                if (num < 0 || num > 1) return 'Tip amount must be between 0 and 1 SOL';
                return true;
              },
              filter: (input) => parseFloat(input)
            }
          ]);
          this.settings.tipAmount = tipAmount;
          this.saveSettings();
          console.log(chalk.green(`Tip amount set to ${tipAmount} SOL.`));
          break;
        }
        
        case 'jupiterInterval': {
          const { interval } = await inquirer.prompt([
            { 
              type: 'input', 
              name: 'interval', 
              message: 'Jupiter realtime update interval (seconds):', 
              default: this.settings.jupiterRealtimeInterval, 
              validate: v => { const num = parseFloat(v); return isNaN(num) ? 'Please enter a valid number' : num >= 0.5 && num <= 30 ? true : 'Interval must be between 0.5 and 30 seconds.'; },
              filter: v => parseFloat(v)
            }
          ]);
          this.settings.jupiterRealtimeInterval = interval;
          this.saveSettings();
          console.log(chalk.green(`Jupiter realtime interval set to ${interval} seconds.`));
          break;
        }
        
        case 'maxTokens': {
          const { maxTokens } = await inquirer.prompt([
            {
              type: 'input',
              name: 'maxTokens',
              message: 'Maximum tokens to display:',
              default: this.settings.maxTokensToDisplay,
              validate: v => { const num = parseFloat(v); return isNaN(num) ? 'Please enter a valid number' : num >= 10 && num <= 200 ? true : 'Max tokens must be between 10 and 200.'; },
              filter: v => parseFloat(v)
            }
          ]);
          this.settings.maxTokensToDisplay = maxTokens;
          this.saveSettings();
          console.log(chalk.green(`Max tokens set to ${maxTokens}.`));
          break;
        }
        
        case 'autoRefresh': {
          const { interval } = await inquirer.prompt([
            {
              type: 'input',
              name: 'interval',
              message: 'Auto refresh interval (seconds):',
              default: this.settings.autoRefreshInterval,
              validate: v => { const num = parseFloat(v); return isNaN(num) ? 'Please enter a valid number' : num >= 1 && num <= 60 ? true : 'Interval must be between 1 and 60 seconds.'; },
              filter: v => parseFloat(v)
            }
          ]);
          this.settings.autoRefreshInterval = interval;
          this.saveSettings();
          console.log(chalk.green(`Auto refresh interval set to ${interval} seconds.`));
          break;
        }
        
        case 'notifications': {
          const { enabled } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'enabled',
              message: 'Enable notifications?',
              default: this.settings.enableNotifications
            }
          ]);
          this.settings.enableNotifications = enabled;
          this.saveSettings();
          console.log(chalk.green(`Notifications ${enabled ? 'enabled' : 'disabled'}.`));
          break;
        }
        
        case 'soundAlerts': {
          const { enabled } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'enabled',
              message: 'Enable sound alerts?',
              default: this.settings.enableSoundAlerts
            }
          ]);
          this.settings.enableSoundAlerts = enabled;
          this.saveSettings();
          console.log(chalk.green(`Sound alerts ${enabled ? 'enabled' : 'disabled'}.`));
          break;
        }
        
        case 'theme': {
          const { theme } = await inquirer.prompt([
            {
              type: 'list',
              name: 'theme',
              message: 'Select theme:',
              choices: [
                { name: 'Default', value: 'default' },
                { name: 'Dark', value: 'dark' },
                { name: 'Light', value: 'light' },
                { name: 'Colorful', value: 'colorful' }
              ],
              default: this.settings.theme
            }
          ]);
          this.settings.theme = theme;
          this.saveSettings();
          console.log(chalk.green(`Theme set to ${theme}.`));
          break;
        }
        
        case 'language': {
          const { language } = await inquirer.prompt([
            {
              type: 'list',
              name: 'language',
              message: 'Select language:',
              choices: [
                { name: 'English', value: 'en' },
                { name: 'Spanish', value: 'es' },
                { name: 'French', value: 'fr' },
                { name: 'German', value: 'de' },
                { name: 'Russian', value: 'ru' }
              ],
              default: this.settings.language
            }
          ]);
          this.settings.language = language;
          this.saveSettings();
          console.log(chalk.green(`Language set to ${language}.`));
          break;
        }
        
        case 'view': {
          console.log(`\n${colors.cyan}Current Settings:${colors.reset}`);
          console.log(`${'─'.repeat(50)}`);
          Object.entries(this.settings).forEach(([key, value]) => {
            const displayValue = key.includes('ApiKey') ? '***' : value;
            console.log(`${colors.cyan}${key}:${colors.reset} ${displayValue}`);
          });
          console.log(`\n${colors.yellow}Press Enter to continue...${colors.reset}`);
          await new Promise(resolve => {
            const originalRawMode = process.stdin.isRaw;
            const originalEncoding = process.stdin.encoding;
            
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.setEncoding('utf8');
            
            const onData = (data) => {
              if (data === '\r' || data === '\n') {
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
          break;
        }
        
        case 'exit':
          exit = true;
          break;
      }
    }
  }
} 