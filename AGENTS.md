# FlavorAI — Project Rules

FlavorAI is a smart recipe generator & food-sharing platform (Next.js frontend +
Express API). Source of truth: `FlavorAI - SRS.md` (requirements),
`IMPLEMENTATION_PLAN.md` (architecture), `docs/API_CONTRACT.md` (frozen API
shapes), `TASKS.md` (living roadmap — tick boxes as work completes).

## Repo Layout

Monorepo with **two independent packages, no shared workspace build**:

- `frontend/` — Next.js (App Router, TS, Tailwind v4, Better Auth, Gravity UI Icons)
- `backend/` — Express 4 REST API (TS strict, ESM/NodeNext, Mongoose, Zod, JWT)

Own scripts per package. Run commands from the package dir — there is no root
`package.json`.

## Commands

Backend (`backend/`):

- `npm run dev` — tsx watch, loads `.env`
- `npm run build` — `tsc` (strict)
- `npm run lint` — ESLint, **0 warnings required** (`--max-warnings=0`)
- `npm test` — Vitest (unit + supertest), tests in `backend/tests/`
- `npm run format` / `format:check` — Prettier

Frontend (`frontend/`): `npm run dev`, `npm run build`, `npm run lint` (next).

Verification order that matters: `npm run build` → `npm run lint` → `npm test`.
For a single test file: `npx vitest run tests/types.test.ts`.

## Setup Gotchas

- **`backend/.env` is required before ANY backend command** (incl. `npm test`).
  `src/config/env.ts` validates env with Zod and calls `process.exit(1)` at import
  time if anything is missing/invalid — so a fresh clone with no `.env` hard-crashes.
  Copy `backend/.env.example` → `.env`; it holds the real MongoDB Atlas URI.
  `.env` is gitignored; never commit or log it.
- Node `>=20`. NodeNext ESM: **relative imports need a `.js` extension**
  (e.g. `import { env } from "./config/env.js"`). Dropping it breaks `npm run build`.
- Frontend: `NEXT_PUBLIC_API_URL` (default `http://localhost:4000/api/v1`) via
  `frontend/.env.local`.

## Architecture Notes

- **The API contract is FROZEN.** `backend/src/types/index.ts` is the executable
  source of truth (Zod schemas + enums + DTOs); `docs/API_CONTRACT.md` mirrors it.
  Do NOT change shapes without Team Lead sign-off. Build new controllers against
  these schemas, don't re-declare types.
- Only M1 exists so far: server, DB config, all 6 Mongoose models (User, Recipe,
  Rating, Comment, Favorite, AIGenerationLog) with indexes, error handler, rate
  limit, `/api/v1/health`. **Controllers/services for auth, recipes, AI, ratings,
  comments, favorites, admin are not built yet** — M2–M5 mount their routers in
  `backend/src/routes/v1.ts`.
- Every response must use the error envelope `{ status, code, safeMessage, validation? }`.
  `src/middleware/errorHandler.ts` maps `ZodError` → 400 and `ApiError` → its status.
  **Known gap:** Mongoose duplicate-key (E11000) is NOT mapped (currently → 500
  INTERNAL_ERROR); map it to 409 `CONFLICT` when adding unique-constraint writes.
- `Recipe.totalTimeMinutes` is computed in a `pre("save")` hook only — not on
  `findOneAndUpdate`. Recompute in services when editing recipes.
- Indexes already on models: unique email + sparse unique providerId (User), unique
  slug + text index on `title/summary/ingredients.name` + status/publishedAt +
  owner/createdAt (Recipe), unique `(recipe,user)` compound (Rating, Favorite),
  recipe+createdAt (Comment), user+createdAt (AIGenerationLog).
- `autoIndex` is disabled in production (`config/db.ts`) — deploy step must create
  indexes (e.g. `syncIndexes()`) before release.

## Domain Rules (must enforce in backend)

1. Only authenticated users generate/save/publish/rate/comment/favorite.
2. Only recipe owner or admin edits/unpublishes/deletes a recipe — enforce in
   backend, never just by hiding UI (FR-RECIPE-06).
3. Drafts visible only to owner + admins; only published, non-hidden recipes in
   public discovery.
4. Ratings: integer 1–5, one active per user per recipe, re-rate updates (never
   duplicates), owner cannot rate own.
5. Favorites: unique per user per recipe.
6. Allergen/dietary compliance is never guaranteed by AI output — warnings mandatory.
7. Never expose another user's private profile, drafts, favorites, or tokens.
8. Moderated/deleted content must not remain publicly searchable.

## Auth Bridge (CRITICAL)

Better Auth handles client auth/session; the Express API receives signed Bearer
JWTs. `middleware/auth.ts` verifies signature → `req.user`, rejects
expired/malformed/unauthorized. Secrets never reach browser JS; prefer secure,
HTTP-only, SameSite cookies. Passwords (if used) hashed, never returned.
Issuer/audience/expiry/refresh/logout policy per SRS §9.4 (to be finalized in M2).

## AI Rules

- Groq models `llama-3.3-70b-versatile` / `mixtral-8x7b-32768`. Constrained prompts
  enforcing strict JSON; **server-side Zod-validate ALL AI output — invalid output
  must NOT be stored** (FR-AI-07). On provider failure/timeout return a safe,
  retryable error, never leak internals (FR-AI-08). Timeout ≤30s. Pantry matching:
  `usedIngredients` vs `missingIngredients`. Respect dietary + allergy constraints.

## Team Workflow with opencode

5 members, parallel. Roles/tasks live in `TASKS.md`; API shapes in
`docs/API_CONTRACT.md`. Each member opens opencode in the repo root and prompts
against these files (opencode reads AGENTS.md, TASKS.md, and the contract
automatically). Members work on `feature/<name>` branches off `develop`; Lead
merges in order **M1 → M2/M3/M4 → M5**. End every task by ticking TASKS.md and
logging a dated note.

**Prompt template:**

```
I'm [M#] working on Workstream [M# — name] from TASKS.md.
I'll follow docs/API_CONTRACT.md and AGENTS.md rules.
Build: [feature + FR refs]
Implement: [files to create/change]
Constraints: [ownership on backend, Zod on all input, etc.]
Verify: run [test/lint command] and report results.
When done, tick the completed tasks in TASKS.md and log a note.
```

Per-member prompts (M1 done): M2 — auth bridge (`middleware/auth.ts`, auth/user
controllers, sign-in/sign-up pages, FR-AUTH-04..07). M3 — recipe CRUD + Groq
`aiService` + Zod-validated output + pantry matching + flavor pairing + ImgBB
`imageService` + generator page. M4 — ratings/comments/favorites/admin
controllers, draft/hidden exclusion from search, discovery/favorites/admin pages.
M5 — global layout (glassmorphism), landing + profile pages, all form/states +
WCAG 2.1 AA, responsive ≥320px.

## Workflow Rules

- Update TASKS.md (living roadmap) when you complete work; log dated notes.
- Do not commit unless explicitly asked.
- After saving any opencode config change, remind the user to restart opencode.
- Keep `backend/src/types/index.ts` and `docs/API_CONTRACT.md` in sync.