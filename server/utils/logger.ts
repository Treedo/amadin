export interface Logger {
  info: (msg: string, payload?: unknown) => void;
  warn: (msg: string, payload?: unknown) => void;
  error: (msg: string | Error, payload?: unknown) => void;
  debug: (msg: string, payload?: unknown) => void;
  child: (context: Record<string, unknown>) => Logger;
}

function format(prefix: string, message: string, payload?: unknown) {
  const time = new Date().toISOString();
  if (payload) {
    console.log(`[${time}] ${prefix}: ${message}`, payload);
  } else {
    console.log(`[${time}] ${prefix}: ${message}`);
  }
}

const baseLogger: Logger = {
  info: (msg, payload) => format('INFO', msg, payload),
  warn: (msg, payload) => format('WARN', msg, payload),
  error: (msg, payload) => format('ERROR', msg instanceof Error ? msg.message : msg, payload),
  debug: (msg, payload) => format('DEBUG', msg, payload),
  child: () => baseLogger
};

export const logger: Logger = baseLogger;
