import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/server.js";

describe("API base wiring", () => {
  const app = createApp();

  it("GET /api/v1/health returns the standard envelope", async () => {
    const res = await request(app).get("/api/v1/health");

    // 200 when DB connected (Atlas URI set), 503 when not — both must be valid envelopes.
    expect([200, 503]).toContain(res.status);
    expect(res.body).toMatchObject({
      status: expect.any(String),
      service: "flavorai-api",
      version: "v1",
      database: { connected: expect.any(Boolean), readyState: expect.any(Number) },
    });
  });

  it("unknown route returns 404 envelope", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      status: 404,
      code: "NOT_FOUND",
      safeMessage: "Resource not found.",
    });
  });
});