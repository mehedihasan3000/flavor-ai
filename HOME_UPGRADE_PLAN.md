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
1. **Hero**: Headline, subheadline, CTAs (`/generator`, `/nutrition-analyzer`), real recipe count, right-side real top-rated dish showcase card + floating chips.
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
- **Dynamic Data**: Real community recipe total (`result.total` from `listRecipes`), latest/top-rated recipe list, hero top-rated dish card, recipe count-up display, logged-in user favorites strip.
- **Static Content**: AI tools cards, How it works steps/examples, FAQ accordion items, ingredient marquee list, category & dietary filter chip lists.

---

## Real Data Rules
- Remove all fake stats/quotes from `page.tsx` lines 103-411 (`"4.9/5"`, `"15K+ Cook Reviews"`, `"50K+ Recipes Generated"`, `"98% Pantry Match Rate"`, `"Sarah K., Verified Cook"`, `"Artisan Harvest Grain Bowl"`, `"420 kcal"`, `"94% conf."`, `"Chef Approved"`).
- Hero showcase card uses the real top-rated published recipe via `listRecipes({ sort: "highest-rated", limit: 1 })`.
- If no recipe or no image exists: gradient + icon fallback with neutral static text.
- Server-side data fetches use graceful fallback handling (hide section if empty/error, never crash the page).

---

## Animation Rules
- Package: `motion` (imported from `"motion/react"`).
- `<LazyMotion features={domAnimation} strict>` + `<MotionConfig reducedMotion="user">` inside `MotionProvider` scoped to home components only.
- Use `m` components (`m.div`, `m.section`) to keep bundle minimal.
- Animate only opacity and transform (`y`, `x`, `scale`). CLS must stay ~0.
- Hero LCP elements must NOT start at opacity 0. Below-the-fold reveals include a `<noscript>` fallback style.
- Floating animation loops: 6-8s, max 6-8px transform offset, `ease-in-out`, repeat infinite.
- Recipe count count-up ONLY for real numbers.
- Zero synchronous `setState` calls inside `useEffect` bodies.

---

## Accessibility
- FAQ accordion uses native `<button>` with `aria-expanded` and `ar
ia-controls`.
- Icon buttons have explicit `aria-label` attributes.
- Visible focus rings (`focus-visible:outline...`) on all interactive elements.
- Marquee is set to `aria-hidden="true"` and pauses on `:hover` or `:focus-within`.
- Reduced motion: all movement disabled when `prefers-reduced-motion: reduce` is active.

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
- **Hydration / SSR Mismatch**: Scope client motion components tightly, use `LazyMotion`, and include `<noscript>` fallbacks.
- **CLS (Cumulative Layout Shift)**: Animate only opacity and transform.
- **React Compiler Violations**: Zero `setState` inside `useEffect` sync body.

---

## 10-Commit Execution Plan

- [x] **Commit 1**: `docs: add HOME_UPGRADE_PLAN.md` (goal, scope lock, page structure, dynamic vs static, real data, animation rules, a11y, DoD)
- [x] **Commit 2**: `fix(frontend): fix hero image and replace fake stats with real data`
- [x] **Commit 3**: `chore(frontend): install motion, add MotionProvider and Reveal component`
- [x] **Commit 4**: `feat(frontend): hero stagger and floating animations`
- [x] **Commit 5**: `feat(frontend): add AI tools showcase and How it works animations`
- [ ] **Commit 6**: `feat(frontend): add pantry quick input, ingredient marquee, generator prefill`
- [ ] **Commit 7**: `feat(frontend): community section with Latest/Top rated toggle, category and dietary chips, placeholders`
- [ ] **Commit 8**: `feat(frontend): add FAQ accordion and logged-in favorites strip`
- [ ] **Commit 9**: `feat(frontend): final CTA, footer links, SEO metadata`
- [ ] **Commit 10**: `chore(frontend): responsive polish, tests, tick plan checklist, final report`

---

## Definition of Done
- [ ] 10 commits exist with clear conventional commit messages, git status clean, nothing pushed
- [ ] `HOME_UPGRADE_PLAN.md` in root, all 10 boxes ticked
- [ ] Frontend lint, typecheck, tests, and `next build` pass
- [ ] No fake stats, fake quotes, or hardcoded recipe counts remain
- [ ] Hero image renders cleanly; fallback works if image fails
- [ ] Pantry quick input navigates to `/generator?ingredients=...` without auto-submitting
- [ ] Reduced motion disables all animations; page functional with JS disabled
- [ ] React Compiler rules strictly respected (no synchronous `setState` in `useEffect`)
- [ ] Fully responsive across 375px, 768px, 1280px (no horizontal overflow)
- [ ] Backend, API contract, layout, and admin files untouched
- [ ] `git diff --name-only develop...HEAD` shows only allowed files
- [ ] Bundle size report included for `/` route First Load JS before and after
