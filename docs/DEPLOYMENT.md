# FlavorAI — Production Deployment Guide

This guide outlines the end-to-end production deployment procedure for **FlavorAI** (Next.js frontend + Express REST API), satisfying all release criteria outlined in `FlavorAI - SRS.md` (§20) and `TASKS.md` (Section 7).

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Prerequisites & External Services](#2-prerequisites--external-services)
3. [Environment Configuration](#3-environment-configuration)
4. [Database Initialization & Indexes](#4-database-initialization--indexes)
5. [Backend Deployment](#5-backend-deployment)
6. [Frontend Deployment](#6-frontend-deployment)
7. [Docker & Containerized Deployment](#7-docker--containerized-deployment)
8. [Security Hardening & Production Checklist](#8-security-hardening--production-checklist)
9. [Post-Deployment Smoke Tests](#9-post-deployment-smoke-tests)
10. [Troubleshooting & Rollback](#10-troubleshooting--rollback)

---

## 1. Architecture Overview

```
                        [ HTTPS / TLS Termination ]
                                     │
           ┌─────────────────────────┴─────────────────────────┐
           ▼                                                   ▼
┌───────────────────────┐                           ┌───────────────────────┐
│ Next.js App Router    │  Client requests          │ Express 4 REST API    │
│ (Vercel / Standalone) │ ────────────────────────> │ (Render/Railway/VPS)  │
│ Port: 3000 / 443      │  Bearer JWT in Auth header│ Port: 4000            │
└───────────────────────┘                           └───────────┬───────────┘
                                                                │
                 ┌───────────────────────────┬──────────────────┴────────────────────┐
                 ▼                           ▼                                       ▼
       ┌──────────────────┐        ┌──────────────────┐                    ┌──────────────────┐
       │  MongoDB Atlas   │        │     Groq AI      │                    │      ImgBB       │
       │ (Mongoose M0/M10)│        │ (LLM Structured) │                    │ (Image CDN Host) │
       └──────────────────┘        └──────────────────┘                    └──────────────────┘
```

---

## 2. Prerequisites & External Services

| Service | Purpose | Setup Link |
|---|---|---|
| **MongoDB Atlas** | Primary document database | [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas) |
| **Groq Cloud** | High-speed AI inference | [console.groq.com](https://console.groq.com) |
| **ImgBB API** | Recipe image hosting & CDN | [api.imgbb.com](https://api.imgbb.com) |
| **Vercel / Cloudflare** | Frontend Next.js deployment | [vercel.com](https://vercel.com) |
| **Render / Railway / Fly** | Backend Express API deployment | [render.com](https://render.com) |

---

## 3. Environment Configuration

### Backend (`backend/.env`)

| Variable | Required | Description | Production Example |
|---|:---:|---|---|
| `NODE_ENV` | **YES** | Environment mode | `production` |
| `PORT` | **YES** | Server listening port | `4000` (or injected by PaaS) |
| `CORS_ORIGINS` | **YES** | Allowed frontend domain(s) | `https://flavorai.example.com` |
| `MONGODB_URI` | **YES** | MongoDB connection string | `mongodb+srv://<user>:<pwd>@cluster.mongodb.net/flavorai?retryWrites=true&w=majority` |
| `JWT_SECRET` | **YES** | Cryptographically secure secret (≥32 chars) | `openssl rand -hex 32` |
| `JWT_ISSUER` | **YES** | JWT token issuer | `flavorai` |
| `JWT_AUDIENCE` | **YES** | JWT token audience | `flavorai-api` |
| `JWT_EXPIRES_IN` | **YES** | Access token lifespan | `15m` |
| `GROQ_API_KEY` | **YES** | Groq production API key | `gsk_prod_...` |
| `GROQ_MODEL` | **YES** | Model identifier | `openai/gpt-oss-120b` or `qwen/qwen3.6-27b` |
| `AI_REQUEST_TIMEOUT_MS` | **YES** | Provider timeout (max 30s) | `30000` |
| `IMGBB_API_KEY` | **YES** | ImgBB image upload API key | `prod_imgbb_key` |
| `IMGBB_API_URL` | **YES** | ImgBB upload endpoint | `https://api.imgbb.com/1/upload` |

### Frontend (`frontend/.env.production` / Vercel Env)

| Variable | Required | Description | Production Example |
|---|:---:|---|---|
| `NEXT_PUBLIC_API_URL` | **YES** | Public URL of Express API v1 | `https://api.flavorai.example.com/api/v1` |
| `JWT_SECRET` | **YES** | Must match backend `JWT_SECRET` | `(same secret as backend)` |

---

## 4. Database Initialization & Indexes

In production, Mongoose's `autoIndex` is disabled by design in [`src/config/db.ts`](../backend/src/config/db.ts) to prevent startup bottlenecks and index build locks.

### Step 1: Run Index Synchronization
Execute the index synchronization script once against your MongoDB Atlas cluster before enabling production traffic:

```bash
cd backend
# Make sure MONGODB_URI in .env points to production cluster
npm run db:indexes
```

This verifies and creates the following indexes:
- `User`: Unique index on `email`, sparse unique index on `providerId`
- `Recipe`: Unique index on `slug`, text index on `(title, summary, ingredients.name)`, compound `(status, publishedAt)`, compound `(owner, createdAt)`
- `Rating`: Compound unique index on `(recipe, user)`
- `Comment`: Compound index on `(recipe, createdAt)`
- `Favorite`: Compound unique index on `(recipe, user)`
- `AIGenerationLog`: Compound index on `(user, createdAt)`

### Step 2 (Optional): Seed Demo Content
To populate initial demo accounts (`admin@flavorai.demo` and `chef@flavorai.demo`) and curated AI recipes:

```bash
npm run seed
```

---

## 5. Backend Deployment

### Option A: Render.com / Railway

1. Create a **New Web Service** pointing to the repository.
2. Set **Root Directory** to `backend`.
3. Set **Build Command**:
   ```bash
   npm install && npm run build
   ```
4. Set **Start Command**:
   ```bash
   npm run start
   ```
5. Configure all Backend Environment Variables (see Section 3).
6. Enable Health Check path: `/api/v1/health` (HTTP 200).

### Option B: Linux VPS / PM2 / Nginx

1. Clone repo, install Node.js ≥20.
2. Build and start with PM2:
   ```bash
   cd backend
   npm install --omit=dev
   npm run build
   pm2 start dist/index.js --name "flavorai-api" --instances max --exec-mode cluster
   ```
3. Nginx Reverse Proxy with TLS:
   ```nginx
   server {
       server_name api.flavorai.example.com;

       location / {
           proxy_pass http://127.0.0.1:4000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

---

## 6. Frontend Deployment

### Option A: Vercel (Recommended)

1. Import git repository on Vercel.
2. Select **Root Directory**: `frontend`.
3. Framework Preset: **Next.js**.
4. Set Environment Variables:
   - `NEXT_PUBLIC_API_URL`: `https://api.flavorai.example.com/api/v1`
   - `JWT_SECRET`: `your_shared_jwt_secret`
5. Deploy. Vercel automatically builds static pages and configures CDN caching.

---

## 7. Docker & Containerized Deployment

To run FlavorAI in a containerized environment (e.g., AWS ECS, Kubernetes, or Docker Swarm):

```bash
# Build and start all services (Backend + Frontend + MongoDB)
docker-compose up --build -d

# Sync database indexes inside the container
docker-compose exec backend npm run db:indexes

# View logs
docker-compose logs -f
```

---

## 8. Security Hardening & Production Checklist

- [x] **HTTPS / TLS**: Forced TLS 1.3 across all subdomains.
- [x] **HTTP Headers**: `helmet` enabled on Express API (`X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`).
- [x] **CORS Lockdown**: Set strictly to the production frontend domain (no wildcard `*` allowed).
- [x] **Rate Limiting**:
  - Base limiter: 100 requests per 15 min.
  - Auth endpoints: 50 requests per 15 min.
  - AI Generation: 10 requests per 10 min.
  - Image Uploads: 15 uploads per 15 min.
  - Comments: 20 mutations per 10 min.
- [x] **NoSQL Injection Defense**: Recursive `sanitizeMongoOperators` strips `$` and `.` keys on all incoming payloads.
- [x] **XSS Sanitization**: HTML tag stripping on all comment bodies prior to validation and storage.
- [x] **Authorization Guards**: Resource ownership checks on all mutations; role-based admin guards on `/admin/*`.
- [x] **Secrets Management**: No plaintext passwords or private API keys stored in source control.

---

## 9. Post-Deployment Smoke Tests

Run these checks immediately following deployment:

1. **API Health Check**:
   ```bash
   curl -i https://api.flavorai.example.com/api/v1/health
   # Expected: HTTP 200 with { "status": "ok", "db": { "connected": true } }
   ```
2. **Public Discovery Route**:
   ```bash
   curl -i https://api.flavorai.example.com/api/v1/recipes?limit=5
   # Expected: HTTP 200 with paginated recipes array
   ```
3. **Frontend Landing Page**:
   - Navigate to `https://flavorai.example.com/` in browser.
   - Verify page loads with 0 console errors and responsive layout.
4. **Interactive AI Generation Flow**:
   - Log in with test account.
   - Go to `/generator` → Enter `chicken, garlic, olive oil` → Click "Generate Recipe".
   - Confirm structured recipe returns within 30 seconds with pantry match badges.
5. **Community Interaction**:
   - Submit a 5★ rating and verify average score updates.
   - Post a comment and verify it renders cleanly.

---

## 10. Troubleshooting & Rollback

| Symptom | Cause | Solution |
|---|---|---|
| `401 UNAUTHORIZED: Invalid token` | `JWT_SECRET` mismatch | Ensure `JWT_SECRET` is identical in both frontend and backend envs. |
| `502 AI_PROVIDER_ERROR` | Groq key exhausted/invalid | Verify `GROQ_API_KEY` on console.groq.com and check quotas. |
| `429 TOO_MANY_REQUESTS` | Rate limit hit | Wait out the window duration or scale limiter window in `rateLimiters.ts`. |
| Mongoose `MongoServerSelectionError` | MongoDB IP whitelist blocked | Add server public IP / `0.0.0.0/0` (with strong user credentials) to Atlas Access List. |
