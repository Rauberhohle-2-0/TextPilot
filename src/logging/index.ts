/**
 * Assembles the application logger: console + file, from `appConfig`.
 *
 * The single place that knows which transports a run gets. Entry points
 * create one logger here and hand children down to the modules, so every
 * part of the app logs through the same pipe.
 */
import { appConfig } from "../config/app.ts";
import { Logger } from "./logger.ts";
import { ConsoleTransport } from "./transports/console.ts";
import { FileTransport } from "./transports/file.ts";

export { Logger } from "./logger.ts";
export type { LogEntry } from "./logger.ts";
export type { Transport } from "./transport.ts";

export function createLogger(): Logger {
  return new Logger({
    level: appConfig.logging.level,
    transports: [
      new ConsoleTransport(),
      new FileTransport({ path: appConfig.logging.file, truncate: true }),
    ],
  });
}
