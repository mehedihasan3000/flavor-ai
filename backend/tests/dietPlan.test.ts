import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../src/config/env.js";
import { UserModel } from "../src/models/User.js";
import { createApp } from "../src/server.js";
import {
  buildFoodPlan,
  calculateBMI,
  calculateBMR,
  calculateDietPlan,
  getBmiCategory,
  selectProteinFoods,
} from "../src/services/dietService.js";
import { DietPlanInput, DietPlanResult } from "../src/types/index.js";

vi.mock("../src/models/User.js", () => ({
  UserModel: {
    findOne: vi.fn().mockReturnValue({
      lean: () => ({
        exec: async () => ({
          _id: "507f1f77bcf86cd799439011",
          email: "chef@example.com",
          name: "Chef",
          role: "user",
        }),
      }),
    }),
  },
}));

const app = createApp();

function signToken(role: "user" | "admin" = "user"): string {
  return jwt.sign({ sub: "507f1f77bcf86cd799439011", role }, env.JWT_SECRET, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
    expiresIn: "15m",
  });
}

describe("dietService — pure calculations", () => {
  it("calculates BMI correctly (70kg / 175cm → 22.9)", () => {
    expect(calculateBMI(70, 175)).toBe(22.9);
  });

  it("classifies BMI categories at WHO boundaries", () => {
    expect(getBmiCategory(18.4)).toBe("Underweight");
    expect(getBmiCategory(18.5)).toBe("Normal weight");
    expect(getBmiCategory(24.9)).toBe("Normal weight");
    expect(getBmiCategory(25)).toBe("Overweight");
    expect(getBmiCategory(29.9)).toBe("Overweight");
    expect(getBmiCategory(30)).toBe("Obesity");
  });

  it("calculates Mifflin-St Jeor BMR for male and female", () => {
    // male: 10*70 + 6.25*175 - 5*30 + 5 = 1648.75 → 1649
    expect(calculateBMR(70, 175, 30, "male")).toBe(1649);
    // female: 10*60 + 6.25*165 - 5*25 - 161 = 1345.25 → 1345
    expect(calculateBMR(60, 165, 25, "female")).toBe(1345);
  });

  it("computes the full plan end-to-end (moderate male)", () => {
    const result = calculateDietPlan({
      age: 30,
      weightKg: 70,
      heightCm: 175,
      sex: "male",
      activityLevel: "moderate",
    });
    expect(result.bmi).toBe(22.9);
    expect(result.bmiCategory).toBe("Normal weight");
    expect(result.bmrCalories).toBe(1649);
    expect(result.dailyCalories).toBe(2556);
    expect(result.protein).toEqual({ min: 84, max: 126, estimate: 105 });
    expect(result.foodPlan.length).toBeGreaterThan(0);
    expect(typeof result.disclaimer).toBe("string");
  });

  it("scales protein with activity level", () => {
    const sedentary = calculateDietPlan({
      age: 30,
      weightKg: 70,
      heightCm: 175,
      sex: "male",
      activityLevel: "sedentary",
    });
    const veryActive = calculateDietPlan({
      age: 30,
      weightKg: 70,
      heightCm: 175,
      sex: "male",
      activityLevel: "very-active",
    });
    expect(veryActive.dailyCalories).toBeGreaterThan(sedentary.dailyCalories);
    expect(veryActive.protein.estimate).toBeGreaterThan(sedentary.protein.estimate);
  });

  it("food plan portions approximately cover the protein target", () => {
    const plan = buildFoodPlan(105);
    const total = plan.reduce((sum, item) => sum + item.proteinGrams, 0);
    expect(Math.abs(total - 105)).toBeLessThanOrEqual(6);
  });

  it("filters animal products for vegan preference", () => {
    const foods = selectProteinFoods("vegan");
    expect(foods.length).toBeGreaterThan(0);
    for (const f of foods) expect(f.vegan).toBe(true);
    const plan = buildFoodPlan(100, "vegan");
    const names = plan.map((p) => p.food.toLowerCase()).join(" ");
    expect(names).not.toContain("chicken");
    expect(names).not.toContain("egg");
    expect(names).not.toContain("yogurt");
  });

  it("clamps BMR at zero for schema-legal extreme inputs (never negative)", () => {
    // age 120 / weight 20 kg / height 50 cm drives Mifflin-St Jeor negative
    expect(calculateBMR(20, 50, 120, "female")).toBe(0);
    const result = calculateDietPlan({
      age: 120,
      weightKg: 20,
      heightCm: 50,
      sex: "female",
      activityLevel: "sedentary",
    });
    expect(result.bmrCalories).toBeGreaterThanOrEqual(0);
    expect(result.dailyCalories).toBeGreaterThanOrEqual(0);
    // The clamped output must still satisfy the response contract
    expect(() => DietPlanResult.parse(result)).not.toThrow();
  });

  it("excludes legumes for keto and low-carb preferences", () => {
    for (const pref of ["keto", "low-carb"] as const) {
      const foods = selectProteinFoods(pref);
      expect(foods.length).toBeGreaterThan(0);
      for (const f of foods) expect(f.lowCarb).toBe(true);
      const plan = buildFoodPlan(100, pref);
      const names = plan.map((p) => p.food.toLowerCase()).join(" ");
      expect(names).not.toContain("lentil");
      expect(names).not.toContain("chickpea");
    }
  });

  it("uses the default plan for labels without a specific conflict", () => {
    for (const pref of ["halal", "gluten-free", "high-protein"] as const) {
      const plan = buildFoodPlan(100, pref);
      expect(plan.length).toBeGreaterThan(0);
      const names = plan.map((p) => p.food);
      expect(names).toContain("Chicken breast (skinless)");
    }
  });

  it("allows eggs and dairy for vegetarian preference", () => {
    const foods = selectProteinFoods("vegetarian");
    for (const f of foods) expect(f.vegetarian).toBe(true);
  });
});

