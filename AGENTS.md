# FlavorAI — Project Rules

FlavorAI is a smart recipe generator & food-sharing platform (Next.js frontend +
Express API). Source of truth: `FlavorAI - SRS.md` (requirements),
`IMPLEMENTATION_PLAN.md` (architecture), `docs/API_CONTRACT.md` (frozen API
shapes), `TASKS.md` (living roadmap — tick boxes as work completes).

## Repo Layout

Monorepo, **two independent packages** (no shared workspace build, no root
`package.json`). Run commands from the package dir.

- `frontend/` — Next.js App Router, TS strict, Tailwind v4 CSS-first (`@theme`
  tokens in `src/app/globals.css`), **React Compiler enabled**, `@gravity-ui/icons`.
  Routes in `src/app`, UI primitives in `src/components/ui` (barrel `index.ts`),
  typed API client in `src/lib/{api,types}.ts`.
- `backend/` — Express 4 REST API, TS strict, ESM/NodeNext, Mongoose, Zod, JWT.
  Routers mount in `src/routes/v1.ts`; handlers in `src/controllers`, logic in
  `src/services` (`aiService`, `imageService`); tests in `tests/`.

## Commands

Backend (`backend/`):

- `npm run dev` — tsx watch, loads `.env`
- `npm run build` — `tsc` (strict)
- `npm run lint` — ESLint, **0 warnings required** (`--max-warnings=0`)
- `npm test` — Vitest (unit + supertest), tests in `backend/tests/`
- `npm run format` / `format:check` — Prettier

Frontend (`frontend/`): `npm run dev`, `npm run build`, `npm run lint`.

Verification order that matters: `npm run build` → `npm run lint` → `npm test`.
For a single test file: `npx vitest run tests/types.test.ts`.

## Setup Gotchas

- **`backend/.env` is required before ANY backend command** (incl. `npm test`).
  `src/config/env.ts` validates env with Zod and calls `process.exit(1)` at import
  time if anything is missing/invalid — so a fresh clone with no `.env` hard-crashes.
  Copy `backend/.env.example` → `.env`. `.env` is gitignored; never commit or log it.
- Node `>=20`. NodeNext ESM: **relative imports need a `.js` extension**
  (e.g. `import { env } from "./config/env.js"`). Dropping it breaks `npm run build`.
- Frontend: `NEXT_PUBLIC_API_URL` (default `http://localhost:4000/api/v1`) via
  `frontend/.env.local`.

## Architecture Notes

- **The API contract is FROZEN.** `backend/src/types/index.ts` is the executable
  source of truth (Zod schemas + enums + DTOs); `docs/API_CONTRACT.md` mirrors it,
  and `frontend/src/lib/types.ts` mirrors both. Do NOT change shapes without Team
  Lead sign-off — keep all three in sync when a change is approved.
- All six domains are implemented (M1–M5 merged through M4): auth/user/recipe/AI/
  ratings/comments/favorites/admin/upload controllers + routers under
  `routes/v1.ts`, plus middleware `auth.ts` (JWT bridge), `validate.ts` (Zod),
  `sanitizeInput.ts`, `rateLimit.ts` / `rateLimiters.ts`. Remaining repo work is
  integration/testing/deployment — check TASKS.md for live status.
- Every response must use the error envelope `{ status, code, safeMessage, validation? }`.
  `src/middleware/errorHandler.ts` maps `ZodError` → 400, `ApiError` → its status, and
  Mongoose duplicate-key (E11000) → 409 `CONFLICT`.
- `Recipe.totalTimeMinutes` is computed in a `pre("save")` hook only — not on
  `findOneAndUpdate`. Recompute in services when editing recipes.
- Indexes already on models: unique email + sparse unique providerId (User), unique
  slug + text index on `title/summary/ingredients.name` + status/publishedAt +
  owner/createdAt (Recipe), unique `(recipe,user)` compound (Rating, Favorite),
  recipe+createdAt (Comment), user+createdAt (AIGenerationLog).
- `autoIndex` is disabled in production (`config/db.ts`) — deploy step must create
  indexes (e.g. `syncIndexes()`) before release.

## Frontend Gotchas (each one broke a real build)

- **React Compiler + react-hooks v7 forbid setState synchronously reachable from
  effect bodies** (even via called helper functions). For fetch-on-mount, set state
  inside promise callbacks (`.then/.catch`), never via an async wrapper called from
  the effect body. Lint fails the build otherwise.
- **RSC boundary:** plain functions/styles cannot be exported from `"use client"`
  files and used by server components. Server-safe style helpers live in their own
  module (e.g. `ui/button-styles.ts`), not inside client component files.
- `next.config.ts` pins `turbopack.root` — do not remove. Without it Next.js
  mis-infers the workspace root and scatters `.next` caches (e.g. a stray nested
  `frontend/frontend/.next`). Such dirs are generated junk: safe to delete once no
  node process holds them; eslint ignores `**/.next/**` at any depth.
- Contract nuance: profile/preferences PATCH must send the **FULL**
  `DietaryPreferences` object — omitted arrays reset to `[]` server-side.
- Client `ApiError` (`lib/api.ts`) exposes the envelope's safe text as `.message`;
  never surface raw network/provider errors in UI.
- Gravity icons: import names are non-obvious (`Xmark`, `Person`, `House`,
  `TriangleExclamation` — no `X`/`User`/`Home` aliases). Check the package exports
  before importing.
- Accessibility AA convention: small text sitting on solid orange/green fills uses
  `-strong`/`-deep` token variants; pure `primary`/`secondary` are reserved for
  large text and accents. Icons never carry meaning alone (visible text or
  accessible name required).

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
JWTs. `middleware/auth.ts` verifies signature → `req.user`, rejecting
expired/malformed/unauthorized tokens. Secrets never reach browser JS; prefer
secure, HTTP-only, SameSite cookies. Passwords (if used) hashed, never returned.
Issuer/audience/expiry/refresh/logout policy per SRS §9.4.

## AI Rules

- Groq models `openai/gpt-oss-120b` / `qwen/qwen3.6-27b`. Constrained prompts
  enforcing strict JSON; **server-side Zod-validate ALL AI output — invalid output
  must NOT be stored** (FR-AI-07). On provider failure/timeout return a safe,
  retryable error, never leak internals (FR-AI-08). Timeout ≤30s. Pantry matching:
  `usedIngredients` vs `missingIngredients`. Respect dietary + allergy constraints.

## Team Workflow with opencode

5 members, parallel workstreams owned per TASKS.md; API shapes in
`docs/API_CONTRACT.md`. Members work on `feature/<name>` branches off `develop`;
Lead merges in order **M1 → M2/M3/M4 → M5**. When prompted, expect the member to
state their workstream, target files, constraints, and a verification command.
End every task by ticking TASKS.md and logging a dated `[YYYY-MM-DD] [M#]` note.
Commit style (match history): conventional commits scoped by workstream, e.g.
`feat(m5): …`, `chore(backend): …`.

## Workflow Rules

- Update TASKS.md (living roadmap) when you complete work; log dated notes.
- Do not commit unless explicitly asked.
- After saving any opencode config change, remind the user to restart opencode.
- Keep `backend/src/types/index.ts`, `docs/API_CONTRACT.md`, and
  `frontend/src/lib/types.ts` in sync.
