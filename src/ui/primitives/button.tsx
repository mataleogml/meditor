import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

/** Vendored shadcn Button. Colors come from the package's `--scms-*` token
 *  contract (see theme.css), so the host maps it to whatever design system it
 *  uses — shadcn/foundation, Atlas, etc. */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--scms-ring)] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-[var(--scms-primary)] text-[var(--scms-primary-fg)] hover:opacity-90",
        secondary: "bg-[var(--scms-muted)] text-[var(--scms-fg)] hover:opacity-80",
        outline:
          "border border-[var(--scms-border)] bg-[var(--scms-bg)] text-[var(--scms-fg)] hover:bg-[var(--scms-muted)]",
        ghost: "text-[var(--scms-muted-fg)] hover:bg-[var(--scms-muted)] hover:text-[var(--scms-fg)]",
        destructive: "text-[var(--scms-destructive)] hover:bg-[var(--scms-muted)]",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        icon: "size-7",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

function Button({
  className,
  variant,
  size,
  ...props
}: Readonly<ComponentProps<"button"> & VariantProps<typeof buttonVariants>>) {
  return (
    <button data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
  );
}

export { Button, buttonVariants };
