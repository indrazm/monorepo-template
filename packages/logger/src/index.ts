import pino, { type Logger, type LoggerOptions as PinoLoggerOptions } from "pino";

export type { Logger } from "pino";

export type LoggerOptions = Omit<PinoLoggerOptions, "transport"> & {
  /** Enable human-readable output for local development. Defaults to false. */
  pretty?: boolean;
};

export function createLogger({ pretty = false, ...options }: LoggerOptions = {}): Logger {
  return pino({
    level: "info",
    ...options,
    ...(pretty
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: process.stdout.isTTY ?? false,
              translateTime: "SYS:standard",
              ignore: "pid,hostname",
            },
          },
        }
      : {}),
  });
}
