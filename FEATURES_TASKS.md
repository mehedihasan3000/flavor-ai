# FlavorAI — FEATURES_TASKS.md (Smart Meal Planning + Smart Grocery + Real Pantry)

> **Team task plan for 3 developers + Team Leader, using opencode + Muse Spark 1.3 Free.**
> Source of truth for scope: `FEATURES.md`, `FEATURES_IMPLEMENT_BREAKDOWN.md`, `ONE_MASTER_IMPLEMENTATION.md`.
> Architecture rules: `AGENTS.md` (frozen contract, auth, rate limits, UI conventions).
> **Do not start coding before reading all four files above.**
> **Revision note:** code-review findings (route-root inconsistency, `use` atomicity, param
> validation, status/flag mix, recalculate key, C→A ownership, imperial units, missing indexes,
> null guards, swap ambiguity, budget seam, N+1, sanitization, DoD warnings) are fixed inline below.

The three features are **one connected workflow**, not three modules:

```text
Real Pantry → Smart Meal Plan → Smart Grocery List → Buy/Cook → Pantry updates
```

## 0. How to work (all members — read first)

### 0.1 Muse Spark 1.3 Free discipline (small context model)

- **One checkbox at a time.** Finish → `build` → `lint` → `test` → tick → next.
  Backend: `npm run build` → `npm run lint` → `npm test` (single file: `npx vitest run tests/<file>.test.ts`).
  Frontend: `npm run build` → `npm run lint` → `npm test` (`vitest run --config vitest.config.mjs`).
- Keep opencode prompts **small and scoped**: name the exact file + the single task, e.g.
  *"In `backend/src/models/PantryItem.ts`, create the Mongoose model per §A1 below. Do not touch any other file."*
- Always **read before writing**; never refactor unrelated code; never use `any`; never invent filenames outside this plan.
- AI (Groq) is for **reasoning/ranking only**. All arithmetic (grocery subtraction, consolidation,
  nutrition totals, ownership checks) is **deterministic application code** — never ask the LLM to compute it.

### 0.2 Branches & ownership (prevents merge conflicts)

- Branches off `develop`: `feature/pantry` (Dev A), `feature/mealplan` (Dev B), `feature/grocery` (Dev C).
- **Exclusive-ownership rule:** each new file has exactly one owner (see §1.3). Never create a file owned by another workstream.
- **Shared files are Lead-only:** `backend/src/routes/v1.ts`, `backend/src/server.ts`,
  `backend/scripts/syncIndexes.ts`, `frontend/src/components/layout/navbar.tsx`,
  `docs/API_CONTRACT.md` structure.
- **Draft endpoint docs:** devs do NOT edit `docs/API_CONTRACT.md` directly. Each workstream writes its
  endpoint proposal as code comments in its own controller + a subsection in the **§9 Draft API appendix
  of this file** (`§9A` / `§9B` / `§9C`). The **Lead moves them into the contract** at integration.
  No other scratch files — nothing stray/untracked.
- **Append-only shared types:** `backend/src/types/index.ts` and `frontend/src/lib/types.ts` /
  `frontend/src/lib/api.ts` — each dev appends **only inside their own marked section**
  (`// ─── Pantry (Dev A) ───` / `MealPlan (Dev B)` / `Grocery (Dev C)`).
  **Lead Phase-0 task:** create these empty marker sections first, so devs never edit the same lines.
  Lead resolves any overlap.

### 0.3 Non-negotiable backend rules (from AGENTS.md — violations break the build)

1. ESM imports need `.js` extension (`./config/env.js`).
2. `authenticate()` looks users up by **`providerId`**, not `_id` — test helpers must set `providerId` and sign `sub` as that value, else authed requests silently 401.
3. `Model.aggregate()` **bypasses Mongoose auto-casting**: cast ids explicitly (`new Types.ObjectId(id)`) in `$match`.
4. Never trust client `userId` — scope every query to `req.user.id`; return the frozen error envelope `{ status, code, safeMessage, validation? }`.
5. New write routes: `requireAuth`; public reads only where the plan says so. Reuse `aiRateLimiter` (10/15min) for AI routes.
   Expensive deterministic routes (`generate`/`recalculate`/`purchased-to-pantry`) stay on the base limiter (300/15min) in v1 — documented, no new limiter without Lead approval.
6. Zod-validate **all** AI output server-side; discard hallucinated `recipeId`s outside the candidate pool (taste-match pattern in `aiService.ts`).
7. **Validate every `:id` route param** with `validateParams(ObjectIdString)` (`utils/params.ts`): malformed ids → 400
   `VALIDATION_ERROR`. Without this, Mongoose `CastError` falls through `errorHandler.ts` to 500 `INTERNAL_ERROR` and the "invalid ids 400" tests fail.
8. **Cross-user semantics are frozen to 404** (`NOT_FOUND`, never 403) so responses don't oracle resource existence —
   same pattern as `requirePublishedRecipe`. **Admins have no override** on pantry/meal-plan/grocery routes (unlike recipes/comments); isolation tests assert 404 for other users including admins.
9. **Sanitize all free-text input** (`name`, `notes`, manual grocery names) with `utils/sanitize.ts` **before** length
   validation — same as comment bodies — so no HTML/markup is ever stored or rendered in checklists/grids.
