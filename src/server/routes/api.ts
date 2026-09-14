/**
 * The JSON API. New endpoints belong in their own route module under
 * `routes/` and get mounted in `server/app.ts` - one line, nothing else.
 */
import { Hono } from "hono";
import { appConfig } from "../../config/app.ts";
import { GREETING } from "./greeting-message.ts";

export const apiRoutes = new Hono();

apiRoutes.get("/greeting", (c) => c.json({ greeting: GREETING }, 200));
apiRoutes.get("/health", (c) =>
  c.json({ name: appConfig.name, version: appConfig.version, status: "ok" }, 200),
);
