import Link from "next/link";
import { Magnifier } from "@gravity-ui/icons";
import { buttonStyles } from "@/components/ui/button-styles";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-20">
      <EmptyState
        icon={<Magnifier aria-hidden="true" />}
        title="Page not found"
        description="The page you are looking for does not exist or may have moved."
        action={
          <>
            <Link href="/" className={buttonStyles()}>
              Back to home
            </Link>
            <Link
              href="/generator"
              className={buttonStyles({ variant: "outline" })}
            >
              Generate a recipe
            </Link>
          </>
        }
      />
    </div>
  );
}
