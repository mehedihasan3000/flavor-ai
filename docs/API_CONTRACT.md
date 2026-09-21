# FlavorAI — API Contract (v1)

> **Frozen contract.** M2–M5 code against this document. Any shape change requires
> Team Lead sign-off (TASKS.md Phase A). Zod schemas live in
> `backend/src/types/index.ts` and are the executable source of truth.

## Conventions

- Base path: `/api/v1`
- JSON bodies except multipart image uploads.
- Auth: `Authorization: Bearer <JWT>` on protected endpoints.
- Pagination: `?page=1&limit=20` (limit max 100). Response: `{ items, page, limit, total, totalPages }`.
- Error envelope (all non-2xx):
  ```json
  { "status": 400, "code": "VALIDATION_ERROR", "safeMessage": "Invalid input data.", "validation": { "field": "message" } }
  ```
- Codes: `VALIDATION_ERROR | UNAUTHORIZED | FORBIDDEN | NOT_FOUND | CONFLICT | AI_PROVIDER_ERROR | RATE_LIMITED | INTERNAL_ERROR`

---

## `GET /health`
Smoke test. Returns 200 when MongoDB connected, 503 otherwise.

```json
{ "status": "ok", "service": "flavorai-api", "version": "v1", "database": { "connected": true, "readyState": 1, "host": "cluster0.example.mongodb.net" }, "timestamp": "ISO8601" }
```

---

## `/auth` — Better Auth bridge (M2)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/sign-up` | public | Create email/password account (scrypt hash, FR-AUTH-01/07) |
| POST | `/auth/sign-in` | public | Verify email/password → user context (FR-AUTH-02/07, no auto-create) |
| POST | `/auth/token/verify` | public | Verify signed JWT → user context (lazily upserts the user) |
| POST | `/auth/logout` | required | Revoke current session/token (stateless: client discards the token) |

**JWT policy (finalized M2):** HS256, signed/verified with `JWT_SECRET`, issuer
`JWT_ISSUER` (default `flavorai`), audience `JWT_AUDIENCE` (default `flavorai-api`),
expiry `JWT_EXPIRES_IN` (default `15m`). Tokens are minted server-side (Next.js route)
after a Better Auth session is confirmed; the secret never reaches browser JS
(SRS §9.4). The token subject (`sub`) is the Better Auth user id, stored on the
`User` document as `providerId`. Verification lives in `backend/src/middleware/auth.ts`.

**`POST /auth/sign-up` body** (`CredentialSignUpInput`):
```json
{ "name": "Ada Lovelace", "email": "ada@example.com", "password": "s3cretP@ss!" }
```
→ 201 `{ user: { id, providerId, name, email, role: "user", avatarUrl } }`.
New accounts are ALWAYS `role: "user"` (never derived from the email).
409 `CONFLICT` if the email is already registered with a password.
Addresses that exist without a password (legacy mock / Google-only docs) can
claim the address here — the first password is set and the stored `providerId`
is reused. 400 on invalid shape. Passwords are scrypt-hashed, never returned.

**`POST /auth/sign-in` body** (`CredentialSignInInput`):
```json
{ "email": "ada@example.com", "password": "s3cretP@ss!" }
```
→ 200 `{ user: { id, providerId, name, email, role, avatarUrl } }`.
401 `UNAUTHORIZED` for unknown email or wrong password (generic
`"Invalid email or password."` to avoid account enumeration), or for
password-less (Google-only) accounts (`"This account uses Google sign-in..."`).
NEVER creates a user and NEVER returns the password hash. The frontend mints
its Bearer JWT only after this endpoint confirms the credentials.

**`POST /auth/token/verify` → 200**
```json
{
  "user": { "id": "507f1f77bcf86cd799439011", "name": "Ada", "email": "ada@example.com", "role": "user" }
}
```
Users are matched by `providerId`; if absent, a new `User` is created (`role: "user"`,
name defaults to `"User"` when the token carries no name). Invalid/expired token → 401.
Note: email/password logins MUST go through `/auth/sign-in` first — `verify`
upserts by design (Google first-login / Better Auth bridge), so calling it
directly with a self-minted JWT would bypass credential checks.

**`POST /auth/logout` → 204** — no body. Stateless JWT revocation is client-side;
the endpoint exists for contract compliance.

---

