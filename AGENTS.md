# FlavorAI — Project Rules

## Project Overview

FlavorAI is a smart recipe generator & food-sharing platform. Users enter
ingredients they already have, set dietary/nutritional preferences, and receive
AI-generated structured recipes. They can also publish, search, rate, review,
comment on, and favorite community recipes.

Source of truth: `FlavorAI - SRS.md` (requirements) and `IMPLEMENTATION_PLAN.md`
(architecture + delivery plan). Read both before making architectural decisions.

**MVP priority order:** authentication → recipe CRUD → AI generation →
search/discovery → ratings/comments/favorites → nutrition & pantry refinement.
Taste-profile recommendations and food-photo nutrition analysis are post-MVP.

## Tech Stack & Monorepo Layout

Two top-level folders, no shared workspace build:

- `frontend/` — Next.js (App Router), TypeScript, Tailwind CSS, Better Auth, Gravity UI Icons
- `backend/` — Express.js REST API, TypeScript, MongoDB + Mongoose, Zod, JWT middleware

External services: Groq AI API (recipe generation, flavor pairing), ImgBB (image
hosting), MongoDB Atlas (or equivalent).

## Architecture & Conventions

- Request flow: `Next.js UI → HTTPS REST API → Zod validation → auth/authorization → service layer → MongoDB or AI/nutrition service → normalized response`
- Versioned base path: `/api/v1`
- JSON bodies except multipart image uploads
- Consistent error format: `{ status, code, safeMessage, validation? }` with correct HTTP status codes
- Pagination: `page` / `limit`
- Separate routes/controllers, services, data models, validation schemas, and provider adapters

## Authentication Bridge (CRITICAL)

- Better Auth manages user-facing auth/session on the client.
- Express API receives signed Bearer JWTs; middleware verifies signature,
  extracts user context, and enforces role/ownership authorization.
- Reject expired, malformed, or unauthorized tokens.
- Secrets/refresh credentials must never reach browser JS; prefer secure,
  HTTP-only, SameSite cookies where the deployment allows.
- Passwords (when used) are hashed; never returned in plain text.
- Note: JWT issuer, audience, signing/verification, cookie policy, expiration,
  refresh, and logout must be defined before implementation (SRS risk item).

## AI Integration Rules

- Model options: `llama-3.3-70b-versatile` / `mixtral-8x7b-32768` via Groq API.
- Use constrained prompts enforcing strict JSON schema output.
- Server-side Zod validation on ALL AI output; invalid/incomplete output must
  NOT be stored (FR-AI-07).
- On provider failure/timeout, return a safe, retryable error — never leak
  internal errors (FR-AI-08).
- Target completion within 30s with visible progress and a defined timeout.
- Pantry matching: compute `usedIngredients` vs `missingIngredients`.
- Respect dietary + allergy constraints in generated content and flavor pairings.

## Domain Rules (Business Rules)

1. Only authenticated users can generate, save, publish, rate, comment, or favorite.
2. Only the recipe owner or an admin can edit, unpublish, or delete a recipe.
   Enforce on the backend — hiding UI buttons is NOT sufficient authorization (FR-RECIPE-06).
3. Drafts are visible only to their owner and authorized admins.
4. Only published, non-hidden recipes appear in public discovery.
5. Ratings are integers 1–5; one active rating per user per recipe; re-rating updates,
   never duplicates; owner may not rate own recipe (recommended MVP rule).
6. Favorites are unique per user per recipe.
7. Dietary/allergen compliance is never guaranteed from AI output; warnings are mandatory.
8. Never expose another user's private profile, drafts, favorites, or tokens.
9. Moderated/deleted content must not remain publicly searchable.

## Data Models

- **User:** name, email, avatar, bio, provider identifiers, role (`user`|`admin`),
  dietary preferences, allergies, disliked ingredients, nutrition goals, timestamps
- **Recipe:** owner, source (`manual`|`ai`), title, slug, summary, image, ingredients
  (name/qty/unit/notes/pantry-match), ordered steps, times, servings, difficulty,
  cuisine, category, tags, dietary labels, allergen warnings, nutrition estimate,
  status (`draft`|`published`|`hidden`), aggregate rating/favorite/comment counts, timestamps
- **Rating:** unique compound index `(recipeId, userId)`
- **Comment:** body, moderation status, timestamps
- **Favorite:** unique compound index `(recipeId, userId)`
- **AIGenerationLog:** user, inputs, provider/model, status, latency, error category, timestamps

Indexes: unique email/provider identity, unique slug, text index on
`title` + `summary` + `ingredients.name`, status+published date, owner+created
date, rating/favorite uniqueness, comment recipe+created date.

## API Endpoint Groups

- `/auth` — auth integration, session/token ops
- `/users` and `/users/me` — profile & preferences
- `/recipes` — CRUD, publishing, search, details
- `/ai/recipes/generate` — AI recipe generation
- `/ai/flavor-pairings` — flavor suggestions
- `/recipes/:id/ratings` — create/update/remove/summarize
- `/recipes/:id/comments` — comment/review ops
- `/favorites` — user's favorites
- `/admin` — protected moderation

## Security Requirements

