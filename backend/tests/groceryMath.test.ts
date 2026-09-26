import { describe, expect, it } from "vitest";
import {
  categorize,
  consolidateRequirements,
  subtractPantry,
  type GroceryMealRequirements,
  type PantryStockItem,
} from "../src/services/groceryService.js";

describe("Grocery Math Service (groceryMath.test.ts)", () => {
  describe("consolidateRequirements", () => {
    it("consolidates multiple same-unit lines (1 + 2 + 3 onions → 6)", () => {
      const meals: GroceryMealRequirements[] = [
        {
          recipeId: "recipe-1",
          servingsScale: 1,
          ingredients: [{ name: "Onion", quantity: 1, unit: "pcs" }],
        },
        {
          recipeId: "recipe-2",
          servingsScale: 1,
          ingredients: [{ name: "onion", quantity: 2, unit: "pcs" }],
        },
        {
          recipeId: "recipe-3",
          servingsScale: 1,
          ingredients: [{ name: "Onions", quantity: 3, unit: "pcs" }],
        },
      ];

      const consolidated = consolidateRequirements(meals);
      expect(consolidated).toHaveLength(1);
      expect(consolidated[0]).toMatchObject({
        name: "Onion",
        quantity: 6,
        unit: "pcs",
        category: "vegetables",
      });
      expect(consolidated[0].sourceRecipeIds).toEqual(["recipe-1", "recipe-2", "recipe-3"]);
    });

    it("applies servings scaling to ingredient quantities", () => {
      const meals: GroceryMealRequirements[] = [
        {
          recipeId: "recipe-1",
          servingsScale: 2.5, // 2.5x scaling
          ingredients: [
            { name: "Chicken Breast", quantity: 200, unit: "g" },
            { name: "Garlic", quantity: 2, unit: "pcs" },
          ],
        },
      ];

      const consolidated = consolidateRequirements(meals);
      const chicken = consolidated.find((i) => i.name === "Chicken Breast");
      const garlic = consolidated.find((i) => i.name === "Garlic");

      expect(chicken).toBeDefined();
      expect(chicken?.quantity).toBe(500); // 200 * 2.5
      expect(garlic).toBeDefined();
      expect(garlic?.quantity).toBe(5); // 2 * 2.5
    });

    it("sets estimated flag when ingredient quantity is missing or non-finite", () => {
      const meals: GroceryMealRequirements[] = [
        {
          servingsScale: 1,
          ingredients: [{ name: "Apple", quantity: null, unit: "pcs" }],
        },
      ];

      const consolidated = consolidateRequirements(meals);
      expect(consolidated).toHaveLength(1);
      expect(consolidated[0].estimated).toBe(true);
      expect(consolidated[0].quantity).toBe(1);
    });

    it("does not merge incompatible units or unknown custom units across different units", () => {
      const meals: GroceryMealRequirements[] = [
        {
          servingsScale: 1,
          ingredients: [{ name: "Sugar", quantity: 2, unit: "handful" }],
        },
        {
          servingsScale: 1,
          ingredients: [{ name: "Sugar", quantity: 1, unit: "pinch" }],
        },
      ];

      const consolidated = consolidateRequirements(meals);
      expect(consolidated).toHaveLength(2);
      const handfulItem = consolidated.find((i) => i.unit === "handful");
      const pinchItem = consolidated.find((i) => i.unit === "pinch");

      expect(handfulItem?.quantity).toBe(2);
      expect(pinchItem?.quantity).toBe(1);
    });
  });

  describe("subtractPantry", () => {
    it("subtracts pantry stock in convertible units (1kg − 600g → 400g)", () => {
      const meals: GroceryMealRequirements[] = [
        {
          servingsScale: 1,
          ingredients: [{ name: "Rice", quantity: 1, unit: "kg" }],
        },
      ];

      const consolidated = consolidateRequirements(meals);
      // consolidated canonical unit is "g", quantity = 1000g
      expect(consolidated[0].unit).toBe("g");
      expect(consolidated[0].quantity).toBe(1000);

      const pantryItems: PantryStockItem[] = [
        { name: "Rice", quantity: 600, unit: "g" },
      ];

      const { toBuy, covered } = subtractPantry(consolidated, pantryItems);
      expect(toBuy).toHaveLength(1);
      expect(toBuy[0].quantity).toBe(400); // 1000g - 600g = 400g
      expect(covered).toHaveLength(0);
    });

    it("excludes fully-covered items from toBuy and lists them under covered", () => {
      const meals: GroceryMealRequirements[] = [
        {
          servingsScale: 1,
          ingredients: [{ name: "Milk", quantity: 500, unit: "ml" }],
        },
      ];

      const consolidated = consolidateRequirements(meals);
      const pantryItems: PantryStockItem[] = [
        { name: "Milk", quantity: 1, unit: "l" }, // 1L = 1000ml (covers 500ml)
      ];

      const { toBuy, covered } = subtractPantry(consolidated, pantryItems);
      expect(toBuy).toHaveLength(0);
      expect(covered).toHaveLength(1);
      expect(covered[0].name).toBe("Milk");
    });

    it("does not subtract pantry stock when units are incompatible", () => {
      const meals: GroceryMealRequirements[] = [
        {
          servingsScale: 1,
          ingredients: [{ name: "Apples", quantity: 3, unit: "pcs" }],
        },
      ];

      const consolidated = consolidateRequirements(meals);
      const pantryItems: PantryStockItem[] = [
        { name: "Apples", quantity: 500, unit: "g" }, // pcs and g cannot convert
      ];

      const { toBuy, covered } = subtractPantry(consolidated, pantryItems);
      expect(toBuy).toHaveLength(1);
      expect(toBuy[0].quantity).toBe(3);
      expect(covered).toHaveLength(0);
    });
  });

  describe("categorize", () => {
    it("maps ingredient keywords to appropriate PantryCategory", () => {
      expect(categorize("Chicken Breast")).toBe("meat");
      expect(categorize("Basmati Rice")).toBe("grains");
      expect(categorize("Whole Milk")).toBe("dairy");
      expect(categorize("Yellow Onion")).toBe("vegetables");
      expect(categorize("Fresh Strawberry")).toBe("fruits");
      expect(categorize("Black Pepper")).toBe("spices");
      expect(categorize("Ice Cream")).toBe("frozen");
      expect(categorize("Chocolate Cookie")).toBe("snacks");
      expect(categorize("Olive Oil")).toBe("other");
    });
  });
});
