import * as fs from 'fs';
import * as path from 'path';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import inquirer from 'inquirer';
import { colors } from '../colors.js';
import { showLogo } from '../utils.js';

export class WalletManager {
  constructor() {
    this.walletsDir = path.join(process.cwd(), 'wallets');
    this.ensureWalletsDirectory();
  }

  ensureWalletsDirectory() {
    if (!fs.existsSync(this.walletsDir)) {
      fs.mkdirSync(this.walletsDir, { recursive: true });
    }
  }

  getWalletFiles() {
    return fs.readdirSync(this.walletsDir)
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''));
  }

  getWalletPath(name) {
    return path.join(this.walletsDir, `${name}.json`);
  }

  saveWallet(name, keypair) {
    const walletPath = this.getWalletPath(name);
    const walletData = {
      name,
      publicKey: keypair.publicKey.toString(),
      secretKey: bs58.encode(keypair.secretKey),
      createdAt: new Date().toISOString()
    };
    fs.writeFileSync(walletPath, JSON.stringify(walletData, null, 2));
  }

  loadWallet(name) {
    try {
      const walletPath = this.getWalletPath(name);
      const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
      const secretKey = bs58.decode(walletData.secretKey);
      return Keypair.fromSecretKey(secretKey);
    } catch (error) {
      console.error(`${colors.red}Error loading wallet: ${error.message}${colors.reset}`);
      return null;
    }
  }

  getWalletPublicKey(name) {
    try {
      const walletPath = this.getWalletPath(name);
      const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
      return walletData.publicKey;
    } catch (error) {
      return null;
    }
  }

  listWallets() {
    const wallets = this.getWalletFiles();
    if (wallets.length === 0) {
      console.log(`${colors.yellow}No wallets found. Create one first.${colors.reset}`);
      return [];
    }
    
    console.log(`${colors.cyan}Available Wallets:${colors.reset}`);
    wallets.forEach((wallet, index) => {
      const publicKey = this.getWalletPublicKey(wallet);
      console.log(`${index + 1}. ${colors.green}${wallet}${colors.reset} - ${publicKey || 'Unknown'}`);
    });
    
    return wallets;
  }

  async createWallet() {
    const { walletName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'walletName',
        message: 'Enter wallet name:',
        validate: (input) => {
          if (!input.trim()) return 'Wallet name cannot be empty';
          if (this.getWalletFiles().includes(input)) return 'Wallet name already exists';
          return true;
        }
      }
    ]);

    const keypair = Keypair.generate();
    this.saveWallet(walletName, keypair);
    
    console.log(`${colors.green}✅ Wallet '${walletName}' created successfully!${colors.reset}`);
    console.log(`${colors.cyan}Public Key: ${keypair.publicKey.toString()}${colors.reset}`);
    
    return keypair;
  }

  async selectWallet() {
    const wallets = this.getWalletFiles();
    if (wallets.length === 0) {
      console.log(`${colors.yellow}No wallets available. Create one first.${colors.reset}`);
      return null;
    }

    const { selectedWallet } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedWallet',
        message: 'Select wallet:',
        choices: wallets.map(wallet => ({
          name: `${wallet} - ${this.getWalletPublicKey(wallet) || 'Unknown'}`,
          value: wallet
        }))
      }
    ]);

    const keypair = this.loadWallet(selectedWallet);
    if (keypair) {
      console.log(`${colors.green}✅ Selected wallet: ${selectedWallet}${colors.reset}`);
      console.log(`${colors.cyan}Public Key: ${keypair.publicKey.toString()}${colors.reset}`);
    }
    
    return keypair;
  }

  async exportWallet() {
    const wallets = this.getWalletFiles();
    if (wallets.length === 0) {
      console.log(`${colors.yellow}No wallets to export.${colors.reset}`);
      return;
    }

    const { selectedWallet } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedWallet',
        message: 'Select wallet to export:',
        choices: wallets
      }
    ]);

    const keypair = this.loadWallet(selectedWallet);
    if (keypair) {
      console.log(`${colors.cyan}Wallet Export:${colors.reset}`);
      console.log(`Name: ${selectedWallet}`);
      console.log(`Public Key: ${keypair.publicKey.toString()}`);
      console.log(`Private Key: ${bs58.encode(keypair.secretKey)}`);
      console.log(`${colors.yellow}⚠️ Keep your private key secure!${colors.reset}`);
    }
  }

  async checkBalance() {
    const wallets = this.getWalletFiles();
    if (wallets.length === 0) {
      console.log(`${colors.yellow}No wallets available.${colors.reset}`);
      return;
    }

    const { selectedWallet } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedWallet',
        message: 'Select wallet to check balance:',
        choices: wallets
      }
    ]);

    const keypair = this.loadWallet(selectedWallet);
    if (keypair) {
      console.log(`${colors.cyan}Checking balance for wallet: ${selectedWallet}${colors.reset}`);
      console.log(`Public Key: ${keypair.publicKey.toString()}`);
      console.log(`${colors.yellow}Balance check functionality not implemented yet.${colors.reset}`);
    }
  }

  async walletManagerMenu() {
    let exit = false;
    
    while (!exit) {
      console.clear();
      showLogo();
      
      console.log(`${colors.magenta}💼 Wallet Manager${colors.reset}`);
      console.log(`${colors.dim}Manage your Solana wallets${colors.reset}\n`);
      
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'Select wallet action:',
          choices: [
            { name: '📋 List Wallets', value: 'list' },
            { name: '➕ Create New Wallet', value: 'create' },
            { name: '🔍 Select Wallet', value: 'select' },
            { name: '📤 Export Wallet', value: 'export' },
            { name: '💰 Check Balance', value: 'balance' },
            { name: '🔙 Back to Main Menu', value: 'exit' }
          ]
        }
      ]);

      switch (action) {
        case 'list':
          this.listWallets();
          console.log(`\n${colors.yellow}Press Enter to continue...${colors.reset}`);
          await new Promise(resolve => {
            const rl = require('readline').createInterface({
              input: process.stdin,
              output: process.stdout
            });
            rl.question('', () => {
              rl.close();
              resolve();
            });
          });
          break;
          
        case 'create':
          await this.createWallet();
          console.log(`\n${colors.yellow}Press Enter to continue...${colors.reset}`);
          await new Promise(resolve => {
            const rl = require('readline').createInterface({
              input: process.stdin,
              output: process.stdout
            });
            rl.question('', () => {
              rl.close();
              resolve();
            });
          });
          break;
          
        case 'select':
          await this.selectWallet();
          console.log(`\n${colors.yellow}Press Enter to continue...${colors.reset}`);
          await new Promise(resolve => {
            const rl = require('readline').createInterface({
              input: process.stdin,
              output: process.stdout
            });
            rl.question('', () => {
              rl.close();
              resolve();
            });
          });
          break;
          
        case 'export':
          await this.exportWallet();
          console.log(`\n${colors.yellow}Press Enter to continue...${colors.reset}`);
          await new Promise(resolve => {
            const rl = require('readline').createInterface({
              input: process.stdin,
              output: process.stdout
            });
            rl.question('', () => {
              rl.close();
              resolve();
            });
          });
          break;
          
        case 'balance':
          await this.checkBalance();
          console.log(`\n${colors.yellow}Press Enter to continue...${colors.reset}`);
          await new Promise(resolve => {
            const rl = require('readline').createInterface({
              input: process.stdin,
              output: process.stdout
            });
            rl.question('', () => {
              rl.close();
              resolve();
            });
          });
          break;
          
        case 'exit':
          exit = true;
          break;
      }
    }
  }
} 