10. **Single-query loads:** never `for (id) findById` a meal plan's recipes (21 meals = 21 queries). One
    `Recipe.find({ _id: { $in: ids }, status: "published" })`, then map. Explicit `new Types.ObjectId()` in any `$match`.

### 0.4 Non-negotiable frontend rules

1. React Compiler: **no setState synchronously reachable from effect bodies.** Set state only inside
   `.then/.catch` callbacks, `Promise.resolve().then()` microtasks, or `useState` initializers —
   the exact patterns in `generator/page.tsx` and `navbar.tsx`. Fetch-on-mount follows `profile-form.tsx`.
2. `/grocery?plan=<id>` **pre-selects the plan in the generate form only** — generation fires on button click,
   never auto-generates on mount (auto-generate would force a setState-in-effect violation).
3. New pages behind `AuthGuard`; guest actions behind `AuthPrompt`. Token auto-attaches from `localStorage["flavorai_auth_token"]`; pass `token: null` for guest requests.
4. Reuse `components/ui/*` + Tailwind semantic tokens; follow `assistant`/`diet-plan` pages as the reference for new AI pages (loading/error/empty states everywhere, mobile ≥320px).
5. Gravity icons: check exports first (`Xmark`, `Person`, `House`, `TriangleExclamation`). Icons never carry meaning alone.
6. **Do NOT edit `navbar.tsx`** — Lead adds `/pantry`, `/meal-plan`, `/grocery` links at integration.

---

## 1. Phase 0 — Contract Freeze (Team Leader, blocking; devs wait for this)

Lead produces the frozen shapes **before** Dev A/B/C write feature code. Keep it small: enums + DTO field lists + route table only.

### 1.1 Shared vocabulary (frozen, reused by all three workstreams)

- [x] **Categories** (pantry + grocery share one list): `vegetables | fruits | meat | dairy | grains | spices | frozen | snacks | other`.
      `frozen` is a **storage form, not an ingredient kind** — categorize by kind first (`frozen peas` → `vegetables`).
      `frozen` is used only when no kind is known. `categorize(name)` takes the item name (+ optional keyword hints),
      never a recipe category (recipe `category` is `main-course|soup|…` — a different axis, no mapping defined).
- [x] **Units:** free string, max 30 chars. **Auto-merge allowlist is metric + kitchen only:**
      `g | kg | ml | l | pcs | tbsp | tsp | cup`. Anything else (incl. `oz | lb` and unknown strings) is
      **display-only, never auto-merged** — separate lines are correct, over-buying from a bad conversion is not.
- [x] **Unit conversion table** (Dev C consumes, Dev A owns — see §1.3): `g↔kg`, `ml↔l` (factor 1000),
      `tsp↔tbsp↔cup↔ml` (`1 tbsp = 3 tsp`, `1 cup = 16 tbsp = 240 ml`), `cup↔l` via ml. `convertQuantity` returns
      `null` for incompatible pairs; callers keep separate lines on `null`. `pcs` converts to nothing.
- [x] **Meal types:** reuse existing `MEAL_TYPE` (`breakfast | lunch | dinner | snack | dessert`).
- [x] **Dates:** API accepts `YYYY-MM-DD` strings, interpreted as **UTC midnight**. For AI-generated plans,
      `weekEndDate = weekStartDate + days − 1` (server-computed, client may omit `weekEndDate` in that flow).
      Manual create validates `weekEndDate > weekStartDate`; every meal `date` must fall inside the range.
- [x] **Servings are 1–20 everywhere** (meal `servings`, AI `servings`, matching `Recipe.servings 1–20`).
- [x] **`ingredientKey` normalization — owned by Dev A, consumed by B and C (never reimplemented):**
      `backend/src/utils/ingredientKey.ts` → `normalizeIngredientKey(name: string): string`
      (lowercase, trim, strip punctuation, naive plural-fold e.g. `tomatoes→tomato`; must NOT merge
      `chicken breast` ≠ `chicken thigh`). B and C import it.
- [x] **`units.ts` — owned by Dev A (foundation), imported by C** (dependency direction is A→C, so the
      earlier workstream owns the shared file): `convertQuantity(qty, from, to): number | null`,
      `unitGroup(unit): 'mass' | 'volume' | 'count' | 'other'`, `toBaseUnit(unit): { base, factor } | null`
      (mass→`g`, volume→`ml`, count→`pcs`). C never reimplements conversion.

### 1.2 Frozen route table (all under `/api/v1`, all `requireAuth`)

