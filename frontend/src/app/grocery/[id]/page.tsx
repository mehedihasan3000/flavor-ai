"use client";

import { useCallback, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRotateRight,
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  TrashBin,
  Box,
} from "@gravity-ui/icons";
import { AuthGuard } from "@/components/auth";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Select,
} from "@/components/ui";
import {
  addGroceryItem,
  ApiError,
  clearPurchased as clearPurchasedApi,
  deleteGroceryItem,
  getGroceryList,
  markPurchased,
  purchasedToPantry as purchasedToPantryApi,
  recalculateGroceryList,
  updateGroceryItem,
} from "@/lib/api";
import type {
  GroceryItem,
  GroceryList,
  PantryCategory,
} from "@/lib/types";

const CATEGORIES: ReadonlyArray<{ value: PantryCategory; label: string }> = [
  { value: "vegetables", label: "Vegetables" },
  { value: "fruits", label: "Fruits" },
  { value: "meat", label: "Meat & Seafood" },
  { value: "dairy", label: "Dairy & Refrigerated" },
  { value: "grains", label: "Grains & Bakery" },
  { value: "spices", label: "Spices & Pantry" },
  { value: "frozen", label: "Frozen Foods" },
  { value: "snacks", label: "Snacks & Sweets" },
  { value: "other", label: "Other Essentials" },
];

