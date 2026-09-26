import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { aiRateLimiter } from "../src/middleware/rateLimiters.js";

/**
 * The real aiRateLimiter guarding POST /api/v1/assistant/* (NFR-SEC-07).
 * Kept in its own file: limiter quota is module-global, so exercising it
 * here cannot starve the functional tests in assistant.test.ts (and the
 * functional file mocks the limiter passthrough for hermetic tests).
 */
describe("assistant rate limiting (shared aiRateLimiter infra)", () => {
  it("allows 10 requests, then blocks with the RATE_LIMITED envelope", async () => {
    const app = express();
    app.use(express.json());
    app.use(aiRateLimiter);
    app.post("/ping", (_req, res) => res.json({ ok: true }));
    // Same centralized handler as the real API: converts the limiter's
    // thrown ApiError into the standard error envelope.
    app.use(errorHandler);

    for (let i = 0; i < 10; i++) {
      const res = await request(app).post("/ping");
      expect(res.status).toBe(200);
    }
    const blocked = await request(app).post("/ping");
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({ code: "RATE_LIMITED" });
    expect(typeof blocked.body.safeMessage).toBe("string");
  });
});
