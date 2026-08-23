export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary-strong text-white hover:bg-primary-deep active:bg-primary-deep",
  secondary:
    "bg-secondary-strong text-white hover:bg-secondary-deep active:bg-secondary-deep",
  outline: "border border-border-strong bg-card text-heading hover:bg-background",
  ghost: "text-subtle-foreground hover:bg-background hover:text-heading",
  danger: "bg-danger text-white hover:bg-danger-strong active:bg-danger-strong",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "h-9 gap-1.5 px-3 text-sm",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-11 gap-2 px-5 text-base",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
} = {}) {
  return `inline-flex items-center justify-center rounded-button font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]}`;
}
