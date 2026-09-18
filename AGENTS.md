# FlavorAI — Project Rules

Smart recipe generator & food-sharing platform: Next.js 16 App Router frontend + Express 4 REST API. Sources of truth: `FlavorAI - SRS.md`, `IMPLEMENTATION_PLAN.md`, `docs/API_CONTRACT.md` (frozen shapes), `TASKS.md` (living roadmap — MVP released; post-MVP `/assistant`, `/diet`, taste-match, photo-nutrition already landed).

## Layout (two independent packages, no root build)

- `frontend/` — routes `src/app`, UI primitives `src/components/ui` (barrel `index.ts`), typed client `src/lib/{api,types}.ts`, auth `src/lib/auth-context.tsx` + `src/lib/jwt.ts`.
- `backend/` — entry `src/index.ts` → `src/server.ts` (`createApp`) → `src/routes/v1.ts` root router. Handlers `src/controllers`, logic `src/services` (`aiService`, `imageService`), Zod truth `src/types/index.ts`, tests `tests/` (~28 suites).

## Commands (run from package dir)

Backend (`backend/`): `npm run dev` (tsx watch) · `npm run build` (`tsc`, strict) · `npm run lint` (0 warnings, `--max-warnings=0`) · `npm test` (vitest run) · `npx vitest run tests/<file>.test.ts` (single file) · `npm run seed` (demo admin/user/recipes, needs live DB + `.env`) · `npm run db:indexes` (`scripts/syncIndexes.ts` — required before prod deploy, `autoIndex` off in production).
Frontend (`frontend/`): `npm run dev` (:3000) · `npm run build` · `npm run lint` · `npm test` (`vitest run --config vitest.config.mjs`).
Order: `build` → `lint` → `test`. No CI workflows; no `opencode.json`.

## Setup

- `backend/.env` (from `.env.example`) required for `dev`/`build`/`seed`/prod — `env.ts` exits(1) on invalid env. **Exception:** `npm test` works without `.env` (test fallback `MONGODB_URI`/`JWT_SECRET` when `NODE_ENV=test` or `VITEST=true`).
- Node `>=20`. NodeNext ESM: relative imports **need `.js` extension** (`./config/env.js`) or build breaks.
- Ports: API `:4000` (`/api/v1`, health `GET /api/v1/health`), app `:3000`. `NEXT_PUBLIC_API_URL` (default `http://localhost:4000/api/v1`) via `frontend/.env.local`. `JWT_SECRET` (≥16 chars) **must match** backend↔frontend or the auth bridge 401s.

## API contract (FROZEN — needs Lead sign-off to change)

- Triple-sync: `backend/src/types/index.ts` (executable truth) ↔ `docs/API_CONTRACT.md` ↔ `frontend/src/lib/types.ts`.
- Error envelope on all non-2xx: `{ status, code, safeMessage, validation? }`. Codes: `VALIDATION_ERROR|UNAUTHORIZED|FORBIDDEN|NOT_FOUND|CONFLICT|AI_PROVIDER_ERROR|RATE_LIMITED|INTERNAL_ERROR`. `ZodError`→400, `ApiError`→its status, E11000→409.
- Publish flow is **POST** `/recipes/:id/publish` and **POST** `/:id/unpublish` (not PATCH). Beyond frozen M1–M5 routes, these additive endpoints exist: `POST /ai/recipes/taste-match`, `POST /ai/nutrition/analyze-photo` (15 MB JSON body — see below), `GET /users/me/stats`, `GET /recipes?mine=true&status=`, `GET /favorites/:recipeId`, `GET /recipes/:id/ratings` (adds `myRating` when authed), comment `authorName`/`authorAvatarUrl` fields, `POST /assistant/{chat|recommendations|pantry-suggestions|macro-adjustments}`, `POST /diet/plan` (pure calc, nothing stored).

## Backend gotchas

