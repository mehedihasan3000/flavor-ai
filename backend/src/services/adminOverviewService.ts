import { UserModel } from "../models/User.js";
import { RecipeModel } from "../models/Recipe.js";
import { CommentModel } from "../models/Comment.js";
import { FavoriteModel } from "../models/Favorite.js";
import { AIGenerationLogModel } from "../models/AIGenerationLog.js";
import type {
  AdminOverviewActivityItem,
  AdminOverviewAiFailureItem,
  AdminOverviewAiHealth,
  AdminOverviewFeeds,
  AdminOverviewKpis,
  AdminOverviewResult,
  AdminOverviewTopCreator,
  AdminOverviewTopLists,
  AdminOverviewTopRecipe,
  AdminOverviewTrends,
  AdminOverviewTrendPoint,
} from "../types/index.js";

/** Helper: calculate start date for range filter */
export function getStartDateForRange(range: "7d" | "30d" | "90d"): Date {
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Helper: generate array of YYYY-MM-DD date strings for continuous trend series */
export function generateDateSeries(range: "7d" | "30d" | "90d"): string[] {
  const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
  const dates: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/** Fetch all-time KPI counts across platform */
export async function getAdminOverviewKpis(): Promise<AdminOverviewKpis> {
  const [
    totalUsers,
    userRolesRaw,
    totalRecipes,
    recipeStatusRaw,
    recipeSourceRaw,
    hiddenRecipesCount,
    moderatedCommentsCount,
    totalComments,
    totalFavorites,
    avgRatingRaw,
    aiTotalLogs,
    aiSuccessCount,
    aiLatencyRaw,
  ] = await Promise.all([
    UserModel.countDocuments(),
    UserModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$role", count: { $sum: 1 } } },
    ]),
    RecipeModel.countDocuments(),
    RecipeModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    RecipeModel.aggregate<{ _id: string; count: number }>([
      { $group: { _id: "$source", count: { $sum: 1 } } },
    ]),
    RecipeModel.countDocuments({ status: "hidden" }),
    CommentModel.countDocuments({ moderationStatus: "moderated" }),
    CommentModel.countDocuments(),
    FavoriteModel.countDocuments(),
    RecipeModel.aggregate<{ _id: null; avg: number }>([
      { $match: { status: "published", ratingCount: { $gt: 0 } } },
      { $group: { _id: null, avg: { $avg: "$averageRating" } } },
    ]),
    AIGenerationLogModel.countDocuments(),
    AIGenerationLogModel.countDocuments({ status: "success" }),
    AIGenerationLogModel.aggregate<{ _id: null; avgLatency: number }>([
      { $match: { status: "success" } },
      { $group: { _id: null, avgLatency: { $avg: "$latencyMs" } } },
    ]),
  ]);

  const userRoles = { user: 0, admin: 0 };
  for (const item of userRolesRaw) {
    if (item._id === "admin") userRoles.admin = item.count;
    else if (item._id === "user") userRoles.user = item.count;
  }

  const recipeStatus = { published: 0, draft: 0, hidden: 0 };
  for (const item of recipeStatusRaw) {
    if (item._id === "published") recipeStatus.published = item.count;
    else if (item._id === "draft") recipeStatus.draft = item.count;
    else if (item._id === "hidden") recipeStatus.hidden = item.count;
  }

  const recipeSource = { ai: 0, manual: 0 };
  for (const item of recipeSourceRaw) {
    if (item._id === "ai") recipeSource.ai = item.count;
    else if (item._id === "manual") recipeSource.manual = item.count;
  }

  const platformAvg = avgRatingRaw.length > 0 ? Number(avgRatingRaw[0].avg.toFixed(2)) : 0;
  const successRate = aiTotalLogs > 0 ? Number(((aiSuccessCount / aiTotalLogs) * 100).toFixed(1)) : 100;
  const avgLatencyMs = aiLatencyRaw.length > 0 ? Math.round(aiLatencyRaw[0].avgLatency) : 0;

  return {
    totalUsers,
    userRoles,
    totalRecipes,
    recipeStatus,
    recipeSource,
    pendingModeration: {
      hiddenRecipes: hiddenRecipesCount,
      moderatedComments: moderatedCommentsCount,
      total: hiddenRecipesCount + moderatedCommentsCount,
    },
    totalComments,
    totalFavorites,
    platformAverageRating: platformAvg,
    aiMetrics: {
      total: aiTotalLogs,
      successRate,
      averageLatencyMs: avgLatencyMs,
    },
  };
}

