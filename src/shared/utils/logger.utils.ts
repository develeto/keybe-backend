import pino from 'pino';

const isLocal = process.env.IS_OFFLINE === 'true';
const logger = pino({
  ...(isLocal && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'yyyy-mm-dd HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    },
  }),
  formatters: {
    level(label) {
      return { level: label?.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
