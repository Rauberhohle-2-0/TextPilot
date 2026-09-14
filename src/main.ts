/**
 * Standalone entry: serve the app over HTTP without a window.
 * The desktop path lives in `dev.ts`.
 */
import { serveStatic } from "hono/bun";
import { bootstrap } from "./bootstrap.ts";
import { appConfig } from "./config/app.ts";

const { app, logger } = bootstrap();
const accessLogger = logger.child("main");

// The built renderer (vite build -> dist/renderer).
app.use(serveStatic({ root: "./dist/renderer" }));

const server = Bun.serve({
  port: appConfig.server.port,
  hostname: appConfig.server.host,
  fetch: app.fetch,
});

accessLogger.info(`listening on http://${appConfig.server.host}:${server.port}/`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    accessLogger.info(`received ${signal}, shutting down`);
    void server.stop(true);
    logger.close();
  });
}
