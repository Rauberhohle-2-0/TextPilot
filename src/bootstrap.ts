/**
 * Shared bootstrap for the entry points: logger first, then the app.
 *
 * Everything a run needs before a server or a window exists happens here,
 * so `main.ts` and `dev.ts` stay thin and cannot drift apart.
 */
import { readFileSync, readdirSync } from "node:fs";
import { appConfig } from "./config/app.ts";
import { createLogger } from "./logging/index.ts";
import { Logger } from "./logging/logger.ts";
import { createApp } from "./server/app.ts";
import {
  createFileDocumentStore,
  removeSeedNote,
} from "./server/features/documents/index.ts";

export interface Bootstrap {
  app: ReturnType<typeof createApp>;
  logger: Logger;
}

export function bootstrap(): Bootstrap {
  const logger = createLogger();
  logger.info(`${appConfig.name} ${appConfig.version} starting`, {
    identifier: appConfig.identifier,
  });

  migrateLegacyNote(logger);
  const app = createApp({ logger });
  return { app, logger };
}

/**
 * Migrate the single-note era exactly once: if the legacy note has
 * content and no documents exist yet, it becomes the first document and
 * the legacy file is removed, so the migration never runs twice. Runs
 * only from real entry points - tests build the app directly and never
 * touch the user's data directory. Synchronous on purpose: it must
 * finish before the first request can arrive.
 */
function migrateLegacyNote(logger: Logger): void {
  try {
    const dir = appConfig.data.documents;
    const hasDocuments = (() => {
      try {
        return readdirSync(dir).some((name) => name.endsWith(".json"));
      } catch {
        return false; // No documents directory yet: nothing to keep.
      }
    })();
    if (hasDocuments) return;

    let legacy: string | null = null;
    try {
      const raw = readFileSync(appConfig.data.note, "utf8");
      const note = JSON.parse(raw) as { text?: unknown };
      legacy = typeof note.text === "string" && note.text.trim().length > 0 ? note.text : null;
    } catch {
      legacy = null; // No legacy note, or unreadable: nothing to migrate.
    }
    if (legacy === null) return;

    const store = createFileDocumentStore({ directory: dir, logger });
    void store.create(legacy).then(() => {
      removeSeedNote(appConfig.data.note);
      logger.child("documents").info("legacy note migrated to a document");
    });
  } catch (error) {
    logger.child("documents").warn("legacy migration failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
