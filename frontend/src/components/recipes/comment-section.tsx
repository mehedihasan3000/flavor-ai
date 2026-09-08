"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Pencil, Person, TrashBin } from "@gravity-ui/icons";
import { useAuth } from "@/lib/auth-context";
import { ApiError, createComment, deleteComment, listComments, updateComment } from "@/lib/api";
import type { Comment } from "@/lib/types";
import { AuthPrompt } from "@/components/auth";
import { Alert, Button, EmptyState, ErrorState, LoadingState, Textarea } from "@/components/ui";

const PAGE_SIZE = 10;
const MAX_LENGTH = 2000;

export interface CommentSectionProps {
  recipeId: string;
  /** Called whenever the true comment total changes, so the parent can keep its badge in sync. */
  onCountChange?: (count: number) => void;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function AuthorAvatar({ comment }: { comment: Comment }) {
  if (comment.authorAvatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={comment.authorAvatarUrl}
        alt=""
        className="size-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  const initial = comment.authorName?.trim().charAt(0).toUpperCase();
  return (
    <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-strong">
      {initial || <Person className="size-4" aria-hidden="true" />}
    </div>
  );
}

/** Comment thread for a recipe: list + post/edit/delete (FR-COMMENT-01..05). */
export function CommentSection({ recipeId, onCountChange }: CommentSectionProps) {
  const { user, token, isAuthenticated } = useAuth();

  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [nextPage, setNextPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadFirstPage = useCallback(
    (signal?: AbortSignal) => {
      return Promise.resolve()
        .then(() => {
          setIsLoading(true);
          setError(null);
        })
        .then(() => listComments(recipeId, { page: 1, limit: PAGE_SIZE }, { signal }))
        .then((data) => {
          setComments(data.items);
          setTotal(data.total);
          setNextPage(2);
          setHasMore(data.totalPages > 1);
          setIsLoading(false);
          onCountChange?.(data.total);
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          setError(err instanceof ApiError ? err.message : "Failed to load comments. Please try again.");
          setIsLoading(false);
        });
    },
    [recipeId, onCountChange],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadFirstPage(controller.signal);
    return () => controller.abort();
  }, [loadFirstPage]);

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    listComments(recipeId, { page: nextPage, limit: PAGE_SIZE })
      .then((data) => {
        setComments((prev) => [...prev, ...data.items]);
        setNextPage((p) => p + 1);
        setHasMore(nextPage < data.totalPages);
        setIsLoadingMore(false);
      })
      .catch(() => {
        setIsLoadingMore(false);
      });
  };

  const handlePost = (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body) return;

    setPosting(true);
    setPostError(null);
    createComment(recipeId, { body }, { token })
      .then((created) => {
        // Comments sort oldest-first, so a freshly posted comment belongs at
        // the end of whatever is currently loaded — no refetch needed.
        setComments((prev) => [...prev, created]);
        setTotal((t) => {
          const next = t + 1;
          onCountChange?.(next);
          return next;
        });
        setDraft("");
        setPosting(false);
      })
      .catch((err: unknown) => {
        setPostError(err instanceof ApiError ? err.message : "Failed to post comment. Please try again.");
        setPosting(false);
      });
  };

  const startEdit = (comment: Comment) => {
    setActionError(null);
    setEditingId(comment.id);
    setEditDraft(comment.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const handleSaveEdit = (commentId: string) => {
    const body = editDraft.trim();
    if (!body) return;

    setSavingEdit(true);
    setActionError(null);
    updateComment(commentId, { body }, { token })
      .then((updated) => {
        setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
        setSavingEdit(false);
        setEditingId(null);
      })
      .catch((err: unknown) => {
        setActionError(err instanceof ApiError ? err.message : "Failed to save changes. Please try again.");
        setSavingEdit(false);
      });
  };

  const handleDelete = (commentId: string) => {
    setDeletingId(commentId);
    setActionError(null);
    deleteComment(commentId, { token })
      .then(() => {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setTotal((t) => {
          const next = Math.max(0, t - 1);
          onCountChange?.(next);
          return next;
        });
        setDeletingId(null);
        setConfirmingDeleteId(null);
      })
      .catch((err: unknown) => {
        setActionError(err instanceof ApiError ? err.message : "Failed to delete comment. Please try again.");
        setDeletingId(null);
        setConfirmingDeleteId(null);
      });
  };

  return (
    <section aria-labelledby="comments-heading" className="space-y-4">
      <h2 id="comments-heading" className="text-lg font-bold text-heading">
        Comments{total > 0 ? ` (${total})` : ""}
      </h2>

      {isAuthenticated ? (
        <form onSubmit={handlePost} className="space-y-2">
          <Textarea
            label="Add a comment"
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, MAX_LENGTH))}
            maxLength={MAX_LENGTH}
            rows={3}
            placeholder="Share how this recipe turned out, or ask a question…"
            hint={`${draft.length}/${MAX_LENGTH} characters`}
            disabled={posting}
          />
          {postError && (
            <Alert variant="danger" className="text-sm">
              {postError}
            </Alert>
          )}
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={posting} disabled={!draft.trim()}>
              Post comment
            </Button>
          </div>
        </form>
      ) : (
        <AuthPrompt variant="banner" actionName="join the conversation" />
      )}

