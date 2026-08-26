# FlavorAI 🍳

> **Smart recipe generator & food-sharing platform** — turn your pantry ingredients into validated, AI-generated recipes. Built with Next.js 16, Express 4, MongoDB, and Groq AI.

[![Backend Tests](https://img.shields.io/badge/backend_tests-204%20passing-brightgreen)](#)
[![Frontend Tests](https://img.shields.io/badge/frontend_tests-15%20passing-brightgreen)](#)
[![Build](https://img.shields.io/badge/build-passing-brightgreen)](#)
[![Lint](https://img.shields.io/badge/lint-0%20warnings-brightgreen)](#)

---

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Monorepo Layout](#monorepo-layout)
- [Quick Start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Demo Seed Data](#demo-seed-data)
- [Environment Variables](#environment-variables)
- [Running in Development](#running-in-development)
- [Running Tests](#running-tests)
- [API Overview](#api-overview)
- [Architecture Notes](#architecture-notes)
- [AI & Nutrition Disclaimers](#ai--nutrition-disclaimers)
- [Known Limitations](#known-limitations)
- [Security Notes](#security-notes)

---

## Features

| Feature | Status |
|---------|--------|
| AI Recipe Generation (Groq) | ✅ |
| Pantry-to-Plate ingredient matching | ✅ |
| AI Flavor Pairing Suggestions | ✅ |
| Manual Recipe CRUD (create, edit, draft, publish) | ✅ |
| Recipe Search & Discovery (filters, text, pagination) | ✅ |
| Ratings (1–5★, one per user, re-rate updates) | ✅ |
| Comments (with XSS sanitization, moderation) | ✅ |
| Favorites collection | ✅ |
| User Profile & Dietary Preferences | ✅ |
| User Dashboard (stats, draft management) | ✅ |
| Admin Moderation Panel | ✅ |
| JWT Auth Bridge (Better Auth ↔ Express) | ✅ |
| Image Upload (ImgBB) | ✅ |
| Responsive UI (mobile + desktop) | ✅ |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), TypeScript strict, Tailwind CSS v4 |
| UI Icons | `@gravity-ui/icons` |
| Auth Client | Better Auth (client session) |
| Backend | Express 4, TypeScript strict, ESM/NodeNext |
| Database | MongoDB + Mongoose 8 |
| Validation | Zod (server-side, schema-first) |
| AI Provider | Groq API (`openai/gpt-oss-120b` / `qwen/qwen3.6-27b` / `llama-3.3-70b-versatile`) |
| Image Hosting | ImgBB |
| Auth JWT | HS256 (shared secret, `jsonwebtoken`) |
| Testing (backend) | Vitest + Supertest + `mongodb-memory-server` |
| Testing (frontend) | Vitest + React Testing Library + jsdom |

---

## Monorepo Layout

```
flavor-ai/
├── backend/               Express REST API (Node ≥20, ESM)
│   ├── src/
│   │   ├── config/        env.ts (Zod validation), db.ts
│   │   ├── controllers/   authController, userController, recipeController,
│   │   │                  aiController, ratingController, commentController,
│   │   │                  favoriteController, adminController, uploadController
│   │   ├── middleware/     auth.ts, errorHandler.ts, validate.ts,
│   │   │                  sanitizeInput.ts, rateLimiters.ts
│   │   ├── models/        User, Recipe, Rating, Comment, Favorite, AIGenerationLog
│   │   ├── routes/        v1.ts (root router), per-domain route files
│   │   ├── services/      aiService.ts (Groq), imageService.ts (ImgBB)
│   │   ├── types/         index.ts (Zod schemas + DTOs — source of truth)
│   │   └── utils/         asyncHandler, params, password, regex, sanitize, recipeAccess
│   ├── scripts/           seed.ts (demo data)
│   ├── tests/             23 test files, 204 tests
│   ├── .env.example       Copy to .env and fill values
│   └── package.json
│
├── frontend/              Next.js App Router (TypeScript strict, Tailwind v4)
│   ├── src/
│   │   ├── app/           All page routes (App Router)
│   │   │   ├── (auth)/    sign-in, sign-up
│   │   │   ├── admin/     Admin moderation page
│   │   │   ├── dashboard/ User dashboard
│   │   │   ├── favorites/ Saved favorites
│   │   │   ├── generator/ AI recipe generator
│   │   │   ├── profile/   Profile & preferences
│   │   │   └── recipes/   List, detail, create, edit
│   │   ├── components/    auth/, recipes/, admin/, profile/, ui/
│   │   └── lib/           api.ts, types.ts, auth-context.tsx, jwt.ts, format.ts
│   ├── tests/             3 test files, 15 tests
│   └── package.json
│
├── docs/
│   └── API_CONTRACT.md    Frozen API shapes (endpoint/request/response reference)
├── TASKS.md               Living roadmap
├── AGENTS.md              Project rules for AI agents
└── FlavorAI - SRS.md      Requirements document
```

---

## Quick Start

### Prerequisites

- **Node.js ≥ 20** (`node --version`)
- **MongoDB** — [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) (free tier) or a local instance
- **Groq API key** — [console.groq.com](https://console.groq.com)
- **ImgBB API key** — [api.imgbb.com](https://api.imgbb.com) (free, for image uploads)

---

### Backend Setup

```bash
cd backend

# 1. Install dependencies
npm install

# 2. Copy the env template and fill in your values
cp .env.example .env
# Edit .env — see "Environment Variables" section below

# 3. Verify the build
npm run build

# 4. Start the dev server (runs on port 4000 by default)
npm run dev
```

The API will be available at `http://localhost:4000/api/v1`.  
Health check: `GET http://localhost:4000/api/v1/health`

---

### Frontend Setup

```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Create the frontend env file (minimal — just the API URL)
echo "NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1" > .env.local
echo "JWT_SECRET=dev-only-change-me-please" >> .env.local

# Note: JWT_SECRET MUST match backend/.env JWT_SECRET exactly for the
# auth bridge to work. Both sides sign/verify with the same HS256 secret.

# 3. Start the dev server (runs on port 3000 by default)
npm run dev
```

The app will be available at `http://localhost:3000`.

---

### Demo Seed Data

After both services are running (backend `.env` is required):

```bash
cd backend
npm run seed
```

This creates:
- **Admin account** — `admin@flavorai.demo` (role: `admin`)
- **Regular user** — `chef@flavorai.demo` (role: `user`)
- **3 published AI-generated recipes** with ratings, comments, and favorites

To sign in as a demo account, click the **"Demo Admin"** or **"Demo User"** buttons on the sign-in page.

---

## Environment Variables

### `backend/.env` (required — copy from `.env.example`)

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | API port | `4000` |
| `CORS_ORIGINS` | Allowed frontend origin(s) | `http://localhost:3000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb+srv://user:pass@cluster.mongodb.net/flavorai` |
| `JWT_SECRET` | Shared HS256 signing secret | `your-32-char-secret-key` |
| `JWT_ISSUER` | JWT `iss` claim | `flavorai` |
| `JWT_AUDIENCE` | JWT `aud` claim | `flavorai-api` |
| `JWT_EXPIRES_IN` | Token expiry | `15m` |
| `GROQ_API_KEY` | Groq API key | `gsk_...` |
| `GROQ_MODEL` | Groq model ID | `openai/gpt-oss-120b` |
| `AI_REQUEST_TIMEOUT_MS` | AI call timeout (≤30000) | `30000` |
| `IMGBB_API_KEY` | ImgBB API key | `abc123...` |
| `IMGBB_API_URL` | ImgBB upload endpoint | `https://api.imgbb.com/1/upload` |

> ⚠️ **Never commit `.env` to version control.** It is gitignored.

### `frontend/.env.local`

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:4000/api/v1` |
| `JWT_SECRET` | Must match backend `JWT_SECRET` | — |

---

## Running in Development

**Both services must run simultaneously:**

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

---

## Running Tests

### Backend

```bash
cd backend

npm test                          # Run all 23 test suites (204 tests)
npx vitest run tests/types.test.ts   # Run a single file
npm run lint                      # ESLint (0 warnings required)
npm run build                     # TypeScript build check
```

### Frontend

```bash
cd frontend

npm test           # Run all 3 test suites (15 tests)
npm run lint       # ESLint (0 warnings)
npm run build      # Next.js production build verification
```

---

## API Overview

Base URL: `http://localhost:4000/api/v1`

Full reference: [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md)

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/auth/token/verify` | Bearer JWT | Verify token, upsert user |
| `POST` | `/auth/logout` | Bearer JWT | Stateless logout (204) |

### Users
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/users/me` | ✅ | Get own profile + preferences |
| `PATCH` | `/users/me` | ✅ | Update profile/preferences |
| `GET` | `/users/me/stats` | ✅ | Dashboard stats (recipe counts, avg rating) |

### Recipes
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/recipes` | Optional | Paginated search with filters |
| `POST` | `/recipes` | ✅ | Create recipe (draft) |
| `GET` | `/recipes/:id` | Optional | Recipe detail |
| `PATCH` | `/recipes/:id` | Owner/Admin | Edit recipe |
| `DELETE` | `/recipes/:id` | Owner/Admin | Delete recipe |
| `PATCH` | `/recipes/:id/publish` | Owner | Publish draft |
| `PATCH` | `/recipes/:id/unpublish` | Owner | Unpublish → draft |

### AI
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/ai/recipes/generate` | ✅ | Generate AI recipe from pantry |
| `POST` | `/ai/flavor-pairings` | ✅ | Suggest flavor pairings |

### Ratings
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/recipes/:id/ratings` | Optional | Rating summary (+ `myRating` when authenticated) |
| `PUT` | `/recipes/:id/ratings` | ✅ | Rate or re-rate recipe (1–5) |
| `DELETE` | `/recipes/:id/ratings` | ✅ | Remove own rating |

### Comments
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/recipes/:id/comments` | — | Paginated comment list |
| `POST` | `/recipes/:id/comments` | ✅ | Add comment |
| `PATCH` | `/comments/:id` | Author | Edit own comment |
| `DELETE` | `/comments/:id` | Author/Admin | Delete comment |

### Favorites
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/favorites` | ✅ | List own favorites (published only) |
| `GET` | `/favorites/:recipeId` | ✅ | Check if a recipe is favorited |
| `PUT` | `/favorites/:recipeId` | ✅ | Add to favorites (idempotent) |
| `DELETE` | `/favorites/:recipeId` | ✅ | Remove from favorites |

### Upload
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/upload/image` | ✅ | Upload recipe image to ImgBB |

### Admin
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/admin/users` | Admin | List users with search/role filter |
| `GET` | `/admin/recipes` | Admin | List all recipes across statuses |
| `PATCH` | `/admin/recipes/:id` | Admin | Moderate recipe (published↔hidden) |
| `DELETE` | `/admin/recipes/:id` | Admin | Force-delete recipe |
| `GET` | `/admin/comments` | Admin | List comments with moderation filter |
| `PATCH` | `/admin/comments/:id` | Admin | Moderate comment (visible↔hidden) |
| `DELETE` | `/admin/comments/:id` | Admin | Force-delete comment |

### Error Envelope

All errors follow the standard shape:

```json
{
  "status": 400,
  "code": "VALIDATION_ERROR",
  "safeMessage": "Invalid input data.",
  "validation": { "title": "Too short" }
}
```

---

## Architecture Notes

### Auth Bridge

Better Auth handles client sessions. Protected API requests carry a signed **Bearer JWT** (HS256). `middleware/auth.ts` verifies signature, issuer, audience, and expiry → attaches `req.user`. The `JWT_SECRET` **must match** between frontend (mint) and backend (verify).

### AI Output Validation

All Groq AI output is **server-side Zod-validated** before storage. Invalid/incomplete output is rejected with a retryable error — it is never stored. Timeouts cap at 30 seconds.

### Recipe Status Flow

```
draft → published → hidden (admin)
      ↑              ↓
      └──────────────┘ (unpublish)
```

Only `published` recipes are visible in public discovery. Drafts are owner+admin only. Hidden recipes are admin-only.

### Indexes (ensure these exist in production)

`autoIndex` is disabled in production. Run `db.syncIndexes()` or use a migration before release:
- `User`: unique `email`, sparse unique `providerId`
- `Recipe`: unique `slug`, text index `(title, summary, ingredients.name)`, `(status, publishedAt)`, `(owner, createdAt)`
- `Rating`, `Favorite`: unique `(recipe, user)` compound
- `Comment`: `(recipe, createdAt)`
- `AIGenerationLog`: `(user, createdAt)`

---

## AI & Nutrition Disclaimers

> ⚠️ **IMPORTANT: Read before using AI-generated content**

1. **Allergy & Dietary Safety**: AI-generated recipes may not be safe for all dietary restrictions or allergies. The system attempts to avoid specified allergens but **cannot guarantee allergen-free results**. Always verify ingredients independently if you have food allergies.

2. **Nutrition Estimates**: Calorie and macro estimates are **approximate** and generated by AI without access to verified nutrition databases. They should not be used for medical, clinical, or precise dietary management. Consult a registered dietitian for accurate nutritional guidance.

3. **Recipe Quality**: AI-generated recipes have not been tested in a real kitchen. Cooking times, temperatures, and quantities may need adjustment. Use culinary judgment when following AI-generated instructions.

4. **Not Medical Advice**: Nothing in this application constitutes medical or nutritional advice. Consult a healthcare professional before making significant dietary changes.

---

## Known Limitations

| Area | Limitation | Notes |
|------|-----------|-------|
| AI Flavor Pairings | May produce generic suggestions for uncommon ingredient combos | Groq output quality varies by model |
| Nutrition Estimates | AI-estimated only, not from a verified database | Post-MVP: integrate a nutrition API |
| Image Upload | Relies on ImgBB free tier (32MB limit, public URLs) | Post-MVP: migrate to S3/Cloudinary |
| Admin Comment Context | Admin panel shows raw author/recipe IDs, not populated names | Minor UX gap, not a data integrity issue |
| Auth Sessions | Stateless JWT (no refresh tokens in MVP) | 15-minute expiry; re-sign-in required |
| No Rate Limits on GET Routes | Public read routes only covered by base limiter | Acceptable for MVP scale |
| Post-MVP Features | Taste-profile recommendations, food-photo nutrition analysis, meal planning, social feeds | Documented in SRS §6.4 |

---

## Security Notes

- **JWT secrets** are never exposed to browser JS
- **NoSQL injection** defended by `sanitizeInput.ts` (strips `$`-prefixed keys) + per-endpoint Zod validation
- **XSS** on comment bodies defended by `utils/sanitize.ts` (HTML tag stripping before storage)
- **IDOR** prevented: all mutations scoped to `req.user.id` or gated by `requireAdmin`
- **CSRF**: not applicable in MVP (Bearer JWT, no cookie sessions); revisit if cookie sessions are adopted
- **Rate limiting**: `baseLimiter` app-wide; stricter limiters on auth, AI, upload, and comment endpoints
- **Passwords** (if used via custom credentials): `crypto.scrypt` + `timingSafeEqual`, never stored/returned in plain text
- **Production checklist**:
  - [ ] Rotate `JWT_SECRET` to a cryptographically random value (≥32 chars)
  - [ ] Set `NODE_ENV=production`  
  - [ ] Enable HTTPS / TLS termination at reverse proxy
  - [ ] Run `db.syncIndexes()` before first deployment
  - [ ] Set `CORS_ORIGINS` to your production frontend domain only
  - [ ] Configure log aggregation (structured JSON logs via `morgan`)
  - [ ] Set up MongoDB Atlas IP allowlist and strong auth credentials
