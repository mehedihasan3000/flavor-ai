import { Spinner } from "./spinner";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 py-16 text-sm text-muted-foreground"
    >
      <Spinner className="size-5" />
      <span>{label}</span>
    </div>
  );
}
