import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { baseLimiter } from "./middleware/rateLimit.js";
import { sanitizeMongoOperators } from "./middleware/sanitizeInput.js";
import { v1Router } from "./routes/v1.js";

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
    }),
  );
  // Photo-nutrition ships base64 image payloads (≈33% inflation), so this
  // route needs a larger body limit than the 1 MB global default. Mounted
  // first — body-parser flags req._body, so the global parser below skips
  // already-parsed requests.
  // NOTE (production/Vercel): Vercel Functions enforce a HARD 4.5 MB
  // request/response body cap at the edge (413 FUNCTION_PAYLOAD_TOO_LARGE,
  // no CORS headers) before Express ever runs — this 15mb limit only governs
  // non-Vercel runtimes (localhost/Docker/Render). The real production guard
  // is client-side: PhotoDropzone compresses everything over ~3 MB binary so
  // JSON stays ≈4 MB. Do not raise client payloads above that.
  app.use("/api/v1/ai/nutrition/analyze-photo", express.json({ limit: "15mb" }));
  app.use(express.json({ limit: "1mb" }));
  app.use(sanitizeMongoOperators);

  if (env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
  }

  app.use(baseLimiter);

  app.use("/api/v1", v1Router);

  app.use((_req, res) => {
    res.status(404).json({
      status: 404,
      code: "NOT_FOUND",
      safeMessage: "Resource not found.",
    });
  });

  app.use(errorHandler);

  return app;
}
