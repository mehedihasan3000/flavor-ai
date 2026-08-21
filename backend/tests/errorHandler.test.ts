import type { NextFunction, Request, Response } from "express";
import { describe, expect, it } from "vitest";
import { errorHandler } from "../src/middleware/errorHandler.js";

function mockResponse(): Response {
  const res = {
    statusCode: 0,
    body: null,
    status(this: Response, code: number) {
      this.statusCode = code;
      return this;
    },
    json(this: Response, body: unknown) {
      this.body = body;
      return this;
    },
  } as unknown as Response;
  return res;
}

describe("errorHandler", () => {
  it("maps Mongoose duplicate-key (E11000) to 409 CONFLICT", () => {
    const res = mockResponse();
    const dupError = { code: 11000, keyPattern: { slug: 1 } };

    errorHandler(dupError, {} as Request, res, (() => {}) as NextFunction);

    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      status: 409,
      code: "CONFLICT",
      safeMessage: "A record with this value already exists.",
      validation: { slug: "already exists" },
    });
  });

  it("maps unknown errors to 500 INTERNAL_ERROR without leaking internals", () => {
    const res = mockResponse();

    errorHandler(new Error("secret internals"), {} as Request, res, (() => {}) as NextFunction);

    expect(res.statusCode).toBe(500);
    expect(res.body.safeMessage).not.toContain("secret internals");
  });
});