import { describe, expect, it } from "vitest";
import { sanitizePlainText } from "../src/utils/sanitize.js";

describe("sanitizePlainText (NFR-SEC-06)", () => {
  it("strips script tags but keeps surrounding text", () => {
    expect(sanitizePlainText("<script>alert(1)</script>Hi")).toBe("alert(1) Hi");
  });

  it("strips arbitrary HTML markup", () => {
    expect(sanitizePlainText("<b>bold</b> and <img src=x onerror=alert(1)>")).toBe("bold and");
  });

  it("collapses to empty for markup-only input", () => {
    expect(sanitizePlainText("<b></b>")).toBe("");
  });

  it("keeps newlines as paragraph breaks (tabs collapse like spaces)", () => {
    const withControlChars = `line one\nline two\ttabbed`;
    expect(sanitizePlainText(withControlChars)).toBe("line one\nline two tabbed");
  });

  it("leaves plain text untouched", () => {
    expect(sanitizePlainText("Great recipe, will make again!")).toBe(
      "Great recipe, will make again!",
    );
  });

  it("trims leading/trailing whitespace", () => {
    expect(sanitizePlainText("   padded text   ")).toBe("padded text");
  });
});
