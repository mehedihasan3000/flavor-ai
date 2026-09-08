import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Flame,
  HeartFill,
  Person,
  StarFill,
} from "@gravity-ui/icons";
import { Badge, buttonStyles } from "@/components/ui";

export interface MockFeaturedRecipe {
  id: string;
  slug: string;
  title: string;
  summary: string;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  totalTimeMinutes: number;
  diet: string;
  cuisine: string;
  difficulty: "Easy" | "Medium" | "Advanced";
  servings: number;
  rating: number;
  ratingCount: number;
  likesCount: number;
  authorName: string;
  gradient: string;
  categoryIcon: string;
  keyIngredients: string[];
}

const FEATURED_RECIPES: MockFeaturedRecipe[] = [
  {
    id: "rec-1",
    slug: "creamy-tuscan-garlic-chicken",
    title: "Creamy Tuscan Garlic Chicken",
    summary:
      "Tender pan-seared chicken breasts simmered in a sun-dried tomato and baby spinach garlic parmesan cream sauce.",
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: 30,
    diet: "High-Protein / Keto",
    cuisine: "Italian",
    difficulty: "Easy",
    servings: 4,
    rating: 4.9,
    ratingCount: 142,
    likesCount: 288,
    authorName: "Chef Elena",
    gradient: "from-amber-500/20 via-orange-500/10 to-red-500/5",
    categoryIcon: "🍗",
    keyIngredients: ["Chicken Breast", "Garlic", "Sun-Dried Tomatoes", "Spinach", "Parmesan"],
  },
  {
    id: "rec-2",
    slug: "crispy-sesame-ginger-tofu-bowl",
    title: "Crispy Sesame Ginger Tofu Bowl",
    summary:
      "Golden crispy tofu tossed in a savory ginger-tamari glaze, served over fluffy rice with charred broccoli and scallions.",
    prepTimeMinutes: 15,
    cookTimeMinutes: 15,
    totalTimeMinutes: 30,
    diet: "Vegan / Plant-Based",
    cuisine: "Asian Fusion",
    difficulty: "Easy",
    servings: 2,
    rating: 4.8,
    ratingCount: 96,
    likesCount: 194,
    authorName: "Marcus K.",
    gradient: "from-emerald-500/20 via-teal-500/10 to-green-500/5",
    categoryIcon: "🥗",
    keyIngredients: ["Firm Tofu", "Ginger", "Sesame Oil", "Broccoli", "Tamari"],
  },
  {
    id: "rec-3",
    slug: "smoky-chipotle-black-bean-skillet",
    title: "Smoky Chipotle Black Bean Skillet",
    summary:
      "One-skillet fiesta packed with seasoned black beans, sweet corn, melted queso fresco, and fresh cilantro lime drizzle.",
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    totalTimeMinutes: 25,
    diet: "Vegetarian / Gluten-Free",
    cuisine: "Mexican",
    difficulty: "Easy",
    servings: 3,
    rating: 4.9,
    ratingCount: 215,
    likesCount: 340,
    authorName: "Sofia R.",
    gradient: "from-orange-500/20 via-red-500/10 to-amber-500/5",
    categoryIcon: "🥘",
    keyIngredients: ["Black Beans", "Sweet Corn", "Chipotle", "Queso Fresco", "Lime"],
  },
  {
    id: "rec-4",
    slug: "pan-roasted-lemon-herb-salmon",
    title: "Pan-Roasted Lemon Herb Salmon",
    summary:
      "Crispy-skin salmon fillets infused with crushed garlic butter, fresh dill, capers, and served with tender asparagus spears.",
    prepTimeMinutes: 10,
    cookTimeMinutes: 15,
    totalTimeMinutes: 25,
    diet: "Pescatarian / Low-Carb",
    cuisine: "Mediterranean",
    difficulty: "Medium",
    servings: 2,
    rating: 5.0,
    ratingCount: 88,
    likesCount: 172,
    authorName: "Chef Liam",
    gradient: "from-sky-500/20 via-indigo-500/10 to-teal-500/5",
    categoryIcon: "🐟",
    keyIngredients: ["Salmon Fillet", "Lemon", "Fresh Dill", "Garlic Butter", "Asparagus"],
  },
];

