import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  uploadImageToImgBB,
  validateImageInput,
  type ImageUploadInput,
} from "../src/services/imageService.js";
import { ApiError } from "../src/utils/ApiError.js";

describe("imageService — Image Validation & Upload (NFR-SEC-08)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("validates valid base64 image data and MIME types", () => {
    const validBase64 = Buffer.from("fake-image-content").toString("base64");
    const input: ImageUploadInput = {
      base64Data: validBase64,
      mimeType: "image/png",
      filename: "test.png",
    };

    const { buffer, cleanMime } = validateImageInput(input);
    expect(cleanMime).toBe("image/png");
    expect(buffer.toString()).toBe("fake-image-content");
  });

  it("rejects unsupported MIME types with 400 VALIDATION_ERROR", () => {
    const input: ImageUploadInput = {
      base64Data: "dGVzdA==",
      mimeType: "application/pdf",
    };

    expect(() => validateImageInput(input)).toThrowError(ApiError);
    try {
      validateImageInput(input);
    } catch (err: unknown) {
      expect((err as ApiError).status).toBe(400);
      expect((err as ApiError).code).toBe("VALIDATION_ERROR");
      expect((err as ApiError).message).toContain("Allowed types");
    }
  });

  it("rejects unsupported file extensions with 400 VALIDATION_ERROR", () => {
    const input: ImageUploadInput = {
      base64Data: "dGVzdA==",
      mimeType: "image/jpeg",
      filename: "malicious.exe",
    };

    expect(() => validateImageInput(input)).toThrowError(ApiError);
    try {
      validateImageInput(input);
    } catch (err: unknown) {
      expect((err as ApiError).status).toBe(400);
      expect((err as ApiError).code).toBe("VALIDATION_ERROR");
      expect((err as ApiError).message).toContain("Allowed extensions");
    }
  });

  it("rejects file sizes exceeding 5 MB with 400 VALIDATION_ERROR", () => {
    // 5.1 MB buffer
    const largeBuffer = Buffer.alloc(5.1 * 1024 * 1024);
    const input: ImageUploadInput = {
      base64Data: largeBuffer.toString("base64"),
      mimeType: "image/jpeg",
    };

    expect(() => validateImageInput(input)).toThrowError(ApiError);
    try {
      validateImageInput(input);
    } catch (err: unknown) {
      expect((err as ApiError).status).toBe(400);
      expect((err as ApiError).code).toBe("VALIDATION_ERROR");
      expect((err as ApiError).message).toContain("exceeds maximum allowed size of 5 MB");
    }
  });

  it("successfully uploads image to ImgBB and returns URL", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          url: "https://i.ibb.co/abcdef/test.jpg",
        },
      }),
    } as Response);

    const input: ImageUploadInput = {
      base64Data: Buffer.from("sample").toString("base64"),
      mimeType: "image/jpeg",
      filename: "test.jpg",
    };

    const result = await uploadImageToImgBB(input);

    expect(result.imageUrl).toBe("https://i.ibb.co/abcdef/test.jpg");
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
