"use client";

const INGREDIENTS = [
  { name: "Fresh Garlic", emoji: "🧄" },
  { name: "Ripe Avocado", emoji: "🥑" },
  { name: "Chicken Breast", emoji: "🍗" },
  { name: "Roma Tomatoes", emoji: "🍅" },
  { name: "Fresh Basil", emoji: "🌿" },
  { name: "Jasmine Rice", emoji: "🍚" },
  { name: "Extra Virgin Olive Oil", emoji: "🫒" },
  { name: "Farm Eggs", emoji: "🥚" },
  { name: "Baby Spinach", emoji: "🍃" },
  { name: "Bell Peppers", emoji: "🫑" },
  { name: "Lemon Zest", emoji: "🍋" },
  { name: "Parmesan Cheese", emoji: "🧀" },
];

export function IngredientMarquee() {
  const items = [...INGREDIENTS, ...INGREDIENTS];

  return (
    <div
      aria-hidden="true"
      className="relative w-full overflow-hidden border-y border-border/70 bg-primary-soft/40 py-3 shadow-2xs backdrop-blur-xs select-none"
    >
      <div className="home-marquee-track flex gap-4 sm:gap-6">
        {items.map((item, idx) => (
          <div
            key={`${item.name}-${idx}`}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-primary/15 bg-card/90 px-3.5 py-1 text-xs font-semibold text-heading shadow-2xs transition-colors hover:border-primary/40 hover:bg-primary-soft hover:text-primary-strong"
          >
            <span className="text-sm">{item.emoji}</span>
            <span>{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
