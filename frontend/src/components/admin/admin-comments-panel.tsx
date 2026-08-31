"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { ApiError, adminDeleteComment, adminListComments, adminModerateComment } from "@/lib/api";
import type { AdminComment, CommentStatus, PaginatedResult } from "@/lib/types";
import { Badge, Button, EmptyState, ErrorState, LoadingState, Pagination, Select } from "@/components/ui";

const PAGE_SIZE = 20;

export function AdminCommentsPanel() {
  const { token } = useAuth();

  const [moderationStatus, setModerationStatus] = useState<CommentStatus | "">("");
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<PaginatedResult<AdminComment> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actioningId, setActioningId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(
    (signal?: AbortSignal) => {
      return Promise.resolve()
        .then(() => {
          setIsLoading(true);
          setError(null);
        })
        .then(() =>
          adminListComments({ moderationStatus: moderationStatus || undefined, page, limit: PAGE_SIZE }, { token, signal }),
        )
        .then((data) => {
          setResult(data);
          setIsLoading(false);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError(err instanceof ApiError ? err.message : "Failed to load comments. Please try again.");
          setIsLoading(false);
        });
    },
    [moderationStatus, page, token],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const handleToggleModeration = (comment: AdminComment) => {
    const next: CommentStatus = comment.moderationStatus === "visible" ? "moderated" : "visible";
    setActioningId(comment.id);
    setActionError(null);
    adminModerateComment(comment.id, next, { token })
      .then((updated) => {
        setResult((prev) =>
          prev ? { ...prev, items: prev.items.map((c) => (c.id === updated.id ? updated : c)) } : prev,
        );
        setActioningId(null);
      })
      .catch((err: unknown) => {
        setActionError(err instanceof ApiError ? err.message : "Action failed. Please try again.");
        setActioningId(null);
      });
  };

  const handleDelete = (commentId: string) => {
    setActioningId(commentId);
    setActionError(null);
    adminDeleteComment(commentId, { token })
      .then(() => {
        setResult((prev) =>
          prev
            ? { ...prev, items: prev.items.filter((c) => c.id !== commentId), total: Math.max(0, prev.total - 1) }
            : prev,
        );
        setActioningId(null);
        setConfirmingDeleteId(null);
      })
      .catch((err: unknown) => {
        setActionError(err instanceof ApiError ? err.message : "Failed to delete comment. Please try again.");
        setActioningId(null);
        setConfirmingDeleteId(null);
      });
  };

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Select
          aria-label="Filter by moderation status"
          value={moderationStatus}
          onChange={(event) => {
            setModerationStatus(event.target.value as CommentStatus | "");
            setPage(1);
          }}
          className="sm:w-48"
        >
          <option value="">All comments</option>
          <option value="visible">Visible</option>
          <option value="moderated">Moderated</option>
        </Select>
      </div>

      {actionError && <p className="mb-3 text-xs font-medium text-danger-strong">{actionError}</p>}

      {isLoading ? (
        <LoadingState label="Loading comments…" />
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
        <EmptyState title="No comments found" description="Try a different moderation filter." />
      ) : (
        <>
          <p className="mb-3 text-xs text-muted-foreground">{result.total} comments</p>
          <ul className="space-y-3">
            {result.items.map((comment) => {
              const isBusy = actioningId === comment.id;
              const isConfirming = confirmingDeleteId === comment.id;
              const isModerated = comment.moderationStatus === "moderated";

              return (
                <li key={comment.id} className="rounded-card border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={isModerated ? "danger" : "success"}>
                          {isModerated ? "Moderated" : "Visible"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {isConfirming ? (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">Delete?</span>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDelete(comment.id)}
                            className="font-semibold text-danger-strong hover:underline disabled:opacity-50"
                          >
                            {isBusy ? "Deleting…" : "Confirm"}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setConfirmingDeleteId(null)}
                            className="font-medium text-muted-foreground hover:underline disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            loading={isBusy}
                            onClick={() => handleToggleModeration(comment)}
                          >
                            {isModerated ? "Restore" : "Moderate"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            disabled={isBusy}
                            onClick={() => setConfirmingDeleteId(comment.id)}
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Pagination page={result.page} totalPages={result.totalPages} onChange={setPage} label="Comments pages" />
        </>
      )}
    </div>
  );
}
