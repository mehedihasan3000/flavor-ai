import type {
  ErrorCode,
  ErrorEnvelope,
  PaginatedResult,
  Recipe,
  RecipeSearchQuery,
  UpdateProfileInput,
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
  token?: string | null;
}

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface InternalRequestOptions extends RequestOptions {
  method?: HttpMethod;
  body?: unknown;
}

async function request<T>(path: string, options: InternalRequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

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