> Naming notes (decided, not open): pantry uses the consistent collection root `/pantry/items`
> (adapted from the breakdown doc's mixed `GET /pantry` + `POST /pantry/items` — Lead sign-off recorded here).
> API resource is plural (`/meal-plans`, `/grocery-lists`); the **page** route stays singular (`/meal-plan`) —
> intentional, mirrors `/recipes` vs detail pages.

| Owner | Method & Path | Purpose |
|-------|---------------|---------|
| A | `GET /pantry/items` | List own items, paginated envelope `{ items, page, limit, total, totalPages }` (query: `?category=&q=&expiringWithinDays=&lowStock=true`) |
| A | `POST /pantry/items` | Add item |
| A | `PATCH /pantry/items/:id` | Edit item / adjust quantity (`:id` via `validateParams`) |
| A | `DELETE /pantry/items/:id` | Remove item |
| A | `POST /pantry/items/:id/use` | Consume quantity (body `UsePantryItemInput { quantity }` — decided, see §6) |
| A | `GET /pantry/expiring` | Items expiring soon, sorted by `expiryDate` asc (powers "Use These Soon") |
| B | `GET /meal-plans` | List own plans (paginated envelope) |
| B | `POST /meal-plans` | Manual create (meals reference existing `recipeId`s) |
| B | `GET /meal-plans/:id` | Detail (populated recipe cards) |
| B | `PATCH /meal-plans/:id` | Edit/move/remove meal, change servings (deterministic, **no AI call**) |
| B | `DELETE /meal-plans/:id` | Delete plan |
| B | `POST /meal-plans/ai-generate` | AI full-plan generation (body = constraints, §B3) |
| B | `POST /meal-plans/:id/swap-meal` | Replace ONE meal only (body `SwapMealInput { mealId }`) |
| B | `POST /meal-plans/:id/optimize` | Pantry/reuse/nutrition optimization pass |
| C | `GET /grocery-lists` | List own lists (paginated envelope) |
| C | `GET /grocery-lists/:id` | Detail, grouped by category |
| C | `POST /grocery-lists/generate` | Generate from `mealPlanId` (body `GenerateGroceryInput { mealPlanId }`) — consolidate → subtract pantry → save |
| C | `PATCH /grocery-lists/:id` | `UpdateGroceryListInput { name?, budget?, status? }` (rename / budget / archive) |
| C | `POST /grocery-lists/:id/items` | Add manual item (`AddGroceryItemInput`, stored `{ isManual: true }`) |
| C | `PATCH /grocery-lists/:id/items/:itemId` | `UpdateGroceryItemInput { quantity?, unit?, category?, isPurchased? }` |
| C | `DELETE /grocery-lists/:id/items/:itemId` | Remove item |
| C | `POST /grocery-lists/:id/clear-purchased` | Remove all `isPurchased` items (body `{}`) |
| C | `POST /grocery-lists/:id/recalculate` | Re-run consolidate+subtract after plan/pantry change (body `{}`, preserves manual items) |
| C | `POST /grocery-lists/:id/purchased-to-pantry` | Body `PurchasedToPantryInput { itemIds: ObjectIdString[] }` → Dev-A service upsert, idempotent (see §1.4) |

### 1.3 File ownership matrix (Lead enforces)

| File / area | Owner |
|-------------|-------|
| `backend/src/models/PantryItem.ts`, `controllers/pantryController.ts`, `services/pantryService.ts` (`upsertPantryFromGrocery`), `routes/pantry.ts`, `tests/pantry*.test.ts`, `tests/ingredientKey.test.ts`, `tests/units.test.ts`, `frontend/src/app/pantry/**`, `components/pantry/**` | **Dev A** |
| `backend/src/utils/ingredientKey.ts` + `backend/src/utils/units.ts` (+ tests) | **Dev A** (B & C import only) |
| `backend/src/models/MealPlan.ts`, `controllers/mealPlanController.ts`, `services/mealPlanService.ts` (AI), `routes/mealPlans.ts`, `tests/mealPlan*.test.ts`, `frontend/src/app/meal-plan/**`, `components/meal-plan/**` | **Dev B** |
| `backend/src/models/GroceryList.ts`, `controllers/groceryController.ts`, `services/groceryService.ts` (pure math), `routes/groceryLists.ts`, `tests/grocery*.test.ts`, `frontend/src/app/grocery/**`, `components/grocery/**` | **Dev C** |
| `v1.ts`, `server.ts`, `syncIndexes.ts`, `navbar.tsx`, contract merge, final integration | **Lead** |

### 1.4 Integration seams (how the three streams connect without blocking)

- [x] **A→B seam (frozen):** `GET /pantry/items` response shape is the *only* thing B's AI prompt builder consumes.
      Until A lands, B develops against the 4-item fixture in §5 (Chicken 500g / Rice 2kg / Eggs 8 / Tomato 4pcs).
- [x] **B→C seam (frozen):** C's generator reads a plan as
      `{ meals: [{ mealId, date, mealType, recipeId, servings }] }` + each recipe's `ingredients[]` scaled by
      `servings / recipe.servings`. Until B lands, C develops against a fixture plan of 2–3 real recipe ids.
- [x] **C→A seam (frozen):** `POST .../purchased-to-pantry { itemIds }` calls Dev-A-owned
      `upsertPantryFromGrocery(userId, items)` in `services/pantryService.ts`. C **never imports the
      `PantryItem` model** — service call only (preserves §0.2 exclusive ownership). Convertible units merge
      via `units.ts` (`500g` in pantry + `1kg` purchased → `1500g`); exact-duplicate `key+unit` upserts sum.
      Idempotency: grocery items carry `movedToPantry: boolean` (default false); the service skips items already
      flagged, sets the flag on success — a double-POST is a safe no-op, never a double-add.
- [x] Lead announces "Phase 0 frozen" in chat before parallel work starts. `[2026-09-19] [Lead] Phase 0 frozen — parallel workstreams A/B/C may start.`

---

## 2. Workstream A — Real Pantry Management (Dev A, `feature/pantry`)

**Goal:** persistent user-scoped pantry + "Use These Soon" + consume flow. Start first; B and C depend on your read shape. Also deliver the two shared utils (`ingredientKey.ts`, `units.ts`).

### A1. Backend model + validation + shared utils

- [x] `backend/src/models/PantryItem.ts` — fields:
      `userId (ObjectId ref User, index)`, `ingredientKey (string, indexed)`, `name`, `quantity (number ≥ 0)`,
      `unit (string ≤30)`, `category (enum §1.1)`, `expiryDate (Date|null)`, `lowStockThreshold (number|null)`,
      `notes (≤200)`, timestamps. Compound index `{ userId: 1, ingredientKey: 1, unit: 1 }`,
      single index `{ userId: 1, expiryDate: 1 }`. **No `userId` from client — always `req.user.id`.**
- [x] `backend/src/utils/ingredientKey.ts` — `normalizeIngredientKey()` per §1.1 + unit tests
      (`Tomato/tomatoes/Tomato` → one key; `chicken breast` ≠ `chicken thigh`).
- [x] `backend/src/utils/units.ts` — `convertQuantity`, `unitGroup`, `toBaseUnit` per §1.1 + unit tests
      (incl. `oz`/`lb` → `null`, incompatible `pcs`↔`g` → `null`).
- [x] Zod schemas in `backend/src/types/index.ts` inside `// ─── Pantry (Dev A) ───`:
      `PantryCategory`, `CreatePantryItemInput` (name 1–100 sanitized, quantity ≥ 0, unit, category,
      expiryDate optional today-or-future, lowStockThreshold optional ≥ 0, notes optional sanitized ≤200),
      `UpdatePantryItemInput` (all optional), `UsePantryItemInput` (`{ quantity: positive number }`),
      `PantrySearchQuery` (`category?, q?, expiringWithinDays?, lowStock?, page, limit`).
      List responses use the standard paginated envelope.

### A2. Backend routes + controller + service

- [x] `backend/src/controllers/pantryController.ts`:
      - `listItems` — filters: category exact; `q` regex-escaped via `utils/regex.ts`; `expiringWithinDays` →
        `expiryDate != null AND expiryDate <= today+N` (null expiries never match); `lowStock` →
        `lowStockThreshold != null AND quantity <= lowStockThreshold` (null threshold never flags).
        Returns the paginated envelope (triple-sync requirement).
      - `createItem` — sanitize name/notes, compute `ingredientKey`; exact `ingredientKey+unit` duplicate → 409
        (tell client to PATCH instead); **convertible-unit near-duplicate** (`500g` exists, adding `1kg`) →
        convert and sum into the existing line (no 409, no second line).
      - `updateItem` — ownership scope `{ _id, userId }` (cross-user → 404); recompute key if name changes.
      - `deleteItem` — same ownership scope.
      - `useItem` — **conditional atomic decrement, never clamp:** 
        `findOneAndUpdate({ _id, userId, quantity: { $gte: qty } }, { $inc: { quantity: -qty } })` →
        null means insufficient → 409 `CONFLICT` with `available` in the safeMessage; quantity can never go negative.
      - `expiringSoon` — `expiryDate != null`, sorted asc, limit 20, paginated envelope.
- [x] `backend/src/services/pantryService.ts` — `upsertPantryFromGrocery(userId, items)` for the §1.4 seam
      (convertible-unit merge, exact-duplicate sum, returns per-item results; skips + reports already-moved items).
- [x] `backend/src/routes/pantry.ts` — wire §1.2 rows with `requireAuth` + `validateBody`/`validateQuery`/
      **`validateParams` on every `:id` route**; export `pantryRouter`. **Do NOT mount in `v1.ts`** (Lead does it).
- [x] Low-stock flag is **derived** (`threshold != null && quantity <= threshold`), never stored. `[Lead integration] Verified in code (`toPantryItemResponse`, `pantryController.ts:78-91`).

### A3. Frontend (pages + components)

- [x] `frontend/src/lib/types.ts` + `api.ts` — append `PantryItem`, `CreatePantryItemInput`, `PantrySearchQuery`,
      `listPantryItems()`, `createPantryItem()`, `updatePantryItem()`, `deletePantryItem()`, `usePantryItem()`, `listExpiringPantry()`.
- [x] `frontend/src/app/pantry/page.tsx` (behind `AuthGuard`): table/cards (name, qty+unit, category badge,
      expiry badge, low-stock badge), search input, category filter, "expiring soon" toggle, add/edit modal,
      +/- stepper, delete confirm, loading/error/empty states (empty: *"Your pantry is empty. Add your first ingredient…"*).
- [x] `components/pantry/use-these-soon.tsx` — "Use These Soon" section (from `GET /pantry/expiring`) with
      **"Find recipes"** button → links to `/generator` with the ingredient prefilled (query param, no new API).
- [x] Follow the React Compiler rule (§0.4.1); reuse `ui/*` states; mobile-friendly stepper (≥24px targets).

### A4. Tests (Dev A)

- [x] `tests/pantry.test.ts` (integration, `mongodb-memory-server`, `providerId` helper per §0.3.2):
      create / exact-duplicate-409 / convertible-unit-merge / update / use-decrements / use-insufficient-409 (qty unchanged) /
      delete / search+category filter / expiring sort (nulls excluded) / low-stock flag (null threshold never flags) /
      **cross-user 404 isolation (incl. admin)** / invalid quantity 400 / malformed `:id` 400.
- [x] `tests/ingredientKey.test.ts` + `tests/units.test.ts`: normalization cases incl. the must-split cases;
      conversion factors + `null` on incompatible/imperial.
- [x] Gate: `npm run build` ✓ · `npm run lint` (0 warnings) ✓ · `npx vitest run tests/pantry.test.ts tests/ingredientKey.test.ts tests/units.test.ts` ✓.

---

## 3. Workstream B — Smart Meal Planning (Dev B, `feature/mealplan`)

**Goal:** weekly planner (manual + AI) with swap-single-meal/optimize. Develop against the §5 pantry fixture until Dev A lands; import `normalizeIngredientKey` only (never copy it).

### B1. Backend model + validation

- [x] `backend/src/models/MealPlan.ts` — `userId (index)`, `name (default "My Week")`,
      `weekStartDate/weekEndDate (Date, UTC midnight, §1.1)`, `status: active|archived (default active)` +
      **`isFavorite: boolean (default false)`** — favorite is a flag, not a status (a plan can be both active and favorite),
      `constraints` (snapshotted: `{ days, mealsPerDay, servings, calorieTarget?, proteinTargetGrams?, dietaryLabels?, cuisine?, budget?, notes? }`),
      `meals[]` subdocs `{ date, mealType (MEAL_TYPE enum), recipeId (ObjectId ref Recipe), servings (1–20), source: manual|ai|swap|optimized, notes? (sanitized ≤200) }`
      (subdoc `_id` serves as `mealId`),
      timestamps. Index `{ userId: 1, createdAt: -1 }`. **Slot uniqueness:** at most one meal per
      `(date, mealType)` per plan — enforced in Zod (refinement on create/update), so `swap` is never ambiguous.
- [x] Zod in `// ─── MealPlan (Dev B) ───`: `MealPlanConstraints`, `MealPlanMealInput`,
      `CreateMealPlanInput` (meals can be empty for AI flow), `UpdateMealPlanInput`,
      `AIGenerateMealPlanInput` (days 1–7 default 7, mealsPerDay subset default `[breakfast,lunch,dinner]`,
      servings 1–20 default 2, calorieTarget?, proteinTargetGrams?, dietaryLabels?, cuisine?, maxCookingTimeMinutes?,
      prioritizePantry? default true, avoidIngredients?, budget?, notes? sanitized ≤500),
      `SwapMealInput` (`{ mealId: ObjectIdString, notes? }` — exactly one meal, addressed by id).
- [x] Dates validated (`weekEndDate > weekStartDate`, meal dates inside range, `YYYY-MM-DD` in → UTC midnight);
      `recipeId`s must exist and be `published` (reuse `utils/recipeAccess.ts` pattern); owner-or-self only.

### B2. Manual CRUD routes (deterministic — no AI)

- [x] `backend/src/controllers/mealPlanController.ts` — `listPlans` (paginated envelope; `?isFavorite=true` filter for the Favorites tab),
      `createPlan`, `getPlan` (**single-query** recipe hydration per §0.3.10; tolerate deleted recipe →
      meal shows `recipe: null` + `missing: true`, never 500),
      `updatePlan` (move meal = change `date/mealType` with slot-uniqueness re-check; servings stored only),
      `deletePlan`. All scoped `{ _id, userId }` (cross-user → 404).
- [x] `backend/src/routes/mealPlans.ts` — wire manual rows with `requireAuth` + `validateParams` on `:id`; **do NOT mount** (Lead does it).

### B3. AI generation / swap / optimize (`services/mealPlanService.ts`, reuses Groq patterns from `aiService.ts`)

- [x] Candidate selection (deterministic, bounded): filter published recipes by diet/cuisine/time prefs → cap **~30**
      summaries (`id,title,tags,cuisine,category,6 key ingredients,per-serving kcal+protein`). Fetch caller pantry
      (`PantryItem.find({userId})`, limit 100) + profile prefs. **Never send full DB to the LLM.**
- [x] `generateMealPlan(input, userId)`: system/user prompt split (retrieved pantry+recipes labeled as *data*,
      never instructions — prompt-injection rule); instruct week-level optimization (reuse, leftovers, variety,
      macro targets as selection pressure, not post-hoc math); `response_format: {type:"json_object"}`,
      timeout `AI_REQUEST_TIMEOUT_MS`; Zod-validate output; **discard any `recipeId` outside the candidate pool**;
      502/504 `AI_PROVIDER_ERROR` on failure/invalid (never store invalid).
- [x] `swapMeal(planId, { mealId }, userId)`: re-rank candidates **excluding** the current recipe for that slot,
      replace only that meal, keep everything else byte-identical.
- [x] `optimizePlan(planId, userId)`: deterministic scoring first (pantry-overlap count, distinct-ingredient count,
      kcal/protein distance to targets using stored recipe nutrition — **null nutrition is skipped, never summed**),
      AI only re-orders/swaps within constraints; never violates explicit avoid-lists or diet labels.
- [x] Wire `POST /meal-plans/ai-generate`, `POST /meal-plans/:id/swap-meal`, `POST /meal-plans/:id/optimize`
      with `requireAuth + aiRateLimiter + validateBody` (+ `validateParams` on `:id`).
- [x] Cost rule: move/remove/servings-change = pure DB writes, **zero AI calls**. Leftover-awareness = prompt-level
      reasoning over previous-day proteins (no fake quantities — use recipe servings as the unit).
- [x] Family preferences (FEATURES 1.7): implement as free-text `notes` + `dietaryLabels` intersection in v1
      (no household model — deferred, see §6).

### B4. Frontend

- [x] `lib/types.ts` + `api.ts` — `MealPlan`, `MealPlanConstraints`, `listMealPlans()`, `createMealPlan()`,
      `getMealPlan()`, `updateMealPlan()`, `deleteMealPlan()`, `aiGenerateMealPlan()`, `swapMeal()`, `optimizeMealPlan()`.
- [x] `frontend/src/app/meal-plan/page.tsx` (list: name, date range, status tabs All/Archived + Favorites filter via `?isFavorite=true`) +
      `frontend/src/app/meal-plan/[id]/page.tsx` (weekly grid Mon–Sun × Breakfast/Lunch/Dinner + snacks;
      per-meal: recipe link, servings, Swap / Remove / Move / View actions; header: AI Generate, Optimize,
      Save-as-favorite (`isFavorite` toggle, never a status change), Generate-grocery-list link to `/grocery?plan=<id>`).
- [x] AI generate modal: days, meals/day, servings, calorie+protein targets, diet, cuisine, time limit,
      avoid list, budget, "use my pantry" toggle. Nutrition summary row computed deterministically from
      populated recipes (**null-nutrition recipes show "—" and are excluded from totals, never `NaN`**).
      Allergen/dietary warning banners on AI output (DoD §8 — same rule as generator/recipe views).
      All states (empty/AI-failure/invalid-response) handled.
- [x] **Do NOT build grocery UI here** — only link to it.

### B5. Tests (Dev B)

- [x] `tests/mealPlan.test.ts`: manual create/get/update/move/servings/delete, out-of-range date 400,
      duplicate-slot 400, unpublished-recipe 404, cross-user 404 (incl. admin), deleted-recipe-tolerant read,
      malformed `:id` 400, `isFavorite` toggle preserves `status`.
- [x] `tests/mealPlanAI.test.ts` (mocked Groq fetch): happy-path stores valid plan; hallucinated `recipeId`
      discarded; invalid JSON → 502 and nothing stored; swap changes exactly one meal; timeout → 504.
- [x] Gate: build ✓ · lint ✓ · `npx vitest run tests/mealPlan.test.ts tests/mealPlanAI.test.ts` ✓.

---

## 4. Workstream C — Smart Grocery System (Dev C, `feature/grocery`)

**Goal:** deterministic grocery math (consolidate → subtract pantry) + checklist UI. Develop against the §5
fixtures until A/B land; import `normalizeIngredientKey` + `units.ts` from Dev A (never duplicate either).

### C1. Pure logic first (`backend/src/services/groceryService.ts` — zero DB, zero AI, fully unit-tested)

- [x] `consolidateRequirements(meals: [{ ingredients: [{name,quantity?,unit?}], servingsScale }]): ConsolidatedItem[]`
      (`{ key, name, quantity, unit /* canonical base unit */, category?, sourceRecipeIds[], estimated }`) —
      key = `normalizeIngredientKey(name)+'|'+toBaseUnit(unit).base` (unknown/imperial units: `key+'|'+rawUnit`,
      never merged across units); scale `quantity × servingsScale`; sum same-key;
      missing quantity → `quantity: 1, unit: 'pcs', estimated: true`; **never merge incompatible units** (`pcs` vs `g` stay separate lines).
- [x] `subtractPantry(requirements, pantryItems): { toBuy: ConsolidatedItem[], covered: ConsolidatedItem[] }` —
      `toBuy = max(0, required − pantry)` per key+convertible-unit (via Dev-A `units.ts`; `null` = incompatible =
      no subtraction); fully-covered items excluded from `toBuy` but listed under `covered` for transparency.
      **This exact formula powers §5.**
- [x] `categorize(name): Category` — keyword map over the item name (extendable constant, no AI call, §1.1 precedence rule).

### C2. Backend model + routes

- [x] `backend/src/models/GroceryList.ts` — `userId (index)`, `mealPlanId (ObjectId ref MealPlan|null)`,
      `name`, `budget? (≥0, display only)`, `status: active|archived (default active)`,
      `items[]` `{ ingredientKey, name (sanitized), quantity, unit, category, sourceRecipeIds[], isPurchased (default false), isManual (default false), estimated (default false), movedToPantry (default false) }`,
      timestamps. Index `{ userId: 1, createdAt: -1 }`.
      (No `estimatedCost` in v1 — reserved for Phase 4 with real price data; never fabricated. See §6.)
- [x] Zod in `// ─── Grocery (Dev C) ───`: `GenerateGroceryInput` (`{ mealPlanId: ObjectIdString }`),
      `AddGroceryItemInput`, `UpdateGroceryItemInput` (`quantity? ≥ 0`, `unit?`, `category?`, `isPurchased?`),
      `UpdateGroceryListInput` (`name?, budget?, status?`).
