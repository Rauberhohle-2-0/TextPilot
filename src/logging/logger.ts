/**
 * The logger, built as a small core with pluggable transports.
 *
 * The core only decides *whether* a message is emitted (level filtering) and
 * *who* gets it (the transport list). Everything about *how* a message leaves
 * the process - printing, writing files - lives in a transport. Adding a new
 * sink later is one file under `transports/` and one entry in the transport
 * list; the logger core does not change.
 *
 * A run means one process lifetime: the file transport is given `truncate`
 * semantics by the entry point, so every `bun run dev` (or packaged start)
 * begins with a fresh log file.
 */
import type { LogLevel } from "../config/app.ts";
import type { Transport } from "./transport.ts";

export interface LogEntry {
  readonly time: Date;
  readonly level: LogLevel;
  readonly message: string;
  /** Structured context, merged into the formatted line. */
  readonly data?: Record<string, unknown>;
  /** Where the entry came from, e.g. "server" or "dev". */
  readonly scope?: string;
}

export interface LoggerOptions {
  /** Minimum level that reaches the transports. Defaults to "info". */
  level?: LogLevel;
  /** Receives every entry that passes the filter. */
  transports: Transport[];
  /** Prefix for every entry this logger emits. */
  scope?: string;
  /**
   * Called when a transport throws. Defaults to silent isolation so a
   * failing transport neither breaks the others nor spams the console.
   * Wire `console.error` here from the entry point if you want visibility.
   */
  onTransportError?: (
    transport: Transport,
    error: unknown,
    entry: LogEntry,
  ) => void;
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class Logger {
  readonly #transports: Transport[];
  readonly #threshold: number;
  readonly #scope?: string;
  readonly #onTransportError?: LoggerOptions["onTransportError"];

  constructor(options: LoggerOptions) {
    this.#threshold = LEVEL_WEIGHT[options.level ?? "info"];
    this.#transports = options.transports;
    this.#scope = options.scope;
    this.#onTransportError = options.onTransportError;
  }

  /** A logger that prefixes its entries with `scope` and inherits the rest. */
  child(scope: string): Logger {
    return new Logger({
      level: (Object.keys(LEVEL_WEIGHT) as LogLevel[]).find(
        (level) => LEVEL_WEIGHT[level] === this.#threshold,
      ),
      transports: this.#transports,
      scope: this.#scope ? `${this.#scope}:${scope}` : scope,
      onTransportError: this.#onTransportError,
    });
  }

  debug(message: string, data?: Record<string, unknown>): void {
    this.#log("debug", message, data);
  }

  info(message: string, data?: Record<string, unknown>): void {
    this.#log("info", message, data);
  }

  warn(message: string, data?: Record<string, unknown>): void {
    this.#log("warn", message, data);
  }

  error(message: string, data?: Record<string, unknown>): void {
    this.#log("error", message, data);
  }

  /** Flush and release the transports; call once when the run ends. */
  close(): void {
    for (const transport of this.#transports) {
      try {
        transport.close?.();
      } catch {
        // A transport that fails to close must not break shutdown.
      }
    }
  }

  #log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (LEVEL_WEIGHT[level] < this.#threshold) return;

    const entry: LogEntry = {
      time: new Date(),
      level,
      message,
      data,
      scope: this.#scope,
    };
    for (const transport of this.#transports) {
      try {
        transport.write(entry);
      } catch (error) {
        // Isolate the failure so the remaining transports still deliver.
        this.#onTransportError?.(transport, error, entry);
      }
    }
  }
}
