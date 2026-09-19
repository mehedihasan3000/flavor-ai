# FlavorAI — Admin Overview Dashboard Implementation Plan

> **Note:** This feature introduces an additive endpoint (`GET /api/v1/admin/overview`). Additive endpoint; needs Lead sign-off per contract freeze.

## 1. Goal & Scope

Implement an **"Overview" tab** as the **first tab** on the existing `/admin` moderation page (`frontend/src/app/admin/page.tsx`). The Overview dashboard provides platform health analytics and actionable moderation/system insights at a glance using real data strictly available in the database.

---

## 2. Feature Specifications

### 1. KPI Cards (8 Key Metrics - All-time Totals)
* **Total Users:** Total registered users (with breakdown: `user` vs `admin` roles).
* **Total Recipes:** Total recipes count (with breakdown: `published`, `draft`, `hidden`).
* **Recipe Sources:** Breakdown of AI-generated (`Recipe.source === "ai"`) vs manual (`Recipe.source === "manual"`).
* **Pending Moderation Queue:** Sum of currently `hidden` recipes + `moderated` comments requiring attention.
* **Total Comments:** Total comments across all recipes.
* **Total Favorites:** Total recipe favorite bookmarks created by users.
* **Platform Average Rating:** Mean rating value across all published recipes (`averageRating`).
* **AI Health Metrics:** AI generation success rate percentage + average latency in milliseconds (`AIGenerationLog`).

### 2. Data Visualizations & Charts (3 Charts)
* **User Growth Trend:** Daily count of new user signups over the selected time range (`User.createdAt`).
* **Recipe Creation Trend:** Daily count of recipes created over the selected time range (`Recipe.createdAt`).
* **AI Health Breakdown:** Distribution of AI generation call outcomes (`success`, `failed`, `timeout`) over the selected range (`AIGenerationLog.status`).

### 3. Top Tables (2 Tables)
* **Top 5 Recipes:** Published recipes sorted by highest `averageRating` (tie-broken by `favoriteCount`).
* **Top 5 Recipe Creators:** Owners with highest number of created recipes, displaying author name and count.

### 4. System & Moderation Feeds (2 Activity Lists)
* **Latest Activity Feed:** Recent platform events (new users, newly published recipes, and moderated comments), merged and sorted descending by timestamp (limit 10).
* **Recent AI Failures Feed:** Log of recent failed AI calls (`status != "success"`), displaying `errorCategory`, `latencyMs`, `model`, and `createdAt` (limit 10). Sensitive raw `input` is explicitly omitted.

### 5. Time Range Selector
* Options: `7d` | `30d` (default) | `90d`.
* Dynamically filters trend charts, AI health metrics, and activity feeds. (KPI totals remain all-time cumulative counts).

---

## 3. Out-of-Scope & Future Ideas

### Out-of-Scope (Not in Database Schema / Will NOT be built)
* Revenue, MRR, ARR, Subscriptions, or Payment data (No payment gateway or subscription model exists).
* Daily Active Users (DAU), Monthly Active Users (MAU), or Active Session Tracking (No session logs or `lastLoginAt` fields).
* Token Usage & Cost in USD (No token count or cost fields in `AIGenerationLog`).
* User Demographics or Geographic Locations (No IP or geographic fields on `User`).
* Persisted Admin Action Audit Log UI (Admin actions log to console output; no `AdminAuditLog` MongoDB collection exists).
* Bulk moderation actions, CSV exports, user details drawer, content gap analysis, dietary/allergy distribution, category/cuisine breakdown, or latency-over-time trend line.

### Future Schema-Change Ideas (Require Lead Approval)
* Add `lastLoginAt` timestamp to `User` model for DAU/MAU analytics.
* Add `promptTokens`, `completionTokens`, and `costUsd` fields to `AIGenerationLog` for cost management.
* Add an `AdminAuditLog` Mongoose model & collection to persist full administrative audit trails in the database.

---

## 4. API Specification & Contract Sync

* **Endpoint:** `GET /api/v1/admin/overview?range=7d|30d|90d`
* **Auth:** Required Bearer JWT with `role === "admin"` via `requireAdmin` middleware.
* **Validation:** Query param `range` validated via Zod (`AdminOverviewQuery`). Invalid range returns `400 VALIDATION_ERROR`.
* **Triple-Sync Contract Target:**
  1. `backend/src/types/index.ts` (Zod schemas: `AdminOverviewQuery`, `AdminOverviewResult`)
  2. `docs/API_CONTRACT.md` (Additive documentation under `/admin`)
  3. `frontend/src/lib/types.ts` (TypeScript interfaces: `AdminOverviewQuery`, `AdminOverviewData`, etc.)