- [x] `backend/src/controllers/groceryController.ts`:
      - `generateFromMealPlan` — **single-query** recipe load (§0.3.10), scale, consolidate, subtract pantry, save.
      - `recalculate` (body `{}`) — re-run math, **preserve** `isManual` items verbatim + `isPurchased`/`movedToPantry`
        flags matched by **`ingredientKey`+canonical unit** (never bare key — a `500g` flag must not leak onto a `2pcs` line).
      - `addManualItem`, `updateItem`, `deleteItem`, `clearPurchased`, `purchasedToPantry`
        (calls Dev-A `upsertPantryFromGrocery`, never the model — §1.4).
- [x] `backend/src/routes/groceryLists.ts` — wire §1.2 rows with `requireAuth` + `validateParams`; **do NOT mount** (Lead does it).

### C3. Frontend

- [x] `lib/types.ts` + `api.ts` — `GroceryList`, `GroceryItem`, `generateGroceryList()`, `recalculateGroceryList()`,
      `clearPurchased()`, item CRUD + `markPurchased()`, `purchasedToPantry(itemIds)`.
- [x] `frontend/src/app/grocery/page.tsx` (list) + `frontend/src/app/grocery/[id]/page.tsx` (checklist grouped by
      category: checkbox persists `isPurchased`, qty edit, manual-add input, clear-purchased, recalculate button,
      "Add purchased to pantry" explicit button with item selection, covered-by-pantry note, budget line
      showing `budget` vs item count only — no cost claims). Mobile-first checklist.
