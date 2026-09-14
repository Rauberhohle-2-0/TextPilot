/**
 * Shared bootstrap for the entry points: logger first, then the app.
 *
 * Everything a run needs before a server or a window exists happens here,
 * so `main.ts` and `dev.ts` stay thin and cannot drift apart.
 */
import { appConfig } from "./config/app.ts";
import { createLogger } from "./logging/index.ts";
import { Logger } from "./logging/logger.ts";
import { createApp } from "./server/app.ts";

export interface Bootstrap {
  app: ReturnType<typeof createApp>;
  logger: Logger;
}

export function bootstrap(): Bootstrap {
  const logger = createLogger();
  logger.info(`${appConfig.name} ${appConfig.version} starting`, {
    identifier: appConfig.identifier,
  });

  const app = createApp({ logger });
  return { app, logger };
}