export function FeaturedRecipes() {
  return (
    <section
      aria-labelledby="featured-recipes-heading"
      className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8"
    >
      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
        <div>
          <Badge variant="secondary">Community Showcase</Badge>
          <h2
            id="featured-recipes-heading"
            className="mt-3 text-3xl font-bold tracking-tight text-heading sm:text-4xl"
          >
            Trending Community Recipes
          </h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Explore popular dishes crafted from common pantry ingredients by home cooks and food lovers.
          </p>
        </div>

        <Link
          href="/recipes"
          className="inline-flex items-center gap-1.5 rounded-button text-sm font-semibold text-primary-strong transition-colors hover:text-primary-deep"
        >
          <span>View all community recipes</span>
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>

      {/* Recipe Grid */}
      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-2">
        {FEATURED_RECIPES.map((recipe) => (
          <article
            key={recipe.id}
            className="group flex flex-col justify-between overflow-hidden rounded-card border border-border bg-card shadow-xs transition-all duration-200 hover:-translate-y-1 hover:border-border-strong hover:shadow-md"
          >
            {/* Visual banner */}
            <div
              className={`relative flex h-36 items-center justify-between bg-gradient-to-br ${recipe.gradient} border-b border-border/60 px-6`}
            >
              <div className="flex size-14 items-center justify-center rounded-2xl bg-card/80 text-3xl shadow-xs backdrop-blur-xs">
                {recipe.categoryIcon}
              </div>

              {/* Top meta tags */}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Badge variant="primary" className="shadow-2xs">
                  <Clock className="size-3" />
                  {recipe.totalTimeMinutes} mins
                </Badge>
                <Badge variant="secondary">{recipe.diet}</Badge>
                <Badge variant="outline" className="bg-card/80 backdrop-blur-xs">
                  {recipe.cuisine}
                </Badge>
              </div>
            </div>

            {/* Content area */}
            <div className="flex flex-1 flex-col justify-between p-6">
              <div>
                {/* Title & Author */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-xl font-bold text-heading transition-colors group-hover:text-primary-strong">
                    {recipe.title}
                  </h3>
                </div>

                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Person className="size-3.5" />
                    {recipe.authorName}
                  </span>
                  <span>•</span>
                  <span>{recipe.servings} Servings</span>
                  <span>•</span>
                  <span>{recipe.difficulty}</span>
                </div>

                <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {recipe.summary}
                </p>

                {/* Key Ingredients */}
                <div className="mt-4">
                  <p className="text-xs font-semibold text-subtle-foreground">
                    Key Ingredients:
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {recipe.keyIngredients.map((item) => (
                      <span
                        key={item}
                        className="rounded-md bg-background px-2 py-0.5 text-xs text-subtle-foreground"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom stats & action */}
              <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1 text-warning">
                    <StarFill className="size-3.5" />
                    <span className="text-heading">{recipe.rating.toFixed(1)}</span>
                    <span className="font-normal text-muted-foreground">
                      ({recipe.ratingCount})
                    </span>
                  </span>
                  <span className="flex items-center gap-1 text-danger-strong">
                    <HeartFill className="size-3.5" />
                    <span className="text-muted-foreground">{recipe.likesCount}</span>
                  </span>
                </div>

                <Link
                  href={`/recipes`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary-strong transition-colors hover:text-primary-deep"
                >
                  View Details
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* CTA Footer */}
      <div className="mt-12 flex flex-col items-center justify-between gap-4 rounded-card border border-border bg-primary-soft/50 p-6 sm:flex-row sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary text-white">
            <Flame className="size-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-heading">
              Have unique ingredients waiting to be used?
            </p>
            <p className="text-xs text-muted-foreground">
              Turn your personal pantry into a custom-crafted meal in 30 seconds.
            </p>
          </div>
        </div>
        <Link
          href="/generator"
          className={buttonStyles({ size: "md" })}
        >
          Generate a Recipe
        </Link>
      </div>
    </section>
  );
}
