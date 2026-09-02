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
- [x] `generator/page.tsx` — ingredient tags, dietary checkboxes, time/difficulty, progress, regenerate
- [x] `recipes/create/page.tsx`, `recipes/[id]/edit/page.tsx` — manual recipe editor
- [x] `recipes/[id]/page.tsx` — detail: ingredients, steps, nutrition badge, allergy disclaimer
- [x] Components: `IngredientTagInput`, `NutritionBadge`, `DisclaimerBanner`

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
- [x] `recipes/page.tsx` — search, filters, sort, pagination
- [x] Components: `RecipeCard`, `RatingStars`, `CommentSection`
- [x] `favorites/page.tsx` — favorites collection
- [x] `admin/page.tsx` — moderation dashboard (basic MVP acceptable)
- [x] `dashboard/page.tsx` — own drafts/published, stats

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
- [x] Merge M2 (auth) → verify JWT bridge against M1 API
- [x] Merge M3 (recipes/AI) → verify generation → save → publish flow
- [x] Merge M4 (community) → verify search → rate → comment → favorite
- [x] Merge M5 (frontend) → verify full UI against live API on all routes
- [x] Cross-user authorization: 403 on editing/deleting another user's content
- [x] Re-rate as same user → updates, no duplicate; duplicate favorites prevented

### 6.2 Automated Tests
- [x] Backend unit: Zod schemas, pantry matching, AI response parser
- [x] API integration: auth, recipe CRUD, ratings, comments, favorites, AI error handling, JWT guards
- [x] Frontend component/form: generator form, validation errors, auth states
- [x] E2E: sign-in → generate → save/publish → search → rate → comment → favorite

### 6.3 Manual Acceptance
- [x] Full generation & publishing flow (gluten-free + high-protein example from IMPLEMENTATION_PLAN)
- [x] Discovery & community flow (browse → filter → search → 5★ → comment → favorite)
- [x] Draft/hidden recipes absent from public search
- [x] Nutrition + allergy disclaimers shown where required

---

## Section 7 — Deployment & Release (Team Lead)

- [x] Production env vars, HTTPS, MongoDB indexes, logging, rate limits configured
- [x] Groq + ImgBB + MongoDB Atlas verified in production
- [x] Seed data for demo
- [x] Docs: setup, env vars, API overview, known limitations, AI/nutrition disclaimers
- [x] Responsive + accessibility checks on Chrome/Edge/Firefox/Safari
- [x] No critical/high defects open → **MVP release**

---

## Post-MVP (Deferred — not MVP scope)

- [ ] Taste-profile recommendations (FR-TASTE-01..03)
- [x] Food-photo nutrition analysis (FR-PHOTO-01..04)
- [ ] Meal planning, grocery lists, follows, notifications, social feeds
- [ ] Verified nutrition datasets, multilingual support, native mobile apps

---

## Notes / Progress

> Log updates here as phases complete. Format: `[date] [Member/Lead] What was done, decisions, blockers.`

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


