"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "@/components/ui/pixel-icon";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  overlayClassName,
  children,
  showClose = true,
  disableCenterTranslate = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showClose?: boolean;
  overlayClassName?: string;
  disableCenterTranslate?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={cn(
        "authored-dialog-scrim fixed inset-0 z-[1999] data-[state=closed]:animate-out data-[state=open]:animate-in",
        overlayClassName,
      )} />
      <DialogPrimitive.Content
        className={cn(
          "authored-dialog-panel fixed left-1/2 top-1/2 z-[2000] max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-lg overflow-auto p-5 text-card-foreground focus:outline-none",
          !disableCenterTranslate && "-translate-x-1/2 -translate-y-1/2",
          className,
        )}
        {...props}
      >
        {children}
        {showClose ? (
          <DialogPrimitive.Close className="absolute right-3 top-3 grid size-11 place-items-center text-white focus-visible:outline-none ">
            <X className="size-5" />
            <span className="sr-only">Fechar</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader(props: React.ComponentProps<"div">) {
  return <div className="mb-5 space-y-2" {...props} />;
}

export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-xl font-black", className)} {...props} />;
}

export function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
}
