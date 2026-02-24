import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  ...(isDev && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      },
    },
  }),
});

// Child loggers — her modül kendi context'ini taşır
export const dbLogger = logger.child({ module: 'db' });
export const redisLogger = logger.child({ module: 'redis' });
export const wsLogger = logger.child({ module: 'ws' });
export const httpLogger = logger.child({ module: 'http' });
export const socketLogger = logger.child({ module: 'socket' });
export const aiLogger = logger.child({ module: 'ai' });