- `Recipe.totalTimeMinutes` computes only in `pre("save")` — recompute manually on updates (`recipeController` line ~182 pattern). Rating/favorite/comment mutations must call their `recompute*` fns (`recomputeRatingAggregates`, `recomputeFavoriteCount`, `recomputeCommentCount` — also reused by admin moderation).
- `Model.aggregate()` **bypasses Mongoose auto-casting**: cast ids explicitly (`new Types.ObjectId(recipeId)`) in `$match`, unlike `find`/`countDocuments`.
- `authenticate()` looks users up by **`providerId`** (external auth subject), not `_id` — test helpers must set `providerId` and sign `sub` as that value, else authed requests silently 401.
- Middleware order in `server.ts` matters: photo route's `express.json({limit:"15mb"})` mounts **before** the global `1mb` parser; `sanitizeMongoOperators` (strips `$`/dotted keys, NoSQL defense) runs after parsing, before routes. Comment bodies additionally stripped of HTML via `utils/sanitize.ts` before length check.
- Rate limits (all envelope `429 RATE_LIMITED`): base 300/15min app-wide; `authLimiter` 50/15min; `aiRateLimiter` + `uploadRateLimiter` 10/15min; `commentLimiter` 20/10min on comment POST/PATCH/DELETE only (runs before auth). GET reads use base limiter.
- Admin `PATCH /admin/recipes/:id` accepts only `published|hidden` (draft lifecycle stays owner-side). `GET /favorites` filters to published in-pipeline via `$lookup` (rows kept, reappear on republish). DELETE favorite is intentionally ungated by recipe status.

## Frontend gotchas (each broke a real build)

- React Compiler + `react-hooks` v7: **no setState synchronously reachable from effect bodies** (even via helpers). Fetch-on-mount sets state only inside `.then/.catch` callbacks.
- RSC boundary: don't export plain functions/styles from `"use client"` files for server components — server-safe helpers live in own modules (e.g. `ui/button-styles.ts`).
- `next.config.ts` pins `turbopack.root` — do not remove (else stray nested `frontend/frontend/.next` junk; safe to delete when no node process holds it; eslint ignores `**/.next/**`).
- `PATCH /users/me` must send the **FULL** `DietaryPreferences` object — omitted arrays reset to `[]`.
- `lib/api.ts` auto-attaches `localStorage["flavorai_auth_token"]` as Bearer; pass `token: null` to force a guest request. `ApiError.message` is the envelope's safe text — never surface raw/provider errors. `cache: "no-store"` on all requests.
- Gravity icons have non-obvious names (`Xmark`, `Person`, `House`, `TriangleExclamation` — no `X`/`User`/`Home`). Check exports before importing. Icons never carry meaning alone; small text on solid orange/green fills uses `-strong`/`-deep` tokens for AA contrast.

## Domain / auth / AI rules (enforce in backend, never UI-only)

Owner-or-admin edits/unpublishes/deletes recipes; drafts owner+admin only; public discovery = published non-hidden only. Ratings int 1–5, one per user (re-rate updates), owner can't rate own. Favorites unique per user. Allergen/dietary compliance never guaranteed — warnings mandatory (AI + nutrition + recipe views). Never leak private profiles/drafts/favorites/tokens. Moderated content stays unsearchable.
Auth: Better Auth client session → server-minted HS256 Bearer JWT (`iss`/`aud`/15m expiry per contract); `middleware/auth.ts` verifies → `req.user`; secrets never in browser JS.
AI: Groq models via env (`GROQ_MODEL`, `GROQ_MODEL_FOR_IMAGE`); **Zod-validate ALL AI output server-side, never store invalid**; discard hallucinated `recipeId`s outside the candidate pool (taste-match/assistant); provider failure/timeout (default 60s) → safe retryable 502/504, never leak internals.

## Workflow

- Do not commit unless explicitly asked. Commit style: conventional + workstream scope (`feat(m5): …`, `chore(backend): …`); branches `feature/<name>` off `develop`.
- Tick `TASKS.md` only when done per Definition of Done; append dated `[YYYY-MM-DD] [M#]` note. Keep the contract triple in sync on any approved change.
- After saving any opencode config change, remind the user to restart opencode.
