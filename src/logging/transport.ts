/**
 * A transport is anything a log entry can be handed to.
 *
 * `write` is called for every entry that passed the level filter; it must
 * not throw. `close` is optional and runs once at shutdown.
 */
import type { LogEntry } from "./logger.ts";

export interface Transport {
  /** Name used in diagnostics when the transport misbehaves. */
  readonly name: string;
  write(entry: LogEntry): void;
  close?(): void;
}