## `/users` — profile & preferences (M2)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/me` | required | Own profile + dietary preferences (FR-AUTH-06) |
| PATCH | `/users/me` | required | Update name, avatar, bio, preferences (FR-AUTH-06) |
| GET | `/users/me/stats` | required | Own recipe counts + ratings/favorites/comments received |

**`GET /users/me` → 200**
```json
{
  "id": "507f1f77bcf86cd799439011",
  "name": "Ada",
  "email": "ada@example.com",
  "avatarUrl": null,
  "bio": "",
  "role": "user",
  "preferences": {
    "dietaryLabels": ["vegetarian"],
    "allergies": ["peanuts"],
    "dislikedIngredients": ["cilantro"],
    "calorieTarget": 2000,
    "calorieRange": null,
    "proteinTargetGrams": 100,
    "cookingTimeMaxMinutes": 45,
    "difficulty": "easy"
  },
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

**`PATCH /users/me` body** (all optional, see `UpdateProfileInput`):
```json
{ "name": "Ada Lovelace", "bio": "...", "avatarUrl": "https://...", "preferences": { "dietaryLabels": ["vegan"] } }
```
→ 200 with updated profile. 400 on invalid shape.

**Additive (post-freeze): `GET /users/me/stats` → 200**
```json
{
  "totalRecipes": 12,
  "draftCount": 2,
  "publishedCount": 9,
  "hiddenCount": 1,
  "totalRatingsReceived": 34,
  "totalFavoritesReceived": 21,
  "totalCommentsReceived": 8,
  "averageRating": 4.3
}
```
Not in the originally frozen contract — added for the frontend dashboard's stat
cards. `averageRating` is the rating-weighted mean across every recipe the
caller owns (0 when nothing has been rated yet).

---

## `/recipes` — CRUD, publishing, search (M3)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/recipes` | public | Search published recipes (FR-SEARCH) |
| POST | `/recipes` | required | Create manual recipe (FR-RECIPE-01) |
| GET | `/recipes/:id` | public* | Recipe detail; drafts only for owner/admin |
| PATCH | `/recipes/:id` | owner/admin | Edit recipe (FR-RECIPE-03/06) |
| DELETE | `/recipes/:id` | owner/admin | Delete recipe |
| POST | `/recipes/:id/publish` | owner/admin | Publish draft (FR-RECIPE-03) |
| POST | `/recipes/:id/unpublish` | owner/admin | Unpublish → draft |

*\*Draft/hidden recipes are never returned publicly (Business Rules 3/4/10).*

**`GET /recipes` query params** (`RecipeSearchQuery`):
`page`, `limit`, `q`, `category`, `cuisine`, `diet`, `difficulty`, `maxCookingTimeMinutes`,
`sort=newest|highest-rated|most-popular`

**Additive (post-freeze):** `mine=true` (requires auth — the route runs behind
`optionalAuth`) switches the base filter from `status: "published"` to the
caller's own `owner`, across every status, sorted by `createdAt` desc instead
of `sort`; `status=draft|published|hidden` is only honored alongside
`mine=true` (ignored otherwise, so public discovery can never leak drafts —
Business Rules 3/4/10). `mine=true` without a valid token → 401. Added for the
frontend dashboard ("my drafts/published/hidden"), for which the frozen
contract had no endpoint.

**`POST /recipes` body** (`CreateRecipeInput`):
```json
{
  "title": "Garlic Spinach Chicken",
  "slug": "garlic-spinach-chicken",
  "summary": "Quick weeknight dinner",
  "imageUrl": "https://i.imgur.com/abc.jpg",
  "ingredients": [
    { "name": "chicken breast", "quantity": 2, "unit": "pieces", "notes": "", "pantryMatch": "used" }
  ],
  "steps": [ { "stepNumber": 1, "instruction": "Season and sear." } ],
  "prepTimeMinutes": 10,
  "cookTimeMinutes": 20,
  "servings": 2,
  "difficulty": "easy",
  "cuisine": "mediterranean",
  "category": "main-course",
  "tags": ["quick"],
  "dietaryLabels": ["high-protein"],
  "allergenWarnings": ["none"],
  "nutrition": { "caloriesPerServing": 420, "proteinGramsPerServing": 40, "carbsGramsPerServing": 12, "fatGramsPerServing": 22 }
}
```
→ 201 `{ recipe }`. `status` defaults to `draft`. Re-submitting the same dish
(same owner + title + ingredients + steps — e.g. double-clicking Save/Publish on
one generated output, retrying, or replaying the request) → 409 `CONFLICT`
(`"This recipe has already been saved."`) instead of a second record. The check
ignores `slug` (the generator mints a fresh timestamped slug per attempt) and
cosmetic `pantryMatch` tags.

