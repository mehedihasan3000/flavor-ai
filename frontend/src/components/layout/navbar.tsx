"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Bars, Flame, Person, Xmark, ArrowRightFromSquare, ChevronDown, ChevronUp } from "@gravity-ui/icons";
import { useAuth } from "@/lib/auth-context";

const NAV_LINKS = [
  { href: "/generator", label: "Generator" },
  { href: "/nutrition-analyzer", label: "Photo Nutrition" },
  { href: "/recipes", label: "Recipes" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/favorites", label: "Favorites" },
] as const;


function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
    `rounded-button px-3 py-2 text-sm font-medium transition-colors ${isActive(pathname, href)
      ? "bg-primary-soft text-primary-strong"
      : "text-subtle-foreground hover:bg-background hover:text-heading"
    }`;

  const mobileLinkClass = (href: string) =>
    `block rounded-button px-3 py-2.5 text-sm font-medium transition-colors ${isActive(pathname, href)
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
            <div className="hidden items-center gap-2 md:flex" ref={dropdownRef}>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-3 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-3 text-left transition-colors hover:border-border-strong hover:bg-background"
                >
                  {user?.avatarUrl && !avatarLoadFailed ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatarUrl}
                      alt={user?.name ? `${user.name} avatar` : "User avatar"}
                      className="size-8 shrink-0 rounded-full object-cover border border-border"
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarLoadFailed(true)}
                    />
                  ) : (
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                      <Person className="size-4 text-primary-strong" aria-hidden="true" />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-heading leading-tight">{user?.name || "User"}</span>
                    <span className="text-xs text-subtle-foreground leading-tight">{user?.email || ""}</span>
                  </div>
                  <div className="ml-1 text-subtle-foreground">
                    {dropdownOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                  </div>
                </button>

                <div
                  className={`absolute right-0 mt-2 w-64 origin-top-right rounded-2xl border border-border bg-card p-2 shadow-xl transition-all duration-200 ease-out z-50 ${dropdownOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
                    }`}
                >
                  <div className="mb-2 flex items-center gap-3 rounded-xl bg-background p-3 border border-border/50">
                    {user?.avatarUrl && !avatarLoadFailed ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={user.avatarUrl}
                        alt="User avatar"
                        className="size-10 shrink-0 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft">
                        <Person className="size-5 text-primary-strong" />
                      </div>
                    )}
                    <div className="flex flex-col overflow-hidden">
                      <span className="truncate text-sm font-bold text-heading">{user?.name || "User"}</span>
                      <span className="truncate text-xs text-subtle-foreground">{user?.email || ""}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Link
                      href={user?.role === "admin" ? "/admin" : "/dashboard"}
                      onClick={() => setDropdownOpen(false)}
                      className={`block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                        isActive(pathname, user?.role === "admin" ? "/admin" : "/dashboard")
                          ? "bg-primary-soft text-primary-strong"
                          : "text-heading hover:bg-background"
                      }`}
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/profile"
                      onClick={() => setDropdownOpen(false)}
                      className={`block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                        isActive(pathname, "/profile")
                          ? "bg-primary-soft text-primary-strong"
                          : "text-heading hover:bg-background"
                      }`}
                    >
                      My Profile
                    </Link>
                  </div>

                  <div className="mt-2 border-t border-border pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        void signOut();
                      }}
                      className="flex w-full items-center justify-center rounded-lg border border-danger px-4 py-2.5 text-sm font-medium text-danger-strong transition-colors hover:bg-danger-strong hover:text-white hover:border-danger-strong"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
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
            {NAV_LINKS.map((link) => (
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

            <div className="mt-4 border-t border-border pt-4 space-y-1">
              {isAuthenticated ? (
                <>
                  <Link
                    href="/profile"
                    onClick={close}
                    className={mobileLinkClass("/profile")}
                  >
                    Profile
                  </Link>
                  <Link
                    href={user?.role === "admin" ? "/admin" : "/dashboard"}
                    onClick={close}
                    className={mobileLinkClass(user?.role === "admin" ? "/admin" : "/dashboard")}
                  >
                    Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      void signOut();
                    }}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-danger px-4 py-2.5 text-sm font-medium text-danger-strong transition-colors hover:bg-danger-strong hover:text-white"
                  >
                    <ArrowRightFromSquare className="size-4" aria-hidden="true" />
                    Sign out
                  </button>
                </>
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