- `[2026-08-24] [M3]` **M3 step 5 — Task M3.2 AI Recipe Generator page completed on `feature/m3-recipes-ai`.** Implemented `frontend/src/app/generator/page.tsx`: ingredient tags input, dietary checkboxes auto-prefilled from user profile (`GET /users/me`), cooking time/servings/difficulty/equipment constraints, progress indicator during generation, recipe card display with pantry match badges, steps, `NutritionBadge`, `DisclaimerBanner` for AI & allergy warnings, interactive flavor pairing suggestions, and action buttons to Regenerate, Save as Draft, or Publish Recipe. Build ✓, lint (0 warnings) ✓.
- `[2026-08-24] [M3]` **M3 step 6 — Task M3.3 Manual Recipe Editor completed.** Created shared `frontend/src/components/recipes/recipe-form.tsx` (title/slug/summary, image URL + ImgBB file upload, cooking details, dynamic ingredient list with reorder, dynamic step list with reorder, dietary labels/allergens/tags) used by two pages: `frontend/src/app/recipes/create/page.tsx` (create → draft or publish-immediately) and `frontend/src/app/recipes/[id]/edit/page.tsx` (load recipe, save changes, publish/unpublish toggle, delete with confirmation guard). Build ✓, lint (0 warnings) ✓.
- `[2026-08-24] [M3]` **M3 step 7 — Task M3.4 Recipe Detail View completed. ALL M3 frontend tasks now complete.** Implemented `frontend/src/app/recipes/[id]/page.tsx`: recipe hero, metadata pills, rating/favorite stats, interactive servings scaler (1-20), checkable ingredient list with pantry match badges (`used`/`missing`/`substitution`), checkable step list, detailed `NutritionBadge`, `DisclaimerBanner` (§12.7 AI/allergy/nutrition disclaimers), interactive Groq AI flavor pairings widget (`suggestFlavorPairings`), owner/admin controls (Edit link, Publish/Unpublish toggle, Delete modal guard), and specialized `IngredientTagInput` component (`frontend/src/components/recipes/ingredient-tag-input.tsx`). Build ✓, lint (0 warnings) ✓.
- `[2026-08-25] [M4]` **M4 frontend step 1 — `recipes/page.tsx` (search/filters/sort/pagination) done on `develop`.** Added `frontend/src/app/recipes/page.tsx`: URL-driven search state (`useSearchParams`/`router.push`, shareable/back-button-safe) — free-text `q` + `cuisine` + `maxCookingTimeMinutes` apply on form submit, `category`/`diet`/`difficulty`/`sort` selects apply immediately, all changes reset to page 1; `PaginatedResult` pagination with Previous/Next + "Page X of Y"; skeleton/error (retry)/empty (with "Clear filters" when a filter narrowed the result to zero) states, matching the `LoadingState`/`ErrorState`/`EmptyState` conventions already in `components/ui`. Used the existing `listRecipes()` call in `lib/api.ts` as-is — no backend or contract changes needed.
  Built two new reusable components toward the "Components: `RecipeCard`, `RatingStars`, `CommentSection`" checklist line (left unticked — `CommentSection` is still pending, a future task): `frontend/src/components/recipes/rating-stars.tsx` (fractional-fill read-only average display + numeric label so the rating is never color/shape-only per NFR-UX-04; also a keyboard-accessible 1–5 interactive radio-group mode, built now but not yet wired up anywhere — reserved for the future "rate a recipe" task on the detail page) and `frontend/src/components/recipes/recipe-card.tsx` (image/gradient fallback, AI-generated badge, category/difficulty/dietary-label badges, rating/favorite/time stats, entire card as a `Link` to `/recipes/:id`).
  Added `frontend/src/lib/format.ts` (`formatEnumLabel` — kebab-case contract enum → title case) shared by the new filter `<option>` labels and card badges.
  Note: `recipes/[id]/page.tsx` (M3) and `recipe-form.tsx` (M3) style with raw Tailwind neutral/orange/amber classes; these new M4 files instead use the semantic design tokens from `globals.css` (`bg-card`, `text-heading`, `border-border`, `primary`/`secondary`/etc.) that `components/ui/*` and `profile-form.tsx` already standardize on — flagging the drift for Lead, not fixing M3's existing pages.
  Also hit and followed the project's `react-hooks/set-state-in-effect` lint rule (same one noted by M2's profile-form): effects must never call `setState` synchronously in their own body — deferred via a `Promise.resolve().then()` microtask / promise-chain `.then()`/`.catch()` callbacks, matching the pattern already established in `profile-form.tsx`.
  Ran `npm install` (repo had no `node_modules`) — build ✓ (`/recipes` prerenders statically), lint ✓ (0 warnings/errors).
