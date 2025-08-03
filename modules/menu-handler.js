import inquirer from 'inquirer';
import { colors } from '../colors.js';

// Menu states
export const MENU_STATES = {
  MAIN: 'main',
  MONITOR: 'monitor'
};

// Logo display function
function showLogo() {
  console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}🚀 SOLANA TRADE TRACKER${colors.reset}`);
  console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
  console.log(`${colors.gray}Version 1.0 | by @voroninvisuals${colors.reset}`);
  console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}\n`);
}

// Hotkeys configuration
export const HOTKEYS = {
  '1': 'monitor',
  '2': 'settings', 
  '3': 'wallets',
  '4': 'bundle',
  '5': 'multiwallet',
  '6': 'analytics',
  '7': 'alerts',
  '8': 'scanner',
  '9': 'jupiter',
  '0': 'checktoken',
  's': 'status',
  'r': 'roi',
  'a': 'ai',
  'h': 'help',
  'c': 'clear',
  'q': 'exit',
  't': 'manualswap',
  'b': 'bundleswap',
  'j': 'jupitercli',
  'i': 'aitradingcli',
  'l': 'logsviewer',
  'd': 'demomode',
  'e': 'exportdata',
  'f': 'quickstats',
  'g': 'gmgnmonitor',
  'v': 'volumeanalysis',
  'm': 'marketscanner',
  'p': 'portfoliotracker',
  'u': 'updatechecker',
  'w': 'webinterface',
  'x': 'advancedtools',
  'z': 'systeminfo'
};

// Mode descriptions
export const modeDescriptions = {
  pump: {
    title: `${colors.green}Pump Detection${colors.reset}`,
    description: [
      'Monitors trades for potential pump signals and early entry opportunities.',
      'Features:',
      '• Real-time pump detection',
      '• Early signal notifications', 
      '• Price movement analysis',
      '• Volume spike detection'
    ]
  },
  pumpfunCrossMarket: {
    title: `${colors.yellow}Pumpfun CrossMarket${colors.reset}`,
    description: [
      'Scans for cross-market asymmetry opportunities on Pumpfun.',
      'Features:',
      '• Finds tokens with price asymmetry ≤ 0.1',
      '• Filters for recent, successful trades',
      '• Shows top tokens by price'
    ]
  },
  pumpfunGraduated: {
    title: `${colors.cyan}Pumpfun Graduated${colors.reset}`,
    description: [
      'Monitors migration and pool creation events on Pumpfun.',
      'Features:',
      '• Tracks token migrations to Pumpfun',
      '• Monitors pool creation events',
      '• Shows instruction details and arguments',
      '• Real-time event notifications'
    ]
  },
  gmgnTrend: {
    title: `${colors.purple}GMGN Trend Monitoring${colors.reset}`,
    description: [
      'Monitors specific tokens from GMGN trend links.',
      'Features:',
      '• Monitor tokens from GMGN trend URLs',
      '• Real-time price tracking',
      '• Volume and price change analysis',
      '• Custom trend monitoring'
    ]
  }
};

