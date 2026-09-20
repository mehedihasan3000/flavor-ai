import type { Request, Response } from "express";
import type { FilterQuery } from "mongoose";
import { PantryItemModel } from "../models/PantryItem.js";
import { findConvertiblePantryItem } from "../services/pantryService.js";
import type { AuthUser } from "../types/auth.js";
import {
  CreatePantryItemInput,
  PaginationQuery,
  UpdatePantryItemInput,
  type PantrySearchQuery,
} from "../types/index.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { normalizeIngredientKey } from "../utils/ingredientKey.js";
import { parseIdParam } from "../utils/params.js";
import { escapeRegExp } from "../utils/regex.js";
import { sanitizePlainText } from "../utils/sanitize.js";
import { convertQuantity } from "../utils/units.js";

/**
 * Pantry controller — owned by Dev A (Workstream A, FEATURES_TASKS.md §A2).
 *
 * Draft endpoint docs (§9A; Lead moves to `docs/API_CONTRACT.md`):
 * - `GET /pantry/items?category=&q=&expiringWithinDays=&lowStock=` → 200
 *   paginated `{ items, page, limit, total, totalPages }` (all `requireAuth`).
 * - `POST /pantry/items` → 201 `{ item }`; exact `key+unit` dup → 409;
 *   convertible-unit near-dup merges → 200 `{ item }`.
 * - `PATCH /pantry/items/:id` → 200 `{ item }`; cross-user → 404.
 * - `DELETE /pantry/items/:id` → 200 `{ success: true }`; cross-user → 404.
 * - `POST /pantry/items/:id/use { quantity }` → 200 `{ item }`;
 *   insufficient → 409 with `available` in the safeMessage.
 * - `GET /pantry/expiring` → 200 paginated, `expiryDate` asc, cap 20.
 * All `:id` params validated (400 on malformed); all queries user-scoped
 * (`req.user.id`, never a client `userId`); admins have no override (404).
 */

type PantryRecord = {
  _id: unknown;
  userId: unknown;
  ingredientKey: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  expiryDate?: Date | string | null;
  lowStockThreshold?: number | null;
  notes?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

function currentUser(req: Request): AuthUser {
  if (!req.user) {
    throw new ApiError(401, "UNAUTHORIZED", "Authentication required.");
  }
  return req.user;
}

/**
 * Strips markup from free-text fields before schema validation (§0.3.9,
 * same as comment bodies). Non-string/missing fields pass through so Zod
 * reports the expected type errors instead of this sanitizer masking them.
 */
function sanitizeItemFields(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const out = { ...(raw as Record<string, unknown>) };
  if (typeof out.name === "string") out.name = sanitizePlainText(out.name);
  if (typeof out.notes === "string") out.notes = sanitizePlainText(out.notes);
  if (typeof out.unit === "string") out.unit = sanitizePlainText(out.unit);
  return out;
}

function toISO(value: Date | string | undefined | null): string | null {
  if (!value) return null;
  return new Date(value).toISOString();
}

/** Serializes a pantry doc + derived `lowStock` flag (never stored). */
function toPantryItemResponse(record: PantryRecord) {
  const threshold = record.lowStockThreshold ?? null;
  return {
    id: String(record._id),
    userId: String(record.userId),
    ingredientKey: record.ingredientKey,
    name: record.name,
    quantity: record.quantity,
    unit: record.unit,
    category: record.category,
    expiryDate: toISO(record.expiryDate ?? null),
    lowStockThreshold: threshold,
    lowStock: threshold !== null && record.quantity <= threshold,
    notes: record.notes ?? "",
    createdAt: toISO(record.createdAt ?? null) ?? new Date().toISOString(),
    updatedAt: toISO(record.updatedAt ?? null) ?? new Date().toISOString(),
  };
}

function utcMidnightPlusDays(days: number): Date {
  const now = new Date();
  const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return new Date(base + days * 24 * 60 * 60 * 1000);
}

/**
 * GET /pantry/items — own items, paginated. Filters: `category` exact;
 * `q` case-insensitive name match (regex-escaped); `expiringWithinDays` →
 * dated items expiring within N days (null expiries never match);
 * `lowStock=true` → threshold set and `quantity <= threshold`.
 */
export const listItems = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const query = req.query as unknown as PantrySearchQuery;

  const filter: FilterQuery<PantryRecord> = { userId: user.id };
  if (query.category) filter.category = query.category;
  if (query.q?.trim()) {
    filter.name = { $regex: escapeRegExp(query.q.trim()), $options: "i" };
  }
  if (query.expiringWithinDays !== undefined) {
    filter.expiryDate = { $ne: null, $lte: utcMidnightPlusDays(query.expiringWithinDays) };
  }
  if (query.lowStock === true) {
    filter.$expr = {
      $and: [
        { $ne: ["$lowStockThreshold", null] },
        { $lte: ["$quantity", "$lowStockThreshold"] },
      ],
    };
  }

  const [docs, total] = await Promise.all([
    PantryItemModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean()
      .exec(),
    PantryItemModel.countDocuments(filter),
  ]);

  res.json({
    items: (docs as unknown as PantryRecord[]).map(toPantryItemResponse),
    page: query.page,
    limit: query.limit,
    total,
    totalPages: Math.ceil(total / query.limit),
  });
});

