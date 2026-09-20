# FlavorAI: Implement Real Pantry Management + Smart Meal Planning + Smart Grocery System

I want to implement the complete next phase of the existing **FlavorAI** application based on the requirements and architecture defined in:

* `FEATURES.md`
* `FEATURES_IMPLEMENT_BREAKDOWN.md`

## CRITICAL FIRST STEP

Before writing or modifying any code:

1. Read `FEATURES.md` completely.
2. Read `FEATURES_IMPLEMENT_BREAKDOWN.md` completely.
3. Understand both files deeply.
4. Treat those two files as the primary source of truth for the requested feature scope.
5. Inspect the existing FlavorAI codebase and identify how the new functionality should integrate with the existing architecture.
6. Do not immediately start coding.
7. First understand:

   * Current recipe system
   * Recipe ingredients and nutrition structure
   * Authentication/session system
   * User ownership rules
   * Existing AI integration
   * Existing pantry-related functionality
   * Existing recipe generation functionality
   * Existing API architecture
   * Existing `/api/v1` conventions
   * Existing validation
   * Existing database/model conventions
   * Existing frontend component structure
   * Existing UI/design system
   * Existing notification/error handling

After understanding the current architecture, implement the requested features in a way that extends existing functionality instead of duplicating or replacing it.

---

# Core Architecture

These three features must be implemented as **one connected food-management workflow**, not as three unrelated modules.

The intended flow is:

```text
Real Pantry
     ↓
Smart Meal Planning
     ↓
Smart Grocery List
     ↓
Buy / Cook Meals
     ↓
Update Pantry
     ↓
Future Meal Planning
```

The persistent pantry is the foundation.

Meal planning should use pantry data.

The grocery system should use both meal-plan requirements and pantry quantities.

Do not build each feature independently.

---

# IMPLEMENTATION ORDER

Implement in this order:

## Phase 1 — Real Pantry Management

Build the persistent pantry first.

## Phase 2 — Smart Meal Planning

Build the weekly/day planner using pantry information.

## Phase 3 — Smart Grocery System

Build grocery generation using meal-plan requirements minus pantry inventory.

Do not move to the next phase until the previous phase's core functionality works.

---

# PHASE 1 — REAL PANTRY MANAGEMENT

Create a persistent **My Pantry** feature.

The user should be able to maintain the ingredients they currently have.

Example:

```text
Chicken     500 g
Rice        2 kg
Eggs        8 pcs
Milk        1 L
Tomato      4 pcs
```

The pantry must be user-specific.

Every pantry record must belong to the authenticated user.

Never trust a client-supplied `userId` for ownership.

Use the existing authentication/session system.

---

## Pantry MVP

Implement:

### Add Ingredient

User can add:

* Ingredient name
* Quantity
* Unit
* Category
* Optional expiry date
* Optional low-stock threshold
* Optional notes

### Edit Ingredient

Allow modification of pantry information and quantity.

### Increase / Decrease Quantity

Users should be able to adjust inventory without opening a full edit form.

### Remove Ingredient

Allow deleting a pantry item.

### Search / Filter

Support useful operations such as:

```text
Show meat
Show vegetables
Show items expiring soon
```

### Categories

Support categories such as:

* Vegetables
* Fruits
* Meat
* Dairy
* Grains
* Spices
* Frozen
* Snacks
* Other

Follow the existing project terminology where applicable.

---

# Pantry Data Normalization

Prevent duplicate logical ingredients caused by different spellings.

For example:

```text
Tomato
tomato
Tomatoes
```

should be able to map to the same normalized ingredient identity where appropriate.

Create/use an `ingredientKey` or equivalent normalized representation.

Do not blindly merge ingredients that are actually different.

Examples like:

```text
chicken breast
chicken thigh
```

should remain distinguishable when the distinction matters.

---

# Pantry Expiry

Allow optional expiry dates.

Display information such as:

```text
Milk expires in 2 days
Spinach expires tomorrow
```

Add an **Use These Soon** section.

Prioritize ingredients approaching expiry.

Allow the user to select:

```text
Find recipes using these ingredients
```

This should integrate with the existing recipe/AI generation system.

---

# Low Stock

Support optional low-stock thresholds.

Example:

```text
Eggs: 8
Low stock threshold: 3
```

When quantity reaches the threshold, show an appropriate low-stock indicator.

Do not hardcode arbitrary thresholds for every ingredient.

---

# Pantry Database Model

Based on the architecture in the feature breakdown, create/reuse a persistent pantry model conceptually equivalent to:

