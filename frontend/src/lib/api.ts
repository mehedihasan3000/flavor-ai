import type {
  AdminComment,
  AdminCommentSearchQuery,
  AdminRecipe,
  AdminRecipeSearchQuery,
  AdminUser,
  AdminUserSearchQuery,
  AIRecipeOutput,
  AIRecipePromptInput,
  Comment,
  CommentStatus,
  CreateCommentInput,
  CreateRatingInput,
  CreateRecipeInput,
  DashboardStats,
  ErrorCode,
  ErrorEnvelope,
  FavoriteItem,
  FavoriteStatus,
  FlavorPairingInput,
  FlavorPairingSuggestion,
  PaginatedResult,
  PaginationQuery,
  PantryMatchResult,
  Rating,
  RatingSummary,
  Recipe,
  RecipeSearchQuery,
  UpdateCommentInput,
  UpdateProfileInput,
  UpdateRecipeInput,
  UserProfile,
} from "./types";

const DEFAULT_BASE_URL = "http://localhost:4000/api/v1";

function resolveBaseUrl() {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return DEFAULT_BASE_URL;
  return raw.replace(/\/+$/, "");
}

const BASE_URL = resolveBaseUrl();

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly validation?: Record<string, string>;

  constructor(
    status: number,
    code: ErrorCode,
    safeMessage: string,
    validation?: Record<string, string>,
  ) {
    super(safeMessage);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.validation = validation;
  }
}

const FALLBACK_MESSAGES: Record<number, string> = {
  400: "Invalid input data. Please review your entries and try again.",
  401: "Please sign in to continue.",
  403: "You do not have permission to perform this action.",
  404: "This content could not be found.",
  409: "This record already exists.",
  429: "Too many requests. Please wait a moment and try again.",
  500: "Something went wrong on our side. Please try again.",
  502: "The AI service is temporarily unavailable. Please try again shortly.",
  504: "The request timed out. Please try again shortly.",
};

const FALLBACK_CODES: Record<number, ErrorCode> = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  429: "RATE_LIMITED",
  502: "AI_PROVIDER_ERROR",
  504: "AI_PROVIDER_ERROR",
};

const ERROR_CODE_VALUES: ReadonlySet<string> = new Set([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "AI_PROVIDER_ERROR",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && ERROR_CODE_VALUES.has(value);
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  if (isRecord(payload) && typeof payload.safeMessage === "string") {
    const envelope = payload as Partial<ErrorEnvelope>;
    return new ApiError(
      typeof envelope.status === "number" ? envelope.status : response.status,
      isErrorCode(envelope.code) ? envelope.code : (FALLBACK_CODES[response.status] ?? "INTERNAL_ERROR"),
      envelope.safeMessage || FALLBACK_MESSAGES[response.status] || "Request failed.",
      isRecord(envelope.validation) ? (envelope.validation as Record<string, string>) : undefined,
    );
  }

  return new ApiError(
    response.status,
    FALLBACK_CODES[response.status] ?? "INTERNAL_ERROR",
    FALLBACK_MESSAGES[response.status] ?? "Request failed. Please try again.",
  );
}

export interface RequestOptions {
  signal?: AbortSignal;
  /**
   * Explicit Bearer token. When omitted, the persisted session token
   * (AuthProvider's localStorage entry) is attached automatically.
   * Pass `null` to force an unauthenticated request.
   */
  token?: string | null;
}

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface InternalRequestOptions extends RequestOptions {
  method?: HttpMethod;
  body?: unknown;
}

// Must mirror STORAGE_KEY in lib/auth-context.tsx
const AUTH_STORAGE_KEY = "flavorai_auth_token";

function resolveAuthToken(options: InternalRequestOptions): string | null {
  if (options.token !== undefined) return options.token;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: InternalRequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const authToken = resolveAuthToken(options);
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(
      0,
      "INTERNAL_ERROR",
      "Cannot reach the FlavorAI API. Check your connection and try again.",
    );
  }

  if (!response.ok) throw await toApiError(response);

  if (response.status === 204) return undefined as T;

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(
      response.status,
      "INTERNAL_ERROR",
      "Received an invalid response from the server. Please try again.",
    );
  }
}

export function getMyProfile(options: RequestOptions = {}): Promise<UserProfile> {
  return request<UserProfile>("/users/me", options);
}