/**
 * POST /pantry/items — add an item. Exact `ingredientKey + unit` duplicate →
 * 409 (PATCH instead); convertible-unit near-dup (`500g` + `1kg`) converts
 * and sums into the existing line → 200; otherwise creates → 201.
 */
export const createItem = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const input = CreatePantryItemInput.parse(sanitizeItemFields(req.body));
  const ingredientKey = normalizeIngredientKey(input.name);

  const exact = await PantryItemModel.findOne({
    userId: user.id,
    ingredientKey,
    unit: input.unit,
  }).exec();
  if (exact) {
    throw new ApiError(
      409,
      "CONFLICT",
      "This ingredient already exists in your pantry. Update its quantity instead.",
    );
  }

  const mergeTarget = await findConvertiblePantryItem(user.id, ingredientKey, input.unit);
  if (mergeTarget) {
    const converted = convertQuantity(input.quantity, input.unit, mergeTarget.unit);
    if (converted !== null) {
      const updated = await PantryItemModel.findOneAndUpdate(
        { _id: mergeTarget._id, userId: user.id },
        { $inc: { quantity: converted } },
        { new: true },
      )
        .lean()
        .exec();
      if (updated) {
        res.status(200).json({ item: toPantryItemResponse(updated as unknown as PantryRecord) });
        return;
      }
      // Line vanished between lookup and update; fall through and create.
    }
  }

  const created = await PantryItemModel.create({
    userId: user.id,
    ingredientKey,
    name: input.name,
    quantity: input.quantity,
    unit: input.unit,
    category: input.category,
    expiryDate: input.expiryDate ? new Date(`${input.expiryDate}T00:00:00.000Z`) : null,
    lowStockThreshold: input.lowStockThreshold ?? null,
    notes: input.notes ?? "",
  });

  res.status(201).json({
    item: toPantryItemResponse({
      ...created.toObject(),
      _id: created._id,
    } as unknown as PantryRecord),
  });
});

/**
 * PATCH /pantry/items/:id — edit own item. Recomputes `ingredientKey` when
 * the name changes. A unit-only change converts the stored quantity to the
 * new unit (400 when incompatible); an explicit quantity is taken as-is.
 * Merging into another line's `ingredientKey + unit` → 409 (same as create).
 * Cross-user (incl. admin) → 404.
 */
