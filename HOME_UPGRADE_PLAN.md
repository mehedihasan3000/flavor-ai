# Home Page Upgrade Plan (`feature/home-upgrade`)

## Goal
Upgrade the FlavorAI Home Page (`/`) to provide a stunning, interactive, real-data-driven user experience. 
**FRONTEND ONLY**: No backend changes, no API contract modifications, no new endpoints.

---

## Scope Lock (Strict Boundaries & Rules)

1. **NAVBAR: DO NOT MODIFY**
   - Remove all navbar work from the plan. No scroll blur/border, no mobile menu/hamburger changes, no new links, no layout modifications.
   - "0. Navbar" stays exactly as it is today. Commit 4 focus: Hero stagger and floating animations only.

2. **HOME PAGE ONLY ALLOWED FILES**
   - `frontend/src/app/page.tsx`
   - `frontend/src/components/home/*` (NEW components used exclusively by the home page)
   - `frontend/src/app/globals.css`: ADDITIVE ONLY, new keyframes/classes with a `home-` prefix. Do not edit or remove existing rules/tokens.
   - `frontend/package.json` & `package-lock.json` (only for installing the `motion` package)
   - `HOME_UPGRADE_PLAN.md`

3. **FORBIDDEN (Do NOT edit, touch, or auto-format)**
   - Navbar and layout components (`frontend/src/components/layout/*`)
   - Root layout (`frontend/src/app/layout.tsx`)
   - All other pages (`/recipes`, `/generator`, `/assistant`, `/nutrition-analyzer`, `/diet-plan`, `/dashboard`, `/profile`, `/favorites`, `/admin`, auth pages)
   - UI primitives (`frontend/src/components/ui/*`: reuse only, do not modify)
   - `frontend/src/lib/*`
   - `backend/*`
   - `docs/*`

4. **MOTION SCOPE**
   - `MotionProvider` wraps ONLY the home page content inside `page.tsx` or `components/home/`. Do NOT place it in `layout.tsx` or any global layout file.

5. **FOOTER**
   - Note: Verified `Footer` lives in `frontend/src/app/layout.tsx` (shared layout). Per Rule E, do NOT edit `layout.tsx` or `components/layout/footer.tsx`. Footer changes are skipped.

6. **GENERATOR INTEGRATION**
   - `/generator` already reads `?ingredients=`. Do NOT edit any generator files. Link to `/generator?ingredients=...` from the home page.

7. **`next.config.ts`**
   - Do NOT edit `next.config.ts` unless explicitly approved after proving the hero image issue root cause.

8. **UI PRIMITIVES**
   - If existing UI primitives need changes, create a home-specific wrapper in `frontend/src/components/home/` instead of modifying `frontend/src/components/ui/*`.

9. **PRE-COMMIT VERIFICATION**
   - Before EVERY commit, run `git diff --name-only develop...HEAD` and verify every changed path is strictly within the allowed list. Revert any stray modifications immediately.

10. **DEFINITION OF DONE EXTRA CHECK**
    - `git diff --name-only develop...HEAD` shows only allowed files.

---

## Page Structure
0. **Navbar**: UNCHANGED (do not touch).
1. **Hero**: Headline, subheadline, CTAs (`/generator`, `/nutrition-analyzer`), real recipe count, right-side **Auto-Sliding 5-Second Top-Rated Recipe Carousel** with manual dot navigation and pause-on-hover.
2. **Pantry Quick Input**: Quick ingredient input + suggestion chips navigating to `/generator?ingredients=a,b,c`.
3. **Ingredient Marquee**: Thin CSS-only scrolling strip of fresh ingredient icons/pills.
4. **AI Tools Showcase**: 4 feature cards (`/generator`, `/assistant`, `/nutrition-analyzer`, `/diet-plan`).
5. **How It Works**: 3-step workflow guide (Mock UI carrying explicit `"Example"` label).
6. **Community Recipes**: Latest/Top rated toggle, category & dietary filter chips, fallback placeholders, logged-in favorites strip.
7. **FAQ Accordion**: Honest answers regarding nutrition accuracy, allergies, saving recipes, and pantry matching.
8. **Final CTA**: Exactly ONE call-to-action banner ("Ready to cook what you already have?").
9. **Footer + Disclaimer**: Lives in `layout.tsx` — UNCHANGED per Scope Lock Rule E.

---

## Dynamic vs Static
- **Dynamic Data**: Real community recipe total (`result.total` from `listRecipes`), latest/top-rated recipe list, hero top-rated dish carousel (top 5 recipes), recipe count-up display, logged-in user favorites strip.
- **Static Content**: AI tools cards, How it works steps/examples, FAQ accordion items, ingredient marquee list, category & dietary filter chip lists.

---

## Real Data Rules
- Remove all fake stats/quotes from `page.tsx` (`"4.9/5"`, `"15K+ Cook Reviews"`, `"50K+ Recipes Generated"`, `"98% Pantry Match Rate"`, `"Sarah K., Verified Cook"`).
- Hero showcase carousel fetches the **top 5 highest-rated published recipes** via `listRecipes({ sort: "highest-rated", limit: 5 })`.
- If fewer than 5 recipes exist in the DB, gracefully cycle through available items or use gradient + icon fallbacks.
- Server-side data fetches use graceful fallback handling (hide section if empty/error, never crash the page).

---