```text
PantryItem
- _id
- userId
- ingredientKey
- name
- quantity
- unit
- category
- expiryDate
- lowStockThreshold
- notes
- createdAt
- updatedAt
```

Follow existing project/model naming conventions rather than blindly copying these names.

Add appropriate indexes, especially for user ownership and common queries, where justified.

---

# Pantry API

Follow the existing `/api/v1` architecture and current route/controller/service/validation conventions.

The intended API capabilities are:

```text
GET    /pantry
POST   /pantry/items
PATCH  /pantry/items/:id
DELETE /pantry/items/:id
POST   /pantry/items/:id/use
```

Adapt the exact route path to the existing FlavorAI routing conventions if necessary.

All user pantry operations must be authenticated and user-scoped.

---

# Pantry "Use" Operation

Implement a safe way for a meal/cooking action to decrease pantry quantities.

For example:

```text
Chicken: 500g
↓
Meal uses 150g
↓
Chicken: 350g
```

Do not allow quantities to silently become invalid negative values.

Handle insufficient quantities safely.

If the application supports partial availability, represent that clearly.

---

# PHASE 2 — SMART MEAL PLANNING

Create a dedicated **Meal Plan** page.

Suggested route:

```text
/meal-plan
```

Follow existing routing conventions if the project uses a different structure.

The planner should support a weekly view.

Example:

```text
Monday
  Breakfast
  Lunch
  Dinner

Tuesday
  Breakfast
  Lunch
  Dinner
```

Continue for the selected planning period.

---

# Two Meal Planning Modes

Support:

## Manual Planning

Users can select an existing recipe and assign it to a specific meal/date.

Example:

```text
Monday → Dinner → Chicken Curry
```

## AI Planning

Provide an action such as:

```text
✨ Generate My Week
```

The user should be able to provide relevant constraints such as:

* Number of days
* Meals per day
* Number of servings
* Dietary preference
* Calorie target
* Protein target
* Cooking-time limit
* Preferred cuisine
* Ingredients to prioritize
* Ingredients to avoid

Reuse existing FlavorAI recipe/filter functionality where possible.

---

# AI Meal Planning

Do NOT make the AI generate seven unrelated meals.

The AI should consider the **whole plan**.

It should optimize across the week.

Important inputs include:

```text
User preferences
+
Dietary restrictions
+
Current pantry
+
Existing FlavorAI recipes
+
Nutrition targets
+
Number of servings
+
Budget
+
Cooking constraints
```

Use existing recipes wherever practical instead of unnecessarily inventing completely new recipes.

If AI-generated recipes are supported by the existing application, integrate them cleanly, but preserve recipe identity and traceability.

---

# Leftover-Aware Planning

Implement intelligent ingredient/leftover reuse.

Example:

```text
Monday:
Roast Chicken

Tuesday:
Chicken Sandwich

Wednesday:
Chicken Fried Rice
```

The planner should consider previous meals and leftover ingredients rather than treating every meal independently.

Avoid unrealistic leftover quantities.

Use available quantity information when possible.

---

# Pantry-Aware Planning

The AI planner should understand what the user already owns.

Example:

```text
Pantry:
Chicken 1kg
Rice 2kg
Eggs 6
Potatoes 1kg
Spinach 300g
```

The plan should intentionally reuse these ingredients where practical.

Do not simply suggest meals that happen to contain pantry ingredients.

Optimize the plan around current inventory when the user asks to prioritize pantry usage.

---

# Macro-Constrained Planning

The planner must be capable of targeting constraints such as:

```text
2,000 kcal
140g protein
```

The target should influence meal selection rather than merely calculating nutrition after choosing recipes.

Use deterministic nutrition information already present in the recipe system where available.

AI should help reason about the plan, but do not delegate exact arithmetic blindly to the model when the application can calculate it reliably.

---

# Family Meal Planning

Support different preferences when the feature/UI requirements justify it.

Example:

```text
User:
High protein

Child:
Mild

Partner:
Vegetarian
```

The AI should try to produce compatible meals.

Do not build an unnecessarily complicated household-management system unless the existing project architecture supports it cleanly.

---

# Meal Plan Actions

Each meal should support:

### Swap

```text
Give me another dinner.
```

### Regenerate

Generate a different meal while preserving the rest of the plan.

### Remove

Remove a meal from the plan.

### Change Servings

Example:

```text
2 → 4 people
```

Nutrition and ingredient requirements should update appropriately.

### View Recipe

