import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export interface ImageUploadInput {
  base64Data: string;
  mimeType: string;
  filename?: string;
}

/**
 * Validates file MIME type, extension, and file size.
 * (NFR-SEC-08)
 */
export function validateImageInput(input: ImageUploadInput): {
  buffer: Buffer;
  cleanMime: string;
} {
  const cleanMime = input.mimeType.toLowerCase().trim();

  if (!ALLOWED_MIME_TYPES.has(cleanMime)) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      `Invalid image type '${cleanMime}'. Allowed types: jpeg, png, webp, gif.`,
    );
  }

  if (input.filename) {
    const ext = input.filename.split(".").pop()?.toLowerCase() ?? "";
    if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        `Invalid file extension '.${ext}'. Allowed extensions: jpg, jpeg, png, webp, gif.`,
      );
    }
  }

  // Strip data URL header prefix if present (e.g. data:image/png;base64,...)
  let pureBase64 = input.base64Data;
  if (pureBase64.includes(";base64,")) {
    pureBase64 = pureBase64.split(";base64,").pop() ?? "";
  }

  const buffer = Buffer.from(pureBase64, "base64");

  if (buffer.length === 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "Image data is empty or invalid base64.");
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      `File size (${sizeMb} MB) exceeds maximum allowed size of 5 MB.`,
    );
  }

  return { buffer, cleanMime };
}

/**
 * Uploads image to ImgBB service.
 * Returns public URL of the uploaded image.
 */
export async function uploadImageToImgBB(input: ImageUploadInput): Promise<{ imageUrl: string }> {
  const apiKey = env.IMGBB_API_KEY;
  if (!apiKey || apiKey === "change-me") {
    throw new ApiError(502, "INTERNAL_ERROR", "ImgBB image storage key is not configured.");
  }

  const { buffer } = validateImageInput(input);
  const base64String = buffer.toString("base64");

  const formData = new URLSearchParams();
  formData.append("key", apiKey);
  formData.append("image", base64String);
  if (input.filename) {
    formData.append("name", input.filename);
  }

  try {
    const res = await fetch(env.IMGBB_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(`[imageService] ImgBB upload failed (${res.status}): ${errorText}`);
      throw new ApiError(
        502,
        "INTERNAL_ERROR",
        "Failed to upload image to external storage service.",
      );
    }

    const data = (await res.json()) as {
      data?: { url?: string; display_url?: string };
    };

    const imageUrl = data.data?.url ?? data.data?.display_url;
    if (!imageUrl) {
      throw new ApiError(
        502,
        "INTERNAL_ERROR",
        "Image service did not return a valid URL.",
      );
    }

    return { imageUrl };
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    console.error("[imageService] Unexpected upload error:", err);
    throw new ApiError(
      502,
      "INTERNAL_ERROR",
      "An error occurred while uploading the image.",
    );
  }
}
