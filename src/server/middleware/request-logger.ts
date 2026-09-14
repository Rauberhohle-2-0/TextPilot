/**
 * Logs every request once the response is ready, so status and duration
 * describe the outcome rather than the arrival.
 */
import type { MiddlewareHandler } from "hono";
import type { Logger } from "../../logging/logger.ts";

export function requestLogger(logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const start = performance.now();
    await next();
    const ms = (performance.now() - start).toFixed(1);

    const message = `${c.req.method} ${c.req.path} -> ${c.res.status} (${ms}ms)`;
    const data = { status: c.res.status, durationMs: Number(ms) };

    if (c.res.status >= 500) {
      logger.error(message, data);
    } else if (c.res.status >= 400) {
      logger.warn(message, data);
    } else {
      logger.info(message, data);
    }
  };
}