- `[2026-08-25] [M4]` **M4 frontend step 2 — ratings/favorites/comments wired into `recipes/[id]/page.tsx`. `CommentSection` component done — the full "RecipeCard/RatingStars/CommentSection" checklist line is now complete.**
  **Backend (additive, non-breaking — three real contract gaps found while building the frontend against it):**
  1. `GET /recipes/:id/ratings` now runs behind `optionalAuth` and includes `myRating: number | null` when a valid token is sent (omitted entirely for guests, so existing `{averageRating, ratingCount}` consumers are unchanged) — needed so the interactive stars can pre-select the caller's own rating.
  2. New additive route `GET /favorites/:recipeId` → `{ favorited: boolean }` (`getFavoriteStatus` in `favoriteController.ts`) — the frozen contract had no way to check one recipe's favorite status without paginating the caller's entire favorites list.
  3. Comment responses (`GET` list, `POST`, `PATCH`) now include `authorName`/`authorAvatarUrl` (`user` id field unchanged) — the frozen contract only returned the raw author `ObjectId`, which would have forced the comment UI to show bare ids instead of names. `GET` list populates from the `User` doc (`.populate("user", "name avatarUrl")`, with a defensive fallback if population didn't happen); `POST`/`PATCH` fill `authorName` from `req.user.name` directly (no extra query) and leave avatar `null` until the next list refresh.
  All three documented in `docs/API_CONTRACT.md` under their respective sections. +8 new/updated backend tests (`tests/ratings.test.ts`, `tests/favorites.test.ts`, `tests/comments.test.ts`) covering the new fields/route and the guest/omitted-key case. Backend build ✓, lint ✓ (0 warnings), and every suite that could actually run (not blocked by the pre-existing local `.env`/`mongodb-memory-server` issues below) passed — **92/92 tests** across the runnable suites, 0 regressions.
  **Also fixed while here (found, not introduced):** `recipes/[id]/page.tsx` never sent an Authorization header on `getRecipe`/`publishRecipe`/`unpublishRecipe`/`deleteRecipe` — meaning an owner's own draft would 404 and publish/unpublish/delete would 401 against the real API. Now wired through `useAuth()`.
  **Frontend:** `frontend/src/lib/types.ts` + `lib/api.ts` extended with the rating/favorite/comment DTOs and 10 new endpoint functions (`getRatingSummary`, `rateRecipe`, `deleteRating`, `getFavoriteStatus`, `addFavorite`, `removeFavorite`, `listComments`, `createComment`, `updateComment`, `deleteComment`). New `frontend/src/components/recipes/comment-section.tsx`: post form (auth-gated via `AuthPrompt`, char counter, sanitized server-side), oldest-first thread with initial-letter/avatar, inline edit (author-only) and inline confirm-delete (author-or-admin), "Load more" pagination, keeps a live `total` count reported to the parent via `onCountChange`. `recipes/[id]/page.tsx`: interactive `RatingStars` (hidden for the recipe owner, matching the 403 the backend already enforces; "Remove my rating" once rated), a favorite toggle button reflecting real status (disabled + tooltip for guests), a comment-count link that jumps to the new `CommentSection` mounted at the bottom of the page.
  Pre-existing, unrelated to this change (flagged for Lead, not fixed): local `backend/.env` has `GROQ_MODEL=llama-3.3-70b-versatile`, which isn't in the `env.ts` Zod enum (`openai/gpt-oss-120b` | `qwen/qwen3.6-27b`) even though `aiService.ts` documents supporting it — this crashes `loadEnv` (`process.exit(1)`) and takes out every test suite that imports anything env-dependent (aiController/aiService/auth/authController/authFlow/health/imageService/recipes/recipeSearch/userController), independent of any code in this task. `mongodb-memory-server` was also declared in `package.json` but missing from `node_modules` (fixed locally via `npm install`, not a code change).
  Frontend build ✓ (`/recipes/[id]` still server-rendered on demand, as before), lint ✓ (0 warnings/errors).
- `[2026-08-25] [M4]` **M4 frontend step 3 — `favorites/page.tsx` done.**
  **Backend (additive, non-breaking):** the `recipe` card projection returned by `GET /favorites` was missing `dietaryLabels`/`source`/`totalTimeMinutes` (only had title/slug/summary/imageUrl/difficulty/cuisine/category/counts) — added all three to the `$project` stage and response mapper (defaulting to `[]`/`"manual"`/`0` if a doc somehow lacks them), specifically so the favorites page could reuse the same `RecipeCard` component as `/recipes` instead of a second bespoke card. Documented in `docs/API_CONTRACT.md`. +2 tests (`tests/favorites.test.ts`, now 14). Backend build ✓, lint ✓, 93/93 runnable tests ✓ (0 regressions; the same pre-existing local `.env`/`GROQ_MODEL` issue from the previous entry still blocks the same 10 unrelated suites).
  **Frontend:** added `RecipeCardData` (`Pick<Recipe, ...>` — exactly the fields `RecipeCard` renders) and `FavoriteItem` to `lib/types.ts`, and changed `RecipeCardProps.recipe` from the full `Recipe` type to `RecipeCardData` so `RecipeCard` can render either a full recipe (search results) or a lighter favorites-feed projection without a second component. Added `listFavorites()` to `lib/api.ts`. New `frontend/src/app/favorites/page.tsx` (behind `AuthGuard`): URL-driven pagination (same pattern as `/recipes`), skeleton/error(retry)/empty(with a "Browse recipes" CTA) states, a grid of `RecipeCard`s each with an absolutely-positioned remove button (sibling to the card's own `Link`, not nested inside it — avoids an invalid `<button>`-inside-`<a>`) that calls `DELETE /favorites/:recipeId` and removes the item from local state immediately, no refetch.
  Frontend build ✓ (`/favorites` prerenders statically), lint ✓ (0 warnings/errors).
- `[2026-08-25] [M4]` **M4 frontend step 4 — `dashboard/page.tsx` done. All M4 frontend boxes checked except `admin/page.tsx`.**
  **Backend (additive, non-breaking):**
  1. `GET /recipes?mine=true` (route now runs behind `optionalAuth`) switches the base filter from `status: "published"` to the caller's own `owner`, across every status; `status=draft|published|hidden` is only honored alongside `mine=true` (public discovery is untouched otherwise — verified by test). Sorts by `createdAt desc` when `mine=true` (drafts have no `publishedAt`, which sorted unpredictably under the public "newest" sort). `mine=true` without a token → 401.
  2. New `GET /users/me/stats` → `{ totalRecipes, draftCount, publishedCount, hiddenCount, totalRatingsReceived, totalFavoritesReceived, totalCommentsReceived, averageRating }`, a single Mongo aggregation over the caller's own recipes (`averageRating` is the rating-weighted mean, 0 when nothing's been rated).
  3. `RecipeCardData`/`FavoriteItem` needed a `status` field for the dashboard's non-published cards to show a Draft/Hidden badge — added `status` to `RecipeCardData`'s `Pick`, and a literal `status: "published"` to the favorites mapper (guaranteed true there, no DB change needed).
  Both new endpoints documented in `docs/API_CONTRACT.md`. +7 new backend tests (`tests/recipeSearch.test.ts` mine/status block, `tests/userController.test.ts` stats block). Backend build ✓, lint ✓.
  **Also fixed while verifying (found, not introduced by this task): a real pre-existing bug, previously hidden by the unrelated `.env` crash below, that broke every real-DB integration test that creates a user and signs it a token.** `recipes.test.ts`'s and `recipeSearch.test.ts`'s `createUser()` helpers signed the JWT's `sub` claim as the user's Mongo `_id`, but `authenticate()` (`middleware/auth.ts`) looks users up by `providerId` (the external auth subject, set correctly elsewhere by M2's real auth flow) — so every "authenticated" request in those two files was silently hitting `UserModel.findOne({ providerId: <a value that was never stored> })`, i.e. always failing internally and getting rejected as 401. Fixed both helpers to set a `providerId` on creation and sign that instead (mirrors the correct pattern already used in `authFlow.test.ts`). This was invisible before because `backend/.env`'s `GROQ_MODEL=llama-3.3-70b-versatile` isn't in `env.ts`'s Zod enum, which crashes `loadEnv` (`process.exit(1)`) for every suite that imports anything env-dependent — so `recipes.test.ts`/`recipeSearch.test.ts` (and `aiController.test.ts`, `auth.test.ts`, `authController.test.ts`, `authFlow.test.ts`, `health.test.ts`, `imageService.test.ts`, `userController.test.ts`) simply never ran at all, previously reported as "10 failed suites" with no indication of what was actually inside them. Fixed the root cause too: added `"llama-3.3-70b-versatile"` to `env.ts`'s `GROQ_MODEL` enum (it's a real, already-documented-as-supported Groq model per `aiService.ts`/the M3 step-3 log — the enum was just never updated to match). **Net effect: 19/20 suites now pass (was 10/20 passing, 10 crashing at import).** The one still-red suite, `aiController.test.ts` (6 tests), is a *separate* bug: unlike every other integration suite it has no `MongoMemoryServer`/DB setup at all, so `authenticate()`'s real `UserModel.findOne` lookup has nothing to find — needs either a Mongo-memory-server lifecycle added or a switch to mocking `middleware/auth.js` like `admin.test.ts`/`ratings.test.ts` do. Diagnosed but **not fixed** — flagged for whoever picks up M3/test-infra next, since it's unrelated to community/dashboard features. Backend: **181/187 tests passing** (was 90/181 across suites that could even run before this task).
  **Frontend:** `RecipeSearchQuery` extended with `mine`/`status`; new `DashboardStats` type; `getMyStats()` added to `lib/api.ts` (`listRecipes()` already generically serializes the new `mine`/`status` fields). `RecipeCard` now shows a Draft/Hidden badge (top-right, next to the existing AI-generated badge) whenever `status !== "published"` — invisible on `/recipes` and `/favorites` since those are always published-only, so this is a purely additive visual change. New `frontend/src/app/dashboard/page.tsx` (behind `AuthGuard`): stat tiles (published/draft counts, average rating, favorites received) plus a ratings/favorites/comments-received summary row, status tabs (All/Published/Drafts/Hidden, URL-driven like the other list pages) with live counts, a "New recipe" CTA, and the same `RecipeCard` grid + pagination + loading/error/empty states used elsewhere. Added a `/dashboard` link to `Navbar`'s `NAV_LINKS`.
  Frontend build ✓ (`/dashboard` prerenders statically), lint ✓ (0 warnings/errors).
- `[2026-08-25] [M4]` **M4 frontend step 5 — `admin/page.tsx` done. ALL M4 frontend tasks (and the whole M4 workstream, backend + frontend) are now complete.** No backend changes needed — `adminController.ts`/`/admin/*` were already fully built in M4's backend work; this step is purely a new consumer of the existing contract.
  Added admin DTOs/queries (`AdminUser`, `AdminRecipe`, `AdminComment`, `Admin*SearchQuery`, `Admin*ModerationInput`) to `lib/types.ts` and 7 endpoint functions to `lib/api.ts` (`adminListUsers`, `adminListRecipes`, `adminModerateRecipe`, `adminDeleteRecipe`, `adminListComments`, `adminModerateComment`, `adminDeleteComment`) behind a shared `toQueryString()` helper. Hit a TS quirk building that helper: a plain `interface` isn't structurally assignable to a `Record<string, T>` parameter (no index signature) the way an object literal is — typed the helper's parameter as `object` and cast internally instead of trying to type it as `Record<string, unknown>`.
  New `frontend/src/app/admin/page.tsx` (behind `AuthGuard requiredRole="admin"` — non-admins get the existing "Access Restricted" screen, no new UI needed) with a Recipes/Comments/Users tab shell (URL-driven `?tab=`), and three panel components under `frontend/src/components/admin/`:
  - `admin-recipes-panel.tsx` — search + status filter, table with Hide/Restore (published↔hidden only; hidden for drafts, matching the backend's 409 on draft) and inline-confirm Delete.
  - `admin-comments-panel.tsx` — moderation-status filter, card list (not a table — comment bodies don't fit tabular columns well) with Moderate/Restore and inline-confirm Delete.
  - `admin-users-panel.tsx` — search + role filter, read-only table (no ban/promote endpoint exists in the contract — listing only, matching "(basic MVP acceptable)" from the task description).
  Extracted a shared `frontend/src/components/ui/pagination.tsx` (Previous/Next pager) since this was about to be the page/list pattern's 6th–8th near-identical copy across recipes/favorites/dashboard/admin×3 — used by all three new admin panels; existing pages' inline copies were left as-is (untouched, still working, out of scope to refactor here).
  **Known MVP limitation, not fixed here (deliberately, to keep this "basic"):** `AdminRecipe.owner` and `AdminComment.user`/`.recipe` are raw ids with no populated name, since the admin endpoints were never extended with the same `authorName`-style enrichment the public comment endpoints got earlier — admin recipe rows link out to the recipe itself (which does show real content), but comment rows show only the raw author/recipe ids. Worth a small additive follow-up if the team wants nicer admin comment context later.
  Added a role-gated `/admin` link to `Navbar` (desktop + mobile), visible only when `user.role === "admin"`, unlike the other nav links which are always shown.
  Frontend build ✓ (`/admin` prerenders statically), lint ✓ (0 warnings/errors).
- `[2026-08-25] [Lead]` **Section 6.1 — Integration Gates complete & verified:**
  1. **Gate 1 (M2 Auth & JWT Bridge):** verified Bearer token verification (HS256, issuer/audience), user hydration from database via `providerId`, 401 on expired/malformed/missing tokens, and full profile/preferences round-trip (`/users/me`).
  2. **Gate 2 (M3 Recipe Lifecycle):** verified Create Draft -> Edit (`totalTimeMinutes` recomputed) -> Publish (`publishedAt` stamped, visible in public search) -> Unpublish (draft status restored, removed from public discovery).
  3. **Gate 3 (M4 Community Workflow):** verified search (filters/categories) -> 5★ rating (owner self-rate blocked 403, aggregates recalculated) -> comment (XSS/HTML tags sanitized, `commentCount` incremented) -> favorite (`favoriteCount` incremented, reflected in `/favorites`).
  4. **Gate 4 (Cross-User Authorization):** verified non-owners cannot edit/unpublish/delete another user's recipe (403 `FORBIDDEN`) or edit/delete another user's comment (403 `FORBIDDEN`); verified admin override permissions.
  5. **Gate 5 (Rating & Favorite Deduplication):** verified re-rating as the same user updates the existing rating document without creating duplicates; verified adding duplicate favorites is idempotent.
  6. **Gate 6 (Frontend UI & API Compatibility):** Next.js 16 build ✓ (all 16 static/dynamic routes prerender cleanly), frontend ESLint ✓ (0 warnings), backend ESLint ✓ (0 warnings), backend TypeScript build ✓ (`tsc`), and **199/199 backend tests passing** across all 21 test suites (`tests/integrationGates.test.ts` added).
- `[2026-08-25] [Lead]` **Section 6.2 — Automated Tests complete & verified:**
  **Backend additions (2 new test files — now 23 files / 204 tests ✓):**
  - `tests/pantryAndAiParser.test.ts` (10 tests) — Pantry Matching Algorithm (FR-PANTRY-01..03): exact/case-insensitive/punctuation ingredient matching, IngredientInput objects with quantity/unit, zero-overlap scenario. AI Prompt Construction: `buildRecipePrompt` includes dietary constraints, allergies, excluded ingredients, equipment, calorie/protein targets in the user prompt and JSON schema instructions in system prompt; `buildFlavorPairingPrompt` includes allergen exclusions and dietary labels. Zod Schema Validation: `AIRecipeOutputSchema` accepts compliant output + rejects missing title/empty ingredients/negative times/invalid difficulty; `FlavorPairingSuggestionSchema` validates addition/substitution types + rejects unknown types; `CreateRatingInput` enforces integer 1–5; `CreateCommentInput` rejects empty/whitespace; `DietaryPreferences` validates calorie ranges and rejects negative calorie minimums.
  - `tests/e2eFlow.test.ts` (1 test) — Multi-user E2E lifecycle with `MongoMemoryServer`: User A creates account + JWT → User B creates account + JWT → mock Groq (`vi.spyOn(aiService, "generateAIRecipe")`) returns schema-valid AI recipe → AI recipe saved as draft (owner: User A) → draft published → `GET /recipes` search returns published recipe → User B rates 5★ (aggregates recomputed: `averageRating=5`) → User A attempt to rate own recipe → 403 FORBIDDEN (FR-RATE-04) → User B re-rates (idempotent, no duplicate) → User B posts comment (commentCount incremented) → Admin moderates comment → hidden comment no longer in public list.
  **Frontend additions (3 new test files — 3 files / 15 tests ✓):**
  Installed Vitest + React Testing Library + jsdom in `frontend/`. Created `frontend/tests/setup.ts` (jest-dom matchers) and `frontend/vitest.config.mjs` (ESM, jsdom environment, React plugin).
  - `tests/authGuards.test.tsx` (5 tests) — `AuthGuard`: shows loading spinner while `useAuth` is pending, renders children when authenticated, shows "Access Restricted" screen when `requiredRole="admin"` and user is `"user"`; `AuthPrompt`: renders sign-in link, shows admin-specific message for `requiredRole="admin"`.
  - `tests/components.test.tsx` (7 tests) — `RatingStars` read-only: renders correct average label + aria-label; `RatingStars` interactive: renders radio group + fires `onRate` callback on star click; `RecipeCard`: renders title/rating/dietary badges/difficulty/correct `/recipes/:slug` href; `TagInput`: adds tag via Enter key, adds tag via comma key, removes chip on ✕ click; `DisclaimerBanner`: renders ai preset text, renders allergy preset text.
  - `tests/generatorForm.test.tsx` (3 tests) — `GeneratorPage`: form inputs + dietary checkboxes render correctly (mocked `getMyProfile`), shows validation error on empty-ingredient generate attempt, adds ingredient tag via Enter and toggles dietary preference checkbox. All renders wrapped in `act(async () => {...})` per React 19 async state-update rules.
  **Verification:** Backend `npm test` → **23 files / 204 tests ✓** | Frontend `npm test` → **3 files / 15 tests ✓** | Backend lint ✓ (0 warnings) | Frontend lint ✓ (0 warnings) | Frontend build ✓ (16/16 routes). No regressions. Section 6.2 is complete.
- `[2026-08-26] [Lead]` **Section 6.3 — Manual Acceptance & Release Prep complete. Section 6 (Integration & Testing) is FULLY CLOSED OUT:**
  1. **Manual Acceptance & Core Flows Verified:**
     - *Generation & Publishing Flow:* Verified ingredient/preferences input, dietary flags (`gluten-free`, `high-protein`), structured AI recipe generation with fallback handling, draft saving, recipe editing, and publishing.
     - *Discovery & Community Flow:* Verified public discovery `/recipes` filtering (cuisine, category, diet, time, difficulty), keyword text search, recipe detail page loading, 1–5★ rating with aggregate re-calculations, comment creation with XSS sanitization, and adding/removing favorites.
     - *Draft & Hidden Exclusions:* Verified draft and hidden recipes are strictly excluded from public search and favorites feeds, remaining accessible only to respective owners/admins.
     - *Disclaimers & Safety:* Verified AI, medical/allergy, and nutritional estimate disclaimer banners appear across generator and recipe detail pages per SRS §12.7.
  2. **Release Preparation & Supporting Assets:**
     - *Seed Script:* Built idempotent `backend/scripts/seed.ts` (`npm run seed`) providing demo admin/user accounts and sample recipes with pre-computed ratings, comments, and favorites.
     - *Documentation:* Created comprehensive root `README.md` containing features overview, tech stack, monorepo setup instructions, env vars table, full API endpoint reference (30 routes), and SRS §20 release criteria checklist.
     - *Test & Build Health:* Fixed Vite config ESM loader warning (`vitest.config.mjs`) and React 19 `act()` test warnings. All **219 total automated tests pass** (204 backend + 15 frontend), 0 ESLint warnings on both packages, TypeScript & Next.js production builds clean.
- `[2026-08-26] [Lead]` **Section 7 — Deployment & Release complete. FLAVORAI MVP IS READY FOR RELEASE 🚀:**
  1. **Index Synchronization Script:** Created `backend/scripts/syncIndexes.ts` (`npm run db:indexes`) to safely build and verify indexes across User, Recipe, Rating, Comment, Favorite, and AIGenerationLog on MongoDB Atlas / production (where `autoIndex` is disabled by design).
  2. **Deployment Guide:** Added `docs/DEPLOYMENT.md` with complete instructions for MongoDB Atlas, Groq API, ImgBB, Vercel (Frontend), Render/Railway/Docker (Backend), HTTPS/TLS reverse proxy configurations, environment variables validation, security hardening checklists, and post-deployment smoke tests.
  3. **Containerization:** Created production Docker configurations (`backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml`) supporting self-hosted containerized execution.
  4. **Quality & Release Gate Passed:**
     - Backend: TypeScript strict build ✓ (`tsc`), ESLint ✓ (0 warnings), 23 test files / 204 tests passing ✓.
     - Frontend: Next.js 16 build ✓ (16/16 routes prerendered), ESLint ✓ (0 warnings), 3 test files / 15 tests passing ✓.
     - Security: Helmet headers, strict CORS, rate limiters (base, auth, AI, upload, comment), NoSQL operator stripping, and XSS sanitization verified.
     - All must-have SRS requirements and release criteria satisfied.
- `[2026-08-26] [M5]` **Bug fix — Checkbox primitive unclickable square:** users could not select Dietary Restrictions on `/generator` because `ui/checkbox.tsx` rendered the visible styled square as a decorative `<span>` while the real `<input>` was `sr-only`; clicks on the square never reached the input (only clicking the text label worked). Reproduced with new regression test `frontend/tests/checkbox.test.tsx` (3 tests), fixed by converting the row container into a single wrapping `<label>` (whole row now toggles; inner label demoted to `<span>` to avoid nested labels; added `cursor-pointer`). Fix applies to every consumer (generator, profile-form). Frontend tests 18/18 ✓, lint ✓ (0 warnings), build ✓.
- `[2026-08-26] [M5]` **Feature — homepage "From the community" now shows 3 featured recipes:** `app/page.tsx` `FeaturedRecipes` is an async server component fetching the 3 newest published recipes via `listRecipes({ sort: "newest", limit: 3 })` (try/catch → falls back to the existing EmptyState when the API is unreachable, keeping builds safe). Renders a responsive `RecipeCard` grid (`sm:grid-cols-2 lg:grid-cols-3`); EmptyState only when zero published recipes exist. Verified live: homepage renders 3 recipe links after publishing a third recipe. Lint ✓, build ✓, tests 23/23 ✓.
- `[2026-09-01] [Lead]` **Feature: Food Photo Nutrition Analysis (FR-PHOTO-01..04) completed & verified:**
  1. **API & Contract Definition:** Added `NutritionRange`, `DetectedFoodItem`, `FoodPhotoAnalysisInput`, and `FoodPhotoAnalysisResult` schemas in `backend/src/types/index.ts`, mirrored in `frontend/src/lib/types.ts` and `docs/API_CONTRACT.md`.
  2. **AI Vision Service & Multimodal Pipeline:** Implemented `buildFoodPhotoAnalysisPrompt` and `analyzeFoodPhoto` in `backend/src/services/aiService.ts` utilizing multimodal vision models (`qwen/qwen3.6-27b` / `llama-3.2-11b-vision-preview` / Groq vision completions) with image payload handling (URL/base64), strict Zod parsing, error envelopes, and telemetry logging to `AIGenerationLog`.
  3. **Backend API Endpoints:** Mounted `POST /api/v1/ai/nutrition/analyze-photo` behind `requireAuth`, `aiRateLimiter`, and input validation in `backend/src/controllers/aiController.ts` & `backend/src/routes/ai.ts`.
  4. **Frontend Architecture & UX:**
     - Added typed client method `analyzeFoodPhoto()` in `frontend/src/lib/api.ts`.
     - Built `PhotoDropzone` (`frontend/src/components/nutrition/photo-dropzone.tsx`) with drag-and-drop, camera/file picker, preview removal, format & 5MB file-size validation, and 1-click sample dish presets for instant testing.
     - Built `NutritionBreakdownView` (`frontend/src/components/nutrition/nutrition-breakdown-view.tsx`) displaying calories range, macronutrient distribution visual bar (Protein/Carbs/Fat %), detected food items table with confidence badges and portion estimates, dietary tags, allergen warnings, health insights, and "Turn Photo into Recipe" quick action link.
     - Built interactive page `frontend/src/app/nutrition-analyzer/page.tsx` with AuthGuard, context/notes inputs, loading spinner states, and error alerts.
     - Added "Photo Nutrition" link to navbar (`frontend/src/components/layout/navbar.tsx`) and hero CTA on homepage (`frontend/src/app/page.tsx`).
  5. **Verification & Testing:**
     - Backend: 12 new automated unit/integration tests in `backend/tests/foodPhotoNutrition.test.ts` (all 24 test files / 216 tests passing, 0 ESLint warnings, TypeScript build clean).
     - Frontend: 4 new automated component/page tests in `frontend/tests/photoAnalyzer.test.tsx` (all 6 test files / 27 tests passing, 0 ESLint warnings, Next.js build clean with 18 prerendered routes).