// Enhanced menu display with hotkeys
function displayMenuWithHotkeys() {
  console.log(`\n${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}🚀 SOLANA TRADE TRACKER - QUICK MENU${colors.reset}`);
  console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}\n`);
  
  const menuItems = [
    { key: '1', name: 'Start Monitoring', color: colors.green, shortcut: '1' },
    { key: '2', name: 'Settings', color: colors.blue, shortcut: '2' },
    { key: '3', name: 'Wallet Manager', color: colors.magenta, shortcut: '3' },
    { key: '4', name: 'Bundle Buy/Sell', color: colors.yellow, shortcut: '4' },
    { key: '5', name: 'Multi-Wallet Trading', color: colors.cyan, shortcut: '5' },
    { key: '6', name: 'Analytics Dashboard', color: colors.purple, shortcut: '6' },
    { key: '7', name: 'Price Alerts', color: colors.orange, shortcut: '7' },
    { key: '8', name: 'Token Scanner', color: colors.pink, shortcut: '8' },
    { key: '9', name: 'Jupiter Token Analysis', color: colors.green, shortcut: '9' },
    { key: '0', name: 'Check Token Address', color: colors.purple, shortcut: '0' },
    { key: 's', name: 'Connection Status', color: colors.blue, shortcut: 'S' },
    { key: 'r', name: 'ROI Tracker & Dump Manager', color: colors.red, shortcut: 'R' },
    { key: 'a', name: '🤖 AI Analytics & Predictions', color: colors.cyan, shortcut: 'A' },
    { key: 'h', name: 'Help & Shortcuts', color: colors.yellow, shortcut: 'H' },
    { key: 'c', name: 'Clear Screen', color: colors.gray, shortcut: 'C' },
    { key: 'q', name: 'Exit', color: colors.red, shortcut: 'Q' },
    { key: 't', name: 'Manual Swap', color: colors.cyan, shortcut: 'T' },
    { key: 'b', name: 'Bundle Swap', color: colors.magenta, shortcut: 'B' },
    { key: 'j', name: 'Jupiter CLI', color: colors.green, shortcut: 'J' },
    { key: 'i', name: 'AI Trading CLI', color: colors.cyan, shortcut: 'I' },
    { key: 'l', name: 'Logs Viewer', color: colors.yellow, shortcut: 'L' },
    { key: 'd', name: 'Demo Mode', color: colors.purple, shortcut: 'D' },
    { key: 'e', name: 'Export Data', color: colors.blue, shortcut: 'E' },
    { key: 'f', name: 'Quick Stats', color: colors.orange, shortcut: 'F' },
    { key: 'g', name: 'GMGN Monitor', color: colors.pink, shortcut: 'G' },
    { key: 'v', name: 'Volume Analysis', color: colors.cyan, shortcut: 'V' },
    { key: 'm', name: 'Market Scanner', color: colors.green, shortcut: 'M' },
    { key: 'p', name: 'Portfolio Tracker', color: colors.magenta, shortcut: 'P' },
    { key: 'u', name: 'Update Checker', color: colors.yellow, shortcut: 'U' },
    { key: 'w', name: 'Web Interface', color: colors.blue, shortcut: 'W' },
    { key: 'x', name: 'Advanced Tools', color: colors.purple, shortcut: 'X' },
    { key: 'z', name: 'System Info', color: colors.gray, shortcut: 'Z' }
  ];

  // Display in 3 columns for better layout
  const itemsPerColumn = Math.ceil(menuItems.length / 3);
  const column1 = menuItems.slice(0, itemsPerColumn);
  const column2 = menuItems.slice(itemsPerColumn, itemsPerColumn * 2);
  const column3 = menuItems.slice(itemsPerColumn * 2);

  for (let i = 0; i < Math.max(column1.length, column2.length, column3.length); i++) {
    let line = '';
    
    // Column 1
    if (column1[i]) {
      line += `${column1[i].color}[${column1[i].shortcut}]${colors.reset} ${column1[i].name}`;
    }
    
    // Column 2
    if (column2[i]) {
      const padding1 = 30 - (column1[i] ? column1[i].name.length + 6 : 0);
      line += ' '.repeat(Math.max(0, padding1)) + `${column2[i].color}[${column2[i].shortcut}]${colors.reset} ${column2[i].name}`;
    }
    
    // Column 3
    if (column3[i]) {
      const padding2 = 30 - (column2[i] ? column2[i].name.length + 6 : 0);
      line += ' '.repeat(Math.max(0, padding2)) + `${column3[i].color}[${column3[i].shortcut}]${colors.reset} ${column3[i].name}`;
    }
    
    console.log(line);
  }
  
  console.log(`\n${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
  console.log(`${colors.yellow}💡 Tip: Use number keys (1-9,0) or letter keys (S,R,A,H,C,Q) for quick access${colors.reset}`);
  console.log(`${colors.gray}Press Enter for traditional menu or type a shortcut key${colors.reset}`);
  console.log(`${colors.cyan}📋 Menu displayed in 3 columns for better organization${colors.reset}\n`);
}

