import { describe, expect, it } from "vitest";
import { normalizeIngredientKey } from "../src/utils/ingredientKey.js";

describe("normalizeIngredientKey (FEATURES_TASKS.md §1.1, Dev A)", () => {
  it("maps Tomato / tomatoes / Tomato to one key", () => {
    expect(normalizeIngredientKey("Tomato")).toBe("tomato");
    expect(normalizeIngredientKey("tomatoes")).toBe("tomato");
    expect(normalizeIngredientKey("  Tomato  ")).toBe("tomato");
  });

  it("keeps chicken breast and chicken thigh distinct", () => {
    expect(normalizeIngredientKey("chicken breast")).toBe("chicken breast");
    expect(normalizeIngredientKey("chicken thigh")).toBe("chicken thigh");
    expect(normalizeIngredientKey("chicken breast")).not.toBe(
      normalizeIngredientKey("chicken thigh"),
    );
  });

  it("folds multi-word plurals per token but preserves distinctions", () => {
    expect(normalizeIngredientKey("chicken breasts")).toBe("chicken breast");
    expect(normalizeIngredientKey("chicken thighs")).toBe("chicken thigh");
    expect(normalizeIngredientKey("chicken breasts")).not.toBe(
      normalizeIngredientKey("chicken thighs"),
    );
  });

  it("lowercases, strips punctuation, and collapses whitespace", () => {
    expect(normalizeIngredientKey("  Garlic,  MINCED ")).toBe("garlic minced");
    expect(normalizeIngredientKey("Salt & Pepper")).toBe("salt pepper");
    expect(normalizeIngredientKey("chicken-breast")).toBe("chicken breast");
  });

  it("handles common English plural suffixes", () => {
    expect(normalizeIngredientKey("onions")).toBe("onion");
    expect(normalizeIngredientKey("eggs")).toBe("egg");
    expect(normalizeIngredientKey("peas")).toBe("pea");
    expect(normalizeIngredientKey("potatoes")).toBe("potato");
    expect(normalizeIngredientKey("strawberries")).toBe("strawberry");
    expect(normalizeIngredientKey("peaches")).toBe("peach");
    expect(normalizeIngredientKey("dishes")).toBe("dish");
    expect(normalizeIngredientKey("boxes")).toBe("box");
  });

  it("leaves non-plural s-endings and short words alone", () => {
    expect(normalizeIngredientKey("glass")).toBe("glass");
    expect(normalizeIngredientKey("class")).toBe("class");
    expect(normalizeIngredientKey("rice")).toBe("rice");
    expect(normalizeIngredientKey("cheese")).toBe("cheese");
    expect(normalizeIngredientKey("egg")).toBe("egg");
  });

  it("unites -ie singulars with their plural (cookies/cookie)", () => {
    expect(normalizeIngredientKey("cookies")).toBe("cookie");
    expect(normalizeIngredientKey("cookie")).toBe("cookie");
    expect(normalizeIngredientKey("brownies")).toBe("brownie");
    expect(normalizeIngredientKey("veggies")).toBe("veggie");
    expect(normalizeIngredientKey("smoothies")).toBe("smoothie");
    expect(normalizeIngredientKey("calories")).toBe("calorie");
  });

  it("returns empty string for blank input", () => {
    expect(normalizeIngredientKey("   ")).toBe("");
  });

  it("folds diacritics to ASCII so accented spellings share a key", () => {
    expect(normalizeIngredientKey("jalapeño")).toBe("jalapeno");
    expect(normalizeIngredientKey("crème")).toBe("creme");
  });

  it("returns empty string for non-string input instead of throwing", () => {
    expect(normalizeIngredientKey(null as unknown as string)).toBe("");
    expect(normalizeIngredientKey(undefined as unknown as string)).toBe("");
  });
});
