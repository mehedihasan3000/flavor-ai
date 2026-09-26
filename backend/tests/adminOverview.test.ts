import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { env } from "../src/config/env.js";
import { UserModel } from "../src/models/User.js";
import { RecipeModel } from "../src/models/Recipe.js";
import { CommentModel } from "../src/models/Comment.js";
import { createApp } from "../src/server.js";
import {
  generateDateSeries,
  getAdminOverview,
  getStartDateForRange,
} from "../src/services/adminOverviewService.js";
import { AdminOverviewResult } from "../src/types/index.js";

const app = createApp();
let mongo: MongoMemoryServer;

function signTestToken(providerId: string): string {
  return jwt.sign({ sub: providerId }, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: "15m",
  });
}

describe("Admin Overview Dashboard", () => {
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());

    const adminProviderId = "admin-sub-123";
    const userProviderId = "user-sub-456";

    await UserModel.create({
      name: "Admin User",
      email: "admin@example.com",
      role: "admin",
      providerId: adminProviderId,
    });

    await UserModel.create({
      name: "Regular User",
      email: "user@example.com",
      role: "user",
      providerId: userProviderId,
    });

    adminToken = signTestToken(adminProviderId);
    userToken = signTestToken(userProviderId);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo.stop();
  });

  describe("Service Helpers", () => {
    it("getStartDateForRange calculates correct start dates", () => {
      const date7 = getStartDateForRange("7d");
      const date30 = getStartDateForRange("30d");
      const date90 = getStartDateForRange("90d");

      expect(date7).toBeInstanceOf(Date);
      expect(date30.getTime()).toBeLessThan(date7.getTime());
      expect(date90.getTime()).toBeLessThan(date30.getTime());
    });

    it("generateDateSeries generates continuous YYYY-MM-DD date arrays", () => {
      const series7 = generateDateSeries("7d");
      const series30 = generateDateSeries("30d");
      const series90 = generateDateSeries("90d");

      expect(series7).toHaveLength(7);
      expect(series30).toHaveLength(30);
      expect(series90).toHaveLength(90);

      expect(series7[0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("getAdminOverview returns valid default shape", async () => {
      const data = await getAdminOverview("30d");
      const parsed = AdminOverviewResult.safeParse(data);
      expect(parsed.success).toBe(true);
      expect(data.range).toBe("30d");
      expect(data.trends.userGrowth).toHaveLength(30);
      expect(data.trends.recipeCreation).toHaveLength(30);
    });
  });

  describe("GET /api/v1/admin/overview endpoint", () => {
    it("returns 401 UNAUTHORIZED when no authorization token is provided", async () => {
      const res = await request(app).get("/api/v1/admin/overview");
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("UNAUTHORIZED");
    });

    it("returns 403 FORBIDDEN when accessed by a non-admin user", async () => {
      const res = await request(app)
        .get("/api/v1/admin/overview")
        .set("Authorization", `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
    });

    it("returns 400 VALIDATION_ERROR when given an invalid range query", async () => {
      const res = await request(app)
        .get("/api/v1/admin/overview?range=invalid")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("returns 200 with valid overview payload for admin user with default 30d range", async () => {
      const res = await request(app)
        .get("/api/v1/admin/overview")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.range).toBe("30d");
      expect(res.body.kpis).toBeDefined();
      expect(res.body.trends.userGrowth).toHaveLength(30);

      const validation = AdminOverviewResult.safeParse(res.body);
      expect(validation.success).toBe(true);
    });

    it("returns 200 and custom 7d range when requested", async () => {
      const res = await request(app)
        .get("/api/v1/admin/overview?range=7d")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.range).toBe("7d");
      expect(res.body.trends.userGrowth).toHaveLength(7);
    });
  });
});