// Show help and shortcuts
function showHelp() {
  console.clear();
  console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}📖 HELP & SHORTCUTS${colors.reset}`);
  console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}\n`);
  
  console.log(`${colors.yellow}🎯 QUICK ACCESS KEYS:${colors.reset}`);
  console.log(`  1-9,0: Direct menu selection`);
  console.log(`  S: Connection Status    T: Manual Swap`);
  console.log(`  R: ROI Tracker         B: Bundle Swap`);
  console.log(`  A: AI Analytics        J: Jupiter CLI`);
  console.log(`  H: This help screen    I: AI Trading CLI`);
  console.log(`  C: Clear screen        L: Logs Viewer`);
  console.log(`  Q: Exit application    D: Demo Mode`);
  console.log(`  E: Export Data         F: Quick Stats`);
  console.log(`  G: GMGN Monitor        V: Volume Analysis`);
  console.log(`  M: Market Scanner      P: Portfolio Tracker`);
  console.log(`  U: Update Checker      W: Web Interface`);
  console.log(`  X: Advanced Tools      Z: System Info\n`);
  
  console.log(`${colors.yellow}🔧 MONITORING SHORTCUTS:${colors.reset}`);
  console.log(`  ↑/↓: Navigate trades`);
  console.log(`  ←/→: Navigate charts`);
  console.log(`  Space: Pause/Resume`);
  console.log(`  Enter: Select trade`);
  console.log(`  C: Copy address to clipboard`);
  console.log(`  J: Jupiter analysis`);
  console.log(`  B: Birdeye chart`);
  console.log(`  G: GMGN chart\n`);
  
  console.log(`${colors.yellow}⚡ PERFORMANCE TIPS:${colors.reset}`);
  console.log(`  • Use number keys for fastest navigation`);
  console.log(`  • Press 'C' to clear screen anytime`);
  console.log(`  • Use 'H' to see this help anytime`);
  console.log(`  • Press 'Q' to exit quickly\n`);
  
  console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
  console.log(`${colors.gray}Press any key to return to menu...${colors.reset}`);
}

// Enhanced main menu with hotkey support
export async function showMainMenu() {
  showLogo();
  displayMenuWithHotkeys();
  
  const { action } = await inquirer.prompt([
    {
      type: 'input',
      name: 'action',
      message: `${colors.cyan}Select action (number/letter or Enter for menu):${colors.reset}`,
      prefix: '🚀',
      validate: (input) => {
        if (!input) return true; // Allow empty for traditional menu
        const key = input.toLowerCase();
        if (HOTKEYS[key] || input === '') return true;
        return 'Invalid key. Press H for help or Enter for menu.';
      },
      transformer: (input) => {
        if (!input) return '';
        const key = input.toLowerCase();
        return HOTKEYS[key] || input;
      }
    }
  ]);

  // Handle hotkey input
  if (action && action.length === 1) {
    const key = action.toLowerCase();
    if (HOTKEYS[key]) {
      return HOTKEYS[key];
    }
  }

  // If no hotkey or empty input, show traditional menu
  if (!action || action === '') {
    return await showTraditionalMenu();
  }

  return action;
}