**Additive (post-freeze):** `POST /recipes` accepts optional `"source": "manual" | "ai"`
(default `"manual"`). The AI generator passes `"source": "ai"` so saved AI recipes
keep their "AI Generated" badge and AI/allergy disclaimers on the detail page;
the manual form omits it. `source` is immutable — `PATCH /recipes/:id`
(`UpdateRecipeInput`) does not accept it.

**Recipe response** adds: `id`, `owner`, `source`, `status`, `totalTimeMinutes`,
`averageRating`, `ratingCount`, `favoriteCount`, `commentCount`, `publishedAt`,
`createdAt`, `updatedAt`. PATCH uses `UpdateRecipeInput` (all optional, never `source`).

---

## `/ai/recipes/generate` — AI generation (M3)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/ai/recipes/generate` | required | Generate recipe from pantry + preferences (FR-AI-01..08) |
| POST | `/ai/flavor-pairings` | required | Complementary ingredients/substitutions (FR-FLAVOR) |
| POST | `/ai/nutrition/analyze-photo` | required | Analyze food photo for nutrition estimation (FR-PHOTO-01..04) |
| POST | `/ai/recipes/taste-match` | required | **Additive:** recommend existing recipes matching taste preferences (FR-TASTE-01..03) |

**`POST /ai/recipes/generate` body** (`AIRecipePromptInput`):
```json
{
  "ingredients": ["chicken breast", "garlic", { "name": "spinach", "quantity": 200, "unit": "g" }],
  "mealType": "dinner",
  "cuisine": "mediterranean",
  "servings": 2,
  "maxCookingTimeMinutes": 30,
  "difficulty": "easy",
  "availableEquipment": ["oven"],
  "excludedIngredients": ["mushrooms"],
  "preferences": { "dietaryLabels": ["gluten-free"], "allergies": ["peanuts"] }
}
```

**Response → 200** (output validated by `AIRecipeOutputSchema`; invalid output → 502 `AI_PROVIDER_ERROR`, never stored):
```json
{
  "recipe": {
    "title": "...", "summary": "...",
    "ingredients": [ { "name": "...", "quantity": 2, "unit": "g", "notes": null, "pantryMatch": "used" } ],
    "steps": [ { "stepNumber": 1, "instruction": "..." } ],
    "prepTimeMinutes": 10, "cookTimeMinutes": 20, "servings": 2, "difficulty": "easy",
    "cuisine": "...", "category": "main-course", "tags": [], "dietaryLabels": [], "allergenWarnings": [],
    "nutrition": { "caloriesPerServing": 420, "proteinGramsPerServing": 40, "carbsGramsPerServing": 12, "fatGramsPerServing": 22 }
  },
  "pantryMatch": { "usedIngredients": ["chicken breast"], "missingIngredients": ["olive oil"], "usageCount": 1, "missingCount": 1 }
}
```

**`POST /ai/flavor-pairings` body** (`FlavorPairingInput`):
```json
{ "ingredient": "chicken breast", "preferences": { "dietaryLabels": ["gluten-free"] } }
```
→ 200 `{ suggestions: [{ ingredient, reason, type: "addition"|"substitution" }] }`

**`POST /ai/nutrition/analyze-photo` body** (`FoodPhotoAnalysisInput`):
```json
{
  "image": "data:image/jpeg;base64,... OR https://...",
  "mimeType": "image/jpeg",
  "mealContext": "Homemade dinner plate"
}
```
→ 200 `FoodPhotoAnalysisResult`:
```json
{
  "dishName": "Grilled Lemon Salmon with Roasted Asparagus",
  "summary": "Visual analysis detects grilled salmon fillet, roasted asparagus spears, and olive oil dressing.",
  "detectedFoods": [
    { "name": "Grilled Salmon", "portion": "150g fillet", "confidence": "high", "calories": 280, "proteinGrams": 34, "carbsGrams": 0, "fatGrams": 15, "fiberGrams": 0 }
  ],
  "totalNutrition": {
    "calories": { "min": 320, "max": 400, "estimate": 360 },
    "proteinGrams": { "min": 32, "max": 38, "estimate": 35 },
    "carbsGrams": { "min": 4, "max": 8, "estimate": 6 },
    "fatGrams": { "min": 18, "max": 24, "estimate": 21 }
  },
  "macroDistribution": { "proteinPercentage": 39, "carbsPercentage": 7, "fatPercentage": 54 },
  "dietaryTags": ["high-protein", "gluten-free", "keto"],
  "allergenWarnings": ["Fish"],
  "healthInsights": ["Rich in lean protein and heart-healthy Omega-3 fatty acids."],
  "suggestedIngredientsForRecipe": ["salmon fillet", "asparagus", "olive oil", "lemon"],
  "disclaimer": "Nutritional values are approximate AI estimations based on visual appearance and should not be used as clinical or medical advice."
}
```