Open the existing FlavorAI recipe detail page.

### Move Meal

Example:

```text
Monday Dinner
→
Wednesday Dinner
```

Preserve plan consistency after changes.

---

# Meal Plan Regeneration

A key requirement:

If the user says:

```text
Replace Wednesday dinner.
```

only Wednesday dinner should be replaced.

Do not regenerate the entire week unnecessarily.

Keep the rest of the plan consistent.

---

# Meal Plan Optimization

Add an:

```text
Optimize Plan
```

capability.

Optimization can consider:

* Pantry usage
* Ingredient reuse
* Cooking time
* Nutrition balance
* Variety
* Grocery item count
* Budget

Do not optimize one dimension while breaking another important user constraint.

Preserve explicit user restrictions.

---

# Repeat / Favorite Meal Plans

Allow users to save reusable plans.

Example:

```text
My High-Protein Week
```

Allow saved plans to be reused later where practical.

Persist only the information necessary to reconstruct the plan.

---

# Meal Plan Database Model

Use a model conceptually equivalent to:

```text
MealPlan
- userId
- name
- weekStartDate
- weekEndDate
- meals[]
- constraints
- status
- timestamps
```

Each meal can contain information such as:

```text
date
mealType
recipeId
servings
source
notes
```

Follow the existing FlavorAI data/model conventions.

Do not duplicate recipe data unnecessarily when a recipe ID/reference is enough.

---

# Meal Plan API

Support capabilities equivalent to:

```text
GET    /meal-plans
POST   /meal-plans
GET    /meal-plans/:id
PATCH  /meal-plans/:id
DELETE /meal-plans/:id

POST   /meal-plans/ai-generate
POST   /meal-plans/:id/swap-meal
POST   /meal-plans/:id/optimize
```

Use the project's existing route structure and API versioning.

Every meal plan must be owned by the authenticated user.

---

# PHASE 3 — SMART GROCERY SYSTEM

Create a dedicated grocery page.

Suggested route:

```text
/grocery
```

Follow existing routing conventions.

The grocery system must be driven by the meal plan.

---

# Automatic Grocery List

Provide:

```text
Meal Plan
   ↓
Generate Grocery List
```

The system should determine the required ingredients for the selected plan.

---

# Most Important Grocery Logic — Pantry Subtraction

This is a critical requirement.

Example:

Meal plan requires:

```text
Chicken = 1 kg
```

Pantry contains:

```text
Chicken = 600 g
```

The grocery list must show:

```text
Buy 400 g
```

NOT:

```text
Buy 1 kg
```

Calculation:

```text
Required Quantity
-
Available Pantry Quantity
=
Quantity To Buy
```

This subtraction must happen in application logic.

Do not rely on the LLM for this arithmetic when it can be deterministically calculated.

---

# Quantity Consolidation

Combine duplicate ingredient requirements.

Example:

```text
Recipe 1 → Onion 2
Recipe 2 → Onion 1
Recipe 3 → Onion 3
```

Display:

```text
Onion — 6
```

Then subtract pantry stock.

The consolidated result should be what the user actually needs to purchase.

Handle compatible units carefully.

For example:

```text
1000 g
+
500 g
```

can safely become:

```text
1500 g
```

Do not blindly combine incompatible units such as:

```text
2 pcs
+
500 g
```

unless a reliable conversion exists.

---

# Grocery Categories

Organize items into categories such as:

* Vegetables
* Meat
* Dairy
* Grains
* Spices
* Frozen
* Snacks
* Other

Use existing ingredient-category logic if available.

---

# Grocery Checklist

Users should be able to mark items as purchased.

Example:

```text
☑ Chicken
☐ Onion
☐ Milk
```

Persist purchase state.

---

# Manual Grocery Items

Allow users to add items unrelated to the meal plan.

Example:

```text
Dishwashing liquid
Toothpaste
```

Manual items must remain distinguishable from meal-plan-generated items.

---

# Edit / Remove Grocery Items

Support:

* Edit quantity
* Remove item
* Mark purchased
* Unmark purchased
* Clear purchased items
* Regenerate/recalculate the list

---

# Grocery Regeneration

When the meal plan changes:

```text
Meal Plan Changed
       ↓
Recalculate Grocery List
```

Do not force users to manually rebuild the list.

Preserve manual grocery items according to the existing intended behavior.

---

# Grocery Budget

Support an optional weekly grocery budget.

Example:

```text
Weekly budget: $50
```

The AI meal planner should try to keep the meal plan within the supplied budget.

