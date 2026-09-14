/**
 * Main entry point of the project.
 *
 * The application is a Hono app. In development `src/dev.ts` serves it with
 * `Bun.serve` and points the Vantail window at it; the same routes could be
 * answered from anywhere else a `fetch` handler is welcome.
 */
import { Hono } from "hono";

const GREETING = "Hello from Vantail!";

export function createApp() {
  const app = new Hono();

  // Both paths: the runtime opens the dev URL with a page appended, so
  // `/index.html` must answer too, not just `/`.
  app.get("/", (c) => c.html(page(), 200));
  app.get("/index.html", (c) => c.html(page(), 200));
  app.get("/api/greeting", (c) => c.json({ greeting: GREETING }, 200));

  return app;
}

function page() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Vantail</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #0b0d12;
        color: #e6e6ea;
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      main { text-align: center; }
      h1 { font-size: 2rem; margin: 0 0 0.5rem; font-weight: 600; }
      p { margin: 0; color: #9a9aa6; }
    </style>
  </head>
  <body>
    <main>
      <h1>${GREETING}</h1>
      <p>Your desktop app is up and running.</p>
    </main>
  </body>
</html>`;
}

// Serving directly, e.g. `bun run src/index.ts` - handy without a window.
if (import.meta.main) {
  const server = Bun.serve({ port: Number(process.env.PORT ?? 3000), fetch: createApp().fetch });
  console.log(`listening on http://127.0.0.1:${server.port}/`);
}
