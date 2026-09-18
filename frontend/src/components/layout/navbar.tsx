"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bars, ChevronDown, Flame, Person, Xmark, ArrowRightFromSquare } from "@gravity-ui/icons";
import { useAuth } from "@/lib/auth-context";

const PUBLIC_LINKS = [
  { href: "/generator", label: "Generator" },
  { href: "/recipes", label: "Recipes" },
] as const;

const AUTH_INLINE_LINKS = [
  { href: "/assistant", label: "Assistant" },
  { href: "/nutrition-analyzer", label: "Photo Nutrition" },
] as const;

const MORE_LINKS = [
  { href: "/diet-plan", label: "Diet Plan" },
  { href: "/favorites", label: "Favorites" },
] as const;

const PROFILE_MENU_LINKS = [
  { href: "/profile", label: "Profile" },
  { href: "/dashboard", label: "Dashboard" },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname();
  const { user, isAuthenticated, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  const closeAll = () => {
    setOpen(false);
    setMoreOpen(false);
    setProfileOpen(false);
  };

  // Reset fallback when avatar URL changes (e.g. after Google login or profile update)
  useEffect(() => {
    Promise.resolve().then(() => setAvatarLoadFailed(false));
  }, [user?.avatarUrl]);

  useEffect(() => {
    if (!open && !moreOpen && !profileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setMoreOpen(false);
        setProfileOpen(false);
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (moreRef.current && !moreRef.current.contains(target)) setMoreOpen(false);
      if (profileRef.current && !profileRef.current.contains(target)) setProfileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, moreOpen, profileOpen]);

  const desktopLinkClass = (href: string) =>
    `rounded-button px-3 py-2 text-sm font-medium transition-colors ${
      isActive(pathname, href)
        ? "bg-primary-soft text-primary-strong"
        : "text-subtle-foreground hover:bg-background hover:text-heading"
    }`;

  const dropdownItemClass = (href: string) =>
    `block rounded-button px-3 py-2 text-sm font-medium transition-colors ${
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

  const isMoreActive = MORE_LINKS.some((link) => isActive(pathname, link.href));
  const isProfileActive = PROFILE_MENU_LINKS.some((link) => isActive(pathname, link.href));
  const mobileLinks = [
    ...PUBLIC_LINKS,
    ...(isAuthenticated
      ? [...AUTH_INLINE_LINKS, ...MORE_LINKS, ...PROFILE_MENU_LINKS]
      : []),
    ...(user?.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          onClick={closeAll}
          className="flex items-center gap-2.5 rounded-button"
          aria-label="FlavorAI home"
        >
          <span className="flex size-9 items-center justify-center rounded-button bg-primary-soft text-primary-strong">
            <Flame className="size-5" aria-hidden="true" />
          </span>
          <span className="text-lg font-bold tracking-tight text-heading">FlavorAI</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {PUBLIC_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(pathname, link.href) ? "page" : undefined}
              className={desktopLinkClass(link.href)}
            >
              {link.label}
            </Link>
          ))}
          {isAuthenticated
            ? AUTH_INLINE_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive(pathname, link.href) ? "page" : undefined}
                  className={desktopLinkClass(link.href)}
                >
                  {link.label}
                </Link>
              ))
            : null}
          {isAuthenticated ? (
            <div ref={moreRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  setMoreOpen((value) => !value);
                }}
                aria-expanded={moreOpen}
                aria-haspopup="menu"
                className={`inline-flex items-center gap-1 rounded-button px-3 py-2 text-sm font-medium transition-colors ${
                  isMoreActive
                    ? "bg-primary-soft text-primary-strong"
                    : "text-subtle-foreground hover:bg-background hover:text-heading"
                }`}
              >
                <span>More</span>
                <ChevronDown
                  className={`size-3.5 transition-transform ${moreOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
              {moreOpen ? (
                <div
                  role="menu"
                  aria-label="More"
                  className="absolute left-0 top-full z-50 mt-2 w-48 rounded-card border border-border bg-card p-1.5 shadow-lg"
                >
                  {MORE_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      role="menuitem"
                      aria-current={isActive(pathname, link.href) ? "page" : undefined}
                      onClick={() => setMoreOpen(false)}
                      className={dropdownItemClass(link.href)}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
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
              <div ref={profileRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    setProfileOpen((value) => !value);
                  }}
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                  className={`flex items-center gap-2 rounded-button px-3 py-1.5 text-sm font-medium transition-colors ${
                    isProfileActive
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
                  <ChevronDown
                    className={`size-3.5 transition-transform ${profileOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>
                {profileOpen ? (
                  <div
                    role="menu"
                    aria-label="Profile"
                    className="absolute right-0 top-full z-50 mt-2 w-52 rounded-card border border-border bg-card p-1.5 shadow-lg"
                  >
                    {PROFILE_MENU_LINKS.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        role="menuitem"
                        aria-current={isActive(pathname, link.href) ? "page" : undefined}
                        onClick={() => setProfileOpen(false)}
                        className={dropdownItemClass(link.href)}
                      >
                        {link.label}
                      </Link>
                    ))}
                    <div className="mt-1 border-t border-border pt-1">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setProfileOpen(false);
                          void signOut();
                        }}
                        className="flex w-full items-center gap-1.5 rounded-button px-3 py-2 text-sm font-medium text-subtle-foreground transition-colors hover:bg-danger-bg hover:text-danger-strong"
                        title="Sign out"
                      >
                        <ArrowRightFromSquare className="size-3.5" aria-hidden="true" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                ) : null}
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
            onClick={() => {
              setMoreOpen(false);
              setProfileOpen(false);
              setOpen((value) => !value);
            }}
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
            {mobileLinks.map((link) => (
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