**Failure handling:** timeout ≤60s → 504 or 502 `AI_PROVIDER_ERROR`, safeMessage only, retryable. The photo-nutrition route accepts JSON bodies up to 15 MB (≈10 MB decoded image; 10–15 MB originals are client-compressed).

**Additive (post-freeze): `POST /ai/recipes/taste-match`** (required, `aiRateLimiter`) — AI
Taste Matcher (FR-TASTE-01..03). Recommends existing **published** recipes that best match
a user's taste preferences, instead of generating a new recipe. The backend pre-filters
published recipes into a bounded candidate pool (via the existing text index and `tags`
field — no schema change), then asks the AI to score/rank only within that pool; any
`recipeId` the model returns outside the offered candidates is discarded server-side.

Body (`TasteMatchInput`):
```json
{
  "tastes": ["spicy", "umami"],
  "intensity": "strong",
  "notes": "not too oily, prefer noodle or rice dishes",
  "limit": 10
}
```
`tastes` (required, 1-6 of `"spicy" | "sweet" | "salty" | "sour" | "bitter" | "umami"`),
`intensity` (optional, `"mild" | "medium" | "strong"`), `notes` (optional, max 300 chars),
`limit` (optional, default 10, max 20).

→ 200:
```json
{
  "matches": [
    {
      "recipe": { "id": "...", "title": "Spicy Miso Ramen", "...": "full Recipe object, same shape as GET /recipes/:id" },
      "score": 92,
      "matchedTastes": ["spicy", "umami"],
      "reason": "Chili oil and miso broth deliver a strong spicy-umami combination."
    }
  ]
}
```
Returns `{ "matches": [] }` (200, not an error) when no published recipes exist yet.
Same failure handling as the other AI endpoints above.

---

## `/assistant` — Food & Nutrition AI Assistant (INFO.md feature)

RAG assistant grounded in the caller's own data. All endpoints require auth
(`requireAuth` + shared `aiRateLimiter`, 10 req/15 min, IP-scoped like the rest
of the API rather than per-user — deliberate reuse of existing infrastructure).
User identity always comes from `req.user` — no `userId` is accepted from the client.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/assistant/chat` | required | Context-aware chat answer + `contextUsed` |
| POST | `/assistant/recommendations` | required | Ranked recipe recommendations (real IDs only) |
| POST | `/assistant/pantry-suggestions` | required | DB-scored pantry matches, AI-ranked |
| POST | `/assistant/macro-adjustments` | required | Structured macro-change suggestions (never overwrites plans) |

**DB reality (verified against live data):** only `users`, `recipes`, and
`favorites` are retrieved server-side (scoped to the caller). There is no
pantry or diet-plan collection — `pantryItems` and `dailyPlan` arrive as
optional client-supplied request context (same as the generator flow). Chat
history is an optional client-supplied recent window (max 10 turns); nothing is
persisted except `AIGenerationLog` telemetry (no new collection).

**`POST /assistant/chat` body** (`AssistantChatInput`):
```json
{
  "message": "What can I cook with the ingredients in my pantry?",
  "pantryItems": ["chicken breast", { "name": "rice", "quantity": 1, "unit": "kg" }],
  "dailyPlan": { "calories": 2300, "proteinGrams": 120 },
  "history": [{ "role": "user", "message": "Hi" }]
}
```
`message` 1–2000 chars (trimmed). → 200 `{ message, contextUsed: ["profile","favorites","pantry","dailyPlan","recipes"] }`.

**`POST /assistant/recommendations` body** (`AssistantRecommendationInput`):
```json
{ "goal": "high-protein-dinner", "limit": 5, "pantryItems": ["chicken"], "dailyPlan": { "calories": 2300 } }
```
→ 200 `{ recommendations: [{ recipeId, title, reason, matchScore }] }`.
IDs outside the served candidate/favorite set are discarded server-side (never
fake); items conflicting with stored allergies are filtered. Empty array (200)
when nothing fits.

**`POST /assistant/pantry-suggestions` body** (`PantrySuggestionsInput`):
```json
{ "pantryItems": ["chicken", "rice", "tomatoes"], "limit": 5 }
```
`pantryItems` min 1, max 50. Published recipes are scored locally first
(`usedCount`/`missingCount` via pantry matching); only top candidates reach the
LLM for ranking. → 200 `{ suggestions: [{ recipeId, title, reason, matchScore, usedCount, missingCount }] }`.
`{ suggestions: [] }` (200, no LLM call) when nothing matches.

**`POST /assistant/macro-adjustments` body** (`MacroAdjustmentInput`):
```json
{ "request": "I need more protein but want to keep calories similar." }
```
Uses `dailyPlan` input or the profile's stored targets as baseline.
→ 200 `{ recommendation: { calories, proteinGrams, carbohydratesGrams, fatGrams }, changes: [{ meal, change }], reason }`.
Suggestions only — deterministic plans are never overwritten.

**Failure handling:** 400 `VALIDATION_ERROR` on invalid shape; 401 without a
token; 429 `RATE_LIMITED` on quota; timeout ≤30s → 504, provider/invalid-output
→ 502 `AI_PROVIDER_ERROR`, safeMessage only. No new env vars — reuses
`GROQ_API_KEY` / `GROQ_MODEL` / `AI_REQUEST_TIMEOUT_MS` (server-only).

---

## `/diet` — diet plan & nutrition calculator (INFO.md feature)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/diet/plan` | required | Calculate BMI, BMR, calorie/protein targets + food plan from body metrics |