/** Fetch AI generation health status counts within time range */
export async function getAdminOverviewAiHealth(startDate: Date): Promise<AdminOverviewAiHealth> {
  const healthRaw = await AIGenerationLogModel.aggregate<{ _id: string; count: number }>([
    { $match: { createdAt: { $gte: startDate } } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const health = { success: 0, failed: 0, timeout: 0 };
  for (const item of healthRaw) {
    if (item._id === "success") health.success = item.count;
    else if (item._id === "failed") health.failed = item.count;
    else if (item._id === "timeout") health.timeout = item.count;
  }

  return health;
}

/** Fetch user growth & recipe creation trends with continuous zero-filled daily series */
export async function getAdminOverviewTrends(
  startDate: Date,
  range: "7d" | "30d" | "90d",
): Promise<AdminOverviewTrends> {
  const dateSeries = generateDateSeries(range);

  const [userGrowthRaw, recipeCreationRaw] = await Promise.all([
    UserModel.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
    ]),
    RecipeModel.aggregate<{ _id: string; count: number }>([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
    ]),
  ]);

  const userMap = new Map<string, number>();
  for (const item of userGrowthRaw) {
    if (item._id) userMap.set(item._id, item.count);
  }

  const recipeMap = new Map<string, number>();
  for (const item of recipeCreationRaw) {
    if (item._id) recipeMap.set(item._id, item.count);
  }

  const userGrowth: AdminOverviewTrendPoint[] = dateSeries.map((date) => ({
    date,
    count: userMap.get(date) ?? 0,
  }));

  const recipeCreation: AdminOverviewTrendPoint[] = dateSeries.map((date) => ({
    date,
    count: recipeMap.get(date) ?? 0,
  }));

  return { userGrowth, recipeCreation };
}

/** Fetch top rated recipes and top recipe creators */
export async function getAdminOverviewTopLists(): Promise<AdminOverviewTopLists> {
  const [topRecipesDocs, topCreatorsRaw] = await Promise.all([
    RecipeModel.find({ status: "published" })
      .sort({ averageRating: -1, favoriteCount: -1 })
      .limit(5)
      .lean(),
    RecipeModel.aggregate<{ userId: string; name: string; recipeCount: number }>([
      { $group: { _id: "$owner", recipeCount: { $sum: 1 } } },
      { $sort: { recipeCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userDoc",
        },
      },
      { $unwind: "$userDoc" },
      {
        $project: {
          _id: 0,
          userId: { $toString: "$_id" },
          name: "$userDoc.name",
          recipeCount: 1,
        },
      },
    ]),
  ]);

  const topRecipes: AdminOverviewTopRecipe[] = topRecipesDocs.map((doc) => ({
    id: String(doc._id),
    title: doc.title,
    averageRating: doc.averageRating ?? 0,
    favoriteCount: doc.favoriteCount ?? 0,
    status: doc.status as "published" | "draft" | "hidden",
  }));

  const topCreators: AdminOverviewTopCreator[] = topCreatorsRaw.map((item) => ({
    userId: item.userId,
    name: item.name,
    recipeCount: item.recipeCount,
  }));

  return { topRecipes, topCreators };
}

/** Fetch latest platform activity and recent AI failure logs */
export async function getAdminOverviewFeeds(startDate: Date): Promise<AdminOverviewFeeds> {
  const [newUsersDocs, newRecipesDocs, moderatedCommentsDocs, aiFailuresDocs] = await Promise.all([
    UserModel.find({ createdAt: { $gte: startDate } })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    RecipeModel.find({ status: "published", publishedAt: { $gte: startDate } })
      .sort({ publishedAt: -1 })
      .limit(10)
      .lean(),
    CommentModel.find({ moderationStatus: "moderated", createdAt: { $gte: startDate } })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    AIGenerationLogModel.find({ status: { $ne: "success" }, createdAt: { $gte: startDate } })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
  ]);

  const activityItems: AdminOverviewActivityItem[] = [
    ...newUsersDocs.map((u) => ({
      type: "user_registered" as const,
      id: String(u._id),
      title: u.name,
      createdAt: (u.createdAt ?? new Date()).toISOString(),
    })),
    ...newRecipesDocs.map((r) => ({
      type: "recipe_published" as const,
      id: String(r._id),
      title: r.title,
      createdAt: (r.publishedAt ?? r.createdAt ?? new Date()).toISOString(),
    })),
    ...moderatedCommentsDocs.map((c) => ({
      type: "comment_moderated" as const,
      id: String(c._id),
      title: c.body.length > 50 ? `${c.body.slice(0, 50)}…` : c.body,
      createdAt: (c.createdAt ?? new Date()).toISOString(),
    })),
  ];

  activityItems.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
  const latestActivity = activityItems.slice(0, 10);

  const recentAiFailures: AdminOverviewAiFailureItem[] = aiFailuresDocs.map((log) => ({
    id: String(log._id),
    model: log.model,
    errorCategory: (log.errorCategory as AdminOverviewAiFailureItem["errorCategory"]) ?? null,
    latencyMs: log.latencyMs ?? 0,
    createdAt: (log.createdAt ?? new Date()).toISOString(),
  }));

  return { latestActivity, recentAiFailures };
}

/** Complete Admin Overview service method */
export async function getAdminOverview(range: "7d" | "30d" | "90d"): Promise<AdminOverviewResult> {
  const startDate = getStartDateForRange(range);

  const [kpis, trends, aiHealth, topLists, feeds] = await Promise.all([
    getAdminOverviewKpis(),
    getAdminOverviewTrends(startDate, range),
    getAdminOverviewAiHealth(startDate),
    getAdminOverviewTopLists(),
    getAdminOverviewFeeds(startDate),
  ]);

  return {
    range,
    kpis,
    trends,
    aiHealth,
    topLists,
    feeds,
  };
}