Do not claim exact grocery costs unless reliable price data exists.

Cost estimates should be clearly labeled as approximate.

---

# Grocery Cost Estimation

Where supported by the data source, display:

```text
Estimated total: $42
Estimated cost per meal: $6
```

Do not fabricate real-time prices.

If there is no reliable pricing source in the current project, implement an architecture that can support cost data later rather than inventing prices.

---

# Grocery Database Model

Use a model conceptually equivalent to:

```text
GroceryList
- userId
- mealPlanId
- items[]
- status
- timestamps
```

Each item can contain:

```text
ingredientKey
name
quantity
unit
category
sourceRecipeIds
isPurchased
isManual
```

Use existing project conventions.

---

# Grocery API

Support capabilities equivalent to:

```text
GET    /grocery-lists
POST   /grocery-lists/generate
GET    /grocery-lists/:id
PATCH  /grocery-lists/:id
POST   /grocery-lists/:id/items
PATCH  /grocery-lists/:id/items/:itemId
DELETE /grocery-lists/:id/items/:itemId
POST   /grocery-lists/:id/recalculate
```

Keep all operations authenticated and user-scoped.

---

# CROSS-FEATURE INTEGRATION

This is extremely important.

Do not finish these features as disconnected pages.

The system should behave like this:

```text
PANTRY
  ↓
User has:
Chicken 500g
Rice 2kg
Eggs 8

  ↓

MEAL PLAN
  ↓
Weekly plan requires:
Chicken 1kg
Rice 2.5kg
Eggs 6

  ↓

GROCERY
  ↓
Required:
Chicken 1kg
Rice 2.5kg
Eggs 6

Pantry:
Chicken 500g
Rice 2kg
Eggs 8

  ↓

BUY:
Chicken 500g
Rice 500g
Eggs 0
```

This exact relationship should be implemented deterministically.

---

# PANTRY ↔ MEAL PLAN

When a user generates a meal plan:

* Retrieve the user's current pantry.
* Use pantry information as planning context.
* Respect expiry dates when asked to minimize waste.
* Prioritize ingredients nearing expiry when appropriate.
* Consider available quantities.
* Avoid assuming unlimited pantry inventory.

---

# MEAL PLAN ↔ GROCERY

When generating the grocery list:

* Retrieve recipe ingredients for all selected meals.
* Account for servings.
* Consolidate duplicate ingredients.
* Normalize compatible units.
* Subtract pantry quantities.
* Exclude ingredients that are sufficiently available.
* Produce only the additional quantity needed.

---

# GROCERY ↔ PANTRY

When a grocery item is marked as purchased, do not automatically add it to pantry inventory unless there is a clear existing workflow for this.

Prefer an explicit or well-defined flow such as:

```text
Purchased
   ↓
Add to Pantry
```

Do not silently modify pantry quantities based only on checklist state.

When food is consumed/cooked, provide a safe mechanism to decrement pantry inventory.

---

# AI INTEGRATION

Inspect the existing FlavorAI AI integration before adding anything.

Reuse the current AI provider/configuration whenever possible.

Do not introduce another AI provider unless the current architecture genuinely cannot support this functionality.

Keep AI-specific logic inside dedicated services.

---

# AI RESPONSIBILITIES

AI may handle:

* Meal-plan generation
* Meal-plan optimization
* Taste/preference interpretation
* Leftover-aware reasoning
* Recipe ranking
* Natural-language instructions
* Pantry-prioritization reasoning
* Grocery/budget planning assistance

But deterministic calculations should remain application-side.

Do not ask AI to be the source of truth for:

* Pantry quantities
* Grocery arithmetic
* User ownership
* Recipe existence
* Exact database state
* Authentication
* Authorization

---

# SECURITY

Every new endpoint must enforce authentication.

Every resource query must be scoped to the authenticated user.

Never trust:

```json
{
  "userId": "..."
}
```

from the frontend as an authorization mechanism.

Never allow one user to access:

* Another user's pantry
* Another user's meal plans
* Another user's grocery lists

Validate ownership server-side.

---

# VALIDATION

Add proper validation for:

### Pantry

* Ingredient name
* Quantity
* Unit
* Category
* Expiry date
* Low-stock threshold

### Meal Plans

* Date range
* Meal type
* Recipe IDs
* Servings
* Constraints
* Goal values

### Grocery

* Item IDs
* Quantities
* Units
* Categories
* Purchased state

Reuse existing validation libraries and project conventions.

---

# AI RESPONSE VALIDATION

