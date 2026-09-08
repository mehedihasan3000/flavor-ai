"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { Camera, Picture, TriangleExclamation, Xmark, Sparkles } from "@gravity-ui/icons";
import { Button } from "@/components/ui";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

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

  const processFile = (file: File) => {
    setError(null);

    if (!ALLOWED_TYPES.includes(file.type.toLowerCase())) {
      setError("Please upload a valid image file (JPEG, PNG, WebP, or GIF).");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`File size (${(file.size / (1024 * 1024)).toFixed(1)} MB) exceeds the 5 MB limit.`);
      return;
    }

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

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

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
        disabled={disabled}
        aria-label="Upload food photo"
      />

      {selectedImage ? (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all">
          <div className="relative aspect-video max-h-[360px] w-full overflow-hidden bg-background/50 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage}
              alt="Selected food preview"
              className="h-full w-full object-contain"
            />
            {!disabled && (
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
            {!disabled && (
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
          onClick={() => !disabled && fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
            isDragOver
              ? "border-primary-strong bg-primary-soft/30 scale-[1.01]"
              : "border-border hover:border-primary-strong/60 hover:bg-primary-soft/10 bg-card/40"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary-strong shadow-sm mb-4">
            <Camera className="size-7" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold text-heading">
            Upload or snap a food photo
          </h3>
          <p className="mt-1 text-sm text-subtle-foreground max-w-sm">
            Drag & drop an image here, or browse from your device. Supported: JPG, PNG, WebP (max 5MB).
          </p>
          <div className="mt-4">
            <Button
              variant="outline"
              size="sm"
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              <Picture className="size-4 mr-1.5" aria-hidden="true" />
              Browse Image
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
      {!selectedImage && !disabled && (
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
