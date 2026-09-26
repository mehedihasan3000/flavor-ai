# FlavorAI 🍳

**Turn what's already in your kitchen into a full week of meals.**

FlavorAI is a recipe and meal-planning website. You tell it what ingredients you have,
what you like to eat, and how you want to eat — and it helps you cook real meals, plan
your week, and shop without buying things twice.

You can also share your own recipes, rate and review other people's, and browse what the
community has made.

---

## Table of Contents

- [What You Can Do](#what-you-can-do)
- [Why It's Useful](#why-its-useful)
- [How It's Built](#how-its-built)
- [Getting Started](#getting-started)
- [Demo Accounts](#demo-accounts)
- [Accuracy & Safety](#accuracy--safety)
- [Things to Know](#things-to-know)
- [Project Documents](#project-documents)

---

## What You Can Do

### Get recipe ideas from what you already have

Tell FlavorAI what's in your fridge and it will suggest a complete recipe — ingredients,
step-by-step instructions, cooking time, and nutrition estimates. It also tells you which
of your ingredients you actually used and which ones you still need to buy.

### Ask the AI Assistant anything

There's a chat assistant that knows your kitchen. You can say *"I have chicken, rice, and
spinach — what can I make?"* or *"What's a good high-protein dinner?"* and it answers using
your real pantry, your saved recipes, and your dietary preferences.

### Snap a photo of your food and get its nutrition

Upload a picture of a meal and FlavorAI estimates the calories, protein, carbs, and fat,
plus what's likely in it. Useful for tracking what you eat without weighing everything.

### Plan your meals for the week

Build a weekly meal plan and let FlavorAI fill in the meals for you. Happy with most of it?
You can swap a single meal you don't like, or ask it to optimise the whole week to use up
ingredients before they spoil and to better hit your nutrition targets.

### Get a smart shopping list

Turn a meal plan into a shopping list automatically. FlavorAI:

- adds up everything you need across the week
- **subtracts what you already have at home** — so you don't buy a third bottle of olive oil
- groups items together (produce, dairy, spices) so the store trip is quicker
- lets you tick things off as you shop
- moves what you bought into your pantry when you get home

### Keep track of your pantry

Your own digital pantry. Add what you have, how much, and roughly when it expires. FlavorAI
shows you what to use up first, and lets you tick ingredients off as you cook them.

### Get a diet and nutrition plan

Enter your height, weight, age, and activity level. FlavorAI calculates your BMI, estimates
how many calories and grams of protein you need, and suggests a simple portion plan. It
adapts to vegetarian, vegan, and dairy-free preferences.

### Find recipes you'll actually like

Already have favourites or "no fish" rules? Taste Match ranks existing recipes against what
you like, so you can find a new meal that fits your taste rather than scrolling forever.

### Share with other cooks

Write your own recipes, save drafts while you work on them, and publish when they're ready.
Other members can rate them 1–5 stars, leave comments, and save them to their favourites.

---

## Why It's Useful

| Problem | How FlavorAI helps |
|---|---|
| "I have food but no idea what to make" | Generates a full recipe from your actual ingredients |
| Food going bad in the fridge | Highlights what to use first and plans meals around it |
| Buying the same ingredient twice | Shopping lists subtract what you already have at home |
| Unclear what a meal contains | Photo analysis estimates calories and macros |
| Planning meals takes forever | Generates a full week, and swaps one meal on request |
| Guessing at daily nutrition targets | Calculates a calorie and protein target from your body and activity |
| Endless scrolling to find recipes you like | Taste Match ranks recipes by your preferences |

---

## How It's Built

**Made with:** Next.js 16 · React 19 · TypeScript · Tailwind CSS v4 · Express 4 · MongoDB ·
Groq AI · Vitest

**The project has two parts:**

- **`backend/`** — the API server. Handles accounts, recipes, reviews, the pantry, meal
  plans, shopping lists, and all the AI features. Runs on port `4000`.
- **`frontend/`** — the website you actually use. Runs on port `3000`.

The two run separately and talk to each other over the internet. There is no root-level
build — each part is set up and run on its own.

**Quality checks:** 389 automated tests on the backend and 99 on the frontend, all passing,
plus strict type checking and linting with zero warnings.

---

## Getting Started

You'll need **Node.js 20 or newer**, a **MongoDB** database (a free
[MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account works), a free
**Groq API key** from [console.groq.com](https://console.groq.com), and a free
**ImgBB API key** from [api.imgbb.com](https://api.imgbb.com) for recipe photos.

### 1. Start the server

```bash
cd backend
npm install
cp .env.example .env     # then open .env and fill in your keys
npm run dev              # runs on http://localhost:4000
```

Check it's alive: visit `http://localhost:4000/api/v1/health` — you should see `"ok"`.

### 2. Start the website

```bash
cd frontend
npm install
cp .env.example .env.local   # then fill in the API address and the same JWT_SECRET
npm run dev              # runs on http://localhost:3000
```

Then open **http://localhost:3000** in your browser.

> **Important:** the `JWT_SECRET` value must be **identical** in both files. That's how the
> two parts confirm you are signed in. If they don't match, nothing that requires signing in
> will work.

### 3. Or use Docker

If you have Docker installed, one command starts everything (database, server, and website):

```bash
docker compose up --build
```

### Environment variables at a glance

| Variable | Where | What it's for |
|----------|-------|---------------|
| `MONGODB_URI` | backend | Your database connection string — **required** |
| `JWT_SECRET` | **both** | Shared sign-in key — **required**, must match |
| `GROQ_API_KEY` | backend | Enables the AI features |
| `GROQ_MODEL` / `GROQ_MODEL_FOR_IMAGE` | backend | Which AI model to use (text / photos) |
| `AI_REQUEST_TIMEOUT_MS` | backend | How long to wait for the AI (default 60s) |
| `IMGBB_API_KEY` | backend | Recipe photo uploads |
| `CORS_ORIGINS` | backend | Which website addresses are allowed to connect |
| `NEXT_PUBLIC_API_URL` | frontend | Where the backend lives (default `http://localhost:4000/api/v1`) |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | frontend | Optional — enables "Sign in with Google" |

Full list and descriptions: `backend/.env.example` and `frontend/.env.example`.

### Everyday commands

| What you want | Type this |
|---------------|-----------|
| Start the server | `cd backend && npm run dev` |
| Start the website | `cd frontend && npm run dev` |
| Run all the tests | `npm test` (in either folder) |
| Check for errors | `npm run lint` then `npm run build` (in either folder) |
| Load the sample content | `cd backend && npm run seed` |
| Update database indexes before going live | `cd backend && npm run db:indexes` |

---

## Demo Accounts

Load the sample content to try the site without creating real recipes:

```bash
cd backend
npm run seed
```

This safely creates (re-running is fine):

| Account | Email | Password |
|---|---|---|
| Admin | `admin@flavorai.com` | `admin123456` |
| Regular user | `chef@flavorai.com` | `password123` |

It also creates **3 published recipes** with ratings, comments, and saves already attached,
so the site doesn't look empty. The sign-in page has **"Demo User"** and **"Demo Admin"**
buttons that fill these details in for you.

---

## Accuracy & Safety

Please read this before relying on FlavorAI's output.

1. **Allergies and dietary needs are never guaranteed.** The AI tries to avoid the
   ingredients you tell it to avoid, but it can make mistakes. If you have a food allergy,
   check every ingredient yourself before cooking. Warnings are shown throughout the app
   for this reason — please don't skip them.

2. **Nutrition numbers are estimates.** Calories, protein, carbs, and fat — including
   anything from a photo — are AI guesses. They are not from a verified nutrition database.
   Don't use them for medical or clinical decisions. Talk to a dietitian or doctor for
   advice that matters.

3. **BMI and calorie targets are screening tools**, not diagnoses. They use standard
   formulas and can be wrong for a lot of people.

4. **Recipes are untested.** Nobody has cooked these in a real kitchen yet. Timings,
   temperatures, and quantities may need adjusting. Trust your cooking judgement.

5. **Nothing here is medical advice.** For significant dietary changes, speak to a
   healthcare professional.

---

## Things to Know

| Area | What's the case |
|------|-----------------|
| Food photos | Uploads are large. When hosted on Vercel there's a ~4.5 MB limit, so photos are automatically shrunk on your device before sending |
| Photo analysis speed | The AI reads the image in stages, so it can take a few seconds. That's normal |
| AI quality | The AI writes well but isn't perfect. Unusual ingredient combinations can produce odd suggestions |
| Shopping list budget | You can type a budget, but prices aren't looked up — it's a display-only field |
| Signing you out | Sessions last a while with no "remember me" flow, so you may need to sign in again after a long break |
| Recipe photos | Free ImgBB hosting — photos are publicly viewable by URL |
| Not built yet | Following other cooks, notifications, and a social feed are planned but not ready |

---

## Project Documents

More detail lives in these files if you're looking for something specific:

| File | What's in it |
|------|-------------|
| [`docs/API_CONTRACT.md`](docs/API_CONTRACT.md) | Every endpoint the server offers, with exact request and response formats |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | How to put the site online |
| [`TASKS.md`](TASKS.md) | Project roadmap, what's done, what's next |
| [`FlavorAI - SRS.md`](FlavorAI%20-%20SRS.md) | The original requirements document |
| [`IMPLEMENTATION_PLAN.md`](IMPLEMENTATION_PLAN.md) | The technical plan |
| [`AGENTS.md`](AGENTS.md) | Conventions and rules for AI coding tools working on this repo |
| [`ERROR.md`](ERROR.md) | Record of problems hit and how they were solved |
