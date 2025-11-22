/**
 * Centralized Logging Utility for Intune Admin Portal
 * Provides structured logging with levels, timestamps, and context
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SUCCESS: 4,
};

const LOG_COLORS = {
  DEBUG: '#6c757d',
  INFO: '#0d6efd',
  WARN: '#ffc107',
  ERROR: '#dc3545',
  SUCCESS: '#198754',
};

const LOG_ICONS = {
  DEBUG: '🔍',
  INFO: 'ℹ️',
  WARN: '⚠️',
  ERROR: '❌',
  SUCCESS: '✅',
};

class Logger {
  constructor(context = 'App') {
    this.context = context;
    this.logs = [];
    this.maxLogs = 1000; // Keep last 1000 logs in memory
    this.currentLogLevel = LOG_LEVELS.DEBUG; // Show all logs by default
  }

  setLogLevel(level) {
    this.currentLogLevel = LOG_LEVELS[level] || LOG_LEVELS.DEBUG;
  }

  _formatTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3 
    });
  }

  _log(level, message, data = null, error = null) {
    if (LOG_LEVELS[level] < this.currentLogLevel) {
      return; // Don't log if below current level
    }

    const timestamp = this._formatTimestamp();
    const logEntry = {
      timestamp,
      level,
      context: this.context,
      message,
      data,
      error: error ? {
        message: error.message,
        stack: error.stack,
        response: error.response?.data,
      } : null,
    };

    // Store in memory
    this.logs.push(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift(); // Remove oldest log
    }

    // Store in localStorage for persistence (last 100 logs)
    this._saveToLocalStorage(logEntry);

    // Console output with styling
    const icon = LOG_ICONS[level];
    const color = LOG_COLORS[level];
    const prefix = `${icon} [${timestamp}] [${this.context}]`;

    const consoleMethod = {
      DEBUG: 'debug',
      INFO: 'info',
      WARN: 'warn',
      ERROR: 'error',
      SUCCESS: 'log',
    }[level];

    if (data || error) {
      console[consoleMethod](
        `%c${prefix} ${message}`,
        `color: ${color}; font-weight: bold;`,
        data || error
      );
    } else {
      console[consoleMethod](
        `%c${prefix} ${message}`,
        `color: ${color}; font-weight: bold;`
      );
    }
  }

  _saveToLocalStorage(logEntry) {
    try {
      const stored = JSON.parse(localStorage.getItem('intune_logs') || '[]');
      stored.push(logEntry);
      
      // Keep only last 100 logs in localStorage
      if (stored.length > 100) {
        stored.shift();
      }
      
      localStorage.setItem('intune_logs', JSON.stringify(stored));
    } catch (e) {
      // Ignore storage errors
    }
  }

  debug(message, data = null) {
    this._log('DEBUG', message, data);
  }

  info(message, data = null) {
    this._log('INFO', message, data);
  }

  warn(message, data = null) {
    this._log('WARN', message, data);
  }

  error(message, error = null, data = null) {
    this._log('ERROR', message, data, error);
  }

  success(message, data = null) {
    this._log('SUCCESS', message, data);
  }

  // Specialized logging methods
  apiCall(method, endpoint, params = null) {
    this.debug(`API Call: ${method} ${endpoint}`, params);
  }

  apiResponse(method, endpoint, status, data = null) {
    this.info(`API Response: ${method} ${endpoint} - Status: ${status}`, data);
  }

  apiError(method, endpoint, error) {
    this.error(`API Error: ${method} ${endpoint}`, error);
  }

  operation(operationName, stage, message, data = null) {
    this.info(`[${operationName}] ${stage}: ${message}`, data);
  }

  operationSuccess(operationName, message, data = null) {
    this.success(`[${operationName}] ${message}`, data);
  }

  operationError(operationName, message, error) {
    this.error(`[${operationName}] ${message}`, error);
  }

  // Get logs for export/display
  getLogs(level = null, context = null, limit = 100) {
    let filtered = [...this.logs];

    if (level) {
      filtered = filtered.filter(log => log.level === level);
    }

    if (context) {
      filtered = filtered.filter(log => log.context === context);
    }

    return filtered.slice(-limit);
  }

  // Get logs from localStorage
  getStoredLogs() {
    try {
      return JSON.parse(localStorage.getItem('intune_logs') || '[]');
    } catch (e) {
      return [];
    }
  }

  // Export logs as text
  exportLogs() {
    const logs = this.getStoredLogs();
    return logs.map(log => {
      let line = `[${log.timestamp}] [${log.level}] [${log.context}] ${log.message}`;
      if (log.data) {
        line += `\n  Data: ${JSON.stringify(log.data, null, 2)}`;
      }
      if (log.error) {
        line += `\n  Error: ${log.error.message}`;
        if (log.error.response) {
          line += `\n  Response: ${JSON.stringify(log.error.response, null, 2)}`;
        }
      }
      return line;
    }).join('\n\n');
  }

  // Download logs as file
  downloadLogs() {
    const content = this.exportLogs();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `intune-admin-logs-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // Clear all logs
  clearLogs() {
    this.logs = [];
    localStorage.removeItem('intune_logs');
    this.info('Logs cleared');
  }

  // Get summary statistics
  getStats() {
    const logs = this.getStoredLogs();
    const stats = {
      total: logs.length,
      byLevel: {},
      byContext: {},
      errors: logs.filter(l => l.level === 'ERROR').length,
      warnings: logs.filter(l => l.level === 'WARN').length,
    };

    logs.forEach(log => {
      stats.byLevel[log.level] = (stats.byLevel[log.level] || 0) + 1;
      stats.byContext[log.context] = (stats.byContext[log.context] || 0) + 1;
    });

    return stats;
  }
}

// Create context-specific loggers
export const createLogger = (context) => new Logger(context);

// Default logger instances
export const autopilotLogger = new Logger('Autopilot');
export const deviceLogger = new Logger('Device');
export const appLogger = new Logger('Application');
export const authLogger = new Logger('Authentication');
export const graphLogger = new Logger('GraphAPI');

// Global logger
const globalLogger = new Logger('Global');

export default globalLogger;
