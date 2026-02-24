type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const currentLevel: LogLevel =
  process.env.NODE_ENV === 'production' ? 'warn' : 'debug';

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

function createLogger(module: string) {
  const prefix = `[${module}]`;

  return {
    debug: (...args: unknown[]) => shouldLog('debug') && console.debug(prefix, ...args),
    info: (...args: unknown[]) => shouldLog('info') && console.info(prefix, ...args),
    warn: (...args: unknown[]) => shouldLog('warn') && console.warn(prefix, ...args),
    error: (...args: unknown[]) => shouldLog('error') && console.error(prefix, ...args),
  };
}

export const log = createLogger('app');
export const wsLog = createLogger('ws');
export const boardLog = createLogger('board');
export const uiLog = createLogger('ui');
export const aiLog = createLogger('ai');
export const agentLog = createLogger('agent');
export const importLog = createLogger('import');
export const offlineLog = createLogger('offline');