export function updateMyProfile(
  input: UpdateProfileInput,
  options: RequestOptions = {},
): Promise<UserProfile> {
  return request<UserProfile>("/users/me", { ...options, method: "PATCH", body: input });
}

export function getMyStats(options: RequestOptions = {}): Promise<DashboardStats> {
  return request<DashboardStats>("/users/me/stats", options);
}

export function listRecipes(
  query: RecipeSearchQuery = {},
  options: RequestOptions = {},
): Promise<PaginatedResult<Recipe>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return request<PaginatedResult<Recipe>>(`/recipes${search ? `?${search}` : ""}`, options);
}

export async function generateAIRecipe(
  input: AIRecipePromptInput,
  options: RequestOptions = {},
): Promise<AIRecipeOutput> {
  // Backend wraps the output: { recipe, pantryMatch } — unwrap for callers
  const res = await request<{ recipe: AIRecipeOutput; pantryMatch: PantryMatchResult }>(
    "/ai/recipes/generate",
    {
      ...options,
      method: "POST",
      body: input,
    },
  );
  return res.recipe;
}

export async function suggestFlavorPairings(
  input: FlavorPairingInput,
  options: RequestOptions = {},
): Promise<{ pairings: FlavorPairingSuggestion[] }> {
  // Backend returns { suggestions } — normalize to the client-side shape
  const res = await request<{ suggestions: FlavorPairingSuggestion[] }>("/ai/flavor-pairings", {
    ...options,
    method: "POST",
    body: input,
  });
  return { pairings: res.suggestions ?? [] };
}

export async function getRecipe(
  id: string,
  options: RequestOptions = {},
): Promise<Recipe> {
  const res = await request<{ recipe: Recipe }>(`/recipes/${id}`, options);
  return res.recipe;
}

export async function createRecipe(
  input: CreateRecipeInput,
  options: RequestOptions = {},
): Promise<Recipe> {
  const res = await request<{ recipe: Recipe }>("/recipes", {
    ...options,
    method: "POST",
    body: input,
  });
  return res.recipe;
}

export async function updateRecipe(
  id: string,
  input: UpdateRecipeInput,
  options: RequestOptions = {},
): Promise<Recipe> {
  const res = await request<{ recipe: Recipe }>(`/recipes/${id}`, {
    ...options,
    method: "PATCH",
    body: input,
  });
  return res.recipe;
}

export function deleteRecipe(
  id: string,
  options: RequestOptions = {},
): Promise<void> {
  return request<void>(`/recipes/${id}`, { ...options, method: "DELETE" });
}

export async function publishRecipe(
  id: string,
  options: RequestOptions = {},
): Promise<Recipe> {
  const res = await request<{ recipe: Recipe }>(`/recipes/${id}/publish`, {
    ...options,
    method: "POST",
  });
  return res.recipe;
}

export async function unpublishRecipe(
  id: string,
  options: RequestOptions = {},
): Promise<Recipe> {
  const res = await request<{ recipe: Recipe }>(`/recipes/${id}/unpublish`, {
    ...options,
    method: "POST",
  });
  return res.recipe;
}

export async function uploadImage(
  base64Data: string,
  mimeType?: string,
  filename?: string,
  options: RequestOptions = {},
): Promise<{ url: string; deleteUrl?: string }> {
  // Backend returns { imageUrl } — normalize to the client-side shape
  const res = await request<{ imageUrl: string; deleteUrl?: string }>("/upload/image", {
    ...options,
    method: "POST",
    body: { image: base64Data, mimeType, filename },
  });
  return { url: res.imageUrl, deleteUrl: res.deleteUrl };
}

// ─── Ratings (FR-RATE-01..05) ───────────────────────────────────────────────

/** Public summary; includes `myRating` when `options.token` is a valid session. */
export function getRatingSummary(
  recipeId: string,
  options: RequestOptions = {},
): Promise<RatingSummary> {
  return request<RatingSummary>(`/recipes/${recipeId}/ratings`, options);
}

export function rateRecipe(
  recipeId: string,
  input: CreateRatingInput,
  options: RequestOptions = {},
): Promise<{ rating: Rating; summary: RatingSummary }> {
  return request<{ rating: Rating; summary: RatingSummary }>(`/recipes/${recipeId}/ratings`, {
    ...options,
    method: "PUT",
    body: input,
  });
}

export function deleteRating(
  recipeId: string,
  options: RequestOptions = {},
): Promise<{ success: true }> {
  return request<{ success: true }>(`/recipes/${recipeId}/ratings`, {
    ...options,
    method: "DELETE",
  });
}