export const updateItem = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const id = parseIdParam(req.params.id, "id");
  const input = UpdatePantryItemInput.parse(sanitizeItemFields(req.body));

  const record = await PantryItemModel.findOne({ _id: id, userId: user.id }).exec();
  if (!record) {
    throw new ApiError(404, "NOT_FOUND", "Pantry item not found.");
  }

  if (input.name !== undefined) {
    record.name = input.name;
    record.ingredientKey = normalizeIngredientKey(input.name);
  }
  if (input.unit !== undefined && input.unit !== record.unit) {
    if (input.quantity !== undefined) {
      record.unit = input.unit;
    } else {
      const converted = convertQuantity(record.quantity, record.unit, input.unit);
      if (converted === null) {
        throw new ApiError(
          400,
          "VALIDATION_ERROR",
          `Cannot convert ${record.quantity} ${record.unit} to ${input.unit}. Provide a quantity as well.`,
        );
      }
      record.quantity = converted;
      record.unit = input.unit;
    }
  }
  if (input.quantity !== undefined) record.quantity = input.quantity;
  if (input.category !== undefined) record.category = input.category;
  if (input.expiryDate !== undefined) {
    record.expiryDate = input.expiryDate
      ? new Date(`${input.expiryDate}T00:00:00.000Z`)
      : null;
  }
  if (input.lowStockThreshold !== undefined) {
    record.lowStockThreshold = input.lowStockThreshold ?? null;
  }
  if (input.notes !== undefined) record.notes = input.notes ?? "";
  // Preserve the create-flow invariant: no two lines may share
  // `ingredientKey + unit` (a rename/unit change could otherwise fork one).
  const clash = await PantryItemModel.findOne({
    _id: { $ne: id },
    userId: user.id,
    ingredientKey: record.ingredientKey,
    unit: record.unit,
  })
    .select("_id")
    .lean()
    .exec();
  if (clash) {
    throw new ApiError(
      409,
      "CONFLICT",
      "Another pantry line already uses this ingredient and unit. Update its quantity instead.",
    );
  }
  await record.save();

  res.json({
    item: toPantryItemResponse({
      ...record.toObject(),
      _id: record._id,
    } as unknown as PantryRecord),
  });
});

/** DELETE /pantry/items/:id — remove own item (cross-user → 404). */
export const deleteItem = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const id = parseIdParam(req.params.id, "id");

  const deleted = await PantryItemModel.findOneAndDelete({ _id: id, userId: user.id }).exec();
  if (!deleted) {
    throw new ApiError(404, "NOT_FOUND", "Pantry item not found.");
  }
  res.status(200).json({ success: true });
});

/**
 * POST /pantry/items/:id/use — consume `quantity` atomically, never below
 * zero. Insufficient stock → 409 with `available` in the safeMessage and the
 * stored quantity left untouched.
 */
export const useItem = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const id = parseIdParam(req.params.id, "id");
  const qty = (req.body as { quantity?: unknown }).quantity;
  if (typeof qty !== "number" || !Number.isFinite(qty) || qty <= 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "Quantity must be greater than 0.");
  }

  const updated = await PantryItemModel.findOneAndUpdate(
    { _id: id, userId: user.id, quantity: { $gte: qty } },
    { $inc: { quantity: -qty } },
    { new: true },
  )
    .lean()
    .exec();
  if (updated) {
    res.json({ item: toPantryItemResponse(updated as unknown as PantryRecord) });
    return;
  }

  const existing = (await PantryItemModel.findOne({ _id: id, userId: user.id })
    .select("quantity unit")
    .lean()
    .exec()) as unknown as { quantity: number; unit: string } | null;
  if (!existing) {
    throw new ApiError(404, "NOT_FOUND", "Pantry item not found.");
  }
  throw new ApiError(
    409,
    "CONFLICT",
    `Insufficient pantry quantity. Available: ${existing.quantity} ${existing.unit}.`,
  );
});

/**
 * GET /pantry/expiring — own dated items, `expiryDate` asc (overdue first),
 * paginated with a hard cap of 20 per page. Powers "Use These Soon".
 */
export const expiringSoon = asyncHandler(async (req: Request, res: Response) => {
  const user = currentUser(req);
  const { page, limit } = PaginationQuery.parse(req.query);
  const perPage = Math.min(limit, 20);

  const filter = { userId: user.id, expiryDate: { $ne: null } };
  const [docs, total] = await Promise.all([
    PantryItemModel.find(filter)
      .sort({ expiryDate: 1 })
      .skip((page - 1) * perPage)
      .limit(perPage)
      .lean()
      .exec(),
    PantryItemModel.countDocuments(filter),
  ]);

  res.json({
    items: (docs as unknown as PantryRecord[]).map(toPantryItemResponse),
    page,
    limit: perPage,
    total,
    totalPages: Math.ceil(total / perPage),
  });
});