### API Response JSON Shape
```json
{
  "range": "30d",
  "kpis": {
    "totalUsers": 150,
    "userRoles": { "user": 145, "admin": 5 },
    "totalRecipes": 320,
    "recipeStatus": { "published": 250, "draft": 50, "hidden": 20 },
    "recipeSource": { "ai": 210, "manual": 110 },
    "pendingModeration": { "hiddenRecipes": 20, "moderatedComments": 8, "total": 28 },
    "totalComments": 412,
    "totalFavorites": 890,
    "platformAverageRating": 4.62,
    "aiMetrics": { "total": 500, "successRate": 96.4, "averageLatencyMs": 1240 }
  },
  "trends": {
    "userGrowth": [ { "date": "2026-03-01", "count": 5 } ],
    "recipeCreation": [ { "date": "2026-03-01", "count": 12 } ]
  },
  "aiHealth": {
    "success": 482,
    "failed": 12,
    "timeout": 6
  },
  "topLists": {
    "topRecipes": [
      { "id": "60d...", "title": "Garlic Chicken", "averageRating": 4.9, "favoriteCount": 42, "status": "published" }
    ],
    "topCreators": [
      { "userId": "60a...", "name": "Chef Ada", "recipeCount": 18 }
    ]
  },
  "feeds": {
    "latestActivity": [
      { "type": "user_registered", "id": "...", "title": "Ada Lovelace", "createdAt": "2026-03-19T10:00:00Z" }
    ],
    "recentAiFailures": [
      { "id": "...", "model": "llama3-70b-8192", "errorCategory": "timeout", "latencyMs": 30000, "createdAt": "2026-03-19T11:00:00Z" }
    ]
  }
}
```

---

## 5. Technical Risks & Guardrails

1. **Mongoose Aggregation ID Casting:** `Model.aggregate()` does NOT auto-cast string IDs. Any `$match` against `owner`, `user`, or `recipe` MUST explicitly wrap IDs with `new Types.ObjectId(id)`.
2. **Contract Freeze:** Additive endpoint; needs Lead sign-off per contract freeze. Triple-sync must be exact.
3. **React Compiler & Effect Rule:** No `setState` calls synchronously inside `useEffect` bodies (use promise/async callbacks).
4. **Chart Library Compatibility:** Install `recharts` for Next.js 16 / React 19 compatibility. Ensure client component boundary (`"use client"`). If recharts fails build/SSR, fall back to responsive custom SVG/CSS charts.
5. **Continuous Series in Trends:** Zero-fill missing dates in trend queries so chart axes are unbroken.
6. **Data Privacy / Security:** Never expose `passwordHash` or raw AI prompt `input` fields in responses.

---

## 6. Commit Roadmap Checklist

- [x] **Commit 1:** `docs: add ADMIN_OVERVIEW_PLAN.md`
- [x] **Commit 2:** `feat(backend): add admin overview zod schemas and types`
- [ ] **Commit 3:** `feat(backend): add overview service for KPI counts and AI health aggregations`
- [ ] **Commit 4:** `feat(backend): add trends, top lists and activity feeds to overview service`
- [ ] **Commit 5:** `feat(backend): add GET /admin/overview controller and route with requireAdmin, plus Vitest tests (auth 401/403, invalid range 400, happy path shape, zero-fill days)`
- [ ] **Commit 6:** `docs: sync API_CONTRACT.md and frontend types for admin overview`
- [ ] **Commit 7:** `feat(frontend): add getAdminOverview api client and install recharts`
- [ ] **Commit 8:** `feat(frontend): add AdminOverviewPanel with KPI cards, range selector, loading/error states`
- [ ] **Commit 9:** `feat(frontend): add overview charts, top tables and activity feeds`
- [ ] **Commit 10:** `feat(frontend): make Overview the first admin tab, final polish, tick plan checklist`

---

## 7. Definition of Done

- [ ] All 10 commits exist with clear conventional commit messages, and git status is clean.
- [ ] `ADMIN_OVERVIEW_PLAN.md` exists in repository root with all checklist boxes ticked.
- [ ] Backend build (`npm run build`), lint (`npm run lint`), and tests (`npm test`) pass (28 existing suites + new overview tests).
- [ ] Frontend build (`npm run build`), lint (`npm run lint`), and tests (`npm test`) pass with zero warnings/errors.
- [ ] `GET /api/v1/admin/overview` returns 401 without Bearer token, 403 for non-admin, 200 for admin user.
- [ ] Zod schema in `backend/src/types/index.ts`, `docs/API_CONTRACT.md`, and `frontend/src/lib/types.ts` match identically.
- [ ] Overview tab is the default first tab in `/admin`; Recipes, Comments, and Users tabs continue to work flawlessly.
- [ ] No `setState` synchronously in `useEffect` bodies, no sensitive data leaked (`passwordHash`, raw `input`).
- [ ] Supports 7d, 30d, 90d range switching; loading, error, and empty states handled gracefully across all cards/charts.
- [ ] Seed data displays accurately in the Overview dashboard.
