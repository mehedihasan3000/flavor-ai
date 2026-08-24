import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { commentLimiter } from "../src/middleware/rateLimit.js";

function buildApp() {
  const app = express();
  app.use(commentLimiter);
  app.post("/ping", (_req, res) => res.json({ ok: true }));
  return app;
}

describe("commentLimiter (NFR-SEC-07)", () => {
  it("allows requests up to the limit, then blocks with the rate-limit envelope", async () => {
    const app = buildApp();

    for (let i = 0; i < 20; i++) {
      const res = await request(app).post("/ping");
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).post("/ping");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
      safeMessage: "Too many comment actions. Please slow down.",
    });
  });
});
