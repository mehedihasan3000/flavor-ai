"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Bars, Flame, Person, Xmark, ArrowRightFromSquare } from "@gravity-ui/icons";
import { useAuth } from "@/lib/auth-context";

const NAV_LINKS = [
  { href: "/generator", label: "Generator" },
  { href: "/recipes", label: "Recipes" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/favorites", label: "Favorites" },
] as const;

const MOBILE_EXTRA_LINKS = [{ href: "/profile", label: "Profile" }] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const close = () => setOpen(false);

  // Reset fallback when avatar URL changes (e.g. after Google login or profile update)
  useEffect(() => {
    Promise.resolve().then(() => setAvatarLoadFailed(false));
  }, [user?.avatarUrl]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const desktopLinkClass = (href: string) =>
    `rounded-button px-3 py-2 text-sm font-medium transition-colors ${
      isActive(pathname, href)
        ? "bg-primary-soft text-primary-strong"
        : "text-subtle-foreground hover:bg-background hover:text-heading"
    }`;

  const mobileLinkClass = (href: string) =>
    `block rounded-button px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive(pathname, href)
        ? "bg-primary-soft text-primary-strong"
        : "text-subtle-foreground hover:bg-background hover:text-heading"
    }`;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          onClick={close}
          className="flex items-center gap-2.5 rounded-button"
          aria-label="FlavorAI home"
        >
          <span className="flex size-9 items-center justify-center rounded-button bg-primary-soft text-primary-strong">
            <Flame className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold tracking-tight text-heading">FlavorAI</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(pathname, link.href) ? "page" : undefined}
              className={desktopLinkClass(link.href)}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <div className="hidden items-center gap-2 md:flex">
              {user?.role === "admin" && (
                <Link
                  href="/admin"
                  className={`rounded-button px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive(pathname, "/admin")
                      ? "bg-primary-soft text-primary-strong"
                      : "border border-border bg-card text-heading hover:border-border-strong hover:bg-background"
                  }`}
                >
                  Admin
                </Link>
              )}
              <Link
                href="/profile"
                className={`flex items-center gap-2 rounded-button px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive(pathname, "/profile")
                    ? "bg-primary-soft text-primary-strong"
                    : "border border-border bg-card text-heading hover:border-border-strong hover:bg-background"
                }`}
              >
                {user?.avatarUrl && !avatarLoadFailed ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.avatarUrl}
                    alt={user?.name ? `${user.name} avatar` : "User avatar"}
                    className="size-6 shrink-0 rounded-full object-cover border border-border"
                    referrerPolicy="no-referrer"
                    onError={() => setAvatarLoadFailed(true)}
                  />
                ) : (
                  <Person className="size-4 text-primary-strong" aria-hidden="true" />
                )}
                <span>{user?.name || "Profile"}</span>
              </Link>
              <button
                type="button"
                onClick={() => void signOut()}
                className="inline-flex items-center gap-1.5 rounded-button border border-border bg-card px-3 py-1.5 text-sm font-medium text-subtle-foreground transition-colors hover:border-danger hover:bg-danger-bg hover:text-danger-strong"
                title="Sign out"
              >
                <ArrowRightFromSquare className="size-3.5" aria-hidden="true" />
                <span>Sign out</span>
              </button>
            </div>
          ) : (
            <Link
              href="/sign-in"
              className="hidden items-center gap-2 rounded-button bg-primary-strong px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-deep md:inline-flex"
            >
              <Person className="size-4" aria-hidden="true" />
              Sign in
            </Link>
          )}

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="inline-flex items-center gap-2 rounded-button border border-border bg-card px-3 py-2 text-sm font-medium text-subtle-foreground transition-colors hover:bg-background hover:text-heading md:hidden"
          >
            {open ? (
              <Xmark className="size-5" aria-hidden="true" />
            ) : (
              <Bars className="size-5" aria-hidden="true" />
            )}
            Menu
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id="mobile-nav"
          aria-label="Main mobile"
          className="border-t border-border bg-card/95 backdrop-blur-md md:hidden"
        >
          <div className="mx-auto max-w-6xl space-y-1 px-4 py-4 sm:px-6">
            {[
              ...NAV_LINKS,
              ...MOBILE_EXTRA_LINKS,
              ...(user?.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={close}
                aria-current={isActive(pathname, link.href) ? "page" : undefined}
                className={mobileLinkClass(link.href)}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-3">
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => {
                    close();
                    void signOut();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-button border border-border bg-card px-4 py-2.5 text-sm font-medium text-subtle-foreground transition-colors hover:border-danger hover:bg-danger-bg hover:text-danger-strong"
                >
                  <ArrowRightFromSquare className="size-4" aria-hidden="true" />
                  Sign out ({user?.name || "User"})
                </button>
              ) : (
                <Link
                  href="/sign-in"
                  onClick={close}
                  className="flex w-full items-center justify-center gap-2 rounded-button bg-primary-strong px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-deep"
                >
                  <Person className="size-4" aria-hidden="true" />
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </nav>
      ) : null}
    </header>
  );
}

