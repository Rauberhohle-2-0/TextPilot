/**
 * The Hono application, assembled from route modules.
 *
 * Free of transport concerns: no port, no process lifetime. Anything that
 * has a `fetch` can serve it. A logger is injected instead of imported, so
 * tests get a silent logger and the entry points decide where output goes.
 */
import { Hono } from "hono";
import type { Logger } from "../logging/logger.ts";
import { requestLogger } from "./middleware/request-logger.ts";
import { apiRoutes } from "./routes/api.ts";
import { greetingRoutes } from "./routes/greeting.ts";

export interface CreateAppOptions {
  /** Receives request logs. Child loggers are derived from it. */
  logger?: Logger;
}

export function createApp({ logger }: CreateAppOptions = {}): Hono {
  const app = new Hono();

  if (logger) {
    const accessLogger = logger.child("server");
    app.use(requestLogger(accessLogger));
  }

  app.route("/", greetingRoutes);
  app.route("/api", apiRoutes);

  return app;
}
