import { StrictMode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommentSection } from "../src/components/recipes/comment-section";
import * as authContext from "../src/lib/auth-context";
import type { Comment } from "../src/lib/types";

const { apiMocks } = vi.hoisted(() => ({
  apiMocks: {
    listComments: vi.fn(),
    createComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
  },
}));

vi.mock("../src/lib/api", async () => {
  const actual = await vi.importActual("../src/lib/api");
  return { ...actual, ...apiMocks };
});

function mockAuth() {
  vi.spyOn(authContext, "useAuth").mockReturnValue({
    user: { id: "u1", email: "chef@example.com", name: "Chef", role: "user" },
    token: "valid-jwt-token",
    isAuthenticated: true,
    isLoading: false,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    setSession: vi.fn(),
    refresh: vi.fn(),
    patchUser: vi.fn(),
  });
}

function commentFixture(overrides: Partial<Comment> = {}): Comment {
  return {
    id: "c1",
    recipe: "r1",
    user: "u2",
    authorName: "Other Cook",
    authorAvatarUrl: null,
    body: "First!",
    moderationStatus: "visible",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function setStateInRenderErrors(consoleError: ReturnType<typeof vi.spyOn>) {
  return consoleError.mock.calls.filter((args: unknown[]) =>
    args.some((arg: unknown) => typeof arg === "string" && arg.includes("Cannot update a component")),
  );
}

describe("CommentSection parent count sync (setState-in-render regression)", () => {
  let consoleError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("posting a comment notifies the parent without updating it mid-render", async () => {
    const created = commentFixture({ id: "c2", user: "u1", authorName: "Chef", body: "Nice!" });
    apiMocks.listComments.mockResolvedValue({
      items: [commentFixture()],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
    apiMocks.createComment.mockResolvedValue(created);
    const onCountChange = vi.fn();

    // StrictMode (like Next.js dev) re-invokes state updaters during render,
    // so a parent update smuggled inside an updater throws here — exactly the
    // reported "Cannot update a component ... while rendering" console error.
    render(
      <StrictMode>
        <CommentSection recipeId="r1" onCountChange={onCountChange} />
      </StrictMode>,
    );

    await screen.findByText("First!");
    fireEvent.change(screen.getByPlaceholderText(/share how this recipe turned out/i), {
      target: { value: "Nice!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /post comment/i }));

    await screen.findByText("Nice!");
    // StrictMode double-runs the load effect (1, 1), then the post reports 2 —
    // exactly once. An impure updater (parent notified from inside setTotal)
    // re-fires during the double render, adding a duplicate call.
    expect(onCountChange).toHaveBeenCalledTimes(3);
    expect(onCountChange).toHaveBeenNthCalledWith(1, 1);
    expect(onCountChange).toHaveBeenNthCalledWith(2, 1);
    expect(onCountChange).toHaveBeenLastCalledWith(2);
    expect(setStateInRenderErrors(consoleError)).toEqual([]);
  });

  it("deleting a comment notifies the parent without updating it mid-render", async () => {
    const own = commentFixture({ id: "c1", user: "u1", authorName: "Chef", body: "Mine" });
    apiMocks.listComments.mockResolvedValue({
      items: [own],
      total: 1,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
    apiMocks.deleteComment.mockResolvedValue({ success: true });
    const onCountChange = vi.fn();

    render(
      <StrictMode>
        <CommentSection recipeId="r1" onCountChange={onCountChange} />
      </StrictMode>,
    );

    await screen.findByText("Mine");
    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));

    await waitFor(() => expect(onCountChange).toHaveBeenLastCalledWith(0));
    // StrictMode double-runs the load effect (1, 1), then the delete reports
    // 0 — exactly once.
    expect(onCountChange).toHaveBeenCalledTimes(3);
    expect(onCountChange).toHaveBeenNthCalledWith(1, 1);
    expect(onCountChange).toHaveBeenNthCalledWith(2, 1);
    expect(screen.queryByText("Mine")).not.toBeInTheDocument();
    expect(setStateInRenderErrors(consoleError)).toEqual([]);
  });
});
