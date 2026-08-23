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
- [ ] `aiService.ts` — Groq adapter (`openai/gpt-oss-120b` / `qwen/qwen3.6-27b`)
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
- [ ] `ratingController.ts` — create/update/remove; integer 1–5; one per user per recipe; owner can't rate own (FR-RATE-01..05)
- [ ] Aggregate rating recalculation after changes
- [ ] `commentController.ts` — add/list/delete; length validation + sanitization; owner deletion (FR-COMMENT-01..05)
- [ ] `favoriteController.ts` — add/list/remove; uniqueness enforced; private list (FR-FAV-01..04)
- [ ] `adminController.ts` — role-protected moderation of recipes/comments, actions logged (FR-ADMIN-01..04)
- [ ] Draft/hidden recipes excluded from public discovery (Business Rules 3/4/10)
- [ ] Sanitize content before render; XSS/injection/IDOR/CSRF mitigations (NFR-SEC-05/06)
- [ ] Rate limiting on comment endpoints (NFR-SEC-07)

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
- `[2026-08-23] [M5]` **M5 Steps 0–2 of 7 done on `feature/m5-frontend`:** design-system foundation in `globals.css` (Tailwind v4 `@theme` tokens — warm off-white/orange/green/charcoal palette per product brief, focus-visible rings, radius tokens, reduced-motion support; auto dark scheme dropped intentionally), root layout shell (FlavorAI metadata + title template, skip-to-content link, semantic landmarks), glass-effect `Navbar.tsx` (responsive mobile menu: Escape close, `aria-expanded`, active-route pills), `Footer.tsx` with site-wide AI/nutrition/allergy disclaimer (§12.7). Installed `@gravity-ui/icons`. Decisions: "glassmorphism" implemented as subtle blur on navbar only (brief asks for clean/minimal elsewhere); added `primary-deep` token so solid-button hovers keep white text ≥4.5:1 AA. Frontend build ✓ lint ✓ 0 warnings. Nav links intentionally target canonical routes (`/generator`, `/recipes`, `/favorites`, `/profile`, `/sign-in`) that 404 until dependent pages land (Steps 4–6 / M2–M4). Known blocker flagged to Lead: stray untracked root `package.json`/lockfile makes Next.js warn about workspace-root inference.
- `[2026-08-23] [M5]` **M5 Step 3 of 7 done (UI primitives):** added `frontend/src/components/ui/*` — `Button` (+ exported `buttonStyles` for link-styled CTAs; loading/disabled with `aria-busy`), `Spinner`, field system (`field.tsx` label/hint/error helpers + `Input`/`Textarea`/`Select`/`Checkbox`) with `useId`-wired `htmlFor`/`aria-describedby`/`aria-invalid`, `role="alert"` validation messages, required-marker with sr-only "(required)", visible text alongside every icon (NFR-UX-04); display set: `Card`, `Badge`, `Alert` (info/success/warning/danger, `role="status"` vs `"alert"`), `DisclaimerBanner` presets (`ai`/`nutrition`/`allergy` — §12.7 copy), `EmptyState`, `ErrorState`, `LoadingState` (`role="status"`), `Skeleton`. Barrel `ui/index.ts`. Added tokens: `secondary-deep #166534` (green hover AA) + `danger-strong #B91C1C` (danger text on tinted bg ≥4.5:1). Build ✓ lint ✓ 0 warnings. Forms/states/responsive M5 boxes remain unticked until proven in real pages (Step 6+); next: Step 4 landing page.