function format(prefix, message, payload) {
    const time = new Date().toISOString();
    if (payload) {
        console.log(`[${time}] ${prefix}: ${message}`, payload);
    }
    else {
        console.log(`[${time}] ${prefix}: ${message}`);
    }
}
const baseLogger = {
    info: (msg, payload) => format('INFO', msg, payload),
    warn: (msg, payload) => format('WARN', msg, payload),
    error: (msg, payload) => format('ERROR', msg instanceof Error ? msg.message : msg, payload),
    debug: (msg, payload) => format('DEBUG', msg, payload),
    child: () => baseLogger
};
export const logger = baseLogger;
