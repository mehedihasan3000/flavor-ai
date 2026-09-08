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
→ 201 `{ recipe }`. `status` defaults to `draft`.

**Recipe response** adds: `id`, `owner`, `source`, `status`, `totalTimeMinutes`,
`averageRating`, `ratingCount`, `favoriteCount`, `commentCount`, `publishedAt`,
`createdAt`, `updatedAt`. PATCH uses `UpdateRecipeInput` (all optional).

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

**Failure handling:** timeout ≤30s → 504 or 502 `AI_PROVIDER_ERROR`, safeMessage only, retryable.

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

## Cross-cutting rules

- **Ownership:** edit/unpublish/delete on recipes → owner or admin only (FR-RECIPE-06). Enforced in backend middleware/controllers, never via UI hiding.
- **Uniqueness:** ratings and favorites are unique per `(recipe, user)` — updates, never duplicates.
- **Search visibility:** only `status=published` recipes appear in `/recipes`; drafts only via `/recipes/:id` to owner/admin.
- **Validation:** every request body/query validated by the matching Zod schema in `backend/src/types/index.ts` before reaching controllers.
- **Sanitization:** comment bodies are stripped of HTML/markup (`utils/sanitize.ts`) before length validation, so no markup is ever stored (NFR-SEC-06). All `req.body`/`req.query` also pass through `middleware/sanitizeInput.ts`, which drops MongoDB operator (`$…`) and dotted keys app-wide before any handler runs (NFR-SEC-05, defense-in-depth on top of per-field Zod validation).
- **Rate limiting:** `baseLimiter` (300 req/15 min/IP) applies app-wide; `commentLimiter` (20 req/10 min/IP) additionally guards `POST /recipes/:id/comments`, `PATCH /comments/:id`, `DELETE /comments/:id` (NFR-SEC-07).
- **CSRF:** the API is Bearer-JWT-only (no cookie-based session auth exists yet), which is inherently not CSRF-exploitable — a cross-site page cannot attach a header the browser doesn't send automatically. Revisit if/when M2's auth bridge adopts cookie-based sessions (SRS §9.4).