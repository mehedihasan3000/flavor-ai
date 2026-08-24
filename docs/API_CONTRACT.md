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
| POST | `/auth/token/verify` | public | Exchange/verify signed JWT → user context |
| POST | `/auth/logout` | required | Revoke current session/token |

Contract details (issuer/audience/expiry) finalized in M2 per the auth bridge design
(AGENTS.md, SRS §9.4). Express receives the signed JWT and verifies via
`backend/src/middleware/auth.ts`.

---

## `/users` — profile & preferences (M2)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/users/me` | required | Own profile + dietary preferences (FR-AUTH-06) |
| PATCH | `/users/me` | required | Update name, avatar, bio, preferences (FR-AUTH-06) |

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

**Failure handling:** timeout ≤30s → 504 or 502 `AI_PROVIDER_ERROR`, safeMessage only, retryable.

---

## `/recipes/:id/ratings` — ratings (M4)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PUT | `/recipes/:id/ratings` | required | Create or update own rating (idempotent, FR-RATE-02/03) |
| DELETE | `/recipes/:id/ratings` | required | Remove own rating (FR-RATE-03) |
| GET | `/recipes/:id/ratings` | public | Summary `{ averageRating, ratingCount }` |

Body: `{ "value": 5 }` (integer 1–5). Owner rating own recipe → 403 (FR-RATE-05).
Response on PUT → 200 `{ rating: { id, recipe, user, value, createdAt, updatedAt }, summary }`.

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

---

## `/favorites` — favorites (M4)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/favorites` | required | Own favorites, paginated (FR-FAV-03) |
| PUT | `/favorites/:recipeId` | required | Add favorite (idempotent, unique per user) |
| DELETE | `/favorites/:recipeId` | required | Remove favorite |

Unpublished/deleted recipes are filtered out of favorites lists (FR-FAV-04).

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