**`POST /diet/plan` body** (`DietPlanInput`):
```json
{
  "age": 30,
  "weightKg": 70,
  "heightCm": 175,
  "sex": "male",
  "activityLevel": "moderate",
  "dietaryPreference": "vegetarian"
}
```
`age` 1–120 (int), `weightKg` 20–300, `heightCm` 50–250 (numeric strings are
coerced), `sex`: `male | female`, `activityLevel`:
`sedentary | light | moderate | active | very-active`, `dietaryPreference`:
optional `DietaryLabel` (best-effort filter on the suggested protein foods:
`vegan` → plant-only, `vegetarian` → no meat/fish, `dairy-free` → no dairy,
`keto`/`low-carb` → no legumes; `halal`/`gluten-free`/`high-protein` use the
default plan since the database contains no pork and every item is
intrinsically gluten-free and protein-rich — compliance is never guaranteed,
see the response disclaimer).

→ 200 `DietPlanResult`:
```json
{
  "bmi": 22.9,
  "bmiCategory": "Normal weight",
  "bmrCalories": 1649,
  "dailyCalories": 2556,
  "protein": { "min": 84, "max": 126, "estimate": 105 },
  "foodPlan": [
    { "food": "Chicken breast (skinless)", "portion": "135 g", "proteinGrams": 42, "note": "Cooked weight" },
    { "food": "Eggs", "portion": "5 large eggs", "proteinGrams": 30, "note": "Boiled or poached" }
  ],
  "disclaimer": "These values are estimates for general guidance only and are not medical advice. Food suggestions are filtered on a best-effort basis..."
}
```
Formulas: BMI = kg/m² (WHO cut-offs); BMR = Mifflin-St Jeor (clamped at ≥ 0 —
extreme inputs can otherwise drive the equation negative); daily calories =
BMR × activity factor (1.2 / 1.375 / 1.55 / 1.725 / 1.9); protein = weight-based
g/kg/day band per activity level. The response is re-validated against
`DietPlanResult` server-side before sending. Pure calculation — nothing is
stored, no AI provider involved. 400 on invalid shape, 401 without a Bearer token.

---

## `/recipes/:id/ratings` — ratings (M4)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PUT | `/recipes/:id/ratings` | required | Create or update own rating (idempotent, FR-RATE-02/03) |
| DELETE | `/recipes/:id/ratings` | required | Remove own rating (FR-RATE-03) |
| GET | `/recipes/:id/ratings` | optional | Summary `{ averageRating, ratingCount, myRating? }` |

Body: `{ "value": 5 }` (integer 1–5). Owner rating own recipe → 403 (FR-RATE-05).
Response on PUT → 200 `{ rating: { id, recipe, user, value, createdAt, updatedAt }, summary }`.

