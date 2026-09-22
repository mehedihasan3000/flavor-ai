"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Camera, Picture, TriangleExclamation, Xmark, Sparkles } from "@gravity-ui/icons";
import { Button } from "@/components/ui";

/** Largest original file the picker accepts. */
export const MAX_ORIGINAL_BYTES = 15 * 1024 * 1024; // 15 MB
/**
 * Binary ceiling for what is sent to the API as-is.
 *
 * Production runs on Vercel Functions, whose request/response body limit is a
 * hard 4.5 MB (413 FUNCTION_PAYLOAD_TOO_LARGE at the edge, before Express/CORS
 * ever run). Base64 inflates binary by ~33%, so a 5 MB photo becomes ~6.8 MB
 * of JSON and a 7 MB photo ~9.5 MB — both rejected in production while working
 * on localhost (Express `15mb`). Anything above this ceiling is
 * downscaled/JPEG-compressed in-browser to fit. Small photos (1–2 MB) are
 * untouched to preserve full analysis quality.
 */
export const VERCEL_SAFE_BINARY_LIMIT_BYTES = 2_800_000; // 2.8 MB binary ≈ 3.8 MB JSON, leaving ~400 KB headroom for filename/context/notes under the 4.2 MB preflight ceiling
/** Hard JSON-payload ceiling checked before send (margin under Vercel 4.5 MB). */
export const VERCEL_SAFE_JSON_LIMIT_BYTES = 4_200_000;
const TARGET_COMPRESSED_BYTES = 2_800_000; // 2.8 MB binary ≈ 3.8 MB JSON
const MAX_COMPRESSED_DIMENSION = 1600;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Estimated JSON request size for a binary image (base64 + data-URL + envelope). */
export function estimateJsonPayloadBytes(binaryBytes: number): number {
  return Math.ceil(binaryBytes / 3) * 4 + 64 + 512;
}

/** True when a file must be client-compressed to survive the Vercel 4.5 MB cap. */
export function needsCompressionForVercel(fileSizeBytes: number): boolean {
  return (
    fileSizeBytes > VERCEL_SAFE_BINARY_LIMIT_BYTES ||
    estimateJsonPayloadBytes(fileSizeBytes) > VERCEL_SAFE_JSON_LIMIT_BYTES
  );
}

function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not decode the image file. Please try a different photo."));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read the image file. Please try again."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Downscales + JPEG-compresses a photo until it fits the Vercel-safe
 * transport budget (≈2.8 MB binary ≈ 3.8 MB JSON, under the 4.5 MB platform
 * cap). 1600px on the long edge at JPEG q0.7–0.85 preserves food-vision
 * quality (providers downsample internally anyway). Animated GIFs are reduced
 * to their first frame — analysis only needs one frame. Returns a data URL +
 * mime type. Throws with a user-facing message when compression is
 * unsupported or cannot fit.
 */
export async function compressImageFile(
  file: File,
  targetBytes: number = TARGET_COMPRESSED_BYTES,
): Promise<{ dataUrl: string; mimeType: string }> {
  const img = await loadImageElement(file);
  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;
  if (!naturalWidth || !naturalHeight) {
    throw new Error("Could not decode the image file. Please try a different photo.");
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Image compression isn't supported in this browser. Please use a photo under 3 MB.");
  }

  const drawScaled = (scale: number) => {
    const fit = Math.min(1, MAX_COMPRESSED_DIMENSION / Math.max(naturalWidth, naturalHeight));
    const finalScale = Math.min(1, fit * scale);
    canvas.width = Math.max(1, Math.round(naturalWidth * finalScale));
    canvas.height = Math.max(1, Math.round(naturalHeight * finalScale));
    // JPEG has no alpha — paint white so transparent PNG/WebP don't go black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };

  // Pass 1: capped dimensions across JPEG qualities.
  drawScaled(1);
  for (const quality of [0.85, 0.78, 0.7, 0.62, 0.55]) {
    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    if (blob && blob.size <= targetBytes) {
      return { dataUrl: await blobToDataUrl(blob), mimeType: "image/jpeg" };
    }
  }

  // Pass 2: shrink dimensions progressively, mid quality.
  let scale = 0.8;
  for (let attempt = 0; attempt < 5; attempt++) {
    drawScaled(scale);
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.7);
    if (blob && blob.size <= targetBytes) {
      return { dataUrl: await blobToDataUrl(blob), mimeType: "image/jpeg" };
    }
    scale *= 0.8;
  }

  throw new Error(
    "Even after compression this photo exceeds the upload budget. Please use a smaller image or crop it first.",
  );
}

export interface SampleFoodOption {
  id: string;
  name: string;
  url: string;
  context: string;
}

export const SAMPLE_FOOD_OPTIONS: SampleFoodOption[] = [
  {
    id: "salmon-plate",
    name: "Grilled Salmon & Quinoa",
    url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80",
    context: "Grilled Atlantic salmon with seasoned quinoa and steamed greens",
  },
  {
    id: "chicken-bowl",
    name: "Mediterranean Chicken Salad",
    url: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&auto=format&fit=crop&q=80",
    context: "Grilled chicken breast, cherry tomatoes, cucumbers, and olive oil",
  },
  {
    id: "avocado-egg",
    name: "Avocado Toast with Poached Egg",
    url: "https://images.unsplash.com/photo-1525351484163-7529414344d8?w=800&auto=format&fit=crop&q=80",
    context: "Sourdough toast, mashed avocado, poached egg, and red pepper flakes",
  },
];

