# Admin Dashboard Filter Fix — Architecture & Implementation Plan

> [!NOTE]
> This plan documents the resolution for the Admin Dashboard responsive filter form layout issues in `frontend/src/components/admin/admin-recipes-panel.tsx`, `frontend/src/components/admin/admin-users-panel.tsx`, and the core `Select` UI primitive in `frontend/src/components/ui/select.tsx`.

---

## 1. Problem Description

On desktop viewports (`sm` breakpoint and above), the search filter forms on the Admin Dashboard exhibited two visual layout defects:

1. **Search Input Squishing**: The search `<Input>` was squeezed into a tiny ~20px box on the left, while the status/role filter dropdown (`<Select>`) expanded across 100% of the remaining space in the form container.
2. **Detached Dropdown Chevron**: When passing width classes (such as `sm:w-40`) to `<Select>`, the native select box shrank to 160px, but the `<ChevronDown>` arrow icon remained detached on the far right edge of the form screen.

---

## 2. Root Cause Breakdown

The root cause was located in the internal DOM structure of [select.tsx](file:///d:/Intern-ph/flavor-ai/frontend/src/components/ui/select.tsx):

```html
<div className="w-full">
  <div className="relative">
    <select className="[controlClass] [className]" />
    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2" />
  </div>
</div>
```

- **Flexbox Basis Overflow**: The top-level element returned by `<Select>` was `<div className="w-full">`. When rendered inside `<form className="flex flex-col gap-3 sm:flex-row">`, the top-level outer `div` was a direct flex item with `width: 100%`. Because `className` was NOT passed to this top-level outer wrapper, flexbox calculated the dropdown wrapper's flex basis as 100%, collapsing the search input container (`<div className="flex-1 min-w-0">`) to zero width.
- **Chevron Position Detachment**: When `className="sm:w-40"` was passed only to the inner `<select>` element, `<select>` became 160px wide, but its parent container remained 100% wide. Because `<ChevronDown>` was positioned `absolute right-3` relative to the 100% parent container, it anchored to the right edge of the screen instead of the 160px select box.

---

## 3. Proposed & Implemented Changes

### [MODIFY] [select.tsx](file:///d:/Intern-ph/flavor-ai/frontend/src/components/ui/select.tsx)
- Forward `className` to the top-level outer wrapper container:
  ```tsx
  <div className={["w-full", className].filter(Boolean).join(" ")}>
  ```
- Keep the relative inner container `<div className="relative w-full">` and `<select className="w-full ...">` spanning 100% of the top-level wrapper.
- Now, any width/flex constraints (such as `sm:w-40 shrink-0`) applied to `<Select>` constrain the outer flex item, keeping the select box and chevron icon perfectly aligned as a single unit.

### [MODIFY] [admin-recipes-panel.tsx](file:///d:/Intern-ph/flavor-ai/frontend/src/components/admin/admin-recipes-panel.tsx)
- Updated search filter form layout to:
  ```tsx
  <form onSubmit={handleSearchSubmit} className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
    <div className="flex-1 min-w-0">
      <Input
        type="search"
        value={qInput}
        onChange={(event) => setQInput(event.target.value)}
        placeholder="Search by title…"
        aria-label="Search recipes"
      />
    </div>
    <Select
      aria-label="Filter by status"
      value={status}
      onChange={(event) => {
        setStatus(event.target.value as RecipeStatus | "");
        setPage(1);
      }}
      className="sm:w-40 shrink-0"
    >
      <option value="">All statuses</option>
      <option value="published">Published</option>
      <option value="draft">Draft</option>
      <option value="hidden">Hidden</option>
    </Select>
    <Button type="submit" className="shrink-0">
      Search
    </Button>
  </form>
  ```

### [MODIFY] [admin-users-panel.tsx](file:///d:/Intern-ph/flavor-ai/frontend/src/components/admin/admin-users-panel.tsx)
- Applied identical responsive flex structure to the Users panel search form with `flex-1 min-w-0` on the input wrapper and `className="sm:w-40 shrink-0"` on `<Select>`.

### [MODIFY] [tsconfig.json](file:///d:/Intern-ph/flavor-ai/frontend/tsconfig.json)
- Added `"tests"` and `"vitest.config.ts"` to `exclude` so production Next.js build typechecks pass cleanly without requiring dev-only test dependencies in the production bundle build.

---

## 4. Verification & Testing

> [!TIP]
> All automated verification commands were executed and verified cleanly.

1. **Production Build**:
   ```bash
   npm run build
   ```
   *Result*: **Passed cleanly** — 18/18 static/dynamic routes compiled successfully.

2. **Linter Check**:
   ```bash
   npm run lint
   ```
   *Result*: **Passed with 0 warnings and 0 errors**.

3. **Responsive Visual Verification**:
   - **Desktop (`>= 640px`)**: Search input takes all remaining row width (`flex-1 min-w-0`), dropdown sits at a fixed 160px (`sm:w-40 shrink-0`) with chevron icon inside, and search button sits neatly aligned on the right.
   - **Mobile (`< 640px`)**: Input, dropdown, and search button stack vertically with 100% width and clean spacing (`flex-col gap-3`).