Whenever AI returns structured data:

* Validate the structure.
* Validate recipe IDs.
* Validate dates.
* Validate meal types.
* Validate quantities where applicable.
* Reject malformed responses safely.

Never trust model output as already-valid application state.

---

# AI PROMPT INJECTION

Treat user-controlled content as untrusted.

This includes:

* Pantry item names
* Notes
* Recipe names
* Recipe descriptions
* User-provided instructions

Retrieved data must be treated as data, not system instructions.

Clearly separate:

```text
System Instructions
User Request
Retrieved Context
```

Do not allow recipe/pantry text to override system-level rules.

---

# UI / UX

All new pages/components must follow the current FlavorAI visual language.

Use:

* Existing HeroUI components
* Existing Tailwind conventions
* Existing typography
* Existing spacing
* Existing colors
* Existing buttons
* Existing cards
* Existing toast/error patterns
* Existing responsive patterns

Do not create a completely new visual language.

---

# Pantry UI

Create a clean dashboard containing:

* Pantry list/table/cards
* Add item action
* Edit quantity
* Increase/decrease controls
* Search/filter
* Expiry indicators
* Low-stock indicators
* "Use These Soon" section
* Find recipes action

Make empty states useful.

Example:

```text
Your pantry is empty.

Add your first ingredient to start
planning smarter meals.
```

---

# Meal Plan UI

Create a weekly planner with:

* Day sections
* Breakfast
* Lunch
* Dinner
* Optional snacks
* Recipe information
* Serving count
* Nutrition summary where available
* Swap
* Regenerate
* Remove
* Move
* Add meal
* AI Generate
* Optimize Plan
* Save Plan

Keep the interface easy to scan.

---

# Grocery UI

Create a clear checklist-style grocery experience.

Display:

* Category sections
* Item
* Quantity
* Unit
* Purchased state
* Manual/generated indicator where helpful
* Estimated total if supported
* Regenerate/recalculate action
* Add manual item

Make the shopping experience mobile-friendly.

---

# EMPTY / ERROR / LOADING STATES

Implement proper states throughout all three modules.

Handle:

* Empty pantry
* Empty meal plan
* Empty grocery list
* No matching recipes
* AI failure
* Database failure
* Invalid AI response
* Invalid input
* Unauthorized requests
* Recipe deleted after being added to a meal plan
* Pantry item deleted after grocery generation

Do not leave blank or broken screens.

---

# DATABASE DESIGN

Before creating models, inspect the existing schema carefully.

Potential new entities:

```text
PantryItem
MealPlan
GroceryList
```

Use these only where necessary.

Avoid duplicating information already represented by existing models.

Prefer references such as `recipeId` over copying entire recipe documents.

Add indexes where they improve the expected user-scoped queries.

---

# API ARCHITECTURE

The existing project uses an organized backend structure with controllers/services/routes/validation and typed API contracts.

Follow that architecture.

Do NOT:

* Put all business logic inside route handlers.
* Duplicate database logic.
* Create inconsistent response structures.
* Bypass existing authentication middleware.
* Create a parallel API architecture.

---

# TESTING

Add/extend tests using the project's current testing setup.

## Pantry Tests

Test:

* Create pantry item
* Update pantry item
* Increase quantity
* Decrease quantity
* Delete pantry item
* Search/filter
* Expiry handling
* Low-stock logic
* User ownership
* Invalid quantity
* Invalid unit

## Meal Plan Tests

Test:

* Manual meal assignment
* AI meal-plan generation
* Serving changes
* Meal swap
* Meal removal
* Meal movement
* Plan optimization
* Pantry-aware planning
* Nutrition constraints
* User ownership

## Grocery Tests

Test:

* Generate grocery list from meal plan
* Duplicate ingredient consolidation
* Pantry subtraction
* Unit handling
* Purchased state
* Manual item
* Recalculate after meal-plan changes
* User ownership

## Integration Tests

Most importantly test the complete workflow:

```text
Create Pantry
    ↓
Generate Meal Plan
    ↓
Generate Grocery List
    ↓
Subtract Pantry Inventory
    ↓
Modify Meal Plan
    ↓
Recalculate Grocery List
```

Also test:

```text
Pantry quantity decreases
    ↓
Future grocery calculation changes correctly
```

---

# PERFORMANCE

Do not send the entire database to the LLM.

For AI meal planning:

* Retrieve only relevant pantry items.
* Retrieve only relevant recipe candidates.
* Limit context size.
* Avoid duplicate AI calls.
* Reuse deterministic filtering before AI ranking.

