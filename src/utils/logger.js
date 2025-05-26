const fs = require('fs');
const path = require('path');

// 确保日志目录存在
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

class Logger {
  constructor() {
    this.logFile = path.join(logDir, `app-${new Date().toISOString().split('T')[0]}.log`);
  }

  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const formattedMessage = typeof message === 'object' 
      ? JSON.stringify(message) 
      : message;
    const additionalArgs = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : arg
    ).join(' ') : '';
    
    return `[${timestamp}] [${level.toUpperCase()}] ${formattedMessage}${additionalArgs}`;
  }

  writeToFile(message) {
    fs.appendFileSync(this.logFile, message + '\n');
  }

  info(message, ...args) {
    const formatted = this.formatMessage('info', message, ...args);
    console.log('\x1b[36m%s\x1b[0m', formatted); // 青色
    this.writeToFile(formatted);
  }

  warn(message, ...args) {
    const formatted = this.formatMessage('warn', message, ...args);
    console.warn('\x1b[33m%s\x1b[0m', formatted); // 黄色
    this.writeToFile(formatted);
  }

  error(message, ...args) {
    const formatted = this.formatMessage('error', message, ...args);
    console.error('\x1b[31m%s\x1b[0m', formatted); // 红色
    this.writeToFile(formatted);
  }

  debug(message, ...args) {
    if (process.env.NODE_ENV === 'development') {
      const formatted = this.formatMessage('debug', message, ...args);
      console.log('\x1b[35m%s\x1b[0m', formatted); // 紫色
      this.writeToFile(formatted);
    }
  }
}

module.exports = new Logger(); 