## Animation Rules
- Package: `motion` (imported from `"motion/react"`).
- `<LazyMotion features={domAnimation} strict>` + `<MotionConfig reducedMotion="user">` inside `MotionProvider` scoped to home components only.
- Use `m` components (`m.div`, `m.section`) to keep bundle minimal.
- Animate only opacity and transform (`y`, `x`, `scale`). CLS must stay ~0.
- Hero carousel crossfade transitions use `AnimatePresence mode="wait"` with lightweight opacity/transform slides.
- **Auto-slide 5-Second Carousel**:
  - Auto-advance index every 5000ms.
  - Pauses automatically when hovered (`onMouseEnter`/`onMouseLeave`) or focused.
  - Includes manual dot navigation and next/previous controls.
  - **React Compiler Compliance**: Zero synchronous `setState` inside `useEffect` bodies. `setInterval` state updater (`setIndex(prev => ...)`) runs strictly inside the async timer callback; cleanup handled in `useEffect` return function (`clearInterval`).
- Hero LCP elements must NOT start at opacity 0. Below-the-fold reveals include a `<noscript>` fallback style.
- Floating animation loops: 6-8s, max 6-8px transform offset, `ease-in-out`, repeat infinite.
- Recipe count count-up ONLY for real numbers.

---

## Accessibility
- Hero carousel includes `aria-roledescription="carousel"`, slide labels (`aria-label="Slide X of Y"`), and keyboard navigable dots/arrows.
- FAQ accordion uses native `<button>` with `aria-expanded` and `aria-controls`.
- Icon buttons have explicit `aria-label` attributes.
- Visible focus rings (`focus-visible:outline...`) on all interactive elements.
- Marquee is set to `aria-hidden="true"` and pauses on `:hover` or `:focus-within`.
- Reduced motion: all movement disabled when `prefers-reduced-motion: reduce` is active (carousel falls back to static step or instant transition).

---

## Technical Investigation & Notes
- **Hero Image Investigation**: Proven root cause: `public/images/spicy-meat.jpg` exists locally (319 KB). Hardcoded hero image tag in `page.tsx` lacked fallback & dynamic image binding for top-rated community recipes. Resolved in Commit 2 with dynamic recipe binding and gradient fallback.
- **Bundle Baseline**: Initial `/` route build output: Next.js 16 dynamic route (`ƒ /`), initial static JS bundle chunks ~551 KB uncompressed (~154 KB gzipped).

---

## Out-of-Scope
- Any backend edits, database queries, schema changes, or new API routes.
- Editing `/generator`, `/recipes`, `/assistant`, `/nutrition-analyzer`, `/diet-plan`, `/admin`.
- Modifying `Navbar` (`frontend/src/components/layout/navbar.tsx`).
- Modifying UI primitives (`frontend/src/components/ui/*`).

---

## Risks & Mitigations
- **Hydration / SSR Mismatch**: Scope client motion components tightly, use `LazyMotion`, and include `<noscript>` fallbacks. First slide rendered on SSR matches server props.
- **CLS (Cumulative Layout Shift)**: Reserve fixed aspect-ratio container for the carousel card so slides crossfade without layout shift.
- **React Compiler Violations**: Zero `setState` inside `useEffect` sync body. `setInterval` callback only mutates state via functional updater `setActiveIndex((prev) => ...)`.

---

## 11-Commit Execution Plan

- [x] **Commit 1**: `docs: add HOME_UPGRADE_PLAN.md` (goal, scope lock, page structure, dynamic vs static, real data, animation rules, a11y, DoD)
- [x] **Commit 2**: `fix(frontend): fix hero image and replace fake stats with real data`
- [x] **Commit 3**: `chore(frontend): install motion, add MotionProvider and Reveal component`
- [x] **Commit 4**: `feat(frontend): hero stagger and floating animations`
- [x] **Commit 5**: `feat(frontend): add AI tools showcase and How it works animations`
- [x] **Commit 6**: `feat(frontend): add pantry quick input, ingredient marquee, generator prefill`
- [x] **Commit 7**: `feat(frontend): community section with Latest/Top rated toggle, category and dietary chips, placeholders`
- [x] **Commit 8**: `feat(frontend): add FAQ accordion and logged-in favorites strip`
- [x] **Commit 9**: `feat(frontend): final CTA, footer links, SEO metadata`
- [x] **Commit 10**: `chore(frontend): responsive polish, tests, tick plan checklist, final report`
- [x] **Commit 11**: `feat(frontend): add auto-sliding 5s hero recipe carousel with AnimatePresence and pause on hover`

---

## Definition of Done
- [x] 11 commits exist with clear conventional commit messages, git status clean, nothing pushed
- [x] `HOME_UPGRADE_PLAN.md` in root, all 11 boxes ticked
- [x] Hero right side features an auto-sliding 5s carousel displaying top 5 highest-rated recipes with `AnimatePresence` crossfade and pause-on-hover
- [x] Frontend lint, typecheck, tests, and `next build` pass
- [x] No fake stats, fake quotes, or hardcoded recipe counts remain
- [x] Hero image/carousel renders cleanly; fallback works if image fails
- [x] Pantry quick input navigates to `/generator?ingredients=...` without auto-submitting
- [x] Reduced motion disables all animations; page functional with JS disabled
- [x] React Compiler rules strictly respected (no synchronous `setState` in `useEffect`, `setInterval` uses functional updater)
- [x] Fully responsive across 375px, 768px, 1280px (no horizontal overflow)
- [x] Backend, API contract, layout, and admin files untouched
- [x] `git diff --name-only develop...HEAD` shows only allowed files
- [x] Bundle size report included for `/` route First Load JS before and after
