type Level = "DEBUG" | "INFO" | "WARN" | "ERROR";

const LEVEL_ORDER: Record<Level, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

const VALID_LEVELS = new Set<string>(["DEBUG", "INFO", "WARN", "ERROR"]);
const rawLevel = process.env.LOG_LEVEL?.toUpperCase() ?? "";
const configuredLevel: Level = VALID_LEVELS.has(rawLevel) ? (rawLevel as Level) : "INFO";

function write(level: Level, msg: string, meta?: Record<string, unknown>): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[configuredLevel]) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...meta });
  process.stderr.write(line + "\n");
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => write("DEBUG", msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => write("INFO", msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => write("WARN", msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => write("ERROR", msg, meta),
};
