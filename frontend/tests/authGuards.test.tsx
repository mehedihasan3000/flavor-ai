import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGuard } from "../src/components/auth/auth-guard";
import { AuthPrompt } from "../src/components/auth/auth-prompt";
import * as authContext from "../src/lib/auth-context";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/profile",
}));

describe("Frontend Unit & Component: AuthGuard and AuthPrompt", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders loading state while auth context is hydrating", () => {
    vi.spyOn(authContext, "useAuth").mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      setSession: vi.fn(),
      refresh: vi.fn(),
      patchUser: vi.fn(),
    });

    render(
      <AuthGuard>
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(screen.getByText(/checking authentication/i)).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("renders unauthenticated sign-in prompt when user is not authenticated", () => {
    vi.spyOn(authContext, "useAuth").mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      setSession: vi.fn(),
      refresh: vi.fn(),
      patchUser: vi.fn(),
    });

    render(
      <AuthGuard message="Custom sign-in prompt message">
        <div>Protected Content</div>
      </AuthGuard>,
    );

    expect(screen.getByText("Sign In Required")).toBeInTheDocument();
    expect(screen.getByText("Custom sign-in prompt message")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("renders access restricted screen when user lacks requiredRole='admin'", () => {
    vi.spyOn(authContext, "useAuth").mockReturnValue({
      user: {
        id: "123",
        name: "Regular User",
        email: "user@example.com",
        role: "user",
      },
      token: "valid-token",
      isAuthenticated: true,
      isLoading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      setSession: vi.fn(),
      refresh: vi.fn(),
      patchUser: vi.fn(),
    });

    render(
      <AuthGuard requiredRole="admin">
        <div>Admin Only Content</div>
      </AuthGuard>,
    );

    expect(screen.getByText("Access Restricted")).toBeInTheDocument();
    expect(screen.queryByText("Admin Only Content")).not.toBeInTheDocument();
  });

  it("renders protected content when user is authenticated with matching role", () => {
    vi.spyOn(authContext, "useAuth").mockReturnValue({
      user: {
        id: "123",
        name: "Admin User",
        email: "admin@example.com",
        role: "admin",
      },
      token: "valid-token",
      isAuthenticated: true,
      isLoading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      setSession: vi.fn(),
      refresh: vi.fn(),
      patchUser: vi.fn(),
    });

    render(
      <AuthGuard requiredRole="admin">
        <div>Admin Only Content</div>
      </AuthGuard>,
    );

    expect(screen.getByText("Admin Only Content")).toBeInTheDocument();
  });

  it("renders AuthPrompt banner with action title and sign in link", () => {
    vi.spyOn(authContext, "useAuth").mockReturnValue({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      setSession: vi.fn(),
      refresh: vi.fn(),
      patchUser: vi.fn(),
    });

    render(
      <AuthPrompt
        actionName="rate this recipe"
        description="Sign in to share your score with the community."
      />,
    );

    expect(screen.getByText(/sign in to rate this recipe/i)).toBeInTheDocument();
    expect(
      screen.getByText("Sign in to share your score with the community."),
    ).toBeInTheDocument();
  });
});