For grocery generation:

* Perform quantity consolidation and pantry subtraction in application code.
* Do not use AI for simple arithmetic.

---

# COST CONTROL

Avoid unnecessary LLM calls.

For example:

```text
Manual meal move
```

should not require an AI request.

Likewise:

```text
Change serving count
```

should primarily update deterministic calculations.

Use AI where reasoning is actually beneficial.

---

# DEVELOPMENT RULES

Follow these rules strictly:

1. Do not refactor unrelated features.
2. Do not rewrite working functionality without a reason.
3. Do not create duplicate models/services/components if suitable ones already exist.
4. Reuse existing FlavorAI infrastructure.
5. Keep each responsibility modular.
6. Keep TypeScript types strong.
7. Do not use `any` unless absolutely unavoidable.
8. Keep database ownership checks server-side.
9. Keep deterministic calculations outside the LLM.
10. Do not fabricate recipe IDs, prices, nutrition values, or inventory.
11. Do not expose secrets to the client.
12. Do not add unnecessary dependencies.
13. Do not implement future features from the documents unless they are part of this requested phase.

---

# IMPLEMENTATION STRATEGY

Before coding, produce a short internal architecture assessment based on the actual codebase.

Identify:

```text
Existing
---------
Recipe model
User model
Auth
AI service
Recipe ingredient structure
Nutrition structure
API structure
Validation
Frontend UI system

New
---
PantryItem
MealPlan
GroceryList
Pantry UI
Meal Planner UI
Grocery UI
AI meal-planning services
Integration logic
```

Then implement in this order:

```text
1. Pantry backend
2. Pantry frontend
3. Pantry tests

4. Meal Plan backend
5. Meal Plan frontend
6. Meal Plan AI integration
7. Meal Plan tests

8. Grocery backend
9. Grocery frontend
10. Grocery generation logic
11. Grocery tests

12. End-to-end integration
13. Security verification
14. Build/lint/type-check
```

---

# FINAL VERIFICATION

After implementation, verify the following complete scenario manually or with integration tests:

### Scenario

User has:

```text
Chicken: 500g
Rice: 2kg
Eggs: 8
Tomato: 4 pcs
```

User generates a weekly plan.

The plan should use pantry items where appropriate.

The grocery system then calculates the exact additional ingredients needed.

If the plan changes:

```text
Wednesday dinner → swapped
```

the grocery list should be recalculated.

If the user consumes:

```text
200g chicken
```

the pantry should become:

```text
Chicken: 300g
```

Future grocery calculations must use the updated quantity.

---

# FINAL REPORT

After implementation, provide a clear report.

## 1. Architecture

Explain how:

```text
Pantry → Meal Plan → Grocery
```

works together.

## 2. File-by-File Changes

List every actual created/modified file.

Use this format:

```text
Created:
- path/to/file
  Purpose: ...

Modified:
- path/to/file
  Changes: ...
```

Do not invent filenames.

## 3. Database Changes

Explain:

* New collections/models
* Modified models
* Important fields
* Indexes

## 4. API Changes

List:

* HTTP method
* Endpoint
* Authentication requirement
* Purpose

## 5. AI Integration

Explain:

* Which existing AI provider/model was reused
* Which operations use AI
* Which calculations remain deterministic
* How pantry/recipe context is provided to AI

## 6. Frontend Changes

Explain:

* New pages
* New components
* Reused components
* New interactions

## 7. Security

Explain:

* User isolation
* Authentication
* Authorization
* Input validation
* AI output validation
* Prompt injection handling

## 8. Environment Setup

List only actual required environment variables.

For example:

```text
VARIABLE_NAME=your_value
```

Explain:

* Required/optional
* Server/client
* Local development setup
* Production setup

Never expose actual secret values.

## 9. Testing

Report:

* Unit tests
* Integration tests
* Manual tests
* Lint
* Type check
* Build

Only claim a test passed if it was actually run.

## 10. Known Limitations

Clearly identify anything that is:

* AI-estimated
* Dependent on external pricing data
* Not yet supported
* Approximate
* Deferred

Do not hide limitations.

---

# FINAL CONSTRAINT

Implement the features from the two provided feature documents faithfully, but integrate them into the **existing FlavorAI architecture** rather than blindly creating the exact structures suggested in the documents.

The documents describe the desired behavior and recommended architecture.

The existing codebase determines the exact filenames, abstractions, naming conventions, and implementation details.

Do not modify unrelated functionality.