- [x] Entry from meal-plan detail (`/grocery?plan=<id>` pre-selects plan in the generate form — §0.4.2).

### C4. Tests (Dev C)

- [x] `tests/groceryMath.test.ts` (pure, no DB): 1+2+3 onions → 6; 1kg − 600g → 400g; fully-covered excluded + listed under `covered`;
      incompatible units not merged; imperial never merged; servings scaling; `estimated` flag on missing qty; category grouping.
- [x] `tests/grocery.test.ts` (integration): generate from plan (single-query), recalculate after plan change preserves manual
      items + purchased flags per key+unit, purchased→pantry upsert + idempotent double-POST, cross-user 404, invalid ids 400/404.
- [x] Gate: build ✓ · lint ✓ · both suites ✓.

---

## 5. End-to-end verification scenario (Lead runs at integration; devs use as fixtures)

```text
Pantry:  Chicken 500g | Rice 2kg | Eggs 8 | Tomato 4pcs
Plan needs: Chicken 1kg | Rice 2.5kg | Eggs 6
Grocery MUST show: Chicken 500g | Rice 500g | Eggs 0 (covered, not listed as to-buy)
Then: swap Wednesday dinner → grocery recalculates, manual items preserved.
Then: consume 200g chicken → pantry 300g → next grocery run uses 300g.
```