describe("dietPlan — input validation", () => {
  it("accepts a complete valid input", () => {
    const result = DietPlanInput.safeParse({
      age: 30,
      weightKg: 70,
      heightCm: 175,
      sex: "male",
      activityLevel: "moderate",
      dietaryPreference: "vegetarian",
    });
    expect(result.success).toBe(true);
  });

  it("rejects out-of-range body metrics and unknown enums", () => {
    expect(DietPlanInput.safeParse({ age: 0, weightKg: 70, heightCm: 175, sex: "male", activityLevel: "moderate" }).success).toBe(false);
    expect(DietPlanInput.safeParse({ age: 30, weightKg: 10, heightCm: 175, sex: "male", activityLevel: "moderate" }).success).toBe(false);
    expect(DietPlanInput.safeParse({ age: 30, weightKg: 70, heightCm: 300, sex: "male", activityLevel: "moderate" }).success).toBe(false);
    expect(DietPlanInput.safeParse({ age: 30, weightKg: 70, heightCm: 175, sex: "other", activityLevel: "moderate" }).success).toBe(false);
    expect(DietPlanInput.safeParse({ age: 30, weightKg: 70, heightCm: 175, sex: "male", activityLevel: "extreme" }).success).toBe(false);
  });

  it("coerces numeric strings from form submissions", () => {
    const result = DietPlanInput.safeParse({
      age: "30",
      weightKg: "70",
      heightCm: "175",
      sex: "female",
      activityLevel: "light",
    });
    expect(result.success).toBe(true);
  });
});

describe("POST /api/v1/diet/plan", () => {
  beforeEach(() => {
    vi.mocked(UserModel.findOne).mockReturnValue({
      lean: () => ({
        exec: async () => ({
          _id: "507f1f77bcf86cd799439011",
          email: "chef@example.com",
          name: "Chef",
          role: "user",
        }),
      }),
    } as never);
  });

  it("rejects unauthenticated requests (401)", async () => {
    const res = await request(app)
      .post("/api/v1/diet/plan")
      .send({ age: 30, weightKg: 70, heightCm: 175, sex: "male", activityLevel: "moderate" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("UNAUTHORIZED");
  });

  it("rejects invalid body with 400 VALIDATION_ERROR", async () => {
    const res = await request(app)
      .post("/api/v1/diet/plan")
      .set("Authorization", `Bearer ${signToken()}`)
      .send({ age: 30, weightKg: 70, heightCm: 175, sex: "male", activityLevel: "extreme" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns the calculated plan (200) for valid input", async () => {
    const res = await request(app)
      .post("/api/v1/diet/plan")
      .set("Authorization", `Bearer ${signToken()}`)
      .send({ age: 30, weightKg: 70, heightCm: 175, sex: "male", activityLevel: "moderate" });

    expect(res.status).toBe(200);
    expect(res.body.bmi).toBe(22.9);
    expect(res.body.bmiCategory).toBe("Normal weight");
    expect(res.body.bmrCalories).toBe(1649);
    expect(res.body.dailyCalories).toBe(2556);
    expect(res.body.protein).toEqual({ min: 84, max: 126, estimate: 105 });
    expect(Array.isArray(res.body.foodPlan)).toBe(true);
    expect(res.body.foodPlan.length).toBeGreaterThan(0);
    expect(typeof res.body.disclaimer).toBe("string");
  });

  it("respects the vegan dietary preference end-to-end", async () => {
    const res = await request(app)
      .post("/api/v1/diet/plan")
      .set("Authorization", `Bearer ${signToken()}`)
      .send({
        age: 30,
        weightKg: 70,
        heightCm: 175,
        sex: "female",
        activityLevel: "light",
        dietaryPreference: "vegan",
      });

    expect(res.status).toBe(200);
    const names = (res.body.foodPlan as Array<{ food: string }>)
      .map((p) => p.food.toLowerCase())
      .join(" ");
    expect(names).not.toContain("chicken");
    expect(names).not.toContain("egg");
  });

  it("returns non-negative values for extreme inputs (200, contract-valid)", async () => {
    const res = await request(app)
      .post("/api/v1/diet/plan")
      .set("Authorization", `Bearer ${signToken()}`)
      .send({ age: 120, weightKg: 20, heightCm: 50, sex: "female", activityLevel: "sedentary" });

    expect(res.status).toBe(200);
    expect(res.body.bmrCalories).toBeGreaterThanOrEqual(0);
    expect(res.body.dailyCalories).toBeGreaterThanOrEqual(0);
  });

  it("excludes legumes for keto end-to-end", async () => {
    const res = await request(app)
      .post("/api/v1/diet/plan")
      .set("Authorization", `Bearer ${signToken()}`)
      .send({
        age: 30,
        weightKg: 70,
        heightCm: 175,
        sex: "male",
        activityLevel: "moderate",
        dietaryPreference: "keto",
      });

    expect(res.status).toBe(200);
    const names = (res.body.foodPlan as Array<{ food: string }>)
      .map((p) => p.food.toLowerCase())
      .join(" ");
    expect(names).not.toContain("lentil");
    expect(names).not.toContain("chickpea");
  });
});
