import type { Request, Response } from "express";
import { uploadImageToImgBB } from "../services/imageService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Uploads an image to ImgBB storage and returns the public image URL.
 * POST /api/v1/upload/image (Protected)
 */
export const uploadImage = asyncHandler(async (req: Request, res: Response) => {
  const { image, mimeType, filename } = req.body as {
    image?: string;
    mimeType?: string;
    filename?: string;
  };

  if (!image || typeof image !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", "Image data (base64) is required.");
  }

  // Infer mime type if embedded in data URL (e.g. data:image/png;base64,...)
  let inferredMime = mimeType ?? "image/jpeg";
  if (image.startsWith("data:")) {
    const match = image.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
    if (match) {
      inferredMime = match[1];
    }
  }

  const result = await uploadImageToImgBB({
    base64Data: image,
    mimeType: inferredMime,
    filename,
  });

  res.status(200).json(result);
});
