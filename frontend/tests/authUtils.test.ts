import { describe, expect, it } from "vitest";
import { getSafeCallbackUrl } from "../src/lib/auth-utils";

describe("Frontend Unit: getSafeCallbackUrl (Open Redirect Prevention)", () => {
  it("returns fallback for null, undefined, or empty strings", () => {
    expect(getSafeCallbackUrl(null)).toBe("/profile");
    expect(getSafeCallbackUrl(undefined)).toBe("/profile");
    expect(getSafeCallbackUrl("")).toBe("/profile");
    expect(getSafeCallbackUrl("   ")).toBe("/profile");
  });

  it("returns custom fallback when specified", () => {
    expect(getSafeCallbackUrl(null, "/custom")).toBe("/custom");
    expect(getSafeCallbackUrl("", "/custom")).toBe("/custom");
  });

  it("allows safe relative paths starting with single slash", () => {
    expect(getSafeCallbackUrl("/recipes")).toBe("/recipes");
    expect(getSafeCallbackUrl("/recipes/123?tab=comments")).toBe("/recipes/123?tab=comments");
    expect(getSafeCallbackUrl("/profile/preferences")).toBe("/profile/preferences");
  });

  it("blocks external protocol URLs (Open Redirect)", () => {
    expect(getSafeCallbackUrl("https://evil.com")).toBe("/profile");
    expect(getSafeCallbackUrl("http://attacker.org/phishing")).toBe("/profile");
    expect(getSafeCallbackUrl("javascript:alert(1)")).toBe("/profile");
  });

  it("blocks protocol-relative URLs (//evil.com)", () => {
    expect(getSafeCallbackUrl("//evil.com")).toBe("/profile");
    expect(getSafeCallbackUrl("///evil.com")).toBe("/profile");
  });

  it("blocks backslash-escaped URLs (/\\evil.com)", () => {
    expect(getSafeCallbackUrl("/\\evil.com")).toBe("/profile");
  });
});
