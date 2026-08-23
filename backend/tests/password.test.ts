import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/utils/password.js";

describe("password utility (FR-AUTH-07)", () => {
  it("hashes a password and produces a valid salt:hash pair", async () => {
    const hash = await hashPassword("superSecretP@ss123");
    expect(hash).toContain(":");
    const [salt, key] = hash.split(":");
    expect(salt).toHaveLength(32); // 16 bytes in hex = 32 chars
    expect(key).toHaveLength(128); // 64 bytes in hex = 128 chars
  });

  it("generates unique salts for identical passwords", async () => {
    const hash1 = await hashPassword("identicalPassword123");
    const hash2 = await hashPassword("identicalPassword123");
    expect(hash1).not.toBe(hash2);
  });

  it("verifies a correct password successfully", async () => {
    const password = "correctHorseBatteryStaple!";
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correctPassword123");
    const isValid = await verifyPassword("wrongPassword123", hash);
    expect(isValid).toBe(false);
  });

  it("rejects passwords shorter than 8 characters during hashing", async () => {
    await expect(hashPassword("short")).rejects.toThrow(
      "Password must be at least 8 characters long.",
    );
  });

  it("handles malformed hash strings gracefully without throwing", async () => {
    expect(await verifyPassword("password123", "not-a-valid-hash")).toBe(false);
    expect(await verifyPassword("password123", "")).toBe(false);
    expect(await verifyPassword("password123", "invalid:hex")).toBe(false);
  });

  it("handles empty or invalid password inputs during verification", async () => {
    const hash = await hashPassword("validPassword123");
    expect(await verifyPassword("", hash)).toBe(false);
    // @ts-expect-error test invalid type
    expect(await verifyPassword(null, hash)).toBe(false);
  });
});