// Traditional menu as fallback with 3-column display
async function showTraditionalMenu() {
  console.log(`\n${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}🚀 TRADITIONAL MENU - SELECT AN OPTION${colors.reset}`);
  console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}\n`);
  
  const menuItems = [
    `${colors.green}[1] Start Monitoring${colors.reset}`,
    `${colors.blue}[2] Settings${colors.reset}`,
    `${colors.magenta}[3] Wallet Manager${colors.reset}`,
    `${colors.yellow}[4] Bundle Buy/Sell${colors.reset}`,
    `${colors.cyan}[5] Multi-Wallet Trading${colors.reset}`,
    `${colors.purple}[6] Analytics Dashboard${colors.reset}`,
    `${colors.orange}[7] Price Alerts${colors.reset}`,
    `${colors.pink}[8] Token Scanner${colors.reset}`,
    `${colors.green}[9] Jupiter Token Analysis${colors.reset}`,
    `${colors.purple}[0] Check Token Address${colors.reset}`,
    `${colors.blue}[S] Connection Status${colors.reset}`,
    `${colors.red}[R] ROI Tracker & Dump Manager${colors.reset}`,
    `${colors.cyan}[A] 🤖 AI Analytics & Predictions${colors.reset}`,
    `${colors.yellow}[H] Help & Shortcuts${colors.reset}`,
    `${colors.gray}[C] Clear Screen${colors.reset}`,
    `${colors.red}[Q] Exit${colors.reset}`,
    `${colors.cyan}[T] Manual Swap${colors.reset}`,
    `${colors.magenta}[B] Bundle Swap${colors.reset}`,
    `${colors.green}[J] Jupiter CLI${colors.reset}`,
    `${colors.cyan}[I] AI Trading CLI${colors.reset}`,
    `${colors.yellow}[L] Logs Viewer${colors.reset}`,
    `${colors.purple}[D] Demo Mode${colors.reset}`,
    `${colors.blue}[E] Export Data${colors.reset}`,
    `${colors.orange}[F] Quick Stats${colors.reset}`,
    `${colors.pink}[G] GMGN Monitor${colors.reset}`,
    `${colors.cyan}[V] Volume Analysis${colors.reset}`,
    `${colors.green}[M] Market Scanner${colors.reset}`,
    `${colors.magenta}[P] Portfolio Tracker${colors.reset}`,
    `${colors.yellow}[U] Update Checker${colors.reset}`,
    `${colors.blue}[W] Web Interface${colors.reset}`,
    `${colors.purple}[X] Advanced Tools${colors.reset}`,
    `${colors.gray}[Z] System Info${colors.reset}`
  ];

  // Display in 3 columns
  const itemsPerColumn = Math.ceil(menuItems.length / 3);
  const column1 = menuItems.slice(0, itemsPerColumn);
  const column2 = menuItems.slice(itemsPerColumn, itemsPerColumn * 2);
  const column3 = menuItems.slice(itemsPerColumn * 2);

  for (let i = 0; i < Math.max(column1.length, column2.length, column3.length); i++) {
    let line = '';
    
    // Column 1
    if (column1[i]) {
      line += column1[i];
    }
    
    // Column 2
    if (column2[i]) {
      const padding1 = 30 - (column1[i] ? column1[i].replace(/\x1b\[[0-9;]*m/g, '').length : 0);
      line += ' '.repeat(Math.max(0, padding1)) + column2[i];
    }
    
    // Column 3
    if (column3[i]) {
      const padding2 = 30 - (column2[i] ? column2[i].replace(/\x1b\[[0-9;]*m/g, '').length : 0);
      line += ' '.repeat(Math.max(0, padding2)) + column3[i];
    }
    
    console.log(line);
  }
  
  console.log(`\n${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
  
  const { action } = await inquirer.prompt([
    {
      type: 'input',
      name: 'action',
      message: `${colors.cyan}Enter your choice (number/letter):${colors.reset}`,
      prefix: '🚀',
      validate: (input) => {
        if (!input) return 'Please enter a valid choice';
        const validChoices = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 's', 'r', 'a', 'h', 'c', 'q', 't', 'b', 'j', 'i', 'l', 'd', 'e', 'f', 'g', 'v', 'm', 'p', 'u', 'w', 'x', 'z'];
        if (validChoices.includes(input.toLowerCase())) return true;
        return 'Please enter a valid choice (1-9, 0, S, R, A, H, C, Q, T, B, J, I, L, D, E, F, G, V, M, P, U, W, X, Z)';
      }
    }
  ]);

  // Map input to action values
  const actionMap = {
    '1': 'monitor',
    '2': 'settings', 
    '3': 'wallets',
    '4': 'bundle',
    '5': 'multiwallet',
    '6': 'analytics',
    '7': 'alerts',
    '8': 'scanner',
    '9': 'jupiter',
    '0': 'checktoken',
    's': 'status',
    'r': 'roi',
    'a': 'ai',
    'h': 'help',
    'c': 'clear',
    'q': 'exit',
    't': 'manualswap',
    'b': 'bundleswap',
    'j': 'jupitercli',
    'i': 'aitradingcli',
    'l': 'logsviewer',
    'd': 'demomode',
    'e': 'exportdata',
    'f': 'quickstats',
    'g': 'gmgnmonitor',
    'v': 'volumeanalysis',
    'm': 'marketscanner',
    'p': 'portfoliotracker',
    'u': 'updatechecker',
    'w': 'webinterface',
    'x': 'advancedtools',
    'z': 'systeminfo'
  };

  return actionMap[action.toLowerCase()] || action;
}

