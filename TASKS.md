# FlavorAI — Master Task Roadmap (Team Edition)

> **Living roadmap.** OpenCode updates this file as work progresses. Tick
> checkboxes only when the task is actually done per the Definition of Done
> (client+server validation, API-enforced authorization, tests pass, states
> handled, works on desktop + mobile, no critical/high defects).

**Source of truth:** `FlavorAI - SRS.md` (requirements) and `IMPLEMENTATION_PLAN.md` (architecture).
**Team:** 5 members (Team Leader coordinates integration). Each member drives their
workstream in parallel using opencode. Workstreams depend on **Phase A (contract freeze)** only.

---

## Team Roster & Workstreams

| # | Role | Workstream | Depends on |
|---|------|------------|-----------|
| **Lead** | Team Leader | Integration, review, release gate | All |
| **M1** | Contracts & Backend Foundation | Shared types, Zod schemas, server, DB models, API contract | — (starts first) |
| **M2** | Auth & Users Engineer | Auth bridge, JWT middleware, profile/preferences | M1 contract |
| **M3** | Recipes & AI Engineer | Recipe CRUD, AI generation, pantry, flavor, images | M1 contract |
| **M4** | Community & Admin Engineer | Ratings, comments, favorites, admin moderation, security | M1 contract |
| **M5** | Frontend Lead | Next.js scaffold, components, all pages, Better Auth client | M1 contract |

**Working agreement:** M1 freezes the API contract (shapes of every DTO, Zod schema,
endpoint, error format, pagination) before M2–M5 write feature code. M2–M5 code against
the frozen contract and keep changes on their own branches. Team Leader merges and runs
integration gates (Section 6).

---

## Phase A — Contract Freeze (Blocking; M1 + Team Lead)

### A1. Shared Types & Validation (`backend/src/types/index.ts`)
- [x] User preferences (`DietaryPreferences`, `Allergies`, `NutritionalGoals`)
- [x] AI generation input (`AIRecipePromptInput`, `IngredientInput`)
- [x] AI recipe output schema (`AIRecipeOutputSchema`) — the strict JSON contract for Groq
- [x] Rating, Comment, Favorite DTOs
- [x] Pantry match types (`usedIngredients` / `missingIngredients`)
- [x] Pagination + error envelope types (`{ status, code, safeMessage, validation? }`)

### A2. API Contract Document
- [x] Publish endpoint spec (request/response shapes for every endpoint group) into `docs/API_CONTRACT.md`
- [x] Enumerate: `/auth`, `/users(/me)`, `/recipes`, `/ai/recipes/generate`, `/ai/flavor-pairings`,
      `/recipes/:id/ratings`, `/recipes/:id/comments`, `/favorites`, `/admin`
- [x] Define pagination (`page`/`limit`), sorting keys, filter params (`q`, `category`, `cuisine`, `diet`)
- [x] Team Lead approves → **contract frozen** (no shape changes without lead sign-off)

### A3. Monorepo & Tooling
- [x] Scaffold `frontend/` and `backend/` folders (no shared workspace build)
- [x] Backend: package.json, TypeScript strict, tsx/nodemon, lint + format
- [x] Frontend: create-next-app (App Router, TS, Tailwind, Gravity UI Icons, Better Auth)
- [x] `.env.example` + Zod env validation (never commit secrets)
- [ ] Confirm auth bridge contract: issuer, audience, signing/verification, cookie policy, expiration, refresh, logout (SRS §9.4)

---

## Workstream M1 — Contracts & Backend Foundation

> **Goal:** The API runs, connects to MongoDB, and exposes the base app + all data models.

- [x] `backend/src/server.ts` — Express app, CORS, `/api/v1`, centralized error handler, structured logs
- [x] `backend/src/config/db.ts` — Mongoose connection, auto-indexes, reconnect retry
- [x] Rate limiting scaffold (`express-rate-limit`) wired app-wide
- [x] `User.ts` model — profile, dietary prefs, allergies, nutrition goals, role, provider identifiers, timestamps
- [x] `Recipe.ts` model — owner ref, source, title/slug/summary/image, ingredients w/ pantry-match, ordered steps, times, servings, difficulty, cuisine/category/tags, dietary labels, allergen warnings, nutrition estimate, status, aggregate counts
- [x] `Rating.ts` — unique compound index `(recipeId, userId)`
- [x] `Comment.ts` — moderation status
- [x] `Favorite.ts` — unique compound index `(recipeId, userId)`
- [x] `AIGenerationLog.ts` — inputs, provider/model, status, latency, error category
- [x] Indexes: unique email/provider identity, unique slug, text index, status+published, owner+created, comment recipe+created
- [x] Health check endpoint + smoke test against MongoDB

---

## Workstream M2 — Auth & Users

> **Goal:** Better Auth client flow ↔ Express JWT bridge works end-to-end; profile/preferences editable.