      {actionError && (
        <Alert variant="danger" className="text-sm">
          {actionError}
        </Alert>
      )}

      {isLoading ? (
        <LoadingState label="Loading comments…" />
      ) : error ? (
        <ErrorState
          description={error}
          action={
            <Button type="button" variant="outline" onClick={() => void loadFirstPage()}>
              Try again
            </Button>
          }
        />
      ) : comments.length === 0 ? (
        <EmptyState
          title="No comments yet"
          description="Be the first to share how this recipe went."
        />
      ) : (
        <ul className="space-y-4">
          {comments.map((comment) => {
            const isOwn = Boolean(user && comment.user === user.id);
            const canDelete = isOwn || user?.role === "admin";
            const isEditing = editingId === comment.id;
            const isConfirmingDelete = confirmingDeleteId === comment.id;
            const isDeleting = deletingId === comment.id;
            const wasEdited = comment.updatedAt !== comment.createdAt;

            return (
              <li key={comment.id} className="flex gap-3 border-b border-border pb-4 last:border-0">
                <AuthorAvatar comment={comment} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <span className="text-sm font-semibold text-heading">
                      {comment.authorName ?? "FlavorAI member"}
                      {isOwn && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(You)</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(comment.createdAt)}
                      {wasEdited && " · edited"}
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        value={editDraft}
                        onChange={(event) => setEditDraft(event.target.value.slice(0, MAX_LENGTH))}
                        maxLength={MAX_LENGTH}
                        rows={3}
                        hint={`${editDraft.length}/${MAX_LENGTH} characters`}
                        disabled={savingEdit}
                        aria-label="Edit comment"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          loading={savingEdit}
                          disabled={!editDraft.trim()}
                          onClick={() => handleSaveEdit(comment.id)}
                        >
                          Save
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={cancelEdit} disabled={savingEdit}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                      {comment.body}
                    </p>
                  )}

                  {!isEditing && (isOwn || canDelete) && (
                    <div className="mt-2 flex items-center gap-3 text-xs">
                      {isOwn && (
                        <button
                          type="button"
                          onClick={() => startEdit(comment)}
                          className="flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-primary-strong"
                        >
                          <Pencil className="size-3.5" aria-hidden="true" />
                          Edit
                        </button>
                      )}
                      {canDelete && !isConfirmingDelete && (
                        <button
                          type="button"
                          onClick={() => setConfirmingDeleteId(comment.id)}
                          className="flex items-center gap-1 font-medium text-muted-foreground transition-colors hover:text-danger-strong"
                        >
                          <TrashBin className="size-3.5" aria-hidden="true" />
                          Delete
                        </button>
                      )}
                      {canDelete && isConfirmingDelete && (
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground">Delete this comment?</span>
                          <button
                            type="button"
                            onClick={() => handleDelete(comment.id)}
                            disabled={isDeleting}
                            className="font-semibold text-danger-strong hover:underline disabled:opacity-50"
                          >
                            {isDeleting ? "Deleting…" : "Confirm"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingDeleteId(null)}
                            disabled={isDeleting}
                            className="font-medium text-muted-foreground hover:underline disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && !isLoading && (
        <div className="flex justify-center pt-1">
          <Button type="button" variant="outline" size="sm" loading={isLoadingMore} onClick={handleLoadMore}>
            Load more comments
          </Button>
        </div>
      )}
    </section>
  );
}
