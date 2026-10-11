import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "authored-badge inline-flex min-h-6 items-center border px-2.5 py-0.5 text-xs font-bold text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