- All production traffic over HTTPS; secrets in env config, never in source control.
- Validate ALL untrusted input with Zod.
- Mitigate XSS, injection, CSRF (cookie auth), insecure direct object references,
  and abusive request rates.
- Sanitize recipe and comment content before rendering.
- Rate limit auth, AI, comment, and upload endpoints.
- Validate image MIME type, extension, file size, and storage permissions.

## Frontend Requirements

- App Router pages: landing, `(auth)` sign-in/sign-up, generator, recipes list,
  recipe detail, recipe create/edit, dashboard, favorites, profile, admin.
- Components: Navbar, Footer, IngredientTagInput, RecipeCard, NutritionBadge,
  RatingStars, CommentSection, DisclaimerBanner.
- Design: food-focused, clean, mobile-first responsive Tailwind; glassmorphism
  accents; Gravity UI Icons; icons must never be the sole meaning carrier (WCAG 2.1 AA).
- Every form needs labels, validation messages, keyboard access, focus states,
  and loading/disabled states.
- Show useful empty, loading, success, and error states everywhere.

## Recipe Content Requirements

- Display estimated calories, protein, carbs, fat per serving when available.
- Label nutrition as estimates and state servings used; missing values show as
  "unavailable" — never fabricated.
- Show allergy/AI-accuracy disclaimers in generation AND recipe views.

## Testing & Verification

- Unit tests: Zod schemas, pantry matching, AI response parser.
- API integration tests: auth, recipe CRUD, ratings, comments, favorites, AI error handling.
- Frontend component/form tests: generator form, validation errors, auth states.
- E2E: sign-in → generate → save/publish → search → rate → comment → favorite.
- Manual: responsive + accessibility checks.
- Definition of done: client+server validation present, authorization enforced by
  API, tests pass, loading/empty/success/error handled, works on desktop + mobile,
  no critical/high defects open.

## Team Workflow with opencode

Team of 5 working in parallel. Roles/workstreams live in `TASKS.md`; API shapes
live in `docs/API_CONTRACT.md`. Every member opens opencode in `flavor-ai/` and
prompts it against these files — opencode reads AGENTS.md, TASKS.md, and the
contract automatically.

**General workflow**
1. Open opencode in the repo root.
2. Give a structured prompt: your workstream/task (from TASKS.md), what to build,
   which files, and how to verify.
3. opencode builds the code, runs tests, and ticks completed tasks in TASKS.md.
4. Commit on your own branch, push; Team Leader merges in order M1 → M2/M3/M4 → M5.

**Prompt template**
```
I'm [M#] working on Workstream [M# — name] from TASKS.md.
I'll follow docs/API_CONTRACT.md and AGENTS.md rules.
Build: [feature + FR refs]
Implement: [files to create/change]
Constraints: [ownership on backend, Zod on all input, etc.]
Verify: run [test/lint command] and report results.
When done, tick the completed tasks in TASKS.md and log a note.
```

**Per-member prompts**

- M1 — Backend Foundation: "I'm M1. Build the Express backend foundation per
  TASKS.md M1: `server.ts` with `/api/v1`, centralized error handler
  `{status, code, safeMessage, validation?}`, `config/db.ts` with auto-indexes,
  and all six Mongoose models with documented indexes. Then write
  `docs/API_CONTRACT.md` for every endpoint group. Verify with a health-check
  smoke test against MongoDB."
- M2 — Auth: "I'm M2. Build `middleware/auth.ts` (Bearer JWT verify → `req.user`,
  reject expired/malformed), auth + user controllers for `/auth` and `/users/me`,
  plus frontend `(auth)/sign-in` and `sign-up` pages via Better Auth. Enforce
  FR-AUTH-04/05/06/07. Verify the JWT bridge end-to-end against the M1 API."
- M3 — Recipes & AI: "I'm M3. Build `recipeController` (CRUD + draft/publish,
  ownership enforced), the Groq `aiService` with strict JSON prompts, Zod
  validation of AI output (never store invalid — FR-AI-07), pantry matching
  (used vs missing), flavor pairing, and ImgBB `imageService`. Build the
  generator page. Verify with unit tests for pantry matching and the AI parser."
- M4 — Community: "I'm M4. Build rating (1–5, one per user, owner can't rate
  own), comment (sanitized, length-validated), favorite (unique), and admin
  moderation controllers per FR-RATE/COMMENT/FAV/ADMIN. Ensure draft/hidden
  recipes never appear in public search. Build discovery, favorites, admin pages."
- M5 — Frontend Lead: "I'm M5. Build the global layout (glassmorphism theme,
  Navbar, Footer), landing page, and profile page. Ensure every form has labels,
  validation, focus states, loading/disabled states, and empty/error states
  (NFR-UX-02/05). WCAG 2.1 AA, responsive ≥320px."

**Pointers**
- One feature per prompt for clean diffs; let opencode run tests after each chunk.
- Always end a task by updating TASKS.md (living roadmap).
- If the contract is missing or changes, read `docs/API_CONTRACT.md` first.

## Workflow

- After saving any opencode config change, remind the user to restart opencode.
- Follow the existing file/folder conventions described in IMPLEMENTATION_PLAN.md.
- Do not commit unless explicitly asked.