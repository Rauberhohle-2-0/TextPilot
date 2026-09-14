/**
 * `bun run dev` - start Hono, then open the Vantail window pointing at it.
 *
 * `vantail dev` points the window at a Vite dev server, which is the right
 * thing for a bundled front end and no use to a server-rendered one. So this
 * does that job itself: listen on a port, hand the runtime a config whose
 * `dev.url` is that port, and spawn the binary. The pieces come from the same
 * packages the CLI uses, exactly as in Vantail's own server-rendered example.
 *
 * Everything the app itself needs - logger, routes - comes from `bootstrap`.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildRuntimeConfig } from "@vantail/cli";
import { resolveRuntimeBinary } from "@vantail/runtime";
import { bootstrap } from "./bootstrap.ts";
import { projectRoot } from "./config/app.ts";
import config from "../vantail.config.ts";

const { app, logger } = bootstrap();
const devLogger = logger.child("dev");

const runtime = resolveRuntimeBinary({ cwd: projectRoot });
const server = Bun.serve({ port: 0, fetch: app.fetch });
const url = `http://127.0.0.1:${server.port}/`;

// The same file `vantail dev` writes, built by the same function - so the
// window gets the title and background colour from `vantail.config.ts`
// exactly as it would through the CLI.
const configDir = join(projectRoot, ".vantail");
const configPath = join(configDir, "dev.json");
mkdirSync(configDir, { recursive: true });
writeFileSync(
  configPath,
  JSON.stringify(buildRuntimeConfig({ config, root: projectRoot, devUrl: url }), null, 2),
);

devLogger.info("window config written", { path: configPath });
devLogger.info(`hono listening on ${url}`);
devLogger.info(`runtime at ${runtime.path}`);

const child = spawn(runtime.path, ["--config", configPath], {
  stdio: "inherit",
});
devLogger.info("window launched", { pid: child.pid });

// The window closing ends the run, the way `vantail dev` does it.
child.on("exit", (code) => {
  devLogger.info(`window closed (exit ${code ?? 0}), shutting down`);
  void server.stop(true);
  logger.close();
  process.exit(code ?? 0);
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    devLogger.info(`received ${signal}, shutting down`);
    child.kill();
    void server.stop(true);
    logger.close();
  });
}
