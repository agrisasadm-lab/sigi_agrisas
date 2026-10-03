import { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes, forwardRef } from "react";
import { cn } from "../../../_lib/cn";

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn("w-full text-body-sm", className)} {...props} />;
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("border-b border-outline-variant bg-surface-container", className)}
      {...props}
    />
  );
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={className} {...props} />;
}

interface TrProps extends HTMLAttributes<HTMLTableRowElement> {
  hoverable?: boolean;
}

export const Tr = forwardRef<HTMLTableRowElement, TrProps>(
  ({ className, hoverable = true, ...props }, ref) => {
    return (
      <tr
        ref={ref}
        className={cn(hoverable && "hover:bg-surface-container-low", className)}
        {...props}
      />
    );
  }
);
Tr.displayName = "Tr";

interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "right";
}

export function Th({ className, align = "left", ...props }: ThProps) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-label-sm text-on-surface-variant uppercase tracking-wide font-medium",
        align === "right" && "text-right tabular-nums",
        className
      )}
      {...props}
    />
  );
}

interface TdProps extends TdHTMLAttributes<HTMLTableCellElement> {
  align?: "left" | "right";
}

export function Td({ className, align = "left", ...props }: TdProps) {
  return (
    <td
      className={cn(
        "px-4 py-3",
        align === "right" && "text-right tabular-nums",
        className
      )}
      {...props}
    />
  );
}