### Backend
- [x] `middleware/auth.ts` — Bearer JWT verification, attach `req.user`, reject expired/malformed/unauthorized (FR-AUTH-04/05)
- [x] Role + ownership guards (owner-or-admin for edit/unpublish/delete; FR-RECIPE-06)
- [x] `authController.ts` — Better Auth integration + token verification
- [x] `userController.ts` — `/users/me` view/update profile + preferences (FR-AUTH-06)
- [x] Password hashing if used; never return in plain text (FR-AUTH-07)
- [x] Rate limiting on auth endpoints (NFR-SEC-07)

### Frontend (auth pages)
- [x] `(auth)/sign-in/page.tsx`, `(auth)/sign-up/page.tsx` via Better Auth
- [x] Protect authenticated pages/actions client-side (FR-AUTH-03)
- [x] Sign-in/sign-out flow verified against M1 API + JWT middleware


---

## Workstream M3 — Recipes & AI

> **Goal:** Manual recipe CRUD + AI generation (Groq) produce schema-valid recipes that save as draft or publish.

### Backend
- [x] `recipeController.ts` — CRUD, draft/publish/unpublish/delete, ownership enforced (FR-RECIPE-01..06)
- [x] Paginated search + filters: `q`, `category`, `cuisine`, `diet`, `sort`, `page`, `limit` (FR-SEARCH-01..05)
- [x] `aiService.ts` — Groq adapter (`openai/gpt-oss-120b` / `qwen/qwen3.6-27b`)
- [x] Constrained prompt builder enforcing strict JSON schema output
- [x] Server-side Zod validation on ALL AI output; invalid/incomplete NOT stored (FR-AI-07)
- [x] Timeout (≤30s) + safe retryable error on provider failure (FR-AI-08, NFR-PERF-03)
- [x] Pantry matching: `usedIngredients` vs `missingIngredients` (FR-PANTRY-01..03)
- [x] Flavor-pairing suggestions respecting dietary/allergy constraints (FR-FLAVOR-01..03)
- [x] Nutrition estimate per serving; missing → unavailable, never fabricated (FR-NUTR-01..04)
- [x] `imageService.ts` — ImgBB upload; MIME/extension/size validation (NFR-SEC-08)
- [x] `aiController.ts` — `/ai/recipes/generate`, `/ai/flavor-pairings`
- [x] Rate limiting on AI + upload endpoints (NFR-SEC-07)

### Frontend
- [ ] `generator/page.tsx` — ingredient tags, dietary checkboxes, time/difficulty, progress, regenerate
- [ ] `recipes/create/page.tsx`, `recipes/[id]/edit/page.tsx` — manual recipe editor
- [ ] `recipes/[id]/page.tsx` — detail: ingredients, steps, nutrition badge, allergy disclaimer
- [ ] Components: `IngredientTagInput`, `NutritionBadge`, `DisclaimerBanner`

---

## Workstream M4 — Community & Admin

> **Goal:** Ratings, comments, favorites, and admin moderation behave per business rules with security hardening.

### Backend
- [x] `ratingController.ts` — create/update/remove; integer 1–5; one per user per recipe; owner can't rate own (FR-RATE-01..05)
- [x] Aggregate rating recalculation after changes
- [x] `commentController.ts` — add/list/delete; length validation + sanitization; owner deletion (FR-COMMENT-01..05)
- [x] `favoriteController.ts` — add/list/remove; uniqueness enforced; private list (FR-FAV-01..04)
- [x] `adminController.ts` — role-protected moderation of recipes/comments, actions logged (FR-ADMIN-01..04)
- [x] Draft/hidden recipes excluded from public discovery (Business Rules 3/4/10)
- [x] Sanitize content before render; XSS/injection/IDOR/CSRF mitigations (NFR-SEC-05/06)
- [x] Rate limiting on comment endpoints (NFR-SEC-07)

### Frontend
- [ ] `recipes/page.tsx` — search, filters, sort, pagination
- [ ] Components: `RecipeCard`, `RatingStars`, `CommentSection`
- [ ] `favorites/page.tsx` — favorites collection
- [ ] `admin/page.tsx` — moderation dashboard (basic MVP acceptable)
- [ ] `dashboard/page.tsx` — own drafts/published, stats

---

## Workstream M5 — Frontend Lead

> **Goal:** Full UI shell + remaining pages; responsive, accessible, with all states.

- [x] Global layout, theme (glassmorphism), `Navbar.tsx`, `Footer.tsx`
- [x] `page.tsx` — landing: pantry-to-plate USP, featured recipes, CTAs
- [x] `profile/page.tsx` — profile + food preferences (consumes M2 API)
- [x] Forms: labels, validation messages, keyboard access, focus states, loading/disabled (NFR-UX-02)
- [x] Empty / loading / success / error states everywhere (NFR-UX-05)
- [x] Responsive on ≥320px mobile, tablet, desktop; WCAG 2.1 AA contrast + semantics
- [x] Icons never sole meaning carrier (NFR-UX-04)
- [ ] AI-generated content labeled; allergy warnings in generation AND recipe views (§12.7)

---

## Section 6 — Integration & Testing (Team Lead + all members)