// ─── Favorites (FR-FAV-01..04) ──────────────────────────────────────────────

export function getFavoriteStatus(
  recipeId: string,
  options: RequestOptions = {},
): Promise<FavoriteStatus> {
  return request<FavoriteStatus>(`/favorites/${recipeId}`, options);
}

export function addFavorite(
  recipeId: string,
  options: RequestOptions = {},
): Promise<{ favorite: { id: string; recipe: string; user: string; createdAt: string }; favoriteCount: number }> {
  return request(`/favorites/${recipeId}`, { ...options, method: "PUT" });
}

export function removeFavorite(
  recipeId: string,
  options: RequestOptions = {},
): Promise<{ success: true; favoriteCount: number }> {
  return request(`/favorites/${recipeId}`, { ...options, method: "DELETE" });
}

export function listFavorites(
  query: PaginationQuery = {},
  options: RequestOptions = {},
): Promise<PaginatedResult<FavoriteItem>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return request<PaginatedResult<FavoriteItem>>(`/favorites${search ? `?${search}` : ""}`, options);
}

// ─── Comments (FR-COMMENT-01..05) ───────────────────────────────────────────

export function listComments(
  recipeId: string,
  query: PaginationQuery = {},
  options: RequestOptions = {},
): Promise<PaginatedResult<Comment>> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return request<PaginatedResult<Comment>>(
    `/recipes/${recipeId}/comments${search ? `?${search}` : ""}`,
    options,
  );
}

export async function createComment(
  recipeId: string,
  input: CreateCommentInput,
  options: RequestOptions = {},
): Promise<Comment> {
  const res = await request<{ comment: Comment }>(`/recipes/${recipeId}/comments`, {
    ...options,
    method: "POST",
    body: input,
  });
  return res.comment;
}

export async function updateComment(
  commentId: string,
  input: UpdateCommentInput,
  options: RequestOptions = {},
): Promise<Comment> {
  const res = await request<{ comment: Comment }>(`/comments/${commentId}`, {
    ...options,
    method: "PATCH",
    body: input,
  });
  return res.comment;
}

export function deleteComment(
  commentId: string,
  options: RequestOptions = {},
): Promise<{ success: true }> {
  return request<{ success: true }>(`/comments/${commentId}`, { ...options, method: "DELETE" });
}

// ─── Admin (FR-ADMIN-01..04) ────────────────────────────────────────────────

function toQueryString(query: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function adminListUsers(
  query: AdminUserSearchQuery = {},
  options: RequestOptions = {},
): Promise<PaginatedResult<AdminUser>> {
  return request<PaginatedResult<AdminUser>>(`/admin/users${toQueryString(query)}`, options);
}

export function adminListRecipes(
  query: AdminRecipeSearchQuery = {},
  options: RequestOptions = {},
): Promise<PaginatedResult<AdminRecipe>> {
  return request<PaginatedResult<AdminRecipe>>(`/admin/recipes${toQueryString(query)}`, options);
}

export async function adminModerateRecipe(
  id: string,
  status: "published" | "hidden",
  options: RequestOptions = {},
): Promise<AdminRecipe> {
  const res = await request<{ recipe: AdminRecipe }>(`/admin/recipes/${id}`, {
    ...options,
    method: "PATCH",
    body: { status },
  });
  return res.recipe;
}

export function adminDeleteRecipe(
  id: string,
  options: RequestOptions = {},
): Promise<{ success: true }> {
  return request<{ success: true }>(`/admin/recipes/${id}`, { ...options, method: "DELETE" });
}

export function adminListComments(
  query: AdminCommentSearchQuery = {},
  options: RequestOptions = {},
): Promise<PaginatedResult<AdminComment>> {
  return request<PaginatedResult<AdminComment>>(`/admin/comments${toQueryString(query)}`, options);
}

export async function adminModerateComment(
  id: string,
  moderationStatus: CommentStatus,
  options: RequestOptions = {},
): Promise<AdminComment> {
  const res = await request<{ comment: AdminComment }>(`/admin/comments/${id}`, {
    ...options,
    method: "PATCH",
    body: { moderationStatus },
  });
  return res.comment;
}

export function adminDeleteComment(
  id: string,
  options: RequestOptions = {},
): Promise<{ success: true }> {
  return request<{ success: true }>(`/admin/comments/${id}`, { ...options, method: "DELETE" });
}

