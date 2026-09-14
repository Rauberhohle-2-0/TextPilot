import { describe, expect, test } from "bun:test";
import { createApp } from "../src/index.ts";

describe("src/index.ts", () => {
  const app = createApp();

  test("GET / greets the user", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Hello from Vantail!");
  });

  test("GET /index.html answers the same page", async () => {
    const res = await app.request("/index.html");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Hello from Vantail!");
  });

  test("GET /api/greeting returns JSON", async () => {
    const res = await app.request("/api/greeting");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ greeting: "Hello from Vantail!" });
  });

  test("unknown paths 404", async () => {
    const res = await app.request("/nope");
    expect(res.status).toBe(404);
  });
});