export interface PhotoDropzoneProps {
  selectedImage: string | null;
  onImageSelected: (imageData: string, mimeType: string, filename?: string, sampleContext?: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

export function PhotoDropzone({
  selectedImage,
  onImageSelected,
  onClear,
  disabled = false,
}: PhotoDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const busy = disabled || isCompressing;

  const readDirect = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      onImageSelected(result, file.type, file.name);
    };
    reader.onerror = () => {
      setError("Failed to read the image file. Please try again.");
    };
    reader.readAsDataURL(file);
  };

  const processFile = (file: File) => {
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      setError("Please upload a valid image file (JPEG, PNG, WebP, or GIF).");
      return;
    }

    if (file.size > MAX_ORIGINAL_BYTES) {
      setError(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 15 MB limit. Please use a smaller photo.`,
      );
      return;
    }

    // Small enough to survive the Vercel 4.5 MB platform cap as-is.
    if (!needsCompressionForVercel(file.size)) {
      readDirect(file);
      return;
    }

    // Larger photos (e.g. 5–7 MB raw → ~7–9.5 MB JSON) would be rejected by
    // Vercel with 413 before reaching the API — compress in-browser first.
    // This is the same path that already made >10 MB uploads work.
    setIsCompressing(true);
    compressImageFile(file)
      .then(({ dataUrl, mimeType }) => {
        const compressedName = file.name.replace(/\.[^.]+$/, "") || "photo";
        onImageSelected(dataUrl, mimeType, `${compressedName}-compressed.jpg`);
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error
            ? err.message
            : "Could not compress this photo. Please use a smaller image.",
        );
      })
      .finally(() => {
        setIsCompressing(false);
      });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!busy) setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (busy) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleSelectSample = (sample: SampleFoodOption) => {
    setError(null);
    onImageSelected(sample.url, "image/jpeg", `${sample.id}.jpg`, sample.context);
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileChange}
        className="hidden"
        disabled={busy}
        aria-label="Upload food photo"
      />

      {isCompressing && (
        <div
          className="flex items-center gap-2 rounded-xl border border-primary-strong/30 bg-primary-soft/20 p-3 text-xs font-medium text-primary-strong"
          role="status"
        >
          <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-primary-strong/30 border-t-primary-strong" />
          <span>Optimizing photo for upload… (keeps quality, fits secure limits)</span>
        </div>
      )}

      {selectedImage ? (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all">
          <div className="relative aspect-video max-h-[360px] w-full overflow-hidden bg-background/50 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage}
              alt="Selected food preview"
              className="h-full w-full object-contain"
            />
            {!busy && (
              <button
                type="button"
                onClick={onClear}
                aria-label="Remove selected photo"
                className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full bg-card/90 text-heading backdrop-blur-md transition-all hover:bg-danger hover:text-white shadow-md"
              >
                <Xmark className="size-5" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3 bg-card/60">
            <span className="text-xs font-medium text-subtle-foreground flex items-center gap-1.5">
              <Picture className="size-4 text-primary-strong" aria-hidden="true" />
              Photo loaded for nutritional analysis
            </span>
            {!busy && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                Change photo
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !busy && fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
            isDragOver
              ? "border-primary-strong bg-primary-soft/30 scale-[1.01]"
              : "border-border hover:border-primary-strong/60 hover:bg-primary-soft/10 bg-card/40"
          } ${busy ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary-strong shadow-sm mb-4">
            <Camera className="size-7" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold text-heading">
            Upload or snap a food photo
          </h3>
          <p className="mt-1 text-sm text-subtle-foreground max-w-sm">
            Drag & drop an image here, or browse from your device. Supported: JPG, PNG, WebP, GIF
            (max 15 MB — larger photos are auto-optimized; GIFs analyze as a still frame).
          </p>
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Picture className="size-4 mr-1.5" aria-hidden="true" />
              {isCompressing ? "Compressing…" : "Browse Image"}
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-danger-bg p-3 text-xs font-medium text-danger-strong border border-danger/30">
          <TriangleExclamation className="size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Preset demo options */}
      {!selectedImage && !busy && (
        <div className="rounded-xl border border-border/80 bg-card/60 p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-subtle-foreground mb-3">
            <Sparkles className="size-3.5 text-primary-strong" aria-hidden="true" />
            <span>Or try with a sample dish</span>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {SAMPLE_FOOD_OPTIONS.map((sample) => (
              <button
                key={sample.id}
                type="button"
                onClick={() => handleSelectSample(sample)}
                className="group flex items-center gap-3 rounded-xl border border-border bg-background/80 p-2.5 text-left transition-all hover:border-primary-strong hover:bg-primary-soft/20"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sample.url}
                  alt={sample.name}
                  className="size-11 rounded-lg object-cover border border-border/60 shrink-0 group-hover:scale-105 transition-transform"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-heading group-hover:text-primary-strong">
                    {sample.name}
                  </p>
                  <p className="truncate text-[11px] text-subtle-foreground">
                    1-click demo
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