export default function GroceryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const listId = resolvedParams.id;
  const router = useRouter();

  const [list, setList] = useState<GroceryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Manual Add Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState("1");
  const [newItemUnit, setNewItemUnit] = useState("pcs");
  const [newItemCategory, setNewItemCategory] = useState<PantryCategory>("other");
  const [addingItem, setAddingItem] = useState(false);

  // Edit Item Modal State
  const [editingItem, setEditingItem] = useState<GroceryItem | null>(null);
  const [editQty, setEditQty] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editCategory, setEditCategory] = useState<PantryCategory>("other");
  const [updatingItem, setUpdatingItem] = useState(false);

  // Purchased to Pantry Modal State
  const [showPantryModal, setShowPantryModal] = useState(false);
  const [selectedPantryItemIds, setSelectedPantryItemIds] = useState<string[]>([]);
  const [movingToPantry, setMovingToPantry] = useState(false);

  // Category Collapse State
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const fetchListDetail = useCallback(() => {
    Promise.resolve()
      .then(() => {
        setLoading(true);
        setError(null);
      })
      .then(() => getGroceryList(listId))
      .then((data) => {
        setList(data);
      })
      .catch((err) => {
        const msg = err instanceof ApiError ? err.message : "Failed to load grocery list details.";
        setError(msg);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [listId]);

  useEffect(() => {
    fetchListDetail();
  }, [fetchListDetail]);

  const handleTogglePurchased = async (item: GroceryItem) => {
    if (!list) return;
    const targetState = !item.isPurchased;
    // Optimistic UI update
    setList({
      ...list,
      items: list.items.map((i) => (i._id === item._id ? { ...i, isPurchased: targetState } : i)),
    });

    try {
      const updated = await markPurchased(listId, item._id, targetState);
      setList(updated);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to update item status.";
      setError(msg);
      fetchListDetail();
    }
  };

  const handleAddManualItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;

    setAddingItem(true);
    setError(null);
    try {
      const qty = Number(newItemQty);
      const updated = await addGroceryItem(listId, {
        name: newItemName.trim(),
        quantity: Number.isFinite(qty) && qty >= 0 ? qty : 1,
        unit: newItemUnit.trim() || "pcs",
        category: newItemCategory,
      });
      setList(updated);
      setNewItemName("");
      setNewItemQty("1");
      setNewItemUnit("pcs");
      setShowAddForm(false);
      setActionMessage("Manual item added.");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to add manual item.";
      setError(msg);
    } finally {
      setAddingItem(false);
    }
  };

  const handleSaveEditItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setUpdatingItem(true);
    setError(null);
    try {
      const qty = Number(editQty);
      const updated = await updateGroceryItem(listId, editingItem._id, {
        quantity: Number.isFinite(qty) && qty >= 0 ? qty : editingItem.quantity,
        unit: editUnit.trim() || editingItem.unit,
        category: editCategory,
      });
      setList(updated);
      setEditingItem(null);
      setActionMessage("Item updated.");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to update item.";
      setError(msg);
    } finally {
      setUpdatingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!list) return;
    try {
      await deleteGroceryItem(listId, itemId);
      setList({
        ...list,
        items: list.items.filter((i) => i._id !== itemId),
      });
      setActionMessage("Item removed.");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to delete item.";
      setError(msg);
    }
  };

  const handleRecalculate = async () => {
    setLoading(true);
    setError(null);
    try {
      const updated = await recalculateGroceryList(listId);
      setList(updated);
      setActionMessage("List recalculated against meal plan & pantry!");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to recalculate list.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleClearPurchased = async () => {
    if (!list) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await clearPurchasedApi(listId);
      setList(updated);
      setActionMessage("Purchased items cleared.");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to clear purchased items.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPantryModal = () => {
    if (!list) return;
    const purchased = list.items.filter((i) => i.isPurchased && !i.movedToPantry);
    setSelectedPantryItemIds(purchased.map((i) => i._id));
    setShowPantryModal(true);
  };

  const handleConfirmPantryTransfer = async () => {
    if (selectedPantryItemIds.length === 0) return;
    setMovingToPantry(true);
    setError(null);
    try {
      const { list: updatedList, results } = await purchasedToPantryApi(listId, selectedPantryItemIds);
      setList(updatedList);
      setShowPantryModal(false);
      const movedCount = results.filter((r) => r.status === "moved").length;
      setActionMessage(`Transferred ${movedCount} items to your pantry!`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to transfer items to pantry.";
      setError(msg);
    } finally {
      setMovingToPantry(false);
    }
  };

  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  if (loading && !list) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <LoadingState label="Loading grocery checklist..." />
      </div>
    );
  }

  if (error && !list) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <ErrorState
          title="Error Loading Grocery List"
          description={error}
          action={
            <Button variant="outline" onClick={fetchListDetail}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  if (!list) return null;

  const totalItems = list.items.length;
  const purchasedItems = list.items.filter((i) => i.isPurchased);
  const progressPercent = totalItems > 0 ? Math.round((purchasedItems.length / totalItems) * 100) : 0;

  // Group items by category
  const itemsByCategory: Record<string, GroceryItem[]> = {};
  for (const item of list.items) {
    const cat = item.category || "other";
    if (!itemsByCategory[cat]) itemsByCategory[cat] = [];
    itemsByCategory[cat].push(item);
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
      <AuthGuard>
        {/* Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-6">
          <div className="space-y-1">
            <button
              onClick={() => router.push("/grocery")}
              className="text-xs text-muted-foreground hover:text-emerald-400 flex items-center gap-1.5 transition-colors font-medium mb-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Grocery Lists
            </button>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{list.name}</h1>
            <p className="text-xs text-muted-foreground">
              {list.mealPlanId ? "Generated from Meal Plan" : "Custom Shopping List"} • Created{" "}
              {new Date(list.createdAt).toLocaleDateString()}
            </p>
          </div>

          {/* Action buttons toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecalculate}
              title="Re-sync with meal plan & subtract available pantry stock"
              className="gap-1.5 text-xs border-border/40 hover:bg-emerald-500/10 hover:text-emerald-300"
            >
              <ArrowRotateRight className="w-3.5 h-3.5" />
              Recalculate
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenPantryModal}
              disabled={purchasedItems.filter((i) => !i.movedToPantry).length === 0}
              className="gap-1.5 text-xs border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
            >
              <Box className="w-3.5 h-3.5" />
              Add Purchased to Pantry
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleClearPurchased}
              disabled={purchasedItems.length === 0}
              className="gap-1.5 text-xs border-border/40 hover:bg-red-500/10 hover:text-red-400"
            >
              <TrashBin className="w-3.5 h-3.5" />
              Clear Completed
            </Button>
          </div>
        </div>

        {/* Alerts & Messages */}
        {actionMessage && (
          <Alert variant="success" className="animate-in fade-in duration-200">
            {actionMessage}
          </Alert>
        )}
        {error && <Alert variant="danger">{error}</Alert>}

        {/* Progress & Budget Summary Header */}
        <Card className="p-5 bg-card/60 backdrop-blur-md border-border/40 rounded-2xl space-y-4">
          <div className="flex justify-between items-center text-sm font-medium">
            <span className="text-muted-foreground">Shopping Progress</span>
            <span className="text-foreground font-bold">
              {purchasedItems.length} of {totalItems} items ({progressPercent}%)
            </span>
          </div>

          <div className="h-3 w-full bg-muted/40 rounded-full overflow-hidden p-0.5 border border-border/30">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300 shadow-sm"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Budget cap (Item counts only — no price fabrication) */}
          <div className="flex flex-wrap justify-between items-center text-xs text-muted-foreground pt-1 border-t border-border/20">
            <span>
              {list.budget !== null && list.budget !== undefined ? (
                <strong className="text-emerald-400">Target cap: {list.budget} items</strong>
              ) : (
                "No item target cap configured"
              )}
            </span>
            <span className="italic">Pantry inventory subtracted automatically</span>
          </div>
        </Card>

        {/* Add Manual Item Bar */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-foreground">Category Checklist</h2>
          <Button
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 text-xs shadow-md"
          >
            <Plus className="w-3.5 h-3.5" />
            {showAddForm ? "Close Form" : "Add Item"}
          </Button>
        </div>

        {/* Manual Add Item Expandable Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddManualItem}
            className="p-4 bg-muted/20 border border-border/50 rounded-2xl space-y-4 animate-in slide-in-from-top-2 duration-200"
          >
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Item Name
                </label>
                <Input
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="e.g. Olive Oil, Garlic, Milk"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Quantity
                </label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Unit
                </label>
                <Input
                  value={newItemUnit}
                  onChange={(e) => setNewItemUnit(e.target.value)}
                  placeholder="pcs, g, ml..."
                  required
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pt-2">
              <div className="w-full sm:w-64">
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Category
                </label>
                <Select
                  value={newItemCategory}
                  onChange={(e) => setNewItemCategory(e.target.value as PantryCategory)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex justify-end gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={addingItem}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {addingItem ? "Adding..." : "Add to Checklist"}
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Category Grouped Items */}
        {totalItems === 0 ? (
          <EmptyState
            title="Your checklist is empty"
            description="All ingredients have been covered by your pantry or no items are required right now."
          />
        ) : (
          <div className="space-y-6">
            {CATEGORIES.map(({ value: categoryKey, label: categoryLabel }) => {
              const categoryItems = itemsByCategory[categoryKey] || [];
              if (categoryItems.length === 0) return null;

              const isCollapsed = Boolean(collapsedCategories[categoryKey]);
              const categoryPurchasedCount = categoryItems.filter((i) => i.isPurchased).length;

              return (
                <div
                  key={categoryKey}
                  className="bg-card/40 border border-border/40 rounded-2xl overflow-hidden shadow-sm transition-all"
                >
                  {/* Category Header */}
                  <div
                    onClick={() => toggleCategoryCollapse(categoryKey)}
                    className="flex justify-between items-center p-4 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/30"
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">
                        {categoryLabel}
                      </h3>
                      <Badge variant="neutral" className="text-xs px-2 py-0.5">
                        {categoryPurchasedCount}/{categoryItems.length}
                      </Badge>
                    </div>
                    <button className="text-muted-foreground hover:text-foreground">
                      {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Category Items List */}
                  {!isCollapsed && (
                    <div className="divide-y divide-border/20">
                      {categoryItems.map((item) => (
                        <div
                          key={item._id}
                          className={`flex items-center justify-between p-3.5 transition-colors ${
                            item.isPurchased ? "bg-muted/10 opacity-70" : "hover:bg-muted/20"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <Checkbox
                              label={<span className="sr-only">Mark {item.name} as purchased</span>}
                              checked={item.isPurchased}
                              onChange={() => handleTogglePurchased(item)}
                              className="accent-emerald-500 w-4 h-4 rounded cursor-pointer"
                            />

                            <div className="min-w-0 flex-1 space-y-0.5">
                              <span
                                className={`text-sm font-medium block truncate ${
                                  item.isPurchased ? "line-through text-muted-foreground" : "text-foreground"
                                }`}
                              >
                                {item.name}
                              </span>

                              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                <span className="font-semibold text-emerald-400/90">
                                  {item.quantity} {item.unit}
                                </span>

                                {item.isManual && (
                                  <Badge variant="primary" className="text-[10px] px-1.5 py-0">
                                    Manual
                                  </Badge>
                                )}

                                {item.estimated && (
                                  <Badge variant="warning" className="text-[10px] px-1.5 py-0">
                                    Scaled
                                  </Badge>
                                )}

                                {item.movedToPantry && (
                                  <Badge variant="success" className="text-[10px] px-1.5 py-0">
                                    In Pantry
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Quick Edit & Delete Actions */}
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingItem(item);
                                setEditQty(String(item.quantity));
                                setEditUnit(item.unit);
                                setEditCategory(item.category);
                              }}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                              title="Edit quantity / unit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteItem(item._id)}
                              className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400"
                              title="Delete item"
                            >
                              <TrashBin className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Edit Item Modal */}
        {editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <div className="bg-card border border-border/60 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <h3 className="text-lg font-semibold text-foreground">
                Edit {editingItem.name}
              </h3>

              <form onSubmit={handleSaveEditItem} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Quantity
                  </label>
                  <Input
                    type="number"
                    step="any"
                    min="0"
                    value={editQty}
                    onChange={(e) => setEditQty(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Unit
                  </label>
                  <Input
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    Category
                  </label>
                  <Select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as PantryCategory)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingItem(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={updatingItem}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    {updatingItem ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Purchased to Pantry Modal */}
        {showPantryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-card border border-border/60 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4">
              <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Box className="w-5 h-5 text-emerald-400" />
                Transfer Purchased Items to Pantry
              </h3>

              <p className="text-xs text-muted-foreground">
                Select purchased items to automatically add to your active pantry inventory (existing units will convert and accumulate safely).
              </p>

              <div className="max-h-60 overflow-y-auto space-y-2 border border-border/30 rounded-xl p-3 bg-muted/20">
                {purchasedItems
                  .filter((i) => !i.movedToPantry)
                  .map((item) => {
                    const isSelected = selectedPantryItemIds.includes(item._id);
                    return (
                      <div
                        key={item._id}
                        onClick={() =>
                          setSelectedPantryItemIds((prev) =>
                            isSelected ? prev.filter((id) => id !== item._id) : [...prev, item._id],
                          )
                        }
                        className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors border ${
                          isSelected
                            ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-200"
                            : "bg-card border-border/30 text-muted-foreground hover:bg-muted/30"
                        }`}
                      >
                        <div className="flex items-center gap-2 text-xs font-medium">
                          <Checkbox
                            label={<span className="sr-only">Select {item.name}</span>}
                            checked={isSelected}
                            onChange={() => {}}
                          />
                          <span>{item.name}</span>
                        </div>
                        <span className="text-xs font-semibold">
                          {item.quantity} {item.unit}
                        </span>
                      </div>
                    );
                  })}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowPantryModal(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmPantryTransfer}
                  disabled={movingToPantry || selectedPantryItemIds.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
                >
                  {movingToPantry ? "Transferring..." : `Add ${selectedPantryItemIds.length} Items to Pantry`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </AuthGuard>
    </div>
  );
}