### 6.1 Integration Gates
- [ ] Merge M2 (auth) → verify JWT bridge against M1 API
- [ ] Merge M3 (recipes/AI) → verify generation → save → publish flow
- [ ] Merge M4 (community) → verify search → rate → comment → favorite
- [ ] Merge M5 (frontend) → verify full UI against live API on all routes
- [ ] Cross-user authorization: 403 on editing/deleting another user's content
- [ ] Re-rate as same user → updates, no duplicate; duplicate favorites prevented

### 6.2 Automated Tests
- [ ] Backend unit: Zod schemas, pantry matching, AI response parser
- [ ] API integration: auth, recipe CRUD, ratings, comments, favorites, AI error handling, JWT guards
- [ ] Frontend component/form: generator form, validation errors, auth states
- [ ] E2E: sign-in → generate → save/publish → search → rate → comment → favorite

### 6.3 Manual Acceptance
- [ ] Full generation & publishing flow (gluten-free + high-protein example from IMPLEMENTATION_PLAN)
- [ ] Discovery & community flow (browse → filter → search → 5★ → comment → favorite)
- [ ] Draft/hidden recipes absent from public search
- [ ] Nutrition + allergy disclaimers shown where required

---

## Section 7 — Deployment & Release (Team Lead)

- [ ] Production env vars, HTTPS, MongoDB indexes, logging, rate limits configured
- [ ] Groq + ImgBB + MongoDB Atlas verified in production
- [ ] Seed data for demo
- [ ] Docs: setup, env vars, API overview, known limitations, AI/nutrition disclaimers
- [ ] Responsive + accessibility checks on Chrome/Edge/Firefox/Safari
- [ ] No critical/high defects open → **MVP release**

---

## Post-MVP (Deferred — not MVP scope)

- [ ] Taste-profile recommendations (FR-TASTE-01..03)
- [ ] Food-photo nutrition analysis (FR-PHOTO-01..04)
- [ ] Meal planning, grocery lists, follows, notifications, social feeds
- [ ] Verified nutrition datasets, multilingual support, native mobile apps

---

## Notes / Progress

> Log updates here as phases complete. Format: `[date] [Member/Lead] What was done, decisions, blockers.`

