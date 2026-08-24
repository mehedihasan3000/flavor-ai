import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * Securely hashes a plain-text password using crypto.scrypt with a unique random salt (FR-AUTH-07).
 * Output format: `<salt_hex>:<hash_hex>`
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || typeof password !== "string" || password.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }
  const salt = randomBytes(SALT_LENGTH).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Verifies a plain-text password against a stored `<salt_hex>:<hash_hex>` hash
 * using constant-time comparison (FR-AUTH-07).
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!password || !storedHash || typeof password !== "string" || typeof storedHash !== "string") {
    return false;
  }
  const [salt, keyHex] = storedHash.split(":");
  if (!salt || !keyHex) {
    return false;
  }
  // Validate salt and key are valid hex strings with expected lengths
  const hexRegex = /^[0-9a-fA-F]+$/;
  if (
    salt.length !== SALT_LENGTH * 2 ||
    keyHex.length !== KEY_LENGTH * 2 ||
    !hexRegex.test(salt) ||
    !hexRegex.test(keyHex)
  ) {
    return false;
  }
  try {
    const keyBuffer = Buffer.from(keyHex, "hex");
    const derivedKey = (await scryptAsync(password, salt, keyBuffer.length)) as Buffer;
    if (derivedKey.length !== keyBuffer.length) {
      return false;
    }
    return timingSafeEqual(derivedKey, keyBuffer);
  } catch {
    return false;
  }
}

