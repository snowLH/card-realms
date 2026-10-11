import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "authored-button inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap px-4 text-sm font-extrabold transition disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none active:translate-y-px [&_.pixel-icon]:size-4",
  {
    variants: {
      variant: {
        default: "text-primary-foreground ",
        secondary: "border text-secondary-foreground ",
        ghost: "text-muted-foreground hover:text-foreground",
        danger: "text-white ",
        game: "border text-white ",
      },
      size: {
        default: "h-11",
        sm: "min-h-9 px-3 text-xs",
        lg: "min-h-12 px-6 text-base",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot.Root : "button";
  return (
    <Component
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { buttonVariants };