**Additive (post-freeze):** GET runs behind `optionalAuth` — with a valid Bearer
token, the summary includes `myRating: number | null` (the caller's own rating,
or `null` if they haven't rated yet) so the UI can pre-select the interactive
stars. The key is omitted entirely for guests/unauthenticated requests, so
existing consumers reading only `{ averageRating, ratingCount }` are unaffected.

---

## `/recipes/:id/comments` — comments (M4)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/recipes/:id/comments` | public | List visible comments, paginated |
| POST | `/recipes/:id/comments` | required | Add comment (FR-COMMENT-01/04) |
| PATCH | `/comments/:id` | author | Edit own comment (FR-COMMENT-02) |
| DELETE | `/comments/:id` | author/admin | Delete comment (FR-COMMENT-02/03) |

Body: `{ "body": "text (1–2000 chars, sanitized)" }` (`CreateCommentInput`).
Comment response: `{ id, recipe, user, body, moderationStatus, createdAt, updatedAt }`.
Moderated comments hidden from public list.

**Additive (post-freeze):** every comment response also includes
`authorName: string | null` and `authorAvatarUrl: string | null` — `user`
remains the raw author id unchanged. `GET` (list) populates these from the
`User` document; `POST`/`PATCH` fill `authorName` from the authenticated
caller's own name (no extra lookup) and leave `authorAvatarUrl: null`, refreshed
on the next list fetch.

---

## `/favorites` — favorites (M4)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/favorites` | required | Own favorites, paginated (FR-FAV-03) |
| GET | `/favorites/:recipeId` | required | Own favorite status for one recipe |
| PUT | `/favorites/:recipeId` | required | Add favorite (idempotent, unique per user) |
| DELETE | `/favorites/:recipeId` | required | Remove favorite |

Unpublished/deleted recipes are filtered out of favorites lists (FR-FAV-04).

**Additive (post-freeze):** `GET /favorites/:recipeId` → 200
`{ favorited: boolean }`. Not in the originally frozen contract — added so a
recipe detail page can render an accurate favorite toggle without paginating
the caller's whole favorites list. The `recipe` card projection returned by
`GET /favorites` also now includes `dietaryLabels`, `source`, `status`
(always `"published"` here), and `totalTimeMinutes` (defaulting to
`[]`/`"manual"`/`0` if absent) so the favorites page can render the same
`RecipeCard` used on `/recipes`.

---

## `/admin` — moderation (M4)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/admin/users` | admin | List/search users (`AdminUserSearchQuery`: `page`, `limit`, `q`, `role`) |
| GET | `/admin/recipes` | admin | List all recipes incl. hidden/draft (`AdminRecipeSearchQuery`: `page`, `limit`, `q`, `status`) |
| PATCH | `/admin/recipes/:id` | admin | Hide/restore recipe (FR-ADMIN-02) |
| DELETE | `/admin/recipes/:id` | admin | Delete recipe |
| GET | `/admin/comments` | admin | List comments incl. moderated (`AdminCommentSearchQuery`: `page`, `limit`, `recipeId`, `moderationStatus`) |
| PATCH | `/admin/comments/:id` | admin | Moderate/unmoderate comment |
| DELETE | `/admin/comments/:id` | admin | Delete comment |

All admin actions are logged (FR-ADMIN-03, structured `console.info`; no separate
audit-log model — FR-ADMIN-04 allows protected endpoints without a full
dashboard for MVP). Non-admin → 403.

**`PATCH /admin/recipes/:id` body** (`AdminRecipeModerationInput`):
```json
{ "status": "hidden" }
```
Only `"published"` and `"hidden"` are accepted — draft/publish stays the
recipe owner's workflow (M3); admin only hides or restores. → 200
`{ recipe: { id, title, slug, owner, status, averageRating, ratingCount, favoriteCount, commentCount, publishedAt, createdAt, updatedAt } }`.

**`PATCH /admin/comments/:id` body** (`AdminCommentModerationInput`):
```json
{ "moderationStatus": "moderated" }
```
→ 200 `{ comment: { id, recipe, user, body, moderationStatus, createdAt, updatedAt } }`.
Recomputes the parent recipe's `commentCount` (visible-only) after every
moderate/unmoderate/delete.

`GET /admin/users` items: `{ id, name, email, avatarUrl, bio, role, createdAt, updatedAt }`.
All three list endpoints return the standard paginated envelope `{ items, page, limit, total, totalPages }`.

---

## `/pantry` — persistent pantry (Workstream A)

All routes require auth (`requireAuth`). Every query is scoped to `{ _id, userId: req.user.id }` —
cross-user access (including admins) → 404 `NOT_FOUND`. Malformed `:id` → 400 `VALIDATION_ERROR`
(`parseIdParam`). Free-text `name`/`notes` are sanitized (`utils/sanitize.ts`) before Zod validation.
`lowStock` is derived (`threshold != null && quantity <= threshold`), never stored.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/pantry/items` | List own items, paginated envelope (`PantrySearchQuery`: `category`, `q`, `expiringWithinDays`, `lowStock`, `page`, `limit`) |
| POST | `/pantry/items` | Add item (`CreatePantryItemInput`) |
| PATCH | `/pantry/items/:id` | Edit item / adjust quantity (`UpdatePantryItemInput`) |
| DELETE | `/pantry/items/:id` | Remove item → 200 `{ success: true }` |
| POST | `/pantry/items/:id/use` | Consume quantity (body `UsePantryItemInput { quantity }`) |
| GET | `/pantry/expiring` | Items with `expiryDate != null`, sorted asc, paginated envelope |

**Item shape:** `{ id, userId, ingredientKey, name, quantity, unit, category, expiryDate, lowStockThreshold, lowStock, notes, createdAt, updatedAt }`.
`ingredientKey` is normalized server-side (`utils/ingredientKey.ts`); `expiryDate` accepts `YYYY-MM-DD`
(UTC midnight) and must be today-or-future; `category` is one of
`vegetables|fruits|meat|dairy|grains|spices|frozen|snacks|other`.

**Duplicate/merge semantics:** exact `ingredientKey + unit` duplicate → 409 `CONFLICT`
("Update its quantity instead"); convertible-unit near-duplicate (`500g` + `1kg`) → converted and
summed into the existing line → 200 `{ item }` (no second line); otherwise → 201 `{ item }`.

**Consume semantics:** conditional atomic decrement
(`findOneAndUpdate({ _id, userId, quantity: { $gte: qty } }, { $inc: -qty })`) — insufficient
stock → 409 `CONFLICT` with the available amount in the message; quantity can never go negative.

**Filters:** `q` is regex-escaped; `expiringWithinDays=N` matches `expiryDate != null AND <= today+N`
(null expiries never match); `lowStock=true` matches `threshold != null AND quantity <= threshold`.

---

## `/meal-plans` — smart meal planning (Workstream B)

All routes require auth. Same ownership/param rules as `/pantry` (cross-user incl. admin → 404,
malformed `:id` → 400). AI routes additionally carry `aiRateLimiter` (10/15 min); deterministic
CRUD stays on the base limiter. Dates are `YYYY-MM-DD` (UTC midnight); week and meal dates echo as
`YYYY-MM-DD`. At most one meal per `(date, mealType)` per plan (Zod refinement); swap is addressed
by subdoc `mealId`, never ambiguous. `isFavorite` is a flag (a plan can be both `active` and favorite).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/meal-plans` | List own plans, paginated (`MealPlanListQuery`: `status`, `isFavorite`, `page`, `limit`); meals hydrated with recipe cards |
| POST | `/meal-plans` | Manual create (`CreateMealPlanInput`; meals may be `[]`) → 201 `{ plan }` |
| GET | `/meal-plans/:id` | Detail → 200 `{ plan }` with recipe cards; deleted recipe → `{ recipe: null, missing: true }` |
| PATCH | `/meal-plans/:id` | Full-array meal replace (move/remove/servings), name/dates/status/favorite edits → 200 `{ plan }` |
| DELETE | `/meal-plans/:id` | Delete → 200 `{ success: true }` |
| POST | `/meal-plans/ai-generate` | AI full-plan generation (`AIGenerateMealPlanInput`) → 201 `{ plan }` |
| POST | `/meal-plans/:id/swap-meal` | Replace exactly one meal (`SwapMealInput { mealId, notes? }`) → 200 `{ plan }` |
| POST | `/meal-plans/:id/optimize` | Pantry/reuse/nutrition optimization pass (body `{}`) → 200 `{ plan }` |

**Plan shape:** `{ id, userId, name, weekStartDate, weekEndDate, status: active|archived, isFavorite,
constraints | null, meals: [{ mealId, date, mealType, recipeId, servings 1–20,
source: manual|ai|swap|optimized, notes, recipe: card | null, missing }], createdAt, updatedAt }`.
`recipeId`s must reference existing **published** recipes (missing/unpublished → 404); out-of-range
dates, duplicate slots, or `weekEndDate <= weekStartDate` → 400. AI output is Zod-validated
server-side; hallucinated `recipeId`s outside the candidate pool are discarded; provider
failure/invalid output → 502/504 `AI_PROVIDER_ERROR` with nothing stored. Move/remove/servings
changes are pure DB writes (zero AI calls).

---

## `/grocery-lists` — smart grocery system (Workstream C)

All routes require auth. Same ownership/param rules as above. All math (consolidate → subtract
pantry) is deterministic application code (`services/groceryService.ts` + Dev-A `utils/units.ts`) —
never the LLM. Pantry stock is read via Dev-A `pantryService.listPantryForUser` (B/C never import
the `PantryItem` model). `budget` is display-only in v1; no `estimatedCost` is stored without real
price data. Imperial/unknown units (`oz`, `lb`, …) are display-only and never auto-merged.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/grocery-lists` | List own lists, paginated (`page`, `limit`, `status`) |
| GET | `/grocery-lists/:id` | Detail (list document with `items[]`) |
| POST | `/grocery-lists/generate` | Generate from `GenerateGroceryInput { mealPlanId }` → 201 list document |
| PATCH | `/grocery-lists/:id` | `UpdateGroceryListInput { name?, budget?, status? }` → 200 list |
| POST | `/grocery-lists/:id/items` | Add manual item (`AddGroceryItemInput`, stored `isManual: true`) → 200 list |
| PATCH | `/grocery-lists/:id/items/:itemId` | `UpdateGroceryItemInput { quantity?, unit?, category?, isPurchased? }` → 200 list |
| DELETE | `/grocery-lists/:id/items/:itemId` | Remove item → 200 list |
| POST | `/grocery-lists/:id/clear-purchased` | Remove all purchased items (body `{}`) → 200 list |
| POST | `/grocery-lists/:id/recalculate` | Re-run consolidate+subtract (body `{}`) → 200 list; preserves manual items + `isPurchased`/`movedToPantry` flags matched by `ingredientKey`+canonical unit |
| POST | `/grocery-lists/:id/purchased-to-pantry` | `PurchasedToPantryInput { itemIds }` → 200 `{ results, list }`; upserts via Dev-A `upsertPantryFromGrocery`, idempotent (double-POST is a no-op via `movedToPantry`) |

**Item shape:** `{ _id, ingredientKey, name, quantity, unit, category, sourceRecipeIds[],
isPurchased, isManual, estimated, movedToPantry }`. Generation scales recipe quantities by
`meal.servings / recipe.servings`, consolidates by `ingredientKey`+base unit (incompatible units
stay separate lines; missing quantities become `1 pcs` + `estimated: true`), then subtracts pantry
(`toBuy = max(0, required − pantry)` per convertible unit; fully-covered items excluded from the
list but reported as covered).

---

## Cross-cutting rules

- **Ownership:** edit/unpublish/delete on recipes → owner or admin only (FR-RECIPE-06). Enforced in backend middleware/controllers, never via UI hiding.
- **Uniqueness:** ratings and favorites are unique per `(recipe, user)` — updates, never duplicates.
- **Search visibility:** only `status=published` recipes appear in `/recipes`; drafts only via `/recipes/:id` to owner/admin.
- **Validation:** every request body/query validated by the matching Zod schema in `backend/src/types/index.ts` before reaching controllers.
- **Sanitization:** comment bodies are stripped of HTML/markup (`utils/sanitize.ts`) before length validation, so no markup is ever stored (NFR-SEC-06). All `req.body`/`req.query` also pass through `middleware/sanitizeInput.ts`, which drops MongoDB operator (`$…`) and dotted keys app-wide before any handler runs (NFR-SEC-05, defense-in-depth on top of per-field Zod validation).
- **Rate limiting:** `baseLimiter` (300 req/15 min/IP) applies app-wide; `commentLimiter` (20 req/10 min/IP) additionally guards `POST /recipes/:id/comments`, `PATCH /comments/:id`, `DELETE /comments/:id` (NFR-SEC-07).
- **CSRF:** the API is Bearer-JWT-only (no cookie-based session auth exists yet), which is inherently not CSRF-exploitable — a cross-site page cannot attach a header the browser doesn't send automatically. Revisit if/when M2's auth bridge adopts cookie-based sessions (SRS §9.4).