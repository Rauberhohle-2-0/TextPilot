/**
 * The greeting routes: the page the Vantail window shows.
 *
 * Both paths answer the same page, because the runtime opens the dev URL
 * with `index.html` appended - a server that only answers `/` would show a
 * 404 in a window with no address bar.
 */
import { Hono } from "hono";
import { GREETING } from "./greeting-message.ts";

export const greetingRoutes = new Hono();

greetingRoutes.get("/", (c) => c.html(page(), 200));
greetingRoutes.get("/index.html", (c) => c.html(page(), 200));

function page() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Textpilot</title>
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
