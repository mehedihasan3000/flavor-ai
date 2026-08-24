"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-20">
      <ErrorState
        title="This page could not load"
        description="An unexpected error occurred. You can retry, or head back to the home page."
        action={<Button variant="outline" onClick={reset}>Try again</Button>}
      />
    </div>
  );
}
