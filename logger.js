// Handles all logging functionality
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

export function logToFile(message, type = 'info') {
  const now = new Date();
  const timestamp = now.toISOString();
  const date = now.toISOString().split('T')[0];
  
  const logFiles = {
    trade: `trades_${date}.log`,
    error: `errors_${date}.log`,
    info: `info_${date}.log`
  };

  const fileName = logFiles[type] || logFiles.info;
  const logPath = path.join(logsDir, fileName);
  
  const logEntry = `[${timestamp}] ${message}\n`;
  
  try {
    fs.appendFileSync(logPath, logEntry);
  } catch (error) {
    console.error(`Error writing to log file: ${error.message}`);
  }
} 