---

## 6. Explicitly DEFERRED to Phase 4 (do NOT build now — prevents scope creep)

- **2.5 Shared grocery list** (needs sharing-model decision: invites vs link) — C leaves `userId`-scoped model; Lead decides later.
- **3.7 Barcode/QR scanning** — needs a product DB; stub: manual-add covers the flow.
- **3.8 Pantry-from-photo** — reuse existing `POST /ai/nutrition/analyze-photo` (`suggestedIngredientsForRecipe`)
      as the later prefill source; A leaves the add-form able to accept prefilled names.
- **3.6 Waste report, 3.4 push-style expiry notifications** — expiry list + "Use These Soon" ship now; report/notifications later.
- **2.7–2.8 real prices** — `budget` is display-only in v1; `estimatedCost` field is reserved but never set without real price data. No fabricated prices ever.
- **1.7 household profiles** — v1 = notes + diet intersection only.

**Decided during planning (frozen, no longer open):**
1. Pantry `use` shape — `POST /pantry/items/:id/use { quantity }` with conditional-atomic 409 semantics (§A2). Decided.
2. Route casing — API plural (`/meal-plans`), page singular (`/meal-plan`), intentional. Decided.
3. Grocery sharing model for Phase 4 — invites or share-link? **Open — Lead decides in Phase 4, not a Phase-0 blocker.**
4. Budget currency display — `$` display-only in v1; per-user setting deferred to Phase 4 with real prices. **Open — not a Phase-0 blocker.**

