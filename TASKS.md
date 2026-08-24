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
- [ ] `middleware/auth.ts` — Bearer JWT verification, attach `req.user`, reject expired/malformed/unauthorized (FR-AUTH-04/05)
- [ ] Role + ownership guards (owner-or-admin for edit/unpublish/delete; FR-RECIPE-06)
- [ ] `authController.ts` — Better Auth integration + token verification
- [ ] `userController.ts` — `/users/me` view/update profile + preferences (FR-AUTH-06)
- [ ] Password hashing if used; never return in plain text (FR-AUTH-07)
- [ ] Rate limiting on auth endpoints (NFR-SEC-07)

### Frontend (auth pages)
- [ ] `(auth)/sign-in/page.tsx`, `(auth)/sign-up/page.tsx` via Better Auth
- [ ] Protect authenticated pages/actions client-side (FR-AUTH-03)
- [ ] Sign-in/sign-out flow verified against M1 API + JWT middleware

---

## Workstream M3 — Recipes & AI

> **Goal:** Manual recipe CRUD + AI generation (Groq) produce schema-valid recipes that save as draft or publish.

### Backend
- [ ] `recipeController.ts` — CRUD, draft/publish/unpublish/delete, ownership enforced (FR-RECIPE-01..06)
- [ ] Paginated search + filters: `q`, `category`, `cuisine`, `diet`, `sort`, `page`, `limit` (FR-SEARCH-01..05)
- [ ] `aiService.ts` — Groq adapter (`llama-3.3-70b-versatile` / `mixtral-8x7b-32768`)
- [ ] Constrained prompt builder enforcing strict JSON schema output
- [ ] Server-side Zod validation on ALL AI output; invalid/incomplete NOT stored (FR-AI-07)
- [ ] Timeout (≤30s) + safe retryable error on provider failure (FR-AI-08, NFR-PERF-03)
- [ ] Pantry matching: `usedIngredients` vs `missingIngredients` (FR-PANTRY-01..03)
- [ ] Flavor-pairing suggestions respecting dietary/allergy constraints (FR-FLAVOR-01..03)
- [ ] Nutrition estimate per serving; missing → unavailable, never fabricated (FR-NUTR-01..04)
- [ ] `imageService.ts` — ImgBB upload; MIME/extension/size validation (NFR-SEC-08)
- [ ] `aiController.ts` — `/ai/recipes/generate`, `/ai/flavor-pairings`
- [ ] Rate limiting on AI + upload endpoints (NFR-SEC-07)

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

- [ ] Global layout, theme (glassmorphism), `Navbar.tsx`, `Footer.tsx`
- [ ] `page.tsx` — landing: pantry-to-plate USP, featured recipes, CTAs
- [ ] `profile/page.tsx` — profile + food preferences (consumes M2 API)
- [ ] Forms: labels, validation messages, keyboard access, focus states, loading/disabled (NFR-UX-02)
- [ ] Empty / loading / success / error states everywhere (NFR-UX-05)
- [ ] Responsive on ≥320px mobile, tablet, desktop; WCAG 2.1 AA contrast + semantics
- [ ] Icons never sole meaning carrier (NFR-UX-04)
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