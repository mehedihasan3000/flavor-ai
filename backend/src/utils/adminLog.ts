export type AdminActionEntry = {
  actorId: string;
  action: string;
  targetType: "user" | "recipe" | "comment";
  targetId: string;
  details?: Record<string, unknown>;
};

/**
 * Structured log line for every admin moderation action (FR-ADMIN-03:
 * "Administrative actions shall require an authorized role and be logged").
 * A full persisted audit trail is out of MVP scope per FR-ADMIN-04 ("a full
 * moderation dashboard is optional... protected moderation endpoints are
 * sufficient") — this keeps every action traceable in server logs without
 * introducing a 7th Mongoose model outside the frozen contract's model list.
 */
export function logAdminAction(entry: AdminActionEntry): void {
  console.info(
    `[admin-action] ${entry.action} ${entry.targetType}:${entry.targetId} by user:${entry.actorId}`,
    entry.details ?? {},
  );
}