---

## 7. Integration order (Team Leader only)

1. [x] Merge `feature/pantry` → mount `pantryRouter` in `v1.ts`, add `PantryItem` **+ `MealPlan` + `GroceryList`** `[2026-09-21] [Lead] \`pantryRouter\` mounted at \`/pantry\` (was already mounted); all three models present in \`syncIndexes.ts\`; suites \`pantry.test.ts\` + \`ingredientKey.test.ts\` + \`units.test.ts\` green.`
      to `syncIndexes.ts` as each lands (all three required — `autoIndex` is off in production, so any missing
      model ships without its `{ userId: 1, … }` indexes), run `npm run db:indexes` on staging, verify §5 pantry leg.
2. [x] Merge `feature/mealplan` → mount `mealPlansRouter`, verify AI generate + swap-single + fixture pantry. `[2026-09-21] [Lead] Mounted at \`/meal-plans\` in \`v1.ts\`; \`MealPlanModel\` added to \`syncIndexes.ts\`; suites \`mealPlan.test.ts\` (15) + \`mealPlanAI.test.ts\` (6) green.`
3. [x] Merge `feature/grocery` → mount `groceryListsRouter`, verify the §1.4 service seam (no model import), verify full §5 loop. `[2026-09-21] [Lead] Replaced stub \`MealPlan\` schema with real \`MealPlanModel\` import; pantry reads in \`groceryController\` + \`mealPlanService\` routed via new Dev-A \`pantryService.listPantryForUser\` (B/C no longer import \`PantryItem\` model); fixed \`grocery.test.ts\` fixture to the real schema (was coupled to the stub); §5 math covered by \`groceryMath.test.ts\` (8) + \`grocery.test.ts\` (5) green.`
4. [x] Triple-sync check: `backend/src/types/index.ts` ↔ `docs/API_CONTRACT.md` ↔ `frontend/src/lib/types.ts`
      (every new DTO present in all three; error envelope on all non-2xx; all lists return the paginated envelope).
