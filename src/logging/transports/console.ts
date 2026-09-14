/**
 * Writes entries to stdout/stderr: normal levels to stdout, warn and error
 * to stderr so redirects keep working.
 */
import type { LogEntry } from "../logger.ts";
import type { Transport } from "../transport.ts";

const LEVEL_LABEL: Record<LogEntry["level"], string> = {
  debug: "DEBUG",
  info: "INFO ",
  warn: "WARN ",
  error: "ERROR",
};

export class ConsoleTransport implements Transport {
  readonly name = "console";

  write(entry: LogEntry): void {
    const line = format(entry);
    if (entry.level === "warn" || entry.level === "error") {
      console.error(line);
    } else {
      console.log(line);
    }
  }
}

export function format(entry: LogEntry): string {
  const time = entry.time.toISOString();
  const scope = entry.scope ? ` [${entry.scope}]` : "";
  const data = entry.data ? ` ${JSON.stringify(entry.data)}` : "";
  return `${time} ${LEVEL_LABEL[entry.level]}${scope} ${entry.message}${data}`;
}