// Enhanced monitoring mode selection
export async function showInitialQueryMenu() {
  console.log(`\n${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}🔍 SELECT MONITORING MODE${colors.reset}`);
  console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}\n`);
  
  const { queryType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'queryType',
      message: 'Select monitoring mode:',
      prefix: '🔍',
      choices: [
        { 
          name: `${colors.green}[1] Pump Detection${colors.reset} - Monitor for potential pump signals`,
          value: 'pump',
          short: 'Pump Detection'
        },
        {
          name: `${colors.yellow}[2] Pumpfun CrossMarket${colors.reset} - Cross-market asymmetry scanner`,
          value: 'pumpfunCrossMarket',
          short: 'Pumpfun CrossMarket'
        },
        {
          name: `${colors.cyan}[3] Pumpfun Graduated${colors.reset} - Monitor migration and pool creation events`,
          value: 'pumpfunGraduated',
          short: 'Pumpfun Graduated'
        },
        {
          name: `${colors.magenta}[4] Pumpfun New Tokens${colors.reset} - Monitor new token creation events`,
          value: 'pumpfunNewTokens',
          short: 'Pumpfun New Tokens'
        },
        {
          name: `${colors.purple}[5] GMGN Trend Monitoring${colors.reset} - Monitor tokens from GMGN trend links`,
          value: 'gmgnTrend',
          short: 'GMGN Trend'
        }
      ]
    }
  ]);

  return queryType;
}

// Quick action handler
export function handleQuickAction(input) {
  const key = input.toLowerCase();
  if (HOTKEYS[key]) {
    return HOTKEYS[key];
  }
  return null;
}

// Display connection status with quick actions
export function displayConnectionStatus(status) {
  console.log(`\n${colors.cyan}${'═'.repeat(60)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}🔗 CONNECTION STATUS${colors.reset}`);
  console.log(`${colors.cyan}${'═'.repeat(60)}${colors.reset}\n`);
  
  const services = [
    { name: 'BitQuery', status: status.bitquery, icon: '🔍' },
    { name: 'Jupiter', status: status.jupiter, icon: '🪐' },
    { name: 'Birdeye', status: status.birdeye, icon: '👁️' }
  ];
  
  services.forEach(service => {
    const statusColor = service.status.connected ? colors.green : colors.red;
    const statusText = service.status.connected ? '● Connected' : '● Disconnected';
    console.log(`${service.icon} ${service.name}: ${statusColor}${statusText}${colors.reset}`);
    if (!service.status.connected && service.status.error) {
      console.log(`   ${colors.red}Error: ${service.status.error}${colors.reset}`);
    }
  });
  
  console.log(`\n${colors.yellow}💡 Quick Actions:${colors.reset}`);
  console.log(`  Press 'R' to retry connections`);
  console.log(`  Press 'S' to show detailed status`);
  console.log(`  Press 'M' to return to main menu`);
}

// Export help function
export { showHelp }; 