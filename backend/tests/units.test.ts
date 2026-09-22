import { describe, expect, it } from "vitest";
import { convertQuantity, toBaseUnit, unitGroup } from "../src/utils/units.js";

describe("units (FEATURES_TASKS.md §1.1, Dev A)", () => {
  describe("unitGroup", () => {
    it("classifies mass units", () => {
      expect(unitGroup("g")).toBe("mass");
      expect(unitGroup("kg")).toBe("mass");
    });

    it("classifies volume units", () => {
      expect(unitGroup("ml")).toBe("volume");
      expect(unitGroup("l")).toBe("volume");
      expect(unitGroup("tsp")).toBe("volume");
      expect(unitGroup("tbsp")).toBe("volume");
      expect(unitGroup("cup")).toBe("volume");
    });

    it("classifies count and other", () => {
      expect(unitGroup("pcs")).toBe("count");
      expect(unitGroup("oz")).toBe("other");
      expect(unitGroup("lb")).toBe("other");
      expect(unitGroup("bunch")).toBe("other");
      expect(unitGroup("")).toBe("other");
    });

    it("is case-insensitive and trims whitespace", () => {
      expect(unitGroup("KG")).toBe("mass");
      expect(unitGroup(" Cup ")).toBe("volume");
      expect(unitGroup("PCS")).toBe("count");
    });
  });

  describe("toBaseUnit", () => {
    it("resolves mass to grams", () => {
      expect(toBaseUnit("g")).toEqual({ base: "g", factor: 1 });
      expect(toBaseUnit("kg")).toEqual({ base: "g", factor: 1000 });
    });

    it("resolves volume to milliliters", () => {
      expect(toBaseUnit("ml")).toEqual({ base: "ml", factor: 1 });
      expect(toBaseUnit("l")).toEqual({ base: "ml", factor: 1000 });
      expect(toBaseUnit("tsp")).toEqual({ base: "ml", factor: 5 });
      expect(toBaseUnit("tbsp")).toEqual({ base: "ml", factor: 15 });
      expect(toBaseUnit("cup")).toEqual({ base: "ml", factor: 240 });
    });

    it("resolves count to pcs", () => {
      expect(toBaseUnit("pcs")).toEqual({ base: "pcs", factor: 1 });
    });

    it("returns null for imperial and unknown units", () => {
      expect(toBaseUnit("oz")).toBeNull();
      expect(toBaseUnit("lb")).toBeNull();
      expect(toBaseUnit("bunch")).toBeNull();
      expect(toBaseUnit("pieces")).toBeNull();
      expect(toBaseUnit("")).toBeNull();
    });

    it("rejects prototype-chain keys (constructor/__proto__)", () => {
      expect(unitGroup("constructor")).toBe("other");
      expect(unitGroup("__proto__")).toBe("other");
      expect(toBaseUnit("constructor")).toBeNull();
      expect(toBaseUnit("__proto__")).toBeNull();
      expect(convertQuantity(1, "constructor", "g")).toBeNull();
      expect(convertQuantity(1, "g", "__proto__")).toBeNull();
    });
  });

  describe("convertQuantity", () => {
    it("converts mass g<->kg (factor 1000)", () => {
      expect(convertQuantity(1, "kg", "g")).toBe(1000);
      expect(convertQuantity(500, "g", "kg")).toBe(0.5);
      expect(convertQuantity(2.5, "kg", "g")).toBe(2500);
    });

    it("converts volume ml<->l (factor 1000)", () => {
      expect(convertQuantity(1, "l", "ml")).toBe(1000);
      expect(convertQuantity(250, "ml", "l")).toBe(0.25);
    });

    it("converts kitchen tsp<->tbsp<->cup<->ml", () => {
      expect(convertQuantity(1, "tbsp", "tsp")).toBe(3);
      expect(convertQuantity(3, "tsp", "tbsp")).toBe(1);
      expect(convertQuantity(1, "cup", "tbsp")).toBe(16);
      expect(convertQuantity(16, "tbsp", "cup")).toBe(1);
      expect(convertQuantity(1, "cup", "ml")).toBe(240);
      expect(convertQuantity(240, "ml", "cup")).toBe(1);
      expect(convertQuantity(1, "tbsp", "ml")).toBe(15);
      expect(convertQuantity(1, "tsp", "ml")).toBe(5);
    });

    it("converts cup<->l via ml", () => {
      expect(convertQuantity(1, "cup", "l")).toBeCloseTo(0.24, 10);
      expect(convertQuantity(1, "l", "cup")).toBeCloseTo(1000 / 240, 10);
    });

    it("is identity for the same unit (incl. pcs)", () => {
      expect(convertQuantity(8, "pcs", "pcs")).toBe(8);
      expect(convertQuantity(500, "g", "g")).toBe(500);
      expect(convertQuantity(2, "cup", "cup")).toBe(2);
    });

    it("is identity for same-unit unknown pairs (safe same-line subtraction)", () => {
      expect(convertQuantity(2, "bunch", "bunch")).toBe(2);
      expect(convertQuantity(1.5, "oz", "oz")).toBe(1.5);
    });

    it("returns null for incompatible groups (pcs<->g, mass<->volume)", () => {
      expect(convertQuantity(1, "pcs", "g")).toBeNull();
      expect(convertQuantity(1, "g", "pcs")).toBeNull();
      expect(convertQuantity(1, "pcs", "ml")).toBeNull();
      expect(convertQuantity(100, "g", "ml")).toBeNull();
      expect(convertQuantity(100, "ml", "g")).toBeNull();
      expect(convertQuantity(2, "cup", "g")).toBeNull();
    });

    it("returns null for imperial conversions", () => {
      expect(convertQuantity(1, "oz", "g")).toBeNull();
      expect(convertQuantity(1, "g", "oz")).toBeNull();
      expect(convertQuantity(1, "lb", "kg")).toBeNull();
      expect(convertQuantity(1, "oz", "lb")).toBeNull();
      expect(convertQuantity(1, "oz", "ml")).toBeNull();
    });

    it("returns null for unknown units", () => {
      expect(convertQuantity(1, "bunch", "g")).toBeNull();
      expect(convertQuantity(1, "g", "bunch")).toBeNull();
      expect(convertQuantity(1, "pieces", "pcs")).toBeNull();
    });

    it("is case-insensitive", () => {
      expect(convertQuantity(1, "KG", "G")).toBe(1000);
      expect(convertQuantity(1, "Cup", "ML")).toBe(240);
    });

    it("returns null for non-finite quantities", () => {
      expect(convertQuantity(NaN, "g", "kg")).toBeNull();
      expect(convertQuantity(Infinity, "g", "kg")).toBeNull();
    });
  });
});