5. [x] Add `/pantry`, `/meal-plan`, `/grocery` to `navbar.tsx` (More menu / mobile list) + cross-links
      (pantry "Find recipes" → generator; meal-plan → grocery; grocery → pantry).
6. [x] Full gates: backend `build → lint → test`, frontend `build → lint → test`; manual §5 scenario;
      security sweep (ownership on every route, `validateParams` on every `:id`, Zod on every body,
      sanitize on every free-text field, AI-output validation, no secrets client-side).
7. [x] Append dated `[YYYY-MM-DD] [Lead]` integration notes to `TASKS.md`; update `docs/API_CONTRACT.md`. `[2026-09-21] [Lead] Done — see TASKS.md notes.`

## 8. Definition of Done (every checkbox)

Client+server validation · API-enforced ownership (cross-user 404 test proves it) · loading/error/empty states ·
desktop+mobile OK · deterministic math never via LLM · **allergen/dietary warnings on every AI, nutrition,
and recipe surface** (AGENTS.md domain rule — same banners as generator/recipe views) ·
contract triple in sync (types ↔ contract doc ↔ frontend types) · no critical/high defects · gates green.

## 9. Draft API appendix (dev scratch — Lead moves to `docs/API_CONTRACT.md` at integration)

- [x] **§9A (Dev A):** pantry endpoint proposals — `[Lead integration] moved into `docs/API_CONTRACT.md` (`/pantry` section) on 2026-09-21; nothing pending.
- [x] **§9B (Dev B):** meal-plan endpoint proposals (implemented on `feature/mealplan`, [2026-09-21] — Lead moves to `docs/API_CONTRACT.md` at integration).

  Base path `/api/v1/meal-plans` (Lead mounts `mealPlansRouter` there; routes use relative paths). All rows `requireAuth`. Dates are `YYYY-MM-DD` strings (UTC midnight server-side); week dates and meal dates echo as `YYYY-MM-DD`. Error envelope on all non-2xx. Cross-user (incl. admin) → 404 `NOT_FOUND`; malformed `:id` → 400 `VALIDATION_ERROR`.

  ```text
  GET    /meal-plans?status=&isFavorite=&page=&limit=
    → 200 { items: MealPlan[], page, limit, total, totalPages }
    (list items are NOT recipe-hydrated; use GET /:id for cards)
  POST   /meal-plans { name?, weekStartDate, weekEndDate, status?, isFavorite?, constraints?, meals? }
    → 201 { plan } (hydrated); meals may be [] (AI shell)
    → 404 when a recipeId is missing/unpublished; 400 on out-of-range date, duplicate (date,mealType) slot, weekEndDate <= weekStartDate
  GET    /meal-plans/:id → 200 { plan } with recipe cards; deleted recipe → { recipe: null, missing: true }
  PATCH  /meal-plans/:id { name?, weekStartDate?, weekEndDate?, status?, isFavorite?, constraints?, meals? }
    → 200 { plan }; meals = FULL-array replace (move/remove/servings); merged week re-validated
  DELETE /meal-plans/:id → 200 { success: true }
  POST   /meal-plans/ai-generate (aiRateLimiter)
    { name?, weekStartDate, weekEndDate?, days=7, mealsPerDay=[breakfast,lunch,dinner], servings=2,
      calorieTarget?, proteinTargetGrams?, dietaryLabels?=[], cuisine?, maxCookingTimeMinutes?,
      prioritizePantry=true, avoidIngredients?=[], budget?, notes? }
    → 201 { plan } (source "ai", constraints snapshot); weekEndDate defaults to start+days−1
    → 404 when no published recipes match; 502/504 on provider failure/invalid output (nothing stored)
  POST   /meal-plans/:id/swap-meal (aiRateLimiter) { mealId, notes? }
    → 200 { plan }; exactly one meal replaced (servings/notes kept, source "swap")
  POST   /meal-plans/:id/optimize (aiRateLimiter, body {}) → 200 { plan }
    (tolerant per-slot merge; changed meals source "optimized"; empty plan → 400)
  ```

  `MealPlan { id, userId, name, weekStartDate, weekEndDate, status: active|archived, isFavorite,
  constraints { days?, mealsPerDay?, servings?, calorieTarget?, proteinTargetGrams?, dietaryLabels?,
  cuisine?, budget?, notes? } | null, meals: Meal[], createdAt, updatedAt }`.
  `Meal { mealId, date, mealType, recipeId, servings 1–20, source: manual|ai|swap|optimized,
  notes, recipe: RecipeCard | null, missing }`.
- [x] **§9C (Dev C):** grocery endpoint proposals — `[Lead integration] moved into `docs/API_CONTRACT.md` (`/grocery-lists` section) on 2026-09-21; nothing pending.
