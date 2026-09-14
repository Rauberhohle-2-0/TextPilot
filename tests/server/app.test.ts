import { describe, expect, test } from "bun:test";
import { createApp } from "../../src/server/app.ts";
import { Logger } from "../../src/logging/logger.ts";
import type { LogEntry } from "../../src/logging/logger.ts";
import type { Transport } from "../../src/logging/transport.ts";
import { GREETING } from "../../src/server/routes/greeting-message.ts";

/** A transport that keeps entries in memory - for asserting on logs. */
class MemoryTransport implements Transport {
  readonly name = "memory";
  readonly entries: LogEntry[] = [];

  write(entry: LogEntry): void {
    this.entries.push(entry);
  }
}

function loggerWithMemory() {
  const transport = new MemoryTransport();
  const logger = new Logger({ level: "debug", transports: [transport] });
  return { transport, logger };
}

describe("server", () => {
  test("GET / greets the user", async () => {
    const { transport, logger } = loggerWithMemory();
    const app = createApp({ logger });

    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(GREETING);

    const access = transport.entries.find((entry) => entry.scope === "server");
    expect(access?.message).toContain("GET / -> 200");
  });

  test("GET /index.html answers the same page", async () => {
    const app = createApp();
    const res = await app.request("/index.html");
    expect(res.status).toBe(200);
    expect(await res.text()).toContain(GREETING);
  });

  test("GET /api/greeting returns JSON", async () => {
    const app = createApp();
    const res = await app.request("/api/greeting");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ greeting: GREETING });
  });

  test("GET /api/health reports the app identity", async () => {
    const app = createApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.name).toBe("Textpilot");
  });

  test("unknown paths 404 and log a warning", async () => {
    const { transport, logger } = loggerWithMemory();
    const app = createApp({ logger });

    const res = await app.request("/nope");
    expect(res.status).toBe(404);

    const access = transport.entries.find((entry) => entry.scope === "server");
    expect(access?.level).toBe("warn");
  });
});
