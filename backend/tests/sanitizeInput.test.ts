import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { sanitizeMongoOperators } from "../src/middleware/sanitizeInput.js";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(sanitizeMongoOperators);
  app.post("/echo", (req, res) => res.json({ body: req.body }));
  app.get("/echo", (req, res) => res.json({ query: req.query }));
  return app;
}

const app = buildApp();

describe("sanitizeMongoOperators (NFR-SEC-05)", () => {
  it("strips top-level $ operator keys from the body", async () => {
    const res = await request(app).post("/echo").send({ value: 5, $where: "true" });
    expect(res.body.body).toEqual({ value: 5 });
  });

  it("strips dotted keys from the body", async () => {
    const res = await request(app).post("/echo").send({ "user.role": "admin", name: "Ada" });
    expect(res.body.body).toEqual({ name: "Ada" });
  });

  it("strips operator keys inside nested objects and arrays", async () => {
    const res = await request(app)
      .post("/echo")
      .send({
        filter: { $gt: 5, nested: { $ne: null, ok: true } },
        list: [{ $or: [], keep: 1 }],
      });
    expect(res.body.body).toEqual({ filter: { nested: { ok: true } }, list: [{ keep: 1 }] });
  });

  it("leaves normal query params untouched", async () => {
    const res = await request(app).get("/echo").query({ q: "chicken", page: "2" });
    expect(res.body.query).toEqual({ q: "chicken", page: "2" });
  });

  it("strips operator keys from query params", async () => {
    const res = await request(app).get("/echo").query({ $where: "true", q: "ok" });
    expect(res.body.query).toEqual({ q: "ok" });
  });
});
