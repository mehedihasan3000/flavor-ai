"use client";

import { ChevronLeft, ChevronRight } from "@gravity-ui/icons";
import { Button } from "./button";

export interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  label?: string;
}

/** Simple Previous/Next pager shared by paginated list views. Renders nothing for a single page. */
export function Pagination({ page, totalPages, onChange, label = "Pagination" }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav className="mt-8 flex items-center justify-center gap-3" aria-label={label}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Previous
      </Button>
      <span className="px-2 text-xs font-medium text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}