- `[2026-08-16] [Lead]` Roadmap restructured for 5-member parallel team. Contract freeze (Phase A) is the entry gate; M2–M5 code in parallel against the frozen contract on separate branches.
- `[2026-08-16] [Lead]` **M1 foundation implemented on `feature/m1-foundation`:** backend scaffold (Express, TS strict, vitest, ESLint/Prettier), shared Zod contract in `backend/src/types/index.ts`, Zod env validation, all 6 Mongoose models + indexes, server/error-handler/rate-limit/health endpoint, `docs/API_CONTRACT.md`, frontend scaffolded via create-next-app. Build + lint + 12 unit tests pass. Smoke test against MongoDB pending Atlas URI.
- `[2026-08-16] [Lead]` Next: paste Atlas URI into `backend/.env` → run live smoke test, then sign off contract freeze.
- `[2026-08-16] [Lead]` **Live smoke test PASSED** against MongoDB Atlas — `/api/v1/health` → 200, DB connected, server boots. **Contract is now FROZEN.** M2–M5 may start in parallel: each opens opencode in `flavor-ai/` on their own branch off `develop` and prompts per AGENTS.md. Merge order: M2 → M3/M4 → M5.
- `[2026-08-16] [Lead]` **Phase A hardening:** Mongoose E11000 duplicate-key now maps to 409 `CONFLICT` (errorHandler, +2 tests). `config/env.ts` gets a test-mode fallback so a fresh clone without `.env` no longer hard-crashes `npm test`. Build ✓, lint ✓, 14/14 tests ✓.
- `[2026-08-23] [M5]` **M5 Steps 0–2 of 7 done on `feature/m5-frontend`:** design-system foundation in `globals.css` (Tailwind v4 `@theme` tokens — warm off-white/orange/green/charcoal palette per product brief, focus-visible rings, radius tokens, reduced-motion support; auto dark scheme dropped intentionally), root layout shell (FlavorAI metadata + title template, skip-to-content link, semantic landmarks), glass-effect `Navbar.tsx` (responsive mobile menu: Escape close, `aria-expanded`, active-route pills), `Footer.tsx` with site-wide AI/nutrition/allergy disclaimer (§12.7). Installed `@gravity-ui/icons`. Decisions: "glassmorphism" implemented as subtle blur on navbar only (brief asks for clean/minimal elsewhere); added `primary-deep` token so solid-button hovers keep white text ≥4.5:1 AA. Frontend build ✓ lint ✓ 0 warnings. Nav links intentionally target canonical routes (`/generator`, `/recipes`, `/favorites`, `/profile`, `/sign-in`) that 404 until dependent pages land (Steps 4–6 / M2–M4). Known blocker flagged to Lead: stray untracked root `package.json`/lockfile makes Next.js warn about workspace-root inference.
- `[2026-08-23] [M5]` **M5 Step 3 of 7 done (UI primitives):** added `frontend/src/components/ui/*` — `Button` (+ exported `buttonStyles` for link-styled CTAs; loading/disabled with `aria-busy`), `Spinner`, field system (`field.tsx` label/hint/error helpers + `Input`/`Textarea`/`Select`/`Checkbox`) with `useId`-wired `htmlFor`/`aria-describedby`/`aria-invalid`, `role="alert"` validation messages, required-marker with sr-only "(required)", visible text alongside every icon (NFR-UX-04); display set: `Card`, `Badge`, `Alert` (info/success/warning/danger, `role="status"` vs `"alert"`), `DisclaimerBanner` presets (`ai`/`nutrition`/`allergy` — §12.7 copy), `EmptyState`, `ErrorState`, `LoadingState` (`role="status"`), `Skeleton`. Barrel `ui/index.ts`. Added tokens: `secondary-deep #166534` (green hover AA) + `danger-strong #B91C1C` (danger text on tinted bg ≥4.5:1). Build ✓ lint ✓ 0 warnings. Forms/states/responsive M5 boxes remain unticked until proven in real pages (Step 6+); next: Step 4 landing page.
- `[2026-08-23] [M5]` **M5 Step 4 of 7 done (landing page):** rewrote `frontend/src/app/page.tsx` — hero (USP headline, pantry-chip → recipe illustration card marked `aria-hidden`, dual CTAs), "From pantry to plate in three steps" `<ol>` with numbered circles (text, no icon-only meaning), "From the community" featured section currently rendering the intentional `EmptyState` until Step 5 API client + M3 backend exist, and a deep-orange CTA band (white text ≥4.5:1 AA). Refactor forced by RSC boundary: `buttonStyles` moved out of `"use client"` `button.tsx` into server-safe `ui/button-styles.ts` so server pages can compose Link-as-button; barrel updated. Build ✓ lint ✓, `/` prerenders statically. Next: Step 5 typed API client (`lib/api.ts` + contract DTO types).
- `[2026-08-23] [M5]` **M5 Step 5 of 7 done (typed API client):** added `frontend/src/lib/types.ts` mirroring every frozen DTO/enum from `backend/src/types/index.ts` + `docs/API_CONTRACT.md` (enums as unions, DietaryPreferences, AI in/out, Recipe + search query, Rating/Comment, UserProfile/UpdateProfileInput, PaginatedResult, ErrorEnvelope) — MUST stay in sync with backend contract; and `frontend/src/lib/api.ts`: fetch wrapper on `NEXT_PUBLIC_API_URL` (default `http://localhost:4000/api/v1`, trailing-slash-safe), client-side `ApiError` carrying `{status, code, safeMessage, validation}` parsed from the error envelope with safe fallback messages per status (never leaks internals), network failures → retryable message, AbortError rethrown untouched, `cache: "no-store"` everywhere, optional per-call Bearer token arg for M2 to plug Better Auth session. Endpoints so far: `getMyProfile`, `updateMyProfile`, `listRecipes(query)` w/ URLSearchParams serialization. Build ✓ lint ✓ 0 warnings. Next: Step 6 profile page consuming `/users/me`.
- `[2026-08-23] [M5]` **M5 Step 6 of 7 done (profile page):** `/profile` route (`metadata` title via template) rendering client `components/profile/profile-form.tsx`: loads `GET /users/me` (LoadingState / ErrorState w/ retry / EmptyState sign-in prompt on UNAUTHORIZED), two-card form (Basic info: name/avatar URL/bio w/ live char count; Food preferences: 8 dietary-label checkboxes, TagInput allergies + disliked ingredients, numeric calorie/protein/max-time inputs, difficulty Select). Client validation mirrors contract bounds; server `validation` records mapped to fields; submit sends FULL preferences object (backend defaults would reset omitted arrays); success Alert + re-sync from response; all controls disabled while saving. New primitive `ui/tag-input.tsx` (Enter/comma/paste/backspace, dedupe case-insensitive, per-chip remove w/ aria-label) added to barrel. React Compiler hook rule adaptation: initial fetch uses promise-callback setState pattern. Infra fixes: stray Turbopack artifacts had created nested `frontend/frontend/.next` junk breaking lint (deleted); pinned `turbopack.root` in `next.config.ts` which ELIMINATED the multi-lockfile workspace-root warning; eslint globalIgnores now covers `**/.next/**` at any depth. Build ✓ lint ✓, `/` + `/profile` prerender. Remaining M5 boxes: states-everywhere + responsive/a11y + AI-labeling (Step 7 sweep).
- `[2026-08-23] [M5]` **M5 Step 7 of 7 done (hardening sweep) — M5 workstream code-complete:** (1) AA fix: landing CTA band body copy `text-white/90` → solid `text-white` (blend measured ~4.4:1 on `primary-strong`, below the 4.5:1 floor). (2) `TagInput`: long-token chips now truncate (`max-w-[14rem] truncate` + native `title`) instead of overflowing at 320px; chip remove-button hit area enlarged to 24px via `-m-1 p-1.5` with zero layout growth (WCAG 2.2 target-size). (3) CSS hardening: `color-scheme: light` on html (native controls consistent now that dark is dropped), WebKit autofill normalized to card bg/foreground. (4) Route-level states: branded `not-found.tsx` (EmptyState + home/generator CTAs — replaces ugly default 404 for not-yet-built routes) and client `error.tsx` boundary (ErrorState + reset retry, digest logged). (5) Brand: new `app/icon.svg` flame favicon in primary orange, `viewport.themeColor #FDFBF7`, profile metadata description. Audit results: all layouts verified single-column ≥320px (grids collapse to 1 col, no fixed widths beyond max-w wrappers); every icon decorative+aria-hidden or paired with visible text; icon-only buttons carry accessible names. Build ✓ lint ✓, 6 routes prerender (`/`, `/profile`, `/_not-found`, `/icon.svg`). NOTE: §12.7 AI-labeling box intentionally left unticked — generator/recipe views are M3/M4 pages that will consume the ready `DisclaimerBanner` presets (`ai`/`nutrition`/`allergy`) and footer disclaimer when they land.
- `[2026-08-18] [M2]` **Task 1 of M2 done:** `middleware/auth.ts` — `verifyAccessToken` (HS256, issuer/audience/expiry, 401 on expired/malformed/unauthorized), `authenticate` (hydrates `req.user` from Mongo by `providerId`), `requireRole`/`requireAdmin` guards (403), `isOwnerOrAdmin` helper (FR-RECIPE-06), Express `Request.user` augmentation. Tests `tests/auth.test.ts` (21 cases, UserModel mocked). Build ✓, lint ✓, 35/35 tests ✓.
- `[2026-08-18] [M2]` **Task 2 of M2 done:** `authController.ts` mounted at `/auth` (with tighter `authLimiter`, 50/15min per NFR-SEC-07) — `POST /auth/token/verify` verifies the JWT and lazily upserts the user via `findOneAndUpdate` on `providerId` (`$setOnInsert`, atomic/race-safe), returns `{ user }`; `POST /auth/logout` → 204 (stateless, contract-compliant). JWT policy finalized in `docs/API_CONTRACT.md` `/auth` section (HS256, issuer/audience/expiry). Tests `tests/authController.test.ts` (7 cases via supertest). Build ✓, lint ✓, 42/42 tests ✓.
- `[2026-08-23] [M2]` **Task 3 of M2 done:** `userController.ts` mounted at `/users` in `routes/v1.ts` — `GET /users/me` (retrieves authenticated user profile + dietary preferences per FR-AUTH-06), `PATCH /users/me` (Zod validation with `UpdateProfileInput`, updates profile and dietary preferences in MongoDB). Tests `tests/userController.test.ts` (6 cases via supertest covering unauthenticated 401, validation error 400, profile/preferences update 200, and not found 404). Build ✓ (`tsc`), lint ✓ (0 warnings), 48/48 tests ✓.
- `[2026-08-23] [M2]` **Task 4 of M2 done:** Password hashing and credential security (FR-AUTH-07) — implemented `src/utils/password.ts` with cryptographically secure `crypto.scrypt` hashing (salt generation, 64-byte key) and constant-time `timingSafeEqual` verification against timing attacks. Ensured plain text passwords are never stored or returned by the API. Unit tests in `tests/password.test.ts` (7 test cases). Build ✓, lint ✓, 55/55 tests ✓.
- `[2026-08-17] [M3]` **M3 step 1 — recipe CRUD core done on `feature/m3-recipes-ai`.** Added `middleware/auth.ts` (minimal JWT bridge: `requireAuth`/`optionalAuth`/`requireAdmin`/`isOwnerOrAdmin`, issuer+audience from env — M2 reconciles at merge), `middleware/validate.ts`, `utils/asyncHandler.ts`, `controllers/recipeController.ts` (create→draft, get w/ draft visibility rules, update/delete/publish/unpublish owner-or-admin, totalTime recompute), `routes/recipes.ts` mounted in v1.ts, `req.user` type augmentation. `mongodb-memory-server` added for DB-backed integration tests (17 new → 31/31 pass; build+lint clean). **Found + fixed M1 model bug:** `User.providerId` default `null` broke the sparse unique index (second user → E11000); changed default to `undefined` so the field is absent unless set — flag to Lead for M1 sign-off.
- `[2026-08-17] [M3]` **M3 step 2 — paginated recipe search done.** `GET /recipes` (public): `searchRecipes` in `recipeController.ts` — `q` text search (title/summary/ingredients text index), filters `category`/`cuisine`/`diet`/`difficulty`/`maxCookingTimeMinutes`, sorts `newest`/`highest-rated`/`most-popular`, `page`/`limit` → `PaginatedResult` envelope. Query validated by `validateQuery(RecipeSearchQuery)`. +8 tests (tests/recipeSearch.test.ts) → 39/39 pass; build+lint clean.
- `[2026-08-18] [M4]` **M4 Step 1 — auth prerequisite:** implemented `backend/src/middleware/auth.ts` (`requireAuth` + `requireAdmin`) matching the M2 auth-bridge spec (Bearer JWT verify w/ issuer+audience, fresh user state via `UserModel.findById`, 401/403 envelopes) and `backend/src/types/auth.ts` (`AuthUser` + Express `Request.user` augmentation). 10 new unit tests (`tests/auth.test.ts`) cover missing/malformed/expired/wrong-secret/mismatched-audience tokens, deleted user, admin 403, admin 200. Reconcile with M2's version at merge. Build ✓, lint ✓, 24/24 tests ✓.
- `[2026-08-18] [M4]` **M4 Step 2 — ratings:** `ratingController.ts` (GET public summary, PUT idempotent upsert, DELETE own rating), aggregate recalculation (`RatingModel.aggregate` → recipe `averageRating`/`ratingCount`), owner-cannot-rate → 403, integer 1–5 via `CreateRatingInput`, published-only guard (`utils/recipeAccess.ts`), ObjectId param validation (`utils/params.ts`), `asyncHandler` util, mounted at `/recipes/:id/ratings` (`Router({ mergeParams: true })`). 11 new tests. Build ✓, lint ✓, 36/36 tests ✓.
- `[2026-08-18] [M4]` **Auth review fixes:** `auth.ts` now validates `sub` against `ObjectIdString` before `findById` (signature-valid non-ObjectId `sub` → 401 instead of a Mongoose CastError 500; +1 test), `AuthUser.role` derives from `USER_ROLE`, and stray `package-lock.json` churn reverted. Build ✓, lint ✓, 25/25 tests ✓.
- `[2026-08-24] [M4]` **M4 Step 3 — comments:** `commentController.ts` (GET public paginated list of visible comments, POST create, PATCH edit-own, DELETE own-or-admin) + `utils/sanitize.ts` (`sanitizePlainText` — strips HTML tags/control chars before Zod length validation, so `<script>`-style payloads never reach storage; NFR-SEC-06, FR-COMMENT-04). Mounted `/recipes/:id/comments` (`routes/comments.ts`, mergeParams) and top-level `/comments/:id` (`routes/commentDetail.ts`) in `routes/v1.ts` — the split matches the frozen contract, which nests list/create under the recipe but edit/delete under `/comments`. `recomputeCommentCount()` recounts `moderationStatus: "visible"` docs and writes `Recipe.commentCount` after every create/delete (same aggregate-recompute pattern as ratings), and is exported for `adminController` to reuse when moderate/unmoderate actions land. Ownership: PATCH is author-only (403 otherwise); DELETE is author-or-admin. Both gated behind `requirePublishedRecipe` on create/list only — edit/delete act on the comment's own ownership regardless of the parent recipe's current status. 21 new tests (`tests/comments.test.ts`, `tests/sanitize.test.ts`). Build ✓, lint ✓ (0 warnings), 57/57 tests ✓. **Not done yet** (separate TASKS.md bullets, deliberately left unchecked): rate limiting on comment endpoints (NFR-SEC-07) and the broader XSS/IDOR/CSRF hardening pass (NFR-SEC-05/06) — this step only covers comment-body sanitization. Next up: `favoriteController.ts`.
- `[2026-08-24] [M4]` **M4 Step 4 — favorites:** `favoriteController.ts` (`listFavorites`, `addFavorite`, `removeFavorite`) mounted at top-level `/favorites` (`routes/favorites.ts`, since it's not nested under `/recipes/:id` per contract). PUT is upsert-idempotent (existing favorite → no-op, no duplicate create; unique `(recipe,user)` index is the backstop) and gated by `requirePublishedRecipe` (FR-FAV-01). DELETE is deliberately **not** gated on recipe status — a user must always be able to clean up their own favorites list even after a recipe is hidden/unpublished/deleted. `recomputeFavoriteCount()` keeps `Recipe.favoriteCount` in sync (same pattern as ratings/comments). `GET /favorites` uses a `$lookup`+`$unwind` aggregation (not a plain `find`+`populate`) so pagination totals stay correct after filtering to `status: "published"` recipes only — a favorite whose recipe is no longer published is silently dropped from the feed (row itself untouched, reappears if republished) satisfying FR-FAV-04 without deleting user data.
  **Bug found + fixed while building this:** `ratingController.ts`'s `recomputeRatingAggregates` passed a raw string into `RatingModel.aggregate([{ $match: { recipe: recipeId } }, ...])`. Raw `.aggregate()` pipelines bypass Mongoose's Query-level auto-casting (unlike `.find()`/`.countDocuments()`/`.updateOne()`), so against real MongoDB this `$match` would never match the stored ObjectId `recipe` field — rating aggregates would silently stay at 0 in production despite the mocked unit tests passing. Fixed by casting with `new Types.ObjectId(recipeId)`; applied the same explicit cast in the new favorites aggregation from the start. `commentController.ts` was unaffected (`countDocuments`/`find` are Query-based, cast strings automatically).
  9 new tests (`tests/favorites.test.ts`). Build ✓, lint ✓ (0 warnings), 66/66 tests ✓. Next up: `adminController.ts`.
- `[2026-08-24] [M4]` **M4 Step 5 — admin moderation:** `adminController.ts` (`listUsers`, `listAdminRecipes`, `moderateRecipe`, `deleteRecipeAdmin`, `listAdminComments`, `moderateComment`, `deleteCommentAdmin`), mounted at `/admin` (`routes/admin.ts`) behind router-level `requireAdmin` (non-admin → 403 on every sub-route, FR-ADMIN-03). Added 5 new Zod schemas to `types/index.ts` (`AdminUserSearchQuery`, `AdminRecipeSearchQuery`, `AdminRecipeModerationInput`, `AdminCommentSearchQuery`, `AdminCommentModerationInput`) — the frozen contract only specified methods/paths for `/admin`, not body shapes, so these fill a documented gap rather than change anything frozen; mirrored into `docs/API_CONTRACT.md`.
  Design notes: `PATCH /admin/recipes/:id` is intentionally scoped to `published <-> hidden` only (rejects `"draft"`) — draft/publish stays the recipe owner's workflow, M3's domain, not admin's. `q` search filters (`/admin/users`, `/admin/recipes`) run user input through a new `utils/regex.ts` (`escapeRegExp`) before building a `RegExp`, so untrusted text can't inject regex metacharacters (NFR-SEC-05). Every mutating action goes through `utils/adminLog.ts` (`logAdminAction` — structured `console.info`, no new persisted model since the contract's model list is frozen at 6 and FR-ADMIN-04 says protected endpoints are enough for MVP without a full audit dashboard). Comment moderate/delete reuse `recomputeCommentCount` (exported from `commentController.ts` for exactly this).
  16 new tests (`tests/admin.test.ts`). Build ✓, lint ✓ (0 warnings), 82/82 tests ✓. That's every M4 backend controller from TASKS.md now done. Remaining M4 backend items: rate limiting on comment endpoints (NFR-SEC-07), the broader XSS/IDOR/CSRF hardening pass (NFR-SEC-05/06), and confirming draft/hidden exclusion once M3's `/recipes` search lands. M4 frontend pages are blocked on M5's shell.
- `[2026-08-24] [M4]` **M4 Step 6 — remaining backend hardening checkboxes (rate limiting, sanitization/IDOR/CSRF audit, draft/hidden exclusion):**
  - **Rate limiting (NFR-SEC-07):** new `commentLimiter` (20 req/10 min, IP-keyed) in `middleware/rateLimit.ts`, layered on top of the app-wide `baseLimiter`. Applied to `POST /recipes/:id/comments`, `PATCH /comments/:id`, `DELETE /comments/:id` — runs *before* `requireAuth` on each route so unauthenticated spam is throttled before it reaches the DB-backed auth check. GET (list) is left to `baseLimiter` alone; reading isn't the abuse surface. 1 new test (`tests/rateLimit.test.ts`).
  - **XSS/injection/IDOR/CSRF (NFR-SEC-05/06):** added app-wide `middleware/sanitizeInput.ts` (`sanitizeMongoOperators`), mounted in `server.ts` right after `express.json()`, which strips `$`-prefixed and dotted keys from every `req.body`/`req.query` recursively — defense-in-depth against NoSQL injection on top of the per-endpoint Zod validation every M4 controller already does (no raw/untyped input reaches a Mongoose filter anywhere in ratings/comments/favorites/admin). 5 new tests (`tests/sanitizeInput.test.ts`). Comment XSS (NFR-SEC-06) was already handled in Step 3 (`utils/sanitize.ts`). IDOR audit: every M4 mutation is scoped to the authenticated user's own row (`{recipe, user: user.id}` in ratings/favorites; explicit `record.user === user.id` ownership check in comments) or gated behind `requireAdmin`; no endpoint accepts an arbitrary target id without an ownership/role check — nothing further to add. CSRF: not applicable yet — the API is Bearer-JWT-only (no cookie-based session exists), which structurally isn't CSRF-exploitable; noted in `docs/API_CONTRACT.md` as a flag to revisit if M2's auth bridge later adopts cookie sessions (SRS §9.4).
  - **Draft/hidden exclusion (Business Rules 3/4/10):** verified across every M4 endpoint — `requirePublishedRecipe` gates ratings (GET/PUT/DELETE) and comments (GET list/POST); favorites `PUT` gates the same way and the `GET /favorites` aggregation filters `status: "published"` directly in the pipeline; `/admin/*` intentionally sees everything (that's the admin surface, not public discovery, correctly role-gated). M4's contribution to this rule is complete; final end-to-end confirmation (Section 6.1) still needs M3's `/recipes` public search endpoint, which doesn't exist yet.
  - `docs/API_CONTRACT.md` updated with a Sanitization / Rate limiting / CSRF subsection under cross-cutting rules. Build ✓, lint ✓ (0 warnings), **88/88 tests ✓**. **Every M4 backend TASKS.md item is now done.** Only M4 frontend pages remain, deliberately deferred per current instructions.
- `[2026-08-18] [M4]` **Auth review fixes:** `auth.ts` now validates `sub` against `ObjectIdString` before `findById` (signature-valid non-ObjectId `sub` → 401 instead of a Mongoose CastError 500; +1 test), `AuthUser.role` derives from `USER_ROLE`, and stray `package-lock.json` churn reverted. Build ✓, lint ✓, 25/25 tests ✓.
- `[2026-08-18] [M2]` **Task 1 of M2 done:** `middleware/auth.ts` — `verifyAccessToken` (HS256, issuer/audience/expiry, 401 on expired/malformed/unauthorized), `authenticate` (hydrates `req.user` from Mongo by `providerId`), `requireRole`/`requireAdmin` guards (403), `isOwnerOrAdmin` helper (FR-RECIPE-06), Express `Request.user` augmentation. Tests `tests/auth.test.ts` (21 cases, UserModel mocked). Build ✓, lint ✓, 35/35 tests ✓.
- `[2026-08-17] [M3]` **M3 step 1 — recipe CRUD core done on `feature/m3-recipes-ai`.** Added `middleware/auth.ts` (minimal JWT bridge: `requireAuth`/`optionalAuth`/`requireAdmin`/`isOwnerOrAdmin`, issuer+audience from env — M2 reconciles at merge), `middleware/validate.ts`, `utils/asyncHandler.ts`, `controllers/recipeController.ts` (create→draft, get w/ draft visibility rules, update/delete/publish/unpublish owner-or-admin, totalTime recompute), `routes/recipes.ts` mounted in v1.ts, `req.user` type augmentation. `mongodb-memory-server` added for DB-backed integration tests (17 new → 31/31 pass; build+lint clean). **Found + fixed M1 model bug:** `User.providerId` default `null` broke the sparse unique index (second user → E11000); changed default to `undefined` so the field is absent unless set — flag to Lead for M1 sign-off.
- `[2026-08-17] [M3]` **M3 step 2 — paginated recipe search done.** `GET /recipes` (public): `searchRecipes` in `recipeController.ts` — `q` text search (title/summary/ingredients text index), filters `category`/`cuisine`/`diet`/`difficulty`/`maxCookingTimeMinutes`, sorts `newest`/`highest-rated`/`most-popular`, `page`/`limit` → `PaginatedResult` envelope. Query validated by `validateQuery(RecipeSearchQuery)`. +8 tests (tests/recipeSearch.test.ts) → 39/39 pass; build+lint clean.
- `[2026-08-23] [M3]` **M3 step 3 — Groq AI service + Pantry matching + Flavor pairing done on `feature/m3-recipes-ai`.** Created `backend/src/services/aiService.ts` with Groq API integration (`openai/gpt-oss-120b`, `qwen/qwen3.6-27b`, `llama-3.3-70b-versatile`), JSON prompt builder enforcing strict output, server-side Zod validation (`AIRecipeOutputSchema`, `FlavorPairingSuggestionSchema`), configurable timeout (≤30s) + retryable `AI_PROVIDER_ERROR` (502/504), pantry matching engine (`matchPantry`), flavor pairing generator (`generateFlavorPairings`), and `AIGenerationLog` telemetry. +8 tests (`tests/aiService.test.ts`) → 47/47 pass; build ✓, lint (0 warnings) ✓.
- `[2026-08-23] [M3]` **M3 step 4 — All remaining M3 backend tasks completed.** Implemented `imageService.ts` (ImgBB API upload + MIME/extension/size validation, NFR-SEC-08), `uploadController.ts` (`POST /upload/image`), `aiController.ts` (`POST /ai/recipes/generate`, `POST /ai/flavor-pairings`), rate limiting middleware (`aiRateLimiter`, `uploadRateLimiter`, NFR-SEC-07), and mounted routes in `v1Router`. Added 14 new tests (`tests/imageService.test.ts` & `tests/aiController.test.ts`) → **61/61 tests pass**; build ✓, lint (0 warnings) ✓.
- `[2026-08-24] [M2]` **Workstream M2 Complete — Auth & Users (Backend + Frontend E2E).** Implemented `frontend/src/lib/auth-context.tsx` (`AuthProvider`, `useAuth`, `useRequireAuth` hook with `localStorage` token, hydration on mount via `/api/v1/auth/token/verify`, `signIn`/`signUp`/`signOut`). Server-side JWT minting in `frontend/src/lib/jwt.ts` (HS256 signed with `JWT_SECRET`, compatible with `backend/src/middleware/auth.ts` verifier). Route handlers `frontend/src/app/api/auth/sign-in/route.ts` and `sign-up/route.ts` mint tokens with demo account support. `(auth)/sign-in/page.tsx` and `(auth)/sign-up/page.tsx` built with Gravity UI icons, show/hide password toggle, and demo account 1-click buttons. Client-side route & action protection (FR-AUTH-03): created `<AuthGuard>` wrapper component for protected pages (`/profile`, `/generator`, `/favorites`), `<AuthPrompt>` banner/card component for guarding unauthenticated actions (ratings, comments, favorites, recipe creation), and `useRequireAuth` hook for interactive triggers. Added comprehensive 5-step E2E integration test suite (`tests/authFlow.test.ts`) verifying full Sign-in -> JWT Minting -> Token Verification -> Session Hydration -> Profile CRUD (`GET/PATCH /users/me`) -> Sign Out -> Expired/Tampered Token Rejection. Backend: consolidated `auth.ts`, all **46/46 M2 unit & E2E tests passing**. Frontend: Next.js 16 build ✓, lint ✓ (0 warnings). **All M2 backend and frontend roadmap items are 100% complete.**


