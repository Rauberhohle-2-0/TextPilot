/**
 * `bun run dev` - start Hono, then open the Vantail window pointing at it.
 *
 * `vantail dev` points the window at a Vite dev server, which is the right
 * thing for a bundled front end and no use to a server-rendered one. So this
 * does that job itself: listen on a port, hand the runtime a config whose
 * `dev.url` is that port, and spawn the binary. The pieces come from the same
 * packages the CLI uses, exactly as in Vantail's own server-rendered example.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRuntimeConfig } from "@vantail/cli";
import { resolveRuntimeBinary } from "@vantail/runtime";
import config from "../vantail.config.ts";
import { createApp } from "./index.ts";

const root = dirname(fileURLToPath(import.meta.url));

const runtime = resolveRuntimeBinary({ cwd: root });

const server = Bun.serve({ port: 0, fetch: createApp().fetch });
const url = `http://127.0.0.1:${server.port}/`;

// The same file `vantail dev` writes, built by the same function - so the
// window gets the title and background colour from `vantail.config.ts`
// exactly as it would through the CLI.
const configPath = join(root, "..", ".vantail", "dev.json");
mkdirSync(dirname(configPath), { recursive: true });
writeFileSync(
  configPath,
  JSON.stringify(buildRuntimeConfig({ config, root, devUrl: url }), null, 2),
);

console.log(`\n ${config.app.name}`);
console.log(` hono   ${url}`);
console.log(` runtime ${runtime.path}\n`);

const child = spawn(runtime.path, ["--config", configPath], {
  stdio: "inherit",
});

// The window closing ends the run, the way `vantail dev` does it.
child.on("exit", (code) => {
  void server.stop(true);
  process.exit(code ?? 0);
});
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    child.kill();
    void server.stop(true);
  });
}
