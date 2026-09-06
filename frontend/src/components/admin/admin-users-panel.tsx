"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError, adminListUsers } from "@/lib/api";
import type { AdminUser, PaginatedResult, UserRole } from "@/lib/types";
import { Badge, Button, EmptyState, ErrorState, Input, LoadingState, Pagination, Select } from "@/components/ui";

const PAGE_SIZE = 20;

export function AdminUsersPanel() {
  const { token } = useAuth();

  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<PaginatedResult<AdminUser> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => {
      return Promise.resolve()
        .then(() => {
          setIsLoading(true);
          setError(null);
        })
        .then(() =>
          adminListUsers({ q: q || undefined, role: role || undefined, page, limit: PAGE_SIZE }, { token, signal }),
        )
        .then((data) => {
          setResult(data);
          setIsLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError(err instanceof ApiError ? err.message : "Failed to load users. Please try again.");
          setIsLoading(false);
        });
    },
    [q, role, page, token],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const handleSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    setPage(1);
    setQ(qInput.trim());
  };

  return (
    <div>
      <form onSubmit={handleSearchSubmit} className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1 min-w-0">
          <Input
            type="search"
            value={qInput}
            onChange={(event) => setQInput(event.target.value)}
            placeholder="Search by name or email…"
            aria-label="Search users"
          />
        </div>
        <Select
          aria-label="Filter by role"
          value={role}
          onChange={(event) => {
            setRole(event.target.value as UserRole | "");
            setPage(1);
          }}
          className="sm:w-40 shrink-0"
        >
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </Select>
        <Button type="submit" className="shrink-0">
          Search
        </Button>
      </form>

      {isLoading ? (
        <LoadingState label="Loading users…" />
      ) : error ? (
        <ErrorState
          description={error}
          action={
            <Button type="button" variant="outline" onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      ) : !result || result.items.length === 0 ? (
        <EmptyState title="No users found" description="Try a different search or role filter." />
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">{result.total} users</p>
          <div className="overflow-x-auto rounded-card border border-border">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-border bg-background text-xs font-semibold text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5">Name</th>
                  <th scope="col" className="px-4 py-2.5">Email</th>
                  <th scope="col" className="px-4 py-2.5">Role</th>
                  <th scope="col" className="px-4 py-2.5">Joined</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((user) => (
                  <tr key={user.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-medium text-heading">{user.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={user.role === "admin" ? "primary" : "neutral"} className="capitalize">
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={result.page} totalPages={result.totalPages} onChange={setPage} label="Users pages" />
        </>
      )}
    </div>
  );
}
