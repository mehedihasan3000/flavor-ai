# Implementation Plan - FlavorAI: Smart Recipe Generator & Food Sharing Platform

This implementation plan outlines the architecture, project structure, component breakdown, database models, API specification, and step-by-step delivery strategy for **FlavorAI**, based on the [FlavorAI - SRS.md](file:///c:/Users/user/Best%20Web%20Development%20v1/z%20EndGame%2013/flavor-ai/FlavorAI%20-%20SRS.md) document.

## User Review Required

> [!IMPORTANT]
> **Monorepo Architecture & Tech Stack Confirmation**
> - **Frontend**: Next.js (TypeScript, Tailwind CSS, Better Auth, Gravity UI Icons)
> - **Backend**: Express.js REST API (TypeScript, Node.js, MongoDB + Mongoose, Zod validation, JWT middleware)
> - **AI Integration**: Structured AI recipe generation (Groq AI API) enforced with Zod schemas and fallback error handling.
> - **Project Structure**: Separate top-level `frontend` (Next.js client) and `backend` (Express.js API) folders.

> [!WARNING]
> **Authentication Bridge Design**
> - Better Auth handles user registration, session management, and login on the client.
> - Protected Express API requests carry signed Bearer JWT tokens. Express middleware verifies signatures, extracts user context, and enforces role/ownership authorization.

## Open Questions

> [!NOTE]
> 1. **AI Provider Selection**: I have Groq AI API key available for testing.
> 2. **Image Storage Service**: We will use imgbb image hosting platform for uploading image. 
> 3. **Monorepo Layout**: separate top-level `frontend` and `backend` folders.

## Proposed Changes

We will build the codebase from scratch following the SRS specifications.

---

### Phase 1: Shared Models & Types Setup

#### [NEW] [backend/src/types/index.ts](file:///c:/Users/user/Best%20Web%20Development%20v1/z%20EndGame%2013/flavor-ai/backend/src/types/index.ts)
- Shared TypeScript interfaces, enums, and Zod validation schemas for:
  - User preferences (`DietaryPreferences`, `Allergies`, `NutritionalGoals`)
  - Recipe generation input (`AIRecipePromptInput`, `IngredientInput`)
  - AI Recipe Output validation (`AIRecipeOutputSchema`)
  - Rating, Comment, and Favorite DTOs

---

### Phase 2: Express Backend API (`backend`)

#### [NEW] [backend/src/server.ts](file:///c:/Users/user/Best%20Web%20Development%20v1/z%20EndGame%2013/flavor-ai/backend/src/server.ts)
- Express application setup, CORS, rate limiting (`express-rate-limit`), error handling middleware, logging.

#### [NEW] [backend/src/config/db.ts](file:///c:/Users/user/Best%20Web%20Development%20v1/z%20EndGame%2013/flavor-ai/backend/src/config/db.ts)
- Mongoose MongoDB connection setup with auto-index creation and reconnect retry logic.

#### [NEW] [backend/src/models/](file:///c:/Users/user/Best%20Web%20Development%20v1/z%20EndGame%2013/flavor-ai/backend/src/models)
- `User.ts`: Mongoose User schema (profile, dietary preferences, roles `user` | `admin`).
- `Recipe.ts`: Recipe schema with text index (`title`, `summary`, `ingredients.name`), owner ref, status (`draft` | `published` | `hidden`), rating/comment aggregations.
- `Rating.ts`: Rating schema with unique compound index `(recipeId, userId)`.
- `Comment.ts`: Comment schema with moderation status.
- `Favorite.ts`: Favorite schema with unique compound index `(recipeId, userId)`.
- `AIGenerationLog.ts`: AI request audit log and latency tracking.

#### [NEW] [backend/src/middleware/auth.ts](file:///c:/Users/user/Best%20Web%20Development%20v1/z%20EndGame%2013/flavor-ai/backend/src/middleware/auth.ts)
- JWT verification middleware: extracts `Authorization: Bearer <jwt>`, decodes user details, attaches `req.user`, enforces resource ownership and admin privilege checks.

#### [NEW] [backend/src/services/aiService.ts](file:///c:/Users/user/Best%20Web%20Development%20v1/z%20EndGame%2013/flavor-ai/backend/src/services/aiService.ts)
- AI service adapter interfacing with Groq API (`llama-3.3-70b-versatile` / `mixtral-8x7b-32768`).
- Prompt builder enforcing strict JSON schema output.
- Server-side Zod validation on AI output with fallback retry and safe error reporting (`FR-AI-07`, `FR-AI-08`).
- Pantry ingredient matching calculator (`usedIngredients` vs `missingIngredients`).
- Flavor-pairing suggestion generator (`FR-FLAVOR-01`).

#### [NEW] [backend/src/services/imageService.ts](file:///c:/Users/user/Best%20Web%20Development%20v1/z%20EndGame%2013/flavor-ai/backend/src/services/imageService.ts)
- ImgBB integration for recipe image uploading and hosting.

#### [NEW] [backend/src/controllers/](file:///c:/Users/user/Best%20Web%20Development%20v1/z%20EndGame%2013/flavor-ai/backend/src/controllers)
- `authController.ts`: Better Auth integration & token verification.
- `userController.ts`: Profile & food preference management (`/api/v1/users/me`).
- `recipeController.ts`: Recipe CRUD, draft/publish actions, paginated search & multi-field filtering (`q`, `category`, `cuisine`, `diet`, `sort`, `page`, `limit`).
- `aiController.ts`: Handlers for `/api/v1/ai/recipes/generate` and `/api/v1/ai/flavor-pairings`.
- `ratingController.ts`: Rating creation/update/deletion with aggregate rating score recalculation.
- `commentController.ts`: Add, list, and delete comments.
- `favoriteController.ts`: Add, list, and remove user favorites.
- `adminController.ts`: Content moderation endpoints.

---

### Phase 3: Next.js Web Frontend (`frontend`)

#### [NEW] [frontend/src/app/](file:///c:/Users/user/Best%20Web%20Development%20v1/z%20EndGame%2013/flavor-ai/frontend/src/app)
- App Router pages & views:
  - `page.tsx`: Landing page highlighting pantry-to-plate AI recipe generation, food waste reduction USP, featured recipes, and call-to-actions.
  - `(auth)/sign-in/page.tsx`, `(auth)/sign-up/page.tsx`: Authentication flows powered by Better Auth.
  - `generator/page.tsx`: Interactive AI recipe generator with pantry ingredient tag inputs, dietary checkboxes, cooking time & difficulty options.
  - `recipes/page.tsx`: Community search & discovery hub with keyword search, filter sidebar, sort dropdown, and paginated grid.
  - `recipes/[id]/page.tsx`: Recipe detail page showing ingredients list, step-by-step instructions, nutrition estimate badge, allergy disclaimer, interactive rating stars, comment thread, and favorite button.
  - `recipes/create/page.tsx`, `recipes/[id]/edit/page.tsx`: Manual recipe creation and editing form.
  - `dashboard/page.tsx`: User dashboard managing personal drafts, published recipes, and creation stats.
  - `favorites/page.tsx`: Saved favorites collection page.
  - `profile/page.tsx`: Profile settings & dietary preferences customization.
  - `admin/page.tsx`: Content moderation dashboard.

#### [NEW] [frontend/src/components/](file:///c:/Users/user/Best%20Web%20Development%20v1/z%20EndGame%2013/flavor-ai/frontend/src/components)
- UI components designed with rich aesthetics, glassmorphism, responsive Tailwind CSS layouts, and Gravity UI Icons:
  - `Navbar.tsx`, `Footer.tsx`
  - `IngredientTagInput.tsx`: Dynamic tag selector for pantry ingredients.
  - `RecipeCard.tsx`: Vibrant card with difficulty badge, prep time, star rating, and dietary tags.
  - `NutritionBadge.tsx`: Visual macro breakdown (calories, protein, carbs, fat) with disclaimer note.
  - `RatingStars.tsx`: Interactive 1-5 star rating component.
  - `CommentSection.tsx`: Comment submission & moderation list.
  - `DisclaimerBanner.tsx`: Prominent medical/allergy safety disclaimer banner.

---

## Verification Plan

### Automated Tests
- **Backend Unit Tests**: Jest/Vitest tests for Zod validation schemas, pantry matching logic, and AI response parser.
- **API Integration Tests**: Supertest suite testing `/api/v1/recipes`, `/api/v1/ai/recipes/generate`, `/api/v1/favorites`, `/api/v1/ratings`, and JWT authorization guards.
- **Frontend Form Tests**: React Testing Library checks for generator form submission, validation error displays, and auth states.

### Manual Verification
1. **Full Generation & Publishing Flow**:
   - Register/Sign in -> Navigate to `/generator`.
   - Input ingredients: `chicken breast, garlic, olive oil, spinach`, select `Gluten-Free` and `High-Protein`.
   - Submit -> verify loading state -> inspect generated structured recipe -> save as draft -> edit -> publish.
2. **Discovery & Community Interaction Flow**:
   - Browse `/recipes` -> filter by `Gluten-Free` -> search for "chicken".
   - Open recipe detail -> verify nutrition breakdown & allergy disclaimers.
   - Sign in as a different user -> submit a 5-star rating -> add comment -> add to favorites.
   - Verify average rating updates and favorite recipe appears in `/favorites`.
3. **Security & Authorization Verification**:
   - Attempt to edit/delete User 1's recipe as User 2 via direct API call -> verify `403 Forbidden`.
   - Re-rate a recipe as the same user -> verify existing rating updates without duplicating.
